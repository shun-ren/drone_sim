"""Build a compact, readable README animation from recorded browser frames."""

from pathlib import Path
import sys

from PIL import Image

source = Path(sys.argv[1])
destination = Path(sys.argv[2])
frames = sorted(source.glob("*.png"))
if not frames:
    raise SystemExit(f"No PNG frames found in {source}")

# Keep the full flight story while limiting the README download size.
limit = 18
if len(frames) > limit:
    frames = [frames[round(i * (len(frames) - 1) / (limit - 1))] for i in range(limit)]

images = []
for frame in frames:
    image = Image.open(frame).convert("RGB")
    image.thumbnail((960, 615), Image.Resampling.LANCZOS)
    images.append(image.quantize(colors=128, method=Image.Quantize.MEDIANCUT))

destination.parent.mkdir(parents=True, exist_ok=True)
images[0].save(
    destination,
    save_all=True,
    append_images=images[1:],
    duration=350,
    loop=0,
    optimize=True,
    disposal=2,
)
