use std::net::{IpAddr, SocketAddr};
use std::sync::{
    atomic::{AtomicBool, AtomicU32, Ordering},
    Arc, Mutex,
};
use std::time::{SystemTime, UNIX_EPOCH};

use irium_node_rs::block::BlockHeader;
use irium_node_rs::pow::{meets_target, Target};
use irium_node_rs::protocol::{
    GetHeadersPayload, HandshakePayload, Message, MessageType, PeersPayload, PingPayload,
};
use irium_node_rs::sybil::{SybilChallenge, SybilProof};
use rand_core::{OsRng, RngCore};
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::{broadcast, watch};

const IRIUM_P2P_PORT: u16 = 38291;
const WIRE_PROTOCOL_VERSION: u8 = 1;

// ─── Config ──────────────────────────────────────────────────────────────────

pub struct LightClientConfig {
    pub seedlist_path: String,
    pub extra_peer: Option<String>,
    pub start_height: u64,
    pub start_hash: Option<String>,
}

// ─── Shared state ────────────────────────────────────────────────────────────

struct ChainTip {
    height: u64,
    hash: [u8; 32], // display byte order (same as BlockHeader::hash() returns)
}

struct LightClient {
    tip: Mutex<ChainTip>,
    peer_count: AtomicU32,
    is_syncing: AtomicBool,
    tx_broadcast: broadcast::Sender<Vec<u8>>, // wire-framed Tx messages
    node_id: Vec<u8>,                          // 32-byte random session identity
}

struct LightClientHandle {
    rt: tokio::runtime::Runtime,
    inner: Arc<LightClient>,
    shutdown_tx: watch::Sender<bool>,
}

static HANDLE: Mutex<Option<LightClientHandle>> = Mutex::new(None);

// ─── Public API ──────────────────────────────────────────────────────────────

pub fn start_light_client(config: LightClientConfig) -> Result<(), String> {
    let mut guard = HANDLE.lock().map_err(|_| "state lock poisoned")?;
    if guard.is_some() {
        return Err("light client already running".to_string());
    }

    let start_hash = match &config.start_hash {
        Some(h) => {
            let b = hex::decode(h).map_err(|_| "invalid start_hash hex")?;
            if b.len() != 32 {
                return Err("start_hash must be 32 bytes".to_string());
            }
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&b);
            arr
        }
        None => [0u8; 32],
    };

    let seeds = load_seeds(&config.seedlist_path, config.extra_peer.as_deref())?;
    if seeds.is_empty() {
        return Err("no peers found in seedlist".to_string());
    }

    let mut node_id = vec![0u8; 32];
    OsRng.fill_bytes(&mut node_id);

    let (tx_broadcast, _) = broadcast::channel::<Vec<u8>>(64);
    let (shutdown_tx, shutdown_rx) = watch::channel(false);

    let lc = Arc::new(LightClient {
        tip: Mutex::new(ChainTip {
            height: config.start_height,
            hash: start_hash,
        }),
        peer_count: AtomicU32::new(0),
        is_syncing: AtomicBool::new(true),
        tx_broadcast,
        node_id,
    });

    let runtime_path = derive_runtime_path(&config.seedlist_path);
    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
    for addr in seeds {
        let lc_clone = Arc::clone(&lc);
        let rx = shutdown_rx.clone();
        let rp = runtime_path.clone();
        rt.spawn(async move {
            peer_loop(addr, lc_clone, rp, rx).await;
        });
    }

    *guard = Some(LightClientHandle { rt, inner: lc, shutdown_tx });
    Ok(())
}

pub fn stop_light_client() {
    if let Ok(mut guard) = HANDLE.lock() {
        if let Some(handle) = guard.take() {
            let _ = handle.shutdown_tx.send(true);
            // Dropping the runtime blocks until tasks finish or are cancelled.
            drop(handle.rt);
        }
    }
}

pub fn is_syncing() -> bool {
    HANDLE
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|h| h.inner.is_syncing.load(Ordering::Relaxed)))
        .unwrap_or(false)
}

