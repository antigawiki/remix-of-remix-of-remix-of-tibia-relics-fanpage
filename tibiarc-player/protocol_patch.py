#!/usr/bin/env python3
"""
TibiaRelic protocol patches for tibiarc C++ engine.
Replaces all fragile sed commands with robust regex-based patching.

NOTE: 0xB6 WalkCancel is NOT patched — TibiaRelic sends standard 2B (ParseMoveDelay).
  1. 0xA4 ParseSpellCooldown: SkipU32 → SkipU8 (5B → 2B)
  2. 0xA5 SpellGroupCooldown: separate from 0xA4, read 5B
  3. 0xA7 PlayerTactics: remove PvPMode (4B → 3B)
  4. 0xA8 CreatureSquare: add case, skip 5B
  5. 0xB6 WalkCancel: KEEP standard ParseMoveDelay (2B) — do NOT remove
  6. 0x92 CreatureImpassable: remove assert
  7. 0x63 CreatureTurn: add as top-level opcode (u32 creatureId + u8 dir)
  8. Diagnostic opcode logging

NOTE: The following patches were REMOVED because the antigawiki/tibiarc fork
already handles them correctly via version flags or existing code:
  - 0xAA ParseCreatureSpeak: ReportMessages=true for 7.72 already reads u32
  - 0xA0 PlayerStats: Stamina=false for 7.72, not read
  - 0x64 MapDescription guard: already in fork
  - 0xA6 MultiUseDelay: case 0xA6 already exists in fork
  - 0xC8 OutfitWindow: handled by OutfitsU16 version flag
"""

import re
import sys

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

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
    pattern_shared = r'(case\s+0xA5\s*:\s*\n\s*)(case\s+0xA4\s*:)'
    match = re.search(pattern_shared, src)
    if match:
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
    
    if re.search(r'case\s+0xA5\s*:.*?break;', src, re.DOTALL):
        print("0xA5 SpellGroupCooldown: already has standalone handler")
        return src
    
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
    """0xB6: KEEP standard ParseMoveDelay (2B) — TibiaRelic sends move delay like standard 7.72."""
    # Check if we previously removed it — if so, restore it
    if 'WalkCancel 0 bytes' in src:
        src = src.replace('/* TibiaRelic: WalkCancel 0 bytes (no payload) */', 'ParseMoveDelay(reader, events);')
        src = src.replace('/* TibiaRelic: WalkCancel 0 bytes */\n        ', '')
        print("OK: 0xB6 WalkCancel — restored ParseMoveDelay (2B, standard 7.72)")
        return src
    
    print("0xB6 WalkCancel: already has ParseMoveDelay (standard 7.72)")
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
    
    pattern = r'switch\s*\(reader\.ReadU8\(\)\)\s*\{'
    match = re.search(pattern, src)
    if match:
        replacement = 'auto _op = reader.ReadU8(); printf("[DIAG] opcode=0x%02X rem=%zu\\n", _op, reader.Remaining()); switch (_op) {'
        src = src[:match.start()] + replacement + src[match.end():]
        print("OK: Diagnostic opcode logging added")
    else:
        print("WARN: main opcode switch not found for diagnostic logging")
    return src

def patch_creature_turn(src):
    """0x63: Add CreatureTurn as top-level opcode (u32 creatureId + u8 direction = 5 bytes).
    TibiaRelic sends this standalone when creatures change direction."""
    if re.search(r'case\s+0x63\s*:', src):
        print("0x63 CreatureTurn: already present as top-level case")
        return src
    
    pattern = r'(\s*case\s+0x64\s*:)'
    match = re.search(pattern, src)
    if not match:
        print("WARN: case 0x64 not found, cannot add 0x63")
        return src
    
    insertion = (
        "\n    case 0x63:\n"
        "        /* TibiaRelic: CreatureTurn as top-level opcode (u32 creatureId + u8 dir) */\n"
        "        reader.Skip(5);\n"
        "        break;"
    )
    src = src[:match.start()] + insertion + src[match.start():]
    print("OK: 0x63 CreatureTurn — added as top-level opcode, 5B")
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
    
    # Apply only validated patches (redundant/broken ones removed)
    src = patch_spell_cooldown(src)
    src = patch_spell_group_cooldown(src)
    src = patch_player_tactics(src)
    src = patch_creature_square(src)
    src = patch_walk_cancel(src)
    src = patch_creature_impassable(src)
    src = patch_creature_turn(src)
    src = patch_diagnostic_logging(src)
    
    if src == original:
        print("\nAll patches already applied — no changes needed")
        sys.exit(0)
    
    write_file(filepath, src)
    
    print("=" * 60)
    print("All protocol patches applied successfully")
    print("=" * 60)


if __name__ == '__main__':
    main()
