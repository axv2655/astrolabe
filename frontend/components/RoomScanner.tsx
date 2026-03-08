import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useRunOnJS } from 'react-native-worklets-core';

export default function RoomScanner() {
  // 1. Get Camera Permissions & Hardware
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back'); // Use the rear camera
  
  // 2. Load the TFLite Model
  const { model, state } = useTensorflowModel(require('./assets/counter_model.tflite'));
  const { resize } = useResizePlugin();

  // 3. Setup React State for our UI
  const [prediction, setPrediction] = useState("Waking up brain...");

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  // This function safely bridges the background camera thread back to the main UI thread
  const updateUI = useRunOnJS((text) => {
    setPrediction(text);
  }, []);

  // 4. The Frame Processor (Runs ~30 times a second in the background)
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    // If the model isn't loaded yet, do nothing
    if (model == null) return;

    try {
      // Step A: Shrink the massive camera frame to the 224x224 your model expects
      const resizedFrame = resize(frame, {
        scale: { width: 224, height: 224 },
        pixelFormat: 'rgb',
        dataType: 'uint8'
      });

      // Step B: Run the prediction synchronously
      const outputs = model.runSync([resizedFrame]);
      const probabilities = outputs[0]; // Returns array like [0.98, 0.02]

      // Step C: Figure out the winner (Index 0 = counter_node, Index 1 = unknown_space)
      const prob0 = probabilities[0] as number;
      const prob1 = probabilities[1] as number;

      const isCounter = prob0 > prob1;
      const confidence = isCounter ? prob0 * 100 : prob1 * 100;
      const label = isCounter ? "Counter Detected!" : "Unknown Space";

      // Step D: Send the result to the React State
      updateUI(`${label} (${confidence.toFixed(1)}%)`);
      
    } catch (e) {
      console.log("Frame processing error:", e);
    }
  }, [model]);

  // Loading/Permission States
  if (!hasPermission) return <Text style={styles.text}>Requesting camera permission...</Text>;
  if (device == null) return <Text style={styles.text}>No camera found!</Text>;
  if (state !== 'loaded') return <Text style={styles.text}>Loading model...</Text>;

  // 5. Render the UI
  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv" // standard for iOS/Android
      />
      <View style={styles.overlay}>
        <Text style={styles.predictionText}>{prediction}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  predictionText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  text: {
    flex: 1,
    textAlign: 'center',
    marginTop: 100,
    fontSize: 18,
  }
});