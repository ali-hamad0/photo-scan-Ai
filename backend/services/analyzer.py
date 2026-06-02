import base64
import io
import logging

import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

# Minimum confidence required to accept a result — below this the image is
# likely not the correct scan type for the model.
MIN_CONFIDENCE = {
    "chest_xray": 0.80,
    "bone_xray":  0.80,
    "brain_mri":  0.60,
}

# Maximum allowed color variance between R/G/B channels.
# Real medical scans (X-ray, MRI) are grayscale — colorful images are rejected.
_MAX_COLOR_VARIANCE = 15.0


_SCAN_CLASSIFIER = None
_SCAN_CLASS_NAMES = ["chest_xray", "bone_xray", "brain_mri"]


def _load_scan_classifier():
    global _SCAN_CLASSIFIER
    if _SCAN_CLASSIFIER is not None:
        return _SCAN_CLASSIFIER
    import tensorflow as tf
    model_path = "models/scan_classifier.h5"
    try:
        _SCAN_CLASSIFIER = tf.keras.models.load_model(model_path)
        logger.info("Scan classifier loaded from %s", model_path)
    except Exception as e:
        logger.warning("Scan classifier not found — skipping scan-type gate: %s", e)
    return _SCAN_CLASSIFIER


def validate_scan_image(file_bytes: bytes, scan_type: str):
    """
    Returns (True, None) if the image is plausibly the correct scan type,
    or (False, reason_string) if it should be rejected.

    Layer 1 — grayscale check: rejects color photos immediately.
    Layer 2 — scan-type classifier: rejects wrong-modality grayscale images
              (e.g. bone X-ray fed to chest model). Skipped gracefully if
              models/scan_classifier.h5 has not been trained yet.
    """
    try:
        img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        arr = np.array(img, dtype=np.float32)
    except Exception:
        return False, "Could not read the uploaded file as an image."

    # Layer 1 — color photo rejection
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    color_variance = float(
        np.mean([np.std(r - g), np.std(r - b), np.std(g - b)])
    )
    if color_variance > _MAX_COLOR_VARIANCE:
        return False, (
            f"The uploaded image appears to be a color photograph, not a "
            f"medical scan. {scan_type.replace('_', ' ').title()} images must "
            f"be grayscale."
        )

    # Layer 2 — scan-type classifier gate
    classifier = _load_scan_classifier()
    if classifier is not None:
        import tensorflow as tf
        resized = img.resize((224, 224))
        x = np.array(resized, dtype=np.float32) / 255.0
        x = np.expand_dims(x, axis=0)
        probs = classifier.predict(x, verbose=0)[0]
        predicted_type = _SCAN_CLASS_NAMES[int(np.argmax(probs))]
        classifier_confidence = float(np.max(probs))
        if predicted_type != scan_type:
            return False, (
                f"This image looks like a {predicted_type.replace('_', ' ')} "
                f"({classifier_confidence * 100:.0f}% confidence), not a "
                f"{scan_type.replace('_', ' ')}. Please upload the correct scan type."
            )

    return True, None


def preprocess_image(file_bytes, model_type="resnet"):
    """
    Preprocesses image to match EXACTLY how it was preprocessed during training.
    - chest_xray: trained with ResNet50V2 → use resnet preprocess_input
    - bone_xray:  trained with ResNet50V2 → use resnet preprocess_input
    - brain_mri:  trained with DenseNet121 → use densenet preprocess_input
    """
    # Open and resize image
    img = Image.open(io.BytesIO(file_bytes))
    img = img.convert("RGB")
    img = img.resize((224, 224))
    img_array = np.array(img, dtype=np.float32)
    img_array = np.expand_dims(img_array, axis=0)

    if model_type == "resnet":
        # ResNet50V2 preprocessing — MUST match training exactly
        from tensorflow.keras.applications.resnet_v2 import preprocess_input
        img_array = preprocess_input(img_array)

    elif model_type == "densenet":
        # DenseNet121 preprocessing — MUST match training exactly
        from tensorflow.keras.applications.densenet import preprocess_input
        img_array = preprocess_input(img_array)

    else:
        # Fallback — plain normalization
        img_array = img_array / 255.0

    return img_array


