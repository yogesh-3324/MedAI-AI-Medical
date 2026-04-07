"""
Fine-tune DenseNet-169 on a fractured / non-fractured bone X-ray dataset.

Dataset zip expected structure:
  train/
    fractured/        ← fractured images
    non fractured/    ← (or "non_fractured") healthy images
  val/
    fractured/
    non fractured/

Usage:
  python train_fracture.py --zip "C:/path/to/dataset.zip"

Outputs:
  models/fracture_densenet.pth   ← best checkpoint (loaded by xray_service)
  models/fracture_results.json   ← accuracy / loss history
"""

import os
import sys
import json
import zipfile
import shutil
import argparse
import time
import copy

import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader

# ── Config ───────────────────────────────────────────────────────────────────
NUM_EPOCHS   = 20
BATCH_SIZE   = 32
LR           = 3e-4
WEIGHT_DECAY = 1e-4
IMG_SIZE     = 224         # Reverted to 224 for DenseNet
NUM_WORKERS  = 0
PATIENCE     = 5
MODELS_DIR   = os.path.join(os.path.dirname(__file__), "models")
DATASET_DIR  = os.path.join(os.path.dirname(__file__), "fracture_dataset")
OUT_WEIGHTS  = os.path.join(MODELS_DIR, "fracture_densenet.pth")
OUT_RESULTS  = os.path.join(MODELS_DIR, "fracture_results.json")
CLASSES      = ["fractured", "non_fractured"]
DEVICE       = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ── Helpers ───────────────────────────────────────────────────────────────────

def extract_zip(zip_path: str, dest: str):
    """Extract zip, normalise folder names (spaces → underscores)."""
    print(f"\n📦  Extracting {zip_path} → {dest}")
    if os.path.exists(dest):
        shutil.rmtree(dest)
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(dest)

    # Flatten if there is a single top-level directory wrapping everything
    children = os.listdir(dest)
    if len(children) == 1 and os.path.isdir(os.path.join(dest, children[0])):
        inner = os.path.join(dest, children[0])
        for item in os.listdir(inner):
            shutil.move(os.path.join(inner, item), dest)
        shutil.rmtree(inner)

    # Normalise class folder names (spaces → underscores, lowercase)
    for split in ("train", "val"):
        split_dir = os.path.join(dest, split)
        if not os.path.isdir(split_dir):
            continue
        for folder in os.listdir(split_dir):
            normalised = folder.lower().replace(" ", "_")
            if folder != normalised:
                os.rename(
                    os.path.join(split_dir, folder),
                    os.path.join(split_dir, normalised)
                )
    print("✅  Extraction done.\n")


def build_dataloaders(dataset_dir: str, max_images: int = None, offset: int = 0):
    """Return (train_loader, val_loader, class_names, class_counts)."""

    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE + 16, IMG_SIZE + 16)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    val_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    train_ds = datasets.ImageFolder(os.path.join(dataset_dir, "train"), transform=train_tf)
    val_ds   = datasets.ImageFolder(os.path.join(dataset_dir, "val"),   transform=val_tf)

    # ── Limit to max_images if specified ──────────────────────────────────────
    if max_images or offset:
        import random
        indices = list(range(len(train_ds)))
        # We use a fixed seed for shuffling so "offset" is consistent across runs
        random.seed(42)
        random.shuffle(indices)
        
        start = offset if offset else 0
        end = start + max_images if max_images else len(indices)
        indices = indices[start:end]
        
        train_ds = torch.utils.data.Subset(train_ds, indices)
        # rebuild class counts from subset
        full_ds = datasets.ImageFolder(os.path.join(dataset_dir, "train"))
        class_counts = [0] * len(full_ds.classes)
        for idx in indices:
            class_counts[full_ds.samples[idx][1]] += 1
        class_names = full_ds.classes
        print(f"⚡  Subset mode: Using images {start} to {end} ({len(indices)} total)")
    else:
        class_counts = [0] * len(train_ds.classes)
        for _, idx in train_ds.samples:
            class_counts[idx] += 1
        class_names = train_ds.classes

    # Weighted sampler (handle imbalance)
    if hasattr(train_ds, 'samples'):
        sample_weights = [1.0 / class_counts[t] for _, t in train_ds.samples]
    else:
        # Subset — rebuild weights
        full_ds2 = datasets.ImageFolder(os.path.join(dataset_dir, "train"))
        sample_weights = [1.0 / class_counts[full_ds2.samples[i][1]] for i in train_ds.indices]

    sampler = torch.utils.data.WeightedRandomSampler(
        sample_weights, num_samples=len(sample_weights), replacement=True
    )

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler,
                              num_workers=NUM_WORKERS, pin_memory=False)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, pin_memory=False)

    print(f"\n\U0001f4c2  Classes : {class_names}")
    print(f"\U0001f5bc\ufe0f   Train   : {len(train_ds)} images")
    print(f"\U0001f5bc\ufe0f   Val     : {len(val_ds)} images")
    print(f"\u2696\ufe0f   Counts  : {dict(zip(class_names, class_counts))}\n")

    return train_loader, val_loader, class_names, class_counts



