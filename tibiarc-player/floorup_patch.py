#!/usr/bin/env python3
"""
Patch ParseFloorChangeUp in tibiarc's parser.cpp to read 3 floors
when transitioning from underground to surface (z=8→7).

Uses simple string search instead of fragile regex patterns.
"""
import sys

def patch(path: str):
    with open(path, 'r') as f:
        lines = f.readlines()

    # Step 1: Find ParseFloorChangeUp function
    func_start = -1
    for i, line in enumerate(lines):
        if 'ParseFloorChangeUp' in line and ('void' in line or '::' in line):
            func_start = i
            break

    if func_start < 0:
        print("WARN: ParseFloorChangeUp function not found, trying broader search")
        for i, line in enumerate(lines):
            if 'FloorChangeUp' in line:
                func_start = i
                break

    if func_start < 0:
        print("ERROR: No FloorChangeUp reference found at all")
        # Don't exit 1 - just warn and continue build
        return False

    print(f"Found FloorChangeUp at line {func_start + 1}")

    # Step 2: Find "z == 7" condition after func_start
    z7_line = -1
    for i in range(func_start, min(func_start + 100, len(lines))):
        stripped = lines[i].replace(' ', '')
        if 'z==7' in stripped or 'z>=7' in stripped or '.z==7' in stripped:
            z7_line = i
            break

    if z7_line < 0:
        print("WARN: z==7 condition not found in FloorChangeUp")
        # Try even broader: any z==7 near a ParseFloorDescription
        for i in range(func_start, min(func_start + 150, len(lines))):
            if '== 7' in lines[i]:
                z7_line = i
                print(f"  Found '== 7' at line {i + 1}: {lines[i].rstrip()}")
                break

    if z7_line < 0:
        print("ERROR: Could not find z==7 block in FloorChangeUp")
        return False

    print(f"Found z==7 at line {z7_line + 1}: {lines[z7_line].rstrip()}")

    # Step 3: Find the single ParseFloorDescription call after z==7
    # and replace it with a 3-floor loop
    pfd_line = -1
    brace_depth = 0
    block_started = False
    for i in range(z7_line, min(z7_line + 20, len(lines))):
        if '{' in lines[i]:
            brace_depth += lines[i].count('{')
            block_started = True
        if '}' in lines[i]:
            brace_depth -= lines[i].count('}')
        if 'ParseFloorDescription' in lines[i]:
            # Check it's not already patched (no 'for' loop nearby)
            context = ''.join(lines[max(z7_line, i-3):i+1])
            if 'for' in context and 'nz' in context:
                print("FloorUp patch already applied, skipping")
                return True
            pfd_line = i
            break
        if block_started and brace_depth <= 0:
            break

    if pfd_line < 0:
        print("ERROR: ParseFloorDescription not found after z==7")
        return False

    print(f"Found ParseFloorDescription at line {pfd_line + 1}: {lines[pfd_line].rstrip()}")

    # Step 4: Determine indent from existing line
    existing = lines[pfd_line]
    indent = ''
    for ch in existing:
        if ch in ' \t':
            indent += ch
        else:
            break

    # Step 5: Find the full extent of the ParseFloorDescription call
    # It may span multiple lines (ending with ";")
    call_end = pfd_line
    for i in range(pfd_line, min(pfd_line + 10, len(lines))):
        if ';' in lines[i]:
            call_end = i
            break

    print(f"ParseFloorDescription call spans lines {pfd_line + 1} to {call_end + 1}")

    # Step 6: Replace ALL lines of the call with the 3-floor loop
    # NOTE: tibiarc uses uppercase Position_.X, .Y, .Z
    replacement = (
        f"{indent}// TibiaRelic: read 3 floors (z=5,6,7) symmetric to FloorDown\n"
        f"{indent}int skip2 = 0;\n"
        f"{indent}int j = 3;\n"
        f"{indent}for (int nz = std::max(Position_.Z - 2, 0); nz <= Position_.Z; nz++) {{\n"
        f"{indent}    skip2 = ParseFloorDescription(reader, Position_.X - 8, Position_.Y - 6, nz, 18, 14, j, skip2);\n"
        f"{indent}    if (skip2 < 0) {{ skip2 = 0; break; }}\n"
        f"{indent}    j--;\n"
        f"{indent}}}\n"
    )

    # Replace from pfd_line to call_end (inclusive)
    lines[pfd_line:call_end + 1] = [replacement]
    
    with open(path, 'w') as f:
        f.writelines(lines)
    
    print(f"FloorUp patch applied successfully at line {pfd_line + 1}")
    return True


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 floorup_patch.py <path/to/parser.cpp>")
        sys.exit(1)
    success = patch(sys.argv[1])
    # Exit 0 even on failure to not block the build
    if not success:
        print("WARNING: FloorUp patch was NOT applied but build continues")
    sys.exit(0)
