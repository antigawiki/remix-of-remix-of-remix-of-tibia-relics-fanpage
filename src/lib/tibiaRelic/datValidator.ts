/**
 * DatValidator — Multi-hypothesis .dat parser that tests different flag payload
 * configurations and scores each one to find the correct reading approach.
 * 
 * Runs entirely in the browser — no AI or API calls needed.
 */

export interface HypothesisConfig {
  name: string;
  label: string;
  description: string;
  // Override flag payload sizes: flag -> bytes to consume (0 = boolean/no payload)
  flagOverrides: Map<number, number>;
  // If true, sprite IDs are u32 instead of u16
  spriteIdU32: boolean;
}

export interface HypothesisResult {
  name: string;
  label: string;
  description: string;
  totalItems: number;
  validDimensions: number;       // w/h 1-4, layers 1-3, anim 1-8
  invalidDimensions: number;
  validSpriteIds: number;        // sprite IDs within spr range
  invalidSpriteIds: number;
  bytesRemaining: number;        // bytes left after full parse
  referenceMatches: number;      // how many of the 3 reference items match
  referenceDetails: { id: number; expected: number; got: number; match: boolean }[];
  score: number;                 // composite score (higher = better)
  firstBadItem: number | null;   // first item ID with invalid dimensions
  sampleBadItems: BadItemInfo[];
  parseError: string | null;
}

export interface BadItemInfo {
  id: number;
  w: number;
  h: number;
  layers: number;
  patX: number;
  patY: number;
  patZ: number;
  anim: number;
  sprCount: number;
  spr0: number;
  hexContext: string; // hex bytes around this item's entry
}

export interface ValidationReport {
  hypotheses: HypothesisResult[];
  winner: string;
  datSignature: string;
  fileSize: number;
  maxItemId: number;
  maxSpriteIdInSpr: number | null; // if provided
}

// Default flag payload sizes (current parser behavior)
function baselineFlagPayloads(): Map<number, number> {
  const m = new Map<number, number>();
  m.set(0x00, 2); // ground speed
  m.set(0x08, 2); // writeable
  m.set(0x09, 2); // writeable once
  m.set(0x15, 4); // light (2+2)
  m.set(0x18, 4); // displacement (2+2)
  m.set(0x19, 2); // elevation
  m.set(0x1C, 2); // lens help
  m.set(0x1D, 2); // full ground
  // All others: 0 (boolean)
  return m;
}

