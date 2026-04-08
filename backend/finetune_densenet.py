"""
finetune_densenet.py
─────────────────────────────────────────────────────────────────────────────
Fine-tune DenseNet-169 directly from the already-extracted fracture_dataset/
folder (no ZIP required).

Dataset on disk:
  fracture_dataset/
    train/
      fractured/        4480 images
      not_fractured/    4383 images   ← these images are now being used!
    val/
      fractured/         360 images
      not_fractured/     240 images

Strategy:
  - Resumes from models/fracture_densenet.pth (existing 81.33% checkpoint)
  - Full fine-tune (all layers unlocked, NOT just the classifier head)
  - Lower LR (1e-4) to avoid catastrophic forgetting
  - 15 epochs with cosine annealing
  - Early stopping (patience=5)
  - Saves best model back to models/fracture_densenet.pth

Usage:
  python finetune_densenet.py              (full fine-tune, resume From checkpoint)
  python finetune_densenet.py --scratch    (train from ImageNet weights, no resume)
  python finetune_densenet.py --epochs 10  (override epoch count)
"""

import os
import sys
import json
import copy
import time
import argparse

import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim.lr_scheduler import CosineAnnealingLR
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(__file__)
DATASET_DIR  = os.path.join(BASE_DIR, "fracture_dataset")
MODELS_DIR   = os.path.join(BASE_DIR, "models")
OUT_WEIGHTS  = os.path.join(MODELS_DIR, "fracture_densenet.pth")
LATEST_WEIGHTS = os.path.join(MODELS_DIR, "latest_fine_tune.pth")
OUT_RESULTS  = os.path.join(MODELS_DIR, "fracture_results.json")

# ── Hyperparameters ───────────────────────────────────────────────────────────
IMG_SIZE     = 224
BATCH_SIZE   = 16        # smaller batch = more gradient steps per epoch
LR           = 1e-4      # conservative LR for full fine-tune (avoid forgetting)
WEIGHT_DECAY = 1e-4
NUM_EPOCHS   = 15
PATIENCE     = 5
NUM_WORKERS  = 0
DEVICE       = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# ─────────────────────────────────────────────────────────────────────────────
# Data
# ─────────────────────────────────────────────────────────────────────────────

def build_dataloaders():
    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE + 20, IMG_SIZE + 20)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.1),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.25, contrast=0.25, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    val_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    train_ds = datasets.ImageFolder(os.path.join(DATASET_DIR, "train"), transform=train_tf)
    val_ds   = datasets.ImageFolder(os.path.join(DATASET_DIR, "val"),   transform=val_tf)

    class_names  = train_ds.classes         # e.g. ["fractured", "not_fractured"]
    class_counts = [0] * len(class_names)
    for _, idx in train_ds.samples:
        class_counts[idx] += 1

    # Weighted sampler — balances fractured vs not_fractured during training
    sample_weights = [1.0 / class_counts[t] for _, t in train_ds.samples]
    sampler = torch.utils.data.WeightedRandomSampler(
        sample_weights, num_samples=len(sample_weights), replacement=True
    )

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler,
                              num_workers=NUM_WORKERS, pin_memory=False)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, pin_memory=False)

    print(f"\n📂  Dataset   : {DATASET_DIR}")
    print(f"📋  Classes   : {class_names}")
    print(f"🖼️   Train     : {len(train_ds)} images  {dict(zip(class_names, class_counts))}")
    print(f"🖼️   Val       : {len(val_ds)} images")
    print(f"⚡  Device    : {DEVICE}")
    print(f"📐  Batch     : {BATCH_SIZE}  |  LR: {LR}  |  Epochs: {NUM_EPOCHS}\n")

    return train_loader, val_loader, class_names, class_counts


# ─────────────────────────────────────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────────────────────────────────────

