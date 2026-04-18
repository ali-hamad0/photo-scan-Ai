from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

import tensorflow as tf
from tensorflow.keras.applications import DenseNet121
from tensorflow.keras.applications.densenet import preprocess_input
from tensorflow.keras import layers, Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.metrics import classification_report, mean_absolute_error
import numpy as np

# ── PATHS ─────────────────────────────────────────────
TRAIN_DIR = "../datasets/knee_xray/train"
TEST_DIR  = "../datasets/knee_xray/test"
SAVE_PATH = "models/knee_xray_model.h5"
IMG_SIZE  = (299, 299)   # Larger = more detail
BATCH     = 16
NUM_CLASS = 5

# ── ORDINAL ENCODING ──────────────────────────────────
# Instead of one-hot [0,0,1,0,0] for grade 2
# We use ordinal [1,1,0,0,0] meaning "at least grade 0, at least grade 1"
# This teaches the model that grades are ordered
def to_ordinal(grade, num_classes=5):
    return [1.0 if i < grade else 0.0 for i in range(num_classes - 1)]

# ── DATA GENERATORS ───────────────────────────────────
train_gen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    rotation_range=10,
    width_shift_range=0.1,
    height_shift_range=0.1,
    zoom_range=0.1,
    horizontal_flip=True,
    brightness_range=[0.85, 1.15],
    fill_mode='nearest',
    validation_split=0.20
)

test_gen = ImageDataGenerator(
    preprocessing_function=preprocess_input
)

# Load as categorical first to get labels
train_data = train_gen.flow_from_directory(
    TRAIN_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='sparse',
    shuffle=True,
    subset='training'
)

val_data = train_gen.flow_from_directory(
    TRAIN_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='sparse',
    shuffle=False,
    subset='validation'
)

test_data = test_gen.flow_from_directory(
    TEST_DIR,
    target_size=IMG_SIZE,
    batch_size=BATCH,
    class_mode='sparse',
    shuffle=False
)

print(f"Classes : {train_data.class_indices}")
print(f"Train   : {train_data.n}")
print(f"Val     : {val_data.n}")
print(f"Test    : {test_data.n}")

# ── ORDINAL DATA WRAPPER ───────────────────────────────
# Convert sparse labels to ordinal encoding on the fly
def ordinal_generator(generator):
    for x, y in generator:
        y_ordinal = np.array([to_ordinal(int(label)) for label in y])
        yield x, y_ordinal

train_ord = ordinal_generator(train_data)
val_ord   = ordinal_generator(val_data)

# ── BUILD MODEL ────────────────────────────────────────
def build_model():
    base = DenseNet121(
        weights='imagenet',
        include_top=False,
        input_shape=(299, 299, 3)
    )
    base.trainable = False

    x = base.output
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(512, activation='relu')(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.Dropout(0.3)(x)
    # NUM_CLASS - 1 outputs for ordinal regression
    output = layers.Dense(NUM_CLASS - 1, activation='sigmoid')(x)

    return Model(inputs=base.input, outputs=output), base

model, base = build_model()

model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss='binary_crossentropy',  # Works perfectly for ordinal
    metrics=['accuracy']
)

print(f"Total params: {model.count_params():,}")

# ── STAGE 1 ────────────────────────────────────────────
print("\n" + "="*50)
print("STAGE 1: Training head (base frozen)...")
print("="*50)

steps_per_epoch     = train_data.n // BATCH
validation_steps    = val_data.n   // BATCH

cb1 = [
    EarlyStopping(patience=6, restore_best_weights=True,
                  monitor='val_loss', mode='min', verbose=1),
    ReduceLROnPlateau(factor=0.5, patience=3, min_lr=1e-7,
                      monitor='val_loss', verbose=1),
    ModelCheckpoint(SAVE_PATH, save_best_only=True,
                    monitor='val_loss', mode='min', verbose=1)
]

model.fit(
    train_ord,
    steps_per_epoch=steps_per_epoch,
    validation_data=val_ord,
    validation_steps=validation_steps,
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
    loss='binary_crossentropy',
    metrics=['accuracy']
)

# Reset generators
train_data.reset()
val_data.reset()
train_ord = ordinal_generator(train_data)
val_ord   = ordinal_generator(val_data)

cb2 = [
    EarlyStopping(patience=8, restore_best_weights=True,
                  monitor='val_loss', mode='min', verbose=1),
    ReduceLROnPlateau(factor=0.3, patience=4, min_lr=1e-8,
                      monitor='val_loss', verbose=1),
    ModelCheckpoint(SAVE_PATH, save_best_only=True,
                    monitor='val_loss', mode='min', verbose=1)
]

model.fit(
    train_ord,
    steps_per_epoch=steps_per_epoch,
    validation_data=val_ord,
    validation_steps=validation_steps,
    epochs=40,
    callbacks=cb2
)

# ── EVALUATE ───────────────────────────────────────────
print("\n" + "="*50)
print("FINAL EVALUATION")
print("="*50)

model = tf.keras.models.load_model(SAVE_PATH)
test_data.reset()

# Get ordinal predictions and convert back to grade
y_pred_ordinal = model.predict(test_data, verbose=1)
# Convert ordinal back to grade: count how many outputs > 0.5
y_pred = (y_pred_ordinal > 0.5).sum(axis=1)
y_true = test_data.classes
class_names = [str(i) for i in range(NUM_CLASS)]

print("\nClassification Report:")
print(classification_report(y_true, y_pred, target_names=class_names))

print("Per-class accuracy:")
for i in range(NUM_CLASS):
    mask = y_true == i
    if mask.sum() == 0:
        continue
    acc = (y_pred[mask] == i).mean()
    status = "✅" if acc >= 0.65 else "⚠️ "
    print(f"  {status} Grade {i}: {acc:.2%}")

# Mean Absolute Error — how many grades off on average
mae = mean_absolute_error(y_true, y_pred)
overall_acc = (y_pred == y_true).mean()

print(f"\nOverall Accuracy : {overall_acc:.4f}")
print(f"Mean Absolute Error: {mae:.4f} grades")
print("(MAE < 0.8 means on average less than 1 grade off — clinically acceptable)")

if overall_acc >= 0.65:
    print("✅ Target achieved! Model is ready.")
elif mae < 0.8:
    print("✅ MAE is acceptable — clinically usable even if accuracy is lower.")
else:
    print(f"⚠️  Need improvement")

print(f"\n✅ Model saved: {SAVE_PATH}")