from huggingface_hub import HfApi
api = HfApi()
models = api.list_models(search="MedSigLIP")
with open("medsiglip_models.txt", "w") as f:
    for m in models:
        f.write(f"{m.id}\n")
