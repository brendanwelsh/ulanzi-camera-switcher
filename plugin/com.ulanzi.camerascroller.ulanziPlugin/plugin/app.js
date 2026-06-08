// Camera Scroller — Ulanzi Deck plugin main service (Node.js).
//
// Receives dial/key events from UlanziStudio over WebSocket and drives the SAME mpv
// viewer engine the standalone front-end uses (./camera-viewer.js, a synced copy of
// ../../../shared/camera-viewer.js). See ../../../DESIGN.md.
//
//   Camera Scroller action (Encoder): rotate = next/prev camera, push = open/close viewer.
//   Camera Button   action (Keypad):  press = jump straight to the camera chosen in its
//                                      Property Inspector. This is the per-button feature.
//
// Camera list + NVR come from config.json in the plugin folder (copy config.example.json).

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import UlanziApi from "../ulanzi-api/index.js";
import { CameraViewer } from "./camera-viewer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(PLUGIN_ROOT, "config.json");

const PLUGIN_UUID = "com.ulanzi.ulanzistudio.camerascroller";
const ACTION_SCROLLER = PLUGIN_UUID + ".scroller";
const ACTION_JUMP = PLUGIN_UUID + ".jump";

function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (!cfg.nvr || !Array.isArray(cfg.cameras) || cfg.cameras.length === 0) return null;
    cfg.ipcPipe = cfg.ipcPipe || "\\\\.\\pipe\\mpv-cam";
    cfg.mpvProcess = cfg.mpvProcess || "mpvnet.exe";
    return cfg;
  } catch (e) {
    return null;
  }
}

const $UD = new UlanziApi();
const LOGFILE = path.join(PLUGIN_ROOT, "camera-scroller.log");
const log = (m) => {
  try { $UD.logMessage("[camera-scroller] " + m); } catch (e) {}
  try { fs.appendFileSync(LOGFILE, new Date().toISOString() + " " + m + "\n"); } catch (e) {}
};

let cfg = loadConfig();
let viewer = cfg ? new CameraViewer(cfg, log) : null;

const camNames = () => (cfg ? cfg.cameras.map((c) => c.name) : []);
const camIndexByName = (name) => (cfg ? cfg.cameras.findIndex((c) => c.name === name) : -1);
const paramOf = (m) => m.param || m.payload || m.settings || {};

// remember each jump button's chosen camera by context, so onRun is instant + robust
const jumpCam = new Map();

// any action instance that carries a cameraName is a Camera Button — cache it + label the key
function rememberJump(message) {
  const name = paramOf(message).cameraName;
  if (name) {
    jumpCam.set(message.context, name);
    $UD.setStateIcon(message.context, 0, name); // label the key with the camera name
  }
}

$UD.connect(PLUGIN_UUID);

$UD.onConnected(() => {
  log("connected; config " + (cfg ? `loaded (${cfg.cameras.length} cameras, NVR ${cfg.nvr})` : "MISSING — copy config.example.json to config.json"));
  if (!cfg) $UD.toast("Camera Scroller: config.json missing");
});

$UD.onAdd((message) => {
  // a Camera Button carries a cameraName in its settings; the Camera Scroller (dial) does not
  if (paramOf(message).cameraName) rememberJump(message);
  else $UD.setStateIcon(message.context, 0, "CAMERAS");
});

// settings changed in a Property Inspector (host pushes them back to us)
$UD.onParamFromApp(rememberJump);
$UD.onParamFromPlugin(rememberJump);

$UD.onClear((message) => {
  if (Array.isArray(message.param)) for (const it of message.param) jumpCam.delete(it.context);
});

// ── dial (Camera Scroller) ───────────────────────────────────────────────────
$UD.onDialRotate((message) => {
  if (!viewer) return $UD.showAlert(message.context);
  const dir = String(message.rotateEvent || "").includes("left") ? -1 : 1;
  const cam = viewer.rotate(dir);
  if (cam) $UD.setStateIcon(message.context, 0, cam.name);
});

$UD.onDialDown((message) => {
  if (!viewer) return $UD.showAlert(message.context);
  const cam = viewer.togglePress();
  $UD.setStateIcon(message.context, 0, cam ? cam.name : "CAMERAS");
});

// ── keypad: a key press is always our only Keypad action (Camera Button) ──────
$UD.onRun((message) => {
  if (!viewer) { log("key press but config missing"); return $UD.showAlert(message.context); }
  const name = jumpCam.get(message.context) || paramOf(message).cameraName;
  const idx = camIndexByName(name);
  log(`key press -> "${name}" (idx ${idx})`);
  if (idx < 0) return $UD.showAlert(message.context);
  viewer.jumpTo(idx);
});

// ── Property Inspector asks for the camera list to populate its dropdown ──────
$UD.onSendToPlugin((message) => {
  const data = paramOf(message);
  if (data && data.type === "getCameras") {
    $UD.sendToPropertyInspector({ type: "cameras", cameras: camNames(), nvr: cfg ? cfg.nvr : null }, message.context);
  }
});
