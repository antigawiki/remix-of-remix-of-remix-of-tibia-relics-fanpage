#!/usr/bin/env python3
"""
Patch tibiarc scroll handlers (ParseMoveNorth/East/South/West) for TibiaRelic.

Standard Tibia sends a single strip (18x1 or 1x14) for each scroll direction.
TibiaRelic sends the FULL 18x14 multi-floor viewport for every scroll.

This patch replaces the ParseMapDescription call in each function to read
the full viewport (-8, -6, TileBufferWidth, TileBufferHeight) instead of
a strip, matching the JS parser's scroll() logic.
"""

import re
import sys


def patch_scroll_functions(filepath: str):
    with open(filepath, 'r') as f:
        src = f.read()

    patches_applied = 0

    # ParseMoveNorth: 18x1 strip → full viewport
    # Original: ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, 1);
    old = 'ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, 1);'
    new = '/* TibiaRelic: full 18x14 viewport */ ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, Map::TileBufferHeight);'
    if old in src:
        # This pattern appears in both ParseMoveNorth and ParseMoveSouth
        src = src.replace(old, new)
        patches_applied += src.count('TibiaRelic: full 18x14 viewport')
        print(f"Patched ParseMoveNorth/South: 18x1 → 18x14")
    else:
        print("WARN: ParseMoveNorth 18x1 pattern not found")

    # ParseMoveEast: 1x14 strip at +9 offset → full viewport
    # Original: ParseMapDescription(reader, events, +9, -6, 1, Map::TileBufferHeight);
    old_east = 'ParseMapDescription(reader, events, +9, -6, 1, Map::TileBufferHeight);'
    new_east = '/* TibiaRelic: full 18x14 viewport */ ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, Map::TileBufferHeight);'
    if old_east in src:
        src = src.replace(old_east, new_east)
        patches_applied += 1
        print("Patched ParseMoveEast: 1x14 → 18x14")
    else:
        print("WARN: ParseMoveEast 1x14 pattern not found")

    # ParseMoveWest: 1x14 strip at -8 offset → full viewport
    # Original: ParseMapDescription(reader, events, -8, -6, 1, Map::TileBufferHeight);
    old_west = 'ParseMapDescription(reader, events, -8, -6, 1, Map::TileBufferHeight);'
    new_west = '/* TibiaRelic: full 18x14 viewport */ ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, Map::TileBufferHeight);'
    if old_west in src:
        src = src.replace(old_west, new_west)
        patches_applied += 1
        print("Patched ParseMoveWest: 1x14 → 18x14")
    else:
        print("WARN: ParseMoveWest 1x14 pattern not found")

    # ParseMoveSouth: 18x1 strip at +7 offset → full viewport
    # Original: ParseMapDescription(reader, events, -8, +7, Map::TileBufferWidth, 1);
    old_south = 'ParseMapDescription(reader, events, -8, +7, Map::TileBufferWidth, 1);'
    new_south = '/* TibiaRelic: full 18x14 viewport */ ParseMapDescription(reader, events, -8, -6, Map::TileBufferWidth, Map::TileBufferHeight);'
    if old_south in src:
        src = src.replace(old_south, new_south)
        patches_applied += 1
        print("Patched ParseMoveSouth: 18x1 → 18x14")
    else:
        print("WARN: ParseMoveSouth pattern not found (may have been patched by North)")

    with open(filepath, 'w') as f:
        f.write(src)

    print(f"SUCCESS: {patches_applied} scroll patches applied")
    return patches_applied > 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 scroll_patch.py <path-to-parser.cpp>")
        sys.exit(1)

    ok = patch_scroll_functions(sys.argv[1])
    sys.exit(0 if ok else 1)
