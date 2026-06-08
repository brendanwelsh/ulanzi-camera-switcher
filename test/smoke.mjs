// Hardware-free self-check: HID parser, both front-ends' configs, the plugin manifest,
// and the engine-sync copy. No dial, no UlanziStudio required. Run with `npm test`.

import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseReport } from "../standalone/dial.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PLUGIN = path.join(root, "plugin", "com.ulanzi.camerascroller.ulanziPlugin");

let passed = 0;
const ok = (name, cond) => { assert(cond, name); passed++; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ── HID parser ───────────────────────────────────────────────────────────────
// framed report: 7c 7c [cmd BE] [len LE] [state index type action]
const report = ({ index = 0, type = 0, action = 0 }) =>
  Buffer.from([0x7c, 0x7c, 0x01, 0x01, 0x04, 0x00, 0x00, 0x00, 0x00, index, type, action]);

ok("rotate right -> +1", parseReport(report({ type: 0x02, action: 0x03 })).delta === 1);
ok("rotate left  -> -1", parseReport(report({ type: 0x02, action: 0x02 })).delta === -1);
ok("dial press", parseReport(report({ type: 0x02, action: 0x01 })).kind === "press");
ok("dial release ignored", parseReport(report({ type: 0x02, action: 0x09 })) === null);
const b = parseReport(report({ index: 3, type: 0x00, action: 0x01 }));
ok("button index decoded", b.kind === "button" && b.index === 3 && b.pressed === true);
ok("button release flagged", parseReport(report({ index: 3, action: 0x02 })).pressed === false);
const withId = Buffer.concat([Buffer.from([0x00]), report({ index: 5, action: 0x01 })]);
ok("frame found past report-id byte", parseReport(withId).index === 5);
ok("garbage -> null", parseReport(Buffer.from([0x00, 0x01, 0x02, 0x03])) === null);

// ── config sanity (examples required; real configs optional + gitignored) ──────
function checkConfig(file, { required, requireButtons }) {
  if (!fs.existsSync(file)) { if (required) throw new Error(`${file} missing`); return; }
  const cfg = readJson(file);
  const tag = path.relative(root, file);
  ok(`${tag}: has nvr`, typeof cfg.nvr === "string" && cfg.nvr.length > 0);
  ok(`${tag}: has cameras`, Array.isArray(cfg.cameras) && cfg.cameras.length > 0);
  const names = new Set(cfg.cameras.map((c) => c.name));
  if (requireButtons) {
    for (const [btn, name] of Object.entries(cfg.buttons || {})) {
      ok(`${tag}: button ${btn} -> known camera "${name}"`, names.has(name));
    }
  }
}
checkConfig(path.join(root, "standalone", "config.example.json"), { required: true, requireButtons: true });
checkConfig(path.join(root, "standalone", "config.json"), { required: false, requireButtons: true });
checkConfig(path.join(PLUGIN, "config.example.json"), { required: true, requireButtons: false });
checkConfig(path.join(PLUGIN, "config.json"), { required: false, requireButtons: false });

// ── plugin manifest sanity ─────────────────────────────────────────────────────
const man = readJson(path.join(PLUGIN, "manifest.json"));
ok("manifest UUID is 4 segments", man.UUID.split(".").length === 4);
ok("manifest CodePath is the node entry", man.CodePath === "plugin/app.js");
ok("manifest Type JavaScript", man.Type === "JavaScript");
const actions = man.Actions || [];
const scroller = actions.find((a) => a.UUID.endsWith(".scroller"));
const jump = actions.find((a) => a.UUID.endsWith(".jump"));
ok("scroller action is an Encoder", scroller && scroller.Controllers.includes("Encoder"));
ok("jump action is a Keypad", jump && jump.Controllers.includes("Keypad"));
for (const a of actions) ok(`action ${a.Name} UUID has 5+ segments`, a.UUID.split(".").length >= 5);
// every referenced resource/PI file exists
const refs = [man.Icon, man.CategoryIcon, ...actions.flatMap((a) => [a.Icon, a.PropertyInspectorPath, ...(a.States || []).map((s) => s.Image)])].filter(Boolean);
for (const r of refs) ok(`manifest ref exists: ${r}`, fs.existsSync(path.join(PLUGIN, r)));

// ── vendored SDK present ───────────────────────────────────────────────────────
ok("ulanzi-api vendored", fs.existsSync(path.join(PLUGIN, "ulanzi-api", "index.js")));
ok("PI libs vendored", fs.existsSync(path.join(PLUGIN, "libs", "js", "ulanziApi.js")));

// ── engine sync copy matches source ────────────────────────────────────────────
const sharedEngine = fs.readFileSync(path.join(root, "shared", "camera-viewer.js"), "utf8");
const pluginEnginePath = path.join(PLUGIN, "plugin", "camera-viewer.js");
ok("plugin engine copy exists (run `npm run build`)", fs.existsSync(pluginEnginePath));
if (fs.existsSync(pluginEnginePath)) {
  ok("plugin engine copy is in sync with shared", fs.readFileSync(pluginEnginePath, "utf8").includes(sharedEngine.trim().slice(0, 400)));
}

console.log(`ok — ${passed} checks passed`);
