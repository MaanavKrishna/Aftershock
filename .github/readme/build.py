#!/usr/bin/env python3
"""Build the SVG graphics used by the repository README.

    pip install fonttools brotli
    python3 .github/readme/build.py

Writes .github/readme/*.svg and prints their sizes. Run it again after changing
anything here; the output is deterministic.

Design: Fault Line, the Aftershock design system (docs/design-system.md). Every
colour below is a token from app/globals.css. Panels use the dark theme, the
product's hero theme, and paint their own rounded background, so they look the
same on GitHub light and dark. Verdict colours (proven, recur, safe,
inconclusive, flaky) are used for verdicts only, and every verdict has an icon,
a word and a tint, as in the product. The motif is a seismograph trace that
spikes at an incident and settles into a proven-green line.

Type: Geist Sans and Geist Mono, weights 400, 500 and 600 only. Each SVG embeds
a WOFF2 subset of exactly the glyphs it uses, with system fallbacks, so type
renders the same everywhere. Text is measured from the font, so it fits.

Fonts in .github/readme/fonts, from the `geist` package on npm, under the SIL
Open Font License 1.1: (c) 2023 Vercel, in collaboration with basement.studio
(OFL-Geist.txt).

Every SVG has role="img", an aria-label and a <title>. Section headers are
transparent and use one accent that reads on GitHub light (#ffffff) and dark
(#0d1117); the build checks the contrast ratios and prints them. Animations are
CSS only, play inside prefers-reduced-motion: no-preference, and every
element's resting state is its final frame, so with motion off the picture is
complete.
"""
import base64
import io
import math
import os
import random
from collections import defaultdict
from xml.dom import minidom
from xml.sax.saxutils import escape

from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "fonts")
OUT = HERE

# ---------------------------------------------------------------- tokens (app/globals.css, dark)
CANVAS, S1, S2, S3, SUNKEN = "#08090C", "#0F1115", "#16191F", "#1E222A", "#050608"
FG, FG2, FG3 = "#EDEFF3", "#A9B0BC", "#828A98"
SIGNAL, ON_SIGNAL = "#5EB1FF", "#04121F"
PROVEN, RECUR, SAFE, INCONCLUSIVE, FLAKY = "#3DD68C", "#FF7A45", "#4FC3D9", "#F0B44C", "#B49CFF"
BORDER = "rgba(255,255,255,.08)"
BORDER_STRONG = "rgba(255,255,255,.14)"
SOFT = {PROVEN: "rgba(61,214,140,.12)", RECUR: "rgba(255,122,69,.13)", SAFE: "rgba(79,195,217,.12)",
        INCONCLUSIVE: "rgba(240,180,76,.12)", FLAKY: "rgba(180,156,255,.12)", SIGNAL: "rgba(94,177,255,.12)",
        FG2: S2}
LINE = {PROVEN: "rgba(61,214,140,.36)", RECUR: "rgba(255,122,69,.36)", SIGNAL: "rgba(94,177,255,.36)"}

# Section headers sit on GitHub's own background, light or dark. One accent for both:
# signal (light theme token) and fg-3 (light theme token). Ratios are checked in main().
HEAD = "#0B63CE"
HEAD_NOTE = "#626B7A"
GITHUB_LIGHT, GITHUB_DARK = "#FFFFFF", "#0D1117"

VERSION = "0.2.2"
SITE = "aftershock-mk.vercel.app"

# css class -> (font file, family, weight, fallback)
SANS = "-apple-system, 'Segoe UI', system-ui, sans-serif"
MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
FONTS = {
    "fs": ("Geist-SemiBold.woff2", "AS Semibold", 600, SANS),
    "fb": ("Geist-Medium.woff2", "AS Medium", 500, SANS),
    "fr": ("Geist-Regular.woff2", "AS Regular", 400, SANS),
    "fm": ("GeistMono-Regular.woff2", "AS Mono", 400, MONO),
    "fmm": ("GeistMono-Medium.woff2", "AS Mono Medium", 500, MONO),
    "fmb": ("GeistMono-SemiBold.woff2", "AS Mono Semibold", 600, MONO),
}
FEATURES = ["kern", "liga", "calt", "tnum"]

EASE = "cubic-bezier(.22,1,.36,1)"  # ease-fl
BASE_CSS = f"""
@media (prefers-reduced-motion:no-preference){{
.fade{{animation:fade .8s {EASE} both}}
.wipe{{transform-box:fill-box;transform-origin:left center;animation:wipe 1s {EASE} both}}
.draw{{stroke-dasharray:1;animation:draw 2.2s cubic-bezier(.45,0,.25,1) both}}
.pop{{transform-box:fill-box;transform-origin:center;animation:pop .5s cubic-bezier(.3,1.4,.5,1) both}}
}}
@keyframes fade{{from{{opacity:0;transform:translateY(10px)}}to{{opacity:1;transform:none}}}}
@keyframes wipe{{from{{transform:scaleX(0)}}to{{transform:scaleX(1)}}}}
@keyframes draw{{from{{stroke-dashoffset:1}}to{{stroke-dashoffset:0}}}}
@keyframes pop{{from{{opacity:0;transform:scale(.6)}}to{{opacity:1;transform:scale(1)}}}}
"""


# ---------------------------------------------------------------- colour maths
def luminance(hex_):
    h = hex_.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


# ---------------------------------------------------------------- font helpers
_tt = {}


def tt(file):
    if file not in _tt:
        _tt[file] = TTFont(os.path.join(FONT_DIR, file))
    return _tt[file]


def measure(text, cls, size, ls=0.0):
    font = tt(FONTS[cls][0])
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    w = 0.0
    for c in text:
        if ord(c) not in cmap:
            raise SystemExit(f"{FONTS[cls][0]} has no glyph for {c!r}")
        w += font["hmtx"][cmap[ord(c)]][0] * size / upm
    return w + ls * len(text)


def fit(text, cls, size, max_w, ls=0.0):
    while size > 9 and measure(text, cls, size, ls) > max_w:
        size -= 0.5
    return size


def subset_b64(file, chars):
    f = TTFont(os.path.join(FONT_DIR, file))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = FEATURES
    opts.name_IDs = []
    opts.notdef_outline = False
    opts.hinting = False  # hints are most of the bytes, and browsers ignore them at these sizes
    opts.drop_tables += ["meta", "DSIG"]
    s = subset.Subsetter(opts)
    s.populate(text=chars)
    s.subset(f)
    buf = io.BytesIO()
    f.flavor = "woff2"
    f.save(buf)
    return base64.b64encode(buf.getvalue()).decode()


def T(x, y, s, cls, size, fill, anchor=None, ls=None, extra="", classes=""):
    a = f' text-anchor="{anchor}"' if anchor else ""
    l_ = f' letter-spacing="{ls:g}"' if ls else ""
    c = f"{cls} {classes}".strip()
    return (f'<text x="{x:.1f}" y="{y:.1f}" class="{c}" font-size="{size:g}" fill="{fill}" xml:space="preserve"{a}{l_}{(" " + extra) if extra else ""}>'
            f"{escape(s)}</text>")


def doc(W, H, body, css="", label=""):
    q = escape(label, {'"': "&quot;"})
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" '
            f'role="img" aria-label="{q}"><title>{escape(label)}</title>'
            f"<style>/*FONTS*/{BASE_CSS}{motion(css)}</style>{body}</svg>")


def motion(css):
    return "@media (prefers-reduced-motion:no-preference){" + css + "}" if css else ""


WRITTEN = []


def write(name, svg):
    """Embed exactly the glyphs each text element uses, then save."""
    dom = minidom.parseString(svg)
    chars = defaultdict(set)

    def walk(node, cls):
        if node.nodeType == node.ELEMENT_NODE:
            if node.tagName in ("style", "title"):
                return
            for k in node.getAttribute("class").split():
                if k in FONTS:
                    cls = k
            for ch in node.childNodes:
                walk(ch, cls)
        elif node.nodeType == node.TEXT_NODE and cls:
            chars[cls].update(node.data)

    walk(dom.documentElement, None)
    css = ""
    for cls in sorted(chars):
        file, fam, weight, fallback = FONTS[cls]
        want = set(chars[cls]) - {"\n"}
        cmap = tt(file).getBestCmap()
        missing = [c for c in want if ord(c) not in cmap]
        if missing:
            raise SystemExit(f"{name}: {file} has no glyph for {missing}")
        data = subset_b64(file, "".join(sorted(want)) + " ")
        css += (f"@font-face{{font-family:'{fam}';src:url(data:font/woff2;base64,{data}) format('woff2');"
                f"font-weight:{weight};font-style:normal}}"
                f".{cls}{{font-family:'{fam}',{fallback};font-weight:{weight};font-feature-settings:'tnum'}}")
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(svg.replace("/*FONTS*/", css))
    WRITTEN.append(name)


