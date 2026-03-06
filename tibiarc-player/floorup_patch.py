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

    # Try both possible function names
    func_name = None
    for name in ['ParseFloorChangeUp', 'ParseFloorUp']:
        if name in src:
            func_name = name
            break

    if not func_name:
        print(f"WARN: ParseFloorChangeUp/ParseFloorUp not found in {filepath}")
        return False

    # Check if already patched (fork already has 6-floor loop)
    func_match = re.search(
        rf'(void\s+Parser::{func_name}\s*\([^)]*\)\s*\{{)',
        src
    )
    if not func_match:
        print(f"WARN: Could not find {func_name} function signature")
        return False

    func_start = func_match.end()
    
    # Find the z==7 branch
    z7_pattern = re.compile(r'if\s*\(\s*Position_\.Z\s*==\s*7\s*\)\s*\{')
    z7_match = z7_pattern.search(src, func_start)
    
    if not z7_match:
        print(f"WARN: Could not find 'Position_.Z == 7' branch in {func_name}")
        return False

    # Check if already has the 6-floor loop
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

    z7_body = src[brace_start:pos-1]
    
    # Check if it already has a loop (for zIdx = 5; zIdx >= 0)
    if 'zIdx = 5' in z7_body or 'zIdx >= 0' in z7_body:
        print(f"SUCCESS: {func_name} z==7 already has 6-floor loop (fork already patched)")
        return True

    brace_end = pos

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

    src = src[:z7_match.start()] + replacement + src[brace_end:]

    with open(filepath, 'w') as f:
        f.write(src)

    print(f"SUCCESS: {func_name} z==7 patched to read 6 floors (5→0)")
    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 floorup_patch.py <path-to-parser.cpp>")
        sys.exit(1)
    
    ok = patch_floor_up(sys.argv[1])
    sys.exit(0 if ok else 1)