def generate_gradcam(model, img_array, class_idx, original_bytes):
    """
    Generates a Grad-CAM heatmap overlaid on the original image.
    Returns a base64-encoded JPEG string, or None if it fails.
    """
    import tensorflow as tf

    # Find the last convolutional layer (has 4D output: batch, h, w, channels)
    last_conv_layer = None
    for layer in reversed(model.layers):
        try:
            if len(layer.output.shape) == 4:
                last_conv_layer = layer
                break
        except Exception:
            continue

    if last_conv_layer is None:
        return None

    try:
        grad_model = tf.keras.models.Model(
            inputs  = model.inputs,
            outputs = [last_conv_layer.output, model.output]
        )

        with tf.GradientTape() as tape:
            inputs = tf.cast(img_array, tf.float32)
            conv_outputs, predictions = grad_model(inputs)
            # Binary model has shape (1,1); multiclass has (1,N)
            if predictions.shape[-1] == 1:
                loss = predictions[:, 0]
            else:
                loss = predictions[:, class_idx]

        grads = tape.gradient(loss, conv_outputs)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

        conv_map  = conv_outputs[0]
        heatmap   = conv_map @ pooled_grads[..., tf.newaxis]
        heatmap   = tf.squeeze(heatmap)
        heatmap   = tf.maximum(heatmap, 0)
        max_val   = tf.reduce_max(heatmap)
        if max_val > 0:
            heatmap = heatmap / max_val
        heatmap = heatmap.numpy()

        # Resize heatmap to 224×224 with PIL (no OpenCV needed)
        hm_img  = Image.fromarray(np.uint8(heatmap * 255), mode='L')
        hm_img  = hm_img.resize((224, 224), Image.LANCZOS)
        hm_arr  = np.array(hm_img, dtype=np.float32) / 255.0

        # Jet colormap approximation (blue→cyan→green→yellow→red)
        r = np.clip(1.5 - np.abs(4.0 * hm_arr - 3.0), 0.0, 1.0)
        g = np.clip(1.5 - np.abs(4.0 * hm_arr - 2.0), 0.0, 1.0)
        b = np.clip(1.5 - np.abs(4.0 * hm_arr - 1.0), 0.0, 1.0)
        hm_rgb = np.stack([r, g, b], axis=-1)
        hm_rgb = (hm_rgb * 255).astype(np.float32)

        # Load original image
        orig_img = Image.open(io.BytesIO(original_bytes)).convert("RGB").resize((224, 224))
        orig_arr = np.array(orig_img, dtype=np.float32)

        # Blend: 55% original + 45% heatmap
        overlay = (0.55 * orig_arr + 0.45 * hm_rgb).clip(0, 255).astype(np.uint8)

        # Encode to base64 JPEG
        buf = io.BytesIO()
        Image.fromarray(overlay).save(buf, format='JPEG', quality=88)
        return base64.b64encode(buf.getvalue()).decode('utf-8')

    except Exception as e:
        logger.warning("Grad-CAM failed: %s", e)
        return None


def get_explanation(scan_type, prediction, confidence):
    explanations = {
        "chest_xray": {
            "Pneumonia": f"Signs of pneumonia detected with {confidence:.1f}% confidence. Bilateral infiltrates may be present. Recommend antibiotic therapy and chest CT confirmation.",
            "Normal": f"No signs of pneumonia detected ({confidence:.1f}% confidence). Lung fields appear clear."
        },
        "bone_xray": {
            "Fracture": f"A fracture was detected with {confidence:.1f}% confidence. Recommend orthopedic consultation and immobilization.",
            "Normal": f"No fracture detected ({confidence:.1f}% confidence). Bone structure appears intact."
        },
        "brain_mri": {
            "Glioma": f"Glioma tumor detected with {confidence:.1f}% confidence. Neurosurgical evaluation recommended.",
            "Meningioma": f"Meningioma detected with {confidence:.1f}% confidence. Dural tail sign may be present.",
            "Pituitary": f"Pituitary tumor detected with {confidence:.1f}% confidence. Endocrinology consultation recommended.",
            "No Tumor": f"No tumor detected ({confidence:.1f}% confidence). Brain tissue appears normal."
        },
        
    }
    return explanations.get(scan_type, {}).get(prediction, "Analysis complete.")