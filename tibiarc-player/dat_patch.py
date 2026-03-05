"""
Two-phase DAT parser patch for tibiarc.
Wraps ReadProperties body in try-catch with 0xFF terminator scan.
"""
import re
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else 'lib/types.cpp'

with open(filepath, 'r') as f:
    src = f.read()

# Find ReadProperties function and inject two-phase logic
pattern = r'(void EntityType::ReadProperties\([^)]*\)\s*\{)(.*?)(^\})'
match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
if not match:
    print('WARN: ReadProperties not found in ' + filepath)
    sys.exit(1)

original_body = match.group(2)
replacement = (
    match.group(1) + "\n"
    "    /* TibiaRelic: Two-phase DAT parsing for resilience */\n"
    "    auto _savedPos = reader.Position();\n"
    "    while (reader.Remaining() > 0) {\n"
    "        if (reader.ReadU8() == 0xFF) break;\n"
    "    }\n"
    "    auto _endPos = reader.Position();\n"
    "    reader.Seek(_savedPos);\n"
    "    try {\n"
    + original_body +
    "\n    } catch (...) { /* TibiaRelic: ignore metadata errors */ }\n"
    "    reader.Seek(_endPos);\n"
    "    return;\n"
    + match.group(3)
)

src = src[:match.start()] + replacement + src[match.end():]
with open(filepath, 'w') as f:
    f.write(src)

print('Two-phase DAT patch applied successfully')