# ---------------------------------------------------------------- drawing helpers
def arrow(x1, y1, x2, y2, col, w=2.0, head=8, cls="", dash="", style=""):
    ang = math.atan2(y2 - y1, x2 - x1)
    a1, a2 = ang + math.radians(145), ang - math.radians(145)
    hx1, hy1 = x2 + head * math.cos(a1), y2 + head * math.sin(a1)
    hx2, hy2 = x2 + head * math.cos(a2), y2 + head * math.sin(a2)
    d = f' stroke-dasharray="{dash}"' if dash else ""
    c = f' class="{cls}"' if cls else ""
    st = f' style="{style}"' if style else ""
    return (f'<g{c}{st}><path d="M{x1:.1f},{y1:.1f}L{x2:.1f},{y2:.1f}" fill="none" stroke="{col}" stroke-width="{w}" '
            f'stroke-linecap="round"{d}/>'
            f'<path d="M{hx1:.1f},{hy1:.1f}L{x2:.1f},{y2:.1f}L{hx2:.1f},{hy2:.1f}" fill="none" stroke="{col}" '
            f'stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/></g>')


def head_at(x, y, ang_deg, col, w=2.0, head=8):
    ang = math.radians(ang_deg)
    a1, a2 = ang + math.radians(145), ang - math.radians(145)
    return (f'<path d="M{x + head * math.cos(a1):.1f},{y + head * math.sin(a1):.1f}L{x:.1f},{y:.1f}'
            f'L{x + head * math.cos(a2):.1f},{y + head * math.sin(a2):.1f}" fill="none" stroke="{col}" '
            f'stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')


def icon(kind, cx, cy, col, size=14, w=None):
    """The product's verdict icons (components/ui/icons.tsx), 24 grid, centred at (cx, cy)."""
    s = size / 24
    sw = w if w is not None else 1.75 / s * (1.15 if size < 18 else 1)
    st = f'fill="none" stroke="{col}" stroke-width="{sw:.2f}" stroke-linecap="round" stroke-linejoin="round"'
    inner = {
        "check": f'<path d="m5 12.5 4.5 4.5L19 7.5" {st}/>',
        "cross": f'<path d="M6 6l12 12M18 6 6 18" {st}/>',
        "half": f'<circle cx="12" cy="12" r="8" {st}/><path d="M12 4a8 8 0 0 1 0 16z" fill="{col}"/>',
        "ring": f'<circle cx="12" cy="12" r="7.5" {st}/>',
        "dashed": f'<circle cx="12" cy="12" r="7.5" {st} stroke-dasharray="3 3"/>',
        "wave": f'<path d="M2 12h3l2-6 3 12 3-9 2 3h7" {st}/>',
        "clock": f'<circle cx="12" cy="12" r="8.5" {st}/><path d="M12 7.5V12l3 2" {st}/>',
        "pr": f'<circle cx="6" cy="6" r="2.5" {st}/><circle cx="6" cy="18" r="2.5" {st}/><circle cx="18" cy="18" r="2.5" {st}/>'
              f'<path d="M6 8.5v7M18 15.5V9a3 3 0 0 0-3-3h-4m0 0 2.5-2.5M11 6l2.5 2.5" {st}/>',
        "commit": f'<circle cx="12" cy="12" r="3.5" {st}/><path d="M2 12h6.5M15.5 12H22" {st}/>',
        "shield": f'<path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z" {st}/><path d="m9 12 2 2 4-4" {st}/>',
        "bolt": f'<path d="M13 3 5 13.5h6L10 21l9-11h-6z" {st}/>',
        "memory": f'<rect x="4" y="4" width="16" height="16" rx="3" {st}/><path d="M8 9h8M8 12h8M8 15h5" {st}/>',
        "pencil": f'<path d="M4 20h4L19 9l-4-4L4 16z" {st}/><path d="m13.5 6.5 4 4" {st}/>',
        "plug": f'<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" {st}/>',
        "repo": f'<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" {st}/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3" {st}/>',
        "branch": f'<circle cx="6" cy="5.5" r="2.5" {st}/><circle cx="6" cy="18.5" r="2.5" {st}/><circle cx="18" cy="8" r="2.5" {st}/>'
                  f'<path d="M6 8v8M18 10.5c0 4-6 3-11 6" {st}/>',
        "chart": f'<path d="M4 20V4M4 20h16" {st}/><path d="m7 15 4-4 3 3 5-6" {st}/>',
        "search": f'<circle cx="11" cy="11" r="6.5" {st}/><path d="m16 16 4 4" {st}/>',
        "lock": f'<rect x="5" y="10.5" width="14" height="10" rx="2.5" {st}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {st}/>',
        "key": f'<circle cx="8" cy="15" r="4" {st}/><path d="m11 12 8.5-8.5M16.5 6.5l2.5 2.5M14 9l2 2" {st}/>',
        "box": f'<path d="M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9z" {st}/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9.2" {st}/>',
        "alert": f'<path d="M12 3.5 21.5 20h-19z" {st}/><path d="M12 10v4.5M12 17.4v.1" {st}/>',
        "globe": f'<circle cx="12" cy="12" r="8.5" {st}/><path d="M3.5 12h17M12 3.5c2.8 3 2.8 14 0 17M12 3.5c-2.8 3-2.8 14 0 17" {st}/>',
        "terminal": f'<rect x="3" y="4.5" width="18" height="15" rx="2.5" {st}/><path d="m7 10 3 2.5L7 15M12.5 15.5H17" {st}/>',
        "db": f'<ellipse cx="12" cy="6" rx="7.5" ry="2.8" {st}/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" {st}/>',
        "spark": f'<path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" {st}/>',
        "flow": f'<circle cx="6" cy="6" r="2.5" {st}/><circle cx="18" cy="18" r="2.5" {st}/><path d="M8.5 6H15a3 3 0 0 1 3 3v6.5M6 8.5v4A3.5 3.5 0 0 0 9.5 16h6" {st}/>',
        "agent": f'<rect x="4.5" y="7.5" width="15" height="11" rx="3" {st}/><path d="M12 4v3.5M9 12.5v1M15 12.5v1M2.5 12v3M21.5 12v3" {st}/>',
        "doc": f'<path d="M6.5 3h8l4 4v14h-12z" {st}/><path d="M14.5 3v4h4M9.5 12h5M9.5 15.5h5" {st}/>',
        "undo": f'<path d="M9 7 5 11l4 4" {st}/><path d="M5 11h9.5a4.5 4.5 0 0 1 0 9H11" {st}/>',
    }[kind]
    return f'<g transform="translate({cx - size / 2:.1f},{cy - size / 2:.1f}) scale({s:.4f})">{inner}</g>'


VERDICT = {
    "proven": ("check", "Proven", PROVEN), "healthy": ("check", "Healthy", PROVEN), "safe": ("check", "Safe", SAFE),
    "guarding": ("check", "Still guarding", PROVEN),
    "recur": ("cross", "Recur", RECUR), "failing": ("cross", "Failing", RECUR),
    "inconclusive": ("half", "Inconclusive", INCONCLUSIVE), "weak": ("half", "Weak", INCONCLUSIVE),
    "awaiting": ("clock", "Awaiting fix", INCONCLUSIVE),
    "flaky": ("wave", "Flaky", FLAKY), "drifted": ("wave", "Drifted", FLAKY), "drafted": ("pencil", "AI draft", FLAKY),
    "skipped": ("ring", "Skipped", FG2), "rejected": ("ring", "Rejected", FG2), "unproven": ("dashed", "Unproven", FG2),
}


def pill_w(kind, size=15, label=None):
    ic, word, _ = VERDICT[kind]
    word = label or word
    return size * 0.7 + size * 1.3 + measure(word, "fb", size) + size * 0.7


