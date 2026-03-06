#!/usr/bin/env python3
"""
Patch tibiarc ParseFloorUp: when transitioning from underground (z=8) to
surface (z=7), read all 6 surface floors (z=5 down to z=0) with shared
skip encoding, matching the standard Tibia 7.7x protocol.

The tibiarc fork only reads a subset of floors. This patch replaces the
z==7 branch inside ParseFloorUp with a loop over 6 floors.
"""

import re
import sys

def patch_floor_up(filepath: str):
    with open(filepath, 'r') as f:
        src = f.read()

    # Find the ParseFloorUp function
    if 'ParseFloorUp' not in src:
        print(f"WARN: ParseFloorUp not found in {filepath}")
        return False

    # Strategy: find the `if (Position_.Z == 7)` block inside ParseFloorUp
    # and replace its body with the 6-floor loop.

    # Match the entire ParseFloorUp function
    func_match = re.search(
        r'(void\s+Parser::ParseFloorUp\s*\([^)]*\)\s*\{)',
        src
    )
    if not func_match:
        print("WARN: Could not find ParseFloorUp function signature")
        return False

    func_start = func_match.end()
    
    # Find the z==7 branch
    z7_pattern = re.compile(r'if\s*\(\s*Position_\.Z\s*==\s*7\s*\)\s*\{')
    z7_match = z7_pattern.search(src, func_start)
    
    if not z7_match:
        print("WARN: Could not find 'Position_.Z == 7' branch in ParseFloorUp")
        return False

    # Find the matching closing brace for this if block
    brace_start = z7_match.end()
    depth = 1
    pos = brace_start
    while pos < len(src) and depth > 0:
        if src[pos] == '{':
            depth += 1
        elif src[pos] == '}':
            depth -= 1
        pos += 1
    
    if depth != 0:
        print("WARN: Could not find matching brace for z==7 block")
        return False

    brace_end = pos  # position after the closing '}'

    # Build the replacement z==7 block
    replacement = """if (Position_.Z == 7) {
        /* TibiaRelic patch: read all 6 surface floors (z=5 down to z=0) */
        for (int zIdx = 5; zIdx >= 0; zIdx--) {
            tileSkip = ParseFloorDescription(reader,
                                             events,
                                             Position_.X - 8,
                                             Position_.Y - 6,
                                             zIdx,
                                             Map::TileBufferWidth,
                                             Map::TileBufferHeight,
                                             Map::TileBufferDepth - zIdx,
                                             tileSkip);
        }
    }"""

    # Replace
    src = src[:z7_match.start()] + replacement + src[brace_end:]

    with open(filepath, 'w') as f:
        f.write(src)

    print("SUCCESS: ParseFloorUp z==7 patched to read 6 floors (5→0)")
    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 floorup_patch.py <path-to-parser.cpp>")
        sys.exit(1)
    
    ok = patch_floor_up(sys.argv[1])
    sys.exit(0 if ok else 1)
