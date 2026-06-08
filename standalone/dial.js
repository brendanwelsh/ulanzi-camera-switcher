// Ulanzi Stream Controller D200 input parsing (VID 0x2207 / PID 0x0019).
//
// Report framing reused from the sister ulanzi-synth project's findings:
//   0x7c 0x7c [cmd:u16 BE] [len:u32 LE] [payload...]
//   IN_BUTTON cmd 0x0101, payload [state, index, type, action]
//     type   0x02 = encoder (the dial), else a physical key
//     action 0x01 = press, 0x02 = rotate left, 0x03 = rotate right, else release
//
// ulanzi-synth read this over WebHID (where e.data excludes the report id). node-hid
// hands us a raw Buffer that MAY carry a leading report-id byte, so rather than assume
// the frame starts at offset 0 we locate the 0x7c 0x7c marker and parse relative to it.

const IN_BUTTON = 0x0101;
const FRAME = [0x7c, 0x7c];

// index of the start of the framed report, or -1 if this buffer isn't one
export function findFrame(buf) {
  for (let i = 0; i + 11 < buf.length; i++) {
    if (buf[i] === FRAME[0] && buf[i + 1] === FRAME[1]) return i;
  }
  return -1;
}

// Decode one input report into an intent, or null if it isn't a button/dial report.
//   { kind: "rotate", delta: -1 | +1 }   dial turned
//   { kind: "press" }                    dial pushed
//   { kind: "button", index, pressed }   a physical key
export function parseReport(buf) {
  const off = findFrame(buf);
  if (off < 0) return null;
  const cmd = (buf[off + 2] << 8) | buf[off + 3];
  if (cmd !== IN_BUTTON) return null;

  const index = buf[off + 9];
  const type = buf[off + 10];
  const action = buf[off + 11];

  if (type === 0x02) {
    if (action === 0x02) return { kind: "rotate", delta: -1 };
    if (action === 0x03) return { kind: "rotate", delta: +1 };
    if (action === 0x01) return { kind: "press" };
    return null; // dial release — ignore
  }
  return { kind: "button", index, pressed: action === 0x01 };
}
