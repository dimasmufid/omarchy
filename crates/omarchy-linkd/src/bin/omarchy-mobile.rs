use std::{
    io::{self, Write},
    net::IpAddr,
    path::PathBuf,
    time::Duration,
};

use clap::{Parser, Subcommand};
use omarchy_linkd::{AppPaths, admin::AdminCommand};
use qrcode::{QrCode, render::unicode};
use serde_json::Value;
use tokio::process::Command as TokioCommand;

#[derive(Debug, Parser)]
#[command(
    name = "omarchy-mobile",
    version,
    about = "Manage the local Omarchy Mobile connection"
)]
struct Args {
    #[arg(long, global = true, hide = true)]
    runtime_dir: Option<PathBuf>,
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Display a QR code and approve one nearby phone.
    Pair {
        #[arg(long, default_value_t = 42_783)]
        port: u16,
        #[arg(long)]
        host: Option<IpAddr>,
        #[arg(long)]
        uri_only: bool,
    },
    /// Show daemon and paired-phone status.
    Status {
        #[arg(long)]
        json: bool,
    },
    /// Revoke the paired phone immediately.
    Revoke {
        #[arg(long)]
        yes: bool,
    },
    /// Print or open the inbox directory.
    Inbox {
        #[arg(long)]
        open: bool,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let args = Args::parse();
    let mut paths = AppPaths::discover()?;
    if let Some(runtime_dir) = args.runtime_dir {
        paths.runtime_dir = runtime_dir;
    }
    match args.command {
        Command::Pair {
            port,
            host,
            uri_only,
        } => pair(&paths, port, host, uri_only).await?,
        Command::Status { json } => status(&paths, json).await?,
        Command::Revoke { yes } => revoke(&paths, yes).await?,
        Command::Inbox { open } => inbox(&paths, open).await?,
    }
    Ok(())
}

async fn pair(paths: &AppPaths, port: u16, host: Option<IpAddr>, uri_only: bool) -> io::Result<()> {
    let host = host
        .or_else(|| local_ip_address::local_ip().ok())
        .unwrap_or(IpAddr::V4(std::net::Ipv4Addr::LOCALHOST));
    let data = request(
        paths,
        AdminCommand::OpenPair {
            host: host.to_string(),
            port,
        },
    )
    .await?;
    let uri = data
        .get("uri")
        .and_then(Value::as_str)
        .ok_or_else(|| io::Error::other("daemon returned no pairing URI"))?;
    if uri_only {
        println!("{uri}");
        return Ok(());
    }
    println!("Scan this code from Omarchy Mobile. It expires in five minutes.\n");
    let qr = QrCode::new(uri.as_bytes()).map_err(io::Error::other)?;
    println!(
        "{}",
        qr.render::<unicode::Dense1x2>().quiet_zone(true).build()
    );
    println!("{uri}\n");
    println!("Waiting for a phone…");

    let deadline = tokio::time::Instant::now() + Duration::from_secs(5 * 60);
    let pending = loop {
        if tokio::time::Instant::now() >= deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "pairing window expired",
            ));
        }
        let data = request(paths, AdminCommand::PairPending).await?;
        if let Some(pending) = data.get("request").filter(|value| !value.is_null()) {
            break pending.clone();
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    };
    let name = pending
        .get("deviceName")
        .and_then(Value::as_str)
        .unwrap_or("Unknown phone");
    let platform = pending
        .get("platform")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    println!(
        "\nPair {name} ({platform})? This grants clipboard, inbox, status, and lock access. [y/N]"
    );
    io::stdout().flush()?;
    let accepted = tokio::task::spawn_blocking(|| {
        let mut input = String::new();
        io::stdin()
            .read_line(&mut input)
            .map(|_| matches!(input.trim().to_ascii_lowercase().as_str(), "y" | "yes"))
    })
    .await
    .map_err(io::Error::other)??;
    if accepted {
        request(paths, AdminCommand::PairApprove).await?;
        println!("Approved {name}. Waiting for the phone to finish pairing…");
        let expected_device_id = pending
            .get("deviceId")
            .and_then(Value::as_str)
            .ok_or_else(|| io::Error::other("daemon returned no phone identity"))?;
        let completion_deadline = tokio::time::Instant::now() + Duration::from_secs(30);
        loop {
            let status = request(paths, AdminCommand::Status).await?;
            let completed = status
                .get("pairedDevice")
                .filter(|value| !value.is_null())
                .and_then(|peer| peer.get("deviceId"))
                .and_then(Value::as_str)
                .is_some_and(|device_id| device_id == expected_device_id);
            if completed {
                println!("Paired with {name}.");
                break;
            }
            if tokio::time::Instant::now() >= completion_deadline {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "the phone did not finish pairing; create a new pairing code and retry",
                ));
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    } else {
        request(paths, AdminCommand::PairReject).await?;
        println!("Pairing rejected.");
    }
    Ok(())
}

async fn status(paths: &AppPaths, json: bool) -> io::Result<()> {
    let data = request(paths, AdminCommand::Status).await?;
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&data).map_err(io::Error::other)?
        );
    } else {
        println!("Desktop: {}", string_field(&data, "desktopName"));
        println!("Identity: {}", string_field(&data, "desktopId"));
        match data.get("pairedDevice") {
            Some(peer) if !peer.is_null() => {
                println!("Phone: {}", string_field(peer, "deviceName"))
            }
            _ => println!("Phone: not paired"),
        }
        println!("Inbox: {}", string_field(&data, "inbox"));
    }
    Ok(())
}

async fn revoke(paths: &AppPaths, yes: bool) -> io::Result<()> {
    if !yes {
        print!("Revoke the paired phone? [y/N] ");
        io::stdout().flush()?;
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        if !matches!(input.trim().to_ascii_lowercase().as_str(), "y" | "yes") {
            println!("No changes made.");
            return Ok(());
        }
    }
    let data = request(paths, AdminCommand::Revoke).await?;
    match data.get("revokedDeviceName").and_then(Value::as_str) {
        Some(name) => println!("Revoked {name}."),
        None => println!("No phone was paired."),
    }
    Ok(())
}

async fn inbox(paths: &AppPaths, open: bool) -> io::Result<()> {
    let data = request(paths, AdminCommand::Inbox).await?;
    let inbox = string_field(&data, "path");
    if open {
        TokioCommand::new("xdg-open").arg(inbox).spawn()?;
    } else {
        println!("{inbox}");
    }
    Ok(())
}

async fn request(paths: &AppPaths, command: AdminCommand) -> io::Result<Value> {
    omarchy_linkd::admin::request(&paths.admin_socket(), &command).await
}

fn string_field<'a>(value: &'a Value, key: &str) -> &'a str {
    value.get(key).and_then(Value::as_str).unwrap_or("unknown")
}
