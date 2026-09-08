use std::{
    collections::HashMap,
    io,
    net::{IpAddr, SocketAddr},
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use axum::{
    Json, Router,
    body::Body,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use axum_server::tls_rustls::RustlsConfig;
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use chrono::Utc;
use futures_util::StreamExt;
use mdns_sd::{ServiceDaemon, ServiceInfo};
use omarchy_link_protocol::{
    ApiError, ClipboardReadResponse, ClipboardWriteRequest, InboxTextRequest, LockRequest,
    MAX_CONTROL_BYTES, MAX_FILE_BYTES, OperationResponse, PROTOCOL_VERSION, PairApproved,
    PairRequest, Permission, StatusResponse,
};
use rcgen::generate_simple_self_signed;
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;
use tower_http::trace::TraceLayer;
use uuid::Uuid;

use crate::{
    adapters::{self, notify_received, sanitize_filename},
    admin,
    config::{AppPaths, set_private_file},
    state::{AppState, PairDecision},
};

#[derive(Debug, Clone)]
pub struct RunConfig {
    pub bind_ip: IpAddr,
    pub advertised_ip: IpAddr,
    pub port: u16,
    pub paths: AppPaths,
}

pub async fn run(config: RunConfig) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    config.paths.prepare()?;
    let fingerprint = ensure_identity(&config.paths)?;
    let state = AppState::load(config.paths.clone(), fingerprint)?;
    let router = router(Arc::clone(&state));
    let tls = RustlsConfig::from_pem_file(
        config.paths.certificate_file(),
        config.paths.private_key_file(),
    )
    .await?;
    let address = SocketAddr::new(config.bind_ip, config.port);
    let _mdns = advertise(&state, config.advertised_ip, config.port).await?;

    tracing::info!(%address, "omarchy-linkd ready");
    tokio::select! {
        result = axum_server::bind_rustls(address, tls).serve(router.into_make_service()) => result?,
        result = admin::serve(Arc::clone(&state)) => result?,
        _ = tokio::signal::ctrl_c() => tracing::info!("shutdown requested"),
    }
    Ok(())
}

fn router(state: Arc<AppState>) -> Router {
    let control = Router::new()
        .route("/v1/pair/request", post(pair_request))
        .route("/v1/status", get(status))
        .route("/v1/clipboard", get(clipboard_read).post(clipboard_write))
        .route("/v1/inbox/text", post(inbox_text))
        .route("/v1/actions/lock", post(lock))
        .layer(DefaultBodyLimit::max(MAX_CONTROL_BYTES));
    let transfer = Router::new()
        .route("/v1/inbox/file", post(inbox_file))
        .layer(DefaultBodyLimit::disable());
    control
        .merge(transfer)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn pair_request(
    State(state): State<Arc<AppState>>,
    Json(request): Json<PairRequest>,
) -> Result<Json<PairApproved>, AppError> {
    request
        .validate()
        .map_err(|_| AppError::bad_request("pair.invalid_request", "Pairing request is invalid"))?;

    let notify = {
        let mut pairing = state.pairing.lock().await;
        let window = pairing
            .as_mut()
            .ok_or_else(|| AppError::gone("pair.closed", "No pairing window is open"))?;
        if window.is_expired() {
            return Err(AppError::gone(
                "pair.expired",
                "The pairing code has expired",
            ));
        }
        if !crate::state::constant_time_string_eq(&window.secret, &request.secret) {
            return Err(AppError::unauthorized(
                "pair.invalid_secret",
                "The pairing code is invalid",
            ));
        }
        if window.request.is_some() {
            return Err(AppError::conflict(
                "pair.request_pending",
                "Another pairing request is already awaiting approval",
            ));
        }
        window.request = Some(request);
        Arc::clone(&window.notify)
    };

    let result = tokio::time::timeout(Duration::from_secs(5 * 60), async {
        loop {
            let notified = notify.notified();
            {
                let pairing = state.pairing.lock().await;
                let window = pairing.as_ref().ok_or_else(|| {
                    AppError::gone("pair.closed", "The pairing window was closed")
                })?;
                if window.is_expired() {
                    return Err(AppError::gone(
                        "pair.expired",
                        "The pairing code has expired",
                    ));
                }
                if let Some(decision) = &window.decision {
                    return match decision {
                        PairDecision::Approved(approved) => Ok(approved.clone()),
                        PairDecision::Rejected => Err(AppError::forbidden(
                            "pair.rejected",
                            "Pairing was rejected on the desktop",
                        )),
                    };
                }
            }
            notified.await;
        }
    })
    .await
    .map_err(|_| AppError::gone("pair.expired", "The pairing request timed out"))??;

    *state.pairing.lock().await = None;
    Ok(Json(result))
}

async fn status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<StatusResponse>, AppError> {
    authorize(&state, &headers, Permission::Status).await?;
    let persisted = state.persisted.read().await;
    let peer = persisted
        .peer
        .as_ref()
        .ok_or_else(|| AppError::unauthorized("auth.revoked", "This phone is no longer paired"))?;
    Ok(Json(StatusResponse {
        protocol_version: PROTOCOL_VERSION,
        desktop_id: persisted.desktop_id.clone(),
        desktop_name: persisted.desktop_name.clone(),
        paired_device_name: peer.device_name.clone(),
        server_time: Utc::now().to_rfc3339(),
    }))
}

async fn clipboard_write(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ClipboardWriteRequest>,
) -> Result<Json<OperationResponse>, AppError> {
    authorize(&state, &headers, Permission::ClipboardWrite).await?;
    request
        .validate()
        .map_err(|_| AppError::too_large("clipboard.too_large", "Clipboard text exceeds 64 KiB"))?;
    adapters::write_clipboard(&request.text)
        .await
        .map_err(|_| {
            AppError::service(
                "clipboard.write_failed",
                "The desktop clipboard could not be updated",
                true,
            )
        })?;
    Ok(Json(completed("Desktop clipboard updated")))
}

async fn clipboard_read(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<ClipboardReadResponse>, AppError> {
    authorize(&state, &headers, Permission::ClipboardRead).await?;
    let text = adapters::read_clipboard().await.map_err(|_| {
        AppError::service(
            "clipboard.read_failed",
            "The desktop clipboard does not contain supported text",
            false,
        )
    })?;
    Ok(Json(ClipboardReadResponse { text }))
}

async fn inbox_text(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<InboxTextRequest>,
) -> Result<Json<OperationResponse>, AppError> {
    authorize(&state, &headers, Permission::InboxWrite).await?;
    request.validate().map_err(|_| {
        AppError::bad_request("inbox.invalid_text", "Shared text is empty or too large")
    })?;
    let suffix = match request.content_type {
        omarchy_link_protocol::TextContentType::Text => "txt",
        omarchy_link_protocol::TextContentType::Url => "url.txt",
    };
    let path = state.paths.inbox_dir.join(format!(
        "shared-{}-{}.{}",
        Utc::now().format("%Y%m%d-%H%M%S"),
        &Uuid::new_v4().simple().to_string()[..8],
        suffix
    ));
    tokio::fs::write(&path, request.text.as_bytes())
        .await
        .map_err(|_| {
            AppError::service(
                "inbox.write_failed",
                "The shared text could not be saved",
                true,
            )
        })?;
    notify_received("Text received in Omarchy Inbox").await;
    Ok(Json(completed("Saved to Omarchy Inbox")))
}

async fn inbox_file(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Body,
) -> Result<Json<OperationResponse>, AppError> {
    authorize(&state, &headers, Permission::InboxWrite).await?;
    let declared_size = required_header(&headers, "content-length")?
        .parse::<u64>()
        .map_err(|_| AppError::bad_request("transfer.invalid_size", "File size is invalid"))?;
    if declared_size > MAX_FILE_BYTES {
        return Err(AppError::too_large(
            "transfer.too_large",
            "File exceeds the 25 MiB limit",
        ));
    }
    let filename = sanitize_filename(required_header(&headers, "x-omarchy-filename")?);
    let expected_digest = required_header(&headers, "x-omarchy-sha256")?.to_ascii_lowercase();
    if expected_digest.len() != 64 || !expected_digest.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return Err(AppError::bad_request(
            "transfer.invalid_digest",
            "SHA-256 digest is invalid",
        ));
    }

    let operation_id = Uuid::new_v4().to_string();
    let temporary = state.paths.inbox_dir.join(format!(".{operation_id}.part"));
    let mut file = tokio::fs::OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .await
        .map_err(|_| {
            AppError::service("transfer.open_failed", "The inbox is not writable", false)
        })?;
    let mut stream = body.into_data_stream();
    let mut received = 0_u64;
    let mut digest = Sha256::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| {
            AppError::bad_request("transfer.interrupted", "File upload was interrupted")
        })?;
        received = received.saturating_add(chunk.len() as u64);
        if received > MAX_FILE_BYTES || received > declared_size {
            cleanup(&temporary).await;
            return Err(AppError::too_large(
                "transfer.too_large",
                "File exceeds its declared size",
            ));
        }
        digest.update(&chunk);
        if file.write_all(&chunk).await.is_err() {
            cleanup(&temporary).await;
            return Err(AppError::service(
                "transfer.disk_write_failed",
                "The file could not be written",
                false,
            ));
        }
    }
    if received != declared_size {
        cleanup(&temporary).await;
        return Err(AppError::bad_request(
            "transfer.size_mismatch",
            "Received file size does not match",
        ));
    }
    let actual_digest = format!("{:x}", digest.finalize());
    if actual_digest != expected_digest {
        cleanup(&temporary).await;
        return Err(AppError::bad_request(
            "transfer.digest_mismatch",
            "File integrity check failed",
        ));
    }
    file.sync_all().await.map_err(|_| {
        AppError::service(
            "transfer.disk_write_failed",
            "The file could not be finalized",
            false,
        )
    })?;
    drop(file);
    let destination = unique_destination(&state.paths.inbox_dir, &filename, &operation_id);
    tokio::fs::rename(&temporary, &destination)
        .await
        .map_err(|_| {
            AppError::service(
                "transfer.finalize_failed",
                "The file could not be finalized",
                false,
            )
        })?;
    notify_received("File received in Omarchy Inbox").await;
    Ok(Json(OperationResponse {
        operation_id,
        completed: true,
        message: format!("Saved {filename} to Omarchy Inbox"),
    }))
}

