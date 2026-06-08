# Design — ulanzi-camera-switcher

## Goal
Drive OBS camera/scene switching from the Ulanzi dial, mirroring the StreamDeck "cameras view." One-handed, by-feel camera changes while streaming.

## Hardware / platform
- Ulanzi dial (rotary + buttons unit) via the Ulanzi Deck / Stream Dock app.
- OBS Studio on welsh-gamingpc.

## Architecture (proposed)
- Plugin built on the official **UlanziDeckPlugin-SDK** (Node.js). Confirm SDK shape, manifest format, and the dial rotate + keypress events.
- Connect to OBS via **obs-websocket v5** (e.g. `obs-websocket-js`).
- Maintain an ordered list of "camera" scenes (config). Dial rotate = move index ±1 and set the program (or preview) scene; dial press = commit / toggle preview↔program (configurable).
- Optional: render the current camera name/index on the dial's screen if the SDK exposes the display.

## Open questions for the session
- What dial rotation + button events does UlanziDeckPlugin-SDK actually expose? Does it expose the dial's LCD for feedback?
- Studio mode (preview/program) vs direct program cut — which feels right?
- How to define the camera list (hardcode vs config file vs read the OBS scene collection)?
- Mirror the exact StreamDeck "cameras view" scene set — pull those scene names from the existing StreamDeck setup (`C:\Users\brend\Projects\StreamDeck` / StreamDeckScripts).

## Roadmap
1. Spike: SDK hello-world plugin that logs dial rotate + press.
2. Spike: connect to OBS, list scenes, switch on command.
3. Wire dial → scene index; press → commit.
4. Config for camera list + behavior; on-dial feedback if available.
5. Package + document install.

## References
- UlanziTechnology/UlanziDeckPlugin-SDK (GitHub)
- obs-websocket v5 protocol
