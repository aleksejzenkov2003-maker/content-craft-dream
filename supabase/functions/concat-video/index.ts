import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── MP4 Binary Parser & Concatenator ──

function readU32(buf: Uint8Array, off: number): number {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

function writeU32(buf: Uint8Array, off: number, val: number) {
  buf[off] = (val >>> 24) & 0xff;
  buf[off + 1] = (val >>> 16) & 0xff;
  buf[off + 2] = (val >>> 8) & 0xff;
  buf[off + 3] = val & 0xff;
}

function readU64(buf: Uint8Array, off: number): number {
  const hi = readU32(buf, off);
  const lo = readU32(buf, off + 4);
  return hi * 0x100000000 + lo;
}

function writeU64(buf: Uint8Array, off: number, val: number) {
  writeU32(buf, off, Math.floor(val / 0x100000000));
  writeU32(buf, off + 4, val >>> 0);
}

function boxType(buf: Uint8Array, off: number): string {
  return String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
}

interface Box {
  type: string;
  offset: number;
  size: number;
  headerSize: number;
  data: Uint8Array;
}

function parseBoxes(buf: Uint8Array, start = 0, end?: number): Box[] {
  const boxes: Box[] = [];
  let pos = start;
  const limit = end ?? buf.length;
  while (pos < limit - 8) {
    let size = readU32(buf, pos);
    const type = boxType(buf, pos + 4);
    let headerSize = 8;
    if (size === 1) {
      size = readU64(buf, pos + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = limit - pos;
    }
    if (size < headerSize || pos + size > limit) break;
    boxes.push({
      type,
      offset: pos,
      size,
      headerSize,
      data: buf.subarray(pos, pos + size),
    });
    pos += size;
  }
  return boxes;
}

function findBox(buf: Uint8Array, path: string[], start = 0, end?: number): Box | null {
  let boxes = parseBoxes(buf, start, end);
  for (let i = 0; i < path.length; i++) {
    const found = boxes.find((b) => b.type === path[i]);
    if (!found) return null;
    if (i === path.length - 1) return found;
    boxes = parseBoxes(buf, found.offset + found.headerSize, found.offset + found.size);
  }
  return null;
}

function findAllBoxes(buf: Uint8Array, path: string[], start = 0, end?: number): Box[] {
  if (path.length === 0) return [];
  let boxes = parseBoxes(buf, start, end);
  for (let i = 0; i < path.length - 1; i++) {
    const found = boxes.find((b) => b.type === path[i]);
    if (!found) return [];
    boxes = parseBoxes(buf, found.offset + found.headerSize, found.offset + found.size);
  }
  return boxes.filter((b) => b.type === path[path.length - 1]);
}

// Read a full-box version+flags, return { version, flags, dataOffset }
function readFullBox(buf: Uint8Array, off: number): { version: number; flags: number; dataOffset: number } {
  const version = buf[off];
  const flags = (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
  return { version, flags, dataOffset: off + 4 };
}

interface SampleTable {
  stsz: { sampleSize: number; count: number; sizes: number[] };
  stco: { offsets: number[]; is64: boolean };
  stsc: { entries: { firstChunk: number; samplesPerChunk: number; sampleDescIdx: number }[] };
  stts: { entries: { count: number; delta: number }[] };
}

function parseStsz(box: Box): SampleTable["stsz"] {
  const d = box.data;
  const { dataOffset } = readFullBox(d, box.headerSize);
  const sampleSize = readU32(d, dataOffset);
  const count = readU32(d, dataOffset + 4);
  const sizes: number[] = [];
  if (sampleSize === 0) {
    for (let i = 0; i < count; i++) {
      sizes.push(readU32(d, dataOffset + 8 + i * 4));
    }
  }
  return { sampleSize, count, sizes };
}

function parseStco(box: Box): SampleTable["stco"] {
  const d = box.data;
  const is64 = box.type === "co64";
  const { dataOffset } = readFullBox(d, box.headerSize);
  const count = readU32(d, dataOffset);
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(is64 ? readU64(d, dataOffset + 4 + i * 8) : readU32(d, dataOffset + 4 + i * 4));
  }
  return { offsets, is64 };
}

function parseStsc(box: Box): SampleTable["stsc"] {
  const d = box.data;
  const { dataOffset } = readFullBox(d, box.headerSize);
  const count = readU32(d, dataOffset);
  const entries: SampleTable["stsc"]["entries"] = [];
  for (let i = 0; i < count; i++) {
    const off = dataOffset + 4 + i * 12;
    entries.push({
      firstChunk: readU32(d, off),
      samplesPerChunk: readU32(d, off + 4),
      sampleDescIdx: readU32(d, off + 8),
    });
  }
  return { entries };
}

function parseStts(box: Box): SampleTable["stts"] {
  const d = box.data;
  const { dataOffset } = readFullBox(d, box.headerSize);
  const count = readU32(d, dataOffset);
  const entries: SampleTable["stts"]["entries"] = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      count: readU32(d, dataOffset + 4 + i * 8),
      delta: readU32(d, dataOffset + 4 + i * 8 + 4),
    });
  }
  return { entries };
}

