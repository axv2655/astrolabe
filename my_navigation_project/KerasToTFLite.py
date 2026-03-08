import tensorflow as tf
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

print("Loading the Keras model...")
model = tf.keras.models.load_model(BASE_DIR / 'node_classifier.keras')

print("Converting to TensorFlow Lite...")
# Initialize the converter
converter = tf.lite.TFLiteConverter.from_keras_model(model)

# Optional but recommended: Quantization shrinks the file size for mobile
# converter.optimizations = [tf.lite.Optimize.DEFAULT]

tflite_model = converter.convert()

# Save the mobile-ready model
with open(BASE_DIR / 'node_classifier.tflite', 'wb') as f:
    f.write(tflite_model)

print("Success! 'node_classifier.tflite' is ready for your phone.")