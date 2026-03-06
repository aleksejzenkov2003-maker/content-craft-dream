import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──────────────────────────────────────────────────────────

function r32(d: Uint8Array, o: number) {
  return ((d[o] << 24) | (d[o+1] << 16) | (d[o+2] << 8) | d[o+3]) >>> 0;
}

function w32(d: Uint8Array, o: number, v: number) {
  d[o]   = (v >>> 24) & 0xff;
  d[o+1] = (v >>> 16) & 0xff;
  d[o+2] = (v >>> 8) & 0xff;
  d[o+3] = v & 0xff;
}

function r64(d: Uint8Array, o: number): number {
  // JS can't do real 64-bit, but for offsets < 2^53 this is fine
  const hi = r32(d, o);
  const lo = r32(d, o + 4);
  return hi * 0x100000000 + lo;
}

function w64(d: Uint8Array, o: number, v: number) {
  w32(d, o, Math.floor(v / 0x100000000));
  w32(d, o + 4, v >>> 0);
}

function ascii(d: Uint8Array, o: number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(d[o + i]);
  return s;
}

interface Box {
  type: string;
  offset: number;   // absolute offset in file
  size: number;      // total box size including header
  headerSize: number; // 8 or 16
  data: Uint8Array;  // reference to full file data
}

/** Parse top-level (or any level) boxes from a region */
function parseBoxes(data: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let pos = start;
  while (pos + 8 <= end) {
    let size = r32(data, pos);
    const type = ascii(data, pos + 4, 4);
    let headerSize = 8;
    if (size === 1) {
      // 64-bit extended size
      size = r64(data, pos + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos; // box extends to end
    }
    if (size < headerSize || pos + size > end) break;
    boxes.push({ type, offset: pos, size, headerSize, data });
    pos += size;
  }
  return boxes;
}

function findBox(boxes: Box[], type: string): Box | undefined {
  return boxes.find(b => b.type === type);
}

function getChildren(box: Box): Box[] {
  return parseBoxes(box.data, box.offset + box.headerSize, box.offset + box.size);
}

/** Get children of a full-box (has version + flags = 4 extra bytes) */
function getFullBoxChildren(box: Box): Box[] {
  return parseBoxes(box.data, box.offset + box.headerSize + 4, box.offset + box.size);
}

// ── Sample table readers ──────────────────────────────────────────

function readStsz(box: Box): { defaultSize: number; sizes: number[] } {
  const d = box.data;
  const o = box.offset + box.headerSize;
  // version(1) + flags(3) + sample_size(4) + sample_count(4)
  const defaultSize = r32(d, o + 4);
  const count = r32(d, o + 8);
  const sizes: number[] = [];
  if (defaultSize === 0) {
    for (let i = 0; i < count; i++) sizes.push(r32(d, o + 12 + i * 4));
  }
  return { defaultSize, sizes };
}

function readStts(box: Box): { count: number; delta: number }[] {
  const d = box.data;
  const o = box.offset + box.headerSize;
  const entryCount = r32(d, o + 4);
  const entries: { count: number; delta: number }[] = [];
  for (let i = 0; i < entryCount; i++) {
    entries.push({
      count: r32(d, o + 8 + i * 8),
      delta: r32(d, o + 8 + i * 8 + 4),
    });
  }
  return entries;
}

function readStsc(box: Box): { firstChunk: number; samplesPerChunk: number; sdi: number }[] {
  const d = box.data;
  const o = box.offset + box.headerSize;
  const entryCount = r32(d, o + 4);
  const entries: { firstChunk: number; samplesPerChunk: number; sdi: number }[] = [];
  for (let i = 0; i < entryCount; i++) {
    entries.push({
      firstChunk: r32(d, o + 8 + i * 12),
      samplesPerChunk: r32(d, o + 8 + i * 12 + 4),
      sdi: r32(d, o + 8 + i * 12 + 8),
    });
  }
  return entries;
}

function readStco(box: Box): { offsets: number[]; is64: boolean } {
  const d = box.data;
  const o = box.offset + box.headerSize;
  const count = r32(d, o + 4);
  const is64 = box.type === "co64";
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(is64 ? r64(d, o + 8 + i * 8) : r32(d, o + 8 + i * 4));
  }
  return { offsets, is64 };
}