function getTotalDuration(stts: SampleTable["stts"]): number {
  return stts.entries.reduce((sum, e) => sum + e.count * e.delta, 0);
}

interface TrackInfo {
  type: "video" | "audio" | "other";
  timescale: number;
  trakBox: Box;
  stbl: Box;
  stsz: SampleTable["stsz"];
  stco: SampleTable["stco"];
  stsc: SampleTable["stsc"];
  stts: SampleTable["stts"];
  mdatOffset: number;
}

function getTrackType(trak: Box, buf: Uint8Array): "video" | "audio" | "other" {
  const hdlr = findBox(buf, ["mdia", "hdlr"], trak.offset + trak.headerSize, trak.offset + trak.size);
  if (!hdlr) return "other";
  const handlerType = boxType(hdlr.data, hdlr.headerSize + 8);
  if (handlerType === "vide") return "video";
  if (handlerType === "soun") return "audio";
  return "other";
}

function parseTrack(trak: Box, buf: Uint8Array, mdatOffset: number): TrackInfo | null {
  const type = getTrackType(trak, buf);
  if (type === "other") return null;

  const mdhd = findBox(buf, ["mdia", "mdhd"], trak.offset + trak.headerSize, trak.offset + trak.size);
  if (!mdhd) return null;
  const mdhdData = mdhd.data;
  const { version, dataOffset: mdhdOff } = readFullBox(mdhdData, mdhd.headerSize);
  const timescale = version === 1
    ? readU32(mdhdData, mdhdOff + 16)
    : readU32(mdhdData, mdhdOff + 8);

  const stbl = findBox(buf, ["mdia", "minf", "stbl"], trak.offset + trak.headerSize, trak.offset + trak.size);
  if (!stbl) return null;

  const stszBox = findBox(buf, ["stsz"], stbl.offset + stbl.headerSize, stbl.offset + stbl.size);
  const stcoBox = findBox(buf, ["stco"], stbl.offset + stbl.headerSize, stbl.offset + stbl.size)
    || findBox(buf, ["co64"], stbl.offset + stbl.headerSize, stbl.offset + stbl.size);
  const stscBox = findBox(buf, ["stsc"], stbl.offset + stbl.headerSize, stbl.offset + stbl.size);
  const sttsBox = findBox(buf, ["stts"], stbl.offset + stbl.headerSize, stbl.offset + stbl.size);

  if (!stszBox || !stcoBox || !stscBox || !sttsBox) return null;

  return {
    type,
    timescale,
    trakBox: trak,
    stbl,
    stsz: parseStsz(stszBox),
    stco: parseStco(stcoBox),
    stsc: parseStsc(stscBox),
    stts: parseStts(sttsBox),
    mdatOffset,
  };
}

function collectSampleData(track: TrackInfo, buf: Uint8Array): Uint8Array[] {
  const { stco, stsc, stsz } = track;
  const chunks: { offset: number; samples: number }[] = [];

  for (let ci = 0; ci < stco.offsets.length; ci++) {
    const chunkNum = ci + 1;
    let samplesPerChunk = 0;
    for (let si = stsc.entries.length - 1; si >= 0; si--) {
      if (chunkNum >= stsc.entries[si].firstChunk) {
        samplesPerChunk = stsc.entries[si].samplesPerChunk;
        break;
      }
    }
    chunks.push({ offset: stco.offsets[ci], samples: samplesPerChunk });
  }

  const samples: Uint8Array[] = [];
  let sampleIdx = 0;
  for (const chunk of chunks) {
    let off = chunk.offset;
    for (let s = 0; s < chunk.samples && sampleIdx < stsz.count; s++) {
      const sz = stsz.sampleSize > 0 ? stsz.sampleSize : stsz.sizes[sampleIdx];
      samples.push(buf.subarray(off, off + sz));
      off += sz;
      sampleIdx++;
    }
  }
  return samples;
}

