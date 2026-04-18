import numpy as np
from PIL import Image
import io
import base64

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
        print(f"⚠️  Grad-CAM failed: {e}")
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