function readStss(box: Box): number[] {
  const d = box.data;
  const o = box.offset + box.headerSize;
  const count = r32(d, o + 4);
  const entries: number[] = [];
  for (let i = 0; i < count; i++) entries.push(r32(d, o + 8 + i * 4));
  return entries;
}

// ── Sample table writers ──────────────────────────────────────────

function writeStsz(defaultSize: number, sizes: number[]): Uint8Array {
  const count = defaultSize === 0 ? sizes.length : sizes.length || 0;
  const realCount = defaultSize === 0 ? sizes.length : sizes.length;
  // If defaultSize > 0, sizes array might be empty — all samples same size
  const sampleCount = defaultSize > 0 ? realCount : sizes.length;
  const entryBytes = defaultSize === 0 ? sizes.length * 4 : 0;
  const totalSize = 12 + 12 + entryBytes; // box header(8) + fullbox(4) + defaultSize(4) + count(4) + entries
  const buf = new Uint8Array(totalSize);
  w32(buf, 0, totalSize);
  buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x73; buf[7] = 0x7A; // "stsz"
  // version + flags = 0
  w32(buf, 12, defaultSize);
  w32(buf, 16, sampleCount);
  if (defaultSize === 0) {
    for (let i = 0; i < sizes.length; i++) w32(buf, 20 + i * 4, sizes[i]);
  }
  return buf;
}

function writeStts(entries: { count: number; delta: number }[]): Uint8Array {
  const totalSize = 8 + 4 + 4 + entries.length * 8;
  const buf = new Uint8Array(totalSize);
  w32(buf, 0, totalSize);
  buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x74; buf[7] = 0x73; // "stts"
  w32(buf, 12, entries.length);
  for (let i = 0; i < entries.length; i++) {
    w32(buf, 16 + i * 8, entries[i].count);
    w32(buf, 16 + i * 8 + 4, entries[i].delta);
  }
  return buf;
}

function writeStsc(entries: { firstChunk: number; samplesPerChunk: number; sdi: number }[]): Uint8Array {
  const totalSize = 8 + 4 + 4 + entries.length * 12;
  const buf = new Uint8Array(totalSize);
  w32(buf, 0, totalSize);
  buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x73; buf[7] = 0x63; // "stsc"
  w32(buf, 12, entries.length);
  for (let i = 0; i < entries.length; i++) {
    w32(buf, 16 + i * 12, entries[i].firstChunk);
    w32(buf, 16 + i * 12 + 4, entries[i].samplesPerChunk);
    w32(buf, 16 + i * 12 + 8, entries[i].sdi);
  }
  return buf;
}

function writeStco(offsets: number[], use64: boolean): Uint8Array {
  const entrySize = use64 ? 8 : 4;
  const totalSize = 8 + 4 + 4 + offsets.length * entrySize;
  const buf = new Uint8Array(totalSize);
  w32(buf, 0, totalSize);
  if (use64) {
    buf[4] = 0x63; buf[5] = 0x6F; buf[6] = 0x36; buf[7] = 0x34; // "co64"
  } else {
    buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x63; buf[7] = 0x6F; // "stco"
  }
  w32(buf, 12, offsets.length);
  for (let i = 0; i < offsets.length; i++) {
    if (use64) w64(buf, 16 + i * 8, offsets[i]);
    else w32(buf, 16 + i * 4, offsets[i]);
  }
  return buf;
}

