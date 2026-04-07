import os
import io
import json
import re
import logging
import numpy as np
import base64
from PIL import Image
from config import settings
from groq import Groq

logger = logging.getLogger(__name__)

# ─── Model globals ────────────────────────────────────────────────────────────
_chexnet_model    = None
_yolo_model       = None
_bone_model       = None        # EfficientNet-B3 OR fine-tuned DenseNet-169
_bone_transforms  = None
_bone_model_type  = None        # "efficientnet" | "densenet_custom" | "efficientnet_pretrained"

# ─── Vision + LLM model ───────────────────────────────────────────────────────
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# ─── Tunable thresholds ───────────────────────────────────────────────────────
FRACTURE_THRESHOLD        = 0.55   # EfficientNet/DenseNet softmax → "fractured"  (↑ = fewer false positives)
CHEST_PATHOLOGY_THRESHOLD = 0.40   # CheXNet positive finding threshold
GRADCAM_HIGH_THRESHOLD    = 0.45   # Primary Grad-CAM activation cutoff
GRADCAM_LOW_THRESHOLD     = 0.30   # Fallback if no contour at high threshold


# ══════════════════════════════════════════════════════════════════════════════
# MODEL LOADERS
# ══════════════════════════════════════════════════════════════════════════════

def load_chexnet_model():
    """CheXNet DenseNet-121 for chest X-ray pathology detection."""
    global _chexnet_model
    if _chexnet_model is None:
        logger.info("Initializing CheXNet DenseNet-121...")
        import torchxrayvision as xrv
        _chexnet_model = xrv.models.DenseNet(weights="densenet121-res224-chex")
        _chexnet_model.eval()
    return _chexnet_model


