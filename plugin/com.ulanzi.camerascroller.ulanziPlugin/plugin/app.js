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

const MPV_DEFAULT = path.join(process.env.LOCALAPPDATA || "", "Programs", "mpv.net", "mpvnet.exe");

// config.json is OPTIONAL now: it supplies mpv settings (+ optional fallback cameras). The camera list,
// NVR host, and URL template are normally managed in the GUI (global settings); config.json is the fallback.
function baseConfig() {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) || {}; } catch (e) {}
  const fileCams = Array.isArray(file.cameras) ? file.cameras : [];
  return {
    mpvPath: file.mpvPath || MPV_DEFAULT,
    mpvProcess: file.mpvProcess || "mpvnet.exe",
    ipcPipe: file.ipcPipe || "\\\\.\\pipe\\mpv-cam",
    scriptsDir: file.scriptsDir,               // legacy; the engine prefers its bundled cam-center.ps1
    nvr: file.nvr || "",
    urlTemplate: file.urlTemplate || "rtsps://{nvr}/{id}?enableSrtp",
    cameras: fileCams,
    _fileCameras: fileCams,
  };
}

const $UD = new UlanziApi();
const LOGFILE = path.join(PLUGIN_ROOT, "camera-scroller.log");
const log = (m) => {
  try { $UD.logMessage("[camera-scroller] " + m); } catch (e) {}
  try { fs.appendFileSync(LOGFILE, new Date().toISOString() + " " + m + "\n"); } catch (e) {}
};

const cfg = baseConfig();
const viewer = new CameraViewer(cfg, log);

// merge the GUI's global settings (nvr / urlTemplate / cameras) into the live config, in place
function applyGlobal(g) {
  if (!g || typeof g !== "object") return;
  if (typeof g.nvr === "string") cfg.nvr = g.nvr;
  if (typeof g.urlTemplate === "string" && g.urlTemplate) cfg.urlTemplate = g.urlTemplate;
  if (Array.isArray(g.cameras)) cfg.cameras = g.cameras.length ? g.cameras : cfg._fileCameras;
  if (viewer.idx >= cfg.cameras.length) viewer.idx = 0;
  log(`config: ${cfg.cameras.length} cameras, NVR ${cfg.nvr || "(none)"}`);
}

const camNames = () => cfg.cameras.map((c) => c.name);
// case/space-insensitive so an older saved name like "BACKYARD" still matches "Backyard"
const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
const camIndexByName = (name) => (cfg && name ? cfg.cameras.findIndex((c) => norm(c.name) === norm(name)) : -1);
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
  log(`connected; ${cfg.cameras.length} cameras from config.json — requesting GUI settings…`);
  try { $UD.getGlobalSettings(); } catch (e) {}
});

// camera list / NVR / template edited in the Camera Scroller's GUI (stored as global settings)
$UD.onDidReceiveGlobalSettings((m) => applyGlobal(paramOf(m)));

$UD.onAdd((message) => {
  // a Camera Button carries a cameraName in its settings; the Camera Scroller (dial) does not
  if (paramOf(message).cameraName) rememberJump(message);
  else { $UD.setStateIcon(message.context, 0, "CAMERAS"); try { $UD.getSettings(message.context); } catch (e) {} }
});

// settings changed in a PI, or returned from our getSettings() request after a restart
$UD.onParamFromApp(rememberJump);
$UD.onParamFromPlugin(rememberJump);
$UD.onDidReceiveSettings(rememberJump);

$UD.onClear((message) => {
  if (Array.isArray(message.param)) for (const it of message.param) jumpCam.delete(it.context);
});

// ── dial (Camera Scroller) ───────────────────────────────────────────────────
$UD.onDialRotate((message) => {
  if (!cfg.cameras.length) return $UD.showAlert(message.context);
  const dir = String(message.rotateEvent || "").includes("left") ? -1 : 1;
  const cam = viewer.rotate(dir);
  if (cam) $UD.setStateIcon(message.context, 0, cam.name);
});

$UD.onDialDown((message) => {
  if (!cfg.cameras.length) return $UD.showAlert(message.context);
  const cam = viewer.togglePress();
  $UD.setStateIcon(message.context, 0, cam ? cam.name : "CAMERAS");
});

// ── keypad: a key press is always our only Keypad action (Camera Button) ──────
$UD.onRun((message) => {
  if (!cfg.cameras.length) { log("no cameras configured"); return $UD.showAlert(message.context); }
  const name = jumpCam.get(message.context) || paramOf(message).cameraName;
  const idx = camIndexByName(name);
  log(`key press -> "${name}" (idx ${idx})`);
  if (idx < 0) { try { $UD.getSettings(message.context); } catch (e) {} return $UD.showAlert(message.context); }
  viewer.jumpTo(idx);
});

// ── Property Inspector asks for the camera list to populate its dropdown ──────
$UD.onSendToPlugin((message) => {
  const data = paramOf(message);
  if (data && data.type === "getCameras") {
    $UD.sendToPropertyInspector({ type: "cameras", cameras: camNames(), nvr: cfg ? cfg.nvr : null }, message.context);
  }
});
