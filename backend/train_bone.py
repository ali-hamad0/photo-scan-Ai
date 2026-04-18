# Fix truncated images
from PIL import ImageFile
ImageFile.LOAD_TRUNCATED_IMAGES = True

import tensorflow as tf
from tensorflow.keras.applications import ResNet50V2
from tensorflow.keras import layers, Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import classification_report, roc_auc_score
import numpy as np

TRAIN_DIR = "../datasets/Bone_Fracture_Binary_Classification/Bone_Fracture_Binary_Classification/train"
VAL_DIR   = "../datasets/Bone_Fracture_Binary_Classification/Bone_Fracture_Binary_Classification/val"
TEST_DIR  = "../datasets/Bone_Fracture_Binary_Classification/Bone_Fracture_Binary_Classification/test"
SAVE_PATH = "models/bone_xray_model.h5"
IMG_SIZE  = (224, 224)
BATCH     = 16

train_gen = ImageDataGenerator(
    rescale=1./255,
    rotation_range=20,
    width_shift_range=0.15,
    height_shift_range=0.15,
    zoom_range=0.15,
    horizontal_flip=True,
    brightness_range=[0.8, 1.2],
    fill_mode='nearest'
)
val_gen = ImageDataGenerator(rescale=1./255)

train_data = train_gen.flow_from_directory(
    TRAIN_DIR, target_size=IMG_SIZE,
    batch_size=BATCH, class_mode='binary', shuffle=True
)
val_data = val_gen.flow_from_directory(
    VAL_DIR, target_size=IMG_SIZE,
    batch_size=BATCH, class_mode='binary', shuffle=False
)
test_data = val_gen.flow_from_directory(
    TEST_DIR, target_size=IMG_SIZE,
    batch_size=BATCH, class_mode='binary', shuffle=False
)

print(f"Classes: {train_data.class_indices}")
print(f"Train: {train_data.n} | Val: {val_data.n} | Test: {test_data.n}")

labels = train_data.classes
weights = compute_class_weight('balanced', classes=np.unique(labels), y=labels)
class_weights = dict(enumerate(weights))
print(f"Class weights: {class_weights}")

def build_model():
    base = ResNet50V2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
    base.trainable = False
    x = base.output
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dense(512, activation='relu')(x)
    x = layers.Dropout(0.5)(x)
    x = layers.Dense(256, activation='relu')(x)
    x = layers.Dropout(0.3)(x)
    output = layers.Dense(1, activation='sigmoid')(x)
    return Model(inputs=base.input, outputs=output), base

model, base = build_model()
model.compile(
    optimizer=tf.keras.optimizers.Adam(1e-3),
    loss='binary_crossentropy',
    metrics=['accuracy', tf.keras.metrics.AUC(name='auc'),
             tf.keras.metrics.Recall(name='recall')]
)

# Stage 1
print("\nSTAGE 1: Training head...")
cb1 = [
    EarlyStopping(patience=5, restore_best_weights=True, monitor='val_auc', mode='max'),
    ReduceLROnPlateau(factor=0.5, patience=3, min_lr=1e-7, monitor='val_auc', mode='max', verbose=1),
    ModelCheckpoint(SAVE_PATH, save_best_only=True, monitor='val_auc', mode='max', verbose=1)
]
model.fit(train_data, validation_data=val_data, epochs=20,
          callbacks=cb1, class_weight=class_weights)

# Stage 2
print("\nSTAGE 2: Fine-tuning...")
base.trainable = True
for layer in base.layers[:-50]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(5e-6),
    loss='binary_crossentropy',
    metrics=['accuracy', tf.keras.metrics.AUC(name='auc'),
             tf.keras.metrics.Recall(name='recall')]
)
cb2 = [
    EarlyStopping(patience=8, restore_best_weights=True, monitor='val_auc', mode='max'),
    ReduceLROnPlateau(factor=0.3, patience=4, min_lr=1e-8, monitor='val_auc', mode='max', verbose=1),
    ModelCheckpoint(SAVE_PATH, save_best_only=True, monitor='val_auc', mode='max', verbose=1)
]
model.fit(train_data, validation_data=val_data, epochs=30,
          callbacks=cb2, class_weight=class_weights)

# Evaluate
print("\nFINAL EVALUATION")
model = tf.keras.models.load_model(SAVE_PATH)
y_pred_proba = model.predict(test_data, verbose=1).flatten()
y_true = test_data.classes

# Find best threshold
best_t, best_f1 = 0.5, 0
from sklearn.metrics import f1_score
for t in np.arange(0.2, 0.8, 0.05):
    y_pred = (y_pred_proba > t).astype(int)
    f1 = f1_score(y_true, y_pred, average='macro')
    if f1 > best_f1:
        best_f1, best_t = f1, t

y_pred = (y_pred_proba > best_t).astype(int)
print(f"\nBest threshold: {best_t:.2f}")
print(classification_report(y_true, y_pred, target_names=list(test_data.class_indices.keys())))
auc = roc_auc_score(y_true, y_pred_proba)
print(f"AUC: {auc:.4f}")
print(f"✅ Model saved: {SAVE_PATH}")