# Store listing — Camera Scroller

Copy-paste source for submitting to the Ulanzi plugin marketplace
(https://ugc.ulanzistudio.com/home/1, contact `service@ulanzi.com`). Keep this PII-free —
no NVR address, no camera IDs.

## Name
Camera Scroller

## Short description (one line)
Turn the dial into a security-camera switcher — rotate to scroll cameras, press to open a
full-screen viewer, assign keys to jump to a specific camera.

## Full description
Camera Scroller turns your Ulanzi dial into a live security-camera controller.

- **Rotate** the dial to scroll through your cameras.
- **Press** the dial to open / close a maximized full-screen viewer.
- **Assign a key** to any camera to jump straight to it (the key shows the camera name).

Switching is instant — the viewer swaps the stream in place instead of relaunching, so there's
no black-screen reload between cameras.

Works with **any** camera that exposes an RTSP / RTSPS / HTTP stream: UniFi Protect, Reolink,
Frigate, generic ONVIF, and more. Add your cameras right in the action's settings panel — paste a
stream URL, or (for UniFi Protect) an NVR host plus camera IDs. No file editing, nothing hard-coded.

### Requirements
- Windows 10/11
- [mpv.net](https://github.com/mpvnet-player/mpv.net) (the video player it drives — auto-detected)

### Setup
1. Drop **Camera Scroller** on the dial; open its settings and add your cameras.
2. (Optional) Drop **Camera Button** on any key and pick a camera to jump to.

## Category
Utilities / Smart Home

## Tags
camera, security camera, rtsp, unifi protect, reolink, frigate, mpv, viewer, nvr, cctv

## Assets to attach
- `resources/pluginIcon.png` — plugin icon
- `resources/categoryIcon.png` — category icon
- Screenshot: the dial action's settings panel with a couple of cameras filled in (blur any real
  NVR address / camera IDs before uploading).
- Short clip: rotate-to-switch + press-to-open (optional, helps a lot in the store).
