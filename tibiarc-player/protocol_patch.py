#!/usr/bin/env python3
"""
TibiaRelic protocol patches for tibiarc C++ engine.
Replaces all fragile sed commands with robust regex-based patching.

Patches applied:
  1. 0xAA ParseCreatureSpeak: unconditional SkipU32 (statementGuid)
  2. 0xA4 ParseSpellCooldown: SkipU32 → SkipU8 (5B → 2B)
  3. 0xA5 SpellGroupCooldown: separate from 0xA4, read 5B
  4. 0xA7 PlayerTactics: remove PvPMode (4B → 3B)
  5. 0xA8 CreatureSquare: add case, skip 5B
  6. 0xB6 WalkCancel: remove payload (2B → 0B)
  7. 0x92 CreatureImpassable: remove assert
  8. Diagnostic opcode logging
"""

import re
import sys

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

def patch_creature_speak(src):
    """0xAA: Inject unconditional SkipU32 for statementGuid right after function opening brace."""
    pattern = r'(void\s+Parser::ParseCreatureSpeak\s*\([^)]*\)\s*\{)'
    match = re.search(pattern, src)
    if not match:
        print("WARN: ParseCreatureSpeak not found")
        return src
    
    insert_pos = match.end()
    injection = "\n    /* TibiaRelic: unconditional u32 statementGuid */ reader.SkipU32();"
    
    # Check if already patched
    if "statementGuid" in src[insert_pos:insert_pos+200]:
        print("0xAA ParseCreatureSpeak: already patched")
        return src
    
    src = src[:insert_pos] + injection + src[insert_pos:]
    print("OK: 0xAA ParseCreatureSpeak — injected unconditional SkipU32 for statementGuid")
    return src

def patch_spell_cooldown(src):
    """0xA4: Change SkipU32 to SkipU8 inside ParseSpellCooldown."""
    pattern = r'(void\s+Parser::ParseSpellCooldown\s*\([^)]*\)\s*\{)(.*?)(^\})'
    match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
    if not match:
        print("WARN: ParseSpellCooldown not found")
        return src
    
    body = match.group(2)
    new_body = body.replace('reader.SkipU32()', 'reader.SkipU8() /* TibiaRelic: 2B instead of 5B */')
    if new_body == body:
        if 'SkipU8' in body:
            print("0xA4 ParseSpellCooldown: already patched")
        else:
            print("WARN: SkipU32 not found in ParseSpellCooldown")
        return src
    
    src = src[:match.start(2)] + new_body + src[match.end(2):]
    print("OK: 0xA4 ParseSpellCooldown — SkipU32 → SkipU8")
    return src

def patch_spell_group_cooldown(src):
    """0xA5: If it shares case with 0xA4, split it into its own case reading 5B."""
    # Check if 0xA5 falls through to 0xA4 (shared handler)
    # Pattern: case 0xA5:\n    case 0xA4: or case 0xA5: followed by case 0xA4:
    pattern_shared = r'(case\s+0xA5\s*:\s*\n\s*)(case\s+0xA4\s*:)'
    match = re.search(pattern_shared, src)
    if match:
        # Replace the fallthrough with a standalone case
        replacement = (
            "case 0xA5:\n"
            "        /* TibiaRelic: SpellGroupCooldown 5B (u8 groupId + u32 delay) */\n"
            "        reader.Skip(5);\n"
            "        break;\n"
            "    " + match.group(2)
        )
        src = src[:match.start()] + replacement + src[match.end():]
        print("OK: 0xA5 SpellGroupCooldown — separated from 0xA4, reads 5B")
        return src
    
    # Check if 0xA5 already has its own handler
    if re.search(r'case\s+0xA5\s*:.*?break;', src, re.DOTALL):
        print("0xA5 SpellGroupCooldown: already has standalone handler")
        return src
    
    # If 0xA5 doesn't exist at all, add it before 0xA4
    pattern_a4 = r'(\s*case\s+0xA4\s*:)'
    match_a4 = re.search(pattern_a4, src)
    if match_a4:
        insertion = (
            "\n    case 0xA5:\n"
            "        /* TibiaRelic: SpellGroupCooldown 5B (u8 groupId + u32 delay) */\n"
            "        reader.Skip(5);\n"
            "        break;"
        )
        src = src[:match_a4.start()] + insertion + src[match_a4.start():]
        print("OK: 0xA5 SpellGroupCooldown — added new case before 0xA4, reads 5B")
    else:
        print("WARN: case 0xA4 not found, cannot add 0xA5")
    
    return src

