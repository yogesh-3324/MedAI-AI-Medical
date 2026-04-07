from transformers import pipeline
from transformers import AutoProcessor, AutoModel
import torch

try:
    print("Loading processor...")
    processor = AutoProcessor.from_pretrained("google/medsiglip")
    print("Loading model...")
    model = AutoModel.from_pretrained("google/medsiglip")
    print("Success loading google/medsiglip")
except Exception as e:
    print(e)

try:
    processor = AutoProcessor.from_pretrained("MahsaF/MedSigLIP") 
    print("Success MahsaF")
except Exception as e:
    print("MahsaF error:", e)
