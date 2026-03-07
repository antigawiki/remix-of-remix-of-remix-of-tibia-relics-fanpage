/**
 * Maps Tibia minimap colors (from dat file) to CSS hex colors.
 * Standard Tibia 7.6 automap colors — ported from reference Cam Mapper.
 */
const MINIMAP_PALETTE: Record<number, string> = {
  0: '#000000',
  12: '#006600',
  24: '#00CC00',
  30: '#00FF00',
  40: '#003300',
  51: '#993300',
  86: '#666666',
  114: '#999999',
  129: '#FFFF00',
  140: '#FF6600',
  170: '#0000FF',
  179: '#00CCFF',
  186: '#6666FF',
  192: '#CCCCCC',
  207: '#FF0000',
  210: '#CC0000',
  215: '#FFFFFF',
};

export function getMinimapColor(minimapColor: number): string {
  if (minimapColor === 0) return '';
  if (MINIMAP_PALETTE[minimapColor]) return MINIMAP_PALETTE[minimapColor];

  let closest = 0;
  let minDist = Infinity;
  for (const key of Object.keys(MINIMAP_PALETTE)) {
    const k = Number(key);
    const dist = Math.abs(k - minimapColor);
    if (dist < minDist) { minDist = dist; closest = k; }
  }
  return MINIMAP_PALETTE[closest] || '#808080';
}

export function getFallbackColor(isGround: boolean, isBlocking: boolean): string {
  if (isBlocking) return '#808080';
  if (isGround) return '#996633';
  return '#666666';
}
