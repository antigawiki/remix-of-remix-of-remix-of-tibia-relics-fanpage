#!/usr/bin/env python3
"""
Patches renderer.cpp to render creature names at half scale.
Renders text at full size to a temporary canvas, then downscales 2:1
with 2x2 pixel averaging for smooth quality.
"""

import sys

def patch_renderer(filepath):
    with open(filepath, 'r') as f:
        code = f.read()

    # 1. Add half-scale name rendering function before DrawCreatureOverlay
    helper_function = r'''
// --- Half-scale creature name rendering ---
// Renders name at full bitmap size, then downscales 2:1 with pixel averaging.
static void DrawCreatureNameHalfScale(const Font &font,
                                       const Pixel &color,
                                       int centerX,
                                       int centerY,
                                       const std::string &text,
                                       Canvas &canvas) {
    auto [textWidth, textHeight] = TextRenderer::MeasureBounds(
        font, TextTransform::ProperCase, ~(size_t)0, text);

    if (textWidth == 0 || textHeight == 0) return;

    int fullW = (int)textWidth + 4;
    int fullH = (int)textHeight + 2;

    // Temp canvas for full-size rendering
    Canvas temp(fullW, fullH);
    memset(temp.Buffer, 0, fullH * temp.Stride);

    // Draw centered on temp canvas
    TextRenderer::Render(font, TextAlignment::Center, TextTransform::ProperCase,
                         color, fullW / 2, 0, ~(size_t)0, text, temp);

    // Downscale 2:1 with 2x2 pixel averaging
    int halfW = fullW / 2;
    int halfH = fullH / 2;
    int destStartX = centerX - halfW / 2;
    int destStartY = centerY;

    for (int hy = 0; hy < halfH; hy++) {
        for (int hx = 0; hx < halfW; hx++) {
            int sx = hx * 2;
            int sy = hy * 2;
            int sx1 = std::min(sx + 1, fullW - 1);
            int sy1 = std::min(sy + 1, fullH - 1);

            Pixel &p00 = temp.GetPixel(sx, sy);
            Pixel &p10 = temp.GetPixel(sx1, sy);
            Pixel &p01 = temp.GetPixel(sx, sy1);
            Pixel &p11 = temp.GetPixel(sx1, sy1);

            // Count non-background pixels for weighted average
            int count = (p00.Alpha > 0) + (p10.Alpha > 0) +
                        (p01.Alpha > 0) + (p11.Alpha > 0);

            if (count == 0) continue;

            uint8_t r = (uint8_t)(((int)p00.Red + p10.Red + p01.Red + p11.Red) / 4);
            uint8_t g = (uint8_t)(((int)p00.Green + p10.Green + p01.Green + p11.Green) / 4);
            uint8_t b = (uint8_t)(((int)p00.Blue + p10.Blue + p01.Blue + p11.Blue) / 4);

            int dx = destStartX + hx;
            int dy = destStartY + hy;

            if (dx >= 0 && dx < canvas.Width && dy >= 0 && dy < canvas.Height) {
                Pixel &dest = canvas.GetPixel(dx, dy);
                if (count >= 2) {
                    // Strong pixel — overwrite
                    dest.Red = r;
                    dest.Green = g;
                    dest.Blue = b;
                } else {
                    // Edge pixel — blend with background for anti-aliasing
                    dest.Red = (uint8_t)(((int)dest.Red + r) / 2);
                    dest.Green = (uint8_t)(((int)dest.Green + g) / 2);
                    dest.Blue = (uint8_t)(((int)dest.Blue + b) / 2);
                }
            }
        }
    }
}

'''

    # Insert before DrawCreatureOverlay
    marker = 'static void DrawCreatureOverlay(const Options &options,'
    if marker not in code:
        print("[name_scale_patch] ERROR: DrawCreatureOverlay not found!")
        sys.exit(1)

    code = code.replace(marker, helper_function + marker)

    # 2. Replace the creature name draw call to use half-scale version
    old_call = 'TextRenderer::DrawCenteredProperCaseString(version.Fonts.Game,'
    new_call = 'DrawCreatureNameHalfScale(version.Fonts.Game,'

    if old_call not in code:
        print("[name_scale_patch] ERROR: DrawCenteredProperCaseString call not found!")
        sys.exit(1)

    code = code.replace(old_call, new_call, 1)  # Replace only the first occurrence (creature names)

    with open(filepath, 'w') as f:
        f.write(code)

    print("[name_scale_patch] Half-scale creature names patched successfully!")

if __name__ == '__main__':
    filepath = sys.argv[1] if len(sys.argv) > 1 else 'lib/renderer.cpp'
    patch_renderer(filepath)