def load_bone_model():
    """
    Bone fracture classifier — priority order:
      1. fracture_efficientnet.pth   → custom fine-tuned EfficientNet-B3 (best, if available)
      2. fracture_densenet.pth       → existing fine-tuned DenseNet-169  (81.33 % accuracy)
      3. timm EfficientNet-B3 (pretrained) → fallback when no custom weights exist
    """
    global _bone_model, _bone_transforms, _bone_model_type

    if _bone_model is not None:
        return _bone_model, _bone_transforms, _bone_model_type

    import torch
    import timm
    from torchvision import transforms, models
    import torch.nn as nn

    models_dir       = os.path.join(os.path.dirname(__file__), "..", "models")
    effnet_weights   = os.path.join(models_dir, "fracture_efficientnet.pth")
    densenet_weights = os.path.join(models_dir, "fracture_densenet.pth")

    if os.path.isfile(effnet_weights):
        # ── 1. Custom fine-tuned EfficientNet-B3 ──────────────────────────
        logger.info(f"Loading custom EfficientNet-B3 weights: {effnet_weights}")
        checkpoint   = torch.load(effnet_weights, map_location="cpu", weights_only=False)
        class_names  = checkpoint.get("class_names", ["fractured", "not_fractured"])
        net = timm.create_model("efficientnet_b3", pretrained=False, num_classes=len(class_names))
        net.load_state_dict(checkpoint["model_state"])
        net.eval()
        _bone_model_type = "efficientnet"
        logger.info(f"EfficientNet-B3 loaded. Classes: {class_names}. Val acc: {checkpoint.get('val_acc', 'N/A')}")

    elif os.path.isfile(densenet_weights):
        # ── 2. Existing fine-tuned DenseNet-169 ───────────────────────────
        logger.info(f"Loading fine-tuned DenseNet-169 (81.33 % acc): {densenet_weights}")
        checkpoint  = torch.load(densenet_weights, map_location="cpu", weights_only=False)
        class_names = checkpoint.get("class_names", ["fractured", "not_fractured"])
        net         = models.densenet169(weights=None)
        in_features = net.classifier.in_features
        net.classifier = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.ReLU(inplace=True),
            nn.Dropout(0.4),
            nn.Linear(512, len(class_names))
        )
        net.load_state_dict(checkpoint["model_state"])
        net.eval()
        _bone_model_type = "densenet_custom"
        logger.info(f"DenseNet-169 loaded. Classes: {class_names}. Val acc: {checkpoint.get('val_acc', 'N/A')}")

    else:
        # ── 3. Pretrained EfficientNet-B3 from timm (fallback) ─────────────
        logger.warning(
            "No custom fracture weights found. "
            "Using ImageNet-pretrained EfficientNet-B3 as feature extractor. "
            "Classification confidence will be low — train for better results."
        )
        net = timm.create_model("efficientnet_b3", pretrained=True, num_classes=2)
        net.eval()
        _bone_model_type = "efficientnet_pretrained"
        logger.info("EfficientNet-B3 (timm pretrained) loaded.")

    _bone_model = net

    # ── Transforms ────────────────────────────────────────────────────────────
    if "efficientnet" in _bone_model_type:
        # EfficientNet-B3 native resolution: 300 × 300
        _bone_transforms = transforms.Compose([
            transforms.Resize(320),
            transforms.CenterCrop(300),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
    else:
        # DenseNet-169 standard
        _bone_transforms = transforms.Compose([
            transforms.Resize(224),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

    return _bone_model, _bone_transforms, _bone_model_type


def load_yolo_model():
    """YOLOv8n for optional fracture region localization."""
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        _yolo_model = YOLO('yolov8n.pt')
        logger.info("YOLOv8n loaded for fracture localization.")
    return _yolo_model


# ══════════════════════════════════════════════════════════════════════════════
# PRE-PROCESSING
# ══════════════════════════════════════════════════════════════════════════════

def _preprocess_chexnet(file_bytes: bytes):
    import torch, torchvision, torchxrayvision as xrv
    pil_img = Image.open(io.BytesIO(file_bytes)).convert("L")
    img = np.array(pil_img, dtype=np.float32)
    img = xrv.datasets.normalize(img, 255)
    img = img[None, ...]
    transform = torchvision.transforms.Compose([
        xrv.datasets.XRayCenterCrop(),
        xrv.datasets.XRayResizer(224),
    ])
    img = transform(img)
    return torch.from_numpy(img).unsqueeze(0)


# ══════════════════════════════════════════════════════════════════════════════
# GRAD-CAM  (unified for EfficientNet-B3, DenseNet-169, CheXNet DenseNet-121)
# ══════════════════════════════════════════════════════════════════════════════

def _get_gradcam_target_layer(model, model_type: str):
    """
    Returns the best Grad-CAM target layer for each supported architecture.
    - CheXNet (torchxrayvision):   model.features[-1]        (final BN after all blocks)
    - DenseNet-169 (torchvision):  model.features.denseblock4 (last dense block)
    - EfficientNet-B3 (timm):      model.conv_head            (final 1×1 conv before pooling)
    """
    try:
        if model_type == "chexnet":
            return model.features[-1]
        elif model_type == "densenet_custom":
            return model.features.denseblock4
        else:
            # efficientnet or efficientnet_pretrained
            return model.conv_head
    except AttributeError:
        logger.warning(f"Could not find target layer for {model_type}; falling back to last child.")
        children = list(model.children())
        return children[-2] if len(children) >= 2 else children[-1]


def get_gradcam_bounding_box(
    model,
    img_tensor,
    class_idx: int,
    orig_width: int,
    orig_height: int,
    model_type: str = "efficientnet"
) -> dict:
    """
    Runs Grad-CAM on the target layer of the given model architecture and
    returns a TIGHT, CLAMPED pixel-level bounding box around the
    highest-activation region.

    Improvements over naive Grad-CAM:
    - Gaussian smoothing before thresholding (removes noise speckles)
    - Adaptive percentile-based thresholding (top 15 % → 10 % → 7 % → 5 %)
      so the box size adapts to each image rather than using a fixed cutoff
    - Area-ratio guard: rejects boxes covering > 50 % of the image
    - Minimum-area filter: ignores contours < 0.5 % of image (noise)
    - Centroid fallback: if all percentiles still produce an over-large box,
      builds a 20 % × 20 % crop around the peak-activation pixel
    - All coordinates are hard-clamped to [0, orig_width/orig_height]
    """
    import torch
    import torch.nn.functional as F
    import cv2

    # ── Constants ────────────────────────────────────────────────────────────
    MAX_AREA_RATIO  = 0.50    # reject bbox that covers > 50 % of image
    MIN_AREA_RATIO  = 0.005   # ignore contours < 0.5 % of image (noise)
    CENTROID_RADIUS = 0.12    # radius of centroid fallback box (12 % of each dim)

    image_area = orig_width * orig_height
    no_box     = {"x1": 0, "y1": 0, "x2": 0, "y2": 0, "label": "None"}

    activations, gradients = [], []
    target_layer = _get_gradcam_target_layer(model, model_type)

    def _fwd_hook(module, inp, out):
        activations.append(out.detach())

    def _bwd_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0].detach())

    fh = target_layer.register_forward_hook(_fwd_hook)
    bh = target_layer.register_full_backward_hook(_bwd_hook)

    def _clamp_box(x1, y1, x2, y2):
        """Hard-clamp all four coords to image boundaries."""
        x1 = max(0, min(int(x1), orig_width  - 1))
        y1 = max(0, min(int(y1), orig_height - 1))
        x2 = max(0, min(int(x2), orig_width))
        y2 = max(0, min(int(y2), orig_height))
        return x1, y1, x2, y2

    try:
        img_t  = img_tensor.clone().detach().requires_grad_(True)
        output = model(img_t)
        model.zero_grad()

        score = output[0, class_idx] if output.dim() == 2 else output[class_idx]
        score.backward()

        if not activations or not gradients:
            logger.warning("Grad-CAM: no activations or gradients captured.")
            return no_box

        act  = activations[0].squeeze(0)   # [C, H, W]
        grad = gradients[0].squeeze(0)     # [C, H, W]

        if act.dim() < 2 or grad.dim() < 2:
            logger.warning("Grad-CAM: 1-D activations — no spatial map possible.")
            return no_box

        weights = grad.mean(dim=(1, 2))               # [C]
        cam     = (weights[:, None, None] * act).sum(0)  # [H, W]
        cam     = F.relu(cam).cpu().numpy()

        if cam.max() == 0:
            logger.warning("Grad-CAM: all-zero CAM.")
            return no_box

        # Normalise → [0, 1]
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        # Upsample to original image size
        cam_resized = cv2.resize(cam, (orig_width, orig_height),
                                 interpolation=cv2.INTER_LINEAR)

        # Gaussian smoothing — removes high-frequency noise that inflates bbox
        ksize = max(5, int(min(orig_width, orig_height) * 0.03) | 1)  # odd, ≥ 5
        cam_smooth = cv2.GaussianBlur(cam_resized, (ksize, ksize), 0)

        # ── Adaptive percentile thresholding ─────────────────────────────────
        # Try progressively tighter cuts (top 15 % → 10 % → 7 % → 5 %).
        # Accept the FIRST cut that produces a box small enough (≤ MAX_AREA_RATIO).
        best_box = None
        for pct in [85, 90, 93, 95]:
            threshold = np.percentile(cam_smooth, pct)
            if threshold <= 0:
                continue

            mask = (cam_smooth >= threshold).astype(np.uint8) * 255
            contours, _ = cv2.findContours(
                mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
            )
            # Drop tiny noise contours
            contours = [c for c in contours
                        if cv2.contourArea(c) >= MIN_AREA_RATIO * image_area]
            if not contours:
                continue

            # Use the contour with the highest mean CAM value (most relevant)
            def _mean_activation(cnt):
                mask_c = np.zeros((orig_height, orig_width), np.uint8)
                cv2.drawContours(mask_c, [cnt], -1, 255, -1)
                return float(cam_smooth[mask_c > 0].mean()) if mask_c.any() else 0.0

            best_contour = max(contours, key=_mean_activation)
            x, y, w, h  = cv2.boundingRect(best_contour)
            x1, y1, x2, y2 = _clamp_box(x, y, x + w, y + h)

            box_area    = (x2 - x1) * (y2 - y1)
            area_ratio  = box_area / image_area

            logger.debug(
                f"Grad-CAM percentile={pct}%  threshold={threshold:.3f}  "
                f"area_ratio={area_ratio:.2f}"
            )

            if area_ratio <= MAX_AREA_RATIO:
                best_box = (x1, y1, x2, y2)
                logger.info(
                    f"Grad-CAM ({model_type}): box accepted at p{pct} — "
                    f"area_ratio={area_ratio:.2f}  "
                    f"box=({x1},{y1},{x2},{y2})"
                )
                break   # tight enough — stop here

        if best_box:
            x1, y1, x2, y2 = best_box
            return {"x1": x1, "y1": y1, "x2": x2, "y2": y2}

        # ── Centroid fallback ─────────────────────────────────────────────────
        # All percentile cuts still produced an over-large box.
        # Use the peak-activation pixel as centre and build a compact crop.
        logger.warning(
            "Grad-CAM: all percentile cuts produced over-large boxes — "
            "falling back to centroid crop."
        )
        peak_yx = np.unravel_index(np.argmax(cam_smooth), cam_smooth.shape)
        cy, cx  = int(peak_yx[0]), int(peak_yx[1])
        half_w  = max(10, int(orig_width  * CENTROID_RADIUS))
        half_h  = max(10, int(orig_height * CENTROID_RADIUS))
        x1, y1, x2, y2 = _clamp_box(
            cx - half_w, cy - half_h, cx + half_w, cy + half_h
        )
        logger.info(
            f"Grad-CAM centroid fallback: centre=({cx},{cy})  "
            f"box=({x1},{y1},{x2},{y2})"
        )
        return {"x1": x1, "y1": y1, "x2": x2, "y2": y2}

    except Exception as e:
        logger.error(f"Grad-CAM error ({model_type}): {e}", exc_info=True)
        return no_box
    finally:
        fh.remove()
        bh.remove()


# ══════════════════════════════════════════════════════════════════════════════
# GROQ HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _parse_json_from_reply(reply: str) -> dict:
    if "```" in reply:
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", reply, re.DOTALL)
        reply = match.group(1) if match else reply.replace("```json", "").replace("```", "")
    match = re.search(r"\{[\s\S]+\}", reply)
    if match:
        reply = match.group(0)
    return json.loads(reply.strip())


def _groq_vision_call(file_bytes: bytes, prompt: str, max_tokens: int = 1600) -> str:
    client = Groq(api_key=settings.GROQ_API_KEY)
    b64    = base64.b64encode(file_bytes).decode("utf-8")
    completion = client.chat.completions.create(
        model=GROQ_VISION_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text",      "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
            ]
        }],
        temperature=0.1,
        max_tokens=max_tokens
    )
    return completion.choices[0].message.content