// Build concatenated mdat from two files' samples
function buildConcatMdat(
  vSamples1: Uint8Array[], aSamples1: Uint8Array[],
  vSamples2: Uint8Array[], aSamples2: Uint8Array[]
): { mdat: Uint8Array; vOffsets: number[]; aOffsets: number[] } {
  const allVSamples = [...vSamples1, ...vSamples2];
  const allASamples = [...aSamples1, ...aSamples2];

  let totalSize = 8; // mdat header
  for (const s of allVSamples) totalSize += s.length;
  for (const s of allASamples) totalSize += s.length;

  const mdat = new Uint8Array(totalSize);
  writeU32(mdat, 0, totalSize);
  mdat[4] = 0x6d; mdat[5] = 0x64; mdat[6] = 0x61; mdat[7] = 0x74; // "mdat"

  let pos = 8;
  const vOffsets: number[] = [];
  for (const s of allVSamples) {
    vOffsets.push(pos); // relative to mdat start in final file — will be adjusted
    mdat.set(s, pos);
    pos += s.length;
  }
  const aOffsets: number[] = [];
  for (const s of allASamples) {
    aOffsets.push(pos);
    mdat.set(s, pos);
    pos += s.length;
  }

  return { mdat, vOffsets, aOffsets };
}

// Build stbl boxes from merged sample data
function buildStsz(sizes: number[]): Uint8Array {
  const len = 12 + 8 + sizes.length * 4; // header(8) + fullbox(4) + sampleSize(4) + count(4) + entries
  const buf = new Uint8Array(len);
  writeU32(buf, 0, len);
  buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x73; buf[7] = 0x7a; // stsz
  // version=0, flags=0 at 8..11
  writeU32(buf, 12, 0); // sample_size = 0 (variable)
  writeU32(buf, 16, sizes.length);
  for (let i = 0; i < sizes.length; i++) {
    writeU32(buf, 20 + i * 4, sizes[i]);
  }
  return buf;
}

function buildStco(offsets: number[]): Uint8Array {
  // Use co64 if any offset > 2^32
  const use64 = offsets.some(o => o > 0xffffffff);
  const entrySize = use64 ? 8 : 4;
  const len = 12 + 4 + offsets.length * entrySize;
  const buf = new Uint8Array(len);
  writeU32(buf, 0, len);
  if (use64) {
    buf[4] = 0x63; buf[5] = 0x6f; buf[6] = 0x36; buf[7] = 0x34; // co64
  } else {
    buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x63; buf[7] = 0x6f; // stco
  }
  writeU32(buf, 12, offsets.length);
  for (let i = 0; i < offsets.length; i++) {
    if (use64) {
      writeU64(buf, 16 + i * 8, offsets[i]);
    } else {
      writeU32(buf, 16 + i * 4, offsets[i]);
    }
  }
  return buf;
}

function buildStsc(samplesPerChunk: number, totalSamples: number): Uint8Array {
  // Single entry: all chunks have same samples_per_chunk
  const numChunks = Math.ceil(totalSamples / samplesPerChunk) || 1;
  void numChunks;
  const len = 12 + 4 + 12; // one entry
  const buf = new Uint8Array(len);
  writeU32(buf, 0, len);
  buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x73; buf[7] = 0x63; // stsc
  writeU32(buf, 12, 1); // entry count
  writeU32(buf, 16, 1); // first_chunk
  writeU32(buf, 20, 1); // samples_per_chunk = 1 (one sample per chunk for simplicity)
  writeU32(buf, 24, 1); // sample_description_index
  return buf;
}

function buildStts(entries: { count: number; delta: number }[]): Uint8Array {
  const len = 12 + 4 + entries.length * 8;
  const buf = new Uint8Array(len);
  writeU32(buf, 0, len);
  buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x74; buf[7] = 0x73; // stts
  writeU32(buf, 12, entries.length);
  for (let i = 0; i < entries.length; i++) {
    writeU32(buf, 16 + i * 8, entries[i].count);
    writeU32(buf, 16 + i * 8 + 4, entries[i].delta);
  }
  return buf;
}