pub fn peer_count() -> u32 {
    HANDLE
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|h| h.inner.peer_count.load(Ordering::Relaxed)))
        .unwrap_or(0)
}

pub fn get_synced_height() -> u64 {
    HANDLE
        .lock()
        .ok()
        .and_then(|g| {
            g.as_ref().and_then(|h| {
                h.inner.tip.lock().ok().map(|t| t.height)
            })
        })
        .unwrap_or(0)
}

pub fn get_tip_hash() -> String {
    HANDLE
        .lock()
        .ok()
        .and_then(|g| {
            g.as_ref().and_then(|h| {
                h.inner.tip.lock().ok().map(|t| hex::encode(t.hash))
            })
        })
        .unwrap_or_default()
}

/// Sends a signed transaction to all connected peers. Returns the txid hex.
pub fn broadcast_tx(tx_hex: &str) -> Result<String, String> {
    let tx_bytes = hex::decode(tx_hex).map_err(|_| "invalid tx hex")?;

    // txid = SHA256d(tx_bytes) reversed
    let h1 = Sha256::digest(&tx_bytes);
    let h2 = Sha256::digest(&h1);
    let mut txid = h2.to_vec();
    txid.reverse();
    let txid_hex = hex::encode(&txid);

    let wire = Message {
        msg_type: MessageType::Tx,
        payload: tx_bytes,
    }
    .serialize();

    let guard = HANDLE.lock().map_err(|_| "state lock poisoned")?;
    let handle = guard.as_ref().ok_or("light client not running")?;
    // Ignore send error (no subscribers means no connected peers).
    let _ = handle.inner.tx_broadcast.send(wire);

    Ok(txid_hex)
}

// ─── Seedlist ─────────────────────────────────────────────────────────────────

/// Mirrors normalize_seed() from irium-source/src/network.rs exactly.
/// Returns the IP address string only; port is always IRIUM_P2P_PORT at dial time.
fn normalize_seed(addr: &str) -> Option<String> {
    let candidate = addr.trim();
    if candidate.is_empty() { return None; }
    if candidate.starts_with("/ip4/") {
        let parts: Vec<&str> = candidate.split('/').collect();
        if parts.len() >= 3 { return Some(parts[2].to_string()); }
        return None;
    }
    if let Ok(ip) = candidate.parse::<IpAddr>() { return Some(ip.to_string()); }
    if let Ok(sock) = candidate.parse::<SocketAddr>() { return Some(sock.ip().to_string()); }
    None
}

/// Mirrors load_seed_entries() from irium-source/src/network.rs.
fn load_seed_entries(path: &str) -> Vec<String> {
    let mut entries = Vec::new();
    let text = match std::fs::read_to_string(path) {
        Ok(t) => t,
        Err(_) => return entries,
    };
    for line in text.lines() {
        if let Some(ip) = normalize_seed(line) {
            if !entries.contains(&ip) {
                entries.push(ip);
            }
        }
    }
    entries
}

/// Mirrors write_runtime_entries() from irium-source/src/network.rs.
/// Saves gossip-discovered peer IPs to the runtime seedlist file.
fn write_runtime_entries(runtime_path: &str, entries: &[String]) {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let mut body = format!("# Runtime seedlist refreshed {}\n", secs);
    for ip in entries {
        body.push_str(ip);
        body.push('\n');
    }
    let _ = std::fs::write(runtime_path, body);
}

/// Derives the runtime seedlist path from the baseline path:
/// same directory, filename "seedlist.runtime".
fn derive_runtime_path(seedlist_path: &str) -> String {
    let p = std::path::Path::new(seedlist_path);
    let parent = p.parent().unwrap_or(std::path::Path::new("."));
    parent.join("seedlist.runtime").to_string_lossy().into_owned()
}