# ══════════════════════════════════════════════════════════════════════════════
# TWO-PASS GROQ ANALYSIS  (anti-hallucination)
# ══════════════════════════════════════════════════════════════════════════════

def _two_pass_groq_analysis(
    file_bytes: bytes,
    analysis_signals: str,
    scan_context: str,
    bounding_box: dict
) -> dict:
    """
    Pass 1 — Anatomical survey (plain text):
        Forces the model to precisely describe what it actually sees in the
        image before any structured output is requested.  This is the primary
        defence against hallucination (e.g. always returning "fracture near wrist").

    Pass 2 — Structured JSON report:
        Uses Pass-1 findings as grounded context.  All example values have
        been removed from the JSON template; placeholder instructions are used
        instead so the model cannot copy-paste a hardcoded answer.
    """

    # ── Pass 1: Anatomical Survey ─────────────────────────────────────────────
    pass1_prompt = """You are a board-certified radiologist performing a careful visual analysis of the X-ray image attached.

Study this image thoroughly, then answer ONLY based on what you can directly and clearly observe.

Provide a single plain-text paragraph that covers:
1. What type of X-ray is this? (e.g., hand PA view, left wrist lateral, right knee AP, lumbar spine, ankle, femur, tibia, shoulder, etc.)
2. Which specific bone(s) are clearly visible?
3. Is there a fracture, cortical break, bone discontinuity, periosteal reaction, or abnormal lucency visible?
4. If a fracture or abnormality IS present — state its EXACT anatomical location on the bone (e.g., "distal radius at the metaphysis", "mid-shaft of the 5th metatarsal", "femoral neck", "proximal tibia").
5. If you are NOT confident about the location or presence of a fracture, explicitly say: "Location unclear" or "No fracture clearly visible."

CRITICAL RULES:
- Do NOT hallucinate. If you cannot clearly see something, say so.
- Do NOT assume a body part from common injury patterns. Only describe what you see.
- Anatomical specificity is required (e.g., "distal ulna" not just "arm").
- Honest uncertainty is better than a confident wrong answer.

Respond with ONE plain-text paragraph only. No JSON. No bullet points. No headers."""

    pass1_findings = "Initial visual survey could not be completed."
    try:
        pass1_findings = _groq_vision_call(file_bytes, pass1_prompt, max_tokens=450)
        logger.info(f"Pass 1 survey: {pass1_findings[:250]}...")
    except Exception as e:
        logger.error(f"Pass 1 failed: {e}")

    # ── Pass 2: Structured Report ──────────────────────────────────────────────
    bb = bounding_box
    pass2_prompt = f"""You are a medical imaging AI generating a structured diagnostic report for a clinical system.

═══════════════════════════════════════════════════════
ANALYSIS CONTEXT  (use this as your PRIMARY information source)
═══════════════════════════════════════════════════════
Scan type            : {scan_context}
Radiologist AI survey: "{pass1_findings}"
Neural model signal  : {analysis_signals}
Grad-CAM region      : pixels x1={bb['x1']} y1={bb['y1']} x2={bb['x2']} y2={bb['y2']}

═══════════════════════════════════════════════════════
MANDATORY ANTI-HALLUCINATION RULES  — NEVER VIOLATE
═══════════════════════════════════════════════════════
1. "location" MUST describe what you actually observe in the attached X-ray.
   → Look at the image NOW. What bone is visible? Where exactly is the fracture line?
   → Do NOT copy example values. Do NOT guess.
   → If location is genuinely unclear: set location = "The exact fracture location is unclear — a radiologist must review this image."

2. "result_label" must truthfully reflect findings. Allowed values:
   "Fracture Detected" | "No Fracture Found" | "Possible Fracture — Uncertain" | "Abnormality Detected"

3. "confidence_score" must reflect GENUINE certainty (0-100).
   → If Pass-1 said "unclear" or "not visible", score MUST be below 55.
   → If you are not sure, say so in the disclaimer.

4. NEVER mention a body part (wrist, ankle, femur, etc.) unless the X-ray clearly shows it.
   NEVER mention "wrist" unless you can actually see a wrist in this image.

5. "observations" in doctor_view must describe what YOU literally see in the image, not generic text.

═══════════════════════════════════════════════════════
PATIENT VIEW (plain English — kind, non-technical)
═══════════════════════════════════════════════════════
• result_label  : one short honest sentence (see allowed values above)
• result_detail : 4-5 sentences — what happened, is it serious, what causes it, how does it feel
• location      : where is the finding in plain everyday terms — "lower part of the shin bone", "base of the big toe", etc.
• what_to_do_next: 4-5 action sentences — ER now? Rest at home? Which specialist?
• confidence_score: integer 0-100 reflecting YOUR honest certainty
• disclaimer    : 2-3 honest sentences; if confidence < 60, explicitly say you are not certain and they MUST see a doctor

═══════════════════════════════════════════════════════
DOCTOR VIEW (clinical terminology)
═══════════════════════════════════════════════════════
• observations         : 4-5 detailed radiological observations of what you literally see
• suggested_diagnosis  : primary clinical diagnosis with full anatomical specificity
• differential_diagnosis: 2-3 alternative diagnoses
• risk_summary         : 2-3 sentences on clinical significance and urgency
• limitations          : 2 real limitations of AI X-ray interpretation
• iou                  : float 0.0-1.0 estimated spatial accuracy of Grad-CAM bounding box

Return ONLY raw valid JSON — no markdown, no code blocks, no extra text:
{{
  "patient_view": {{
    "result_label": "<your actual finding from the image>",
    "result_detail": "<your actual explanation based on what you observe>",
    "location": "<the anatomical location you actually see in the image>",
    "what_to_do_next": "<your recommendation>",
    "confidence_score": 0,
    "disclaimer": "<your honest disclaimer>"
  }},
  "doctor_view": {{
    "observations": ["<observation 1>", "<observation 2>", "<observation 3>", "<observation 4>", "<observation 5>"],
    "suggested_diagnosis": "<your diagnosis based on the image>",
    "differential_diagnosis": ["<alt 1>", "<alt 2>"],
    "risk_summary": "<your clinical assessment>",
    "limitations": ["<limitation 1>", "<limitation 2>"],
    "iou": 0.0
  }}
}}"""

    try:
        report_reply = _groq_vision_call(file_bytes, pass2_prompt, max_tokens=2000)
        return _parse_json_from_reply(report_reply)
    except Exception as e:
        logger.error(f"Pass 2 report generation failed: {e}")
        # Build an honest fallback that still surfaces Pass-1 findings
        return {
            "patient_view": {
                "result_label": "Analysis Incomplete",
                "result_detail": (
                    f"The initial visual analysis found: {pass1_findings[:250]}. "
                    "However, the full structured report could not be generated due to a system error."
                ),
                "location": "Could not be determined — please consult a radiologist.",
                "what_to_do_next": "Please consult a qualified doctor for evaluation of this X-ray.",
                "confidence_score": 0,
                "disclaimer": "This analysis encountered an error. Do not rely on this result. Please see a radiologist."
            },
            "doctor_view": {
                "observations": [f"Initial visual survey: {pass1_findings[:400]}"],
                "suggested_diagnosis": "Incomplete analysis — manual radiologist review required.",
                "differential_diagnosis": [],
                "risk_summary": "Risk cannot be assessed due to analysis failure.",
                "limitations": [
                    "System error prevented full structured report generation.",
                    "Manual radiologist review is mandatory."
                ],
                "iou": 0.0
            }
        }


