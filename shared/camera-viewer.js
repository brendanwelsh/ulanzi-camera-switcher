// mpv.net camera viewer — the proven engine from the streamdeck-cameradials plugin
// (com.welsh.cameradials), shared by BOTH front-ends in this repo:
//   - standalone/  (direct USB HID daemon)
//   - plugin/      (official Ulanzi Deck plugin)
//
// Same behavior either way: ONE mpv.net window with a JSON IPC pipe so camera switches
// happen IN PLACE (instant), maximized on the primary monitor via cam-center.ps1.
//
// This file is the single source of truth. The plugin ships a COPY (kept in sync by
// scripts/sync-engine.mjs) so its folder is self-contained when zipped for sharing.
//
// Everything install-specific (NVR host, camera list, mpv path, scripts dir) comes from
// `cfg`. Nothing about a specific setup lives here.

import net from "net";
import { spawn, exec } from "child_process";

export class CameraViewer {
  constructor(cfg, log) {
    this.cfg = cfg;
    this.log = log || (() => {});
    this.idx = 0;
    this.open = false;
    this._openTimer = null;
    this._pendingFresh = false;
  }

  get cams() { return this.cfg.cameras; }
  camUrl(cam) { return `rtsps://${this.cfg.nvr}/${cam.id}?enableSrtp`; }

  // send one or more mpv JSON IPC commands over the named pipe (no-op if mpv isn't running)
  ipcMany(cmds) {
    try {
      const sock = net.connect(this.cfg.ipcPipe, () => {
        for (const c of cmds) sock.write(JSON.stringify({ command: c }) + "\n");
        sock.end();
      });
      sock.on("error", () => {});
    } catch (e) { /* mpv not up yet */ }
  }

  overlay(text) { this.ipcMany([["show-text", text, 4000]]); }

  // bring mpv onto the primary monitor + maximize + topmost (reuses the existing helper)
  maximize() {
    const ps = `${this.cfg.scriptsDir}\\cam-center.ps1`;
    try {
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps}"`, () => {});
    } catch (e) { /* best effort */ }
  }

  openCam(fresh) {
    const cam = this.cams[this.idx];
    if (!cam) return;
    if (fresh) {
      // fresh launch: new window with an IPC pipe so later switches are in-place
      try {
        spawn(this.cfg.mpvPath, [
          "--ontop=yes", "--input-ipc-server=" + this.cfg.ipcPipe,
          "--osd-font-size=40", "--osd-align-x=center", "--osd-align-y=center",
          "--force-media-title=" + cam.name, "--title=" + cam.name, "--osd-playing-msg=",
          "--geometry=1280x720+960+540", this.camUrl(cam),
        ], { detached: true, stdio: "ignore" }).unref();
      } catch (e) { this.log("mpv launch failed: " + e.message); }
      this.maximize();
    } else {
      // already running: switch the feed IN PLACE via IPC (instant) + on-screen text
      this.ipcMany([
        ["show-text", "Swapping to " + cam.name, 4000],
        ["set_property", "force-media-title", cam.name],
        ["loadfile", this.camUrl(cam)],
      ]);
    }
    this.log(`${cam.name} ${fresh ? "(opening)" : "(switch in place)"}`);
  }

  closeCam() {
    try { exec(`taskkill /IM ${this.cfg.mpvProcess} /F`, () => {}); } catch (e) {}
  }

  // debounce fresh launches so rapid dial scrolling only loads the feed you land on
  scheduleOpen(fresh) {
    if (fresh) this._pendingFresh = true;
    if (this._openTimer) clearTimeout(this._openTimer);
    this._openTimer = setTimeout(() => {
      this._openTimer = null;
      const f = this._pendingFresh; this._pendingFresh = false;
      this.openCam(f);
    }, 280);
  }

  // ── input intents (front-ends call these) ─────────────────────────────────

  // dial rotate → step to next/prev camera (mirrors the Stream Deck+ scroller)
  rotate(delta) {
    const wasOpen = this.open;
    const n = this.cams.length;
    this.idx = (this.idx + (delta < 0 ? -1 : 1) + n) % n;
    this.open = true;
    if (wasOpen) this.overlay("Swapping to " + this.cams[this.idx].name);
    this.scheduleOpen(!wasOpen);
    return this.cams[this.idx];
  }

  // dial press → open/close the viewer (always (re)starts on the first camera, like the plugin)
  togglePress() {
    this.open = !this.open;
    if (this.open) { this.idx = 0; this.openCam(true); }
    else { this.closeCam(); this.log("closed"); }
    return this.open ? this.cams[this.idx] : null;
  }

  // a specific camera jump (Ulanzi button / standalone button). Press the control for the
  // camera already showing to close it (matches the Stream Deck grid's toggle feel).
  jumpTo(camIndex) {
    if (camIndex == null || camIndex < 0 || camIndex >= this.cams.length) return null;
    if (this.open && this.idx === camIndex) { this.closeCam(); this.open = false; this.log("closed"); return null; }
    const wasOpen = this.open;
    this.idx = camIndex;
    this.open = true;
    this.openCam(!wasOpen);
    return this.cams[this.idx];
  }
}
