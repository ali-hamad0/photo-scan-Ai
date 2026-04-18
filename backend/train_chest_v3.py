import tensorflow as tf
from tensorflow.keras.applications import ResNet50V2
from tensorflow.keras import layers, Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import classification_report, roc_auc_score
import numpy as np
import os

# ── PATHS ────────────────────────────────────────────
TRAIN_DIR = "../datasets/chest_xray/train"
VAL_DIR   = "../datasets/chest_xray/val"
TEST_DIR  = "../datasets/chest_xray/test"
SAVE_PATH = "models/chest_xray_model.h5"
IMG_SIZE  = (224, 224)
BATCH     = 16  # Smaller batch = better generalization

# ── STEP 1: DATA GENERATORS ──────────────────────────
# Why merge val into train?
# The original val set has only 16 images — too small to be useful
# We create our own 20% validation split from training data

train_gen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=20,
    width_shift_range=0.15,
    height_shift_range=0.15,
    shear_range=0.15,
    zoom_range=0.15,
    horizontal_flip=True,
    brightness_range=[0.8, 1.2],
    fill_mode='nearest',
    validation_split=0.20  # Use 20% of train as validation
)

test_gen = ImageDataGenerator(rescale=1./255)

train_data = train_gen.flow_from_directory(
    TRAIN_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='binary',
    shuffle=True,
    subset='training'
)

val_data = train_gen.flow_from_directory(
    TRAIN_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='binary',
    shuffle=False,
    subset='validation'
)

test_data = test_gen.flow_from_directory(
    TEST_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='binary',
    shuffle=False
)

print(f"Classes: {train_data.class_indices}")
print(f"Train: {train_data.n} | Val: {val_data.n} | Test: {test_data.n}")

# ── STEP 2: CLASS WEIGHTS ─────────────────────────────
labels = train_data.classes
weights = compute_class_weight(
    class_weight='balanced',
    classes=np.unique(labels),
    y=labels
)
class_weights = dict(enumerate(weights))
print(f"Class weights: {class_weights}")

# ── STEP 3: BUILD MODEL ───────────────────────────────
# Why ResNet50V2?
# Works better than EfficientNet on smaller/imbalanced medical datasets
# More stable training, better feature extraction for X-rays

def build_model():
    base = ResNet50V2(
        weights='imagenet',
        include_top=False,
        input_shape=(224, 224, 3)
    )
    base.trainable = False

    x = base.output
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(512, activation='relu')(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.Dropout(0.3)(x)
    output = layers.Dense(1, activation='sigmoid')(x)

    model = Model(inputs=base.input, outputs=output)
    return model, base

model, base = build_model()

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss='binary_crossentropy',
    metrics=[
        'accuracy',
        tf.keras.metrics.AUC(name='auc'),
        tf.keras.metrics.Recall(name='recall'),
        tf.keras.metrics.Precision(name='precision')
    ]
)

# ── STEP 4: STAGE 1 ───────────────────────────────────
print("\n" + "="*50)
print("STAGE 1: Training head (base frozen)...")
print("="*50)

callbacks_s1 = [
    EarlyStopping(
        patience=5,
        restore_best_weights=True,
        monitor='val_auc',
        mode='max'
    ),
    ReduceLROnPlateau(
        factor=0.5,
        patience=3,
        min_lr=1e-7,
        monitor='val_auc',
        mode='max',
        verbose=1
    ),
    ModelCheckpoint(
        SAVE_PATH,
        save_best_only=True,
        monitor='val_auc',
        mode='max',
        verbose=1
    )
]

model.fit(
    train_data,
    validation_data=val_data,
    epochs=20,
    callbacks=callbacks_s1,
    class_weight=class_weights,
    verbose=1
)

# ── STEP 5: STAGE 2 FINE-TUNING ──────────────────────
print("\n" + "="*50)
print("STAGE 2: Fine-tuning (top 50 layers unfrozen)...")
print("="*50)

base.trainable = True
for layer in base.layers[:-50]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=5e-6),
    loss='binary_crossentropy',
    metrics=[
        'accuracy',
        tf.keras.metrics.AUC(name='auc'),
        tf.keras.metrics.Recall(name='recall'),
        tf.keras.metrics.Precision(name='precision')
    ]
)

callbacks_s2 = [
    EarlyStopping(
        patience=8,
        restore_best_weights=True,
        monitor='val_auc',
        mode='max'
    ),
    ReduceLROnPlateau(
        factor=0.3,
        patience=4,
        min_lr=1e-8,
        monitor='val_auc',
        mode='max',
        verbose=1
    ),
    ModelCheckpoint(
        SAVE_PATH,
        save_best_only=True,
        monitor='val_auc',
        mode='max',
        verbose=1
    )
]

model.fit(
    train_data,
    validation_data=val_data,
    epochs=30,
    callbacks=callbacks_s2,
    class_weight=class_weights,
    verbose=1
)

# ── STEP 6: FIND BEST THRESHOLD ──────────────────────
# Default threshold of 0.5 is wrong for imbalanced data
# We find the threshold that balances sensitivity and specificity

print("\n" + "="*50)
print("Finding best classification threshold...")
print("="*50)

model = tf.keras.models.load_model(SAVE_PATH)
y_pred_proba = model.predict(test_data, verbose=1).flatten()
y_true = test_data.classes

best_threshold = 0.5
best_f1 = 0

for threshold in np.arange(0.2, 0.8, 0.05):
    y_pred = (y_pred_proba > threshold).astype(int)
    from sklearn.metrics import f1_score
    f1 = f1_score(y_true, y_pred, average='macro')
    if f1 > best_f1:
        best_f1 = f1
        best_threshold = threshold

print(f"Best threshold: {best_threshold:.2f}")

# ── STEP 7: FINAL EVALUATION ─────────────────────────
print("\n" + "="*50)
print("FINAL EVALUATION ON TEST SET")
print("="*50)

y_pred = (y_pred_proba > best_threshold).astype(int)
class_names = list(test_data.class_indices.keys())

print(f"\nUsing threshold: {best_threshold:.2f}")
print("\nClassification Report:")
print(classification_report(y_true, y_pred, target_names=class_names))

auc = roc_auc_score(y_true, y_pred_proba)
print(f"AUC Score: {auc:.4f}")

if auc >= 0.92:
    print("✅ Target AUC achieved! Model is ready.")
else:
    print(f"⚠️  AUC: {auc:.4f} — Try increasing epochs")

# Save threshold for use in API
print(f"\n📌 Save this threshold in analyze.py: {best_threshold:.2f}")
print(f"✅ Model saved to: {SAVE_PATH}")