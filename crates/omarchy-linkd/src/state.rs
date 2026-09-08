use std::{
    collections::VecDeque,
    fs::{self, OpenOptions},
    io::{self, Write},
    path::Path,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use omarchy_link_protocol::{PROTOCOL_VERSION, PairApproved, PairRequest, Permission};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tokio::sync::{Mutex, Notify, RwLock};
use uuid::Uuid;

use crate::config::{AppPaths, set_private_file};

const PAIRING_WINDOW_SECONDS: u64 = 5 * 60;
const MAX_IDEMPOTENCY_KEYS: usize = 128;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerRecord {
    pub device_id: String,
    pub device_name: String,
    pub token_hash: String,
    pub paired_at: String,
    pub permissions: Vec<Permission>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PersistedState {
    pub desktop_id: String,
    pub desktop_name: String,
    pub peer: Option<PeerRecord>,
    #[serde(default)]
    pub recent_lock_keys: VecDeque<String>,
}

impl PersistedState {
    fn fresh() -> Self {
        Self {
            desktop_id: format!("desk_{}", Uuid::new_v4().simple()),
            desktop_name: default_desktop_name(),
            peer: None,
            recent_lock_keys: VecDeque::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub enum PairDecision {
    Approved(PairApproved),
    Rejected,
}

#[derive(Debug)]
pub struct PairWindow {
    pub secret: String,
    pub expires_at: u64,
    pub failed_attempts: u8,
    pub request: Option<PairRequest>,
    pub decision: Option<PairDecision>,
    pub notify: Arc<Notify>,
}

impl PairWindow {
    #[must_use]
    pub fn is_expired(&self) -> bool {
        now_unix() >= self.expires_at
    }
}

#[derive(Debug)]
pub struct AppState {
    pub persisted: RwLock<PersistedState>,
    pub pairing: Mutex<Option<PairWindow>>,
    pub paths: AppPaths,
    pub fingerprint: String,
}

impl AppState {
    pub fn load(paths: AppPaths, fingerprint: String) -> io::Result<Arc<Self>> {
        paths.prepare()?;
        let state_file = paths.state_file();
        let persisted = match fs::read(&state_file) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(io::Error::other)?,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                let fresh = PersistedState::fresh();
                save_snapshot(&state_file, &fresh)?;
                fresh
            }
            Err(error) => return Err(error),
        };
        let state = Arc::new(Self {
            persisted: RwLock::new(persisted),
            pairing: Mutex::new(None),
            paths,
            fingerprint,
        });
        Ok(state)
    }

    pub async fn save(&self) -> io::Result<()> {
        let persisted = self.persisted.read().await;
        save_snapshot(&self.paths.state_file(), &persisted)
    }

    pub async fn open_pairing_window(
        &self,
        host: &str,
        port: u16,
    ) -> io::Result<PairingWindowInfo> {
        let mut secret = [0_u8; 32];
        rand::rng().fill_bytes(&mut secret);
        let secret = URL_SAFE_NO_PAD.encode(secret);
        let expires_at = now_unix() + PAIRING_WINDOW_SECONDS;
        let notify = Arc::new(Notify::new());
        *self.pairing.lock().await = Some(PairWindow {
            secret: secret.clone(),
            expires_at,
            failed_attempts: 0,
            request: None,
            decision: None,
            notify,
        });
        let persisted = self.persisted.read().await;
        let uri = url::Url::parse_with_params(
            "omarchy://pair",
            &[
                ("v", PROTOCOL_VERSION.to_string()),
                ("desktop", persisted.desktop_id.clone()),
                ("secret", secret),
                ("fp", self.fingerprint.clone()),
                ("host", host.to_owned()),
                ("port", port.to_string()),
                ("name", persisted.desktop_name.clone()),
            ],
        )
        .map_err(io::Error::other)?;
        Ok(PairingWindowInfo {
            uri: uri.to_string(),
            expires_at,
        })
    }

    pub async fn authorize_bearer(&self, bearer: &str, permission: Permission) -> bool {
        let token_hash = hash_token(bearer);
        self.persisted
            .read()
            .await
            .peer
            .as_ref()
            .is_some_and(|peer| {
                constant_time_string_eq(&peer.token_hash, &token_hash)
                    && peer.permissions.contains(&permission)
            })
    }

    pub async fn approve_pending(&self) -> Result<String, ApprovalError> {
        let mut pairing = self.pairing.lock().await;
        let window = pairing.as_mut().ok_or(ApprovalError::NoWindow)?;
        if window.is_expired() {
            return Err(ApprovalError::Expired);
        }
        let request = window.request.clone().ok_or(ApprovalError::NoRequest)?;

        let mut raw_token = [0_u8; 32];
        rand::rng().fill_bytes(&mut raw_token);
        let raw_token = URL_SAFE_NO_PAD.encode(raw_token);
        let permissions = Permission::all_phase_one().to_vec();
        let mut persisted = self.persisted.write().await;
        persisted.peer = Some(PeerRecord {
            device_id: request.device_id,
            device_name: request.device_name.clone(),
            token_hash: hash_token(&raw_token),
            paired_at: chrono::Utc::now().to_rfc3339(),
            permissions: permissions.clone(),
        });
        let approved = PairApproved {
            protocol_version: PROTOCOL_VERSION,
            desktop_id: persisted.desktop_id.clone(),
            desktop_name: persisted.desktop_name.clone(),
            client_token: raw_token,
            permissions,
            limits: omarchy_link_protocol::Limits::default(),
        };
        save_snapshot(&self.paths.state_file(), &persisted).map_err(ApprovalError::Persist)?;
        window.decision = Some(PairDecision::Approved(approved));
        window.notify.notify_waiters();
        Ok(request.device_name)
    }

    pub async fn reject_pending(&self) -> Result<(), ApprovalError> {
        let mut pairing = self.pairing.lock().await;
        let window = pairing.as_mut().ok_or(ApprovalError::NoWindow)?;
        if window.request.is_none() {
            return Err(ApprovalError::NoRequest);
        }
        window.decision = Some(PairDecision::Rejected);
        window.notify.notify_waiters();
        Ok(())
    }

    pub async fn revoke(&self) -> io::Result<Option<String>> {
        let mut persisted = self.persisted.write().await;
        let name = persisted.peer.take().map(|peer| peer.device_name);
        persisted.recent_lock_keys.clear();
        save_snapshot(&self.paths.state_file(), &persisted)?;
        Ok(name)
    }

    /// Returns false for a duplicate, otherwise persists the key before execution.
    pub async fn register_lock_key(&self, key: &str) -> io::Result<bool> {
        let mut persisted = self.persisted.write().await;
        if persisted
            .recent_lock_keys
            .iter()
            .any(|existing| existing == key)
        {
            return Ok(false);
        }
        persisted.recent_lock_keys.push_back(key.to_owned());
        while persisted.recent_lock_keys.len() > MAX_IDEMPOTENCY_KEYS {
            persisted.recent_lock_keys.pop_front();
        }
        save_snapshot(&self.paths.state_file(), &persisted)?;
        Ok(true)
    }

    pub async fn remove_lock_key(&self, key: &str) -> io::Result<()> {
        let mut persisted = self.persisted.write().await;
        persisted
            .recent_lock_keys
            .retain(|existing| existing != key);
        save_snapshot(&self.paths.state_file(), &persisted)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingWindowInfo {
    pub uri: String,
    pub expires_at: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum ApprovalError {
    #[error("no pairing window is open")]
    NoWindow,
    #[error("the pairing window expired")]
    Expired,
    #[error("no phone is waiting for approval")]
    NoRequest,
    #[error("could not persist approval: {0}")]
    Persist(#[source] io::Error),
}

#[must_use]
pub fn hash_token(token: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(token.as_bytes()))
}

#[must_use]
pub fn constant_time_string_eq(left: &str, right: &str) -> bool {
    use subtle::ConstantTimeEq;
    bool::from(left.as_bytes().ct_eq(right.as_bytes()))
}

#[must_use]
pub fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

fn default_desktop_name() -> String {
    fs::read_to_string("/etc/hostname")
        .ok()
        .map(|name| name.trim().to_owned())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Omarchy Desktop".to_owned())
}

fn save_snapshot(path: &Path, state: &PersistedState) -> io::Result<()> {
    let bytes = serde_json::to_vec_pretty(state).map_err(io::Error::other)?;
    let temporary = path.with_extension("json.new");
    let mut options = OpenOptions::new();
    options.create(true).truncate(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    set_private_file(&temporary)?;
    fs::rename(temporary, path)?;
    set_private_file(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_comparison_is_exact() {
        assert!(constant_time_string_eq("abc", "abc"));
        assert!(!constant_time_string_eq("abc", "abd"));
        assert!(!constant_time_string_eq("abc", "ab"));
    }

    #[test]
    fn new_state_does_not_contain_a_peer() {
        let state = PersistedState::fresh();
        assert!(state.desktop_id.starts_with("desk_"));
        assert!(state.peer.is_none());
    }

    #[tokio::test]
    async fn failed_lock_key_can_be_retried_after_reconciliation() {
        let temporary = tempfile::tempdir().expect("temp dir");
        let state =
            AppState::load(AppPaths::under(temporary.path()), "fingerprint".into()).expect("state");

        assert!(
            state
                .register_lock_key("lock_test")
                .await
                .expect("register")
        );
        assert!(
            !state
                .register_lock_key("lock_test")
                .await
                .expect("duplicate")
        );
        state.remove_lock_key("lock_test").await.expect("remove");
        assert!(state.register_lock_key("lock_test").await.expect("retry"));
    }
}