def pill(x, y, kind, size=15, label=None, anchor="start", cls="", style=""):
    """The Verdict pill: icon + word + tint. (x, y) is the left edge (or right) and vertical centre."""
    ic, word, col = VERDICT[kind]
    word = label or word
    w = pill_w(kind, size, label)
    h = size * 1.75
    x0 = x - w if anchor == "end" else x
    pad = size * 0.7
    c = f' class="{cls}"' if cls else ""
    st = f' style="{style}"' if style else ""
    return (f'<g{c}{st}><rect x="{x0:.1f}" y="{y - h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{size * 0.45:.1f}" fill="{SOFT[col]}"/>'
            + icon(ic, x0 + pad + size * 0.45, y, col, size * 0.95)
            + T(x0 + pad + size * 1.3, y + size * 0.36, word, "fb", size, col) + "</g>"), w


def chip(x, y, text, size=13, fg=FG2, bg=S2, border=None, cls="fmm", pad=10, h=None, anchor="start", ls=0.6):
    h = h or size * 2.0
    w = measure(text, cls, size, ls) + pad * 2
    x0 = x - w if anchor == "end" else (x - w / 2 if anchor == "middle" else x)
    b = f' stroke="{border}" stroke-width="1"' if border else ""
    return (f'<rect x="{x0:.1f}" y="{y - h / 2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{min(h / 2, 6):.1f}" fill="{bg}"{b}/>'
            + T(x0 + pad, y + size * 0.36, text, cls, size, fg, ls=ls)), w


def cell(x, y, ok, s=34, cls="", delay=0.0):
    """A proof cell: one run, failed (recur cross) or passed (proven check)."""
    col = PROVEN if ok else RECUR
    c = f' class="{cls}" style="animation-delay:{delay:.2f}s"' if cls else ""
    return (f'<g{c}><rect x="{x:.1f}" y="{y:.1f}" width="{s}" height="{s}" rx="{s * 0.24:.1f}" fill="{SOFT[col]}" '
            f'stroke="{LINE.get(col, col)}" stroke-width="1"/>'
            + icon("check" if ok else "cross", x + s / 2, y + s / 2, col, s * 0.58, 2.6) + "</g>")


def logomark(x, y, size, bg=FG, fg=CANVAS, check=PROVEN):
    """components/ui/Logo.tsx: a seismic trace that settles into a check."""
    s = size * 0.68 / 24
    off = size * 0.16
    return (f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{size * 0.28:.1f}" fill="{bg}"/>'
            f'<g transform="translate({x + off:.1f},{y + off:.1f}) scale({s:.4f})" fill="none" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="M1.5 13h2l1.6-6 2.6 11 2.1-8.5 1.6 3.5h1.1" stroke="{fg}"/>'
            f'<path d="m14.6 13 2.7 2.8 5.2-6.3" stroke="{check}"/></g>')


def panel_frame(W, H, r=24, bg=CANVAS, dots=True):
    """Background, clip, a faint dot grid that fades to the edges, and a hairline edge."""
    defs = (f'<clipPath id="clip"><rect width="{W}" height="{H}" rx="{r}"/></clipPath>'
            f'<pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">'
            f'<circle cx="12" cy="12" r="1.1" fill="#FFFFFF" fill-opacity=".07"/></pattern>'
            f'<radialGradient id="fade" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity="1"/>'
            f'<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
            f'<mask id="dotmask"><rect width="{W}" height="{H}" fill="url(#fade)"/></mask>')
    bgs = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
    if dots:
        bgs += f'<rect width="{W}" height="{H}" fill="url(#dots)" mask="url(#dotmask)"/>'
    edge = (f'<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="{r - .5}" fill="none" stroke="{BORDER_STRONG}"/>')
    return defs, bgs, edge


def card(x, y, w, h, r=16, fill=S1, stroke=BORDER, cls="", delay=None, dash=""):
    c = f' class="{cls}"' if cls else ""
    st = f' style="animation-delay:{delay:.2f}s"' if delay is not None else ""
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return (f'<rect{c}{st} x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" fill="{fill}" '
            f'stroke="{stroke}"{d}/>'
            f'<path d="M{x + r:.1f},{y + .5:.1f}H{x + w - r:.1f}" stroke="#FFFFFF" stroke-opacity=".05"/>')


# ---------------------------------------------------------------- the seismic trace
def seismic_points(x0, x1, spike, settle, amp, seed=7, step=2.5, noise=2.2):
    """Background tremor, a sharp burst at `spike` that decays, then a flat line from `settle`."""
    rnd = random.Random(seed)
    pts = []
    x = x0
    while x <= x1:
        t = x - spike
        if x >= settle:
            dy = 0.0
        elif t < 0:
            fade = 1.0 if x < settle else 0.0
            dy = (rnd.random() - 0.5) * 2 * noise * fade
        else:
            rise = 1 - math.exp(-t / 5)
            decay = math.exp(-t / ((settle - spike) / 5.2))
            dy = amp * rise * decay * math.sin(t / 5.3) * (0.55 + 0.45 * rnd.random())
            dy += (rnd.random() - 0.5) * noise * decay
        pts.append((x, dy))
        x += step
    return pts


def seismic(x0, x1, y, spike, settle, amp, gid, seed=7, width=2.4, cls="draw", delay=0.0, noise=2.2, quiet=FG3):
    """The trace as one path, coloured quiet -> recur at the incident -> proven once it settles."""
    pts = seismic_points(x0, x1, spike, settle, amp, seed, noise=noise)
    d = "M" + " L".join(f"{px:.1f},{y + py:.1f}" for px, py in pts)
    span = x1 - x0
    o = lambda v: max(0.0, min(1.0, (v - x0) / span))
    grad = (f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{x0}" y1="0" x2="{x1}" y2="0">'
            f'<stop offset="0" stop-color="{quiet}"/><stop offset="{o(spike - 30):.4f}" stop-color="{quiet}"/>'
            f'<stop offset="{o(spike + 6):.4f}" stop-color="{RECUR}"/>'
            f'<stop offset="{o(spike + (settle - spike) * .45):.4f}" stop-color="{RECUR}"/>'
            f'<stop offset="{o(settle - (settle - spike) * .1):.4f}" stop-color="{PROVEN}"/>'
            f'<stop offset="1" stop-color="{PROVEN}"/></linearGradient>')
    c = f' class="{cls}" pathLength="1" style="animation-delay:{delay:.2f}s"' if cls else ""
    path = (f'<path{c} d="{d}" fill="none" stroke="url(#{gid})" stroke-width="{width}" '
            f'stroke-linecap="round" stroke-linejoin="round"/>')
    return grad, path