def build_model(num_classes: int, resume: bool = True):
    start_epoch = 1
    best_acc    = 0.0

    # Prioritize LATEST_WEIGHTS for resuming, fallback to OUT_WEIGHTS (best)
    resume_path = LATEST_WEIGHTS if os.path.isfile(LATEST_WEIGHTS) else OUT_WEIGHTS

    if resume and os.path.isfile(resume_path):
        print(f"🔄  Resuming from checkpoint: {resume_path}")
        ckpt = torch.load(resume_path, map_location="cpu", weights_only=False)
        start_epoch = ckpt.get("epoch", 0) + 1
        best_acc    = ckpt.get("val_acc", 0) # This might be the best so far
        print(f"    → Resuming from epoch: {start_epoch}")

        # Rebuild architecture (same as training script)
        model = models.densenet169(weights=None)
        in_f  = model.classifier.in_features
        model.classifier = nn.Sequential(
            nn.Linear(in_f, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.4),
            nn.Linear(512, num_classes),
        )
        model.load_state_dict(ckpt["model_state"])
    else:
        print("🌐  Starting from ImageNet pre-trained DenseNet-169 (no checkpoint resume)")
        model = models.densenet169(weights=models.DenseNet169_Weights.IMAGENET1K_V1)
        in_f  = model.classifier.in_features
        model.classifier = nn.Sequential(
            nn.Linear(in_f, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.4),
            nn.Linear(512, num_classes),
        )

    # Unlock ALL layers for full fine-tuning
    for param in model.parameters():
        param.requires_grad = True
    print("🔥  Full fine-tune — all layers unlocked\n")

    return model, start_epoch, best_acc


# ─────────────────────────────────────────────────────────────────────────────
# Evaluate
# ─────────────────────────────────────────────────────────────────────────────

def evaluate(model, loader, criterion):
    model.eval()
    total_loss, correct, n = 0.0, 0, 0
    with torch.no_grad():
        for imgs, labels in loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            out   = model(imgs)
            loss  = criterion(out, labels)
            total_loss += loss.item() * imgs.size(0)
            correct    += (out.argmax(1) == labels).sum().item()
            n          += imgs.size(0)
    return total_loss / n, correct / n


# ─────────────────────────────────────────────────────────────────────────────
# Training loop
# ─────────────────────────────────────────────────────────────────────────────

