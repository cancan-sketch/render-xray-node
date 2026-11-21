/**
 * Render free web service wrapper for xray-core.
 * - Downloads the official Xray-linux-64.zip release at startup if ./xray is missing.
 * - Generates config.json from env: UUID (required), WS_PATH (default /vless), PORT (provided by Render).
 * - Render terminates TLS at the edge, so xray listens plain WS on $PORT.
 * No credentials are stored in this repo.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn, execSync } = require("child_process");
const extract = require("extract-zip");

const XRAY_VERSION = process.env.XRAY_VERSION || "v26.11.9";
const XRAY_URL = `https://github.com/XTLS/Xray-core/releases/download/${XRAY_VERSION}/Xray-linux-64.zip`;
const PORT = process.env.PORT || "10000";
const UUID = process.env.UUID;
const WS_PATH = process.env.WS_PATH || "/vless";

if (!UUID) {
  console.error("UUID env var is required");
  process.exit(1);
}

const root = __dirname;
const xrayBin = path.join(root, "xray");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { "User-Agent": "render-xray-node" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (e) => { fs.unlink(dest, () => {}); reject(e); });
  });
}

async function ensureXray() {
  if (fs.existsSync(xrayBin)) return;
  console.log(`Downloading xray ${XRAY_VERSION} ...`);
  const zip = path.join(root, "xray.zip");
  await download(XRAY_URL, zip);
  await extract(zip, { dir: root });
  fs.unlinkSync(zip);
  fs.chmodSync(xrayBin, 0o755);
  console.log("xray downloaded");
}

function writeConfig() {
  const config = {
    log: { loglevel: "warning" },
    inbounds: [
      {
        port: parseInt(PORT, 10),
        listen: "0.0.0.0",
        protocol: "vless",
        settings: { clients: [{ id: UUID }], decryption: "none" },
        streamSettings: { network: "ws", wsSettings: { path: WS_PATH } }
      }
    ],
    outbounds: [{ protocol: "freedom", tag: "direct" }]
  };
  fs.writeFileSync(path.join(root, "config.json"), JSON.stringify(config, null, 2));
  console.log(`xray listening on port ${PORT}, ws path ${WS_PATH}`);
}

async function main() {
  await ensureXray();
  writeConfig();
  const proc = spawn(xrayBin, ["run", "-c", path.join(root, "config.json")], { stdio: "inherit" });
  proc.on("exit", (code) => { console.error(`xray exited with code ${code}`); process.exit(code || 1); });
}

main().catch((e) => { console.error(e); process.exit(1); });