async fn lock(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<LockRequest>,
) -> Result<Json<OperationResponse>, AppError> {
    authorize(&state, &headers, Permission::SystemLock).await?;
    request.validate().map_err(|_| {
        AppError::bad_request(
            "action.invalid_idempotency_key",
            "Lock request identifier is invalid",
        )
    })?;
    if !state
        .register_lock_key(&request.idempotency_key)
        .await
        .map_err(|_| {
            AppError::service(
                "action.state_failed",
                "Lock request could not be recorded",
                true,
            )
        })?
    {
        return Ok(Json(OperationResponse {
            operation_id: request.idempotency_key,
            completed: true,
            message: "Desktop lock already accepted".into(),
        }));
    }
    adapters::lock_desktop().await.map_err(|_| {
        AppError::service(
            "action.lock_failed",
            "Omarchy could not lock the desktop",
            true,
        )
    })?;
    Ok(Json(OperationResponse {
        operation_id: request.idempotency_key,
        completed: true,
        message: "Desktop locked".into(),
    }))
}

async fn authorize(
    state: &AppState,
    headers: &HeaderMap,
    permission: Permission,
) -> Result<(), AppError> {
    let bearer = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or_else(|| {
            AppError::unauthorized(
                "auth.required",
                "Pair this phone before using Omarchy Mobile",
            )
        })?;
    if state.authorize_bearer(bearer, permission).await {
        Ok(())
    } else {
        Err(AppError::forbidden(
            "auth.denied",
            "This phone is revoked or lacks permission",
        ))
    }
}