function buildHypotheses(): HypothesisConfig[] {
  const configs: HypothesisConfig[] = [];

  // Baseline — current parser
  configs.push({
    name: 'baseline',
    label: 'Baseline',
    description: 'Parser atual (0x07=bool, 0x08/09=u16, 0x1C/1D=u16)',
    flagOverrides: baselineFlagPayloads(),
    spriteIdU32: false,
  });

  // Hyp A: 0x07 (ForceUse) has u16 payload
  {
    const m = baselineFlagPayloads();
    m.set(0x07, 2);
    configs.push({
      name: 'hyp_A',
      label: 'A: 0x07=u16',
      description: 'Flag 0x07 (ForceUse) tem payload u16',
      flagOverrides: m,
      spriteIdU32: false,
    });
  }

  // Hyp B: 0x08/0x09 have u32 payload (4 bytes instead of 2)
  {
    const m = baselineFlagPayloads();
    m.set(0x08, 4);
    m.set(0x09, 4);
    configs.push({
      name: 'hyp_B',
      label: 'B: 0x08/09=u32',
      description: 'Flags 0x08/0x09 (Writeable) têm payload u32 (4 bytes)',
      flagOverrides: m,
      spriteIdU32: false,
    });
  }

  // Hyp C: 0x1C/0x1D have u32 payload (4 bytes instead of 2)
  {
    const m = baselineFlagPayloads();
    m.set(0x1C, 4);
    m.set(0x1D, 4);
    configs.push({
      name: 'hyp_C',
      label: 'C: 0x1C/1D=u32',
      description: 'Flags 0x1C/0x1D (LensHelp/FullGround) têm payload u32 (4 bytes)',
      flagOverrides: m,
      spriteIdU32: false,
    });
  }

  // Hyp D: 0x1E has u16 payload
  {
    const m = baselineFlagPayloads();
    m.set(0x1E, 2);
    configs.push({
      name: 'hyp_D',
      label: 'D: 0x1E=u16',
      description: 'Flag 0x1E tem payload u16 (não boolean)',
      flagOverrides: m,
      spriteIdU32: false,
    });
  }

  // Hyp E: Some flags in 0x1F-0x4F have payloads (test common ones)
  {
    const m = baselineFlagPayloads();
    // Test: 0x20 and 0x21 with u16 payloads
    m.set(0x20, 2);
    m.set(0x21, 2);
    configs.push({
      name: 'hyp_E',
      label: 'E: 0x20/21=u16',
      description: 'Flags 0x20/0x21 têm payload u16 (payload oculto)',
      flagOverrides: m,
      spriteIdU32: false,
    });
  }

  // Hyp F: Sprite IDs are u32 instead of u16
  configs.push({
    name: 'hyp_F',
    label: 'F: SprID=u32',
    description: 'Sprite IDs são u32 em vez de u16',
    flagOverrides: baselineFlagPayloads(),
    spriteIdU32: true,
  });

  // Hyp G: Combined — 0x07=u16 + 0x1C/1D=u32
  {
    const m = baselineFlagPayloads();
    m.set(0x07, 2);
    m.set(0x1C, 4);
    m.set(0x1D, 4);
    configs.push({
      name: 'hyp_G',
      label: 'G: 0x07=u16+0x1C/1D=u32',
      description: 'Combinação: 0x07 com u16 + 0x1C/0x1D com u32',
      flagOverrides: m,
      spriteIdU32: false,
    });
  }

  // Hyp H: Combined — 0x08/09=u32 + 0x1C/1D=u32
  {
    const m = baselineFlagPayloads();
    m.set(0x08, 4);
    m.set(0x09, 4);
    m.set(0x1C, 4);
    m.set(0x1D, 4);
    configs.push({
      name: 'hyp_H',
      label: 'H: 0x08/09+1C/1D=u32',
      description: 'Combinação: 0x08/0x09 e 0x1C/0x1D todos com u32',
      flagOverrides: m,
      spriteIdU32: false,
    });
  }

  // Hyp I: Combined — 0x07=u16 + 0x08/09=u32
  {
    const m = baselineFlagPayloads();
    m.set(0x07, 2);
    m.set(0x08, 4);
    m.set(0x09, 4);
    configs.push({
      name: 'hyp_I',
      label: 'I: 0x07=u16+0x08/09=u32',
      description: 'Combinação: 0x07 com u16 + 0x08/0x09 com u32',
      flagOverrides: m,
      spriteIdU32: false,
    });
  }

  return configs;
}

// Reference items: [itemId, expectedSpriteId0]
const REFERENCE_ITEMS: [number, number][] = [[102, 42], [408, 39], [870, 559]];

/**
 * Parse the .dat with a specific hypothesis and return scored results.
 */