# ================================================================ HERO
def hero():
    W, H = 1600, 900
    defs, bg, edge = panel_frame(W, H, 28)
    L = 72
    # top bar
    top = (logomark(L, 50, 40)
           + T(L + 54, 79, "Aftershock", "fs", 27, FG, ls=-0.54)
           + T(W - L, 76, f"V{VERSION} / APACHE-2.0 / HOSTED OR SELF-HOSTED", "fm", 15, FG3, "end", 1.6)
           + f'<line x1="{L}" y1="124" x2="{W - L}" y2="124" stroke="{BORDER}"/>')

    # headline: the site's tagline
    lines = ["Every incident", "becomes a test.", "Git history proves it."]
    size = 96
    while max(measure(s, "fs", size, -size * .035) for s in lines) > 760:
        size -= 1
    ls = round(-size * .035, 2)
    y0 = 236
    head = ""
    for i, s in enumerate(lines):
        col = FG if i < 2 else FG2
        head += f'<g class="fade" style="animation-delay:{.08 * i:.2f}s">' + T(L - 4, y0 + i * size * 1.04, s, "fs", size, col, ls=ls) + "</g>"
    lede = ["Aftershock turns a production incident into a regression test",
            "that must fail on the commit before the fix and pass on the fix,",
            "then guards every pull request against the incident coming back."]
    lsz = fit(max(lede, key=lambda s: measure(s, "fb", 22)), "fb", 22, 760)
    lede_svg = "".join(T(L, 508 + i * 34, s, "fr", lsz, FG2) for i, s in enumerate(lede))

    # the proof card: INC-12 from the demo workspace
    cx, cy, cw, ch = 904, 168, 624, 432
    p = f'<g class="fade" style="animation-delay:.25s">' + card(cx, cy, cw, ch, 20, S1, BORDER_STRONG)
    p += T(cx + 32, cy + 50, "INC-12", "fmb", 15, FG3, ls=1.2)
    sev, sw = chip(cx + 32 + measure("INC-12", "fmb", 15, 1.2) + 14, cy + 45, "SEV-1", 12, RECUR, SOFT[RECUR], cls="fmb", pad=8, h=24, ls=1)
    p += sev
    p += T(cx + cw - 32, cy + 50, "ecommerce-api", "fm", 15, FG3, "end")
    title = "Payment retry charged a customer twice"
    p += T(cx + 32, cy + 92, title, "fs", fit(title, "fs", 27, cw - 64, -0.4), FG, ls=-0.4)
    p += f'<line x1="{cx + 32}" y1="{cy + 122}" x2="{cx + cw - 32}" y2="{cy + 122}" stroke="{BORDER}"/>'
    # git history: parent of fix, then the fix
    gx = cx + 52
    r1, r2 = cy + 178, cy + 278
    p += f'<line x1="{gx}" y1="{cy + 138}" x2="{gx}" y2="{cy + 318}" stroke="{BORDER_STRONG}" stroke-width="2"/>'
    rows = [(r1, RECUR, "3f2a1c9", "the commit before the fix", False, "FAILS 3/3"),
            (r2, PROVEN, "aa86f56", "fix: reject duplicate pending payment", True, "PASSES 3/3")]
    for k, (ry, col, sha, msg, ok, verdict) in enumerate(rows):
        p += f'<circle cx="{gx}" cy="{ry}" r="9" fill="{S1}" stroke="{col}" stroke-width="3"/>'
        p += T(gx + 28, ry - 4, sha, "fmm", 19, FG)
        p += T(gx + 28, ry + 22, msg, "fr", fit(msg, "fr", 16, 270), FG3)
        for j in range(3):
            p += cell(cx + cw - 32 - 3 * 40 + 6 + j * 40, ry - 28, ok, 34, "pop", .9 + .45 * k + .1 * j)
        p += T(cx + cw - 32, ry + 30, verdict, "fmb", 12, col, "end", 1.2)
    # admitted
    p += f'<line x1="{cx + 32}" y1="{cy + 344}" x2="{cx + cw - 32}" y2="{cy + 344}" stroke="{BORDER}"/>'
    pv, pw = pill(cx + 32, cy + 388, "proven", 17, cls="pop", style="animation-delay:1.9s")
    p += pv
    path = "tests/aftershock/test_inc_12_payment_retry.py"
    p += T(cx + 32 + pw + 16, cy + 394, path, "fm", fit(path, "fm", 15, cw - 64 - pw - 16), FG2)
    p += "</g>"

    # the seismic band
    by = 742
    band = ""
    for k in range(-3, 4):
        band += f'<line x1="0" y1="{by + k * 22}" x2="{W}" y2="{by + k * 22}" stroke="#FFFFFF" stroke-opacity="{.035 if k else .06}"/>'
    spike, fix_x, settle = 470, 905, 1180
    grad, trace = seismic(-10, W + 10, by, spike, settle, 74, "tr", seed=12, width=2.6, delay=.3)
    marks = ""
    for x, col, lab, anchor in [(spike, RECUR, "INC-12 INCIDENT", "start"), (fix_x, FG2, "AA86F56 FIX MERGES", "start"),
                                (settle + 40, PROVEN, "PROVEN / GUARDING EVERY PR", "start")]:
        marks += (f'<line x1="{x}" y1="{by - 92}" x2="{x}" y2="{by + 70}" stroke="{col}" stroke-opacity=".45" stroke-dasharray="3 5"/>'
                  f'<circle cx="{x}" cy="{by - 92}" r="3.5" fill="{col}"/>'
                  + T(x + 12, by - 87, lab, "fmb", 13, col, ls=1.4))
    foot = (f'<line x1="{L}" y1="836" x2="{W - L}" y2="836" stroke="{BORDER}"/>'
            + T(L, 868, "CAPTURE / TIME TRAVEL / MEMORY / GUARD", "fm", 14, FG3, ls=1.8)
            + T(W - L, 868, "SAMPLE: INC-12 FROM THE DEMO WORKSPACE", "fm", 14, FG3, "end", 1.8))
    body = (f'<defs>{defs}{grad}<radialGradient id="glow"><stop offset="0" stop-color="{SIGNAL}" stop-opacity=".09"/>'
            f'<stop offset="1" stop-color="{SIGNAL}" stop-opacity="0"/></radialGradient></defs>'
            f'<g clip-path="url(#clip)">{bg}<ellipse cx="1216" cy="330" rx="620" ry="380" fill="url(#glow)"/>'
            f'{top}{head}{lede_svg}{p}{band}{marks}{trace}{foot}</g>{edge}')
    write("hero.svg", doc(W, H, body, "", "Aftershock. Every incident becomes a test. Git history proves it. Aftershock "
                          "turns a production incident into a regression test that must fail on the commit before the fix "
                          "and pass on the fix, then guards every pull request against the incident coming back. A sample "
                          "incident, INC-12, payment retry charged a customer twice: its test fails 3 of 3 runs on commit "
                          "3f2a1c9, the commit before the fix, and passes 3 of 3 on the fix aa86f56, so it is proven. "
                          "Below, a seismograph trace spikes at the incident and settles into a green line once the fix "
                          "is proven."))


# ================================================================ SECTION HEADERS (transparent)
def header(name, idx, title, note):
    W, H = 1600, 112
    size, ls = 52, -1.6
    tw = measure(title, "fs", size, ls)
    # a small trace as the underline: tremor, spike, settle
    ux, uy = 4, 99
    pts = [(0, 0), (14, 0), (19, -1.5), (24, 1.5), (30, 0), (36, -11), (42, 10), (47, -6), (52, 4), (57, -2), (62, 0), (120, 0)]
    d = "M" + " L".join(f"{ux + x:.1f},{uy + y:.1f}" for x, y in pts)
    body = (T(2, 70, title, "fs", size, HEAD, ls=ls)
            + T(2 + tw + 16, 70, idx, "fmb", 18, HEAD, ls=1)
            + T(W - 4, 68, note.upper(), "fm", 16, HEAD_NOTE, "end", 2)
            + f'<path class="draw" pathLength="1" d="{d}" fill="none" stroke="{HEAD}" stroke-width="3" '
              f'stroke-linecap="round" stroke-linejoin="round"/>')
    write(name, doc(W, H, body, "", title))


