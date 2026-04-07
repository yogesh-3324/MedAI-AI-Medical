from transformers import AutoConfig

models = [
    "fokan/MedSigLIP",
    "dokster/medsiglip_448_finetuned",
    "alecocc/medsiglip-448-ft-crc100k",
    "google/siglip-base-patch16-224"
]

with open("ungated.txt", "w") as f:
    for m in models:
        try:
            AutoConfig.from_pretrained(m)
            f.write(f"{m} is OPEN\n")
        except Exception as e:
            f.write(f"{m} ERROR: {type(e).__name__}\n")
