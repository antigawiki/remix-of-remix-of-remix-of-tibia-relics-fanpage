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

def patch_remove_diagnostic_logging(src):
    """Remove diagnostic printf logging if present (kills performance)."""
    if '[DIAG] opcode' not in src:
        print("Diagnostic logging: not present, nothing to remove")
        return src
    
    # Revert the diagnostic wrapper back to plain ReadU8
    pattern = r'auto _op = reader\.ReadU8\(\);\s*printf\("\[DIAG\][^"]*"[^;]*;\s*switch\s*\(_op\)\s*\{'
    match = re.search(pattern, src)
    if match:
        src = src[:match.start()] + 'switch (reader.ReadU8()) {' + src[match.end():]
        print("OK: Diagnostic printf logging removed")
    else:
        print("WARN: could not find diagnostic pattern to remove")
    return src


def patch_parse_loop_recovery(src):
    """Wrap the main opcode switch in a per-iteration try-catch inside Parser::Parse().
    
    This ensures that if any single opcode throws, the events already accumulated
    in the vector are preserved. Also changes 'default: throw' to 'default: break'
    so unknown opcodes stop parsing without destroying accumulated events.
    """
    # Step 1: Change default case from throw to a safe break-out
    # The tibiarc default case typically throws an exception
    # We replace it with setting a flag and breaking
    
    # First check if already patched
    if '/* TibiaRelic: per-opcode recovery */' in src:
        print("Parse loop recovery: already patched")
        return src
    
    # Step 2: Find the main while loop in Parser::Parse and wrap switch body in try-catch
    # Pattern: while (reader.Remaining() > 0) { switch (...) { ... } }
    # We need to add try { before switch and } catch (...) { break; } after the switch closing brace
    
    # Find "while" loop pattern in Parser::Parse
    # The pattern varies, but typically: while (reader.Remaining() > 0) {
    pattern_while = r'(while\s*\(\s*reader\.Remaining\(\)\s*>\s*0\s*\)\s*\{)\s*\n(\s*)(switch\s*\()'
    match = re.search(pattern_while, src)
    if not match:
        # Try alternate pattern
        pattern_while = r'(while\s*\(\s*reader\.Remaining\(\)\s*>\s*0\s*\)\s*\{)\s*\n(\s*)(auto\s+_op.*?switch\s*\()'
        match = re.search(pattern_while, src, re.DOTALL)
    
    if not match:
        print("WARN: main while loop not found in Parser::Parse — cannot add recovery")
        return src
    
    indent = match.group(2)
    
    # Insert try { before the switch
    new_code = match.group(1) + '\n' + indent + '/* TibiaRelic: per-opcode recovery */\n' + indent + 'try {\n' + indent + match.group(3)
    src = src[:match.start()] + new_code + src[match.end():]
    
    # Now find the closing of the switch statement's closing brace + the while's closing brace
    # We need to add } catch (...) { break; } after the switch's closing }
    # This is tricky with regex, so we look for the default case pattern instead
    
    # Step 3: Change default throw to break
    # Common patterns: "default:\n  throw" or "default:\n  TIBIARC_RAISE"
    default_patterns = [
        (r'(default\s*:\s*\n\s*)(TIBIARC_RAISE\s*\([^)]*\)\s*;)', 
         r'\1break; /* TibiaRelic: unknown opcode, stop but preserve events */'),
        (r'(default\s*:\s*\n\s*)(throw\s+[^;]*;)',
         r'\1break; /* TibiaRelic: unknown opcode, stop but preserve events */'),
        (r'(default\s*:\s*{?\s*\n\s*)(throw\s+[^;]*;)',
         r'\1break; /* TibiaRelic: unknown opcode, stop but preserve events */'),
    ]
    
    default_patched = False
    for pat, repl in default_patterns:
        if re.search(pat, src):
            src = re.sub(pat, repl, src, count=1)
            default_patched = True
            print("OK: default case changed from throw to break")
            break
    
    if not default_patched:
        print("WARN: default throw pattern not found (may already be safe)")
    
    # Step 4: Add catch block after the switch's closing brace
    # Find the pattern: break;\n    }\n  } — end of last case + switch close + while close
    # We insert } catch (...) { break; } between switch close and while close
    # 
    # Strategy: find "per-opcode recovery" marker position, then find the next 
    # occurrence of "\n<indent>}\n" repeated (switch close then while close)
    marker_pos = src.find('/* TibiaRelic: per-opcode recovery */')
    if marker_pos == -1:
        print("WARN: recovery marker not found after insertion")
        return src
    
    # Find the while loop's closing brace by counting braces from the marker
    brace_depth = 0
    search_start = src.find('{', marker_pos)  # the while's opening brace
    if search_start == -1:
        print("WARN: could not find opening brace after marker")
        return src
    
    # We need to find the switch's closing brace (depth returns to 1 from 2)
    # Start after the try {
    try_pos = src.find('try {', marker_pos)
    if try_pos == -1:
        print("WARN: try block not found")
        return src
    
    pos = try_pos + 4  # after 'try {'
    depth = 1  # we're inside try {
    switch_close_pos = -1
    
    while pos < len(src) and depth > 0:
        ch = src[pos]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                switch_close_pos = pos
                break
        pos += 1
    
    if switch_close_pos == -1:
        print("WARN: could not find switch closing brace")
        return src
    
    # Insert catch block after the switch's closing brace (which is now the try's content)
    catch_block = '\n' + indent + '} catch (...) {\n' + indent + '    break; /* TibiaRelic: preserve events already parsed */\n' + indent + '}'
    src = src[:switch_close_pos + 1] + catch_block + src[switch_close_pos + 1:]
    
    print("OK: Parse loop recovery — try-catch per-opcode + default break")
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


