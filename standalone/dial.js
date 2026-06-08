// Input parsing for the actual hardware: a Ulanzi D100H, which on this machine enumerates
// as "Dial_Lite" (KEHWIN, VID 0xfff1 / PID 0x0082) — a cheap dial that emulates a VOLUME KNOB.
//
// Its events arrive on the Consumer Control HID interface (usagePage 0x0c) as 3-byte reports
// `[reportId, usageLow, usageHigh]`, i.e. a little-endian 16-bit consumer usage code:
//   0x00E9 Volume Up    (rotate one way)
//   0x00EA Volume Down  (rotate the other way)
//   0x00E2 Mute         (press)
//   0x0000 release      (key up — ignore)
//
// (The old D200 `7c 7c` parser is gone — that device was never the real hardware.)

export const CONSUMER = { VOL_UP: 0x00e9, VOL_DOWN: 0x00ea, MUTE: 0x00e2 };

// Decode one Consumer Control report into { kind, code } or null.
//   { kind: "consumer", code }  a usage was pressed (code is the 16-bit usage)
//   { kind: "release" }         everything released
export function parseConsumer(buf) {
  if (!buf || buf.length < 3) return null;
  // report layout: [reportId, usageLow, usageHigh]
  const code = buf[1] | (buf[2] << 8);
  if (code === 0) return { kind: "release" };
  return { kind: "consumer", code };
}