/// Loads and merges baseline + optional extra peer + runtime seedlist.
/// Returns dial addresses in "ip:port" form with port always IRIUM_P2P_PORT.
fn load_seeds(seedlist_path: &str, extra: Option<&str>) -> Result<Vec<String>, String> {
    let runtime_path = derive_runtime_path(seedlist_path);
    let mut ips: Vec<String> = Vec::new();

    for ip in load_seed_entries(seedlist_path) {
        if !ips.contains(&ip) { ips.push(ip); }
    }
    if let Some(peer) = extra {
        if let Some(ip) = normalize_seed(peer.trim()) {
            if !ips.contains(&ip) { ips.push(ip); }
        }
    }
    for ip in load_seed_entries(&runtime_path) {
        if !ips.contains(&ip) { ips.push(ip); }
    }

    if ips.is_empty() {
        return Err("no peers found in seedlist".to_string());
    }
    Ok(ips.into_iter().map(|ip| format!("{ip}:{IRIUM_P2P_PORT}")).collect())
}

// ─── Peer loop ────────────────────────────────────────────────────────────────

async fn peer_loop(addr: String, lc: Arc<LightClient>, runtime_path: String, mut shutdown: watch::Receiver<bool>) {
    loop {
        if *shutdown.borrow() {
            return;
        }
        match TcpStream::connect(&addr).await {
            Ok(mut stream) => {
                lc.peer_count.fetch_add(1, Ordering::Relaxed);
                let _ = peer_session(&mut stream, Arc::clone(&lc), &runtime_path, &mut shutdown).await;
                lc.peer_count.fetch_sub(1, Ordering::Relaxed);
            }
            Err(_) => {}
        }
        tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
    }
}

async fn peer_session(
    stream: &mut TcpStream,
    lc: Arc<LightClient>,
    runtime_path: &str,
    shutdown: &mut watch::Receiver<bool>,
) -> Result<(), String> {
    // 1. Receive SybilChallenge from peer
    let msg = recv_msg(stream).await?;
    if msg.msg_type != MessageType::SybilChallenge {
        return Err("expected SybilChallenge as first message".to_string());
    }
    let challenge = SybilChallenge::from_bytes(&msg.payload)
        .ok_or("malformed SybilChallenge payload")?;

    // 2. Solve PoW and send proof
    let proof = SybilProof::solve(challenge, lc.node_id.clone())?;
    send_msg(stream, &Message { msg_type: MessageType::SybilProof, payload: proof.to_bytes() }).await?;

    // 3. Send our Handshake
    let (our_height, our_tip_hex) = {
        let t = lc.tip.lock().map_err(|_| "tip lock poisoned")?;
        (t.height, hex::encode(t.hash))
    };
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let hs = HandshakePayload {
        version: 1,
        agent: "irium-mobile/0.1".to_string(),
        height: our_height,
        timestamp: ts,
        port: 0,
        checkpoint_height: None,
        checkpoint_hash: None,
        relay_address: None,
        node_id: Some(hex::encode(&lc.node_id)),
        tip_hash: Some(our_tip_hex),
        capabilities: None,
        marketplace_feed: None,
        external_endpoint: None,
    };
    send_msg(stream, &hs.to_message()?).await?;

    // 4. Receive peer's Handshake
    let peer_hs_msg = recv_msg(stream).await?;
    if peer_hs_msg.msg_type != MessageType::Handshake {
        return Err("expected Handshake from peer".to_string());
    }
    let peer_hs = HandshakePayload::from_message(&peer_hs_msg)?;
    let peer_height = peer_hs.height;

    // 5. Request peer list
    send_msg(stream, &Message { msg_type: MessageType::GetPeers, payload: Vec::new() }).await?;

    // 6. Header sync if peer is ahead
    let our_h = lc.tip.lock().map_err(|_| "tip lock poisoned")?.height;
    if peer_height > our_h {
        lc.is_syncing.store(true, Ordering::Relaxed);
        sync_headers(stream, Arc::clone(&lc), peer_height).await?;
        lc.is_syncing.store(false, Ordering::Relaxed);
    }

    // 7. Keepalive + tx relay loop
    let mut tx_rx = lc.tx_broadcast.subscribe();
    let mut ping_timer = tokio::time::interval(tokio::time::Duration::from_secs(30));

    loop {
        tokio::select! {
            _ = shutdown.changed() => {
                if *shutdown.borrow() { return Ok(()); }
            }
            _ = ping_timer.tick() => {
                send_msg(stream, &PingPayload { nonce: 0 }.to_message()).await?;
            }
            result = tx_rx.recv() => {
                if let Ok(wire) = result {
                    stream.write_all(&wire).await.map_err(|e| e.to_string())?;
                }
            }
            result = recv_msg(stream) => {
                let msg = result?;
                match msg.msg_type {
                    MessageType::Ping => {
                        send_msg(stream, &Message { msg_type: MessageType::Pong, payload: Vec::new() }).await?;
                    }
                    MessageType::Peers => {
                        if let Ok(p) = PeersPayload::from_message(&msg) {
                            let ips: Vec<String> = p.peers.iter().filter_map(|a| normalize_seed(a)).collect();
                            if !ips.is_empty() {
                                write_runtime_entries(runtime_path, &ips);
                            }
                        }
                    }
                    MessageType::Disconnect => return Ok(()),
                    _ => {}
                }
            }
        }
    }
}