def train(resume: bool = True, num_epochs: int = NUM_EPOCHS):
    os.makedirs(MODELS_DIR, exist_ok=True)

    train_loader, val_loader, class_names, class_counts = build_dataloaders()

    model, start_epoch, best_acc = build_model(num_classes=len(class_names), resume=resume)
    model = model.to(DEVICE)

    # Class-weighted loss
    total   = sum(class_counts)
    class_w = torch.tensor(
        [total / (len(class_counts) * c) for c in class_counts],
        dtype=torch.float32
    ).to(DEVICE)
    criterion = nn.CrossEntropyLoss(weight=class_w)

    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=WEIGHT_DECAY)
    
    # ── Correct Scheduler Advance ──────────────────────────────────────────
    # last_epoch should be (start_epoch - 1) - 1 because scheduler.step() 
    # increments it on the first call. But standard way is:
    scheduler = CosineAnnealingLR(optimizer, T_max=num_epochs, eta_min=1e-6)
    if start_epoch > 1:
        for _ in range(start_epoch - 1):
            scheduler.step()

    history          = {"train_loss": [], "val_loss": [], "val_acc": []}
    best_state       = None
    patience_counter = 0

    print("=" * 80)
    print("🚀  Starting Full Fine-Tuning — DenseNet-169")
    print(f"    Using ALL {len(train_loader.dataset)} training images "
          f"(fractured + not_fractured)")
    print("=" * 80 + "\n")

    for epoch in range(start_epoch, num_epochs + 1):
        model.train()
        t0          = time.time()
        train_loss  = 0.0
        n           = 0
        num_batches = len(train_loader)

        for bi, (imgs, labels) in enumerate(train_loader, 1):
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            out  = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            train_loss += loss.item() * imgs.size(0)
            n          += imgs.size(0)

            # Live batch progress (prints every 10% of batches)
            if bi % max(1, num_batches // 10) == 0 or bi == num_batches:
                pct = bi / num_batches * 100
                bar = "█" * int(pct // 5) + "░" * (20 - int(pct // 5))
                print(
                    f"  Epoch {epoch:>2}/{num_epochs}  [{bar}] {pct:5.1f}%  "
                    f"Batch {bi}/{num_batches}  Loss: {train_loss/n:.4f}  "
                    f"Time: {time.time()-t0:.0f}s",
                    end="\r", flush=True,
                )
        print()  # newline after progress bar

        train_loss /= n
        val_loss, val_acc = evaluate(model, val_loader, criterion)
        scheduler.step()
        elapsed = time.time() - t0

        history["train_loss"].append(round(train_loss, 4))
        history["val_loss"].append(round(val_loss, 4))
        history["val_acc"].append(round(val_acc * 100, 2))

        # Always save latest state to allow perfect resume
        torch.save({
            "epoch":       epoch,
            "model_state": model.state_dict(),
            "val_acc":     val_acc,
            "class_names": class_names,
        }, LATEST_WEIGHTS)

        # Pretty epoch summary
        bar      = "█" * int(val_acc * 20) + "░" * (20 - int(val_acc * 20))
        acc_flag = "🏆 NEW BEST!" if val_acc > best_acc else ""
        print(
            f"Epoch [{epoch:>3}/{num_epochs}]  "
            f"TrainLoss: {train_loss:.4f}  ValLoss: {val_loss:.4f}  "
            f"ValAcc: {val_acc*100:6.2f}%  [{bar}]  "
            f"LR: {optimizer.param_groups[0]['lr']:.2e}  "
            f"Time: {elapsed:.1f}s  {acc_flag}"
        )

        if val_acc > best_acc:
            best_acc   = val_acc
            best_state = copy.deepcopy(model.state_dict())
            torch.save({
                "epoch":       epoch,
                "model_state": best_state,
                "val_acc":     val_acc,
                "class_names": class_names,
            }, OUT_WEIGHTS)
            print(f"   💾  Saved → {OUT_WEIGHTS}  (val_acc = {best_acc*100:.2f}%)")
            patience_counter = 0
        else:
            patience_counter += 1
            print(f"   ⏳  No improvement ({patience_counter}/{PATIENCE})")
            if patience_counter >= PATIENCE:
                print(f"\n⏹️  Early stopping at epoch {epoch}.")
                break

    # ── Final evaluation ──────────────────────────────────────────────────────
    print("\n" + "=" * 80)
    print("📊  Final Evaluation on Validation Set")
    print("=" * 80)

    model.load_state_dict(best_state)
    model.eval()

    all_preds, all_labels = [], []
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            preds = model(imgs).argmax(1)
            all_preds.extend(preds.cpu().tolist())
            all_labels.extend(labels.cpu().tolist())

    correct = sum(p == l for p, l in zip(all_preds, all_labels))
    acc     = correct / len(all_labels)

    for ci, cname in enumerate(class_names):
        tp = sum(1 for p, l in zip(all_preds, all_labels) if p == ci and l == ci)
        fn = sum(1 for p, l in zip(all_preds, all_labels) if p != ci and l == ci)
        fp = sum(1 for p, l in zip(all_preds, all_labels) if p == ci and l != ci)
        prec   = tp / (tp + fp + 1e-8)
        recall = tp / (tp + fn + 1e-8)
        f1     = 2 * prec * recall / (prec + recall + 1e-8)
        print(f"  {cname:<20}  Prec: {prec*100:.1f}%  Recall: {recall*100:.1f}%  F1: {f1*100:.1f}%")

    print(f"\n✅  Overall Accuracy : {acc*100:.2f}%  ({correct}/{len(all_labels)})")
    print(f"🏆  Best Val Acc     : {best_acc*100:.2f}%")
    print(f"💾  Weights saved    : {OUT_WEIGHTS}")

    results = {
        "best_val_acc":  round(best_acc * 100, 2),
        "final_val_acc": round(acc * 100, 2),
        "class_names":   class_names,
        "history":       history,
    }
    with open(OUT_RESULTS, "w") as f:
        json.dump(results, f, indent=2)
    print(f"📈  Results saved    : {OUT_RESULTS}\n")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tune DenseNet-169 on fracture dataset")
    parser.add_argument("--scratch", action="store_true",
                        help="Start from ImageNet weights (don't resume checkpoint)")
    parser.add_argument("--epochs", type=int, default=NUM_EPOCHS,
                        help=f"Number of training epochs (default: {NUM_EPOCHS})")
    args = parser.parse_args()

    train(resume=not args.scratch, num_epochs=args.epochs)
