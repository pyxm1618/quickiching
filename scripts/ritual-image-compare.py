"""Local-only canonical Ritual comparison; never resamples a reference."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

parser = argparse.ArgumentParser()
parser.add_argument('reference', type=Path)
parser.add_argument('runtime', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
canonical = (1672, 941)
reference = Image.open(args.reference).convert('RGB')
if any(abs(a-b)>2 for a,b in zip(reference.size, canonical)):
    raise SystemExit(f'Reference export variance exceeds 2px: {reference.size}')
# Fixed top/left alignment: crop right/bottom overflow, replicate right/bottom edge.
aligned = Image.new('RGB', canonical)
aligned.paste(reference.crop((0,0,min(reference.width,1672),min(reference.height,941))), (0,0))
if reference.width<1672:
    aligned.paste(reference.crop((reference.width-1,0,reference.width,min(941,reference.height))).resize((1672-reference.width,min(941,reference.height)),Image.Resampling.NEAREST),(reference.width,0))
if reference.height<941:
    aligned.paste(aligned.crop((0,reference.height-1,1672,reference.height)).resize((1672,941-reference.height),Image.Resampling.NEAREST),(0,reference.height))
runtime = Image.open(args.runtime).convert('RGB')
if runtime.size != canonical:
    raise SystemExit(f'Runtime must be exactly {canonical}, got {runtime.size}')
args.output.mkdir(parents=True,exist_ok=True)
aligned.save(args.output/'reference.png')
runtime.save(args.output/'runtime.png')
Image.blend(aligned,runtime,.5).save(args.output/'overlay.png')
difference=ImageChops.difference(aligned,runtime)
difference.save(args.output/'difference.png')
side_by_side=Image.new('RGB',(3344,941));side_by_side.paste(aligned);side_by_side.paste(runtime,(1672,0));side_by_side.save(args.output/'side-by-side.png')
report={'reference':str(args.reference),'runtime':str(args.runtime),'reference_dimensions':reference.size,'canonical':canonical,'edge_alignment':'top-left; right/bottom edge crop/pad <=2px; no artwork resampling','mean_absolute_channel_difference':ImageStat.Stat(difference).mean,'difference_bbox':difference.getbbox(),'status':'NOT PASS','note':'Whole-image numeric difference includes authorized background, font glyph and example copy deviations. No foreground difference is automatically waived.'}
(args.output/'comparison.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