function parseWithHypothesis(
  data: ArrayBuffer,
  config: HypothesisConfig,
  maxSpriteId: number | null,
): HypothesisResult {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  let p = 0;

  const result: HypothesisResult = {
    name: config.name,
    label: config.label,
    description: config.description,
    totalItems: 0,
    validDimensions: 0,
    invalidDimensions: 0,
    validSpriteIds: 0,
    invalidSpriteIds: 0,
    bytesRemaining: 0,
    referenceMatches: 0,
    referenceDetails: [],
    score: 0,
    firstBadItem: null,
    sampleBadItems: [],
    parseError: null,
  };

  try {
    // Header
    if (data.byteLength < 12) throw new Error('File too small');
    /* signature */ p += 4;
    const itemMaxId = view.getUint16(p, true); p += 2;
    const outfitMaxId = view.getUint16(p, true); p += 2;
    const effectMaxId = view.getUint16(p, true); p += 2;
    const missileMaxId = view.getUint16(p, true); p += 2;

    const itemCount = itemMaxId - 100 + 1;
    result.totalItems = itemCount;

    // Map to store item sprite[0] for reference check
    const itemSprites = new Map<number, number>();

    const totalEntries = itemCount + outfitMaxId + effectMaxId + missileMaxId;
    
    for (let entryIdx = 0; entryIdx < totalEntries; entryIdx++) {
      if (p >= bytes.length) break;

      const entryStart = p;
      const isItem = entryIdx < itemCount;
      const itemId = isItem ? 100 + entryIdx : -1;

      // Phase 1: read flags until 0xFF
      while (p < bytes.length) {
        const flag = bytes[p]; p++;
        if (flag === 0xFF) break;
        
        // Consume payload based on hypothesis
        const payloadSize = config.flagOverrides.get(flag) ?? 0;
        if (payloadSize > 0) {
          p += payloadSize;
          if (p > bytes.length) { p = bytes.length; break; }
        }
      }

      // Phase 2: read dimensions
      if (p + 2 > bytes.length) break;
      const rawW = bytes[p]; p++;
      const rawH = bytes[p]; p++;
      if (rawW > 1 || rawH > 1) {
        if (p < bytes.length) p++; // exact_size
      }

      if (p + 5 > bytes.length) break; // layers + patX + patY + patZ + anim
      const rawLayers = bytes[p]; p++;
      const rawPatX = bytes[p]; p++;
      const rawPatY = bytes[p]; p++;
      const rawPatZ = bytes[p]; p++; // TibiaRelic has patZ
      const rawAnim = bytes[p]; p++;

      // Sprite count
      const sprCount = rawW * rawH * rawLayers * rawPatX * rawPatY * rawPatZ * rawAnim;
      const sprSize = config.spriteIdU32 ? 4 : 2;

      // Read sprite IDs
      let spr0 = -1;
      let itemValidSprites = 0;
      let itemInvalidSprites = 0;

      for (let s = 0; s < sprCount; s++) {
        if (p + sprSize > bytes.length) { p = bytes.length; break; }
        const sid = config.spriteIdU32
          ? view.getUint32(p, true)
          : view.getUint16(p, true);
        p += sprSize;

        if (s === 0) spr0 = sid;

        if (maxSpriteId !== null) {
          if (sid <= maxSpriteId) itemValidSprites++;
          else itemInvalidSprites++;
        }
      }

      if (isItem) {
        itemSprites.set(itemId, spr0);

        // Check dimensions validity
        const dimValid = rawW >= 1 && rawW <= 8 && rawH >= 1 && rawH <= 8
          && rawLayers >= 1 && rawLayers <= 8
          && rawAnim >= 1 && rawAnim <= 32
          && rawPatX >= 1 && rawPatX <= 8
          && rawPatY >= 1 && rawPatY <= 8
          && rawPatZ >= 1 && rawPatZ <= 8;

        if (dimValid) {
          result.validDimensions++;
        } else {
          result.invalidDimensions++;
          if (result.firstBadItem === null) result.firstBadItem = itemId;
          if (result.sampleBadItems.length < 10) {
            // Extract hex context
            const ctxStart = Math.max(0, entryStart);
            const ctxEnd = Math.min(bytes.length, entryStart + 40);
            const hexCtx = Array.from(bytes.slice(ctxStart, ctxEnd))
              .map(b => b.toString(16).padStart(2, '0'))
              .join(' ');

            result.sampleBadItems.push({
              id: itemId,
              w: rawW, h: rawH, layers: rawLayers,
              patX: rawPatX, patY: rawPatY, patZ: rawPatZ,
              anim: rawAnim,
              sprCount,
              spr0,
              hexContext: hexCtx,
            });
          }
        }

        result.validSpriteIds += itemValidSprites;
        result.invalidSpriteIds += itemInvalidSprites;
      }
    }

    result.bytesRemaining = Math.max(0, bytes.length - p);

    // Check reference items
    for (const [refId, expectedSpr] of REFERENCE_ITEMS) {
      const gotSpr = itemSprites.get(refId) ?? -1;
      const match = gotSpr === expectedSpr;
      if (match) result.referenceMatches++;
      result.referenceDetails.push({ id: refId, expected: expectedSpr, got: gotSpr, match });
    }

    // Compute composite score
    // Weight: references (30%), valid dimensions (30%), valid sprites (20%), bytes remaining (20%)
    const refScore = (result.referenceMatches / REFERENCE_ITEMS.length) * 30;
    const dimScore = result.totalItems > 0
      ? (result.validDimensions / result.totalItems) * 30
      : 0;
    const sprScore = (result.validSpriteIds + result.invalidSpriteIds) > 0
      ? (result.validSpriteIds / (result.validSpriteIds + result.invalidSpriteIds)) * 20
      : 20; // no sprites to check = neutral
    const remainScore = result.bytesRemaining === 0 ? 20
      : result.bytesRemaining < 10 ? 15
      : result.bytesRemaining < 100 ? 10
      : 0;

    result.score = Math.round((refScore + dimScore + sprScore + remainScore) * 10) / 10;

  } catch (err: any) {
    result.parseError = err?.message || 'Unknown error';
    result.score = -1;
  }

  return result;
}

