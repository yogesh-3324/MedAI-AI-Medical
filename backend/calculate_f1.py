import os
import torch
import torch.nn as nn
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
from sklearn.metrics import classification_report, confusion_matrix

# Config
DATASET_DIR = "./fracture_dataset"
OUT_WEIGHTS = "./models/fracture_densenet.pth"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE = 224

def build_model(num_classes=2):
    model = models.densenet169(weights=None)
    in_features = model.classifier.in_features
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(0.4),
        nn.Linear(512, num_classes)
    )
    return model

def calculate_f1():
    # 1. Loader
    val_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    
    val_ds = datasets.ImageFolder(os.path.join(DATASET_DIR, "val"), transform=val_tf)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False)
    class_names = val_ds.classes

    # 2. Load Model
    model = build_model(len(class_names)).to(DEVICE)
    if os.path.exists(OUT_WEIGHTS):
        print(f"🔄 Loading weights from {OUT_WEIGHTS}")
        checkpoint = torch.load(OUT_WEIGHTS, map_location=DEVICE, weights_only=False)
        model.load_state_dict(checkpoint['model_state'])
    else:
        print("❌ Model not found!")
        return

    # 3. Predict
    model.eval()
    all_preds = []
    all_labels = []
    
    print("📊 Evaluating model on validation set...")
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            out = model(imgs)
            preds = out.argmax(dim=1)
            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(labels.cpu().tolist())

    # 4. Report
    print("\n" + "="*50)
    print("📋 DETAILED MODEL METRICS")
    print("="*50)
    print(classification_report(all_labels, all_preds, target_names=class_names, digits=4))
    
    # Simple F1 extract for direct communication
    # Usually class 0 = fractured, class 1 = non_fractured
    print("Summary:")
    # Calculate per-class F1 for the response
    from sklearn.metrics import f1_score
    overall_f1 = f1_score(all_labels, all_preds, average='weighted')
    print(f"OVERALL_WEIGHTED_F1: {overall_f1:.4f}")

if __name__ == "__main__":
    calculate_f1()
