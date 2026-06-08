// Hardware-free self-check: the dial's Consumer-Control parser, both front-ends' configs,
// the plugin manifest, and the engine-sync copy. No dial, no UlanziStudio required. `npm test`.

import assert from "assert";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseConsumer, CONSUMER } from "../standalone/dial.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const PLUGIN = path.join(root, "plugin", "com.ulanzi.camerascroller.ulanziPlugin");

let passed = 0;
const ok = (name, cond) => { assert(cond, name); passed++; };
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ── Consumer-Control parser (D100H / "Dial_Lite") ──────────────────────────────
// reports are [reportId, usageLow, usageHigh]
const rep = (code) => Buffer.from([0x02, code & 0xff, (code >> 8) & 0xff]);
ok("rotate up   -> Volume Up code",   parseConsumer(rep(CONSUMER.VOL_UP)).code === 0x00e9);
ok("rotate down -> Volume Down code", parseConsumer(rep(CONSUMER.VOL_DOWN)).code === 0x00ea);
ok("press       -> Mute code",        parseConsumer(rep(CONSUMER.MUTE)).code === 0x00e2);
ok("consumer kind", parseConsumer(rep(CONSUMER.VOL_UP)).kind === "consumer");
ok("release report", parseConsumer(Buffer.from([0x02, 0x00, 0x00])).kind === "release");
ok("short buffer -> null", parseConsumer(Buffer.from([0x02])) === null);

// ── config sanity (examples required; real configs optional + gitignored) ──────
function checkStandalone(file, required) {
  if (!fs.existsSync(file)) { if (required) throw new Error(`${file} missing`); return; }
  const cfg = readJson(file);
  const tag = path.relative(root, file);
  ok(`${tag}: has nvr`, typeof cfg.nvr === "string" && cfg.nvr.length > 0);
  ok(`${tag}: has cameras`, Array.isArray(cfg.cameras) && cfg.cameras.length > 0);
  ok(`${tag}: has device.vendorId`, cfg.device && cfg.device.vendorId != null);
  ok(`${tag}: has dial code map`, cfg.dial && cfg.dial.rotateNext && cfg.dial.rotatePrev && cfg.dial.press);
}
function checkPluginConfig(file, required) {
  if (!fs.existsSync(file)) { if (required) throw new Error(`${file} missing`); return; }
  const cfg = readJson(file);
  const tag = path.relative(root, file);
  ok(`${tag}: has nvr`, typeof cfg.nvr === "string" && cfg.nvr.length > 0);
  ok(`${tag}: has cameras`, Array.isArray(cfg.cameras) && cfg.cameras.length > 0);
}
checkStandalone(path.join(root, "standalone", "config.example.json"), true);
checkStandalone(path.join(root, "standalone", "config.json"), false);
checkPluginConfig(path.join(PLUGIN, "config.example.json"), true);
checkPluginConfig(path.join(PLUGIN, "config.json"), false);

// ── plugin manifest sanity (plugin is shelved for this hardware but still valid) ─
const man = readJson(path.join(PLUGIN, "manifest.json"));
ok("manifest UUID is 4 segments", man.UUID.split(".").length === 4);
ok("manifest CodePath is the node entry", man.CodePath === "plugin/app.js");
ok("manifest Type JavaScript", man.Type === "JavaScript");
const actions = man.Actions || [];
for (const a of actions) ok(`action ${a.Name} UUID has 5+ segments`, a.UUID.split(".").length >= 5);
const refs = [man.Icon, man.CategoryIcon, ...actions.flatMap((a) => [a.Icon, a.PropertyInspectorPath, ...(a.States || []).map((s) => s.Image)])].filter(Boolean);
for (const r of refs) ok(`manifest ref exists: ${r}`, fs.existsSync(path.join(PLUGIN, r)));
ok("ulanzi-api vendored", fs.existsSync(path.join(PLUGIN, "ulanzi-api", "index.js")));
ok("PI libs vendored", fs.existsSync(path.join(PLUGIN, "libs", "js", "ulanziApi.js")));

// ── engine sync copy matches source ────────────────────────────────────────────
const sharedEngine = fs.readFileSync(path.join(root, "shared", "camera-viewer.js"), "utf8");
const pluginEnginePath = path.join(PLUGIN, "plugin", "camera-viewer.js");
ok("plugin engine copy exists (run `npm run build`)", fs.existsSync(pluginEnginePath));
if (fs.existsSync(pluginEnginePath)) {
  ok("plugin engine copy in sync with shared", fs.readFileSync(pluginEnginePath, "utf8").includes(sharedEngine.trim().slice(0, 400)));
}

console.log(`ok — ${passed} checks passed`);