// ─── Header sync ─────────────────────────────────────────────────────────────

async fn sync_headers(
    stream: &mut TcpStream,
    lc: Arc<LightClient>,
    peer_height: u64,
) -> Result<(), String> {
    loop {
        let (our_height, our_tip) = {
            let t = lc.tip.lock().map_err(|_| "tip lock poisoned")?;
            (t.height, t.hash)
        };
        if our_height >= peer_height {
            break;
        }

        let req = GetHeadersPayload {
            start_hash: our_tip.to_vec(),
            count: 2000,
        };
        send_msg(stream, &req.to_message()?).await?;

        let msg = recv_msg(stream).await?;
        if msg.msg_type != MessageType::Headers {
            return Err("expected Headers message during sync".to_string());
        }

        let raw = &msg.payload;
        if raw.is_empty() {
            break; // peer is at same height
        }
        if raw.len() % 80 != 0 {
            return Err(format!("headers payload {} bytes not divisible by 80", raw.len()));
        }

        let mut t = lc.tip.lock().map_err(|_| "tip lock poisoned")?;
        let mut offset = 0usize;
        while offset < raw.len() {
            let (header, _) = BlockHeader::deserialize(&raw[offset..])
                .map_err(|e| format!("BlockHeader::deserialize: {e}"))?;

            // prev_hash (display order) must match our current tip hash (display order)
            if header.prev_hash != t.hash {
                return Err("header breaks chain: prev_hash mismatch".to_string());
            }

            // Verify PoW
            let hash = header.hash(); // display order
            if !meets_target(&hash, Target { bits: header.bits }) {
                return Err("header fails PoW check".to_string());
            }

            t.height += 1;
            t.hash = hash;
            offset += 80;
        }
    }
    Ok(())
}

// ─── Wire I/O ─────────────────────────────────────────────────────────────────

async fn recv_msg(stream: &mut TcpStream) -> Result<Message, String> {
    let mut hdr = [0u8; 6];
    stream.read_exact(&mut hdr).await.map_err(|e| e.to_string())?;

    if hdr[0] != WIRE_PROTOCOL_VERSION {
        return Err(format!("unsupported protocol version: {}", hdr[0]));
    }
    let msg_type_byte = hdr[1];
    let length = u32::from_be_bytes([hdr[2], hdr[3], hdr[4], hdr[5]]) as usize;

    if length > 32 * 1024 * 1024 {
        return Err("incoming message exceeds 32 MB limit".to_string());
    }

    let mut payload = vec![0u8; length];
    if length > 0 {
        stream.read_exact(&mut payload).await.map_err(|e| e.to_string())?;
    }

    let msg_type = MessageType::try_from(msg_type_byte).map_err(|e| e)?;
    Ok(Message { msg_type, payload })
}

async fn send_msg(stream: &mut TcpStream, msg: &Message) -> Result<(), String> {
    stream.write_all(&msg.serialize()).await.map_err(|e| e.to_string())
}