# ══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def parse_xray_image(file_bytes: bytes) -> dict:
    import torch

    pil_img_rgb = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    width, height = pil_img_rgb.size

    # ── Step 1: Route — Chest vs. Bone ────────────────────────────────────────
    logger.info("Routing scan type via Groq Vision...")
    try:
        route_reply = _groq_vision_call(
            file_bytes,
            "Look at this X-ray image carefully. "
            "Is it a CHEST X-ray (showing ribs, lungs, heart, diaphragm) "
            "or a BONE X-ray (showing limb bones, joints, spine)? "
            "Reply with exactly one word: CHEST or BONE. Nothing else.",
            max_tokens=10
        )
        is_chest = "CHEST" in route_reply.upper()
    except Exception as e:
        logger.error(f"Routing error: {e}")
        is_chest = False

    analysis_signals = ""
    scan_context     = ""
    bounding_box     = {"x1": 0, "y1": 0, "x2": width, "y2": height, "label": "None"}

    # ── Step 2a: Chest → CheXNet DenseNet-121 + Grad-CAM ─────────────────────
    if is_chest:
        logger.info("CHEST → CheXNet DenseNet-121 + Grad-CAM")
        try:
            chexnet    = load_chexnet_model()
            img_tensor = _preprocess_chexnet(file_bytes)

            with torch.no_grad():
                probs_np = chexnet(img_tensor).cpu().numpy()[0]

            pathologies = {
                label: float(probs_np[i])
                for i, label in enumerate(chexnet.pathologies)
            }
            positives = sorted(
                {k: v for k, v in pathologies.items() if v >= CHEST_PATHOLOGY_THRESHOLD}.items(),
                key=lambda x: x[1], reverse=True
            )[:4]

            if positives:
                top_label, top_prob = positives[0]
                top_idx = list(chexnet.pathologies).index(top_label)

                # Grad-CAM for CheXNet
                img_tensor_grad = _preprocess_chexnet(file_bytes)
                box_raw         = get_gradcam_bounding_box(
                    chexnet, img_tensor_grad, top_idx, width, height, model_type="chexnet"
                )
                bounding_box = {**box_raw, "label": top_label}

                analysis_signals = "CheXNet DenseNet-121 — chest pathology signals:\n"
                for label, prob in positives:
                    analysis_signals += f"  • {label}: {prob * 100:.1f}%\n"

            else:
                top = max(pathologies.items(), key=lambda x: x[1])
                analysis_signals = (
                    f"No major chest pathology detected above {CHEST_PATHOLOGY_THRESHOLD*100:.0f}% threshold. "
                    f"Highest signal: {top[0]} at {top[1]*100:.1f}%\n"
                )
                bounding_box = {"x1": 0, "y1": 0, "x2": width, "y2": height, "label": "None"}

            scan_context = "Chest X-ray (CheXNet DenseNet-121)."

        except Exception as e:
            logger.error(f"CheXNet / Grad-CAM error: {e}", exc_info=True)
            analysis_signals = "Chest scan analysis could not be completed."
            scan_context     = "Chest X-ray."

    # ── Step 2b: Bone → EfficientNet-B3 + Grad-CAM + optional YOLOv8n ─────────
    else:
        logger.info("BONE → EfficientNet-B3 (or DenseNet-169 fallback) + Grad-CAM + YOLOv8n")
        try:
            bone_model, bone_tf, bone_type = load_bone_model()

            # ── Classification ──────────────────────────────────────────────
            input_tensor = bone_tf(pil_img_rgb).unsqueeze(0)
            with torch.no_grad():
                out   = bone_model(input_tensor)
                probs = torch.nn.functional.softmax(out[0], dim=0)
                # Index 0 = "fractured", Index 1 = "not_fractured"
                prob_fractured = probs[0].item()

            is_fractured = prob_fractured >= FRACTURE_THRESHOLD
            status       = "Fractured" if is_fractured else "Normal"
            logger.info(
                f"Bone model ({bone_type}): {status} — "
                f"fracture probability={prob_fractured*100:.1f}% (threshold={FRACTURE_THRESHOLD*100:.0f}%)"
            )

            # ── Grad-CAM ────────────────────────────────────────────────────
            input_tensor_grad = bone_tf(pil_img_rgb).unsqueeze(0)
            box_raw = get_gradcam_bounding_box(
                bone_model, input_tensor_grad, 0, width, height, model_type=bone_type
            )
            bounding_box = {
                **box_raw,
                "label": "Suspected Fracture" if is_fractured else "Region of Interest"
            }

            analysis_signals = (
                f"Bone classifier ({bone_type}):\n"
                f"  • Status            : {status}\n"
                f"  • Fracture prob     : {prob_fractured*100:.1f}%  "
                f"(threshold: {FRACTURE_THRESHOLD*100:.0f}%)\n"
                f"  • Non-fracture prob : {(1 - prob_fractured)*100:.1f}%\n"
            )

            # ── Optional YOLOv8n (only when fracture detected) ────────────
            if is_fractured:
                try:
                    yolo_mod = load_yolo_model()
                    yolo_res = yolo_mod(pil_img_rgb, verbose=False)
                    if yolo_res and len(yolo_res[0].boxes) > 0:
                        yb   = yolo_res[0].boxes[0]
                        # ── Clamp YOLO coords to image bounds ─────────────
                        raw  = yb.xyxy[0].tolist()
                        x1y  = max(0, min(int(raw[0]), width  - 1))
                        y1y  = max(0, min(int(raw[1]), height - 1))
                        x2y  = max(0, min(int(raw[2]), width))
                        y2y  = max(0, min(int(raw[3]), height))
                        conf = float(yb.conf[0])

                        # Sanity: box must be non-degenerate
                        yolo_valid = (x2y > x1y + 4) and (y2y > y1y + 4)
                        yolo_area  = (x2y - x1y) * (y2y - y1y) if yolo_valid else 0
                        image_area = width * height

                        analysis_signals += (
                            f"  • YOLOv8n region    : ({x1y},{y1y})→({x2y},{y2y})  "
                            f"conf={conf:.2f}  area_ratio={yolo_area/image_area:.2f}\n"
                        )

                        gradcam_area = (
                            (bounding_box["x2"] - bounding_box["x1"]) *
                            (bounding_box["y2"] - bounding_box["y1"])
                        )
                        # Prefer YOLO only when: valid box, higher confidence,
                        # tighter than Grad-CAM, and covers ≤ 45 % of image
                        if (
                            yolo_valid
                            and conf >= 0.4
                            and yolo_area < gradcam_area
                            and yolo_area / image_area <= 0.45
                        ):
                            logger.info(
                                f"YOLOv8n bbox is tighter and valid — using YOLO "
                                f"({x1y},{y1y})→({x2y},{y2y})"
                            )
                            bounding_box = {
                                "x1": x1y, "y1": y1y,
                                "x2": x2y, "y2": y2y,
                                "label": "YOLO Fracture Region"
                            }
                    else:
                        analysis_signals += "  • YOLOv8n           : no specific region localised\n"
                except Exception as ye:
                    logger.warning(f"YOLOv8n failed (non-critical, using Grad-CAM only): {ye}")
                    analysis_signals += "  • YOLOv8n           : localisation skipped\n"

            scan_context = f"Musculoskeletal / bone X-ray ({bone_type} classifier)."

        except Exception as e:
            logger.error(f"Bone analysis pipeline error: {e}", exc_info=True)
            analysis_signals = "Bone scan analysis could not be completed."
            scan_context     = "Bone X-ray."

    # ── Step 3: Two-Pass Groq LLM Report ─────────────────────────────────────
    logger.info("Generating diagnostic report via two-pass Groq Vision (anti-hallucination)...")
    result_json = _two_pass_groq_analysis(file_bytes, analysis_signals, scan_context, bounding_box)

    result_json["bounding_box"] = bounding_box
    result_json["is_chest"]     = is_chest
    return result_json