def patch_player_tactics(src):
    """0xA7: Remove PvPMode line from ParsePlayerTactics (4B → 3B)."""
    pattern = r'(void\s+Parser::ParsePlayerTactics\s*\([^)]*\)\s*\{)(.*?)(^\})'
    match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
    if not match:
        print("WARN: ParsePlayerTactics not found")
        return src
    
    body = match.group(2)
    lines = body.split('\n')
    new_lines = [l for l in lines if 'PvPMode' not in l and 'pvpMode' not in l and 'pvp_mode' not in l]
    
    if len(new_lines) == len(lines):
        print("0xA7 PlayerTactics: no PvPMode line found (may already be patched)")
        return src
    
    new_body = '\n'.join(new_lines)
    src = src[:match.start(2)] + new_body + src[match.end(2):]
    print("OK: 0xA7 PlayerTactics — removed PvPMode (4B → 3B)")
    return src

def patch_creature_square(src):
    """0xA8: Add case before 0xAA if missing."""
    if re.search(r'case\s+0xA8\s*:', src):
        print("0xA8 CreatureSquare: already present")
        return src
    
    # Insert before case 0xAA
    pattern = r'(\s*case\s+0xAA\s*:)'
    match = re.search(pattern, src)
    if not match:
        print("WARN: case 0xAA not found, cannot add 0xA8")
        return src
    
    insertion = (
        "\n    case 0xA8:\n"
        "        /* TibiaRelic: CreatureSquare (u32 creatureId + u8 color) */\n"
        "        reader.Skip(5);\n"
        "        break;"
    )
    src = src[:match.start()] + insertion + src[match.start():]
    print("OK: 0xA8 CreatureSquare — added case, 5B")
    return src

def patch_walk_cancel(src):
    """0xB6: Remove ParseMoveDelay call (2B → 0B)."""
    # Find case 0xB6 and replace the ParseMoveDelay call in the next line
    pattern = r'(case\s+0xB6\s*:\s*\n\s*)(\S.*ParseMoveDelay.*)'
    match = re.search(pattern, src)
    if match:
        src = src[:match.start(2)] + "/* TibiaRelic: WalkCancel 0 bytes (no payload) */" + src[match.end(2):]
        print("OK: 0xB6 WalkCancel — removed ParseMoveDelay (2B → 0B)")
        return src
    
    # Also try: the handler might call a function directly
    pattern2 = r'(case\s+0xB6\s*:\s*\n\s*)(.*?)(break;)'
    match2 = re.search(pattern2, src, re.DOTALL)
    if match2:
        body = match2.group(2)
        if 'WalkCancel 0 bytes' in body or 'TibiaRelic' in body:
            print("0xB6 WalkCancel: already patched")
            return src
        # Replace body with comment
        src = src[:match2.start(2)] + "/* TibiaRelic: WalkCancel 0 bytes */\n        " + src[match2.start(3):]
        print("OK: 0xB6 WalkCancel — removed payload")
        return src
    
    print("WARN: case 0xB6 not found")
    return src

def patch_creature_impassable(src):
    """0x92: Remove ParseAssert for PassableCreatures."""
    if 'ParseAssert(Version_.Protocol.PassableCreatures)' in src:
        src = src.replace('ParseAssert(Version_.Protocol.PassableCreatures);', 
                         '/* TibiaRelic: removed PassableCreatures assert */')
        print("OK: 0x92 CreatureImpassable — removed assert")
    else:
        print("0x92 CreatureImpassable: assert already removed or not present")
    return src

