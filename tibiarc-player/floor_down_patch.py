"""
Floor Change Down (0xBF) patch for tibiarc — TibiaRelic fork.

The fork simplified ParseFloorChangeDown to always read 1 floor regardless of z.
This is correct for z>7 (already underground, 1 new floor comes into view).
But for z==7 (entering underground from surface), the Tibia server sends 3 floors
(8, 9, 10) in the same packet. Reading only 1 floor leaves ~2600 bytes of unread
tile data in the buffer, which causes every subsequent packet to be parsed at the
wrong offset → ghost creatures, wrong-floor rendering, position corruption.

Fix: when z==7, read floors 8, 9, 10 (loop from z+1 to z+3).

Evidence from quests-hj.cam: at 59:17 and 59:25, 0xBF frames have remaining=3848
bytes. For 3 floors of 18×14 tiles this is exactly right (~1282 bytes/floor).
Comparable z>7 frames have 600-1100 bytes (1 floor). This confirms 3 floors.
"""

import re
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else 'lib/parser.cpp'

with open(filepath, 'r') as f:
    src = f.read()

# ----------------------------------------------------------------
# Strategy: Find ParseFloorChangeDown and patch the z==7 branch.
# The fork has a comment "/* TibiaRelic: only the newly visible floor */"
# (same pattern used in ParseFloorChangeUp) OR it has a plain single-floor call.
# We handle both cases.
# ----------------------------------------------------------------

ALREADY_PATCHED = 'TibiaRelic: FloorDown z==7 reads 3 floors'
if ALREADY_PATCHED in src:
    print('FloorDown patch already applied, skipping.')
    sys.exit(0)

# ---- Approach 1: Fork has the TibiaRelic comment in FloorDown ----
# Find and replace single-floor ParseFloorDescription inside ParseFloorChangeDown
# where position z==7 case exists
patched = False

# Find the function
func_match = re.search(
    r'(void Parser::ParseFloorChangeDown\b[^{]*\{)(.*?)(^})',
    src, re.DOTALL | re.MULTILINE
)

if not func_match:
    print('ERROR: ParseFloorChangeDown not found in ' + filepath)
    sys.exit(1)

func_start = func_match.start()
func_body_start = func_match.start(2)
func_body_end = func_match.end(2)
func_end = func_match.end(3)

body = func_match.group(2)
print(f'Found ParseFloorChangeDown at offset {func_start}')
print(f'Function body ({len(body)} chars):')
# Print first 800 chars for inspection
print(body[:800])
print('...')

# ---- Detect which variant of the z==7 branch exists ----

# Variant A: Has an explicit "if (Position_.Z == 7)" with single floor
variant_a = re.search(
    r'if\s*\(\s*Position_\.Z\s*==\s*7\s*\)\s*\{[^}]*ParseFloorDescription[^}]*\}',
    body, re.DOTALL
)

# Variant B: Has the TibiaRelic comment marker (same as FloorUp)
variant_b = 'TibiaRelic: only the newly visible floor' in body

# Variant C: No z==7 branch at all — fork removed it entirely and just does 1 floor
variant_c = 'Position_.Z == 7' not in body

print(f'Variant A (explicit z==7 with 1 floor): {bool(variant_a)}')
print(f'Variant B (TibiaRelic comment marker):   {variant_b}')
print(f'Variant C (no z==7 branch at all):       {variant_c}')

# ----------------------------------------------------------------
# Replacement code: 3-floor loop for z==7
# Depth formula: -(newZ - Position_.Z) mirrors OTClient convention
# newZ=8 → depth=-1, newZ=9 → depth=-2, newZ=10 → depth=-3
# ----------------------------------------------------------------
THREE_FLOOR_LOOP = (
    '        /* TibiaRelic: FloorDown z==7 reads 3 floors (8,9,10) — standard protocol */\n'
    '        for (int newZ = Position_.Z + 1; newZ <= Position_.Z + 3; newZ++) {\n'
    '            tileSkip = ParseFloorDescription(reader,\n'
    '                                             events,\n'
    '                                             Position_.X - 8,\n'
    '                                             Position_.Y - 6,\n'
    '                                             newZ,\n'
    '                                             Map::TileBufferWidth,\n'
    '                                             Map::TileBufferHeight,\n'
    '                                             -(newZ - Position_.Z),\n'
    '                                             tileSkip);\n'
    '        }'
)

if variant_a:
    # Replace the existing single-floor z==7 block
    old_block = variant_a.group(0)
    # Extract the indented if header and closing brace, replace body
    new_block = re.sub(
        r'(if\s*\(\s*Position_\.Z\s*==\s*7\s*\)\s*\{)[^}]*(\})',
        r'\1\n' + THREE_FLOOR_LOOP + r'\n        \2',
        old_block, flags=re.DOTALL
    )
    new_body = body.replace(old_block, new_block, 1)
    patched = True
    print('Applied Variant A patch (replaced z==7 single-floor block).')

elif variant_b:
    # Same pattern as FloorUp — comment marker precedes a single ParseFloorDescription
    # Replace from comment to end of that statement
    new_body = re.sub(
        r'/\* TibiaRelic: only the newly visible floor \*/.*?tileSkip\);',
        THREE_FLOOR_LOOP.replace('        ', '        '),
        body, count=1, flags=re.DOTALL
    )
    patched = True
    print('Applied Variant B patch (replaced TibiaRelic comment + call).')

elif variant_c:
    # Fork removed z==7 entirely. The function likely does only the z>7 case.
    # We need to ADD the z==7 branch before the Position_.Z++ line.
    # Find the last ParseFloorDescription call (the z>7 case) and wrap it.

    # Look for the structure: if (Position_.Z > 7) { ... } OR just the call
    z_gt_7_match = re.search(
        r'(if\s*\(\s*Position_\.Z\s*(?:>=\s*8|>\s*7)\s*\)\s*\{[^}]*\})',
        body, re.DOTALL
    )

    if z_gt_7_match:
        old_block = z_gt_7_match.group(1)
        new_block = (
            'if (Position_.Z == 7) {\n'
            + THREE_FLOOR_LOOP + '\n'
            '        } else ' + old_block
        )
        new_body = body.replace(old_block, new_block, 1)
        patched = True
        print('Applied Variant C patch (added z==7 branch before z>7 block).')
    else:
        # No conditional at all — function has a bare ParseFloorDescription.
        # Wrap everything in if (z>7) and add z==7 branch.
        single_call_match = re.search(
            r'(\s+tileSkip\s*=\s*ParseFloorDescription\(.*?\);)',
            body, re.DOTALL
        )
        if single_call_match:
            old_call = single_call_match.group(1)
            new_code = (
                '\n        if (Position_.Z == 7) {\n'
                + THREE_FLOOR_LOOP + '\n'
                '        } else if (Position_.Z > 7) {'
                + old_call +
                '\n        }'
            )
            new_body = body.replace(old_call, new_code, 1)
            patched = True
            print('Applied Variant C fallback patch (wrapped bare call with z branches).')
        else:
            print('ERROR: Could not find ParseFloorDescription call in ParseFloorChangeDown.')
            sys.exit(1)

if patched:
    new_src = src[:func_body_start] + new_body + src[func_body_end:]
    with open(filepath, 'w') as f:
        f.write(new_src)
    print('FloorDown patch applied successfully.')
    # Verify
    with open(filepath, 'r') as f:
        verify = f.read()
    if ALREADY_PATCHED in verify:
        print('Verification: OK — patch marker found.')
    else:
        print('WARNING: Patch marker not found after write. Check manually.')
else:
    print('ERROR: No patch variant matched.')
    sys.exit(1)
