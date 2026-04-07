from transformers import AutoConfig
try:
    AutoConfig.from_pretrained("fokan/MedSigLIP")
    print("fokan/MedSigLIP is OPEN")
except Exception as e:
    print("fokan/MedSigLIP ERROR:", type(e).__name__)

try:
    AutoConfig.from_pretrained("dokster/medsiglip_448_finetuned")
    print("dokster/medsiglip_448_finetuned is OPEN")
except Exception as e:
    print("dokster/medsiglip_448_finetuned ERROR:", type(e).__name__)

try:
    AutoConfig.from_pretrained("alecocc/medsiglip-448-ft-crc100k")
    print("alecocc/medsiglip-448-ft-crc100k is OPEN")
except Exception as e:
    print("alecocc/medsiglip-448-ft-crc100k ERROR:", type(e).__name__)

try:
    AutoConfig.from_pretrained("google/siglip-base-patch16-224")
    print("google/siglip-base-patch16-224 (Standard SigLIP) is OPEN")
except Exception as e:
    pass