function writeStss(entries: number[]): Uint8Array {
  const totalSize = 8 + 4 + 4 + entries.length * 4;
  const buf = new Uint8Array(totalSize);
  w32(buf, 0, totalSize);
  buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x73; buf[7] = 0x73; // "stss"
  w32(buf, 12, entries.length);
  for (let i = 0; i < entries.length; i++) w32(buf, 16 + i * 4, entries[i]);
  return buf;
}

// ── stsd helpers ──────────────────────────────────────────────────

function extractStsdEntries(stsdBox: Box): Uint8Array[] {
  const entries: Uint8Array[] = [];
  const entriesStart = stsdBox.offset + stsdBox.headerSize + 8; // fullbox(4) + entry_count(4)
  const entriesEnd = stsdBox.offset + stsdBox.size;
  let pos = entriesStart;

  while (pos + 8 <= entriesEnd) {
    const size = r32(stsdBox.data, pos);
    if (size < 8 || pos + size > entriesEnd) break;
    entries.push(stsdBox.data.slice(pos, pos + size));
    pos += size;
  }

  return entries;
}

function buildStsdFromEntries(entries: Uint8Array[]): Uint8Array {
  const entriesSize = entries.reduce((sum, e) => sum + e.length, 0);
  const totalSize = 8 + 4 + 4 + entriesSize; // header + fullbox + entry_count + entries
  const buf = new Uint8Array(totalSize);
  w32(buf, 0, totalSize);
  buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x73; buf[7] = 0x64; // "stsd"
  // version + flags = 0
  w32(buf, 12, entries.length);

  let pos = 16;
  for (const entry of entries) {
    buf.set(entry, pos);
    pos += entry.length;
  }

  return buf;
}

interface StsdMergeResult {
  merged: Uint8Array;
  entryCount1: number;
  entryCount2: number;
  mapSdiFile2: (sdi: number) => number;
  dedupedForCompatibility: boolean;
}

function mergeStsd(stsd1Box: Box, stsd2Box: Box, handlerType: string): StsdMergeResult {
  const entries1 = extractStsdEntries(stsd1Box);
  const entries2 = extractStsdEntries(stsd2Box);
  const entryCount1 = entries1.length;
  const entryCount2 = entries2.length;

  // For audio: ALWAYS use file1's stsd to avoid mid-track codec switching issues.
  // Timescale rescaling (done in concatMP4) ensures file2 samples decode correctly.
  if (handlerType === "soun") {
    const e1 = entries1[0];
    const e2 = entries2.length > 0 ? entries2[0] : null;
    let identical = false;
    if (e2 && e1.length === e2.length) {
      identical = true;
      for (let i = 0; i < e1.length; i++) {
        if (e1[i] !== e2[i]) { identical = false; break; }
      }
    }
    if (identical) {
      console.log(`Track soun: stsd entries are truly identical (${e1.length} bytes)`);
    } else {
      console.log(`Track soun: stsd entries DIFFER — forcing file1 stsd for all audio (timescale will be rescaled)`);
      if (e2) {
        const hex = (arr: Uint8Array) => Array.from(arr.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`  entry1 head: ${hex(e1)}`);
        console.log(`  entry2 head: ${hex(e2)}`);
      }
    }
    return {
      merged: buildStsdFromEntries(entries1),
      entryCount1,
      entryCount2,
      mapSdiFile2: () => 1,
      dedupedForCompatibility: true,
    };
  }

  const mergedEntries = [...entries1, ...entries2];
  return {
    merged: buildStsdFromEntries(mergedEntries),
    entryCount1,
    entryCount2,
    mapSdiFile2: (sdi: number) => sdi + entryCount1,
    dedupedForCompatibility: false,
  };
}

// ── Track info extraction ──────────────────────────────────────────

interface TrackInfo {
  trakBox: Box;
  handlerType: string; // "vide" or "soun"
  timescale: number;
  duration: number;
  stsz: { defaultSize: number; sizes: number[] };
  stts: { count: number; delta: number }[];
  stsc: { firstChunk: number; samplesPerChunk: number; sdi: number }[];
  stco: { offsets: number[]; is64: boolean };
  stss: number[] | null; // null if no stss (all samples are sync)
  sampleCount: number;
  chunkCount: number;
  stblBox: Box;
  stsdBox: Box; // reference to stsd box for merging
}