# ================================================================ HOW IT WORKS
def how_it_works():
    W, H = 1600, 930
    defs, bg, edge = panel_frame(W, H)
    M, gap = 48, 64
    cw = (W - 2 * M - 2 * gap) / 3
    ch = 262
    y1, y2 = 178, 178 + ch + 132
    xs = [M + k * (cw + gap) for k in range(3)]
    steps = [
        ("01", "alert", "Incident", ["A labelled GitHub issue, a pasted", "postmortem, a form or an alert."],
         ("tag", "GITHUB / SENTRY / PAGERDUTY / LABS")),
        ("02", "pencil", "Draft", ["A model drafts one test in your", "repository's framework and style."],
         ("tag", "PYTEST / VITEST / JEST / MORE IN LABS")),
        ("03", "cells-fail", "Fails before the fix", ["Run three times on the commit", "before the fix. It must fail every time."],
         ("tag", "THE COMMIT BEFORE THE FIX")),
        ("04", "cells-pass", "Passes on the fix", ["Run three times on the fix.", "It must pass every time. Then it is proven."],
         ("tag", "THE FIX COMMIT")),
        ("05", "memory", "Memory", ["The proven test lands by pull request", "and re-runs every night on main."],
         ("pills", ["healthy", "flaky", "failing"])),
        ("06", "shield", "Guards every PR", ["Each pull request runs the relevant tests:", "one check and one comment."],
         ("pills", ["recur", "safe", "inconclusive", "skipped"])),
    ]

    def step(k, x, y, s, delay):
        idx, ic, title, desc, foot = s
        g = f'<g class="fade" style="animation-delay:{delay:.2f}s">' + card(x, y, cw, ch, 18, S1, BORDER_STRONG)
        g += T(x + 28, y + 46, idx, "fmb", 16, FG3, ls=1.2)
        if ic.startswith("cells"):
            ok = ic == "cells-pass"
            for j in range(3):
                g += cell(x + cw - 28 - 3 * 38 + 4 + j * 38, y + 22, ok, 32)
        else:
            g += icon(ic, x + cw - 46, y + 40, FG2, 30)
        g += T(x + 26, y + 112, title, "fs", fit(title, "fs", 34, cw - 52, -0.8), FG, ls=-0.8)
        for j, line in enumerate(desc):
            g += T(x + 28, y + 152 + j * 28, line, "fr", fit(line, "fr", 19, cw - 56), FG2)
        g += f'<line x1="{x + 28:.1f}" y1="{y + ch - 58}" x2="{x + cw - 28:.1f}" y2="{y + ch - 58}" stroke="{BORDER}"/>'
        if foot[0] == "tag":
            g += T(x + 28, y + ch - 24, foot[1], "fm", fit(foot[1], "fm", 13.5, cw - 56, 1.2), FG3, ls=1.2)
        else:
            size = 14
            while sum(pill_w(kd, size) for kd in foot[1]) + 8 * (len(foot[1]) - 1) > cw - 56:
                size -= 0.5
            px = x + 28
            for kd in foot[1]:
                pv, pw = pill(px, y + ch - 29, kd, size)
                g += pv
                px += pw + 8
        return g + "</g>"

    body = ""
    for k in range(3):
        body += step(k, xs[k], y1, steps[k], .08 * k)
        body += step(k + 3, xs[k], y2, steps[k + 3], .5 + .08 * k)
    # connectors in the gaps
    for k in range(2):
        x0 = xs[k] + cw + 10
        body += arrow(x0, y1 + ch / 2, x0 + gap - 20, y1 + ch / 2, FG3, 2.2, 8)
        body += arrow(x0, y2 + ch / 2, x0 + gap - 20, y2 + ch / 2, FG3, 2.2, 8)
    # 03 -> 04: the return path
    gy = y1 + ch + 66
    sx, ex = xs[2] + cw / 2, xs[0] + cw / 2
    body += (f'<path d="M{sx:.0f},{y1 + ch + 8} V{gy - 16} Q{sx:.0f},{gy} {sx - 16:.0f},{gy} H{ex + 16:.0f} '
             f'Q{ex:.0f},{gy} {ex:.0f},{gy + 16} V{y2 - 10}" fill="none" stroke="{FG3}" stroke-width="2.2" stroke-linecap="round"/>')
    body += head_at(ex, y2 - 10, 90, FG3, 2.2)
    lab = "admitted only if it fails 3/3 before the fix and passes 3/3 on it"
    lw = measure(lab, "fb", 18) + 32
    body += (f'<rect x="{(sx + ex) / 2 - lw / 2:.0f}" y="{gy - 17}" width="{lw:.0f}" height="34" rx="17" fill="{CANVAS}" stroke="{BORDER_STRONG}"/>'
             + T((sx + ex) / 2, gy + 6, lab, "fb", 18, FG, "middle"))
    # redraft loop: 03 back to 02, above the cards
    rx0, rx1 = xs[2] + 70, xs[1] + cw - 70
    ry = y1 - 34
    body += (f'<path d="M{rx0:.0f},{y1 - 8} V{ry + 12} Q{rx0:.0f},{ry} {rx0 - 12:.0f},{ry} H{rx1 + 12:.0f} '
             f'Q{rx1:.0f},{ry} {rx1:.0f},{ry + 12} V{y1 - 10}" fill="none" stroke="{RECUR}" stroke-opacity=".8" stroke-width="2" '
             f'stroke-dasharray="6 6" stroke-linecap="round"/>')
    body += head_at(rx1, y1 - 10, 90, RECUR, 2)
    rl = "passed before the fix? redraft with the failure, up to 3 times"
    body += T((rx0 + rx1) / 2, ry - 14, rl, "fr", 17, FG2, "middle")

    top = (T(M + 2, 70, "HOW AN INCIDENT BECOMES A TEST", "fmb", 16, FG2, ls=2)
           + T(W - M, 70, "EVERY RUN: A FRESH MICROVM / NO NETWORK / NO SECRETS", "fm", 15, FG3, "end", 1.8))
    foot = T(M + 2, H - 40, "A model never marks anything proven or safe; only test runs do. Mixed results are never green.",
             "fr", 17, FG3)
    svg = f'<defs>{defs}</defs><g clip-path="url(#clip)">{bg}{top}{body}{foot}</g>{edge}'
    write("how-it-works.svg", doc(W, H, svg, "",
          "How an incident becomes a test, in six steps. 1 Incident: a labelled GitHub issue, a pasted postmortem, a "
          "form, or an alert from Sentry, PagerDuty and more in Labs. 2 Draft: a model drafts one test in the "
          "repository's framework and style. 3 Fails before the fix: it runs three times on the commit before the fix "
          "and must fail every time; if it passes, it is redrafted with the failure as feedback, up to 3 times. 4 Passes "
          "on the fix: it runs three times on the fix and must pass every time; then it is proven. 5 Memory: the proven "
          "test lands by pull request and re-runs every night on main, marked Healthy, Flaky or Failing. 6 Guards every "
          "PR: each pull request runs the relevant tests and gets one check and one comment: Recur, Safe, Inconclusive "
          "or Skipped. Every run is a fresh microVM with no network and no secrets. A model never marks anything "
          "proven or safe; only test runs do."))


# ================================================================ FEATURE TILES
TILE_H = 640
WIDE_W, NARROW_W = 1140, 560
ART_Y, ART_H = 92, 336


def tile(name, wide, idx, kind, title, desc, art, label):
    W = WIDE_W if wide else NARROW_W
    H = TILE_H
    defs, bg, edge = panel_frame(W, H, 24)
    aw = W - 64
    body = f'<defs>{defs}</defs><g clip-path="url(#clip)">{bg}'
    body += T(34, 58, idx, "fmb", 16, FG3, ls=1.2) + T(70, 58, kind.upper(), "fm", 15, FG3, ls=1.8)
    body += f'<g transform="translate(32,{ART_Y})">{art(aw)}</g>'
    body += f'<line x1="34" y1="452" x2="{W - 34}" y2="452" stroke="{BORDER}"/>'
    body += T(32, 516, title, "fs", fit(title, "fs", 46, W - 68, -1.2), FG, ls=-1.2)
    body += T(34, 560, desc[0], "fr", fit(desc[0], "fr", 22, W - 68), FG2)
    body += T(34, 594, desc[1], "fr", fit(desc[1], "fr", 22, W - 68), FG2)
    body += "</g>" + edge
    write(name, doc(W, H, body, "", label))


def art_proof(aw):
    # a git history: commits on a line, two of them are the proof
    ly = 236
    g = f'<line x1="0" y1="{ly}" x2="{aw}" y2="{ly}" stroke="{BORDER_STRONG}" stroke-width="2"/>'
    for x in (40, 150, 900, 1010):
        g += f'<circle cx="{x}" cy="{ly}" r="6" fill="{S3}" stroke="{FG3}" stroke-width="2"/>'
    g += T(aw, ly + 44, "MAIN →", "fm", 13, FG3, "end", 1.6)
    commits = [(330, RECUR, "3f2a1c9", "The commit before the fix", False, "FAILED 3/3"),
               (700, PROVEN, "aa86f56", "fix: reject duplicate pending payment", True, "PASSED 3/3")]
    for k, (x, col, sha, msg, ok, res) in enumerate(commits):
        w, h, top = 330, 158, 10
        cx = x - w / 2
        g += f'<g class="fade" style="animation-delay:{.2 + .35 * k:.2f}s">' + card(cx, top, w, h, 14, S1, BORDER_STRONG)
        g += T(cx + 22, top + 40, sha, "fmm", 18, FG)
        g += T(cx + 22, top + 66, msg, "fr", fit(msg, "fr", 15, w - 44), FG3)
        for j in range(3):
            g += cell(cx + 22 + j * 42, top + 92, ok, 36, "pop", .6 + .35 * k + .08 * j)
        g += T(cx + w - 22, top + 116, res, "fmb", 12, col, "end", 1.2)
        g += f'<line x1="{x}" y1="{top + h}" x2="{x}" y2="{ly - 12}" stroke="{col}" stroke-opacity=".5" stroke-dasharray="3 4"/></g>'
        g += f'<circle cx="{x}" cy="{ly}" r="10" fill="{CANVAS}" stroke="{col}" stroke-width="3.5"/>'
    # time travel: from today back to the fix and its parent
    g += (f'<path class="draw" pathLength="1" d="M1010,{ly + 18} C1010,{ly + 84} 820,{ly + 84} 700,{ly + 84} '
          f'S350,{ly + 84} 330,{ly + 20}" fill="none" stroke="{SIGNAL}" stroke-width="2" stroke-dasharray="1" style="animation-delay:.2s"/>')
    g += head_at(330, ly + 20, -100, SIGNAL, 2)
    g += T(520, ly + 74, "TIME TRAVEL", "fmb", 13, SIGNAL, "middle", 1.6)
    pv, pw = pill(aw, 88, "proven", 18, anchor="end", cls="pop", style="animation-delay:1.4s")
    g += pv
    g += T(aw, 136, "admitted to memory", "fr", 16, FG2, "end")
    return g