def patch_diagnostic_logging(src):
    """Add diagnostic opcode logging to main switch."""
    if '[DIAG] opcode' in src:
        print("Diagnostic logging: already present")
        return src
    
    # Replace: switch (reader.ReadU8()) {
    # With: auto _op = reader.ReadU8(); printf(...); switch (_op) {
    pattern = r'switch\s*\(reader\.ReadU8\(\)\)\s*\{'
    match = re.search(pattern, src)
    if match:
        replacement = 'auto _op = reader.ReadU8(); printf("[DIAG] opcode=0x%02X rem=%zu\\n", _op, reader.Remaining()); switch (_op) {'
        src = src[:match.start()] + replacement + src[match.end():]
        print("OK: Diagnostic opcode logging added")
    else:
        print("WARN: main opcode switch not found for diagnostic logging")
    return src


def patch_player_stats(src):
    """0xA0: Remove Stamina ReadU16 from ParsePlayerStats (TibiaRelic 7.72 has no stamina)."""
    pattern = r'(void\s+Parser::ParsePlayerStats\s*\([^)]*\)\s*\{)(.*?)(^\})'
    match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
    if not match:
        print("WARN: ParsePlayerStats not found")
        return src
    
    body = match.group(2)
    # Look for Stamina line (various naming conventions)
    stamina_patterns = [
        r'.*[Ss]tamina.*=.*reader\.ReadU16\(\).*\n',
        r'.*[Ss]tamina.*=.*reader\.Read<uint16_t>\(\).*\n',
        r'\s*Stamina_\s*=\s*reader\.\w+\(\);\s*\n',
    ]
    
    new_body = body
    for sp in stamina_patterns:
        new_body = re.sub(sp, '    /* TibiaRelic: no stamina in 7.72 */\n', new_body, count=1)
        if new_body != body:
            break
    
    if new_body == body:
        if 'TibiaRelic: no stamina' in body:
            print("0xA0 ParsePlayerStats: already patched")
        else:
            print("WARN: Stamina line not found in ParsePlayerStats")
        return src
    
    src = src[:match.start(2)] + new_body + src[match.end(2):]
    print("OK: 0xA0 ParsePlayerStats — removed Stamina ReadU16")
    return src


def patch_map_description_guard(src):
    """0x64: Add early return guard for mini MapDescription packets (< 100B)."""
    pattern = r'(void\s+Parser::ParseMapDescription\s*\([^)]*\)\s*\{)'
    match = re.search(pattern, src)
    if not match:
        print("WARN: ParseMapDescription not found")
        return src
    
    # Check if already patched
    if 'Remaining() < 100' in src[match.end():match.end()+500]:
        print("0x64 MapDescription guard: already patched")
        return src
    
    # Find the position after reading X,Y coordinates (ReadU16 calls)
    func_start = match.end()
    # Look for the second ReadU16 (Y coordinate) after function start
    read_pattern = re.compile(r'(reader\.ReadU16\(\)\s*;)')
    reads = list(read_pattern.finditer(src, func_start, func_start + 500))
    
    if len(reads) >= 2:
        insert_pos = reads[1].end()
        injection = (
            "\n    /* TibiaRelic: guard against mini MAP_DESC (position-only, ~5B) */\n"
            "    if (reader.Remaining() < 100) {\n"
            "        return;\n"
            "    }\n"
        )
        src = src[:insert_pos] + injection + src[insert_pos:]
        print("OK: 0x64 MapDescription — added <100B early return guard")
    else:
        print("WARN: Could not find ReadU16 pair in ParseMapDescription")
    
    return src


def patch_multi_use_delay(src):
    """0xA6: Add case for MultiUseDelay (4B = u32 delay)."""
    if re.search(r'case\s+0xA6\s*:', src):
        print("0xA6 MultiUseDelay: already present")
        return src
    
    # Insert before case 0xA7
    pattern = r'(\s*case\s+0xA7\s*:)'
    match = re.search(pattern, src)
    if not match:
        # Try before 0xA8
        pattern = r'(\s*case\s+0xA8\s*:)'
        match = re.search(pattern, src)
    if not match:
        print("WARN: case 0xA7/0xA8 not found, cannot add 0xA6")
        return src
    
    insertion = (
        "\n    case 0xA6:\n"
        "        /* TibiaRelic: MultiUseDelay (u32 delay) */\n"
        "        reader.SkipU32();\n"
        "        break;"
    )
    src = src[:match.start()] + insertion + src[match.start():]
    print("OK: 0xA6 MultiUseDelay — added case, 4B")
    return src