function extractTrackInfo(trakBox: Box): TrackInfo {
  const trakChildren = getChildren(trakBox);
  const mdiaBox = findBox(trakChildren, "mdia")!;
  const mdiaChildren = getChildren(mdiaBox);

  // Handler type
  const hdlrBox = findBox(mdiaChildren, "hdlr")!;
  const handlerType = ascii(hdlrBox.data, hdlrBox.offset + hdlrBox.headerSize + 8, 4);

  // Timescale & duration from mdhd
  const mdhdBox = findBox(mdiaChildren, "mdhd")!;
  const mdhdO = mdhdBox.offset + mdhdBox.headerSize;
  const mdhdVersion = mdhdBox.data[mdhdO];
  let timescale: number, duration: number;
  if (mdhdVersion === 1) {
    timescale = r32(mdhdBox.data, mdhdO + 20);
    duration = r64(mdhdBox.data, mdhdO + 24);
  } else {
    timescale = r32(mdhdBox.data, mdhdO + 12);
    duration = r32(mdhdBox.data, mdhdO + 16);
  }

  // stbl
  const minfBox = findBox(mdiaChildren, "minf")!;
  const minfChildren = getChildren(minfBox);
  const stblBox = findBox(minfChildren, "stbl")!;
  const stblChildren = getChildren(stblBox);

  const stsdBox = findBox(stblChildren, "stsd")!;
  const stszBox = findBox(stblChildren, "stsz")!;
  const sttsBox = findBox(stblChildren, "stts")!;
  const stscBox = findBox(stblChildren, "stsc")!;
  const stcoBox = findBox(stblChildren, "stco") || findBox(stblChildren, "co64")!;
  const stssBox = findBox(stblChildren, "stss") || null;

  const stsz = readStsz(stszBox);
  const stts = readStts(sttsBox);
  const stsc = readStsc(stscBox);
  const stco = readStco(stcoBox);
  const stss = stssBox ? readStss(stssBox) : null;

  const sampleCount = stsz.defaultSize > 0
    ? stts.reduce((sum, e) => sum + e.count, 0)
    : stsz.sizes.length;

  return {
    trakBox, handlerType, timescale, duration,
    stsz, stts, stsc, stco, stss,
    sampleCount,
    chunkCount: stco.offsets.length,
    stblBox,
    stsdBox,
  };
}

// ── Rebuild stbl replacing sample tables ──────────────────────────

function rebuildStbl(
  origStbl: Box,
  newStsz: Uint8Array,
  newStts: Uint8Array,
  newStsc: Uint8Array,
  newStco: Uint8Array,
  newStss: Uint8Array | null,
  newStsd: Uint8Array | null = null,
): Uint8Array {
  const children = getChildren(origStbl);
  const parts: Uint8Array[] = [];

  for (const child of children) {
    if (child.type === "stsd") {
      parts.push(newStsd || child.data.slice(child.offset, child.offset + child.size));
      continue;
    }
    if (child.type === "stsz") { parts.push(newStsz); continue; }
    if (child.type === "stts") { parts.push(newStts); continue; }
    if (child.type === "stsc") { parts.push(newStsc); continue; }
    if (child.type === "stco" || child.type === "co64") { parts.push(newStco); continue; }
    if (child.type === "stss") {
      if (newStss) parts.push(newStss);
      continue;
    }
    // Copy other boxes as-is
    parts.push(child.data.slice(child.offset, child.offset + child.size));
  }

  // If original had no stss but we need one
  if (newStss && !findBox(children, "stss")) {
    parts.push(newStss);
  }

  const bodySize = parts.reduce((s, p) => s + p.length, 0);
  const totalSize = 8 + bodySize;
  const buf = new Uint8Array(totalSize);
  w32(buf, 0, totalSize);
  buf[4] = 0x73; buf[5] = 0x74; buf[6] = 0x62; buf[7] = 0x6C; // "stbl"
  let pos = 8;
  for (const p of parts) { buf.set(p, pos); pos += p.length; }
  return buf;
}

