import argparse
import os
import zipfile
import io
import pandas as pd
import numpy as np
from tqdm import tqdm
import torch
from sklearn.metrics import roc_auc_score

import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.xray_service import load_vision_model, _preprocess_image

# The 14 official NIH pathology classes (subset of your CheXNet's 18 classes)
NIH_LABELS = [
    "Atelectasis", "Cardiomegaly", "Effusion", "Infiltration", "Mass", "Nodule", 
    "Pneumonia", "Pneumothorax", "Consolidation", "Edema", "Emphysema", 
    "Fibrosis", "Pleural_Thickening", "Hernia"
]

def main():
    parser = argparse.ArgumentParser(description="Evaluate CheXNet on NIH ChestX-ray14 Dataset.")
    parser.add_argument("--zip-file", type=str, required=True, help="Path to images_001.zip")
    parser.add_argument("--csv-file", type=str, required=True, help="Path to Data_Entry_2017.csv")
    args = parser.parse_args()

    # 1. Load Ground Truth Data
    print(f"Loading Ground Truth from {args.csv_file}...")
    df = pd.read_csv(args.csv_file)
    
    # Create binary columns for the 14 NIH labels
    # 'Finding Labels' column looks like "Atelectasis|Effusion" or "No Finding"
    for label in NIH_LABELS:
        # If the label string is present in the Finding Labels column, it's a 1, else 0
        df[label] = df["Finding Labels"].apply(lambda x: 1 if label in x else 0)

    # 2. Get Model & Setup
    print("Loading CheXNet Model...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load_vision_model()
    model.to(device)
    model_pathologies = list(model.pathologies)

    # 3. Read Images Directly from ZIP (so you don't waste 10 GB of space extracting)
    print(f"Opening {args.zip_file}...")
    zip_ref = zipfile.ZipFile(args.zip_file, 'r')
    
    # Filter only image files from the zip
    image_names = [f for f in zip_ref.namelist() if f.endswith(('.png', '.jpg', '.jpeg'))]
    print(f"Found {len(image_names)} images in the ZIP file.")

    # Find intersecting labels that both the user's Dataset AND CheXNet agree on
    EVAL_LABELS = [L for L in NIH_LABELS if L in model_pathologies]
    print(f"\nModel supports {len(EVAL_LABELS)} of the 14 NIH labels: {EVAL_LABELS}\n")

    y_true = {label: [] for label in EVAL_LABELS}
    y_pred = {label: [] for label in EVAL_LABELS}

    print("Running Inference over Images (this may take a while)...")
    
    # To keep track of filenames we evaluated (to match with CSV)
    evaluated_filenames = []

    for img_path_in_zip in tqdm(image_names):
        filename = os.path.basename(img_path_in_zip)
        
        # Look up this exact filename in the CSV
        row = df[df["Image Index"] == filename]
        if row.empty:
            continue  # Ignore if it's not in the ground truth

        evaluated_filenames.append(filename)
        
        # Add Ground Truth to arrays
        row_data = row.iloc[0]
        for label in EVAL_LABELS:
            y_true[label].append(row_data[label])

        # Read image securely into memory from Zip
        file_bytes = zip_ref.read(img_path_in_zip)
        
        # Prep & Predict
        try:
            img_tensor = _preprocess_image(file_bytes).to(device)
            with torch.no_grad():
                probs = model(img_tensor).cpu().numpy()[0]
                
            # Add Predictions to arrays
            for label in EVAL_LABELS:
                idx = model_pathologies.index(label)
                y_pred[label].append(probs[idx])
        except Exception as e:
            print(f"Error processing {filename}: {e}")
            for label in EVAL_LABELS:
                y_true[label].pop()  # remove the ground truth if we failed to predict
            evaluated_filenames.pop()

    # 4. Calculate Final Accuracy Metrics
    print(f"\n======================================")
    print(f"🏥 CLINICAL ACCURACY REPORT (AUC)")
    print(f"Total Images Evaluated: {len(evaluated_filenames)}")
    print(f"======================================")
    
    mean_auc = 0.0
    valid_labels = 0
    
    for label in EVAL_LABELS:
        try:
            auc = roc_auc_score(y_true[label], y_pred[label])
            print(f"• {label.ljust(20)} : {auc*100:.1f}%")
            mean_auc += auc
            valid_labels += 1
        except ValueError:
            # ROC AUC throws value error if only 1 class is present (e.g. 0 positive cases for Hernia in this specific subset)
            print(f"• {label.ljust(20)} : N/A (Not enough positive cases in {args.zip_file})")

    if valid_labels > 0:
        print(f"--------------------------------------")
        print(f"🏆 Average Accuracy (mAUC): {(mean_auc/valid_labels)*100:.1f}%")
        print(f"======================================")

if __name__ == "__main__":
    main()