def patch_text_window(src):
    """0x96 TextWindow: Ensure it reads 2 strings (not 1).
    tibiarc may use SkipString or Skip16String — we need TWO of them."""
    pattern = r'(void\s+Parser::ParseTextWindow\s*\([^)]*\)\s*\{)(.*?)(^\})'
    match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
    if not match:
        # Try to find the case handler inline
        if 'TibiaRelic: TextWindow 2 strings' in src:
            print("0x96 TextWindow: already patched")
            return src
        print("WARN: ParseTextWindow not found — check inline handler")
        return src
    
    body = match.group(2)
    # Count string reads
    string_reads = len(re.findall(r'(ReadString|SkipString|Skip16String)', body))
    if string_reads >= 2:
        print("0x96 TextWindow: already reads 2+ strings")
        return src
    
    print("WARN: 0x96 TextWindow needs manual review — found %d string reads" % string_reads)
    return src


def patch_rule_violation_opcodes(src):
    """Fix 0xAE, 0xAF, 0xB0 byte consumption in the switch statement.
    0xAE: should read u16 (2 bytes)
    0xAF: should read string
    0xB0: should read string (not fixed 2 bytes)
    """
    already_patched = 'TibiaRelic: RuleViolChannel' in src
    if already_patched:
        print("0xAE/0xAF/0xB0 RuleViolation: already patched")
        return src
    
    # 0xAE: Add case if missing
    if not re.search(r'case\s+0xAE\s*:', src):
        pattern = r'(\s*case\s+0xAA\s*:)'
        match = re.search(pattern, src)
        if match:
            insertion = (
                "\n    case 0xAE:\n"
                "        /* TibiaRelic: RuleViolChannel (u16 channelId) */\n"
                "        reader.SkipU16();\n"
                "        break;"
            )
            src = src[:match.start()] + insertion + src[match.start():]
            print("OK: 0xAE RuleViolChannel — added case, 2B")
    else:
        print("0xAE: case already exists")
    
    # 0xAF: Add case if missing
    if not re.search(r'case\s+0xAF\s*:', src):
        pattern = r'(\s*case\s+0xAA\s*:)'
        match = re.search(pattern, src)
        if match:
            insertion = (
                "\n    case 0xAF:\n"
                "        /* TibiaRelic: RemoveReport (string playerName) */\n"
                "        reader.SkipString();\n"
                "        break;"
            )
            src = src[:match.start()] + insertion + src[match.start():]
            print("OK: 0xAF RemoveReport — added case, string")
    else:
        print("0xAF: case already exists")
    
    # 0xB0: Add case if missing
    if not re.search(r'case\s+0xB0\s*:', src):
        pattern = r'(\s*case\s+0xAA\s*:)'
        match = re.search(pattern, src)
        if match:
            insertion = (
                "\n    case 0xB0:\n"
                "        /* TibiaRelic: RuleViolCancel (string playerName) */\n"
                "        reader.SkipString();\n"
                "        break;"
            )
            src = src[:match.start()] + insertion + src[match.start():]
            print("OK: 0xB0 RuleViolCancel — added case, string")
    else:
        print("0xB0: case already exists")
    
    return src


def patch_talk_type6(src):
    """0xAA Talk: Ensure type 6 (rule violation) reads u16 channel.
    In ParseCreatureSpeak, talk type 6 must consume a u16."""
    if 'TibiaRelic: talk type 6' in src:
        print("0xAA Talk type 6: already patched")
        return src
    
    # Find ParseCreatureSpeak and look for the type switch
    pattern = r'(void\s+Parser::ParseCreatureSpeak\s*\([^)]*\)\s*\{)(.*?)(^\})'
    match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
    if not match:
        print("WARN: ParseCreatureSpeak not found")
        return src
    
    body = match.group(2)
    # Look for case 5 (channel types) and add case 6 next to it
    # Pattern: "case 5:" or "case 0x05:" 
    case5_pattern = r'(case\s+(?:5|0x05)\s*:)'
    case5_match = re.search(case5_pattern, body)
    if case5_match:
        # Check if case 6 already exists
        if re.search(r'case\s+(?:6|0x06)\s*:', body):
            print("0xAA Talk type 6: case 6 already exists in ParseCreatureSpeak")
            return src
        # Add case 6 right before case 5
        new_body = body[:case5_match.start()] + \
            "case 6: /* TibiaRelic: talk type 6 rule violation, reads u16 */\n        " + \
            body[case5_match.start():]
        src = src[:match.start(2)] + new_body + src[match.end(2):]
        print("OK: 0xAA Talk type 6 — added to channel types in ParseCreatureSpeak")
    else:
        print("WARN: case 5 not found in ParseCreatureSpeak")
    
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
    src = patch_remove_diagnostic_logging(src)
    src = patch_parse_loop_recovery(src)
    # Byte consumption alignment patches (v2)
    src = patch_text_window(src)
    src = patch_rule_violation_opcodes(src)
    src = patch_talk_type6(src)
    
    if src == original:
        print("\nAll patches already applied — no changes needed")
        sys.exit(0)
    
    write_file(filepath, src)
    
    print("=" * 60)
    print("All protocol patches applied successfully")
    print("=" * 60)


if __name__ == '__main__':
    main()
