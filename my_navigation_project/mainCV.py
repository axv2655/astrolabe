import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# --- 1. SETUP PARAMETERS ---
data_dir = BASE_DIR / "dataset"
batch_size = 32
img_height = 224 # MobileNetV2 expects 224x224 images
img_width = 224

print("Loading dataset...")

# --- 2. LOAD AND SPLIT THE DATA ---
# Grab 80% of the images for training
train_ds = tf.keras.utils.image_dataset_from_directory(
  data_dir,
  validation_split=0.2,
  subset="training",
  seed=123,
  image_size=(img_height, img_width),
  batch_size=batch_size)

# Grab the remaining 20% for validation (testing)
val_ds = tf.keras.utils.image_dataset_from_directory(
  data_dir,
  validation_split=0.2,
  subset="validation",
  seed=123,
  image_size=(img_height, img_width),
  batch_size=batch_size)

class_names = train_ds.class_names
print(f"Classes found: {class_names}")

# --- 3. DATA AUGMENTATION ---
# This flips and slightly rotates images to prevent memorization
data_augmentation = keras.Sequential([
  layers.RandomFlip("horizontal"),
  layers.RandomRotation(0.1),
])

# --- 4. LOAD THE PRE-TRAINED MODEL (TRANSFER LEARNING) ---
# We use MobileNetV2, ignoring its original classification layer (include_top=False)
base_model = tf.keras.applications.MobileNetV2(
    input_shape=(img_height, img_width, 3),
    include_top=False,
    weights='imagenet'
)
# Freeze the base model so we don't destroy its existing knowledge
base_model.trainable = False

# --- 5. BUILD OUR CUSTOM MODEL ---
inputs = keras.Input(shape=(img_height, img_width, 3))
x = data_augmentation(inputs)
# MobileNetV2 requires pixels scaled between -1 and 1
x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
x = base_model(x, training=False)
x = layers.GlobalAveragePooling2D()(x)
x = layers.Dropout(0.2)(x) # Helps prevent overfitting
# Output layer: 1 node per class
outputs = layers.Dense(len(class_names), activation='softmax')(x)

model = keras.Model(inputs, outputs)

# --- 6. COMPILE AND TRAIN ---
model.compile(optimizer='adam',
              loss='sparse_categorical_crossentropy',
              metrics=['accuracy'])

print("Starting training...")
# 5 Epochs means the model will look at the entire dataset 5 times. 
# For a POC, this is usually enough to get 90%+ accuracy!
history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=5
)

# --- 7. SAVE THE MODEL AND CLASS NAMES ---
model.save(BASE_DIR / 'node_classifier.keras')
print("Model saved successfully as 'node_classifier.keras'!")

with open(BASE_DIR / 'class_names.txt', 'w') as f:
    for name in class_names:
        f.write(name + '\n')
print(f"Class names saved to 'class_names.txt': {class_names}")