"""캡처한 프레임(tmp/demo/<이름>/manifest.json)을 README용 GIF로 조립한다(개발 도구).

실행(저장소 루트): backend/.venv/bin/python tools/demo/make_gif.py main tutorial coach
- Pillow를 쓴다(백엔드 가상환경에 이미 있음, 앱 런타임 의존성 아님).
- 1280×720 프레임을 가로 WIDTH로 줄이고, 프레임마다 정해 둔 시간만큼 보여 준다.
- 프레임마다 팔레트(256색)를 따로 잡는다. 공통 팔레트는 어두운 배경에 색을 다 써서 작은 강조색(보라·분홍)이 바랬다.
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FRAMES = ROOT / "tmp" / "demo"
OUT = ROOT / "docs" / "assets" / "demo"
WIDTH = 960


def load(name):
    folder = FRAMES / name
    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    images, durations = [], []
    for entry in manifest:
        image = Image.open(folder / entry["file"]).convert("RGB")
        height = round(image.height * WIDTH / image.width)
        images.append(image.resize((WIDTH, height), Image.LANCZOS))
        durations.append(entry["ms"])
    return images, durations


def build(name):
    images, durations = load(name)
    frames = [image.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE) for image in images]
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{name}.gif"
    frames[0].save(target, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=True, disposal=1)
    print(f"{target.relative_to(ROOT)}: {len(frames)}프레임, {sum(durations) / 1000:.1f}초, {target.stat().st_size / 1_000_000:.2f}MB")


if __name__ == "__main__":
    for name in sys.argv[1:] or ["main", "tutorial", "coach"]:
        build(name)