def build_model(num_classes: int = 2, freeze_backbone: bool = True, resume_path: str = None) -> nn.Module:
    """
    DenseNet-169 Architecture. Optionally loads weights from resume_path.
    """
    model = models.densenet169(weights=models.DenseNet169_Weights.IMAGENET1K_V1 if not resume_path else None)
    in_features = model.classifier.in_features
    model.classifier = nn.Sequential(
        nn.Linear(in_features, 512),
        nn.ReLU(inplace=True),
        nn.Dropout(0.4),
        nn.Linear(512, num_classes)
    )
    
    if resume_path and os.path.exists(resume_path):
        print(f"🔄 Resuming from checkpoint: {resume_path}")
        checkpoint = torch.load(resume_path, map_location="cpu", weights_only=False)
        model.load_state_dict(checkpoint['model_state'])
    
    if freeze_backbone:
        # Freeze all layers except final denseblock4, norm5, and classifier
        # This keeps the training much faster even on GPU.
        for name, param in model.named_parameters():
            if not any(x in name for x in ["denseblock4", "norm5", "classifier"]):
                param.requires_grad = False
        print("⚡  Backbone frozen — training last dense block + classifier")
    else:
        for param in model.parameters():
            param.requires_grad = True
        print("🔥  Full fine-tune — ALL layers training")
    return model


def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss, correct, n = 0.0, 0, 0
    with torch.no_grad():
        for imgs, labels in loader:
            imgs, labels = imgs.to(device), labels.to(device)
            out  = model(imgs)
            loss = criterion(out, labels)
            total_loss += loss.item() * imgs.size(0)
            preds = out.argmax(dim=1)
            correct += (preds == labels).sum().item()
            n += imgs.size(0)
    return total_loss / n, correct / n


def print_bar(epoch, total, train_loss, val_loss, val_acc, lr, elapsed):
    bar = "█" * int(val_acc * 20) + "░" * (20 - int(val_acc * 20))
    print(
        f"Epoch [{epoch:>3}/{total}]  "
        f"TrainLoss: {train_loss:.4f}  ValLoss: {val_loss:.4f}  "
        f"ValAcc: {val_acc*100:5.2f}%  [{bar}]  "
        f"LR: {lr:.2e}  Time: {elapsed:.1f}s"
    )


# ── Training loop ─────────────────────────────────────────────────────────────

