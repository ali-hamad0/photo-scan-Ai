import tensorflow as tf
from tensorflow.keras.applications import EfficientNetB3
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
BATCH     = 32

# ── STEP 1: DATA GENERATORS ──────────────────────────
# Heavy augmentation on training data only
train_gen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=15,
    width_shift_range=0.1,
    height_shift_range=0.1,
    shear_range=0.1,
    zoom_range=0.1,
    horizontal_flip=True,
    fill_mode='nearest'
)

# NO augmentation on val/test — only rescale
val_gen = ImageDataGenerator(rescale=1./255)

train_data = train_gen.flow_from_directory(
    TRAIN_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='binary',
    shuffle=True
)

val_data = val_gen.flow_from_directory(
    VAL_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='binary',
    shuffle=False
)

test_data = val_gen.flow_from_directory(
    TEST_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='binary',
    shuffle=False
)

print(f"Classes: {train_data.class_indices}")
print(f"Train: {train_data.n} | Val: {val_data.n} | Test: {test_data.n}")

# ── STEP 2: CLASS WEIGHTS ─────────────────────────────
# This fixes class imbalance
# PNEUMONIA cases are more important to catch
labels = train_data.classes
weights = compute_class_weight(
    class_weight='balanced',
    classes=np.unique(labels),
    y=labels
)
class_weights = dict(enumerate(weights))
print(f"Class weights: {class_weights}")

# ── STEP 3: BUILD MODEL ───────────────────────────────
def build_model():
    base = EfficientNetB3(
        weights='imagenet',
        include_top=False,
        input_shape=(224, 224, 3)
    )
    base.trainable = False  # Freeze base first

    x = base.output
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.4)(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.BatchNormalization()(x)
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

print(f"Total params: {model.count_params():,}")

# ── STEP 4: STAGE 1 TRAINING ─────────────────────────
# Train only the new head — base is frozen
print("\n" + "="*50)
print("STAGE 1: Training classification head...")
print("="*50)

callbacks_s1 = [
    EarlyStopping(patience=5, restore_best_weights=True, monitor='val_auc', mode='max'),
    ReduceLROnPlateau(factor=0.5, patience=3, min_lr=1e-7, monitor='val_auc', mode='max'),
    ModelCheckpoint(SAVE_PATH, save_best_only=True, monitor='val_auc', mode='max')
]

history1 = model.fit(
    train_data,
    validation_data=val_data,
    epochs=15,
    callbacks=callbacks_s1,
    class_weight=class_weights
)

# ── STEP 5: STAGE 2 FINE-TUNING ──────────────────────
# Unfreeze top 30 layers and fine-tune at very low LR
print("\n" + "="*50)
print("STAGE 2: Fine-tuning top layers...")
print("="*50)

base.trainable = True
for layer in base.layers[:-30]:
    layer.trainable = False

# Recompile with much lower learning rate
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
    loss='binary_crossentropy',
    metrics=[
        'accuracy',
        tf.keras.metrics.AUC(name='auc'),
        tf.keras.metrics.Recall(name='recall'),
        tf.keras.metrics.Precision(name='precision')
    ]
)

callbacks_s2 = [
    EarlyStopping(patience=7, restore_best_weights=True, monitor='val_auc', mode='max'),
    ReduceLROnPlateau(factor=0.3, patience=3, min_lr=1e-8, monitor='val_auc', mode='max'),
    ModelCheckpoint(SAVE_PATH, save_best_only=True, monitor='val_auc', mode='max')
]

history2 = model.fit(
    train_data,
    validation_data=val_data,
    epochs=25,
    callbacks=callbacks_s2,
    class_weight=class_weights
)

# ── STEP 6: EVALUATE ON TEST SET ─────────────────────
print("\n" + "="*50)
print("FINAL EVALUATION ON TEST SET")
print("="*50)

# Load best saved model
model = tf.keras.models.load_model(SAVE_PATH)

# Get predictions
y_true = test_data.classes
y_pred_proba = model.predict(test_data, verbose=1)
y_pred = (y_pred_proba > 0.5).astype(int).flatten()

# Class names
class_names = list(test_data.class_indices.keys())

print("\nClassification Report:")
print(classification_report(y_true, y_pred, target_names=class_names))

auc = roc_auc_score(y_true, y_pred_proba)
print(f"AUC Score: {auc:.4f}")

if auc >= 0.92:
    print("✅ Target AUC achieved! Model is ready.")
else:
    print(f"⚠️  AUC is {auc:.4f} — below 0.92 target")
    print("    Try running again or increase epochs")

print(f"\n✅ Model saved to: {SAVE_PATH}") 