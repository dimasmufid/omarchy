use std::{net::IpAddr, path::PathBuf};

use clap::Parser;
use omarchy_linkd::{AppPaths, RunConfig};
use tracing_subscriber::EnvFilter;

#[derive(Debug, Parser)]
#[command(
    name = "omarchy-linkd",
    version,
    about = "Local Omarchy Mobile companion daemon"
)]
struct Args {
    #[arg(long, default_value = "0.0.0.0")]
    bind: IpAddr,
    #[arg(long, default_value_t = 42_783)]
    port: u16,
    #[arg(long)]
    advertise: Option<IpAddr>,
    #[arg(long, hide = true)]
    state_dir: Option<PathBuf>,
    #[arg(long, hide = true)]
    runtime_dir: Option<PathBuf>,
    #[arg(long, hide = true)]
    inbox_dir: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .without_time()
        .init();
    let args = Args::parse();
    let mut paths = AppPaths::discover()?;
    if let Some(path) = args.state_dir {
        paths.state_dir = path;
    }
    if let Some(path) = args.runtime_dir {
        paths.runtime_dir = path;
    }
    if let Some(path) = args.inbox_dir {
        paths.inbox_dir = path;
    }
    let advertised_ip = args.advertise.unwrap_or_else(|| {
        local_ip_address::local_ip().unwrap_or(IpAddr::V4(std::net::Ipv4Addr::LOCALHOST))
    });
    omarchy_linkd::run(RunConfig {
        bind_ip: args.bind,
        advertised_ip,
        port: args.port,
        paths,
    })
    .await
}
