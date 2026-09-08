use std::{io, path::Path, sync::Arc};

use serde::{Deserialize, Serialize};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::{UnixListener, UnixStream},
};

use crate::{config::set_private_file, state::AppState};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case")]
pub enum AdminCommand {
    OpenPair { host: String, port: u16 },
    PairPending,
    PairApprove,
    PairReject,
    Status,
    Revoke,
    Inbox,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum AdminResponse {
    Ok { data: serde_json::Value },
    Error { message: String },
}

pub async fn serve(state: Arc<AppState>) -> io::Result<()> {
    let socket_path = state.paths.admin_socket();
    if socket_path.exists() {
        match UnixStream::connect(&socket_path).await {
            Ok(_) => {
                return Err(io::Error::new(
                    io::ErrorKind::AddrInUse,
                    "daemon is already running",
                ));
            }
            Err(_) => std::fs::remove_file(&socket_path)?,
        }
    }
    let listener = UnixListener::bind(&socket_path)?;
    set_private_file(&socket_path)?;
    loop {
        let (stream, _) = listener.accept().await?;
        let state = Arc::clone(&state);
        tokio::spawn(async move {
            if let Err(error) = handle_stream(stream, state).await {
                tracing::warn!(error = %error, "admin request failed");
            }
        });
    }
}

async fn handle_stream(stream: UnixStream, state: Arc<AppState>) -> io::Result<()> {
    let (reader, mut writer) = stream.into_split();
    let mut request = String::new();
    BufReader::new(reader).read_line(&mut request).await?;
    if request.len() > 16 * 1024 {
        return Err(io::Error::other("admin request too large"));
    }
    let response = match serde_json::from_str::<AdminCommand>(&request) {
        Ok(command) => execute(command, &state).await,
        Err(_) => AdminResponse::Error {
            message: "invalid admin request".into(),
        },
    };
    let mut response = serde_json::to_vec(&response).map_err(io::Error::other)?;
    response.push(b'\n');
    writer.write_all(&response).await
}

async fn execute(command: AdminCommand, state: &AppState) -> AdminResponse {
    match command {
        AdminCommand::OpenPair { host, port } => match state.open_pairing_window(&host, port).await
        {
            Ok(window) => ok_json(window),
            Err(error) => error_response(error),
        },
        AdminCommand::PairPending => {
            let pairing = state.pairing.lock().await;
            let data = pairing.as_ref().and_then(|window| {
                window.request.as_ref().map(|request| {
                    serde_json::json!({
                        "deviceId": request.device_id,
                        "deviceName": request.device_name,
                        "platform": request.platform,
                        "appVersion": request.app_version,
                        "expiresAt": window.expires_at,
                    })
                })
            });
            ok_json(serde_json::json!({ "request": data }))
        }
        AdminCommand::PairApprove => match state.approve_pending().await {
            Ok(name) => ok_json(serde_json::json!({ "deviceName": name })),
            Err(error) => AdminResponse::Error {
                message: error.to_string(),
            },
        },
        AdminCommand::PairReject => match state.reject_pending().await {
            Ok(()) => ok_json(serde_json::json!({})),
            Err(error) => AdminResponse::Error {
                message: error.to_string(),
            },
        },
        AdminCommand::Status => {
            let persisted = state.persisted.read().await;
            ok_json(serde_json::json!({
                "desktopId": persisted.desktop_id,
                "desktopName": persisted.desktop_name,
                "pairedDevice": persisted.peer.as_ref().map(|peer| serde_json::json!({
                    "deviceId": peer.device_id,
                    "deviceName": peer.device_name,
                    "pairedAt": peer.paired_at,
                    "permissions": peer.permissions,
                })),
                "inbox": state.paths.inbox_dir,
                "fingerprint": state.fingerprint,
            }))
        }
        AdminCommand::Revoke => match state.revoke().await {
            Ok(name) => ok_json(serde_json::json!({ "revokedDeviceName": name })),
            Err(error) => error_response(error),
        },
        AdminCommand::Inbox => ok_json(serde_json::json!({ "path": state.paths.inbox_dir })),
    }
}

fn ok_json(value: impl Serialize) -> AdminResponse {
    match serde_json::to_value(value) {
        Ok(data) => AdminResponse::Ok { data },
        Err(error) => AdminResponse::Error {
            message: error.to_string(),
        },
    }
}

fn error_response(error: impl std::fmt::Display) -> AdminResponse {
    AdminResponse::Error {
        message: error.to_string(),
    }
}

pub async fn request(socket_path: &Path, command: &AdminCommand) -> io::Result<serde_json::Value> {
    let mut stream = UnixStream::connect(socket_path).await.map_err(|error| {
        io::Error::new(
            error.kind(),
            format!("cannot contact omarchy-linkd; is the user service running? ({error})"),
        )
    })?;
    let mut bytes = serde_json::to_vec(command).map_err(io::Error::other)?;
    bytes.push(b'\n');
    stream.write_all(&bytes).await?;
    let mut response = String::new();
    BufReader::new(stream).read_line(&mut response).await?;
    match serde_json::from_str::<AdminResponse>(&response).map_err(io::Error::other)? {
        AdminResponse::Ok { data } => Ok(data),
        AdminResponse::Error { message } => Err(io::Error::other(message)),
    }
}