// Replace boxes inside stbl with new versions
function replaceStblBoxes(
  origStbl: Uint8Array,
  stblOffset: number,
  stblHeaderSize: number,
  replacements: Map<string, Uint8Array>
): Uint8Array {
  const children = parseBoxes(origStbl, stblHeaderSize);
  const parts: Uint8Array[] = [origStbl.subarray(0, stblHeaderSize)];

  for (const child of children) {
    const replacement = replacements.get(child.type);
    if (replacement) {
      parts.push(replacement);
    } else {
      parts.push(child.data);
    }
  }

  let totalSize = 0;
  for (const p of parts) totalSize += p.length;

  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  writeU32(result, 0, totalSize);
  return result;
}

// Rebuild trak box with updated stbl
function rebuildTrak(
  originalTrak: Uint8Array, trakOffset: number, trakHeaderSize: number,
  originalBuf: Uint8Array,
  newStbl: Uint8Array,
  originalStbl: Box,
  newDuration: number, // in track timescale
  timescale: number
): Uint8Array {
  // Simple approach: copy trak, find stbl position relative to trak start, replace it
  const trakData = new Uint8Array(originalTrak);

  // Find stbl offset within trak
  const stblRelOffset = originalStbl.offset - trakOffset;
  const stblOrigSize = originalStbl.size;

  // Build new trak by replacing stbl region
  const before = trakData.subarray(0, stblRelOffset);
  const after = trakData.subarray(stblRelOffset + stblOrigSize);

  const newTrak = new Uint8Array(before.length + newStbl.length + after.length);
  newTrak.set(before, 0);
  newTrak.set(newStbl, before.length);
  newTrak.set(after, before.length + newStbl.length);
  writeU32(newTrak, 0, newTrak.length);

  // Update mdhd duration
  updateMdhdDuration(newTrak, trakHeaderSize, newDuration, timescale);
  // Update tkhd duration
  updateTkhdDuration(newTrak, trakHeaderSize, newDuration, timescale);

  return newTrak;
}

function updateMdhdDuration(trak: Uint8Array, trakHeaderSize: number, duration: number, timescale: number) {
  const mdhd = findBox(trak, ["mdia", "mdhd"], trakHeaderSize);
  if (!mdhd) return;
  const { version, dataOffset } = readFullBox(mdhd.data, mdhd.headerSize);
  if (version === 1) {
    writeU64(mdhd.data, dataOffset + 20, duration);
  } else {
    writeU32(mdhd.data, dataOffset + 12, duration);
  }
}

function updateTkhdDuration(trak: Uint8Array, trakHeaderSize: number, duration: number, timescale: number) {
  const tkhd = findBox(trak, ["tkhd"], trakHeaderSize);
  if (!tkhd) return;
  const { version, dataOffset } = readFullBox(tkhd.data, tkhd.headerSize);
  // tkhd duration is in movie timescale, not track timescale
  // We'll update it later with the mvhd timescale
}

