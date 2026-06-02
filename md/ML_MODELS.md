# PathoScan AI — ML Models & Inference Guide

Complete documentation on machine learning models, training, and inference pipeline.

## Model Overview

PathoScan AI uses three deep learning models for medical image classification:

| Scan Type | Architecture | Task | Classes | Input Size |
|-----------|-------------|------|---------|-----------|
| **Chest X-Ray** | ResNet50V2 | Binary Classification | Normal, Pneumonia | 224×224 |
| **Bone X-Ray** | ResNet50V2 | Binary Classification | Not Fractured, Fractured | 224×224 |
| **Brain MRI** | DenseNet121 | Multi-class (4-way) | Glioma, Meningioma, No Tumor, Pituitary | 224×224 |

---

## Model Architecture Details

### Chest X-Ray (ResNet50V2)

```python
# Architecture
Input (224, 224, 3)
  ↓
ResNet50V2 (pre-trained on ImageNet)
  ├── Convolutional layers with skip connections
  ├── Batch normalization
  └── Global average pooling
  ↓
Dense(256, activation='relu')
  ↓
Dropout(0.5)
  ↓
Dense(1, activation='sigmoid')  # Binary output
  ↓
Output: [0, 1] → Probability of Pneumonia
```

**Classes:**
- 0: Normal (confidence if output < 0.5)
- 1: Pneumonia (confidence if output ≥ 0.5)

**Confidence calculation:**
```python
raw_output = model.predict(image)[0][0]  # Float in [0, 1]
confidence = max(raw_output, 1 - raw_output) * 100
prediction = "Pneumonia" if raw_output >= 0.5 else "Normal"
```

---

### Bone X-Ray (ResNet50V2)

```python
# Same architecture as Chest X-Ray
Input (224, 224, 3)
  ↓
ResNet50V2 (pre-trained on ImageNet)
  ↓
Dense(256, activation='relu')
  ↓
Dropout(0.5)
  ↓
Dense(1, activation='sigmoid')
  ↓
Output: [0, 1] → Probability of Fracture
```

**Classes:**
- 0: Not Fractured
- 1: Fractured

---

### Brain MRI (DenseNet121)

```python
# 4-class classification
Input (224, 224, 3)
  ↓
DenseNet121 (pre-trained on ImageNet)
  ├── Dense blocks with concatenation
  ├── Batch normalization
  └── Global average pooling
  ↓
Dense(256, activation='relu')
  ↓
Dropout(0.5)
  ↓
Dense(4, activation='softmax')  # 4-class output
  ↓
Output: [p0, p1, p2, p3] → Probabilities for each class
```

**Classes:**
- 0: Glioma
- 1: Meningioma
- 2: No Tumor
- 3: Pituitary

**Confidence calculation:**
```python
output = model.predict(image)[0]  # [p0, p1, p2, p3]
class_idx = np.argmax(output)
confidence = output[class_idx] * 100
prediction = ["Glioma", "Meningioma", "No Tumor", "Pituitary"][class_idx]
```

---

## Image Preprocessing Pipeline

### Step 1: Load Image

```python
from PIL import Image
from io import BytesIO

image_bytes = file.file.read()
img = Image.open(BytesIO(image_bytes))
```

### Step 2: Convert to RGB

```python
# Ensure RGB, handle grayscale or RGBA
if img.mode != 'RGB':
    img = img.convert('RGB')
```

### Step 3: Resize to 224×224

```python
img_resized = img.resize((224, 224), Image.LANCZOS)
```

### Step 4: Convert to NumPy Array

```python
import numpy as np

img_array = np.array(img_resized)  # Shape: (224, 224, 3)
img_array = np.expand_dims(img_array, axis=0)  # Shape: (1, 224, 224, 3)
```

### Step 5: Apply Model-Specific Normalization

**ResNetV2 Preprocessing:**
```python
from tensorflow.keras.applications import resnet_v2

# Scale to [-1, 1]
img_normalized = resnet_v2.preprocess_input(img_array)
```

**DenseNet Preprocessing:**
```python
from tensorflow.keras.applications import densenet

# Scale to [0, 1] with mean subtraction
img_normalized = densenet.preprocess_input(img_array)
```

### Complete Preprocessing Function

See [backend/services/analyzer.py](backend/services/analyzer.py):
```python
def preprocess_image(image_bytes, model_type):
    """
    Preprocess image for model inference.
    
    Args:
        image_bytes: Raw image file bytes
        model_type: 'resnet' or 'densenet'
    
    Returns:
        Preprocessed image array (1, 224, 224, 3)
    """
    img = Image.open(BytesIO(image_bytes)).convert('RGB')
    img = img.resize((224, 224), Image.LANCZOS)
    img_array = np.array(img)
    img_array = np.expand_dims(img_array, axis=0)
    
    if model_type == 'resnet':
        img_array = resnet_v2.preprocess_input(img_array)
    else:  # densenet
        img_array = densenet.preprocess_input(img_array)
    
    return img_array
```