// ── Rebuild a container box replacing one child ──────────────────

function rebuildContainer(box: Box, replacements: Map<string, Uint8Array>, isFullBox = false): Uint8Array {
  const extraOffset = isFullBox ? 4 : 0;
  const children = parseBoxes(box.data, box.offset + box.headerSize + extraOffset, box.offset + box.size);
  const parts: Uint8Array[] = [];

  // Copy header bytes (for full boxes includes version+flags)
  if (isFullBox) {
    parts.push(box.data.slice(box.offset + box.headerSize, box.offset + box.headerSize + 4));
  }

  for (const child of children) {
    const replacement = replacements.get(child.type);
    if (replacement) {
      parts.push(replacement);
    } else {
      parts.push(child.data.slice(child.offset, child.offset + child.size));
    }
  }

  const bodySize = parts.reduce((s, p) => s + p.length, 0);
  const totalSize = 8 + bodySize;
  const buf = new Uint8Array(totalSize);
  w32(buf, 0, totalSize);
  // Copy box type
  buf.set(box.data.slice(box.offset + 4, box.offset + 8), 4);
  let pos = 8;
  for (const p of parts) { buf.set(p, pos); pos += p.length; }
  return buf;
}

// ── Update duration in mvhd ──────────────────────────────────────

function updateMvhd(mvhdBox: Box, newDuration: number): Uint8Array {
  const copy = mvhdBox.data.slice(mvhdBox.offset, mvhdBox.offset + mvhdBox.size);
  const o = mvhdBox.headerSize;
  const version = copy[o];
  if (version === 1) {
    w64(copy, o + 24, newDuration);
  } else {
    w32(copy, o + 16, newDuration);
  }
  return copy;
}

// ── Update duration in tkhd ──────────────────────────────────────

function updateTkhd(tkhdBox: Box, newDuration: number): Uint8Array {
  const copy = tkhdBox.data.slice(tkhdBox.offset, tkhdBox.offset + tkhdBox.size);
  const o = tkhdBox.headerSize;
  const version = copy[o];
  if (version === 1) {
    w64(copy, o + 28, newDuration);
  } else {
    w32(copy, o + 20, newDuration);
  }
  return copy;
}

// ── Update duration in mdhd ──────────────────────────────────────

function updateMdhd(mdhdBox: Box, newDuration: number): Uint8Array {
  const copy = mdhdBox.data.slice(mdhdBox.offset, mdhdBox.offset + mdhdBox.size);
  const o = mdhdBox.headerSize;
  const version = copy[o];
  if (version === 1) {
    w64(copy, o + 24, newDuration);
  } else {
    w32(copy, o + 16, newDuration);
  }
  return copy;
}

// ── Main concat logic ──────────────────────────────────────────────

