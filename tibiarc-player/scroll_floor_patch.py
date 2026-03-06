"""
Patch lib/parser.cpp for TibiaRelic protocol:
1. Scroll opcodes (0x65-0x68): read full 18x14 multi-floor area instead of 1-row/1-col
2. FloorUp (0xBE) at z==7: read only 1 floor (z=5) instead of 6 floors
"""
import re
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else 'lib/parser.cpp'

with open(filepath, 'r') as f:
    src = f.read()

changes = 0

# =============================================================
# 1. Scroll patches: all 4 directions → full 18x14 with offset (-8, -6)
# =============================================================
# ParseMoveNorth: (-8, -6, TileBufferWidth, 1) → (-8, -6, TileBufferWidth, TileBufferHeight)
scroll_patches = [
    # (function_name, old_pattern, new_replacement)
    (
        'ParseMoveNorth',
        r'(ParseMapDescription\s*\(\s*reader\s*,\s*events\s*,\s*)-8\s*,\s*-6\s*,\s*Map::TileBufferWidth\s*,\s*1\s*\)',
        r'\g<1>-8, -6, Map::TileBufferWidth, Map::TileBufferHeight)',
    ),
    (
        'ParseMoveEast',
        r'(ParseMapDescription\s*\(\s*reader\s*,\s*events\s*,\s*)\+?9\s*,\s*-6\s*,\s*1\s*,\s*Map::TileBufferHeight\s*\)',
        r'\g<1>-8, -6, Map::TileBufferWidth, Map::TileBufferHeight)',
    ),
    (
        'ParseMoveSouth',
        r'(ParseMapDescription\s*\(\s*reader\s*,\s*events\s*,\s*)-8\s*,\s*\+?7\s*,\s*Map::TileBufferWidth\s*,\s*1\s*\)',
        r'\g<1>-8, -6, Map::TileBufferWidth, Map::TileBufferHeight)',
    ),
    (
        'ParseMoveWest',
        r'(ParseMapDescription\s*\(\s*reader\s*,\s*events\s*,\s*)-8\s*,\s*-6\s*,\s*1\s*,\s*Map::TileBufferHeight\s*\)',
        r'\g<1>-8, -6, Map::TileBufferWidth, Map::TileBufferHeight)',
    ),
]

for func_name, pattern, replacement in scroll_patches:
    new_src, n = re.subn(pattern, replacement, src)
    if n > 0:
        src = new_src
        changes += n
        print(f'Patched {func_name}: scroll → full 18x14 ({n} replacements)')
    else:
        print(f'WARN: {func_name} pattern not matched')

# =============================================================
# 2. FloorUp (0xBE) at z==7: read 1 floor instead of 6
# =============================================================
# Find ParseFloorChangeUp function and patch the floor loop
# The original code has a loop like:
#   for (int zIdx = 5; zIdx >= 0; zIdx--) {
#       ParseFloorDescription(reader, events, Position_.Z - zIdx);
#   }
# We need to add a condition: if transitioning from underground to surface,
# only read 1 floor (z=5).

# Strategy: Find the ParseFloorChangeUp function body and inject the condition
# before the existing floor loop.

floorup_pattern = r'(void\s+Parser::ParseFloorChangeUp\s*\([^)]*\)\s*\{)(.*?)(for\s*\(\s*int\s+zIdx\s*=\s*5\s*;\s*zIdx\s*>=\s*0\s*;\s*zIdx\s*--\s*\)\s*\{[^}]*ParseFloorDescription[^}]*\})'

def floorup_replacer(m):
    func_start = m.group(1)
    before_loop = m.group(2)
    original_loop = m.group(3)
    
    patched = (
        func_start + before_loop +
        '/* TibiaRelic: surface transition reads only 1 floor */\n'
        '    if (Position_.Z == 7) {\n'
        '        ParseFloorDescription(reader, events, 5);\n'
        '    } else {\n'
        '        ' + original_loop + '\n'
        '    }'
    )
    return patched

new_src, n = re.subn(floorup_pattern, floorup_replacer, src, flags=re.DOTALL)
if n > 0:
    src = new_src
    changes += n
    print(f'Patched ParseFloorChangeUp: added z==7 single-floor condition ({n} replacements)')
else:
    # Fallback: try simpler pattern matching
    # Look for the loop directly and wrap it
    simple_pattern = r'(for\s*\(\s*int\s+zIdx\s*=\s*5\s*;\s*zIdx\s*>=\s*0\s*;\s*zIdx\s*--\s*\)\s*\{[^}]*ParseFloorDescription[^}]*\})'
    
    def simple_replacer(m):
        original_loop = m.group(1)
        return (
            '/* TibiaRelic: surface transition reads only 1 floor */\n'
            '    if (Position_.Z == 7) {\n'
            '        ParseFloorDescription(reader, events, 5);\n'
            '    } else {\n'
            '        ' + original_loop + '\n'
            '    }'
        )
    
    new_src, n = re.subn(simple_pattern, simple_replacer, src, count=1, flags=re.DOTALL)
    if n > 0:
        src = new_src
        changes += n
        print(f'Patched FloorChangeUp (fallback): added z==7 condition ({n} replacements)')
    else:
        print('WARN: FloorChangeUp loop pattern not matched')

# Write result
with open(filepath, 'w') as f:
    f.write(src)

print(f'\nScroll+FloorUp patch complete: {changes} total changes applied')
