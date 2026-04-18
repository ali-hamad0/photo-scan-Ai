from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

import tensorflow as tf
from tensorflow.keras.applications import DenseNet121
from tensorflow.keras.applications.densenet import preprocess_input
from tensorflow.keras import layers, Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.metrics import classification_report
import numpy as np

# ── PATHS ─────────────────────────────────────────────
TRAIN_DIR = "../datasets/brain_mri/Training"
TEST_DIR  = "../datasets/brain_mri/Testing"
SAVE_PATH = "models/brain_mri_model.h5"
IMG_SIZE  = (224, 224)
BATCH     = 16

# ── DATA GENERATORS ───────────────────────────────────
# Use DenseNet's own preprocess_input instead of rescale=1./255
train_gen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    rotation_range=20,
    width_shift_range=0.1,
    height_shift_range=0.1,
    zoom_range=0.15,
    horizontal_flip=True,
    brightness_range=[0.85, 1.15],
    fill_mode='nearest',
    validation_split=0.20
)

test_gen = ImageDataGenerator(
    preprocessing_function=preprocess_input
)

train_data = train_gen.flow_from_directory(
    TRAIN_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='categorical',
    shuffle=True,
    subset='training'
)

val_data = train_gen.flow_from_directory(
    TRAIN_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='categorical',
    shuffle=False,
    subset='validation'
)

test_data = test_gen.flow_from_directory(
    TEST_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='categorical',
    shuffle=False
)

print(f"Classes : {train_data.class_indices}")
print(f"Train   : {train_data.n}")
print(f"Val     : {val_data.n}")
print(f"Test    : {test_data.n}")

# ── BUILD MODEL ────────────────────────────────────────
# DenseNet121 is proven best for medical imaging
def build_model(num_classes=4):
    base = DenseNet121(
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
    output = layers.Dense(num_classes, activation='softmax')(x)

    return Model(inputs=base.input, outputs=output), base

model, base = build_model()

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
    metrics=['accuracy', tf.keras.metrics.AUC(name='auc')]
)

print(f"Total params: {model.count_params():,}")

# ── STAGE 1 ────────────────────────────────────────────
print("\n" + "="*50)
print("STAGE 1: Training head (base frozen)...")
print("="*50)

cb1 = [
    EarlyStopping(patience=6, restore_best_weights=True,
                  monitor='val_accuracy', mode='max', verbose=1),
    ReduceLROnPlateau(factor=0.5, patience=3, min_lr=1e-7,
                      monitor='val_accuracy', verbose=1),
    ModelCheckpoint(SAVE_PATH, save_best_only=True,
                    monitor='val_accuracy', mode='max', verbose=1)
]

history1 = model.fit(
    train_data,
    validation_data=val_data,
    epochs=25,
    callbacks=cb1
)

# ── STAGE 2 ────────────────────────────────────────────
print("\n" + "="*50)
print("STAGE 2: Fine-tuning top 60 layers...")
print("="*50)

base.trainable = True
for layer in base.layers[:-60]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(5e-6),
    loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
    metrics=['accuracy', tf.keras.metrics.AUC(name='auc')]
)

cb2 = [
    EarlyStopping(patience=8, restore_best_weights=True,
                  monitor='val_accuracy', mode='max', verbose=1),
    ReduceLROnPlateau(factor=0.3, patience=4, min_lr=1e-8,
                      monitor='val_accuracy', verbose=1),
    ModelCheckpoint(SAVE_PATH, save_best_only=True,
                    monitor='val_accuracy', mode='max', verbose=1)
]

history2 = model.fit(
    train_data,
    validation_data=val_data,
    epochs=40,
    callbacks=cb2
)

# ── EVALUATE ───────────────────────────────────────────
print("\n" + "="*50)
print("FINAL EVALUATION")
print("="*50)

model = tf.keras.models.load_model(SAVE_PATH)
test_data.reset()

y_pred_proba = model.predict(test_data, verbose=1)
y_pred = np.argmax(y_pred_proba, axis=1)
y_true = test_data.classes
class_names = list(test_data.class_indices.keys())

print("\nClassification Report:")
print(classification_report(y_true, y_pred, target_names=class_names))

print("Per-class accuracy:")
for i, name in enumerate(class_names):
    mask = y_true == i
    acc = (y_pred[mask] == i).mean()
    status = "✅" if acc >= 0.85 else "⚠️ "
    print(f"  {status} {name:15s}: {acc:.2%}")

overall_acc = (y_pred == y_true).mean()
print(f"\nOverall Accuracy: {overall_acc:.4f}")

if overall_acc >= 0.90:
    print("✅ Target achieved! Model is ready.")
else:
    print(f"⚠️  Accuracy {overall_acc:.2%} — below 90% target")

print(f"\n✅ Model saved: {SAVE_PATH}")