function concatMP4(file1: Uint8Array, file2: Uint8Array): Uint8Array {
  console.log("Parsing file 1...");
  const boxes1 = parseBoxes(file1, 0, file1.length);
  console.log("Parsing file 2...");
  const boxes2 = parseBoxes(file2, 0, file2.length);

  const ftyp1 = findBox(boxes1, "ftyp")!;
  const moov1 = findBox(boxes1, "moov")!;
  const mdat1 = findBox(boxes1, "mdat")!;
  const moov2 = findBox(boxes2, "moov")!;
  const mdat2 = findBox(boxes2, "mdat")!;

  console.log(`File1: ftyp=${ftyp1.size}, moov=${moov1.size}, mdat=${mdat1.size}`);
  console.log(`File2: moov=${moov2.size}, mdat=${mdat2.size}`);

  // Extract tracks
  const moov1Children = getChildren(moov1);
  const moov2Children = getChildren(moov2);

  const traks1 = moov1Children.filter(b => b.type === "trak").map(extractTrackInfo);
  const traks2 = moov2Children.filter(b => b.type === "trak").map(extractTrackInfo);

  console.log(`File1 tracks: ${traks1.map(t => t.handlerType).join(", ")}`);
  console.log(`File2 tracks: ${traks2.map(t => t.handlerType).join(", ")}`);

  // Match tracks by handler type
  const matchedTracks: { t1: TrackInfo; t2: TrackInfo }[] = [];
  for (const t1 of traks1) {
    const t2 = traks2.find(t => t.handlerType === t1.handlerType);
    if (t2) matchedTracks.push({ t1, t2 });
  }

  // Combined mdat: data from both mdats (excluding headers)
  const mdat1Data = file1.slice(mdat1.offset + mdat1.headerSize, mdat1.offset + mdat1.size);
  const mdat2Data = file2.slice(mdat2.offset + mdat2.headerSize, mdat2.offset + mdat2.size);

  // Output layout: ftyp + moov(rebuilt) + mdat(combined)
  // We need to know the moov size first to calculate chunk offsets.
  // Do two passes: first build moov to know its size, then fix offsets.

  const ftypData = file1.slice(ftyp1.offset, ftyp1.offset + ftyp1.size);

  // Build combined mdat
  const combinedMdatSize = 8 + mdat1Data.length + mdat2Data.length;
  const combinedMdat = new Uint8Array(combinedMdatSize);
  w32(combinedMdat, 0, combinedMdatSize);
  combinedMdat[4] = 0x6D; combinedMdat[5] = 0x64; combinedMdat[6] = 0x61; combinedMdat[7] = 0x74; // "mdat"
  combinedMdat.set(mdat1Data, 8);
  combinedMdat.set(mdat2Data, 8 + mdat1Data.length);

  // Offset where mdat1 data starts in the original file
  const origMdat1DataStart = mdat1.offset + mdat1.headerSize;
  // Offset where mdat2 data starts in the original file2
  const origMdat2DataStart = mdat2.offset + mdat2.headerSize;

  // We need to rebuild moov. First pass: estimate moov size roughly,
  // then calculate exact offsets.
  // The mdat will come after ftyp + moov in the output.

  // Build new trak boxes
  const mvhdBox = findBox(moov1Children, "mvhd")!;
  const mvhdO = mvhdBox.offset + mvhdBox.headerSize;
  const mvhdVersion = mvhdBox.data[mvhdO];
  const mvhdTimescale = mvhdVersion === 1 ? r32(mvhdBox.data, mvhdO + 20) : r32(mvhdBox.data, mvhdO + 12);

  // We'll do a two-pass approach to get correct offsets
  function buildMoov(mdatAbsoluteOffset: number): Uint8Array {
    const newTrakBuffers: Uint8Array[] = [];
    let maxDurationInMvhdTimescale = 0;

    for (const { t1, t2 } of matchedTracks) {
      // Merge sample sizes
      let mergedStsz: { defaultSize: number; sizes: number[] };
      if (t1.stsz.defaultSize > 0 && t2.stsz.defaultSize > 0 && t1.stsz.defaultSize === t2.stsz.defaultSize) {
        // Both have same default size — keep it
        const totalCount = t1.sampleCount + t2.sampleCount;
        mergedStsz = { defaultSize: t1.stsz.defaultSize, sizes: new Array(totalCount) };
      } else {
        // Expand to per-sample sizes
        const sizes1 = t1.stsz.defaultSize > 0
          ? new Array(t1.sampleCount).fill(t1.stsz.defaultSize)
          : t1.stsz.sizes;
        const sizes2 = t2.stsz.defaultSize > 0
          ? new Array(t2.sampleCount).fill(t2.stsz.defaultSize)
          : t2.stsz.sizes;
        mergedStsz = { defaultSize: 0, sizes: [...sizes1, ...sizes2] };
      }

      // Merge stts
      const mergedStts = [...t1.stts, ...t2.stts];

      // Merge stsd (sample descriptions) from both tracks
      const stsdMerge = mergeStsd(t1.stsdBox, t2.stsdBox, t1.handlerType);
      const mergedStsdBuf = stsdMerge.merged;
      if (stsdMerge.dedupedForCompatibility) {
        console.log(`Track ${t1.handlerType}: deduped identical stsd entries for decoder compatibility`);
      } else {
        console.log(`Track ${t1.handlerType}: merging stsd entries: ${stsdMerge.entryCount1} + ${stsdMerge.entryCount2} = ${stsdMerge.entryCount1 + stsdMerge.entryCount2}`);
      }

      // Merge stsc — shift file2 chunk indices and remap sample-description indices
      const chunkOffset2 = t1.chunkCount;
      const mergedStsc = [
        ...t1.stsc,
        ...t2.stsc.map(e => ({
          firstChunk: e.firstChunk + chunkOffset2,
          samplesPerChunk: e.samplesPerChunk,
          sdi: stsdMerge.mapSdiFile2(e.sdi),
        })),
      ];

      // Merge chunk offsets with correct absolute positions
      // file1 chunks: offset was relative to original file, now relative to new mdat
      const newOffsets1 = t1.stco.offsets.map(o => {
        const relativeToMdat1 = o - origMdat1DataStart;
        return mdatAbsoluteOffset + 8 + relativeToMdat1; // 8 = mdat box header
      });

      const newOffsets2 = t2.stco.offsets.map(o => {
        const relativeToMdat2 = o - origMdat2DataStart;
        return mdatAbsoluteOffset + 8 + mdat1Data.length + relativeToMdat2;
      });

      const mergedOffsets = [...newOffsets1, ...newOffsets2];
      const use64 = mergedOffsets.some(o => o > 0xFFFFFFFF);

      // Merge stss (sync samples / keyframes)
      let mergedStss: number[] | null = null;
      if (t1.stss || t2.stss) {
        const ss1 = t1.stss || Array.from({ length: t1.sampleCount }, (_, i) => i + 1);
        const ss2 = t2.stss || Array.from({ length: t2.sampleCount }, (_, i) => i + 1);
        mergedStss = [...ss1, ...ss2.map(s => s + t1.sampleCount)];
      }

      // Combined duration in track's timescale
      const newTrackDuration = t1.duration + t2.duration;
      // Convert to mvhd timescale
      const durationInMvhdTs = Math.round(newTrackDuration * mvhdTimescale / t1.timescale);
      if (durationInMvhdTs > maxDurationInMvhdTimescale) maxDurationInMvhdTimescale = durationInMvhdTs;

      // Build new sample table buffers
      const newStszBuf = writeStsz(mergedStsz.defaultSize, mergedStsz.sizes);
      const newSttsBuf = writeStts(mergedStts);
      const newStscBuf = writeStsc(mergedStsc);
      const newStcoBuf = writeStco(mergedOffsets, use64);
      const newStssBuf = mergedStss ? writeStss(mergedStss) : null;

      // Rebuild stbl
      const newStbl = rebuildStbl(t1.stblBox, newStszBuf, newSttsBuf, newStscBuf, newStcoBuf, newStssBuf, mergedStsdBuf);

      // Rebuild minf → stbl
      const trakChildren = getChildren(t1.trakBox);
      const mdiaBox = findBox(trakChildren, "mdia")!;
      const mdiaChildren = getChildren(mdiaBox);
      const minfBox = findBox(mdiaChildren, "minf")!;

      // Update mdhd duration
      const mdhdBox = findBox(mdiaChildren, "mdhd")!;
      const newMdhd = updateMdhd(mdhdBox, newTrackDuration);

      // Update tkhd duration (in mvhd timescale)
      const tkhdBox = findBox(trakChildren, "tkhd")!;
      const newTkhd = updateTkhd(tkhdBox, durationInMvhdTs);

      // Rebuild minf with new stbl
      const newMinf = rebuildContainer(minfBox, new Map([["stbl", newStbl]]));

      // Rebuild mdia with new minf and mdhd
      const newMdia = rebuildContainer(mdiaBox, new Map([["minf", newMinf], ["mdhd", newMdhd]]));

      // Rebuild trak with new tkhd and mdia
      const newTrak = rebuildContainer(t1.trakBox, new Map([["mdia", newMdia], ["tkhd", newTkhd]]));

      newTrakBuffers.push(newTrak);
    }

    // Update mvhd duration
    const newMvhd = updateMvhd(mvhdBox, maxDurationInMvhdTimescale);

    // Rebuild moov: mvhd + new traks + other boxes (udta, etc.)
    const moovParts: Uint8Array[] = [newMvhd];
    let trakIdx = 0;
    for (const child of moov1Children) {
      if (child.type === "mvhd") continue; // already added
      if (child.type === "trak") {
        if (trakIdx < newTrakBuffers.length) {
          moovParts.push(newTrakBuffers[trakIdx]);
          trakIdx++;
        }
        continue;
      }
      // Copy other boxes (udta, etc.)
      moovParts.push(child.data.slice(child.offset, child.offset + child.size));
    }

    const moovBodySize = moovParts.reduce((s, p) => s + p.length, 0);
    const moovTotalSize = 8 + moovBodySize;
    const moovBuf = new Uint8Array(moovTotalSize);
    w32(moovBuf, 0, moovTotalSize);
    moovBuf[4] = 0x6D; moovBuf[5] = 0x6F; moovBuf[6] = 0x6F; moovBuf[7] = 0x76; // "moov"
    let pos = 8;
    for (const p of moovParts) { moovBuf.set(p, pos); pos += p.length; }
    return moovBuf;
  }

  // First pass: estimate moov size
  const estimatedMoov = buildMoov(ftypData.length + 1000000); // dummy offset
  const moovSize = estimatedMoov.length;

  // Now we know: output = ftyp + moov + mdat
  const mdatOffset = ftypData.length + moovSize;

  // Second pass with correct offset
  const finalMoov = buildMoov(mdatOffset);

  // Assemble output
  console.log(`Output: ftyp=${ftypData.length}, moov=${finalMoov.length}, mdat=${combinedMdat.length}`);
  const output = new Uint8Array(ftypData.length + finalMoov.length + combinedMdat.length);
  output.set(ftypData, 0);
  output.set(finalMoov, ftypData.length);
  output.set(combinedMdat, ftypData.length + finalMoov.length);

  console.log(`Total output: ${output.length} bytes`);
  return output;
}

// ── Edge Function handler ──────────────────────────────────────────

async function downloadVideo(url: string): Promise<Uint8Array> {
  console.log(`Downloading: ${url.substring(0, 100)}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  console.log(`Downloaded ${buffer.byteLength} bytes`);
  return new Uint8Array(buffer);
}

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

    // No back cover — just use main video
    if (!back_cover_video_url) {
      console.log("No back cover, using main video as final");
      await supabase.from("publications")
        .update({ final_video_url: main_video_url, publication_status: "checked" })
        .eq("id", publication_id);
      return new Response(
        JSON.stringify({ success: true, final_video_url: main_video_url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const mainVideo = await downloadVideo(main_video_url);
    const backCoverVideo = await downloadVideo(back_cover_video_url);

    console.log("Starting MP4 atom-level concatenation...");
    const combined = concatMP4(mainVideo, backCoverVideo);
    console.log("Concatenation complete!");

    // Upload to storage
    const fileName = `concat/${publication_id}_${Date.now()}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from("media-files")
      .upload(fileName, combined.buffer, { contentType: "video/mp4", upsert: true });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage
      .from("media-files")
      .getPublicUrl(fileName);

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