---

## Inference Pipeline

### 1. Load Model

```python
from tensorflow.keras.models import load_model

model = load_model('models/chest_xray_model.h5')
```

### 2. Run Prediction

```python
preprocessed = preprocess_image(image_bytes, 'resnet')
prediction_output = model.predict(preprocessed)  # [0, 1] or [p0, p1, p2, p3]
```

### 3. Extract Class & Confidence

```python
if binary_model:
    # Sigmoid output for binary classification
    confidence = max(prediction_output[0][0], 1 - prediction_output[0][0]) * 100
    class_idx = 0 if prediction_output[0][0] < 0.5 else 1
else:
    # Softmax output for multi-class
    class_idx = np.argmax(prediction_output[0])
    confidence = prediction_output[0][class_idx] * 100

prediction_label = class_names[class_idx]
```

### 4. Generate Explanation

```python
def get_explanation(scan_type, prediction, confidence):
    """Get clinical explanation for prediction."""
    explanations = {
        "chest_xray": {
            "Normal": "No abnormal findings detected in the chest X-ray.",
            "Pneumonia": "Signs of pneumonia detected, suggesting infection in the lungs."
        },
        # ... more explanations ...
    }
    return explanations[scan_type].get(prediction, "Analysis complete.")
```

### Complete Inference Code

See [backend/analyze.py](backend/analyze.py):
```python
@router.post("/analyze")
async def analyze_scan(
    file: UploadFile,
    scan_type: str,
    current_user: dict = Depends(get_current_user)
):
    # 1. Read and validate image
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="File is empty")
    
    # 2. Get model configuration
    if scan_type not in SCAN_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid scan type")
    
    config = SCAN_CONFIG[scan_type]
    model_type = MODEL_PREPROCESS[scan_type]
    
    # 3. Preprocess image
    img_array = preprocess_image(image_bytes, model_type)
    
    # 4. Run inference
    model = models.get(scan_type)
    prediction_output = model.predict(img_array)
    
    # 5. Extract results
    if config['binary']:
        raw_score = prediction_output[0][0]
        confidence = max(raw_score, 1 - raw_score) * 100
        class_idx = 0 if raw_score < config['threshold'] else 1
    else:
        class_idx = np.argmax(prediction_output[0])
        confidence = prediction_output[0][class_idx] * 100
    
    prediction = config['classes'][class_idx]
    
    # 6. Generate explanation and heatmap
    explanation = get_explanation(scan_type, prediction, confidence)
    heatmap = generate_gradcam(model, img_array, class_idx, image_bytes)
    
    # 7. Save to database
    scan = Scan(user_id=current_user['user_id'], ...)
    result = ScanResult(prediction=prediction, confidence=confidence, ...)
    
    # 8. Return response
    return {
        "prediction": prediction,
        "confidence": confidence,
        "explanation": explanation,
        "heatmap": heatmap
    }
```

---

## Grad-CAM Heatmap Generation

### Overview

Grad-CAM (Gradient-weighted Class Activation Mapping) visualizes which image regions influenced the model's prediction.

### Algorithm

```
1. Forward pass: Get predictions and feature maps from last conv layer
2. Compute gradients of target class score w.r.t. feature maps
3. Weight feature maps by gradients (important features get higher weight)
4. Average across spatial dimensions to get heatmap
5. Apply ReLU (keep only positive activations)
6. Normalize to [0, 1]
7. Resize to original image dimensions
8. Apply colormap (jet colors)
9. Blend with original image (55% original + 45% heatmap)
10. Encode as base64 JPEG
```

### Code

See [backend/services/analyzer.py](backend/services/analyzer.py):

