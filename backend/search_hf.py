from huggingface_hub import HfApi
api = HfApi()
models = api.list_models(search="MedSigLIP", task="zero-shot-image-classification")
for m in models:
    print(m.id)
models2 = api.list_models(search="MedSigLIP")
for m in models2:
    print(m.id)
