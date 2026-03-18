import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── MP4 helpers ──

function r32(b: Uint8Array, o: number) { return ((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0; }
function w32(b: Uint8Array, o: number, v: number) { b[o]=(v>>>24)&0xff; b[o+1]=(v>>>16)&0xff; b[o+2]=(v>>>8)&0xff; b[o+3]=v&0xff; }
function r64(b: Uint8Array, o: number) { return r32(b,o)*0x100000000+r32(b,o+4); }
function w64(b: Uint8Array, o: number, v: number) { w32(b,o,Math.floor(v/0x100000000)); w32(b,o+4,v>>>0); }
function tag(b: Uint8Array, o: number) { return String.fromCharCode(b[o],b[o+1],b[o+2],b[o+3]); }
function wtag(b: Uint8Array, o: number, s: string) { for(let i=0;i<4;i++) b[o+i]=s.charCodeAt(i); }

function concat(a: Uint8Array, ...parts: Uint8Array[]): Uint8Array {
  let total = a.length;
  for (const p of parts) total += p.length;
  const r = new Uint8Array(total);
  r.set(a, 0);
  let off = a.length;
  for (const p of parts) { r.set(p, off); off += p.length; }
  return r;
}

interface Box { type: string; off: number; sz: number; hdr: number; }

function listBoxes(b: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let p = start;
  while (p < end - 7) {
    let sz = r32(b, p);
    const type = tag(b, p + 4);
    let hdr = 8;
    if (sz === 1) { sz = r64(b, p + 8); hdr = 16; }
    else if (sz === 0) sz = end - p;
    if (sz < hdr || p + sz > end) break;
    boxes.push({ type, off: p, sz, hdr });
    p += sz;
  }
  return boxes;
}

function findBox(b: Uint8Array, path: string[], start: number, end: number): Box | null {
  let boxes = listBoxes(b, start, end);
  for (let i = 0; i < path.length; i++) {
    const f = boxes.find(x => x.type === path[i]);
    if (!f) return null;
    if (i === path.length - 1) return f;
    boxes = listBoxes(b, f.off + f.hdr, f.off + f.sz);
  }
  return null;
}

// ── Sample table parsing ──

interface SttsEntry { count: number; delta: number; }
interface StscEntry { firstChunk: number; samplesPerChunk: number; descIdx: number; }

function parseStts(b: Uint8Array, box: Box): SttsEntry[] {
  const off = box.off + box.hdr + 4; // skip version/flags
  const n = r32(b, off);
  const entries: SttsEntry[] = [];
  for (let i = 0; i < n; i++) entries.push({ count: r32(b, off+4+i*8), delta: r32(b, off+4+i*8+4) });
  return entries;
}

function parseStsz(b: Uint8Array, box: Box): { fixed: number; sizes: number[] } {
  const off = box.off + box.hdr + 4;
  const fixed = r32(b, off);
  const n = r32(b, off + 4);
  const sizes: number[] = [];
  if (fixed === 0) for (let i = 0; i < n; i++) sizes.push(r32(b, off + 8 + i*4));
  else for (let i = 0; i < n; i++) sizes.push(fixed);
  return { fixed, sizes };
}

function parseStsc(b: Uint8Array, box: Box): StscEntry[] {
  const off = box.off + box.hdr + 4;
  const n = r32(b, off);
  const entries: StscEntry[] = [];
  for (let i = 0; i < n; i++) {
    entries.push({
      firstChunk: r32(b, off+4+i*12),
      samplesPerChunk: r32(b, off+4+i*12+4),
      descIdx: r32(b, off+4+i*12+8),
    });
  }
  return entries;
}

function parseStco(b: Uint8Array, box: Box): { is64: boolean; offsets: number[] } {
  const is64 = box.type === "co64";
  const off = box.off + box.hdr + 4;
  const n = r32(b, off);
  const offsets: number[] = [];
  for (let i = 0; i < n; i++)
    offsets.push(is64 ? r64(b, off+4+i*8) : r32(b, off+4+i*4));
  return { is64, offsets };
}

function parseStss(b: Uint8Array, box: Box): number[] {
  const off = box.off + box.hdr + 4;
  const n = r32(b, off);
  const samples: number[] = [];
  for (let i = 0; i < n; i++) samples.push(r32(b, off + 4 + i*4));
  return samples;
}

function parseCtts(b: Uint8Array, box: Box): { count: number; offset: number }[] {
  const off = box.off + box.hdr + 4;
  const n = r32(b, off);
  const entries: { count: number; offset: number }[] = [];
  for (let i = 0; i < n; i++) entries.push({ count: r32(b, off+4+i*8), offset: r32(b, off+4+i*8+4) });
  return entries;
}

// ── Build box helpers ──

function makeBox(type: string, payload: Uint8Array): Uint8Array {
  const buf = new Uint8Array(8 + payload.length);
  w32(buf, 0, buf.length);
  wtag(buf, 4, type);
  buf.set(payload, 8);
  return buf;
}

function makeFullBox(type: string, version: number, flags: number, payload: Uint8Array): Uint8Array {
  const buf = new Uint8Array(12 + payload.length);
  w32(buf, 0, buf.length);
  wtag(buf, 4, type);
  buf[8] = version;
  buf[9] = (flags >> 16) & 0xff;
  buf[10] = (flags >> 8) & 0xff;
  buf[11] = flags & 0xff;
  buf.set(payload, 12);
  return buf;
}

function buildStts(entries: SttsEntry[]): Uint8Array {
  const payload = new Uint8Array(4 + entries.length * 8);
  w32(payload, 0, entries.length);
  for (let i = 0; i < entries.length; i++) {
    w32(payload, 4 + i*8, entries[i].count);
    w32(payload, 4 + i*8 + 4, entries[i].delta);
  }
  return makeFullBox("stts", 0, 0, payload);
}

function buildStsz(sizes: number[]): Uint8Array {
  const payload = new Uint8Array(8 + sizes.length * 4);
  w32(payload, 0, 0); // variable size
  w32(payload, 4, sizes.length);
  for (let i = 0; i < sizes.length; i++) w32(payload, 8 + i*4, sizes[i]);
  return makeFullBox("stsz", 0, 0, payload);
}

function buildStsc(totalSamples: number): Uint8Array {
  // One sample per chunk = simplest mapping
  const payload = new Uint8Array(4 + 12);
  w32(payload, 0, 1); // 1 entry
  w32(payload, 4, 1); // first_chunk = 1
  w32(payload, 8, 1); // samples_per_chunk = 1
  w32(payload, 12, 1); // sample_description_index = 1
  return makeFullBox("stsc", 0, 0, payload);
}

function buildStco(offsets: number[]): Uint8Array {
  const use64 = offsets.some(o => o > 0xFFFFFFFF);
  if (use64) {
    const payload = new Uint8Array(4 + offsets.length * 8);
    w32(payload, 0, offsets.length);
    for (let i = 0; i < offsets.length; i++) w64(payload, 4 + i*8, offsets[i]);
    return makeFullBox("co64", 0, 0, payload);
  }
  const payload = new Uint8Array(4 + offsets.length * 4);
  w32(payload, 0, offsets.length);
  for (let i = 0; i < offsets.length; i++) w32(payload, 4 + i*4, offsets[i]);
  return makeFullBox("stco", 0, 0, payload);
}

function buildStss(syncSamples: number[]): Uint8Array {
  const payload = new Uint8Array(4 + syncSamples.length * 4);
  w32(payload, 0, syncSamples.length);
  for (let i = 0; i < syncSamples.length; i++) w32(payload, 4 + i*4, syncSamples[i]);
  return makeFullBox("stss", 0, 0, payload);
}

function buildCtts(entries: { count: number; offset: number }[]): Uint8Array {
  const payload = new Uint8Array(4 + entries.length * 8);
  w32(payload, 0, entries.length);
  for (let i = 0; i < entries.length; i++) {
    w32(payload, 4 + i*8, entries[i].count);
    w32(payload, 4 + i*8 + 4, entries[i].offset);
  }
  return makeFullBox("ctts", 0, 0, payload);
}

// ── Build moov hierarchy from scratch ──

function buildMvhd(timescale: number, duration: number): Uint8Array {
  // version 0 mvhd payload: 96 bytes
  // [0-3] creation_time, [4-7] modification_time, [8-11] timescale, [12-15] duration
  // [16-19] rate=1.0, [20-21] volume=1.0, [22-31] reserved
  // [32-67] matrix (36 bytes), [68-91] pre_defined (24 bytes), [92-95] next_track_ID
  const p = new Uint8Array(96);
  w32(p, 8, timescale);
  w32(p, 12, duration);
  w32(p, 16, 0x00010000); // rate = 1.0
  p[20] = 0x01; p[21] = 0x00; // volume = 1.0
  const matrix = [0x00010000,0,0,0,0x00010000,0,0,0,0x40000000];
  for (let i = 0; i < 9; i++) w32(p, 32 + i*4, matrix[i]);
  w32(p, 92, 3); // next_track_ID
  return makeFullBox("mvhd", 0, 0, p);
}

function buildTkhd(trackId: number, duration: number, width: number, height: number, isAudio: boolean): Uint8Array {
  // version 0 tkhd payload: 80 bytes
  // [0-3] creation_time, [4-7] modification_time, [8-11] track_id, [12-15] reserved
  // [16-19] duration, [20-27] reserved, [28-29] layer, [30-31] alternate_group
  // [32-33] volume, [34-35] reserved, [36-71] matrix (36 bytes)
  // [72-75] width (16.16), [76-79] height (16.16)
  const p = new Uint8Array(80);
  w32(p, 8, trackId);
  w32(p, 16, duration);
  if (isAudio) { p[32] = 0x01; p[33] = 0x00; } // volume = 1.0
  const matrix = [0x00010000,0,0,0,0x00010000,0,0,0,0x40000000];
  for (let i = 0; i < 9; i++) w32(p, 36 + i*4, matrix[i]);
  w32(p, 72, width << 16);
  w32(p, 76, height << 16);
  const flags = isAudio ? 1 : 3; // track_enabled + track_in_movie
  return makeFullBox("tkhd", 0, flags, p);
}

function buildMdhd(timescale: number, duration: number): Uint8Array {
  const p = new Uint8Array(20);
  w32(p, 0, 0); // creation_time
  w32(p, 4, 0); // modification_time
  w32(p, 8, timescale);
  w32(p, 12, duration);
  w32(p, 16, 0x55C40000); // language = und
  return makeFullBox("mdhd", 0, 0, p);
}

function buildHdlr(handlerType: string, name: string): Uint8Array {
  const nameBytes = new TextEncoder().encode(name + "\0");
  const p = new Uint8Array(20 + nameBytes.length);
  // pre_defined = 0
  wtag(p, 4, handlerType);
  // reserved 12 bytes
  p.set(nameBytes, 20);
  return makeFullBox("hdlr", 0, 0, p);
}

function buildSmhd(): Uint8Array {
  return makeFullBox("smhd", 0, 0, new Uint8Array(4)); // balance=0, reserved=0
}

function buildVmhd(): Uint8Array {
  return makeFullBox("vmhd", 0, 1, new Uint8Array(8)); // graphicsmode=0, opcolor=0,0,0
}

function buildDinf(): Uint8Array {
  const urlBox = makeFullBox("url ", 0, 1, new Uint8Array(0));
  const drefPl = new Uint8Array(4 + urlBox.length);
  w32(drefPl, 0, 1); // entry count = 1
  drefPl.set(urlBox, 4);
  const dref = makeFullBox("dref", 0, 0, drefPl);
  return makeBox("dinf", dref);
}

function buildStbl(
  stsdData: Uint8Array, // Copy from original
  stts: Uint8Array,
  stsz: Uint8Array,
  stsc: Uint8Array,
  stco: Uint8Array,
  stss?: Uint8Array,
  ctts?: Uint8Array,
): Uint8Array {
  let total = stsdData.length + stts.length + stsz.length + stsc.length + stco.length;
  if (stss) total += stss.length;
  if (ctts) total += ctts.length;

  const parts = [stsdData, stts, stsc, stsz, stco];
  if (stss) parts.push(stss);
  if (ctts) parts.push(ctts);

  let payload = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { payload.set(p, off); off += p.length; }
  return makeBox("stbl", payload);
}

// ── Extract samples ──

function extractSamples(buf: Uint8Array, stco: { offsets: number[] }, stsc: StscEntry[], sizes: number[]): Uint8Array[] {
  const samples: Uint8Array[] = [];
  let sampleIdx = 0;
  for (let ci = 0; ci < stco.offsets.length; ci++) {
    const chunkNum = ci + 1;
    let spc = 1;
    for (let si = stsc.length - 1; si >= 0; si--) {
      if (chunkNum >= stsc[si].firstChunk) { spc = stsc[si].samplesPerChunk; break; }
    }
    let off = stco.offsets[ci];
    for (let s = 0; s < spc && sampleIdx < sizes.length; s++) {
      const sz = sizes[sampleIdx];
      samples.push(buf.subarray(off, off + sz));
      off += sz;
      sampleIdx++;
    }
  }
  return samples;
}

// ── Track info ──

interface TrackData {
  type: "video" | "audio";
  timescale: number;
  stsdRaw: Uint8Array; // raw stsd box bytes
  stts: SttsEntry[];
  sizes: number[];
  stco: { offsets: number[]; is64: boolean };
  stsc: StscEntry[];
  stss?: number[];
  ctts?: { count: number; offset: number }[];
  width?: number;
  height?: number;
}

function parseTrackData(buf: Uint8Array, trakBox: Box): TrackData | null {
  const s = trakBox.off + trakBox.hdr;
  const e = trakBox.off + trakBox.sz;

  // handler type
  const hdlr = findBox(buf, ["mdia", "hdlr"], s, e);
  if (!hdlr) return null;
  const handlerType = tag(buf, hdlr.off + hdlr.hdr + 8);
  if (handlerType !== "vide" && handlerType !== "soun") return null;
  const type = handlerType === "vide" ? "video" : "audio";

  // mdhd -> timescale
  const mdhd = findBox(buf, ["mdia", "mdhd"], s, e);
  if (!mdhd) return null;
  const mdhdVer = buf[mdhd.off + mdhd.hdr];
  const timescale = mdhdVer === 1 ? r32(buf, mdhd.off + mdhd.hdr + 4 + 16) : r32(buf, mdhd.off + mdhd.hdr + 4 + 8);

  // stbl
  const stbl = findBox(buf, ["mdia", "minf", "stbl"], s, e);
  if (!stbl) return null;
  const ss = stbl.off + stbl.hdr;
  const se = stbl.off + stbl.sz;

  // stsd (copy raw)
  const stsdBox = findBox(buf, ["stsd"], ss, se);
  if (!stsdBox) return null;
  const stsdRaw = buf.slice(stsdBox.off, stsdBox.off + stsdBox.sz);

  // stts
  const sttsBox = findBox(buf, ["stts"], ss, se);
  if (!sttsBox) return null;
  const stts = parseStts(buf, sttsBox);

  // stsz
  const stszBox = findBox(buf, ["stsz"], ss, se);
  if (!stszBox) return null;
  const { sizes } = parseStsz(buf, stszBox);

  // stsc
  const stscBox = findBox(buf, ["stsc"], ss, se);
  if (!stscBox) return null;
  const stsc = parseStsc(buf, stscBox);

  // stco/co64
  let stcoBox = findBox(buf, ["stco"], ss, se);
  if (!stcoBox) stcoBox = findBox(buf, ["co64"], ss, se);
  if (!stcoBox) return null;
  const stcoData = parseStco(buf, stcoBox);

  // stss (optional, video only)
  let stss: number[] | undefined;
  const stssBox = findBox(buf, ["stss"], ss, se);
  if (stssBox) stss = parseStss(buf, stssBox);

  // ctts (optional)
  let ctts: { count: number; offset: number }[] | undefined;
  const cttsBox = findBox(buf, ["ctts"], ss, se);
  if (cttsBox) ctts = parseCtts(buf, cttsBox);

  // width/height from tkhd
  let width = 0, height = 0;
  const tkhd = findBox(buf, ["tkhd"], s, e);
  if (tkhd) {
    const tkhdVer = buf[tkhd.off + tkhd.hdr];
    // v0: version/flags(4) + creation(4) + mod(4) + trackId(4) + reserved(4) + duration(4) + reserved(8) + layer(2) + altGroup(2) + volume(2) + reserved(2) + matrix(36) = 76
    // v1: version/flags(4) + creation(8) + mod(8) + trackId(4) + reserved(4) + duration(8) + reserved(8) + layer(2) + altGroup(2) + volume(2) + reserved(2) + matrix(36) = 92
    const wOff = tkhd.off + tkhd.hdr + (tkhdVer === 1 ? 92 : 76);
    width = r32(buf, wOff) >> 16;
    height = r32(buf, wOff + 4) >> 16;
  }

  return { type, timescale, stsdRaw, stts, sizes, stco: stcoData, stsc, stss, ctts, width, height };
}

// ── Build complete MP4 ──

function concatMP4(buf1: Uint8Array, buf2: Uint8Array): Uint8Array {
  console.log(`File 1: ${buf1.length} bytes, File 2: ${buf2.length} bytes`);

  const boxes1 = listBoxes(buf1, 0, buf1.length);
  const boxes2 = listBoxes(buf2, 0, buf2.length);

  const moov1 = boxes1.find(b => b.type === "moov");
  const moov2 = boxes2.find(b => b.type === "moov");
  const ftyp1 = boxes1.find(b => b.type === "ftyp");
  if (!moov1 || !moov2) throw new Error("Missing moov");

  // Parse tracks
  const traks1 = listBoxes(buf1, moov1.off + moov1.hdr, moov1.off + moov1.sz).filter(b => b.type === "trak");
  const traks2 = listBoxes(buf2, moov2.off + moov2.hdr, moov2.off + moov2.sz).filter(b => b.type === "trak");

  const tracks1: TrackData[] = [];
  const tracks2: TrackData[] = [];
  for (const t of traks1) { const td = parseTrackData(buf1, t); if (td) tracks1.push(td); }
  for (const t of traks2) { const td = parseTrackData(buf2, t); if (td) tracks2.push(td); }

  const vt1 = tracks1.find(t => t.type === "video");
  const at1 = tracks1.find(t => t.type === "audio");
  const vt2 = tracks2.find(t => t.type === "video");
  const at2 = tracks2.find(t => t.type === "audio");

  if (!vt1 || !vt2) throw new Error("Missing video track");

  console.log(`V1: ${vt1.sizes.length} samples, ts=${vt1.timescale}, ${vt1.width}x${vt1.height}`);
  console.log(`V2: ${vt2.sizes.length} samples, ts=${vt2.timescale}`);
  if (at1) console.log(`A1: ${at1.sizes.length} samples, ts=${at1.timescale}`);
  if (at2) console.log(`A2: ${at2.sizes.length} samples, ts=${at2.timescale}`);

  // Extract samples
  const vSamples1 = extractSamples(buf1, vt1.stco, vt1.stsc, vt1.sizes);
  const vSamples2 = extractSamples(buf2, vt2.stco, vt2.stsc, vt2.sizes);
  const aSamples1 = at1 ? extractSamples(buf1, at1.stco, at1.stsc, at1.sizes) : [];
  const aSamples2 = at2 ? extractSamples(buf2, at2.stco, at2.stsc, at2.sizes) : [];

  console.log(`Extracted: V1=${vSamples1.length}, V2=${vSamples2.length}, A1=${aSamples1.length}, A2=${aSamples2.length}`);

  // Build mdat: interleave video then audio
  // Each sample = one chunk (stsc = 1 sample/chunk)
  const allSamples = [...vSamples1, ...vSamples2, ...aSamples1, ...aSamples2];
  let mdatPayloadSize = 0;
  for (const s of allSamples) mdatPayloadSize += s.length;
  const mdatSize = 8 + mdatPayloadSize;

  // We'll compute offsets after we know the moov size
  // First, build all the moov components with placeholder stco

  // Merge video sample tables
  const mergedVSizes = [...vt1.sizes, ...vt2.sizes];
  const mergedVStts: SttsEntry[] = [...vt1.stts, ...vt2.stts];
  const vDur1 = vt1.stts.reduce((s, e) => s + e.count * e.delta, 0);
  const vDur2 = vt2.stts.reduce((s, e) => s + e.count * e.delta, 0);
  const totalVDur = vDur1 + vDur2;

  let mergedVStss: number[] | undefined;
  if (vt1.stss || vt2.stss) {
    mergedVStss = [];
    if (vt1.stss) mergedVStss.push(...vt1.stss);
    if (vt2.stss) {
      const offset = vt1.sizes.length;
      for (const s of (vt2.stss || [])) mergedVStss.push(s + offset);
    }
  }

  let mergedVCtts: { count: number; offset: number }[] | undefined;
  if (vt1.ctts || vt2.ctts) {
    mergedVCtts = [...(vt1.ctts || []), ...(vt2.ctts || [])];
  }

  // Merge audio sample tables
  const mergedASizes = [...(at1?.sizes || []), ...(at2?.sizes || [])];
  const mergedAStts: SttsEntry[] = [...(at1?.stts || []), ...(at2?.stts || [])];
  const aDur1 = at1 ? at1.stts.reduce((s, e) => s + e.count * e.delta, 0) : 0;
  const aDur2 = at2 ? at2.stts.reduce((s, e) => s + e.count * e.delta, 0) : 0;
  const totalADur = aDur1 + aDur2;

  // Build moov with placeholder offsets (will fix after knowing moov size)
  const placeholderVOffsets = new Array(mergedVSizes.length).fill(0);
  const placeholderAOffsets = new Array(mergedASizes.length).fill(0);

  // Video stbl
  const vSttsBox = buildStts(mergedVStts);
  const vStszBox = buildStsz(mergedVSizes);
  const vStscBox = buildStsc(mergedVSizes.length);
  const vStcoBox = buildStco(placeholderVOffsets);
  const vStssBox = mergedVStss ? buildStss(mergedVStss) : undefined;
  const vCttsBox = mergedVCtts ? buildCtts(mergedVCtts) : undefined;
  const vStbl = buildStbl(vt1.stsdRaw, vSttsBox, vStszBox, vStscBox, vStcoBox, vStssBox, vCttsBox);

  // Video minf
  const vmhd = buildVmhd();
  const vDinf = buildDinf();
  const vMinf = makeBox("minf", concat(vmhd, vDinf, vStbl));

  // Video mdia
  const vMdhd = buildMdhd(vt1.timescale, totalVDur);
  const vHdlr = buildHdlr("vide", "VideoHandler");
  const vMdia = makeBox("mdia", concat(vMdhd, vHdlr, vMinf));

  // mvhd timescale — use video timescale
  const mvhdTimescale = vt1.timescale;
  const mvhdDuration = totalVDur; // already in video timescale

  // Video trak
  const vTkhd = buildTkhd(1, Math.round(totalVDur * mvhdTimescale / vt1.timescale), vt1.width || 1080, vt1.height || 1920, false);
  const vTrak = makeBox("trak", concat(vTkhd, vMdia));

  // Audio trak (if exists)
  let aTrak: Uint8Array | null = null;
  if (at1 && mergedASizes.length > 0) {
    const aSttsBox = buildStts(mergedAStts);
    const aStszBox = buildStsz(mergedASizes);
    const aStscBox = buildStsc(mergedASizes.length);
    const aStcoBox = buildStco(placeholderAOffsets);
    const aStbl = buildStbl(at1.stsdRaw, aSttsBox, aStszBox, aStscBox, aStcoBox);

    const smhd = buildSmhd();
    const aDinf = buildDinf();
    const aMinf = makeBox("minf", concat(smhd, aDinf, aStbl));

    const aMdhd = buildMdhd(at1.timescale, totalADur);
    const aHdlr = buildHdlr("soun", "SoundHandler");
    const aMdia = makeBox("mdia", concat(aMdhd, aHdlr, aMinf));

    const aTkhd = buildTkhd(2, Math.round(totalADur * mvhdTimescale / at1.timescale), 0, 0, true);
    aTrak = makeBox("trak", concat(aTkhd, aMdia));
  }

  const mvhd = buildMvhd(mvhdTimescale, mvhdDuration);
  let moovPayload = aTrak ? concat(mvhd, vTrak, aTrak) : concat(mvhd, vTrak);
  let moov = makeBox("moov", moovPayload);

  // Calculate file layout
  const ftypData = ftyp1 ? buf1.slice(ftyp1.off, ftyp1.off + ftyp1.sz) : new Uint8Array(0);
  const mdatFileOffset = ftypData.length + moov.length;

  // Compute real sample offsets
  const realVOffsets: number[] = [];
  const realAOffsets: number[] = [];
  let pos = mdatFileOffset + 8; // +8 for mdat header
  for (const s of vSamples1) { realVOffsets.push(pos); pos += s.length; }
  for (const s of vSamples2) { realVOffsets.push(pos); pos += s.length; }
  for (const s of aSamples1) { realAOffsets.push(pos); pos += s.length; }
  for (const s of aSamples2) { realAOffsets.push(pos); pos += s.length; }

  // Rebuild moov with correct offsets
  const realVStco = buildStco(realVOffsets);
  const realAStco = mergedASizes.length > 0 ? buildStco(realAOffsets) : null;

  // If stco sizes changed, moov size changes, offsets shift — iterate until stable
  // For simplicity, just rebuild once more (stco size won't change between iterations
  // since we always use the same number of entries)
  const vStbl2 = buildStbl(vt1.stsdRaw, vSttsBox, vStszBox, vStscBox, realVStco, vStssBox, vCttsBox);
  const vMinf2 = makeBox("minf", concat(vmhd, vDinf, vStbl2));
  const vMdia2 = makeBox("mdia", concat(vMdhd, vHdlr, vMinf2));
  const vTrak2 = makeBox("trak", concat(vTkhd, vMdia2));

  let aTrak2: Uint8Array | null = null;
  if (at1 && mergedASizes.length > 0 && realAStco) {
    const aSttsBox = buildStts(mergedAStts);
    const aStszBox = buildStsz(mergedASizes);
    const aStscBox = buildStsc(mergedASizes.length);
    const aStbl2 = buildStbl(at1.stsdRaw, aSttsBox, aStszBox, aStscBox, realAStco);

    const smhd = buildSmhd();
    const aDinf = buildDinf();
    const aMinf2 = makeBox("minf", concat(smhd, aDinf, aStbl2));

    const aMdhd = buildMdhd(at1.timescale, totalADur);
    const aHdlr = buildHdlr("soun", "SoundHandler");
    const aMdia2 = makeBox("mdia", concat(aMdhd, aHdlr, aMinf2));

    const aTkhd = buildTkhd(2, Math.round(totalADur * mvhdTimescale / at1.timescale), 0, 0, true);
    aTrak2 = makeBox("trak", concat(aTkhd, aMdia2));
  }

  const mvhd2 = buildMvhd(mvhdTimescale, mvhdDuration);
  moovPayload = aTrak2 ? concat(mvhd2, vTrak2, aTrak2) : concat(mvhd2, vTrak2);
  moov = makeBox("moov", moovPayload);

  // Verify moov size didn't change (it shouldn't since entry counts are the same)
  const newMdatOffset = ftypData.length + moov.length;
  if (newMdatOffset !== mdatFileOffset) {
    console.log(`Warning: moov size changed (${mdatFileOffset} -> ${newMdatOffset}), offsets may be off`);
  }

  // Build mdat
  const mdat = new Uint8Array(mdatSize);
  w32(mdat, 0, mdatSize);
  wtag(mdat, 4, "mdat");
  pos = 8;
  for (const s of allSamples) { mdat.set(s, pos); pos += s.length; }

  // Assemble final file
  const result = new Uint8Array(ftypData.length + moov.length + mdat.length);
  result.set(ftypData, 0);
  result.set(moov, ftypData.length);
  result.set(mdat, ftypData.length + moov.length);

  console.log(`Output: ${result.length} bytes (ftyp=${ftypData.length}, moov=${moov.length}, mdat=${mdat.length})`);
  return result;
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

    // ── Resolve fresh main video URL ──
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
            const heygenResp = await fetch(
              `https://api.heygen.com/v1/video_status.get?video_id=${videoData.heygen_video_id}`,
              { headers: { "X-Api-Key": heygenKey } }
            );
            if (heygenResp.ok) {
              const heygenData = await heygenResp.json();
              const freshUrl = heygenData?.data?.video_url;
              if (freshUrl) {
                resolvedMainUrl = freshUrl;
                await supabase.from("videos")
                  .update({ heygen_video_url: freshUrl })
                  .eq("id", pubData.video_id);
              }
            } else {
              await heygenResp.text();
            }
          } catch (e: unknown) {
            console.log(`HeyGen API error: ${(e as Error).message}`);
          }
        }
      }

      if (resolvedMainUrl === main_video_url) {
        const storedUrl = videoData?.heygen_video_url || videoData?.video_path;
        if (storedUrl) resolvedMainUrl = storedUrl;
      }
    }

    // ── No back cover ──
    if (!back_cover_video_url) {
      await supabase.from("publications")
        .update({ final_video_url: resolvedMainUrl, publication_status: "checked" })
        .eq("id", publication_id);
      return new Response(
        JSON.stringify({ success: true, final_video_url: resolvedMainUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Download both ──
    console.log("Downloading videos...");
    const [mainResp, backResp] = await Promise.all([
      fetch(resolvedMainUrl),
      fetch(back_cover_video_url),
    ]);
    if (!mainResp.ok) throw new Error(`Failed to download main: ${mainResp.status}`);
    if (!backResp.ok) throw new Error(`Failed to download back cover: ${backResp.status}`);

    const mainBuf = new Uint8Array(await mainResp.arrayBuffer());
    const backBuf = new Uint8Array(await backResp.arrayBuffer());
    console.log(`Downloaded: main=${mainBuf.length}, back=${backBuf.length}`);

    // ── Concatenate ──
    const result = concatMP4(mainBuf, backBuf);

    // ── Upload ──
    const outputPath = `concat/${publication_id}_${Date.now()}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from("media-files")
      .upload(outputPath, result, { contentType: "video/mp4", upsert: true });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from("media-files").getPublicUrl(outputPath);
    const finalUrl = urlData.publicUrl;

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