function concatMP4(buf1: Uint8Array, buf2: Uint8Array): Uint8Array {
  console.log(`File 1 size: ${buf1.length}, File 2 size: ${buf2.length}`);

  // Parse top-level boxes
  const boxes1 = parseBoxes(buf1);
  const boxes2 = parseBoxes(buf2);

  const moov1 = boxes1.find(b => b.type === "moov");
  const mdat1 = boxes1.find(b => b.type === "mdat");
  const moov2 = boxes2.find(b => b.type === "moov");
  const mdat2 = boxes2.find(b => b.type === "mdat");
  const ftyp = boxes1.find(b => b.type === "ftyp");

  if (!moov1 || !mdat1 || !moov2 || !mdat2) {
    throw new Error("Missing moov or mdat boxes");
  }

  // Parse tracks from both files
  const traks1 = findAllBoxes(buf1, ["moov", "trak"]);
  const traks2 = findAllBoxes(buf2, ["moov", "trak"]);

  console.log(`File 1: ${traks1.length} tracks, File 2: ${traks2.length} tracks`);

  const tracks1: TrackInfo[] = [];
  const tracks2: TrackInfo[] = [];

  for (const trak of traks1) {
    const t = parseTrack(trak, buf1, mdat1.offset);
    if (t) tracks1.push(t);
  }
  for (const trak of traks2) {
    const t = parseTrack(trak, buf2, mdat2.offset);
    if (t) tracks2.push(t);
  }

  const vTrack1 = tracks1.find(t => t.type === "video");
  const aTrack1 = tracks1.find(t => t.type === "audio");
  const vTrack2 = tracks2.find(t => t.type === "video");
  const aTrack2 = tracks2.find(t => t.type === "audio");

  if (!vTrack1 || !vTrack2) throw new Error("Missing video tracks");

  console.log(`Video track 1: ${vTrack1.stsz.count} samples, timescale ${vTrack1.timescale}`);
  console.log(`Video track 2: ${vTrack2.stsz.count} samples, timescale ${vTrack2.timescale}`);
  if (aTrack1) console.log(`Audio track 1: ${aTrack1.stsz.count} samples, timescale ${aTrack1.timescale}`);
  if (aTrack2) console.log(`Audio track 2: ${aTrack2.stsz.count} samples, timescale ${aTrack2.timescale}`);

  // Collect sample data
  const vSamples1 = collectSampleData(vTrack1, buf1);
  const vSamples2 = collectSampleData(vTrack2, buf2);
  const aSamples1 = aTrack1 ? collectSampleData(aTrack1, buf1) : [];
  const aSamples2 = aTrack2 ? collectSampleData(aTrack2, buf2) : [];

  // Build concatenated mdat
  const { mdat, vOffsets, aOffsets } = buildConcatMdat(vSamples1, aSamples1, vSamples2, aSamples2);

  // Build new sample tables for video track
  const allVSizes = [
    ...(vTrack1.stsz.sampleSize > 0 ? Array(vTrack1.stsz.count).fill(vTrack1.stsz.sampleSize) : vTrack1.stsz.sizes),
    ...(vTrack2.stsz.sampleSize > 0 ? Array(vTrack2.stsz.count).fill(vTrack2.stsz.sampleSize) : vTrack2.stsz.sizes),
  ];

  // Merge stts entries
  const vSttsEntries = [...vTrack1.stts.entries, ...vTrack2.stts.entries];
  const vDuration1 = getTotalDuration(vTrack1.stts);
  const vDuration2 = getTotalDuration(vTrack2.stts);

  // Audio
  const allASizes = [
    ...(aTrack1 ? (aTrack1.stsz.sampleSize > 0 ? Array(aTrack1.stsz.count).fill(aTrack1.stsz.sampleSize) : aTrack1.stsz.sizes) : []),
    ...(aTrack2 ? (aTrack2.stsz.sampleSize > 0 ? Array(aTrack2.stsz.count).fill(aTrack2.stsz.sampleSize) : aTrack2.stsz.sizes) : []),
  ];
  const aSttsEntries = [
    ...(aTrack1 ? aTrack1.stts.entries : []),
    ...(aTrack2 ? aTrack2.stts.entries : []),
  ];
  const aDuration1 = aTrack1 ? getTotalDuration(aTrack1.stts) : 0;
  const aDuration2 = aTrack2 ? getTotalDuration(aTrack2.stts) : 0;

  // ── Build moov ──
  // We'll base the new moov on file 1's moov, replacing the stbl in each track

  // Calculate mdat position: ftyp + moov will come first, then mdat
  // We need to know moov size first, so we build stbl replacements, then tracks, then moov

  // Build new stbl content for video
  const newVStsz = buildStsz(allVSizes);
  const newVStco = buildStco(vOffsets); // placeholder offsets, will adjust
  const newVStsc = buildStsc(1, allVSizes.length);
  const newVStts = buildStts(vSttsEntries);

  const vStblReplacements = new Map<string, Uint8Array>();
  vStblReplacements.set("stsz", newVStsz);
  vStblReplacements.set("stco", newVStco);
  vStblReplacements.set("co64", newVStco); // in case original was co64
  vStblReplacements.set("stsc", newVStsc);
  vStblReplacements.set("stts", newVStts);
  // Remove stss (sync sample) and ctts (composition time) for simplicity — every sample becomes a keyframe
  // Actually, we should merge stss too for video. Let's build it.
  const stss1 = findBox(buf1, ["moov", "trak"], 0);
  // Let's handle stss properly
  const vStss1Box = findBox(buf1, ["stss"], vTrack1.stbl.offset + vTrack1.stbl.headerSize, vTrack1.stbl.offset + vTrack1.stbl.size);
  const vStss2Box = findBox(buf2, ["stss"], vTrack2.stbl.offset + vTrack2.stbl.headerSize, vTrack2.stbl.offset + vTrack2.stbl.size);

  if (vStss1Box || vStss2Box) {
    const syncSamples: number[] = [];
    if (vStss1Box) {
      const d = vStss1Box.data;
      const { dataOffset } = readFullBox(d, vStss1Box.headerSize);
      const count = readU32(d, dataOffset);
      for (let i = 0; i < count; i++) {
        syncSamples.push(readU32(d, dataOffset + 4 + i * 4));
      }
    }
    const offset = vTrack1.stsz.count;
    if (vStss2Box) {
      const d = vStss2Box.data;
      const { dataOffset } = readFullBox(d, vStss2Box.headerSize);
      const count = readU32(d, dataOffset);
      for (let i = 0; i < count; i++) {
        syncSamples.push(readU32(d, dataOffset + 4 + i * 4) + offset);
      }
    }
    // Build stss
    const stssLen = 12 + 4 + syncSamples.length * 4;
    const stssBuf = new Uint8Array(stssLen);
    writeU32(stssBuf, 0, stssLen);
    stssBuf[4] = 0x73; stssBuf[5] = 0x74; stssBuf[6] = 0x73; stssBuf[7] = 0x73;
    writeU32(stssBuf, 12, syncSamples.length);
    for (let i = 0; i < syncSamples.length; i++) {
      writeU32(stssBuf, 16 + i * 4, syncSamples[i]);
    }
    vStblReplacements.set("stss", stssBuf);
  }

  // Handle ctts (composition time offsets) for video
  const vCtts1Box = findBox(buf1, ["ctts"], vTrack1.stbl.offset + vTrack1.stbl.headerSize, vTrack1.stbl.offset + vTrack1.stbl.size);
  const vCtts2Box = findBox(buf2, ["ctts"], vTrack2.stbl.offset + vTrack2.stbl.headerSize, vTrack2.stbl.offset + vTrack2.stbl.size);

  if (vCtts1Box || vCtts2Box) {
    const cttsEntries: { count: number; offset: number }[] = [];
    const parseCtts = (box: Box) => {
      const d = box.data;
      const { version, dataOffset } = readFullBox(d, box.headerSize);
      const count = readU32(d, dataOffset);
      for (let i = 0; i < count; i++) {
        cttsEntries.push({
          count: readU32(d, dataOffset + 4 + i * 8),
          offset: readU32(d, dataOffset + 4 + i * 8 + 4),
        });
      }
    };
    if (vCtts1Box) parseCtts(vCtts1Box);
    if (vCtts2Box) parseCtts(vCtts2Box);

    const cttsLen = 12 + 4 + cttsEntries.length * 8;
    const cttsBuf = new Uint8Array(cttsLen);
    writeU32(cttsBuf, 0, cttsLen);
    cttsBuf[4] = 0x63; cttsBuf[5] = 0x74; cttsBuf[6] = 0x74; cttsBuf[7] = 0x73;
    writeU32(cttsBuf, 12, cttsEntries.length);
    for (let i = 0; i < cttsEntries.length; i++) {
      writeU32(cttsBuf, 16 + i * 8, cttsEntries[i].count);
      writeU32(cttsBuf, 16 + i * 8 + 4, cttsEntries[i].offset);
    }
    vStblReplacements.set("ctts", cttsBuf);
  }

  const origVStbl = buf1.subarray(vTrack1.stbl.offset, vTrack1.stbl.offset + vTrack1.stbl.size);
  const newVStbl = replaceStblBoxes(origVStbl, vTrack1.stbl.offset, vTrack1.stbl.headerSize, vStblReplacements);

  // Build new stbl for audio
  let newATrak: Uint8Array | null = null;
  if (aTrack1) {
    const newAStsz = buildStsz(allASizes);
    const newAStco = buildStco(aOffsets);
    const newAStsc = buildStsc(1, allASizes.length);
    const newAStts = buildStts(aSttsEntries);

    const aStblReplacements = new Map<string, Uint8Array>();
    aStblReplacements.set("stsz", newAStsz);
    aStblReplacements.set("stco", newAStco);
    aStblReplacements.set("co64", newAStco);
    aStblReplacements.set("stsc", newAStsc);
    aStblReplacements.set("stts", newAStts);

    const origAStbl = buf1.subarray(aTrack1.stbl.offset, aTrack1.stbl.offset + aTrack1.stbl.size);
    const newAStbl = replaceStblBoxes(origAStbl, aTrack1.stbl.offset, aTrack1.stbl.headerSize, aStblReplacements);

    newATrak = rebuildTrak(
      buf1.subarray(aTrack1.trakBox.offset, aTrack1.trakBox.offset + aTrack1.trakBox.size),
      aTrack1.trakBox.offset, aTrack1.trakBox.headerSize,
      buf1, newAStbl, aTrack1.stbl,
      aDuration1 + aDuration2, aTrack1.timescale
    );
  }

  // Rebuild video trak
  const newVTrak = rebuildTrak(
    buf1.subarray(vTrack1.trakBox.offset, vTrack1.trakBox.offset + vTrack1.trakBox.size),
    vTrack1.trakBox.offset, vTrack1.trakBox.headerSize,
    buf1, newVStbl, vTrack1.stbl,
    vDuration1 + vDuration2, vTrack1.timescale
  );

  // Build moov: ftyp from file1 + moov with updated tracks + mdat
  // Rebuild moov by replacing trak boxes
  const moovChildren = parseBoxes(buf1, moov1.offset + moov1.headerSize, moov1.offset + moov1.size);
  const moovParts: Uint8Array[] = [];
  let moovContentSize = 0;

  for (const child of moovChildren) {
    if (child.type === "trak") {
      const trackType = getTrackType(child, buf1);
      if (trackType === "video") {
        moovParts.push(newVTrak);
        moovContentSize += newVTrak.length;
      } else if (trackType === "audio" && newATrak) {
        moovParts.push(newATrak);
        moovContentSize += newATrak.length;
      } else {
        // Skip other tracks (subtitles etc)
      }
    } else {
      // Copy mvhd, udta, etc as-is
      const data = buf1.subarray(child.offset, child.offset + child.size);
      moovParts.push(data);
      moovContentSize += data.length;
    }
  }

  const moovSize = 8 + moovContentSize;
  const moovHeader = new Uint8Array(8);
  writeU32(moovHeader, 0, moovSize);
  moovHeader[4] = 0x6d; moovHeader[5] = 0x6f; moovHeader[6] = 0x6f; moovHeader[7] = 0x76;

  // Calculate final file layout: ftyp + moov + mdat
  const ftypData = ftyp ? buf1.subarray(ftyp.offset, ftyp.offset + ftyp.size) : new Uint8Array(0);
  const mdatStartOffset = ftypData.length + moovSize;

  // Adjust all stco offsets by mdatStartOffset
  // We need to find stco in the new trak buffers and update them
  adjustStcoOffsets(newVTrak, mdatStartOffset);
  if (newATrak) adjustStcoOffsets(newATrak, mdatStartOffset);

  // Update mvhd duration
  for (const part of moovParts) {
    if (part.length > 8 && boxType(part, 4) === "mvhd") {
      const { version, dataOffset } = readFullBox(part, 8);
      const mvhdTimescale = version === 1
        ? readU32(part, dataOffset + 16)
        : readU32(part, dataOffset + 8);

      // Calculate total duration in mvhd timescale
      const vTotalDur = (vDuration1 + vDuration2) / vTrack1.timescale * mvhdTimescale;
      if (version === 1) {
        writeU64(part, dataOffset + 20, Math.round(vTotalDur));
      } else {
        writeU32(part, dataOffset + 12, Math.round(vTotalDur));
      }
    }
  }

  // Assemble final file
  const totalFileSize = ftypData.length + moovSize + mdat.length;
  const result = new Uint8Array(totalFileSize);
  let writePos = 0;

  result.set(ftypData, writePos);
  writePos += ftypData.length;

  result.set(moovHeader, writePos);
  writePos += 8;
  for (const part of moovParts) {
    result.set(part, writePos);
    writePos += part.length;
  }

  result.set(mdat, writePos);

  console.log(`Output file size: ${result.length}`);
  return result;
}