# ══════════════════════════════════════════════════════════════════════════════
# X-RAY CHAT
# ══════════════════════════════════════════════════════════════════════════════

def chat_about_xray(file_bytes: bytes, user_message: str, history: list) -> str:
    client = Groq(api_key=settings.GROQ_API_KEY)
    b64    = base64.b64encode(file_bytes).decode("utf-8")

    messages = [{
        "role": "system",
        "content": (
            "You are a friendly medical assistant. When talking to patients, use simple, "
            "kind, everyday language — no medical jargon. When the user seems to be a "
            "doctor or asks in clinical terms, respond with accurate clinical terminology."
        )
    }]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({
        "role": "user",
        "content": [
            {"type": "text",      "text": user_message},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}
        ]
    })

    try:
        completion = client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=600
        )
        return completion.choices[0].message.content
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return "I'm sorry, I'm unable to answer that right now. Please try again."


# ══════════════════════════════════════════════════════════════════════════════
# RISK ANALYSIS
# ══════════════════════════════════════════════════════════════════════════════

def analyze_risk(data_json: dict) -> dict:
    client = Groq(api_key=settings.GROQ_API_KEY)
    pv = data_json.get("patient_view", {})
    dv = data_json.get("doctor_view", {})

    prompt = f"""You are a medical risk classifier.

Based on this diagnostic report, classify the risk level:
- Finding          : {pv.get('result_label', '')}
- Detail           : {pv.get('result_detail', '')}
- Observations     : {dv.get('observations', [])}
- Suggested diagnosis: {dv.get('suggested_diagnosis', '')}
- Clinical risk    : {dv.get('risk_summary', '')}
- AI confidence    : {pv.get('confidence_score', 50)}%

Risk Level Guidelines:
- EMERGENCY (80-100): Life-threatening — pneumothorax, severe dislocation, multiple fractures,
  tension pneumothorax, acute spinal injury, open fracture
- URGENT (40-79): Needs medical attention within 24-48 hours — confirmed fracture, significant
  opacity, pleural effusion, consolidation
- SAFE (0-39): Minor or no significant findings — routine follow-up sufficient

Return ONLY raw JSON (no markdown):
{{"risk_level": "URGENT", "risk_probability": 68, "risk_reason": "A fracture appears to be present with moderate confidence. Visit a doctor or urgent care within 24 hours. Avoid putting pressure on the affected area."}}"""

    try:
        completion = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a medical risk classifier. Return valid JSON only."},
                {"role": "user",   "content": prompt}
            ],
            temperature=0.1,
            max_tokens=300
        )
        return _parse_json_from_reply(completion.choices[0].message.content)
    except Exception as e:
        logger.error(f"Risk analysis failed: {e}")
        conf      = pv.get("confidence_score", 50)
        diagnosis = dv.get("suggested_diagnosis", "").lower()
        label     = pv.get("result_label", "").lower()

        if any(k in diagnosis + label for k in ["pneumothorax", "tension", "acute", "spinal", "multiple", "open"]):
            return {
                "risk_level": "EMERGENCY",
                "risk_probability": 90,
                "risk_reason": "Critical finding detected. Go to an emergency room immediately."
            }
        elif conf > 60 and any(k in diagnosis + label for k in [
            "fracture", "break", "opacity", "effusion", "consolidation", "detected"
        ]):
            return {
                "risk_level": "URGENT",
                "risk_probability": 68,
                "risk_reason": "A significant finding was detected. Please visit a doctor within 24 hours for proper evaluation."
            }
        else:
            return {
                "risk_level": "SAFE",
                "risk_probability": 22,
                "risk_reason": "No critical findings detected at this time. A routine check-up is still recommended."
            }
