// Copies the single source-of-truth engine (shared/camera-viewer.js) into the plugin
// folder so the plugin is self-contained when zipped for sharing. Run via `npm run build`.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "shared", "camera-viewer.js");
const dest = path.join(root, "plugin", "com.ulanzi.camerascroller.ulanziPlugin", "plugin", "camera-viewer.js");

const header =
  "// AUTO-GENERATED COPY of shared/camera-viewer.js — DO NOT EDIT HERE.\n" +
  "// Edit shared/camera-viewer.js, then run `npm run build` to refresh this copy.\n\n";

fs.writeFileSync(dest, header + fs.readFileSync(src, "utf8"));
console.log("synced engine -> " + path.relative(root, dest));

// also copy the bundled window-maximize helper so the plugin folder is self-contained
const ps1Dest = path.join(root, "plugin", "com.ulanzi.camerascroller.ulanziPlugin", "plugin", "cam-center.ps1");
fs.copyFileSync(path.join(root, "shared", "cam-center.ps1"), ps1Dest);
console.log("synced cam-center.ps1 -> " + path.relative(root, ps1Dest));
