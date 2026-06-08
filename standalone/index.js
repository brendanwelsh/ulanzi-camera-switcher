// Standalone front-end: reads the Ulanzi dial directly over USB HID (no UlanziStudio)
// and drives the shared mpv viewer engine. See ../DESIGN.md for why this path exists.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import HID from "node-hid";
import { parseReport } from "./dial.js";
import { CameraViewer } from "../shared/camera-viewer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = process.env.ULANZI_CAM_CONFIG || path.join(__dirname, "config.json");
const LEARN = process.argv.includes("--learn"); // print every report so you can map buttons

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

// accept either a JSON number (8711) or a "0x2207" string for VID/PID
function toId(v, dflt) {
  if (v == null) return dflt;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  return s.toLowerCase().startsWith("0x") ? parseInt(s, 16) : parseInt(s, 10);
}

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`No config found at ${CONFIG_PATH}`);
    console.error("Copy config.example.json -> config.json and fill in your NVR + cameras.");
    process.exit(1);
  }
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); }
  catch (e) { console.error(`config.json is not valid JSON: ${e.message}`); process.exit(1); }

  if (!cfg.nvr || !Array.isArray(cfg.cameras) || cfg.cameras.length === 0) {
    console.error("config.json must define `nvr` and a non-empty `cameras` list.");
    process.exit(1);
  }
  cfg.ipcPipe = cfg.ipcPipe || "\\\\.\\pipe\\mpv-cam";
  cfg.mpvProcess = cfg.mpvProcess || "mpvnet.exe";
  return cfg;
}

// button-index -> camera-index, resolved from the human-readable names in config.buttons
function buildButtonMap(cfg) {
  const nameToIdx = new Map(cfg.cameras.map((c, i) => [c.name, i]));
  const map = new Map();
  for (const [btn, camName] of Object.entries(cfg.buttons || {})) {
    const ci = nameToIdx.get(camName);
    if (ci == null) { log(`config: button ${btn} -> unknown camera "${camName}" (skipped)`); continue; }
    map.set(Number(btn), ci);
  }
  return map;
}

function main() {
  const cfg = loadConfig();
  const buttonMap = buildButtonMap(cfg);
  const viewer = new CameraViewer(cfg, log);

  const vid = toId(cfg.device && cfg.device.vendorId, 0x2207);
  const pid = toId(cfg.device && cfg.device.productId, null);
  const candidates = HID.devices().filter((d) => d.vendorId === vid && (pid == null || d.productId === pid));
  if (candidates.length === 0) {
    console.error(`Ulanzi dial (VID 0x${vid.toString(16)}${pid != null ? " PID 0x" + pid.toString(16) : ""}) not found.`);
    console.error("Plug the dial in (and close UlanziStudio so it doesn't hold the device), then retry.");
    process.exit(1);
  }

  let device = null, used = null;
  for (const info of candidates) {
    try { device = new HID.HID(info.path); used = info; break; }
    catch (e) { /* try the next interface */ }
  }
  if (!device) { console.error("Found the dial but could not open any of its HID interfaces."); process.exit(1); }

  log(`connected: ${used.product || "Ulanzi dial"}  (VID 0x${vid.toString(16)})`);
  log(`cameras: ${cfg.cameras.length} | NVR ${cfg.nvr}`);
  log("dial: rotate = next/prev camera, press = open/close viewer");
  if (buttonMap.size) {
    const desc = [...buttonMap.entries()].map(([b, c]) => `${b}->${cfg.cameras[c].name}`).join(", ");
    log(`buttons: ${desc}`);
  } else {
    log("buttons: none mapped yet — run `npm run learn`, press each key, add it to config.buttons");
  }
  if (LEARN) log("LEARN mode: every report is printed below. Press each physical button to see its index.");

  device.on("data", (buf) => {
    const ev = parseReport(buf);
    if (LEARN && ev) log(`report ${buf.toString("hex")} -> ${JSON.stringify(ev)}`);
    if (!ev) return;
    switch (ev.kind) {
      case "rotate": viewer.rotate(ev.delta); break;
      case "press": viewer.togglePress(); break;
      case "button":
        if (!ev.pressed) break; // act on press, ignore release
        if (buttonMap.has(ev.index)) viewer.jumpTo(buttonMap.get(ev.index));
        else log(`button ${ev.index} pressed — unmapped (add "${ev.index}": "CAMERA NAME" to config.buttons)`);
        break;
    }
  });

  device.on("error", (e) => { log("HID error: " + e.message); process.exit(1); });

  const shutdown = () => { try { device.close(); } catch (e) {} process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