/**
 * Run all hypotheses against the .dat file and produce a comparative report.
 */
export function validateDat(
  datBuffer: ArrayBuffer,
  maxSpriteIdFromSpr: number | null = null,
): ValidationReport {
  const view = new DataView(datBuffer);
  const sig = view.getUint32(0, true);
  const sigHex = '0x' + sig.toString(16).toUpperCase().padStart(8, '0');
  const maxItemId = view.getUint16(4, true);

  const hypotheses = buildHypotheses();
  const results: HypothesisResult[] = [];

  for (const hyp of hypotheses) {
    console.log(`[DatValidator] Testing ${hyp.name}: ${hyp.description}`);
    const result = parseWithHypothesis(datBuffer, hyp, maxSpriteIdFromSpr);
    results.push(result);
    console.log(`[DatValidator]   → score=${result.score} valid=${result.validDimensions}/${result.totalItems} refs=${result.referenceMatches}/3 remaining=${result.bytesRemaining}`);
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  const winner = results[0]?.name || 'baseline';

  console.log(`[DatValidator] ✓ Winner: ${winner} (score ${results[0]?.score})`);

  return {
    hypotheses: results,
    winner,
    datSignature: sigHex,
    fileSize: datBuffer.byteLength,
    maxItemId,
    maxSpriteIdInSpr: maxSpriteIdFromSpr,
  };
}

/**
 * Extract raw hex bytes for a specific item range for manual inspection.
 */
export function extractItemHexDumps(
  datBuffer: ArrayBuffer,
  startId: number,
  count: number,
): { id: number; hex: string; byteCount: number }[] {
  const bytes = new Uint8Array(datBuffer);
  const view = new DataView(datBuffer);
  let p = 12; // skip header

  const itemMaxId = view.getUint16(4, true);
  const itemCount = itemMaxId - 100 + 1;
  const dumps: { id: number; hex: string; byteCount: number }[] = [];

  for (let i = 0; i < itemCount; i++) {
    const itemId = 100 + i;
    const entryStart = p;

    // Skip flags to 0xFF
    while (p < bytes.length) {
      if (bytes[p] === 0xFF) { p++; break; }
      p++;
    }

    // Read dimensions
    if (p + 2 > bytes.length) break;
    const w = bytes[p]; p++;
    const h = bytes[p]; p++;
    if (w > 1 || h > 1) { if (p < bytes.length) p++; }

    if (p + 5 > bytes.length) break;
    const layers = bytes[p]; p++;
    const patX = bytes[p]; p++;
    const patY = bytes[p]; p++;
    const patZ = bytes[p]; p++;
    const anim = bytes[p]; p++;

    const sprCount = w * h * layers * patX * patY * patZ * anim;
    p += sprCount * 2; // u16 sprite IDs
    if (p > bytes.length) p = bytes.length;

    const entryEnd = p;

    if (itemId >= startId && itemId < startId + count) {
      const entryBytes = bytes.slice(entryStart, entryEnd);
      const hex = Array.from(entryBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      dumps.push({ id: itemId, hex, byteCount: entryEnd - entryStart });
    }

    if (itemId >= startId + count) break;
  }

  return dumps;
}