function adjustStcoOffsets(trakBuf: Uint8Array, mdatFileOffset: number) {
  // Find stco or co64 inside the trak buffer
  const boxes = parseBoxes(trakBuf, 8); // skip trak header
  const stblSearch = (boxes: Box[]): void => {
    for (const box of boxes) {
      if (box.type === "stco") {
        const { dataOffset } = readFullBox(box.data, box.headerSize);
        const count = readU32(box.data, dataOffset);
        for (let i = 0; i < count; i++) {
          const off = dataOffset + 4 + i * 4;
          const oldVal = readU32(box.data, off);
          writeU32(box.data, off, oldVal + mdatFileOffset);
        }
      } else if (box.type === "co64") {
        const { dataOffset } = readFullBox(box.data, box.headerSize);
        const count = readU32(box.data, dataOffset);
        for (let i = 0; i < count; i++) {
          const off = dataOffset + 4 + i * 8;
          const oldVal = readU64(box.data, off);
          writeU64(box.data, off, oldVal + mdatFileOffset);
        }
      } else if (["moov", "trak", "mdia", "minf", "stbl"].includes(box.type)) {
        stblSearch(parseBoxes(trakBuf, box.offset + box.headerSize, box.offset + box.size));
      }
    }
  };
  stblSearch(boxes);
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { publication_id, main_video_url, back_cover_video_url } = await req.json();

    if (!publication_id) {
      return new Response(
        JSON.stringify({ error: "Missing publication_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("publications")
      .update({ publication_status: "concatenating", error_message: null })
      .eq("id", publication_id);

    // ── Resolve fresh main video URL (HeyGen signed URLs expire) ──
    let resolvedMainUrl = main_video_url;
    const { data: pubData } = await supabase
      .from("publications")
      .select("video_id")
      .eq("id", publication_id)
      .single();

    if (pubData?.video_id) {
      const { data: videoData } = await supabase
        .from("videos")
        .select("heygen_video_url, heygen_video_id, video_path")
        .eq("id", pubData.video_id)
        .single();

      if (videoData?.heygen_video_id) {
        const heygenKey = Deno.env.get("HEYGEN_API_KEY");
        if (heygenKey) {
          try {
            console.log(`Fetching fresh URL from HeyGen API for video: ${videoData.heygen_video_id}`);
            const heygenResp = await fetch(
              `https://api.heygen.com/v1/video_status.get?video_id=${videoData.heygen_video_id}`,
              { headers: { "X-Api-Key": heygenKey } }
            );
            if (heygenResp.ok) {
              const heygenData = await heygenResp.json();
              const freshUrl = heygenData?.data?.video_url;
              if (freshUrl) {
                console.log(`Got fresh HeyGen URL`);
                resolvedMainUrl = freshUrl;
                await supabase.from("videos")
                  .update({ heygen_video_url: freshUrl })
                  .eq("id", pubData.video_id);
              }
            } else {
              console.log(`HeyGen API returned ${heygenResp.status}`);
              await heygenResp.text();
            }
          } catch (e) {
            console.log(`HeyGen API error: ${e.message}`);
          }
        }
      }

      if (resolvedMainUrl === main_video_url) {
        const storedUrl = videoData?.heygen_video_url || videoData?.video_path;
        if (storedUrl) resolvedMainUrl = storedUrl;
      }
    }

    // ── No back cover — just use main video ──
    if (!back_cover_video_url) {
      console.log("No back cover, using main video as final");
      await supabase.from("publications")
        .update({ final_video_url: resolvedMainUrl, publication_status: "checked" })
        .eq("id", publication_id);
      return new Response(
        JSON.stringify({ success: true, final_video_url: resolvedMainUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Download both videos ──
    console.log("Downloading main video...");
    const mainResp = await fetch(resolvedMainUrl);
    if (!mainResp.ok) throw new Error(`Failed to download main video: ${mainResp.status}`);
    const mainBuf = new Uint8Array(await mainResp.arrayBuffer());
    console.log(`Main video downloaded: ${mainBuf.length} bytes`);

    console.log("Downloading back cover video...");
    const backResp = await fetch(back_cover_video_url);
    if (!backResp.ok) throw new Error(`Failed to download back cover: ${backResp.status}`);
    const backBuf = new Uint8Array(await backResp.arrayBuffer());
    console.log(`Back cover downloaded: ${backBuf.length} bytes`);

    // ── Concatenate ──
    console.log("Starting binary MP4 concatenation...");
    const result = concatMP4(mainBuf, backBuf);

    // ── Upload result to storage ──
    const outputPath = `concat/${publication_id}_${Date.now()}.mp4`;
    console.log(`Uploading to storage: ${outputPath}`);

    const { error: uploadError } = await supabase.storage
      .from("media-files")
      .upload(outputPath, result, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage
      .from("media-files")
      .getPublicUrl(outputPath);

    const finalUrl = urlData.publicUrl;
    console.log(`Final URL: ${finalUrl}`);

    await supabase.from("publications")
      .update({ final_video_url: finalUrl, publication_status: "checked" })
      .eq("id", publication_id);

    return new Response(
      JSON.stringify({ success: true, final_video_url: finalUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("concat-video error:", error);

    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body.publication_id) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("publications")
          .update({ publication_status: "needs_concat", error_message: error.message })
          .eq("id", body.publication_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
