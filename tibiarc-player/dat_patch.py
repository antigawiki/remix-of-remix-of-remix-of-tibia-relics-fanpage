"""
Smart DAT parser patch for tibiarc.
Replaces the whole-body try-catch with per-flag try-catch in ReadProperties,
so unknown flags are skipped gracefully without losing remaining properties.
Mirrors the FLAG_PAYLOADS logic from datLoader.ts.
"""
import re
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else 'lib/types.cpp'

with open(filepath, 'r') as f:
    src = f.read()

# Find ReadProperties function
pattern = r'(void EntityType::ReadProperties\([^)]*\)\s*\{)(.*?)(^\})'
match = re.search(pattern, src, re.DOTALL | re.MULTILINE)
if not match:
    print('WARN: ReadProperties not found in ' + filepath)
    sys.exit(1)

# Replace the entire ReadProperties body with a per-flag resilient version.
# The original body has:
#   Properties.StackPriority = 5;
#   for (;;) {
#       switch (version.TranslateTypeProperty(reader.ReadU8())) {
#       case ...: ...
#       case TypeProperty::EntryEndMarker: return;
#       }
#   }
#
# The problem: TranslateTypeProperty throws InvalidDataError on unknown flags,
# which (with the old try-catch) skipped ALL remaining properties for the item.
#
# New approach: wrap each iteration in try-catch. On unknown flag, continue
# the loop instead of returning. This preserves all subsequent valid properties.

new_body = r'''
void EntityType::ReadProperties(const Version &version, DataReader &reader) {
    Properties.StackPriority = 5;

    for (;;) {
        /* TibiaRelic: per-flag try-catch so unknown flags don't skip remaining properties */
        try {
            auto prop = version.TranslateTypeProperty(reader.ReadU8());
            switch (prop) {
            case TypeProperty::Ground:
                Properties.Speed = reader.ReadU16();
                Properties.StackPriority = 0;
                break;
            case TypeProperty::Clip:
                Properties.StackPriority = 1;
                break;
            case TypeProperty::Bottom:
                Properties.StackPriority = 2;
                break;
            case TypeProperty::Top:
                Properties.StackPriority = 3;
                break;
            case TypeProperty::Stackable:
                Properties.Stackable = true;
                break;
            case TypeProperty::Rune:
                Properties.Rune = true;
                break;
            case TypeProperty::LiquidContainer:
                Properties.LiquidContainer = true;
                break;
            case TypeProperty::LiquidPool:
                Properties.LiquidPool = true;
                break;
            case TypeProperty::Unlookable:
                Properties.Unlookable = true;
                break;
            case TypeProperty::Hangable:
                Properties.Hangable = true;
                break;
            case TypeProperty::Vertical:
                Properties.Vertical = true;
                break;
            case TypeProperty::Horizontal:
                Properties.Horizontal = true;
                break;
            case TypeProperty::DontHide:
                Properties.DontHide = true;
                break;
            case TypeProperty::Displacement:
                Properties.DisplacementX = reader.ReadU16();
                Properties.DisplacementY = reader.ReadU16();
                break;
            case TypeProperty::DisplacementLegacy:
                Properties.DisplacementX = 8;
                Properties.DisplacementY = 8;
                break;
            case TypeProperty::Height:
                Properties.Height = reader.ReadU16();
                break;
            case TypeProperty::RedrawNearbyTop:
                Properties.RedrawNearbyTop = true;
                break;
            case TypeProperty::AnimateIdle:
                Properties.AnimateIdle = true;
                break;
            case TypeProperty::Container:
                break;
            case TypeProperty::Automap:
                reader.SkipU16();
                break;
            case TypeProperty::Lenshelp:
                reader.SkipU16();
                break;
            case TypeProperty::Wrappable:
                break;
            case TypeProperty::Unwrappable:
                break;
            case TypeProperty::TopEffect:
                break;
            case TypeProperty::NoMoveAnimation:
                break;
            case TypeProperty::Usable:
                break;
            case TypeProperty::Corpse:
                break;
            case TypeProperty::Blocking:
                break;
            case TypeProperty::Unmovable:
                break;
            case TypeProperty::Unpathable:
                break;
            case TypeProperty::Takeable:
                break;
            case TypeProperty::ForceUse:
                break;
            case TypeProperty::MultiUse:
                break;
            case TypeProperty::Translucent:
                break;
            case TypeProperty::Walkable:
                break;
            case TypeProperty::LookThrough:
                break;
            case TypeProperty::Rotate:
                break;
            case TypeProperty::Write:
                reader.SkipU16();
                break;
            case TypeProperty::WriteOnce:
                reader.SkipU16();
                break;
            case TypeProperty::Light:
                reader.SkipU16();
                reader.SkipU16();
                break;
            case TypeProperty::EquipmentSlot:
                reader.SkipU16();
                break;
            case TypeProperty::MarketItem:
                reader.SkipU16();
                reader.SkipU16();
                reader.SkipU16();
                reader.SkipString();
                reader.SkipU16();
                reader.SkipU16();
                break;
            case TypeProperty::DefaultAction:
                reader.SkipU16();
                break;
            case TypeProperty::UnknownU16:
                reader.SkipU16();
                break;
            case TypeProperty::EntryEndMarker:
                return;
            }
        } catch (...) {
            /* TibiaRelic: unknown flag encountered — skip it (treat as boolean/0 bytes)
             * and continue parsing remaining properties instead of aborting */
            continue;
        }
    }
}'''

src = src[:match.start()] + new_body + '\n' + src[match.end():]
with open(filepath, 'w') as f:
    f.write(src)

print('Smart per-flag DAT patch applied successfully')
