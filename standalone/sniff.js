// Raw HID capture for an unknown dial. Opens EVERY interface of a target VID[:PID] and
// prints each raw report, labelled by interface + usage, so we can learn what the dial
// actually emits on rotate/press and write a parser for it.
//
//   node sniff.js                 # list connected devices
//   node sniff.js 0xfff1 0x0082   # capture from that device (rotate + press, Ctrl+C to stop)

import HID from "node-hid";
import fs from "fs";

// optional: mirror every captured line to a logfile (so it can be watched/read live)
const LOG = process.env.SNIFF_LOG || null;
const out = (line) => { console.log(line); if (LOG) { try { fs.appendFileSync(LOG, line + "\n"); } catch (e) {} } };

const hex = (n) => (n || 0).toString(16).padStart(4, "0");
const ts = () => new Date().toLocaleTimeString();
const parseId = (s) => {
  if (!s) return null;
  s = String(s).trim();
  return s.toLowerCase().startsWith("0x") ? parseInt(s, 16) : parseInt(s, 10);
};
const usageName = (up, u) => {
  if (up === 0x1 && u === 0x6) return "Keyboard";
  if (up === 0x1 && u === 0x2) return "Mouse";
  if (up === 0x1 && u === 0x80) return "SystemControl";
  if (up === 0xc && u === 0x1) return "ConsumerControl(media)";
  if (up >= 0xff00) return "Vendor";
  return "";
};

const vid = parseId(process.argv[2]);
const pid = parseId(process.argv[3]);

if (vid == null) {
  const seen = new Set();
  console.log("Connected HID devices:");
  for (const d of HID.devices()) {
    const k = d.vendorId + ":" + d.productId;
    if (seen.has(k)) continue;
    seen.add(k);
    console.log(`  0x${hex(d.vendorId)}:0x${hex(d.productId)}  ${d.manufacturer || "?"} / ${d.product || "?"}`);
  }
  console.log("\nThen run:  node sniff.js 0x<vid> 0x<pid>");
  process.exit(0);
}

const targets = HID.devices().filter((d) => d.vendorId === vid && (pid == null || d.productId === pid));
if (!targets.length) {
  console.error(`No HID device matched 0x${hex(vid)}${pid != null ? ":0x" + hex(pid) : ""}. Is the dial connected?`);
  process.exit(1);
}

console.log(`Opening ${targets.length} interface(s) of 0x${hex(vid)}${pid != null ? ":0x" + hex(pid) : ""}`);
console.log("ROTATE left a few times, ROTATE right a few times, then PRESS. Watch which line(s) appear.");
console.log("(Heads up: it may change your volume / type keys while you turn it - that's expected.)\n");

const opened = [];
targets.forEach((info, i) => {
  const up = info.usagePage || 0, u = info.usage || 0;
  const tag = `if${i} ${hex(up)}/${hex(u)} ${usageName(up, u)}`.padEnd(34);
  let dev;
  try { dev = new HID.HID(info.path); }
  catch (e) { console.log(`  [skip] ${tag} could not open (${e.message})`); return; }
  opened.push(dev);
  console.log(`  [open] ${tag}`);
  dev.on("data", (buf) => out(`${ts()} ${tag} ${buf.toString("hex").match(/.{1,2}/g).join(" ")}`));
  dev.on("error", (e) => console.log(`${tag} error: ${e.message}`));
});

if (!opened.length) {
  console.error("\nCould not open any interface. Try running the terminal as Administrator,");
  console.error("or make sure the dial's own config app isn't holding the device.");
  process.exit(1);
}

console.log("\nlistening... (Ctrl+C to stop)\n");
process.on("SIGINT", () => { for (const d of opened) { try { d.close(); } catch (e) {} } process.exit(0); });