fn required_header<'a>(headers: &'a HeaderMap, name: &str) -> Result<&'a str, AppError> {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| {
            AppError::bad_request("request.missing_header", format!("Missing {name} header"))
        })
}

fn completed(message: &str) -> OperationResponse {
    OperationResponse {
        operation_id: Uuid::new_v4().to_string(),
        completed: true,
        message: message.to_owned(),
    }
}

async fn cleanup(path: &Path) {
    let _ = tokio::fs::remove_file(path).await;
}

fn unique_destination(inbox: &Path, filename: &str, operation_id: &str) -> PathBuf {
    let candidate = inbox.join(filename);
    if !candidate.exists() {
        return candidate;
    }
    let path = Path::new(filename);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("shared-file");
    let extension = path.extension().and_then(|value| value.to_str());
    let suffix = &operation_id[..8];
    let collision_name = extension.map_or_else(
        || format!("{stem}-{suffix}"),
        |extension| format!("{stem}-{suffix}.{extension}"),
    );
    inbox.join(collision_name)
}

fn ensure_identity(paths: &AppPaths) -> io::Result<String> {
    let certificate_path = paths.certificate_file();
    let private_key_path = paths.private_key_file();
    if !certificate_path.exists() || !private_key_path.exists() {
        let certified =
            generate_simple_self_signed(vec!["omarchy.local".into(), "localhost".into()])
                .map_err(io::Error::other)?;
        std::fs::write(&certificate_path, certified.cert.pem())?;
        std::fs::write(&private_key_path, certified.signing_key.serialize_pem())?;
        set_private_file(&certificate_path)?;
        set_private_file(&private_key_path)?;
    }
    let pem = std::fs::read(&certificate_path)?;
    let mut reader = io::BufReader::new(pem.as_slice());
    let certificate = rustls_pemfile::certs(&mut reader)
        .next()
        .transpose()
        .map_err(io::Error::other)?
        .ok_or_else(|| io::Error::other("identity certificate is empty"))?;
    Ok(URL_SAFE_NO_PAD.encode(Sha256::digest(certificate.as_ref())))
}