def train(zip_path: str, max_images: int = None, offset: int = 0, num_epochs: int = NUM_EPOCHS, full_finetune: bool = False, resume: bool = False):
    os.makedirs(MODELS_DIR, exist_ok=True)

    # 1. Extract
    extract_zip(zip_path, DATASET_DIR)

    # 2. Dataloaders
    train_loader, val_loader, class_names, class_counts = build_dataloaders(DATASET_DIR, max_images=max_images, offset=offset)

    # 3. Model
    resume_path = OUT_WEIGHTS if resume else None
    print(f"🤖  Device : {DEVICE}")
    print(f"📐  Model  : DenseNet-169 | Classes: {class_names}")
    model = build_model(num_classes=len(class_names), freeze_backbone=not full_finetune, resume_path=resume_path).to(DEVICE)
    print()

    # 4. Loss — weighted for class imbalance
    total = sum(class_counts)
    class_w = torch.tensor([total / (len(class_counts) * c) for c in class_counts],
                           dtype=torch.float32).to(DEVICE)
    criterion = nn.CrossEntropyLoss(weight=class_w)

    # 5. Optimiser + Scheduler
    optimizer = optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=LR, weight_decay=WEIGHT_DECAY
    )
    scheduler = CosineAnnealingLR(optimizer, T_max=num_epochs, eta_min=1e-6)

    # 6. Train
    history = {"train_loss": [], "val_loss": [], "val_acc": []}
    best_acc   = 0.0
    best_state = None
    patience_counter = 0

    print("="*80)
    print("🚀  Starting Training")
    print("="*80)
    print("ℹ️   Running on CPU — each epoch may take 5-20 minutes. You'll see live batch progress below.")
    print("    Press Ctrl+C at any time — best weights so far will already be saved.\n")

    for epoch in range(1, num_epochs + 1):
        model.train()
        t0 = time.time()
        train_loss, n = 0.0, 0
        num_batches = len(train_loader)

        for batch_idx, (imgs, labels) in enumerate(train_loader, 1):
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            out  = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item() * imgs.size(0)
            n          += imgs.size(0)

            # Print every 5 batches (or every batch if dataset is small)
            if batch_idx % max(1, num_batches // 10) == 0 or batch_idx == num_batches:
                elapsed = time.time() - t0
                avg_loss = train_loss / n
                pct = batch_idx / num_batches * 100
                bar = "█" * int(pct // 5) + "░" * (20 - int(pct // 5))
                print(
                    f"  Epoch {epoch:>2}/{NUM_EPOCHS}  "
                    f"[{bar}] {pct:5.1f}%  "
                    f"Batch {batch_idx}/{num_batches}  "
                    f"Loss: {avg_loss:.4f}  "
                    f"Time: {elapsed:.0f}s",
                    end="\r", flush=True
                )
        print()  # newline after epoch progress bar

        train_loss /= n
        val_loss, val_acc = evaluate(model, val_loader, criterion, DEVICE)
        scheduler.step()
        elapsed = time.time() - t0

        history["train_loss"].append(round(train_loss, 4))
        history["val_loss"].append(round(val_loss, 4))
        history["val_acc"].append(round(val_acc * 100, 2))

        print_bar(epoch, num_epochs, train_loss, val_loss, val_acc,
                  optimizer.param_groups[0]["lr"], elapsed)

        # Save best
        if val_acc > best_acc:
            best_acc   = val_acc
            best_state = copy.deepcopy(model.state_dict())
            torch.save({
                "epoch":       epoch,
                "model_state": best_state,
                "val_acc":     val_acc,
                "class_names": class_names,
            }, OUT_WEIGHTS)
            print(f"   💾  Saved best model  (val_acc = {best_acc*100:.2f}%)")
            patience_counter = 0
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                print(f"\n⏹️  Early stopping at epoch {epoch} (no improvement for {PATIENCE} epochs).")
                break

    # 7. Final evaluation on val set
    print("\n" + "=" * 80)
    print("📊  Final Evaluation on Validation Set")
    print("=" * 80)

    model.load_state_dict(best_state)
    model.eval()

    all_preds, all_labels, all_probs = [], [], []
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            out = model(imgs)
            probs = torch.softmax(out, dim=1)[:, 0]   # Fracture probability
            preds = out.argmax(dim=1)
            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(labels.cpu().tolist())
            all_probs.extend(probs.cpu().tolist())

    correct = sum(p == l for p, l in zip(all_preds, all_labels))
    total   = len(all_labels)
    acc     = correct / total

    # Per-class stats
    for ci, cname in enumerate(class_names):
        tp = sum(1 for p, l in zip(all_preds, all_labels) if p == ci and l == ci)
        fn = sum(1 for p, l in zip(all_preds, all_labels) if p != ci and l == ci)
        fp = sum(1 for p, l in zip(all_preds, all_labels) if p == ci and l != ci)
        recall    = tp / (tp + fn + 1e-8)
        precision = tp / (tp + fp + 1e-8)
        f1        = 2 * precision * recall / (precision + recall + 1e-8)
        print(f"  {cname:<20}  Precision: {precision*100:.1f}%  Recall: {recall*100:.1f}%  F1: {f1*100:.1f}%")

    print(f"\n✅  Overall Accuracy : {acc*100:.2f}%  ({correct}/{total})")
    print(f"🏆  Best Val Acc     : {best_acc*100:.2f}%")
    print(f"💾  Weights saved    : {OUT_WEIGHTS}")

    # 8. Save results JSON
    results = {
        "best_val_acc":  round(best_acc * 100, 2),
        "final_val_acc": round(acc * 100, 2),
        "class_names":   class_names,
        "history":       history,
    }
    with open(OUT_RESULTS, "w") as f:
        json.dump(results, f, indent=2)
    print(f"📈  Results saved    : {OUT_RESULTS}\n")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune DenseNet-169 on fracture X-ray dataset")
    parser.add_argument("--zip",        type=str, required=True,  help="Full path to dataset zip")
    parser.add_argument("--max_images", type=int, default=None,   help="Num images to train on")
    parser.add_argument("--offset",     type=int, default=0,      help="Start index for images (e.g. 100 to start after first 100)")
    parser.add_argument("--epochs",     type=int, default=20,     help="Num epochs")
    parser.add_argument("--full",       action="store_true",      help="Full fine-tune")
    parser.add_argument("--resume",     action="store_true",      help="Resume from previous best model")
    args = parser.parse_args()

    if not os.path.isfile(args.zip):
        print(f"❌  Zip file not found: {args.zip}")
        sys.exit(1)

    train(args.zip, max_images=args.max_images, offset=args.offset, num_epochs=args.epochs, full_finetune=args.full, resume=args.resume)
