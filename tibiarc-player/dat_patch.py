"""
Two-phase DAT parser patch for tibiarc.
Replaces ReadProperties with a two-phase approach:
  1. Scan forward to 0xFF terminator (guarantees byte alignment)
  2. Best-effort metadata extraction from the scanned bytes
Mirrors the JS datLoader.ts extractMetadata logic.
"""
import re
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else 'lib/types.cpp'

with open(filepath, 'r') as f:
    src = f.read()

# Find ReadProperties function
pattern = r'(void EntityType::ReadProperties\([^)]*\)\s*\{)(.*?)(^\})'
match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
if not match:
    print('WARN: ReadProperties not found in ' + filepath)
    sys.exit(1)

# Replace the entire body with two-phase logic
    new_body = r'''
    /* TibiaRelic: Two-phase DAT property reader
     * Phase 1: Scan to 0xFF terminator to guarantee correct byte alignment
     * Phase 2: Best-effort metadata extraction from the scanned attribute bytes
     * This mirrors the JS datLoader.ts approach and prevents missing flags
     * when custom/unknown properties are encountered. */

    /* Phase 1: Record start position, scan forward to 0xFF */
    auto phaseStart = reader.Tell();
    while (reader.Remaining() > 0) {
        uint8_t b = reader.ReadU8();
        if (b == 0xFF) break;
    }
    auto phaseEnd = reader.Tell(); /* position right after 0xFF */

    /* Phase 2: Seek back and extract known properties */
    reader.Seek(phaseStart);
    while (reader.Tell() < phaseEnd - 1) {
        uint8_t flag = reader.ReadU8();
        if (flag == 0xFF) break;

        try {
            switch (flag) {
                case 0x00: /* Ground */
                    Properties.StackPriority = 0;
                    Properties.Speed = reader.ReadU16();
                    break;
                case 0x01: Properties.StackPriority = 1; break;
                case 0x02: Properties.StackPriority = 2; break;
                case 0x03: Properties.StackPriority = 3; break;
                case 0x04: /* Container */ break;
                case 0x05: Properties.Stackable = true; break;
                case 0x06: /* MultiUse */ break;
                case 0x07: /* ForceUse */ break;
                case 0x08: reader.ReadU16(); break; /* Writable - maxLen */
                case 0x09: reader.ReadU16(); break; /* WritableOnce - maxLen */
                case 0x0A: Properties.LiquidContainer = true; break;
                case 0x0B: Properties.LiquidPool = true; break;
                case 0x0C: /* Blocking */ break;
                case 0x0D: /* Unmovable */ break;
                case 0x0E: /* BlocksMissile */ break;
                case 0x0F: /* Unpathable */ break;
                case 0x10: /* Takeable */ break;
                case 0x11: Properties.Hangable = true; break;
                case 0x12: Properties.Vertical = true; break;
                case 0x13: Properties.Horizontal = true; break;
                case 0x14: /* Rotate */ break;
                case 0x15: /* Light */
                    reader.ReadU16(); /* intensity */
                    reader.ReadU16(); /* color */
                    break;
                case 0x16: Properties.DontHide = true; break;
                case 0x17: /* Translucent */ break;
                case 0x18: /* Displacement */
                    Properties.DisplacementX = reader.ReadU16();
                    Properties.DisplacementY = reader.ReadU16();
                    break;
                case 0x19: /* Height/Elevation */
                    Properties.Height = reader.ReadU16();
                    break;
                case 0x1A: Properties.RedrawNearbyTop = true; break;
                case 0x1B: Properties.AnimateIdle = true; break;
                case 0x1C: reader.ReadU16(); break; /* MinimapColor */
                case 0x1D: reader.ReadU16(); break; /* LensHelp/Action */
                case 0x1E: /* FullGround */ break;
                default:
                    /* Unknown flag — skip to end, alignment already guaranteed by phase 1 */
                    goto phase2_done;
            }
        } catch (...) {
            /* Error reading a property payload — stop extraction,
             * alignment is still correct thanks to phase 1 */
            goto phase2_done;
        }
    }
    phase2_done:

    /* Restore position to right after 0xFF (phase 1 end) */
    reader.Seek(phaseEnd);
'''

replacement = match.group(1) + new_body + '\n' + match.group(3)

src = src[:match.start()] + replacement + src[match.end():]
with open(filepath, 'w') as f:
    f.write(src)

print('Two-phase DAT patch applied successfully (scan-to-0xFF + extract)')