def art_guard(aw):
    # a pull request check, as Aftershock posts it (PR #214 in the demo workspace)
    g = card(0, 4, aw, 324, 14, S1, BORDER_STRONG)
    g += icon("pr", 30, 38, FG2, 20)
    t = "#214  refactor: simplify payment service"
    g += T(50, 44, t, "fb", fit(t, "fb", 17, aw - 70), FG)
    g += f'<line x1="0" y1="68" x2="{aw}" y2="68" stroke="{BORDER}"/>'
    pv, pw = pill(20, 102, "recur", 17)
    g += pv + T(20 + pw + 12, 108, "INC-12 would come back", "fs", fit("INC-12 would come back", "fs", 17, aw - pw - 52), FG)
    g += T(20, 140, "assert 201 == 400 · payment rows: 2", "fm", fit("assert 201 == 400 · payment rows: 2", "fm", 14, aw - 40), RECUR)
    rows = [("INC-12", "test_inc_12_payment_retry.py", "recur"), ("INC-7", "test_inc_07_capture.py", "safe"),
            ("INC-2", "same retry path, added by triage", "safe")]
    for k, (key, what, v) in enumerate(rows):
        y = 194 + k * 50
        g += f'<line x1="20" y1="{y - 22}" x2="{aw - 20}" y2="{y - 22}" stroke="{BORDER}"/>'
        g += T(20, y + 5, key, "fmb", 13, FG2, ls=0.6)
        g += T(84, y + 5, what, "fm", fit(what, "fm", 13, aw - 84 - 130), FG3)
        pv, _ = pill(aw - 20, y, v, 13, anchor="end")
        g += pv
    return g


def art_memory(aw):
    # 14 nights of health on the default branch
    # the demo workspace's seven memory tests: INC-6 flaky one night, INC-3 failing the last two
    rows = ["INC-12", "INC-9", "INC-7", "INC-6", "INC-4", "INC-3", "INC-2"]
    state = {3: {6: "f"}, 5: {12: "x", 13: "x"}}
    lw = 76
    s, gap = 22, 7.5
    g = T(0, 14, "LAST 14 NIGHTS ON MAIN", "fm", 12, FG3, ls=1.4)
    for r, name in enumerate(rows):
        y = 34 + r * 33
        g += T(0, y + 15, name, "fm", 13, FG2)
        for n in range(14):
            st = state.get(r, {}).get(n, "h")
            col = {"h": PROVEN, "f": FLAKY, "x": RECUR}[st]
            op = ".9" if st != "h" else ".62"
            x = lw + n * (s + gap)
            g += (f'<rect class="pop" style="animation-delay:{.03 * n + .05 * r:.2f}s" x="{x:.1f}" y="{y}" width="{s}" '
                  f'height="{s}" rx="5" fill="{col}" fill-opacity="{op}"/>')
    py = 314
    x = 0
    for kd in ("healthy", "flaky", "failing"):
        pv, pw = pill(x, py, kd, 14)
        g += pv
        x += pw + 8
    return g


def art_still(aw):
    # weekly re-proof: undo the fix on today's main, the test must fail again
    g = ""
    steps = [("branch", "Today's main", "the default branch as it is now"),
             ("undo", "Undo the fix", "reverse only the fixed lines"),
             ("bolt", "Run the test twice", "same isolated runner")]
    bw, bh = 300, 84
    for k, (ic, a, b) in enumerate(steps):
        y = 8 + k * (bh + 24)
        g += f'<g class="fade" style="animation-delay:{.1 + .15 * k:.2f}s">' + card(0, y, bw, bh, 14, S1, BORDER_STRONG)
        g += icon(ic, 34, y + bh / 2, FG2, 24)
        g += T(62, y + 37, a, "fs", 19, FG) + T(62, y + 62, b, "fr", fit(b, "fr", 15, bw - 80), FG3) + "</g>"
        if k < 2:
            g += arrow(bw / 2, y + bh + 4, bw / 2, y + bh + 19, FG3, 2, 6)
    # outcomes
    ox = 380
    g += arrow(bw + 14, 8 + bh * 1.5 + 24, ox - 14, 8 + bh * 1.5 + 24, FG3, 2, 8)
    outs = [("guarding", "Fails both times", "bring the bug back and this test catches it"),
            ("weak", "Passes both times", "the bug could come back unnoticed"),
            ("drifted", "The fix can't be undone", "the fixed lines were rewritten since")]
    for k, (v, a, b) in enumerate(outs):
        y = 8 + k * (bh + 24)
        g += f'<g class="fade" style="animation-delay:{.6 + .15 * k:.2f}s">' + card(ox, y, aw - ox, bh, 14, S2 if k else S1, BORDER_STRONG)
        pv, pw = pill(ox + 22, y + bh / 2, v, 16)
        g += pv
        g += T(ox + 22 + 196, y + 37, a, "fs", 19, FG)
        g += T(ox + 22 + 196, y + 62, b, "fr", fit(b, "fr", 15, aw - ox - 240), FG3) + "</g>"
    return g


def art_agents(aw):
    g = card(0, 4, aw, 236, 14, SUNKEN, BORDER_STRONG)
    for k, c in enumerate((RECUR, INCONCLUSIVE, PROVEN)):
        g += f'<circle cx="{24 + k * 18}" cy="28" r="5" fill="{c}" fill-opacity=".7"/>'
    g += T(aw - 20, 33, "MCP /api/mcp", "fm", 12, FG3, "end", 1)
    lines = [("fmm", SIGNAL, "check_change"), ("fm", FG2, '  ["app/services/payment_service.py"]'),
             ("fm", FG3, "→ INC-12  Payment retry charged a"), ("fm", FG3, "  customer twice"),
             ("fm", PROVEN, "  keep: one order, one charge"), ("fm", FG3, "  test: test_inc_12_payment_retry.py")]
    for k, (cls, col, s) in enumerate(lines):
        g += T(22, 76 + k * 27, s, cls, fit(s, cls, 15, aw - 44), col)
    tools = ["check_change", "list_lessons", "get_incident", "ask"]
    x, y = 0, 278
    for tl in tools:
        c, w = chip(x, y, tl, 13, FG2, S2, BORDER, "fm", 10, 30, ls=0)
        if x + w > aw:
            x, y = 0, y + 40
            c, w = chip(x, y, tl, 13, FG2, S2, BORDER, "fm", 10, 30, ls=0)
        g += c
        x += w + 8
    g += T(0, 334, "+ lessons in AGENTS.md and LESSONS.md", "fr", 15, FG3)
    return g


def art_evidence(aw):
    g = card(0, 4, aw, 262, 14, SUNKEN, BORDER_STRONG)
    J = [(FG3, "{"),
         (None, '  "payload": {'),
         (None, '    "schema": "aftershock.evidence/v1",'),
         (None, '    "incident", "fix", "proof",'),
         (None, '    "memoryTests", "guard", "epicenter"'),
         (FG3, "  },"),
         (None, '  "signature": { "alg": "EdDSA", "kid": "…" }'),
         (FG3, "}")]
    for k, (col, s) in enumerate(J):
        if col is None:
            # keys in fg-2, strings in signal
            parts = s.split('"')
            x = 22
            y = 42 + k * 28
            for i, part in enumerate(parts):
                txt = part if i == 0 else part
                if i % 2 == 1:
                    txt = '"' + part + '"'
                    c = SIGNAL if (i >= 3 and parts[i - 1].strip().startswith(":")) else FG2
                else:
                    c = FG3
                if not txt:
                    continue
                g += T(x, y, txt, "fm", 14, c)
                x += measure(txt, "fm", 14)
        else:
            g += T(22, 42 + k * 28, s, "fm", 14, col)
    pv, pw = pill(0, 306, "proven", 15, label="Signature valid", cls="pop", style="animation-delay:.6s")
    g += pv
    g += T(pw + 14, 312, "Ed25519 · RFC 8785 · JWKS", "fm", fit("Ed25519 · RFC 8785 · JWKS", "fm", 14, aw - pw - 14), FG3)
    return g


