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
        let project = ProjectDirs::from("org", "omarchy", "mobile")
            .ok_or_else(|| io::Error::other("cannot resolve the user data directory"))?;
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

#[cfg(not(unix))]
pub fn set_private_file(_path: &std::path::Path) -> io::Result<()> {
    Ok(())
}
