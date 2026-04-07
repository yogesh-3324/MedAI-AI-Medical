from transformers import pipeline
import time

try:
    print("Loading BLIP model...")
    start = time.time()
    captioner = pipeline("image-to-text", model="Salesforce/blip-image-captioning-base")
    print(f"Loaded in {time.time() - start:.2f}s")
    res = captioner("https://huggingface.co/datasets/Narsil/image_dummy/resolve/main/parrots.png")
    print("Success:", res)
except Exception as e:
    print("Error:", e)
