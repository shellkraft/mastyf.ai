#!/usr/bin/env python3
"""Rebrand architecture diagram PNGs: MCP Guardian → mastyf.ai (same layout)."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "apps/cloud/public/assets"
DASHBOARD_ASSETS = ROOT / "deploy/dashboard-spa/public/docs/assets"

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

TITLE_BLUE = (30, 58, 95)
HEADER_BG = (0, 10, 23)
WHITE = (255, 255, 255)
LIGHT_BG = (252, 252, 252)


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold else FONT_REG
    return ImageFont.truetype(path, size)


def cover_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: tuple[int, int, int]) -> None:
    draw.rectangle(box, fill=fill)


def center_text(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    width: int,
) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (width - text_w) // 2
    draw.text((x, y - text_h // 2), text, font=font, fill=fill)


def rebrand_security_swarm(path: Path) -> None:
    im = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(im)
    w, _ = im.size
    cover_rect(draw, (0, 18, w, 62), LIGHT_BG)
    center_text(draw, 40, "mastyf.ai Security Swarm", load_font(46), TITLE_BLUE, w)
    im.save(path, optimize=True)


def rebrand_llm_threat(path: Path) -> None:
    im = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(im)
    w, _ = im.size
    cover_rect(draw, (0, 12, w, 58), LIGHT_BG)
    center_text(
        draw,
        34,
        "mastyf.ai — LLM Threat Discovery Architecture",
        load_font(38),
        TITLE_BLUE,
        w,
    )
    # Phase 3 model name
    cover_rect(draw, (118, 868, 430, 902), (245, 243, 255))
    draw.text((125, 872), "mastyf-ai-threat:v1 Ollama model", font=load_font(16, bold=False), fill=(60, 60, 80))
    im.save(path, optimize=True)


def rebrand_auto_research(path: Path) -> None:
    im = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(im)
    w, _ = im.size
    cover_rect(draw, (0, 0, w, 98), HEADER_BG)
    center_text(
        draw,
        34,
        "mastyf.ai: Self-Sustaining Threat Research Architecture",
        load_font(34),
        WHITE,
        w,
    )
    center_text(
        draw,
        72,
        "Runtime + Security Swarm + LLM Threat Discovery + Auto Corpus Loop",
        load_font(18, bold=False),
        (180, 195, 220),
        w,
    )
    im.save(path, optimize=True)


def main() -> None:
    jobs = [
        ("security-swarm-architecture.png", rebrand_security_swarm),
        ("llm-threat-discovery-architecture.png", rebrand_llm_threat),
        ("auto-threat-research-architecture.png", rebrand_auto_research),
    ]
    for filename, fn in jobs:
        src = ASSETS / filename
        if not src.exists():
            raise SystemExit(f"Missing {src}")
        fn(src)
        print(f"Rebranded {src}")

        DASHBOARD_ASSETS.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, DASHBOARD_ASSETS / filename)
        print(f"Copied to {DASHBOARD_ASSETS / filename}")


if __name__ == "__main__":
    main()
