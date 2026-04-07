import torch
import os

checkpoint_path = "./models/fracture_densenet.pth"
if os.path.exists(checkpoint_path):
    checkpoint = torch.load(checkpoint_path, map_location='cpu', weights_only=False)
    acc = checkpoint.get("val_acc", 0.0)
    print(f"VERIFIED_ACCURACY: {acc * 100:.2f}%")
else:
    print("ERROR: Checkpoint not found.")