def patch_creature_turn(src):
    """0x63: Add case for CreatureTurn (5B = u32 creatureId + u8 direction)."""
    if re.search(r'case\s+0x63\s*:', src):
        print("0x63 CreatureTurn: already present")
        return src
    
    # Insert before case 0x64
    pattern = r'(\s*case\s+0x64\s*:)'
    match = re.search(pattern, src)
    if not match:
        print("WARN: case 0x64 not found, cannot add 0x63")
        return src
    
    insertion = (
        "\n    case 0x63:\n"
        "        /* TibiaRelic: CreatureTurn (u32 creatureId + u8 direction) */\n"
        "        reader.Skip(5);\n"
        "        break;"
    )
    src = src[:match.start()] + insertion + src[match.start():]
    print("OK: 0x63 CreatureTurn — added case, 5B")
    return src


def patch_outfit_window(src):
    """0xC8: Change ReadU16 to ReadU8 for RangeStart/RangeEnd in ParseOutfitWindow."""
    pattern = r'(void\s+Parser::ParseOutfitWindow\s*\([^)]*\)\s*\{)(.*?)(^\})'
    match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
    if not match:
        print("WARN: ParseOutfitWindow not found")
        return src
    
    body = match.group(2)
    
    # Replace ReadU16 for RangeStart and RangeEnd
    new_body = body
    range_pattern = r'(Range(?:Start|End)\s*=\s*reader\.)ReadU16(\(\))'
    new_body = re.sub(range_pattern, r'\1ReadU8\2 /* TibiaRelic: u8 range */', new_body)
    
    if new_body == body:
        if 'ReadU8' in body and 'Range' in body:
            print("0xC8 OutfitWindow: already patched")
        else:
            # Try alternative patterns
            new_body = body.replace('reader.ReadU16()', 'reader.ReadU8() /* TibiaRelic: u8 range */', 2)
            # Only replace the last 2 ReadU16 (RangeStart and RangeEnd), skip outfit ones
            # Actually let's be more precise - find the last two ReadU16 in the body
            u16_positions = [(m.start(), m.end()) for m in re.finditer(r'reader\.ReadU16\(\)', body)]
            if len(u16_positions) >= 2:
                # Replace last two occurrences (RangeStart, RangeEnd)
                for start, end in reversed(u16_positions[-2:]):
                    body = body[:start] + 'reader.ReadU8() /* TibiaRelic: u8 range */' + body[end:]
                new_body = body
            else:
                print("WARN: Could not find ReadU16 for Range in ParseOutfitWindow")
                return src
    
    src = src[:match.start(2)] + new_body + src[match.end(2):]
    print("OK: 0xC8 OutfitWindow — ReadU16 → ReadU8 for RangeStart/RangeEnd")
    return src


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 protocol_patch.py <path-to-parser.cpp>")
        sys.exit(1)
    
    filepath = sys.argv[1]
    src = read_file(filepath)
    original = src
    
    print("=" * 60)
    print("TibiaRelic Protocol Patches")
    print("=" * 60)
    
    # Apply patches in order — creature_speak MUST be first (most critical)
    src = patch_creature_speak(src)
    src = patch_spell_cooldown(src)
    src = patch_spell_group_cooldown(src)
    src = patch_player_tactics(src)
    src = patch_creature_square(src)
    src = patch_walk_cancel(src)
    src = patch_creature_impassable(src)
    src = patch_diagnostic_logging(src)
    # New patches (audit round 2)
    src = patch_player_stats(src)
    src = patch_map_description_guard(src)
    src = patch_multi_use_delay(src)
    src = patch_creature_turn(src)
    src = patch_outfit_window(src)
    
    if src == original:
        print("\nWARN: No changes were made!")
        sys.exit(1)
    
    write_file(filepath, src)
    
    print("=" * 60)
    print("All protocol patches applied successfully")
    print("=" * 60)


if __name__ == '__main__':
    main()
