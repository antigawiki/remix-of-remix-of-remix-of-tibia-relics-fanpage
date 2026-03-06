#!/usr/bin/env python3
"""
Patch ParseFloorChangeUp in tibiarc's parser.cpp to read 3 floors
when transitioning from underground to surface (z=8→7).

The original code reads only 1 floor (z=5). The TibiaRelic server
sends 3 floors (z=5, 6, 7) — symmetric to ParseFloorChangeDown
which reads z=8, 9, 10 when entering underground.
"""
import re
import sys

def patch(path: str):
    with open(path, 'r') as f:
        src = f.read()

    # Find the ParseFloorChangeUp function
    # The original code for the z==7 branch looks like:
    #   if (Position_.z == 7) {
    #       int skip = 0;
    #       ParseFloorDescription(reader, ..., Position_.z - 2, 18, 14, 3, skip);
    #   }
    # We need to replace the single ParseFloorDescription call with a 3-floor loop.

    # Pattern: match the z==7 block inside ParseFloorChangeUp
    # We look for the single ParseFloorDescription call after "Position_.z == 7"
    pattern = re.compile(
        r'(void\s+Parser::ParseFloorChangeUp.*?\n)'  # function start
        r'(.*?)'  # everything before z==7 block
        r'(if\s*\(\s*Position_\.z\s*==\s*7\s*\)\s*\{)'  # z==7 condition
        r'(.*?)'  # body of z==7 block (single floor read)
        r'(\})',  # closing brace
        re.DOTALL
    )

    match = pattern.search(src)
    if not match:
        # Try alternative: maybe it uses newZ or different variable names
        # Fallback: do a simpler replacement of the single-floor call
        # Look for the pattern more broadly
        alt_pattern = re.compile(
            r'(if\s*\(\s*Position_\.z\s*==\s*7\s*\)\s*\{)'
            r'(\s*int\s+skip\s*=\s*0\s*;)'
            r'(\s*ParseFloorDescription\s*\([^;]+;\s*)'
            r'(\s*\})',
            re.DOTALL
        )
        alt_match = alt_pattern.search(src)
        if alt_match:
            old_block = alt_match.group(0)
            new_block = """if (Position_.z == 7) {
            // TibiaRelic: read 3 floors (z=5,6,7) symmetric to FloorDown
            int skip = 0;
            int j = 3;
            for (int nz = std::max(Position_.z - 2, 0); nz <= Position_.z; nz++) {
                skip = ParseFloorDescription(reader, Position_.x - 8, Position_.y - 6, nz, 18, 14, j, skip);
                if (skip < 0) { skip = 0; break; }
                j--;
            }
        }"""
            src = src.replace(old_block, new_block, 1)
            with open(path, 'w') as f:
                f.write(src)
            print(f"FloorUp patch applied (alt pattern) in {path}")
            return True

        print(f"WARNING: Could not find ParseFloorChangeUp z==7 block in {path}")
        print("Attempting line-by-line search...")

        # Last resort: find any single ParseFloorDescription in the z==7 context
        lines = src.split('\n')
        in_floorup = False
        in_z7_block = False
        brace_depth = 0
        replaced = False

        for i, line in enumerate(lines):
            if 'ParseFloorChangeUp' in line and 'void' in line:
                in_floorup = True
            if in_floorup and 'Position_.z == 7' in line:
                in_z7_block = True
                brace_depth = 0
            if in_z7_block:
                brace_depth += line.count('{') - line.count('}')
                if 'ParseFloorDescription' in line and 'for' not in lines[max(0,i-3):i+1]:
                    # Replace single call with loop
                    indent = '            '
                    lines[i] = f"""{indent}// TibiaRelic: read 3 floors (z=5,6,7) symmetric to FloorDown
{indent}int j = 3;
{indent}for (int nz = std::max(Position_.z - 2, 0); nz <= Position_.z; nz++) {{
{indent}    skip = ParseFloorDescription(reader, Position_.x - 8, Position_.y - 6, nz, 18, 14, j, skip);
{indent}    if (skip < 0) {{ skip = 0; break; }}
{indent}    j--;
{indent}}}"""
                    replaced = True
                    break
                if brace_depth <= 0 and '{' in line:
                    in_z7_block = False

        if replaced:
            src = '\n'.join(lines)
            with open(path, 'w') as f:
                f.write(src)
            print(f"FloorUp patch applied (line-by-line) in {path}")
            return True

        print("ERROR: FloorUp patch FAILED - no matching pattern found")
        return False

    # Primary pattern matched
    old_body = match.group(4)
    new_body = """
            // TibiaRelic: read 3 floors (z=5,6,7) symmetric to FloorDown
            int skip = 0;
            int j = 3;
            for (int nz = std::max(Position_.z - 2, 0); nz <= Position_.z; nz++) {
                skip = ParseFloorDescription(reader, Position_.x - 8, Position_.y - 6, nz, 18, 14, j, skip);
                if (skip < 0) { skip = 0; break; }
                j--;
            }
    """
    old_block = match.group(3) + old_body + match.group(5)
    new_block = match.group(3) + new_body + match.group(5)
    src = src.replace(old_block, new_block, 1)

    with open(path, 'w') as f:
        f.write(src)
    print(f"FloorUp patch applied (primary pattern) in {path}")
    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 floorup_patch.py <path/to/parser.cpp>")
        sys.exit(1)
    success = patch(sys.argv[1])
    sys.exit(0 if success else 1)
