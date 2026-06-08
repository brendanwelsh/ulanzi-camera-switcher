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

## Open questions for the session
- Confirm the exact Ulanzi dial model + how the SDK exposes rotate/press (and whether it can render
  the camera name on the dial LCD, like the Stream Deck+ version does).
- Decide path A (SDK plugin) vs B (HID) — coordinate with `ulanzi-synth`'s dial-input findings.
- Should the runtime scripts (`cam-*.ps1`) move into `streamdeck-cameradials` as the single home,
  with both the Stream Deck+ and Ulanzi front-ends depending on it? (Reorg decision.)

## Roadmap
1. Get one Ulanzi dial rotate + press event into a script (path A or B).
2. Wire rotate → `cam-scroll.ps1 next|prev`, press → `cam-scroll.ps1 toggle`. Working scroller.
3. Mirror the dial-LCD feedback (camera name / LIVE) if the SDK allows.
4. Package + document install.

## References
- `streamdeck-cameradials` (the Stream Deck+ original being mirrored)
- `streamdeck-scripts/cam-scroll.ps1` (the reusable camera engine)
- UlanziTechnology/UlanziDeckPlugin-SDK