def art_isolation(aw):
    # one run, inside a fresh microVM
    g = card(0, 4, aw, 326, 16, S1, BORDER_STRONG, dash="")
    g += icon("box", 28, 34, FG2, 22) + T(50, 40, "Fresh microVM, one per run", "fs", 17, FG)
    steps = [("lock", FG2, "Clone", "read-only token, one repository"),
             ("globe", FG2, "Install dependencies", "network on"),
             ("plug", RECUR, "Network cut", "before any test runs"),
             ("bolt", PROVEN, "Run tests, three times", "no secrets inside")]
    for k, (ic, col, a, b) in enumerate(steps):
        y = 92 + k * 58
        g += f'<circle cx="34" cy="{y}" r="16" fill="{SOFT.get(col, S2)}"/>' + icon(ic, 34, y, col, 18)
        if k < 3:
            g += f'<line x1="34" y1="{y + 18}" x2="34" y2="{y + 40}" stroke="{BORDER_STRONG}" stroke-width="2"/>'
        g += T(62, y - 2, a, "fb", 16, FG) + T(62, y + 19, b, "fr", fit(b, "fr", 14, aw - 220), FG3)
    # the network line, cut
    nx = aw - 110
    g += f'<path d="M{nx},70 V{92 + 2 * 58 - 17}" stroke="{SIGNAL}" stroke-width="2.4" stroke-linecap="round"/>'
    g += f'<path d="M{nx},{92 + 2 * 58 + 17} V{300}" stroke="{FG3}" stroke-opacity=".5" stroke-width="2.4" stroke-dasharray="2 7" stroke-linecap="round"/>'
    g += (f'<g class="pop" style="animation-delay:.8s"><circle cx="{nx}" cy="{92 + 2 * 58}" r="15" fill="{SOFT[RECUR]}" stroke="{RECUR}" stroke-width="1.5"/>'
          + icon("cross", nx, 92 + 2 * 58, RECUR, 14, 3) + "</g>")
    g += T(nx + 26, 76, "NETWORK", "fmb", 11, SIGNAL, ls=1.2)
    g += T(nx + 26, 92 + 2 * 58 + 5, "CUT", "fmb", 11, RECUR, ls=1.2)
    return g


def tiles():
    tile("tile-proof.svg", True, "01", "Time travel", "Proof by git history",
         ["A test is admitted only if it fails 3/3 on the commit before the fix",
          "and passes 3/3 on the fix. A model never marks anything proven."], art_proof,
         "01 Proof by git history. A test is admitted only if it fails three of three runs on the commit before the fix "
         "and passes three of three on the fix. In the sample, commit 3f2a1c9 fails three times and the fix aa86f56 "
         "passes three times, so the test is proven and admitted to memory. A model never marks anything proven.")
    tile("tile-guard.svg", False, "02", "Guard", "Every pull request, guarded",
         ["Relevant memory tests run on each pull request:",
          "one check, one comment, plus a recurrence risk."], art_guard,
         "02 Every pull request, guarded. Pull request 214, refactor: simplify payment service, gets the verdict Recur: "
         "INC-12 would come back, with the failure assert 201 == 400. Two other memory tests are Safe. Each pull request "
         "gets one check and one comment, Recur, Safe, Inconclusive or Skipped, plus a recurrence risk.")
    tile("tile-memory.svg", False, "03", "Memory", "Memory that stays honest",
         ["Proven tests re-run nightly on the default branch.",
          "Flaky tests are quarantined until seven green nights."], art_memory,
         "03 Memory that stays honest. A grid of six memory tests over the last 14 nights on main: most nights are "
         "Healthy, one test was Flaky twice and one is Failing on the last three nights. Proven tests re-run nightly; "
         "flaky tests are quarantined and released after seven green nights.")
    tile("tile-still.svg", True, "04", "Still guarding", "Still guarding, re-proved weekly",
         ["Weekly, the fix is undone on today's default branch and each memory",
          "test must fail again. Tests that no longer would are flagged (Labs)."], art_still,
         "04 Still guarding, re-proved weekly. Take today's main, undo the fix, run the test twice. Fails both times: "
         "still guarding. Passes both times: Weak, the bug could come back unnoticed. The fix can't be undone: Drifted, "
         "the fixed lines were rewritten since. A Labs feature.")
    tile("tile-agents.svg", False, "05", "Coding agents", "Coding agents remember",
         ["An MCP server answers before the change is made;",
          "lessons sync into AGENTS.md by pull request."], art_agents,
         "05 Coding agents remember. An MCP server at /api/mcp: check_change with the files an agent edited returns "
         "INC-12, payment retry charged a customer twice, the behaviour to keep (one order, one charge) and the test "
         "that will run. Tools: check_change, list_lessons, get_incident, ask. Lessons also land in AGENTS.md and "
         "LESSONS.md.")
    tile("tile-evidence.svg", False, "06", "Audit evidence", "Signed audit evidence",
         ["Each incident's proof and guard history, signed with",
          "Ed25519 and verifiable against a public JWKS."], art_evidence,
         "06 Signed audit evidence. A JSON bundle with schema aftershock.evidence/v1 holds the incident, the fix, every "
         "proof attempt, the memory tests, every guarded pull request and the epicenter, signed with Ed25519 (EdDSA) "
         "over RFC 8785 canonical JSON and verifiable with a public JWKS, for SOC 2 and DORA.")
    tile("tile-isolation.svg", False, "07", "Isolation", "Your code runs isolated",
         ["Every run gets a fresh microVM. The network is cut",
          "before tests run, and no secrets ever enter it."], art_isolation,
         "07 Your code runs isolated. Every run is a fresh microVM: clone with a read-only token for one repository, "
         "install dependencies with the network on, cut the network before any test runs, then run the tests three "
         "times with no secrets inside.")


