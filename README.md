# ulanzi-camera-switcher

> Ulanzi dial → live security-camera scroller. A port of my Stream Deck+ "Camera Scroller"
> (`com.welsh.cameradials`) onto the Ulanzi dial: rotate to switch UniFi Protect cameras, press to
> open/close the viewer — plus per-button jump-to-camera.

## What it is
The Ulanzi version of my custom Stream Deck+ camera scroller. Rotate the dial to step through the
UniFi Protect cameras, press to open/close a maximized live viewer (mpv.net, RTSPS feeds, switched in
place via mpv's JSON IPC so it's instant). Each button can jump straight to one chosen camera.

This is **not** an OBS scene switcher — it mirrors the security-camera viewer in the
**`streamdeck-cameradials`** repo. See [DESIGN.md](DESIGN.md).

## Two front-ends, one engine
Both drive the same mpv viewer (`shared/camera-viewer.js`). Pick whichever you want:

| | **standalone/** | **plugin/** |
|---|---|---|
| What | a Node daemon that reads the dial over **USB HID** | an **Ulanzi Deck plugin** for UlanziStudio |
| Needs UlanziStudio | ❌ no | ✅ yes |
| Best for | always-on, self-contained | drag-and-drop setup + **sharing with others** |

## Controls (both)
- **Rotate dial** → next / previous camera.
- **Press dial** → open / close the maximized viewer (opens on the first camera).
- **Press a button** → jump straight to its camera; press it again to close.

---

## A) Standalone (USB HID)
```powershell
cd standalone
npm install                         # node-hid (prebuilt binary, no toolchain)
copy config.example.json config.json
#   edit config.json: NVR address, cameras (name+id), and the buttons map
npm start                           # connects to the dial and runs
npm run learn                       # press each key to discover its HID index, then map it
```
`config.buttons` maps a physical key **index** → camera **name**:
```json
"buttons": { "0": "FRONT DOOR", "1": "ENTRANCE", "2": "STREET" }
```
Not sure which key is which index? `npm run learn` prints it on each press (unmapped presses are
logged with their index too).

## B) Ulanzi Deck plugin
```powershell
npm run setup:plugin     # installs the plugin's one dep (ws)
npm run build            # syncs the shared engine into the plugin folder
# put your cameras in:  plugin/com.ulanzi.camerascroller.ulanziPlugin/config.json
#   (copy that folder's config.example.json first)
npm run install:plugin   # copies the plugin into %APPDATA%\Ulanzi\UlanziDeck\Plugins\
#   then fully quit + reopen UlanziStudio
```
In UlanziStudio you get two actions under **Camera Scroller**:
- **Camera Scroller** — drop on the dial/encoder. Rotate = next/prev, push = open/close.
- **Camera Button** — drop on any key, then pick its camera from the dropdown in the
  Property Inspector. The camera name shows on the key.

### Share it with others
```powershell
npm run pack             # -> dist/com.ulanzi.camerascroller.ulanziPlugin.zip (your config.json excluded)
```
Recipients unzip into `%APPDATA%\Ulanzi\UlanziDeck\Plugins\`, copy `config.example.json` →
`config.json` with their own NVR + cameras, and restart UlanziStudio.

---

## Configuration & privacy
Each front-end has its own `config.json` (same schema). It is **gitignored** — it holds your NVR
address + UniFi camera IDs, so it never reaches git. Only the placeholder `config.example.json` is
committed. No addresses or camera IDs live in the source.

```jsonc
{
  "nvr": "HOST:7441",
  "mpvPath": "...\\mpvnet.exe",
  "scriptsDir": "...\\StreamDeckScripts",   // for cam-center.ps1 (window maximize)
  "cameras": [ { "name": "FRONT DOOR", "id": "<unifi-camera-id>" }, ... ],
  "buttons": { "0": "FRONT DOOR" }          // standalone only; the plugin picks per-key in the UI
}
```

`npm test` runs a hardware-free self-check (HID parser, both configs, the plugin manifest, engine sync).

## Repo layout
- `shared/camera-viewer.js` — the mpv IPC viewer engine (single source of truth, used by both).
- `standalone/` — USB-HID daemon: `dial.js` (D200 report parser), `index.js`, its `config*.json`.
- `plugin/com.ulanzi.camerascroller.ulanziPlugin/` — the Ulanzi Deck plugin:
  `manifest.json`, `plugin/app.js` (main service), `property-inspector/` (config UIs),
  `ulanzi-api/` + `libs/` (vendored SDK), `resources/` (icons), its `config*.json`.
- `scripts/` — `sync-engine.mjs` (build), `install-plugin.ps1`, `pack-plugin.ps1`.
- `test/smoke.mjs` — the self-check.

## Where it lives / deploys
- Repo: `ulanzi-camera-switcher` (private — camera IDs + NVR address)
- Runs on: welsh-gamingpc (Ulanzi dial + mpv.net + UniFi Protect on the LAN)

## Related
- `streamdeck-cameradials` — the Stream Deck+ original being mirrored (source of the viewer engine).
- `streamdeck-scripts` — `cam-center.ps1` (reused to maximize the window) + the original `cam-*` scripts.
- `ulanzi-synth` — sister project; its `src/input/dial.ts` decoded the D200 HID protocol used here.
