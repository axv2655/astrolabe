import tensorflow as tf
import numpy as np
from pathlib import Path

base_dir = Path(__file__).resolve().parent

print("Loading model...")
# 1. Load your saved brain
model = tf.keras.models.load_model(base_dir / 'counter_poc_model.keras')

# Your class names in alphabetical order
class_names = ['counter_node', 'unknown_space']
manual_test_dir = base_dir / "dataset" / "manual_test"
image_paths = sorted(manual_test_dir.glob("*.jpg")) + sorted(manual_test_dir.glob("*.png"))

print("-" * 40)
for image_path in image_paths:
    img = tf.keras.utils.load_img(str(image_path), target_size=(224, 224))
    img_array = tf.keras.utils.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)

    predictions = model.predict(img_array, verbose=0)
    raw_scores = predictions[0]
    predicted_index = np.argmax(raw_scores)
    confidence = raw_scores[predicted_index] * 100

    print(f"{image_path.name}: {class_names[predicted_index]} ({confidence:.2f}%)")
print("-" * 40)