# ================================================================ STACK (architecture)
def stack():
    W, H = 1600, 860
    defs, bg, edge = panel_frame(W, H)
    M = 48
    g = (T(M + 2, 70, "ONE NEXT.JS APP, THREE SERVICES", "fmb", 16, FG2, ls=2)
         + T(W - M, 70, "VERCEL + NEON, OR ONE MACHINE WITH DOCKER COMPOSE", "fm", 15, FG3, "end", 1.8))
    # left: who talks to it
    lx, lw, lh, lg = M, 330, 112, 18
    left = [("branch", "GitHub App", "sign-in, issues, webhooks, checks, comments, test pull requests"),
            ("alert", "Alerts and tickets", "Sentry and PagerDuty; seven more sources in Labs"),
            ("globe", "Browser", "the app and the public site"),
            ("terminal", "CLI and GitHub Action", "/api/v1; checks on your own runners"),
            ("agent", "Coding agents", "MCP server at /api/mcp")]
    ys = [124 + k * (lh + lg) for k in range(5)]

    def box(x, y, w, h, ic, title, sub, col=FG2, fill=S1, delay=0.0, sub2=None):
        b = f'<g class="fade" style="animation-delay:{delay:.2f}s">' + card(x, y, w, h, 14, fill, BORDER_STRONG)
        b += icon(ic, x + 34, y + 34, col, 24)
        b += T(x + 60, y + 41, title, "fs", fit(title, "fs", 20, w - 80), FG)
        lines = [sub] + ([sub2] if sub2 else [])
        for i, s in enumerate(lines):
            b += T(x + 24, y + 72 + i * 22, s, "fr", fit(s, "fr", 15, w - 48), FG3)
        return b + "</g>"

    for k, (ic, a, b) in enumerate(left):
        sub, sub2 = (b, None)
        if measure(b, "fr", 15) > lw - 48:
            words = b.split(" ")
            cut = len(words) // 2
            while measure(" ".join(words[:cut + 1]), "fr", 15) < lw - 48 and cut < len(words) - 1:
                cut += 1
            sub, sub2 = " ".join(words[:cut]), " ".join(words[cut:])
        g += box(lx, ys[k], lw, lh, ic, a, sub, delay=.05 * k, sub2=sub2)
    # centre: the app
    ax, aw_ = 470, 640
    ay, ah = 124, ys[-1] + lh - 124
    g += card(ax, ay, aw_, ah, 20, S1, LINE[SIGNAL])
    g += logomark(ax + 28, ay + 26, 34)
    g += T(ax + 76, ay + 52, "Next.js 16 app", "fs", 26, FG, ls=-0.4)
    g += T(ax + aw_ - 28, ay + 50, "VERCEL OR DOCKER", "fm", 13, FG3, "end", 1.4)
    inner = [("app/(site) app/(app)", "public site, docs and the product; server actions"),
             ("app/api/webhooks", "GitHub and every alert source, signature-verified"),
             ("app/api/v1 app/api/mcp", "HTTP API, CLI and the MCP server"),
             ("lib/workflows", "time travel, PR check, Epicenter, nightly; Vercel Workflow"),
             ("lib/domain", "verdicts, admission, relevance: pure and unit-tested")]
    rowh = (ah - 92 - 24 - 4 * 14) / 5
    for k, (a, b) in enumerate(inner):
        y = ay + 92 + k * (rowh + 14)
        g += f'<g class="fade" style="animation-delay:{.3 + .06 * k:.2f}s">' + card(ax + 24, y, aw_ - 48, rowh, 12, S2, BORDER)
        g += T(ax + 48, y + rowh / 2 - 6, a, "fmm", 16, SIGNAL if k == 3 else FG)
        g += T(ax + 48, y + rowh / 2 + 19, b, "fr", fit(b, "fr", 15, aw_ - 96), FG3) + "</g>"
    for k in range(5):
        yy = ys[k] + lh / 2
        g += arrow(lx + lw + 8, yy, ax - 10, yy, FG3, 2, 7)
    # right: what it uses
    rx, rw = 1190, W - M - 1190
    right = [("db", "Postgres", "Neon on Vercel; embedded PGlite locally", "and when self-hosted", PROVEN),
             ("box", "Runner", "Vercel Sandbox microVM, or Docker;", "network cut before tests, no secrets", RECUR),
             ("spark", "Model provider", "Muse, Vercel AI Gateway or any", "OpenAI-compatible endpoint", FLAKY)]
    rh = 142
    rgap = (ah - 3 * rh) / 2
    for k, (ic, a, b, c, col) in enumerate(right):
        y = ay + k * (rh + rgap)
        g += box(rx, y, rw, rh - 18, ic, a, b, FG2, delay=.5 + .08 * k, sub2=c)
        g += arrow(ax + aw_ + 10, y + (rh - 18) / 2, rx - 10, y + (rh - 18) / 2, FG3, 2, 7)
    note = ("Keys and webhook secrets are encrypted with AES-256-GCM. Runners clone with read-only, single-repository "
            "tokens. Nothing is pushed to a default branch.")
    g += T(M + 2, H - 30, note, "fr", fit(note, "fr", 17, W - 2 * M), FG3)
    svg = f'<defs>{defs}</defs><g clip-path="url(#clip)">{bg}{g}</g>{edge}'
    write("stack.svg", doc(W, H, svg, "",
          "Under the hood: one Next.js 16 app on Vercel or Docker. The GitHub App (sign-in, issues, webhooks, checks, "
          "comments and test pull requests), alerts and tickets (Sentry, PagerDuty and seven more sources in Labs), the "
          "browser, the CLI and GitHub Action (/api/v1) and coding agents (MCP at /api/mcp) all talk to it. Inside: "
          "app/(site) and app/(app) pages, app/api/webhooks, app/api/v1 and app/api/mcp, lib/workflows (time travel, "
          "PR check, Epicenter and nightly, on Vercel Workflow) and lib/domain (pure, unit-tested verdict logic). It "
          "uses Postgres (Neon on Vercel, embedded PGlite locally and self-hosted), a runner (a Vercel Sandbox microVM "
          "or Docker, network cut before tests, no secrets) and a model provider (Muse, Vercel AI Gateway or any "
          "OpenAI-compatible endpoint). Keys are encrypted with AES-256-GCM."))


# ================================================================ CTA
def cta():
    W, H = 1600, 440
    defs, bg, edge = panel_frame(W, H, 28)
    L = 72
    g = logomark(L, 60, 44)
    head = "Your last incident is waiting."
    size = fit(head, "fs", 72, 1000, -2.5)
    g += f'<g class="fade">' + T(L - 3, 196, head, "fs", size, FG, ls=round(-size * .035, 2)) + "</g>"
    sub = ["Turn it into a test that git history proves. Try Aftershock at",
           f"{SITE}, or self-host it with Docker Compose."]
    for i, s in enumerate(sub):
        g += T(L, 252 + i * 34, s, "fr", fit(s, "fr", 23, 960), FG2)
    # the button
    bt = "Try it live"
    bw = measure(bt, "fs", 24) + 40 + 34
    bx, by_ = W - L - bw, 150
    g += (f'<g class="pop" style="animation-delay:.4s"><rect x="{bx:.0f}" y="{by_}" width="{bw:.0f}" height="64" rx="12" fill="{SIGNAL}"/>'
          + T(bx + 24, by_ + 41, bt, "fs", 24, ON_SIGNAL)
          + arrow(bx + bw - 44, by_ + 32, bx + bw - 24, by_ + 32, ON_SIGNAL, 2.6, 8) + "</g>")
    g += T(W - L, by_ + 104, "APACHE-2.0 / OPEN SOURCE", "fm", 14, FG3, "end", 1.8)
    grad, trace = seismic(-10, W + 10, 372, 300, 760, 30, "ctr", seed=3, width=2.2, delay=.2, noise=1.6)
    svg = (f'<defs>{defs}{grad}</defs><g clip-path="url(#clip)">{bg}'
           f'<line x1="0" y1="372" x2="{W}" y2="372" stroke="#FFFFFF" stroke-opacity=".05"/>{g}{trace}</g>{edge}')
    write("cta.svg", doc(W, H, svg, "", f"Your last incident is waiting. Turn it into a test that git history proves. "
                         f"Try Aftershock at {SITE}, or self-host it with Docker Compose. Apache-2.0."))


# ================================================================ main
def main():
    lo, ld = contrast(HEAD, GITHUB_LIGHT), contrast(HEAD, GITHUB_DARK)
    no, nd = contrast(HEAD_NOTE, GITHUB_LIGHT), contrast(HEAD_NOTE, GITHUB_DARK)
    assert lo >= 4.5 and ld >= 3.0, (lo, ld)
    assert no >= 4.5 and nd >= 3.0, (no, nd)
    hero()
    for name, idx, title, note in [
        ("h-how.svg", "01", "How it works", "incident / proof / guard"),
        ("h-features.svg", "02", "What it does", "capture / prove / remember / guard"),
        ("h-see.svg", "03", "See it", "the demo workspace"),
        ("h-start.svg", "04", "Get started", "hosted / docker compose / development"),
        ("h-hood.svg", "05", "Under the hood", "next.js / postgres / microvms"),
        ("h-docs.svg", "06", "Documentation", "every guide in docs/"),
        ("h-status.svg", "07", "Status", f"v{VERSION} / current limits"),
        ("h-contribute.svg", "08", "Contributing", "issues and pull requests welcome"),
        ("h-licence.svg", "09", "Licence", "apache-2.0"),
    ]:
        header(name, idx, title, note)
    how_it_works()
    tiles()
    stack()
    cta()
    total = 0
    for name in WRITTEN:
        size = os.path.getsize(os.path.join(OUT, name))
        total += size
        print(f"{name:<22}{size / 1024:7.1f} KB")
    print(f"{'total':<22}{total / 1024:7.1f} KB")
    print(f"header accent {HEAD}: {lo:.2f}:1 on {GITHUB_LIGHT}, {ld:.2f}:1 on {GITHUB_DARK}")
    print(f"header note   {HEAD_NOTE}: {no:.2f}:1 on {GITHUB_LIGHT}, {nd:.2f}:1 on {GITHUB_DARK}")


if __name__ == "__main__":
    main()
