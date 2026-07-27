"""
Generates the PWA icon set for Natassha AI Health Coach.
Run: python3 scripts/generate-icons.py
Outputs to public/icons/. Pure PIL, no external assets, so it's fully
reproducible and dependency-free (uses the app's own token colors).
"""
import math
import os

from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT_DIR, exist_ok=True)

ROSE = (255, 107, 157, 255)
ROSE_STRONG = (242, 70, 127, 255)
WHITE = (255, 255, 255, 255)


def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))


def draw_gradient_rounded_square(size, corner_radius_ratio):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # Diagonal gradient rose -> rose_strong
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = grad.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = lerp_color(ROSE, ROSE_STRONG, t)

    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    radius = int(size * corner_radius_ratio)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)

    img.paste(grad, (0, 0), mask)
    return img


def draw_pulse_heart(draw, cx, cy, scale):
    """A simple heart-rate pulse line, echoing the app's HeartPulse mark."""
    w = scale
    h = scale * 0.5
    line_width = max(2, int(scale * 0.09))
    points = [
        (cx - w, cy),
        (cx - w * 0.55, cy),
        (cx - w * 0.35, cy - h),
        (cx - w * 0.1, cy + h),
        (cx + w * 0.15, cy - h * 0.6),
        (cx + w * 0.35, cy),
        (cx + w, cy),
    ]
    draw.line(points, fill=WHITE, width=line_width, joint="curve")
    for p in (points[0], points[-1]):
        r = line_width * 0.6
        draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=WHITE)


def make_icon(size, maskable=False):
    corner_ratio = 0.22
    if maskable:
        # Maskable icons need ~40% safe-zone padding and typically no
        # rounded corners of their own (the OS applies its own mask shape).
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        bg = draw_gradient_rounded_square(size, 0.0)
        img.paste(bg, (0, 0), bg)
        draw = ImageDraw.Draw(img)
        draw_pulse_heart(draw, size / 2, size / 2, size * 0.22)
        return img

    img = draw_gradient_rounded_square(size, corner_ratio)
    draw = ImageDraw.Draw(img)
    draw_pulse_heart(draw, size / 2, size / 2, size * 0.28)
    return img


sizes = [192, 512]
for s in sizes:
    make_icon(s, maskable=False).save(os.path.join(OUT_DIR, f"icon-{s}.png"))
    make_icon(s, maskable=True).save(os.path.join(OUT_DIR, f"icon-maskable-{s}.png"))

# Apple touch icon (no transparency, iOS ignores alpha and shows it as black)
apple = make_icon(180, maskable=False).convert("RGB")
apple.save(os.path.join(OUT_DIR, "apple-touch-icon.png"))

# Favicon-sized PNG for the browser tab
favicon = make_icon(32, maskable=False)
favicon.save(os.path.join(OUT_DIR, "icon-32.png"))

print("Icons written to", OUT_DIR)