```python
def generate_gradcam(model, img_array, class_idx, original_bytes):
    """
    Generate Grad-CAM heatmap for model prediction.
    
    Args:
        model: TensorFlow model
        img_array: Preprocessed image (1, 224, 224, 3)
        class_idx: Target class index
        original_bytes: Original image bytes
    
    Returns:
        Base64-encoded JPEG string
    """
    # 1. Get feature maps and predictions
    last_conv_layer = model.layers[-3]  # Last convolutional layer
    grad_model = tf.keras.models.Model(
        inputs=model.input,
        outputs=[last_conv_layer.output, model.output]
    )
    
    # 2. Compute gradients
    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(img_array)
        loss = predictions[:, class_idx]
    
    output_channel = conv_outputs.shape[3]
    grads = tape.gradient(loss, conv_outputs)[0]
    
    # 3. Weight by importance
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1))
    conv_outputs = conv_outputs[0]
    heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    
    # 4. Normalize to [0, 1]
    heatmap = tf.maximum(heatmap, 0) / (tf.reduce_max(heatmap) + 1e-7)
    
    # 5. Resize to image dimensions
    heatmap = tf.image.resize(
        tf.expand_dims(heatmap, -1),
        [224, 224]
    )[..., 0].numpy()
    
    # 6. Apply colormap (jet approximation with NumPy)
    heatmap_colored = apply_jet_colormap(heatmap)
    
    # 7. Blend with original image
    original_img = Image.open(BytesIO(original_bytes)).convert('RGB')
    original_img = original_img.resize((224, 224), Image.LANCZOS)
    original_array = np.array(original_img, dtype=np.float32) / 255.0
    
    blended = (0.55 * original_array + 0.45 * heatmap_colored).astype(np.uint8)
    
    # 8. Encode as base64 JPEG
    buffered = BytesIO()
    Image.fromarray(blended).save(buffered, format="JPEG", quality=88)
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return img_str
```

---

## Model Performance Metrics

### Training Considerations

- **Data**: Medical images with class imbalance
- **Augmentation**: Rotation, flip, brightness, contrast
- **Optimizer**: Adam with learning rate decay
- **Loss**: Binary crossentropy (binary) or categorical crossentropy (multi-class)
- **Metrics**: Accuracy, Precision, Recall, F1-Score, AUC-ROC

### Inference Performance

**Expected latency (per image):**
- Preprocessing: ~50 ms
- Model inference: ~200-500 ms (CPU), ~50-100 ms (GPU)
- Grad-CAM generation: ~100-200 ms
- **Total: ~400-800 ms** (CPU), **~200-350 ms** (GPU)

**Confidence threshold recommendations:**
- Chest X-Ray: 0.5 (binary classifier)
- Bone X-Ray: 0.5 (binary classifier)
- Brain MRI: 0.7+ (multi-class, require higher confidence for clinical use)

---

## Model File Management

### Model Files

Located in `backend/models/`:
```
chest_xray_model.h5    (50-150 MB)
bone_xray_model.h5     (50-150 MB)
brain_mri_model.h5     (50-150 MB)
```

### Loading Models

```python
from tensorflow.keras.models import load_model

models = {}
for scan_type in ['chest_xray', 'bone_xray', 'brain_mri']:
    path = f'models/{scan_type}_model.h5'
    try:
        models[scan_type] = load_model(path)
        print(f"✓ Loaded {scan_type} model")
    except Exception as e:
        print(f"✗ Failed to load {scan_type}: {e}")
```

### Model Caching

To avoid reloading models on every request:

```python
_model_cache = {}

def get_model(model_name):
    if model_name not in _model_cache:
        _model_cache[model_name] = load_model(f'models/{model_name}_model.h5')
    return _model_cache[model_name]
```

---

## Troubleshooting

### Model not loading

**Error:** `ValueError: No model found at path`

```bash
# Check if model file exists
ls -la backend/models/

# Check file size (should be >50 MB)
du -h backend/models/*.h5
```

### Out of memory during inference

```python
# Reduce batch size
batch_size = 1

# Clear TensorFlow cache
import tensorflow as tf
tf.keras.backend.clear_session()

# Load model with lower precision
model = load_model(path, custom_objects={'precision': tf.float16})
```

### Slow inference

```python
# Check if GPU is available
import tensorflow as tf
print(tf.config.list_physical_devices('GPU'))

# Use eager execution for debugging
tf.config.run_functions_eagerly(True)
```

---

## Future Improvements

1. **Model Versioning**: Track model versions and allow side-by-side predictions
2. **Ensemble Methods**: Combine multiple models for better accuracy
3. **Quantization**: Reduce model size for faster inference (50-70% reduction)
4. **ONNX Export**: Make models framework-independent
5. **A/B Testing**: Test new models in production with controlled rollout
6. **Active Learning**: Collect hard examples to retrain and improve
7. **DICOM Support**: Handle medical standard image formats

---

## References

- **TensorFlow Keras**: https://www.tensorflow.org/api_docs/python/tf/keras
- **Grad-CAM Paper**: https://arxiv.org/abs/1610.02055
- **ResNet Paper**: https://arxiv.org/abs/1512.03385
- **DenseNet Paper**: https://arxiv.org/abs/1608.06993
- **ImageNet Normalization**: https://github.com/keras-team/keras-applications

See also:
- **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** — Architecture
- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Code structure
