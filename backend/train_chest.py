import tensorflow as tf
from tensorflow.keras.applications import EfficientNetB3
from tensorflow.keras import layers, Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
import numpy as np

TRAIN_PATH = r"C:\Users\user\Desktop\ISD\Ai\datasets\chest_xray\train"
VAL_PATH   = r"C:\Users\user\Desktop\ISD\Ai\datasets\chest_xray\val"
TEST_PATH  = r"C:\Users\user\Desktop\ISD\Ai\datasets\chest_xray\test"
SAVE_PATH  = r"C:\Users\user\Desktop\ISD\Ai\models\chest_xray_model.h5"
IMG_SIZE   = (224, 224)
BATCH_SIZE = 32

# ── DATA GENERATORS ─────────────-────────────────────────
print("Loading data...")

train_datagen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=15,
    width_shift_range=0.1,
    height_shift_range=0.1,
    horizontal_flip=True,
    zoom_range=0.1
)

val_datagen = ImageDataGenerator(rescale=1./255)

train_gen = train_datagen.flow_from_directory(
    TRAIN_PATH,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='binary'
)

val_gen = val_datagen.flow_from_directory(
    VAL_PATH,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='binary'
)

test_gen = val_datagen.flow_from_directory(
    TEST_PATH,
    target_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
    class_mode='binary',
    shuffle=False
)

print(f"Train samples: {train_gen.samples}")
print(f"Val samples:   {val_gen.samples}")
print(f"Test samples:  {test_gen.samples}")
print(f"Classes: {train_gen.class_indices}")

# ── HANDLE CLASS IMBALANCE ───────────────────────────
normal_count    = len(tf.io.gfile.listdir(f"{TRAIN_PATH}/NORMAL"))
pneumonia_count = len(tf.io.gfile.listdir(f"{TRAIN_PATH}/PNEUMONIA"))
total           = normal_count + pneumonia_count

class_weights = {
    0: total / (2 * normal_count),
    1: total / (2 * pneumonia_count)
}
print(f"Class weights: {class_weights}")

# ── BUILD MODEL ───────────────────────────────────────
print("Building model...")

base = EfficientNetB3(
    weights='imagenet',
    include_top=False,
    input_shape=(224, 224, 3)
)
base.trainable = False

x = base.output
x = layers.GlobalAveragePooling2D()(x)
x = layers.BatchNormalization()(x)
x = layers.Dropout(0.3)(x)
x = layers.Dense(256, activation='relu')(x)
x = layers.Dropout(0.2)(x)
output = layers.Dense(1, activation='sigmoid')(x)

model = Model(inputs=base.input, outputs=output)

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss='binary_crossentropy',
    metrics=['accuracy', tf.keras.metrics.AUC(name='auc')]
)

print(f"Total parameters: {model.count_params():,}")

# ── CALLBACKS ─────────────────────────────────────────
callbacks = [
    EarlyStopping(
        patience=5,
        restore_best_weights=True,
        monitor='val_auc'
    ),
    ReduceLROnPlateau(
        factor=0.5,
        patience=3,
        min_lr=1e-7,
        monitor='val_auc'
    ),
    ModelCheckpoint(
        SAVE_PATH,
        save_best_only=True,
        monitor='val_auc'
    )
]

# ── STAGE 1: Train head only ──────────────────────────
print("\n STAGE 1: Training classification head...")
model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=10,
    callbacks=callbacks,
    class_weight=class_weights
)

# ── STAGE 2: Fine-tune top layers ─────────────────────
print("\n STAGE 2: Fine-tuning top layers...")
base.trainable = True
for layer in base.layers[:-30]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
    loss='binary_crossentropy',
    metrics=['accuracy', tf.keras.metrics.AUC(name='auc')]
)

model.fit(
    train_gen,
    validation_data=val_gen,
    epochs=20,
    callbacks=callbacks,
    class_weight=class_weights
)

# ── EVALUATION ────────────────────────────────────────
print("\n Evaluating on test set...")
from sklearn.metrics import classification_report, roc_auc_score

y_true = test_gen.classes
y_pred_proba = model.predict(test_gen).flatten()
y_pred = (y_pred_proba > 0.5).astype(int)

print(classification_report(y_true, y_pred, target_names=['NORMAL', 'PNEUMONIA']))
print(f"AUC Score: {roc_auc_score(y_true, y_pred_proba):.4f}")

print(f"\n Model saved to {SAVE_PATH}")