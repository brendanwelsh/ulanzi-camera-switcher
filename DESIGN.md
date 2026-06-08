# Design — ulanzi-camera-switcher

## Goal
Port my existing **Stream Deck+ "Camera Scroller"** onto the **Ulanzi dial**. Same behavior, new
hardware. This mirrors the custom `com.welsh.cameradials` plugin (see the **`streamdeck-cameradials`**
repo) — NOT OBS scenes.

## What it mirrors (the source of truth)
From `streamdeck-cameradials` (`com.welsh.cameradials.scroller`):
- **Rotate** → step through 12 UniFi Protect cameras: FRONT DOOR, ENTRANCE, STREET, BACKYARD,
  GARAGE, SIDE YARD, LIVING RM, KITCHEN, BEDROOM, CLOSET, STAIRS, WORKSHOP.
- **Push** → open / close a maximized live viewer.
- Each feed is `rtsps://<NVR>/<cameraId>?enableSrtp` played in **mpv.net**, switched **in place**
  via mpv's JSON IPC pipe (`\\.\pipe\mpv-cam`) so changes are instant. Window is centered/maximized
  on the primary monitor (`cam-center.ps1`).
- The camera list + IDs live in `streamdeck-cameradials/com.welsh.cameradials.sdPlugin/plugin.js`
  and in `streamdeck-scripts/cam-scroll.ps1`. **Reuse that exact list — don't redefine it.**

## Why a Ulanzi version
The Ulanzi dial is a second/cheaper dial surface; I want the same camera scroller available there
(and as a self-contained instrument that doesn't depend on the Stream Deck app running).

## Architecture options (for the session to choose)
The hard part is the same as `ulanzi-synth`: getting Ulanzi dial events into code. Two paths:

- **A. Official UlanziDeckPlugin-SDK** (Node.js, WebSocket, modeled on Elgato). Write a Ulanzi Deck
  plugin that, on `onDialRotateLeft/Right` → run the "prev/next camera" action, and on
  `onDialDown` → toggle the viewer. The action body can literally shell out to the **existing**
  `streamdeck-scripts\cam-scroll.ps1` (`next` / `prev` / `toggle`) — that script already does all
  the mpv/IPC work, so the plugin is thin. Requires UlanziStudio running.
- **B. Read the dial directly over USB HID** (no Ulanzi app dependency) — same approach being
  evaluated in `ulanzi-synth`; reuse whatever that project learns about the dial's VID/PID + HID
  protocol, then call `cam-scroll.ps1` on rotate/press.

Either way, the smart move is to **reuse `cam-scroll.ps1`** (it already maintains `cam-index.txt`
state and the mpv IPC viewer) rather than reimplement the camera logic. The Ulanzi plugin/HID layer
is just a new *input* into the same engine.

## Decision: build BOTH front-ends over one shared engine
We built **both** paths and let them share a single mpv viewer engine
(`shared/camera-viewer.js`), so there's a choice + something shareable:

| | `standalone/` (Path B — USB HID) | `plugin/` (Path A — Ulanzi Deck plugin) |
|---|---|---|
| Depends on UlanziStudio | No | Yes (runs inside it) |
| Input | reads the dial's raw HID reports | gets dial/key events from UlanziStudio |
| Best for | a self-contained always-on switcher | drag-and-drop config + **sharing with others** |
| Config | `config.json` (incl. `buttons` index→camera map) | `config.json` + per-key camera picked in the Property Inspector |

**Why this shape:**
- **The HID hard part was already done.** `ulanzi-synth/src/input/dial.ts` decoded the D200 protocol —
  VID `0x2207` / PID `0x0019`, reports framed `7c 7c [cmd BE] [len LE] [state index type action]`,
  `IN_BUTTON 0x0101`, `type 0x02` = dial, `action` 0x01 press / 0x02 left / 0x03 right. The standalone
  ports that parser to `node-hid` (scanning for the `7c 7c` marker so a leading report-id byte doesn't
  matter).
- **The plugin uses the official SDK so it's installable/shareable.** A `.js` `CodePath` runs under
  the host's Node.js v20, so the plugin (`plugin/app.js`) drives the same engine — `onDialRotate` →
  `rotate()`, `onDialDown` → `togglePress()`, key `onRun` → `jumpTo()`. The Node SDK (`common-node`)
  is vendored as `ulanzi-api/`; the Property-Inspector SDK (`common-html`) as `libs/`.
- **One engine, not two.** The real viewer (mpv JSON-IPC in-place switching, maximize, debounce) was in
  `streamdeck-cameradials/plugin.js`, NOT `cam-scroll.ps1` (that ps1 just `Start-Process`es mpv with no
  IPC + a hard-wired list). It's lifted into `shared/camera-viewer.js`, config-driven; the standalone
  imports it, the plugin ships a synced copy (`npm run build`) so its folder is self-contained when
  zipped. `cam-center.ps1` is reused as-is for the maximize.

## New feature: per-button jump-to-camera
Beyond the dial scroller, a button jumps straight to one camera (`viewer.jumpTo`) — opening if closed,
switching in place if open; pressing the button for the camera already showing closes it (mirrors the
Stream Deck grid's `cam-open.ps1` toggle).
- **Standalone:** `config.buttons` maps the dial's physical key index → camera name. `npm run learn`
  prints each key's index for mapping (the D200's real indices are confirmed on-device this way).
- **Plugin:** drop a **Camera Button** action on any key and pick its camera from a dropdown in the
  Property Inspector (the camera list is pushed from the main service). No file editing per button.

## Not hard-wired
NVR address, camera list, mpv path, scripts dir, IPC pipe (and, for the standalone, the button map) all
live in `config.json` (gitignored, one per front-end, same schema). `shared/`, `standalone/*.js`, and
`plugin/plugin/app.js` contain no addresses or camera IDs. Each ships a `config.example.json`.

## Dial-LCD feedback
- **Plugin:** the camera name IS shown on the key/dial via `setStateIcon(context, 0, name)` + the `$UA1`
  encoder layout — so the plugin gets the Stream Deck+-style label for free.
- **Standalone:** the D200 screen-write HID protocol wasn't in ulanzi-synth's input-only findings, so it
  relies on mpv's on-screen "Swapping to …" overlay. Revisit via the Bitfocus Companion D200 project.

## References
- `streamdeck-cameradials` (the Stream Deck+ original; source of the viewer engine)
- `streamdeck-scripts/cam-center.ps1` (reused for window maximize)
- `ulanzi-synth/src/input/dial.ts` (decoded the D200 HID protocol)
- UlanziTechnology/UlanziDeckPlugin-SDK (`manifest.md`, `common-node`, `common-html`)
