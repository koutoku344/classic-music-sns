/**
 * MediaRecorder's WebM output often omits Segment.Info.Duration.
 * Without it Chrome may show 0:00 until playback starts.
 *
 * Add a WebM Duration element to Info, preserving the original audio clusters.
 * Fail closed: if the file layout cannot be updated safely, return the original.
 * No conversion, re-encoding, or external dependency.
 */
function readSize(bytes: Uint8Array, at: number): {
  length: number; value: number; unknown: boolean;
} | null {
  const first = bytes[at];
  if (!first) return null;
  let length = 1;
  while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length++;
  if (length > 8 || at + length > bytes.length) return null;
  let value = first & ((1 << (8 - length)) - 1);
  let unknown = value === (1 << (8 - length)) - 1;
  for (let i = 1; i < length; i++) {
    value = value * 256 + bytes[at + i];
    unknown = unknown && bytes[at + i] === 0xff;
  }
  return { length, value, unknown };
}

function encodeSize(value: number, length: number): Uint8Array | null {
  // The all-ones size value is reserved for 'unknown'.
  if (!Number.isSafeInteger(value) || value < 0 ||
      value >= Math.pow(2, 7 * length) - 1) return null;
  const out = new Uint8Array(length);
  let rest = value;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = rest % 256;
    rest = Math.floor(rest / 256);
  }
  out[0] |= 0x80 >> (length - 1);
  return out;
}

function findId(bytes: Uint8Array, id: number[], end: number): number {
  const stop = Math.min(bytes.length - id.length, end);
  for (let i = 0; i <= stop; i++) {
    if (id.every((byte, j) => bytes[i + j] === byte)) return i;
  }
  return -1;
}

/**
 * Only repairs audio/webm files. durationMs is the actual recording elapsed time.
 */
export async function withWebmDuration(file: File, durationMs: number): Promise<File> {
  if (file.type !== 'audio/webm' || durationMs <= 0) return file;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Recording metadata is at the beginning; do not scan large audio payloads.
    const infoAt = findId(bytes, [0x15, 0x49, 0xa9, 0x66], 64 * 1024);
    const segmentAt = findId(bytes, [0x18, 0x53, 0x80, 0x67], 64 * 1024);
    if (infoAt < 0 || segmentAt < 0 || segmentAt >= infoAt) return file;

    const infoSizeAt = infoAt + 4;
    const info = readSize(bytes, infoSizeAt);
    const segment = readSize(bytes, segmentAt + 4);
    if (!info || info.unknown || !segment) return file;
    const infoBodyAt = infoSizeAt + info.length;
    const infoEnd = infoBodyAt + info.value;
    if (infoEnd > bytes.length || infoEnd <= infoBodyAt) return file;

    // An existing Duration element should not be duplicated.
    if (findId(bytes.subarray(infoBodyAt, infoEnd), [0x44, 0x89], info.value) >= 0) {
      return file;
    }

    // EBML Duration is a float64 in units of TimestampScale (normally 1ms).
    let timestampScale = 1_000_000;
    const scaleOffset = findId(bytes.subarray(infoBodyAt, infoEnd), [0x2a, 0xd7, 0xb1], info.value);
    if (scaleOffset >= 0) {
      const sizeAt = infoBodyAt + scaleOffset + 3;
      const scaleSize = readSize(bytes, sizeAt);
      if (scaleSize && !scaleSize.unknown && scaleSize.value > 0 && scaleSize.value <= 6) {
        const begin = sizeAt + scaleSize.length;
        let scale = 0;
        for (let i = 0; i < scaleSize.value; i++) scale = scale * 256 + bytes[begin + i];
        if (scale > 0) timestampScale = scale;
      }
    }

    const durationElement = new Uint8Array(11);
    durationElement.set([0x44, 0x89, 0x88], 0);
    new DataView(durationElement.buffer).setFloat64(3, durationMs * 1_000_000 / timestampScale, false);
    const nextInfoSize = encodeSize(info.value + durationElement.length, info.length);
    if (!nextInfoSize) return file;

    let nextSegmentSize: Uint8Array | null = null;
    if (!segment.unknown) {
      nextSegmentSize = encodeSize(segment.value + durationElement.length, segment.length);
      if (!nextSegmentSize) return file;
    }

    const out = new Uint8Array(bytes.length + durationElement.length);
    out.set(bytes.subarray(0, infoEnd), 0);
    out.set(durationElement, infoEnd);
    out.set(bytes.subarray(infoEnd), infoEnd + durationElement.length);
    out.set(nextInfoSize, infoSizeAt);
    if (nextSegmentSize) out.set(nextSegmentSize, segmentAt + 4);
    return new File([out], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}
