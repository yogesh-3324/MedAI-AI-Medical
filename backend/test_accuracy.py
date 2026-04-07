import os
import torch
import torch.nn as nn
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader
import zipfile
import shutil

# Config
DATASET_ZIP = "C:/Users/Dell/Downloads/archive.zip"
CHECKPOINT_PATH = "c:/Users/Dell/Desktop/medAI4/backend/models/fracture_densenet.pth"
EXTRACT_PATH = "./temp_eval"
IMG_SIZE = 224 # DenseNet-169 standard
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def run_test():
    # 1. Extraction
    print(f"📦 Extracting {DATASET_ZIP}...")
    if os.path.exists(EXTRACT_PATH):
        shutil.rmtree(EXTRACT_PATH)
    os.makedirs(EXTRACT_PATH, exist_ok=True)
    
    with zipfile.ZipFile(DATASET_ZIP, 'r') as z:
        z.extractall(EXTRACT_PATH)
    print("✅ Extraction complete.")

    # 2. Find 'val' folder
    val_dir = None
    for root, dirs, files in os.walk(EXTRACT_PATH):
        if "val" in dirs:
            val_dir = os.path.join(root, "val")
            break
            
    if not val_dir:
        print(f"❌ Could not find 'val' folder inside zip.")
        return

    # 3. Setup Dataset
    transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    try:
        dataset = datasets.ImageFolder(val_dir, transform=transform)
        loader = DataLoader(dataset, batch_size=16, shuffle=False)
        print(f"📊 Dataset loaded: {len(dataset)} images. Classes: {dataset.classes}")
    except Exception as e:
        print(f"❌ Error loading dataset: {e}")
        return

    # 4. DenseNet-169 Architecture (matches the fracture_densenet.pth checkpoint)
    print("🤖 Initializing DenseNet-169...")
    model = models.densenet169(weights=None)
    in_features = model.classifier.in_features
    # Standard 2-class head
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(0.4),
        nn.Linear(512, 2)
    )
    
    # 5. Load weights
    if os.path.exists(CHECKPOINT_PATH):
        print(f"🔄 Loading weights from {CHECKPOINT_PATH}...")
        try:
            checkpoint = torch.load(CHECKPOINT_PATH, map_location=DEVICE, weights_only=False)
            model.load_state_dict(checkpoint['model_state'])
        except Exception as e:
            print(f"⚠️ Warning: Could not load exact weights. Checking generic model performance instead. Error: {e}")
            # Potentially the user saved it without a model_state wrapper etc.
            # We'll stick to what we have.
    else:
        print("❌ No trained model weights found in models folder.")
        return
    
    model = model.to(DEVICE)
    model.eval()
    
    # 6. Evaluation Loop
    correct = 0
    total = 0
    print("\n🚀 Starting Evaluation...")
    with torch.no_grad():
        for i, (imgs, labels) in enumerate(loader):
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            outputs = model(imgs)
            _, predicted = torch.max(outputs.data, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
            
            if (i+1) % 5 == 0:
                print(f"  Processed {total}/{len(dataset)} images...")

    accuracy = 100 * correct / (total if total > 0 else 1)
    print("\n" + "═"*40)
    print(f"✅ FINAL TEST ACCURACY: {accuracy:.2f}%")
    print("═"*40)
    
    # Cleanup
    shutil.rmtree(EXTRACT_PATH)

if __name__ == "__main__":
    run_test()
