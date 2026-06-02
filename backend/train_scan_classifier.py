"""
Trains a lightweight scan-type classifier (chest / bone / brain).
Run from the backend/ directory:
    python train_scan_classifier.py
Output: models/scan_classifier.h5
"""
from PIL import ImageFile, Image
ImageFile.LOAD_TRUNCATED_IMAGES = True

import glob
import os
import random
import numpy as np
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras import layers, Model
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint

# ── Dataset roots (relative to backend/) ──────────────────────────────────────
SCAN_DIRS = {
    0: "../datasets/chest_xray/train",
    1: "../datasets/Bone_Fracture_Binary_Classification/Bone_Fracture_Binary_Classification/train",
    2: "../datasets/brain_mri/Training",
}
CLASS_NAMES = ["chest_xray", "bone_xray", "brain_mri"]

SAVE_PATH  = "models/scan_classifier.h5"
IMG_SIZE   = (224, 224)
MAX_SAMPLES_PER_CLASS = 800   # keep training fast; increase for better accuracy
BATCH_SIZE = 32
EPOCHS     = 20
SEED       = 42

random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)


def collect_image_paths(root, label, max_n):
    paths = []
    for ext in ("*.jpg", "*.jpeg", "*.png"):
        paths.extend(glob.glob(os.path.join(root, "**", ext), recursive=True))
    random.shuffle(paths)
    return [(p, label) for p in paths[:max_n]]


def load_dataset(samples):
    X, y = [], []
    for path, label in samples:
        try:
            img = Image.open(path).convert("RGB").resize(IMG_SIZE)
            arr = np.array(img, dtype=np.float32) / 255.0
            X.append(arr)
            y.append(label)
        except Exception:
            continue
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int32)


# ── Collect paths ──────────────────────────────────────────────────────────────
print("Collecting image paths...")
all_samples = []
for label, root in SCAN_DIRS.items():
    samples = collect_image_paths(root, label, MAX_SAMPLES_PER_CLASS)
    print(f"  {CLASS_NAMES[label]}: {len(samples)} images from {root}")
    all_samples.extend(samples)

random.shuffle(all_samples)

# Train / val split (80/20)
split = int(len(all_samples) * 0.8)
train_samples = all_samples[:split]
val_samples   = all_samples[split:]

print(f"\nLoading {len(train_samples)} train + {len(val_samples)} val images...")
X_train, y_train = load_dataset(train_samples)
X_val,   y_val   = load_dataset(val_samples)
print(f"X_train: {X_train.shape}  X_val: {X_val.shape}")

# ── Model ──────────────────────────────────────────────────────────────────────
base = MobileNetV2(input_shape=(224, 224, 3), include_top=False, weights="imagenet")
base.trainable = False

x = base.output
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dense(128, activation="relu")(x)
x = layers.Dropout(0.3)(x)
out = layers.Dense(len(CLASS_NAMES), activation="softmax")(x)

model = Model(inputs=base.input, outputs=out)
model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

callbacks = [
    EarlyStopping(patience=4, restore_best_weights=True, verbose=1),
    ModelCheckpoint(SAVE_PATH, save_best_only=True, verbose=1),
]

print("\nTraining scan-type classifier...")
model.fit(
    X_train, y_train,
    validation_data=(X_val, y_val),
    batch_size=BATCH_SIZE,
    epochs=EPOCHS,
    callbacks=callbacks,
)

# ── Evaluate ───────────────────────────────────────────────────────────────────
loss, acc = model.evaluate(X_val, y_val, verbose=0)
print(f"\nVal accuracy: {acc * 100:.1f}%  loss: {loss:.4f}")
print(f"Model saved to {SAVE_PATH}")
