import argparse
import os
import csv
import io
import torch
import numpy as np
from PIL import Image

# Modify path so we can import from backend
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.xray_service import load_vision_model, _preprocess_image

def main():
    parser = argparse.ArgumentParser(description="Evaluate CheXNet on a local dataset of Chest X-rays.")
    parser.add_argument("--img-dir", type=str, required=True, help="Path to folder containing X-ray images")
    parser.add_argument("--output", type=str, default="predictions.csv", help="Output CSV path for the AI scores")
    args = parser.parse_args()

    # Find all images
    img_paths = []
    for ext in (".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"):
        for root, dirs, files in os.walk(args.img_dir):
            for file in files:
                if file.lower().endswith(ext):
                    img_paths.append(os.path.join(root, file))

    if not img_paths:
        print(f"No images found in {args.img_dir}")
        return

    print(f"Found {len(img_paths)} images. Loading CheXNet model...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load_vision_model()
    model.to(device)
    pathologies = model.pathologies
    
    with open(args.output, "w", newline="") as f:
        writer = csv.writer(f)
        # Write CSV Header
        writer.writerow(["Filename"] + pathologies)

        print("Running bulk inference...")
        for i, img_path in enumerate(img_paths, 1):
            if i % 10 == 0 or i == 1:
                print(f"Processing image {i}/{len(img_paths)}: {os.path.basename(img_path)}")
                
            try:
                with open(img_path, "rb") as bf:
                    file_bytes = bf.read()
                
                # Preprocess image and move to GPU/CPU
                img_tensor = _preprocess_image(file_bytes).to(device)
                
                # Perform inference
                with torch.no_grad():
                    probs = model(img_tensor).cpu().numpy()[0]
                
                # Save row to CSV (round to 4 decimal places)
                writer.writerow([os.path.basename(img_path)] + [f"{p:.4f}" for p in probs])
                
            except Exception as e:
                print(f"Failed to process {img_path}: {e}")

    print(f"Done! Predictions saved to {args.output}")
    print("You can verify accuracy by comparing these 18 probability columns to your ground truth labels.")

if __name__ == "__main__":
    main()
