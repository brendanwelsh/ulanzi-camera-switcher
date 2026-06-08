// Standalone front-end for the Ulanzi D100H ("Dial_Lite", VID 0xfff1). It reads the dial's
// Consumer Control interface (it emulates a volume knob) and drives the shared mpv viewer:
//   rotate one way  -> next camera      (Volume Up   0xE9 by default)
//   rotate other way-> prev camera      (Volume Down 0xEA by default)
//   press           -> open/close viewer(Mute        0xE2 by default)
//
// NOTE: because the dial sends real volume/mute codes, Windows ALSO changes the volume as you
// turn it. Neutralizing that is the next step (config app remap, or volume restore) — see README.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import HID from "node-hid";
import { parseConsumer } from "./dial.js";
import { CameraViewer } from "../shared/camera-viewer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = process.env.ULANZI_CAM_CONFIG || path.join(__dirname, "config.json");
const LEARN = process.argv.includes("--learn"); // print every report (find codes / flip direction)

const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

// accept a JSON number (62449) or a "0xfff1" string
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
  cfg.device = cfg.device || {};
  cfg.dial = cfg.dial || {};
  return cfg;
}

function main() {
  const cfg = loadConfig();
  const viewer = new CameraViewer(cfg, log);

  const vid = toId(cfg.device.vendorId, 0xfff1);
  const pid = toId(cfg.device.productId, 0x0082);
  const usagePage = toId(cfg.device.usagePage, 0x0c); // Consumer Control is where the dial talks

  // the three consumer usage codes -> intents (editable in config to flip direction)
  const NEXT = toId(cfg.dial.rotateNext, 0x00e9); // Volume Up
  const PREV = toId(cfg.dial.rotatePrev, 0x00ea); // Volume Down
  const PRESS = toId(cfg.dial.press, 0x00e2);     // Mute

  // pick the readable Consumer interface for this VID/PID (NOT the keyboard/mouse ones)
  const all = HID.devices().filter((d) => d.vendorId === vid && (pid == null || d.productId === pid));
  if (all.length === 0) {
    console.error(`Dial (VID 0x${vid.toString(16)}${pid != null ? " PID 0x" + pid.toString(16) : ""}) not found. Connected?`);
    process.exit(1);
  }
  const match = all.filter((d) => d.usagePage === usagePage);
  const candidates = match.length ? match : all;

  let device = null, used = null;
  for (const info of candidates) {
    try { device = new HID.HID(info.path); used = info; break; }
    catch (e) { /* try next interface */ }
  }
  if (!device) { console.error("Found the dial but could not open its Consumer interface."); process.exit(1); }

  log(`connected: ${used.product || "dial"} (VID 0x${vid.toString(16)}, usagePage 0x${(used.usagePage || 0).toString(16)})`);
  log(`cameras: ${cfg.cameras.length} | NVR ${cfg.nvr}`);
  log("rotate = next/prev camera, press = open/close viewer");
  log("note: turning the dial also moves Windows volume (known wart; see README) ");
  if (LEARN) log("LEARN mode: printing every report. Rotate/press to see codes.");

  device.on("data", (buf) => {
    const ev = parseConsumer(buf);
    if (LEARN && ev) log(`report ${buf.toString("hex")} -> ${JSON.stringify(ev)}`);
    if (!ev || ev.kind !== "consumer") return;
    switch (ev.code) {
      case NEXT: viewer.rotate(+1); break;
      case PREV: viewer.rotate(-1); break;
      case PRESS: viewer.togglePress(); break;
      default:
        if (!LEARN) log(`unmapped consumer code 0x${ev.code.toString(16)} (add it to config.dial)`);
    }
  });

  device.on("error", (e) => { log("HID error: " + e.message); process.exit(1); });

  const shutdown = () => { try { device.close(); } catch (e) {} process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
