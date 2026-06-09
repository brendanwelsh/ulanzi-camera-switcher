# ulanzi-camera-switcher

> Drive a live security-camera viewer from a hardware dial: **rotate** = next/prev camera, **press** =
> open/close a maximized mpv.net viewer, and assign **keys to jump** straight to a specific camera.
> Works with **any** RTSP/RTSPS/HTTP camera — UniFi Protect, Reolink, Frigate, generic ONVIF, etc.

## Two front-ends, one engine
Both drive the same mpv viewer (`shared/camera-viewer.js`):

| | **plugin/** (recommended) | **standalone/** |
|---|---|---|
| What | an **Ulanzi Deck plugin** for Ulanzi Studio | a Node daemon that reads a dial over **USB HID** |
| Needs Ulanzi Studio | ✅ yes | ❌ no |
| Cameras set via | **GUI editor** in Ulanzi Studio (or `config.json`) | `config.json` |
| Best for | the full feature set + **sharing with others** | a no-app setup on a supported HID dial |

## Controls
- **Rotate dial** → next / previous camera.
- **Press dial** → open / close the maximized viewer.
- **Press a key** → jump straight to its camera (press again to close).

## Dependencies
- **[mpv.net](https://github.com/mpvnet-player/mpv.net)** — the video player the viewer drives (Windows). Install it; the default install path is auto-detected.
- **Windows 10/11** — the window-maximize step uses PowerShell (the helper is **bundled**, no external scripts).
- A **camera source**: any RTSP/RTSPS/HTTP stream (a UniFi Protect NVR, Reolink, Frigate, …).
- **Plugin path:** **Ulanzi Studio** + a compatible Ulanzi device. Node is provided by Studio; the only npm dep is `ws` (bundled into the share zip).
- **Standalone path:** **Node.js 18+** and a USB-HID dial. `npm install` pulls `node-hid` (prebuilt, no toolchain).

## Cameras — not tied to one camera system
Each camera is either a full **URL** or a **template + id**:
```jsonc
{ "name": "Front Door", "id": "abc123" }                        // built via urlTemplate + nvr (UniFi default)
{ "name": "Garage",     "url": "rtsp://user:pass@10.0.0.5/s1" } // any RTSP/RTSPS/HTTP stream
```
`urlTemplate` defaults to UniFi Protect (`rtsps://{nvr}/{id}?enableSrtp`) and is overridable — so it
works with any NVR/camera, not just UniFi.

---

## Plugin (recommended)
```powershell
npm run setup:plugin     # installs the plugin's one dep (ws)
npm run build            # bundles the shared engine + maximize helper into the plugin
npm run install:plugin   # copies it into %APPDATA%\Ulanzi\UlanziDeck\Plugins\
#   then fully quit + reopen Ulanzi Studio
```
### One-tap dial layout (profile)
Don't want to place actions by hand? Import the ready-made dial profile:
**`profiles/Camera-Scroller.ulanziDeckProfile`** — in Ulanzi Studio (Dial selected) → Import.
It drops **Camera Scroller** on the knob and three **Camera Button** keys (pick a camera in each).
Regenerate/pre-bind with `powershell -File scripts\build-profile.ps1 [-DialUuid <yours>]`.

In Ulanzi Studio you get two actions under **Camera Scroller**:
- **Camera Scroller** → drop on the dial. Rotate = next/prev, press = open/close. **Its Property
  Inspector is the camera editor** — set the NVR + template and add/remove cameras (name + URL or ID)
  right there, no file editing.
- **Camera Button** → drop on a key, pick a camera from the dropdown. The camera name shows on the key.

### Share it with others
```powershell
npm run pack             # -> dist/...zip  (your private config.json is excluded)
```
A recipient unzips into `%APPDATA%\Ulanzi\UlanziDeck\Plugins\`, restarts Ulanzi Studio, drops **Camera
Scroller** on their dial, opens its settings, and **adds their own cameras in the GUI** — no file
editing, no shared secrets. (They need: mpv.net + Ulanzi Studio + their dial.)

## Standalone (USB-HID, no Ulanzi Studio)
```powershell
cd standalone
npm install
copy config.example.json config.json   # set cameras (url or id) + the dial's HID ids
npm start                               # connect to the dial and run
npm run learn                           # dump raw HID reports to map a dial
```
This reads a dial's raw HID directly; it's tuned for the **Ulanzi D100H** ("Dial_Lite", VID `0xfff1`),
whose knob emits volume/media codes. See the **`ulanzi-d100h-homebrew`** repo for that protocol.

---

## Config & privacy
- **Plugin:** cameras live in **Ulanzi Studio's settings** (set via the GUI), with `config.json` as a
  fallback. `config.json` is **gitignored** and **excluded from the share zip**.
- **Standalone:** `config.json` (gitignored) holds cameras + the dial's HID ids; `config.example.json`
  is the committed template.
- No addresses, camera IDs, or credentials live in the source.

`npm test` runs a hardware-free self-check (parser, configs, plugin manifest, engine sync).

## Repo layout
- `shared/camera-viewer.js` + `shared/cam-center.ps1` — the mpv IPC viewer engine + bundled maximize helper.
- `plugin/com.ulanzi.camerascroller.ulanziPlugin/` — the Ulanzi Deck plugin (`manifest.json`,
  `plugin/app.js` main service, `property-inspector/` GUI editor + button dropdown, vendored SDK, icons).
- `standalone/` — USB-HID daemon (`dial.js` Consumer-Control parser, `index.js`, `sniff.js`).
- `scripts/` — `sync-engine.mjs` (build), `install-plugin.ps1`, `pack-plugin.ps1`.
- `test/smoke.mjs` — the self-check.

## Related
- **`ulanzi-d100h-homebrew`** — the dial's HID protocol + Ulanzi Studio internals (public reference).
- `streamdeck-cameradials` — the Stream Deck+ original this mirrors (source of the viewer engine).
