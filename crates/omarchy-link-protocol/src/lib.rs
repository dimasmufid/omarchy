//! Shared wire types and validation for the local Omarchy Mobile protocol.

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const PROTOCOL_VERSION: u8 = 1;
pub const MAX_CLIPBOARD_BYTES: usize = 64 * 1024;
pub const MAX_CONTROL_BYTES: usize = 256 * 1024;
pub const MAX_FILE_BYTES: u64 = 25 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PairRequest {
    pub secret: String,
    pub device_id: String,
    pub device_name: String,
    pub platform: MobilePlatform,
    pub app_version: String,
}

impl PairRequest {
    /// Rejects ambiguous or oversized identity metadata before it reaches UI or storage.
    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_identifier(&self.device_id, 96, "deviceId")?;
        validate_display_name(&self.device_name)?;
        if self.secret.len() > 128 || self.secret.len() < 32 {
            return Err(ValidationError::InvalidField("secret"));
        }
        if self.app_version.is_empty() || self.app_version.len() > 32 {
            return Err(ValidationError::InvalidField("appVersion"));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MobilePlatform {
    Ios,
    Android,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PairApproved {
    pub protocol_version: u8,
    pub desktop_id: String,
    pub desktop_name: String,
    pub client_token: String,
    pub permissions: Vec<Permission>,
    pub limits: Limits,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    Status,
    ClipboardRead,
    ClipboardWrite,
    InboxWrite,
    SystemLock,
}

impl Permission {
    #[must_use]
    pub const fn all_phase_one() -> [Self; 5] {
        [
            Self::Status,
            Self::ClipboardRead,
            Self::ClipboardWrite,
            Self::InboxWrite,
            Self::SystemLock,
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Limits {
    pub clipboard_bytes: usize,
    pub control_bytes: usize,
    pub file_bytes: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            clipboard_bytes: MAX_CLIPBOARD_BYTES,
            control_bytes: MAX_CONTROL_BYTES,
            file_bytes: MAX_FILE_BYTES,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub protocol_version: u8,
    pub desktop_id: String,
    pub desktop_name: String,
    pub paired_device_name: String,
    pub server_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClipboardWriteRequest {
    pub text: String,
}

impl ClipboardWriteRequest {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.text.as_bytes().len() > MAX_CLIPBOARD_BYTES {
            return Err(ValidationError::TooLarge {
                field: "text",
                max_bytes: MAX_CLIPBOARD_BYTES,
            });
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ClipboardReadResponse {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InboxTextRequest {
    pub text: String,
    pub content_type: TextContentType,
}

impl InboxTextRequest {
    pub fn validate(&self) -> Result<(), ValidationError> {
        if self.text.is_empty() {
            return Err(ValidationError::InvalidField("text"));
        }
        if self.text.as_bytes().len() > MAX_CLIPBOARD_BYTES {
            return Err(ValidationError::TooLarge {
                field: "text",
                max_bytes: MAX_CLIPBOARD_BYTES,
            });
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TextContentType {
    Text,
    Url,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OperationResponse {
    pub operation_id: String,
    pub completed: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LockRequest {
    pub idempotency_key: String,
}

impl LockRequest {
    pub fn validate(&self) -> Result<(), ValidationError> {
        validate_identifier(&self.idempotency_key, 96, "idempotencyKey")
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiError {
    pub error: ApiErrorBody,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ApiErrorBody {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl ApiError {
    #[must_use]
    pub fn new(code: impl Into<String>, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            error: ApiErrorBody {
                code: code.into(),
                message: message.into(),
                retryable,
            },
        }
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ValidationError {
    #[error("invalid field: {0}")]
    InvalidField(&'static str),
    #[error("{field} exceeds the {max_bytes}-byte limit")]
    TooLarge {
        field: &'static str,
        max_bytes: usize,
    },
}

fn validate_identifier(
    value: &str,
    max_len: usize,
    field: &'static str,
) -> Result<(), ValidationError> {
    if value.is_empty()
        || value.len() > max_len
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(ValidationError::InvalidField(field));
    }
    Ok(())
}

fn validate_display_name(value: &str) -> Result<(), ValidationError> {
    let value = value.trim();
    if value.is_empty() || value.as_bytes().len() > 63 || value.chars().any(char::is_control) {
        return Err(ValidationError::InvalidField("deviceName"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clipboard_limit_is_measured_as_utf8_bytes() {
        let request = ClipboardWriteRequest {
            text: "🦊".repeat(MAX_CLIPBOARD_BYTES / 4 + 1),
        };
        assert!(matches!(
            request.validate(),
            Err(ValidationError::TooLarge { field: "text", .. })
        ));
    }

    #[test]
    fn device_identity_rejects_path_like_values() {
        let request = PairRequest {
            secret: "a".repeat(43),
            device_id: "../../phone".into(),
            device_name: "Phone".into(),
            platform: MobilePlatform::Android,
            app_version: "0.1.0".into(),
        };
        assert_eq!(
            request.validate(),
            Err(ValidationError::InvalidField("deviceId"))
        );
    }
}
