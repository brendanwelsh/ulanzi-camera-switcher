# ulanzi-camera-switcher

> Ulanzi dial → live security-camera scroller. A port of my Stream Deck+ "Camera Scroller"
> (`com.welsh.cameradials`) onto the Ulanzi dial: rotate to switch UniFi Protect cameras, press to
> open/close the viewer.

## What it is
The Ulanzi-dial version of my existing custom Stream Deck+ camera scroller. Rotate the dial to step
through 12 UniFi Protect cameras, press to open/close a maximized live viewer (mpv.net, RTSPS feeds,
switched in place via mpv IPC). It reuses the proven camera engine rather than reinventing it.

This is **not** an OBS scene switcher — it mirrors the security-camera viewer in the
**`streamdeck-cameradials`** repo. See [DESIGN.md](DESIGN.md).

## Status
Scaffolding. The behavior to match already exists and works on the Stream Deck+; this repo is about
getting the **Ulanzi dial** as a second input into that same engine.

## Where it lives / deploys
- Repo: `ulanzi-camera-switcher` (private)
- Runs on: welsh-gamingpc (Ulanzi dial + mpv.net + UniFi Protect on the LAN)

## Related
- `streamdeck-cameradials` — the Stream Deck+ original being mirrored
- `streamdeck-scripts` — `cam-scroll.ps1`, the reusable camera engine this should call
- `ulanzi-synth` — sister Ulanzi-dial project; shares the dial-input research