async fn advertise(
    state: &AppState,
    ip: IpAddr,
    port: u16,
) -> Result<ServiceDaemon, mdns_sd::Error> {
    let daemon = ServiceDaemon::new()?;
    let persisted = state.persisted.read().await;
    let pair = state
        .pairing
        .lock()
        .await
        .as_ref()
        .is_some_and(|window| !window.is_expired());
    let properties = HashMap::from([
        ("id".to_owned(), persisted.desktop_id.clone()),
        ("pv".to_owned(), PROTOCOL_VERSION.to_string()),
        ("pair".to_owned(), u8::from(pair).to_string()),
    ]);
    let host = format!(
        "{}.local.",
        persisted.desktop_id.chars().take(20).collect::<String>()
    );
    let service = ServiceInfo::new(
        "_omarchy._tcp.local.",
        &persisted.desktop_name,
        &host,
        ip,
        port,
        Some(properties),
    )?
    .enable_addr_auto();
    daemon.register(service)?;
    Ok(daemon)
}

#[derive(Debug)]
struct AppError {
    status: StatusCode,
    body: ApiError,
}

impl AppError {
    fn new(status: StatusCode, code: &str, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            status,
            body: ApiError::new(code, message, retryable),
        }
    }

    fn bad_request(code: &str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, code, message, false)
    }

    fn unauthorized(code: &str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, code, message, false)
    }

    fn forbidden(code: &str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, code, message, false)
    }

    fn gone(code: &str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::GONE, code, message, false)
    }

    fn conflict(code: &str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, code, message, true)
    }

    fn too_large(code: &str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::PAYLOAD_TOO_LARGE, code, message, false)
    }

    fn service(code: &str, message: impl Into<String>, retryable: bool) -> Self {
        Self::new(StatusCode::SERVICE_UNAVAILABLE, code, message, retryable)
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (self.status, Json(self.body)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_filename_stays_inside_inbox() {
        let temporary = tempfile::tempdir().expect("temp dir");
        std::fs::write(temporary.path().join("report.pdf"), b"existing").expect("fixture");
        let destination = unique_destination(
            temporary.path(),
            &sanitize_filename("../../report.pdf"),
            "12345678-aaaa-bbbb-cccc-dddddddddddd",
        );
        assert!(destination.starts_with(temporary.path()));
        assert_eq!(
            destination.file_name().and_then(|value| value.to_str()),
            Some("report-12345678.pdf")
        );
    }
}
