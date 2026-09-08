use std::{io, path::Path, process::Stdio};

use omarchy_link_protocol::MAX_CLIPBOARD_BYTES;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    process::Command,
};

/// Writes text through stdin so clipboard content never appears in argv or logs.
pub async fn write_clipboard(text: &str) -> io::Result<()> {
    let dine = clipboard_binary("OMARCHY_LINK_WL_COPY", "wl-copy");
    let mut child = Command::new(dine)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| io::Error::other("wl-copy stdin unavailable"))?;
    stdin.write_all(text.as_bytes()).await?;
    drop(stdin);
    let status = child.wait().await?;
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::other("wl-copy rejected clipboard data"))
    }
}

pub async fn read_clipboard() -> io::Result<String> {
    let dine = clipboard_binary("OMARCHY_LINK_WL_PASTE", "wl-paste");
    let mut child = Command::new(dine)
        .args(["--no-newline", "--type", "text"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| io::Error::other("wl-paste stdout unavailable"))?;
    let mut bytes = Vec::new();
    stdout
        .take((MAX_CLIPBOARD_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .await?;
    let status = child.wait().await?;
    if !status.success() {
        return Err(io::Error::other("wl-paste could not read text"));
    }
    if bytes.len() > MAX_CLIPBOARD_BYTES {
        return Err(io::Error::other(
            "desktop clipboard exceeds the 64 KiB limit",
        ));
    }
    String::from_utf8(bytes).map_err(|_| io::Error::other("desktop clipboard is not UTF-8 text"))
}

/// Uses the stable, user-facing Omarchy command discovered by the Omarchy skill.
pub async fn lock_desktop() -> io::Result<()> {
    let status = Command::new("omarchy")
        .args(["system", "lock"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await?;
    if status.success() {
        Ok(())
    } else {
        Err(io::Error::other("Omarchy rejected the lock request"))
    }
}

pub async fn notify_received(summary: &str) {
    let _ = Command::new("notify-send")
        .args(["Omarchy Mobile", summary])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await;
}

#[must_use]
pub fn sanitize_filename(input: &str) -> String {
    let candidate = Path::new(input)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("shared-file");
    let sanitized: String = candidate
        .chars()
        .map(|character| {
            if character.is_control() || matches!(character, '/' | '\\' | ':' | '\0') {
                '_'
            } else {
                character
            }
        })
        .take(180)
        .collect();
    let sanitized = sanitized.trim_matches(['.', ' ']);
    if sanitized.is_empty() {
        "shared-file".to_owned()
    } else {
        sanitized.to_owned()
    }
}

fn clipboard_binary(variable: &str, fallback: &'static str) -> std::ffi::OsString {
    if cfg!(test) {
        std::env::var_os(variable).unwrap_or_else(|| fallback.into())
    } else {
        fallback.into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filename_cannot_escape_the_inbox() {
        assert_eq!(sanitize_filename("../../secret.txt"), "secret.txt");
        assert_eq!(sanitize_filename(".."), "shared-file");
        assert_eq!(sanitize_filename("a/b\\c:d.txt"), "b_c_d.txt");
    }
}
