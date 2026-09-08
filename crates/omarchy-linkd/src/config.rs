use std::{fs, io, path::PathBuf};

use directories::{ProjectDirs, UserDirs};

#[derive(Debug, Clone)]
pub struct AppPaths {
    pub state_dir: PathBuf,
    pub runtime_dir: PathBuf,
    pub inbox_dir: PathBuf,
}

impl AppPaths {
    pub fn discover() -> io::Result<Self> {
        let project = ProjectDirs::from("org", "omarchy", "omarchy-mobile")
            .ok_or_else(|| io::Error::other("cannot resolve the user data directory"))?;
        if let Some(legacy) = ProjectDirs::from("org", "omarchy", "mobile") {
            let legacy_state = legacy.state_dir().unwrap_or(legacy.data_dir());
            let current_state = project.state_dir().unwrap_or(project.data_dir());
            migrate_legacy_state(legacy_state, current_state)?;
        }
        let runtime_dir = std::env::var_os("XDG_RUNTIME_DIR")
            .map_or_else(|| project.cache_dir().to_path_buf(), PathBuf::from);
        let inbox_dir = UserDirs::new()
            .and_then(|dirs| dirs.download_dir().map(PathBuf::from))
            .unwrap_or_else(|| project.data_dir().to_path_buf())
            .join("Omarchy Inbox");
        Ok(Self {
            state_dir: project
                .state_dir()
                .unwrap_or(project.data_dir())
                .to_path_buf(),
            runtime_dir,
            inbox_dir,
        })
    }

    #[cfg(test)]
    pub fn under(root: &std::path::Path) -> Self {
        Self {
            state_dir: root.join("state"),
            runtime_dir: root.join("run"),
            inbox_dir: root.join("inbox"),
        }
    }

    pub fn prepare(&self) -> io::Result<()> {
        for directory in [&self.state_dir, &self.runtime_dir, &self.inbox_dir] {
            fs::create_dir_all(directory)?;
            set_private_directory(directory)?;
        }
        Ok(())
    }

    #[must_use]
    pub fn state_file(&self) -> PathBuf {
        self.state_dir.join("state.json")
    }

    #[must_use]
    pub fn certificate_file(&self) -> PathBuf {
        self.state_dir.join("identity-cert.pem")
    }

    #[must_use]
    pub fn private_key_file(&self) -> PathBuf {
        self.state_dir.join("identity-key.pem")
    }

    #[must_use]
    pub fn admin_socket(&self) -> PathBuf {
        self.runtime_dir.join("omarchy-linkd.sock")
    }
}

fn migrate_legacy_state(legacy: &std::path::Path, current: &std::path::Path) -> io::Result<()> {
    if current.exists()
        || !legacy.join("state.json").is_file()
        || !legacy.join("identity-cert.pem").is_file()
        || !legacy.join("identity-key.pem").is_file()
    {
        return Ok(());
    }
    let state = fs::read(legacy.join("state.json"))?;
    let recognized = serde_json::from_slice::<serde_json::Value>(&state)
        .ok()
        .and_then(|value| value.get("desktopId")?.as_str().map(str::to_owned))
        .is_some_and(|desktop_id| desktop_id.starts_with("desk_"));
    if !recognized {
        return Ok(());
    }
    if let Some(parent) = current.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(legacy, current)
}

#[cfg(unix)]
pub fn set_private_directory(path: &std::path::Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
}

#[cfg(not(unix))]
pub fn set_private_directory(_path: &std::path::Path) -> io::Result<()> {
    Ok(())
}

#[cfg(unix)]
pub fn set_private_file(path: &std::path::Path) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_only_a_recognized_legacy_identity() {
        let temporary = tempfile::tempdir().expect("temp dir");
        let legacy = temporary.path().join("mobile");
        let current = temporary.path().join("omarchy-mobile");
        fs::create_dir_all(&legacy).expect("legacy dir");
        fs::write(legacy.join("state.json"), r#"{"desktopId":"desk_test"}"#).expect("state");
        fs::write(legacy.join("identity-cert.pem"), "cert").expect("cert");
        fs::write(legacy.join("identity-key.pem"), "key").expect("key");

        migrate_legacy_state(&legacy, &current).expect("migration");

        assert!(!legacy.exists());
        assert!(current.join("state.json").is_file());
        assert!(current.join("identity-cert.pem").is_file());
        assert!(current.join("identity-key.pem").is_file());
    }

    #[test]
    fn leaves_an_unrecognized_legacy_directory_untouched() {
        let temporary = tempfile::tempdir().expect("temp dir");
        let legacy = temporary.path().join("mobile");
        let current = temporary.path().join("omarchy-mobile");
        fs::create_dir_all(&legacy).expect("legacy dir");
        fs::write(legacy.join("state.json"), r#"{"application":"other"}"#).expect("state");
        fs::write(legacy.join("identity-cert.pem"), "cert").expect("cert");
        fs::write(legacy.join("identity-key.pem"), "key").expect("key");

        migrate_legacy_state(&legacy, &current).expect("migration");

        assert!(legacy.exists());
        assert!(!current.exists());
    }
}

#[cfg(not(unix))]
pub fn set_private_file(_path: &std::path::Path) -> io::Result<()> {
    Ok(())
}
