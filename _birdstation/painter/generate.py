import argparse
import json
import os
import time
from pathlib import Path

import torch
from pipeline import MiniT2ITextToImagePipeline, MiniT2IMMJiTModel, MiniT2IFlowMatchScheduler
from transformers import AutoTokenizer, T5EncoderModel

parser = argparse.ArgumentParser()
parser.add_argument('prompts', type=Path)
parser.add_argument('--steps', type=int, default=100)
parser.add_argument('--guidance', type=float, default=6.0)
parser.add_argument('--output', type=Path, default=Path('outputs'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
torch.set_num_threads(4)
for model_file in [Path('checkpoints/minit2i-l-16/transformer/diffusion_pytorch_model.safetensors'),
                   Path('text-encoder/model.safetensors')]:
    with model_file.open('rb') as stream:
        # GB10 cannot always reclaim file-backed cache during CUDA initialization.
        os.posix_fadvise(stream.fileno(), 0, 0, os.POSIX_FADV_DONTNEED)
torch.cuda.init()
print('Loading official MiniT2I-L/16 checkpoint on DGX Spark', flush=True)
transformer = MiniT2IMMJiTModel.from_pretrained(
    'checkpoints/minit2i-l-16/transformer', torch_dtype=torch.bfloat16,
    low_cpu_mem_usage=True, local_files_only=True, device_map={'':'cuda'},
)
scheduler = MiniT2IFlowMatchScheduler.from_pretrained('checkpoints/minit2i-l-16/scheduler')
tokenizer = AutoTokenizer.from_pretrained('text-encoder', local_files_only=True)
encoder = T5EncoderModel.from_pretrained('text-encoder', dtype=torch.float32, local_files_only=True)
pipe = MiniT2ITextToImagePipeline(transformer=transformer, scheduler=scheduler,
                                 tokenizer=tokenizer, text_encoder=encoder).to('cuda').eval()
print('Checkpoint ready', flush=True)
for entry in json.loads(args.prompts.read_text()):
    output = args.output / (entry['id'] + '.png')
    if output.exists():
        continue
    start = time.monotonic()
    generator = torch.Generator(device='cuda').manual_seed(entry['seed'])
    print('Painting ' + entry['id'], flush=True)
    with torch.inference_mode():
        image = pipe(entry['prompt'], guidance_scale=args.guidance,
                     num_inference_steps=args.steps, generator=generator,
                     progress=True).images[0]
    image.save(output)
    torch.cuda.synchronize()
    metadata = dict(entry, model='MiniT2I/MiniT2I', variant='l16',
                    revision='5b4da2870d1554992670d1005567e9d55b1b37bb',
                    textEncoderRevision='0613663d0d48ea86ba8cb3d7a44f0f65dc596a2a',
                    steps=args.steps, guidance=args.guidance,
                    seconds=round(time.monotonic()-start, 2),
                    peakAllocatedGiB=round(torch.cuda.max_memory_allocated()/2**30, 2))
    output.with_suffix('.json').write_text(json.dumps(metadata, indent=2))
    print(json.dumps(metadata), flush=True)
