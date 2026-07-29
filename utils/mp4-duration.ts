// Container-level duration for the MP4 family (m4a/mp4/mov/3gp), read from
// the moov/mvhd box with plain byte math — no decoder involved. The compose
// duration guard needs this because the <audio> metadata probe goes blind
// exactly when the CODEC is undecodable (an ALAC .m4a fires `error` in
// Chromium), yet the container still states its duration; a too-long file
// must be refused before any byte leaves the device (VKB-67).
//
// Returns null for anything it cannot prove — the caller falls back to the
// media-element probe and, past that, to the server's verdict.

const readFourCC = (view: DataView, offset: number): string =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );

const readUint64 = (view: DataView, offset: number): number =>
  Number(view.getBigUint64(offset));

// An unreasonably large moov is a corrupt or hostile file, not a real one.
const MAX_MOOV_BYTES = 64 * 1024 * 1024;
const BOX_HEADER_BYTES = 16;

interface BoxHeader {
  type: string;
  size: number;
  headerSize: number;
}

// Box: [size:u32][type:4cc], size 1 → 64-bit size follows, size 0 → to the
// end of the enclosing space. Returns null on anything malformed.
const parseBoxHeader = (
  view: DataView,
  offset: number,
  spaceEnd: number,
): BoxHeader | null => {
  if (offset + 8 > spaceEnd) return null;
  let size = view.getUint32(offset);
  const type = readFourCC(view, offset + 4);
  let headerSize = 8;
  if (size === 1) {
    if (offset + 16 > spaceEnd) return null;
    size = readUint64(view, offset + 8);
    headerSize = 16;
  } else if (size === 0) {
    size = spaceEnd - offset;
  }
  if (size < headerSize || offset + size > spaceEnd) return null;
  return { type, size, headerSize };
};

// mvhd payload after version(1)+flags(3):
//   v0: creation u32 · modification u32 · timescale u32 · duration u32
//   v1: creation u64 · modification u64 · timescale u32 · duration u64
export const parseMvhdDurationSec = (moov: DataView): number | null => {
  let offset = 0;
  while (offset < moov.byteLength) {
    const box = parseBoxHeader(moov, offset, moov.byteLength);
    if (!box) return null;
    if (box.type === 'mvhd') {
      const body = offset + box.headerSize;
      if (body + 4 > moov.byteLength) return null;
      const version = moov.getUint8(body);
      const fields = body + 4;
      if (version === 1) {
        if (fields + 28 > moov.byteLength) return null;
        const timescale = moov.getUint32(fields + 16);
        const raw = moov.getBigUint64(fields + 20);
        // All-ones is the 64-bit "unknown" sentinel (v0's 0xffffffff); and a
        // duration past Number's safe range is a corrupt file, not a long one.
        if (raw === 0xffffffffffffffffn) return null;
        const duration = Number(raw);
        if (!Number.isSafeInteger(duration)) return null;
        return timescale > 0 ? duration / timescale : null;
      }
      if (fields + 16 > moov.byteLength) return null;
      const timescale = moov.getUint32(fields + 8);
      const duration = moov.getUint32(fields + 12);
      // 0xffffffff is the container saying "unknown".
      if (duration === 0xffffffff) return null;
      return timescale > 0 ? duration / timescale : null;
    }
    offset += box.size;
  }
  return null;
};

// Scans the file's top-level boxes for moov reading only headers (16 bytes
// a hop — moov often sits AFTER a huge mdat), then loads moov alone.
export const readMp4DurationSec = async (
  file: File,
): Promise<number | null> => {
  try {
    let offset = 0;
    while (offset + 8 <= file.size) {
      const headBytes = await file
        .slice(offset, Math.min(offset + BOX_HEADER_BYTES, file.size))
        .arrayBuffer();
      const head = new DataView(headBytes);
      const box = parseBoxHeader(head, 0, file.size - offset);
      if (!box) return null;
      if (box.type === 'moov') {
        if (box.size > MAX_MOOV_BYTES) return null;
        const moovBytes = await file
          .slice(offset + box.headerSize, offset + box.size)
          .arrayBuffer();
        return parseMvhdDurationSec(new DataView(moovBytes));
      }
      offset += box.size;
    }
    return null;
  } catch (error) {
    console.error('[mp4-duration] container scan failed', error);
    return null;
  }
};
