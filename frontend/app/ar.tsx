import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Octicons from '@expo/vector-icons/Octicons';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system/next';
import { useLocalSearchParams } from 'expo-router';
import {
  ViroAmbientLight,
  ViroARScene,
  ViroARSceneNavigator,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
} from '@reactvision/react-viro';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// =============================================
// Phase state machine
// =============================================
type Phase = 'DETECTING' | 'LOADING' | 'NAVIGATING';

// =============================================
// TFLite class → backend node ID mapping
// =============================================
const CLASS_NAMES = ['node1', 'unknown_space'];

const TFLITE_CLASS_TO_NODE_ID: Record<string, string> = {
  node1: '1',
};

// =============================================
// Room code → node ID mapping (Step 4)
// =============================================
const ROOM_TO_NODE: Record<string, string> = {
  // Populate with actual room-to-node mappings as they become available
  // e.g. 'ECSW 1.315': 'node_abc123',
};

// =============================================
// Destination type
// =============================================
type Destination = { label: string; position: [number, number, number] };

// =============================================
// Trail settings
// =============================================
const ARROW_SPACING = 1.5;
const ARROW_Y_OFFSET = -0.8;
const DIAMOND_RADIUS = 0.35;
const ARRIVAL_RADIUS = 1.0;

// Chevron sizing
const CHEVRON_WIDTH = 0.18;
const CHEVRON_LENGTH = 0.25;
const LEAD_CHEVRON_WIDTH = 0.25;
const LEAD_CHEVRON_LENGTH = 0.35;

// Turn detection
const STRAIGHT_THRESHOLD_DEG = 10;

// TFLite detection settings
const CONFIDENCE_THRESHOLD = 0.5;
const REQUIRED_CONSECUTIVE_FRAMES = 3;
const UNKNOWN_TIMEOUT_MS = 5000;

// =============================================
// Types
// =============================================
type TurnInfo = {
  direction: 'left' | 'right';
  angleDeg: number;
  nodesAhead: number;
  atNodeLabel: string;
};

type BackendNode = { id: string; lat: number; lng: number };

// =============================================
// Materials
// =============================================
ViroMaterials.createMaterials({
  arrowLead: {
    lightingModel: 'Constant',
    diffuseColor: '#6EF8FF',
    blendMode: 'Add',
  },
  arrowTrail: {
    lightingModel: 'Constant',
    diffuseColor: '#33B7FF',
    blendMode: 'Add',
  },
  destinationMarker: {
    lightingModel: 'Constant',
    diffuseColor: '#FFD700',
    blendMode: 'Add',
  },
});

// =============================================
// Coordinate conversion
// =============================================
function latLngToArPosition(
  originLat: number,
  originLng: number,
  nodeLat: number,
  nodeLng: number
): [number, number, number] {
  const METERS_PER_LAT = 110574;
  const METERS_PER_LNG = 93340; // cos(~33deg) * 111320, for UTD's latitude
  const x = (nodeLng - originLng) * METERS_PER_LNG;
  const z = -(nodeLat - originLat) * METERS_PER_LAT; // -z = forward/north in AR
  return [x, 0, z];
}

// =============================================
// Utility functions
// =============================================

function chevronPoints(w: number, l: number): [number, number, number][] {
  return [
    [-w, 0, 0],
    [0, 0, -l],
    [w, 0, 0],
  ];
}

function diamondPoints(size: number): [number, number, number][] {
  return [
    [0, 0, -size],
    [size, 0, 0],
    [0, 0, size],
    [-size, 0, 0],
    [0, 0, -size],
  ];
}

function distanceXZ(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2);
}

function computeTurnAngle(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number]
): number {
  const abx = b[0] - a[0];
  const abz = b[2] - a[2];
  const bcx = c[0] - b[0];
  const bcz = c[2] - b[2];
  const cross = abx * bcz - abz * bcx;
  const dot = abx * bcx + abz * bcz;
  const angleRad = Math.atan2(cross, dot);
  return (angleRad * 180) / Math.PI;
}

function getUpcomingTurn(
  currentIndex: number,
  cameraPos: [number, number, number],
  destinations: Destination[]
): TurnInfo | null {
  const prevPos = currentIndex > 0 ? destinations[currentIndex - 1].position : cameraPos;

  for (let i = currentIndex; i < destinations.length - 1; i++) {
    const a = i === currentIndex ? prevPos : destinations[i - 1].position;
    const b = destinations[i].position;
    const c = destinations[i + 1].position;

    const angleDeg = computeTurnAngle(a, b, c);
    const absAngle = Math.abs(angleDeg);

    if (absAngle >= STRAIGHT_THRESHOLD_DEG) {
      return {
        direction: angleDeg > 0 ? 'right' : 'left',
        angleDeg: Math.round(absAngle),
        nodesAhead: i - currentIndex + 1,
        atNodeLabel: destinations[i].label,
      };
    }
  }

  return null;
}

function generateFixedSpacingTrail(
  cameraPos: [number, number, number],
  target: [number, number, number]
): [number, number, number][] {
  const dx = target[0] - cameraPos[0];
  const dz = target[2] - cameraPos[2];
  const totalDist = Math.sqrt(dx * dx + dz * dz);

  if (totalDist < 0.5) return [];

  const dirX = dx / totalDist;
  const dirZ = dz / totalDist;

  const positions: [number, number, number][] = [];
  let d = ARROW_SPACING;

  while (d < totalDist - 0.3) {
    positions.push([cameraPos[0] + dirX * d, ARROW_Y_OFFSET, cameraPos[2] + dirZ * d]);
    d += ARROW_SPACING;
  }

  return positions;
}

function getRotationToTarget(
  from: [number, number, number],
  to: [number, number, number]
): [number, number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];

  const yawRad = Math.atan2(dx, -dz);
  const yawDeg = -(yawRad * 180) / Math.PI;

  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  const pitchRad = Math.atan2(dy, horizontalDist);
  const pitchDeg = (pitchRad * 180) / Math.PI;

  return [pitchDeg, yawDeg, 0];
}

// =============================================
// Turn Indicator Component
// =============================================
const TurnIndicator = ({ turn }: { turn: TurnInfo | null }) => {
  if (!turn) {
    return (
      <View style={styles.turnBox}>
        <Text style={styles.turnStraightIcon}>↑</Text>
        <View style={styles.turnTextCol}>
          <Text style={styles.turnMainText}>Continue straight</Text>
          <Text style={styles.turnSubText}>No turns ahead</Text>
        </View>
      </View>
    );
  }

  const isLeft = turn.direction === 'left';
  const arrow = isLeft ? '↰' : '↱';
  const dirLabel = isLeft ? 'Turn left' : 'Turn right';
  const color = isLeft ? '#5B9BFF' : '#FF6B6B';
  const proximity = turn.nodesAhead === 1 ? 'at next node' : `in ${turn.nodesAhead} nodes`;

  return (
    <View style={[styles.turnBox, { borderColor: color }]}>
      <Text style={[styles.turnArrowIcon, { color }]}>{arrow}</Text>
      <View style={styles.turnTextCol}>
        <Text style={[styles.turnMainText, { color }]}>
          {dirLabel} · {turn.angleDeg}°
        </Text>
        <Text style={styles.turnSubText}>
          {proximity} — {turn.atNodeLabel}
        </Text>
      </View>
    </View>
  );
};

// =============================================
// AR Scene (Phase 3 — NAVIGATING)
// =============================================
const TrailARScene = (props: any) => {
  const { destinationIndex, destinations, onDistanceUpdate, onCameraPosUpdate } =
    props.arSceneNavigator.viroAppProps;
  const destination = destinations[destinationIndex];

  const [cameraPos, setCameraPos] = useState<[number, number, number]>([0, 0, 0]);
  const sceneRef = useRef<any>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (sceneRef.current) {
        try {
          const result = await sceneRef.current.getCameraOrientationAsync();
          if (result && result.position) {
            setCameraPos(result.position);
            onCameraPosUpdate(result.position);
            const dist = distanceXZ(result.position, destination.position);
            onDistanceUpdate(dist);
          }
        } catch {
          // Camera not ready yet
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [destinationIndex]);

  const trailPositions = generateFixedSpacingTrail(cameraPos, destination.position);

  const trailChevron = useMemo(() => chevronPoints(CHEVRON_WIDTH, CHEVRON_LENGTH), []);
  const leadChevron = useMemo(() => chevronPoints(LEAD_CHEVRON_WIDTH, LEAD_CHEVRON_LENGTH), []);
  const destDiamond = useMemo(() => diamondPoints(DIAMOND_RADIUS), []);

  return (
    <ViroARScene ref={sceneRef}>
      <ViroAmbientLight color="#ffffff" intensity={1000} />

      {trailPositions.map((pos, index) => {
        const rotation = getRotationToTarget(pos, destination.position);
        const isLead = index === 0;
        const opacity = isLead ? 1 : 0.55 + (index / Math.max(1, trailPositions.length)) * 0.35;

        return (
          <ViroNode key={`arrow-${destinationIndex}-${index}`} position={pos} rotation={rotation}>
            <ViroPolyline
              points={isLead ? leadChevron : trailChevron}
              thickness={isLead ? 0.025 : 0.015}
              materials={[isLead ? 'arrowLead' : 'arrowTrail']}
              opacity={opacity}
            />
          </ViroNode>
        );
      })}

      <ViroNode position={destination.position}>
        <ViroPolyline
          points={destDiamond}
          thickness={0.03}
          materials={['destinationMarker']}
          opacity={0.9}
        />
      </ViroNode>
    </ViroARScene>
  );
};

// =============================================
// Manual Node Picker Component
// =============================================
const ManualNodePicker = ({
  allNodes,
  nodesLoading,
  onSelect,
  onCancel,
}: {
  allNodes: BackendNode[];
  nodesLoading: boolean;
  onSelect: (nodeId: string) => void;
  onCancel: () => void;
}) => (
  <View style={styles.pickerOverlay}>
    <View style={styles.pickerContainer}>
      <Text style={styles.pickerTitle}>Select your current node</Text>
      {nodesLoading ? (
        <ActivityIndicator size="small" color="#4F8EF7" />
      ) : allNodes.length === 0 ? (
        <Text style={styles.pickerItemCoords}>No nodes available. Check backend connection.</Text>
      ) : (
        <FlatList
          data={allNodes}
          keyExtractor={(item) => item.id}
          style={styles.pickerList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.pickerItem} onPress={() => onSelect(item.id)}>
              <Text style={styles.pickerItemText}>{item.id}</Text>
              <Text style={styles.pickerItemCoords}>
                {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
      <TouchableOpacity style={styles.pickerCancel} onPress={onCancel}>
        <Text style={styles.pickerCancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// =============================================
// Node Detection Phase (Phase 1 — DETECTING)
// =============================================
const NodeDetectionPhase = ({
  onNodeDetected,
  allNodes,
  nodesLoading,
}: {
  onNodeDetected: (nodeId: string) => void;
  allNodes: BackendNode[];
  nodesLoading: boolean;
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { model, state: modelState } = useTensorflowModel(
    require('../assets/node_classifier.tflite')
  );
  const { resize } = useResizePlugin();

  const [prediction, setPrediction] = useState('Scanning...');
  const [showManualPicker, setShowManualPicker] = useState(false);
  const consecutiveCountRef = useRef(0);
  const lastDetectedClassRef = useRef<string | null>(null);
  const detectionLockedRef = useRef(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission]);

  // Show manual picker after timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowManualPicker(true);
    }, UNKNOWN_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const lastUpdateTime = useSharedValue(0);

  const handleDetection = useRunOnJS(
    (className: string, confidence: number) => {
      if (detectionLockedRef.current) return;

      setPrediction(`${className} (${confidence.toFixed(1)}%)`);

      if (className !== 'unknown_space' && confidence >= CONFIDENCE_THRESHOLD * 100) {
        if (lastDetectedClassRef.current === className) {
          consecutiveCountRef.current += 1;
        } else {
          lastDetectedClassRef.current = className;
          consecutiveCountRef.current = 1;
        }

        if (consecutiveCountRef.current >= REQUIRED_CONSECUTIVE_FRAMES) {
          detectionLockedRef.current = true;
          const nodeId = TFLITE_CLASS_TO_NODE_ID[className];
          if (nodeId) {
            onNodeDetected(nodeId);
          }
        }
      } else {
        lastDetectedClassRef.current = null;
        consecutiveCountRef.current = 0;
      }
    },
    [onNodeDetected]
  );

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (model == null) return;

      const now = Date.now();
      if (now - lastUpdateTime.value < 50) return;
      lastUpdateTime.value = now;

      try {
        const resizedFrame = resize(frame, {
          scale: { width: 224, height: 224 },
          pixelFormat: 'rgb',
          dataType: 'uint8',
        });

        const float32Data = new Float32Array(resizedFrame.length);
        for (let i = 0; i < resizedFrame.length; i++) {
          float32Data[i] = resizedFrame[i];
        }

        const outputs = model.runSync([float32Data]);
        const probabilities = outputs[0];

        let maxIdx = 0;
        let maxProb = probabilities[0] as number;
        for (let i = 1; i < CLASS_NAMES.length; i++) {
          const p = probabilities[i] as number;
          if (p > maxProb) {
            maxProb = p;
            maxIdx = i;
          }
        }

        const confidence = maxProb * 100;
        const label = CLASS_NAMES[maxIdx];
        handleDetection(label, confidence);
      } catch (e: any) {
        console.log(
          'Frame processing error:',
          e?.message ?? e?.toString?.() ?? JSON.stringify(e)
        );
      }
    },
    [model]
  );

  const handleManualSelect = useCallback(
    (nodeId: string) => {
      if (detectionLockedRef.current) return;
      detectionLockedRef.current = true;
      setShowManualPicker(false);
      onNodeDetected(nodeId);
    },
    [onNodeDetected]
  );

  if (!hasPermission) {
    return (
      <View style={styles.detectingContainer}>
        <Text style={styles.detectingText}>Requesting camera permission...</Text>
      </View>
    );
  }
  if (device == null) {
    return (
      <View style={styles.detectingContainer}>
        <Text style={styles.detectingText}>No camera found</Text>
        <TouchableOpacity
          style={[styles.manualButton, { marginTop: 20 }]}
          onPress={() => setShowManualPicker(true)}>
          <Text style={styles.manualButtonText}>Select manually</Text>
        </TouchableOpacity>
        {showManualPicker && (
          <ManualNodePicker
            allNodes={allNodes}
            nodesLoading={nodesLoading}
            onSelect={handleManualSelect}
            onCancel={() => setShowManualPicker(false)}
          />
        )}
      </View>
    );
  }
  if (modelState !== 'loaded') {
    return (
      <View style={styles.detectingContainer}>
        <ActivityIndicator size="large" color="#4F8EF7" />
        <Text style={styles.detectingText}>Loading detection model...</Text>
        <TouchableOpacity
          style={[styles.manualButton, { marginTop: 20 }]}
          onPress={() => setShowManualPicker(true)}>
          <Text style={styles.manualButtonText}>Select manually</Text>
        </TouchableOpacity>
        {showManualPicker && (
          <ManualNodePicker
            allNodes={allNodes}
            nodesLoading={nodesLoading}
            onSelect={handleManualSelect}
            onCancel={() => setShowManualPicker(false)}
          />
        )}
      </View>
    );
  }

  // Deactivate camera when picker is open to avoid touch conflicts & frame processor racing
  const cameraActive = !showManualPicker && !detectionLockedRef.current;

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={cameraActive}
        frameProcessor={cameraActive ? frameProcessor : undefined}
        pixelFormat="rgb"
        resizeMode="cover"
      />

      {!showManualPicker && (
        <View style={styles.detectingOverlay}>
          <Text style={styles.detectingTitle}>Detecting your location...</Text>
          <Text style={styles.detectingPrediction}>{prediction}</Text>

          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setShowManualPicker(true)}>
            <Text style={styles.manualButtonText}>Select manually</Text>
          </TouchableOpacity>
        </View>
      )}

      {showManualPicker && (
        <ManualNodePicker
          allNodes={allNodes}
          nodesLoading={nodesLoading}
          onSelect={handleManualSelect}
          onCancel={() => setShowManualPicker(false)}
        />
      )}
    </View>
  );
};

// =============================================
// Main Screen
// =============================================
export default function ARScreen() {
  const { destination: destinationParam } = useLocalSearchParams<{ destination?: string }>();

  // Phase state machine
  const [phase, setPhase] = useState<Phase>('DETECTING');
  const [startNodeId, setStartNodeId] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationIndex, setDestinationIndex] = useState(0);
  const [distToDest, setDistToDest] = useState<number>(Infinity);
  const [cameraPos, setCameraPos] = useState<[number, number, number]>([0, 0, 0]);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const navigatorRef = useRef<any>(null);

  // All nodes for manual picker
  const [allNodes, setAllNodes] = useState<BackendNode[]>([]);
  const [nodesLoading, setNodesLoading] = useState(true);

  // Fetch all nodes on mount (for manual picker)
  useEffect(() => {
    fetch(`${API_URL}/nodes`)
      .then((res) => res.json())
      .then((data: BackendNode[]) => {
        setAllNodes(data);
        setNodesLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch nodes:', err);
        setNodesLoading(false);
      });
  }, []);

  // Phase 1 → Phase 2: Node detected, fetch path
  const handleNodeDetected = useCallback(
    async (nodeId: string) => {
      console.log('[AR] handleNodeDetected called with:', nodeId);
      setStartNodeId(nodeId);
      setPhase('LOADING');

      // TODO: remove hardcoded destination once room-to-node mapping is populated
      const destNodeId = '5';

      try {
        const url = `${API_URL}/path?a=${encodeURIComponent(nodeId)}&b=${encodeURIComponent(destNodeId)}`;
        console.log('[AR] Fetching path:', url);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
          const err = await res.text();
          console.error('[AR] Path error:', err);
          setLoadingError(`Path error: ${err}`);
          return;
        }

        const data = await res.json();
        console.log('[AR] Path response:', JSON.stringify(data));
        const waypoints: { id: number; lat: number; lng: number }[] = data.waypoints;

        if (!waypoints || waypoints.length === 0) {
          console.error('[AR] No waypoints in response');
          setLoadingError('No waypoints returned from server');
          return;
        }

        console.log('[AR] Waypoints count:', waypoints.length);

        // Convert lat/lng to AR coordinates, using first waypoint as origin
        const originLat = waypoints[0].lat;
        const originLng = waypoints[0].lng;

        const arDestinations: Destination[] = waypoints.map((wp) => ({
          label: String(wp.id),
          position: latLngToArPosition(originLat, originLng, wp.lat, wp.lng),
        }));

        // Skip the first waypoint (user's current position) — navigate to the rest
        const navDests = arDestinations.length > 1 ? arDestinations.slice(1) : arDestinations;
        console.log('[AR] navDests:', JSON.stringify(navDests));
        setDestinations(navDests);
        setDestinationIndex(0);
        console.log('[AR] Calling setPhase NAVIGATING');
        setPhase('NAVIGATING');
      } catch (err: any) {
        const msg = err.name === 'AbortError'
          ? 'Request timed out — is the backend running?'
          : `Network error: ${err.message}`;
        console.error('[AR] handleNodeDetected error:', err);
        setLoadingError(msg);
      }
    },
    []
  );

  // Debug: log every render
  console.log('[AR] Render — phase:', phase, 'destinations:', destinations.length, 'error:', loadingError);

  // Navigation state (Phase 3)
  const currentDest = destinations[destinationIndex];
  const isLast = destinationIndex === destinations.length - 1;
  const isFinished = destinations.length > 0 && destinationIndex >= destinations.length;
  const isAtDestination = distToDest < ARRIVAL_RADIUS;

  const upcomingTurn = useMemo(
    () =>
      phase === 'NAVIGATING' && !isFinished
        ? getUpcomingTurn(destinationIndex, cameraPos, destinations)
        : null,
    [destinationIndex, cameraPos, isFinished, phase, destinations]
  );

  const handleDistanceUpdate = useCallback((dist: number) => {
    setDistToDest(dist);
  }, []);

  const handleCameraPosUpdate = useCallback((pos: [number, number, number]) => {
    setCameraPos(pos);
  }, []);

  const handleArrived = useCallback(() => {
    setDistToDest(Infinity);
    if (isLast) {
      setDestinationIndex(destinations.length);
    } else {
      setDestinationIndex((prev) => prev + 1);
    }
  }, [isLast, destinations.length]);

  const handleRestart = useCallback(() => {
    setDistToDest(Infinity);
    setDestinationIndex(0);
    setDestinations([]);
    setStartNodeId(null);
    setLoadingError(null);
    setPhase('DETECTING');
  }, []);

  // Audio setup
  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
  }, []);
  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  const handleGemini = useCallback(async () => {
    if (geminiLoading) return;
    setGeminiLoading(true);
    setTranscript(null);
    setTranscriptVisible(false);

    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      const result = await navigatorRef.current._takeScreenshot('gemini_capture', false);
      if (!result?.success || !result?.url) {
        console.warn('Screenshot failed', result);
        setGeminiLoading(false);
        return;
      }

      const uri = result.url.startsWith('file://') ? result.url : `file://${result.url}`;
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'capture.jpg',
        type: 'image/jpeg',
      } as any);

      const response = await fetch(`${API_URL}/gemini`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('Gemini endpoint error:', err);
        setGeminiLoading(false);
        return;
      }

      const data = await response.json();
      const { transcript: text, audio_base64 } = data;

      setTranscript(text);
      setTranscriptVisible(true);

      const audioFile = new File(Paths.cache, 'gemini_audio.mp3');
      audioFile.write(audio_base64, { encoding: 'base64' });

      const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioFile.uri });
      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setTimeout(() => setTranscriptVisible(false), 2000);
        }
      });

      await newSound.playAsync();
    } catch (err) {
      console.error('handleGemini error:', err);
    } finally {
      setGeminiLoading(false);
    }
  }, [geminiLoading, sound]);

  // =============================================
  // Phase 1: DETECTING
  // =============================================
  if (phase === 'DETECTING') {
    return (
      <NodeDetectionPhase
        onNodeDetected={handleNodeDetected}
        allNodes={allNodes}
        nodesLoading={nodesLoading}
      />
    );
  }

  // =============================================
  // Phase 2: LOADING
  // =============================================
  if (phase === 'LOADING') {
    return (
      <View style={styles.loadingContainer}>
        {loadingError ? (
          <>
            <Text style={styles.loadingErrorText}>{loadingError}</Text>
            <TouchableOpacity style={styles.button} onPress={handleRestart}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="large" color="#4F8EF7" />
            <Text style={styles.loadingText}>Computing route...</Text>
            {destinationParam && (
              <Text style={styles.loadingSubText}>To: {destinationParam}</Text>
            )}
          </>
        )}
      </View>
    );
  }

  // =============================================
  // Phase 3: NAVIGATING — wait for destinations to be ready
  // =============================================
  if (phase === 'NAVIGATING' && destinations.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F8EF7" />
        <Text style={styles.loadingText}>Preparing AR...</Text>
      </View>
    );
  }

  // =============================================
  // Phase 3: NAVIGATING — finished state
  // =============================================
  if (isFinished) {
    return (
      <View style={styles.finishedContainer}>
        <Text style={styles.finishedEmoji}>🎉</Text>
        <Text style={styles.finishedTitle}>You've arrived!</Text>
        <Text style={styles.finishedSub}>All destinations reached.</Text>
        <TouchableOpacity style={styles.button} onPress={handleRestart}>
          <Text style={styles.buttonText}>Start Over</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // =============================================
  // Phase 3: NAVIGATING — active navigation
  // =============================================
  return (
    <View style={styles.container}>
      <ViroARSceneNavigator
        ref={navigatorRef}
        autofocus={true}
        initialScene={{
          scene: TrailARScene as any,
        }}
        viroAppProps={{
          destinationIndex,
          destinations,
          onDistanceUpdate: handleDistanceUpdate,
          onCameraPosUpdate: handleCameraPosUpdate,
        }}
        style={styles.flex}
      />

      {/* Gemini button */}
      <TouchableOpacity
        style={styles.geminiButton}
        onPress={handleGemini}
        activeOpacity={0.7}
        disabled={geminiLoading}>
        {geminiLoading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Octicons name="sparkles-fill" size={24} color="white" />
        )}
      </TouchableOpacity>

      {/* Subtitle overlay */}
      {transcriptVisible && transcript && (
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitleText}>{transcript}</Text>
        </View>
      )}

      {/* Overlay UI */}
      <View style={styles.overlay}>
        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {destinations.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === destinationIndex && styles.dotActive,
                i < destinationIndex && styles.dotDone,
              ]}
            />
          ))}
        </View>

        {/* Turn direction indicator */}
        <TurnIndicator turn={upcomingTurn} />

        <View style={styles.infoBox}>
          <Text style={styles.label}>
            Navigating to {destinationIndex + 1} of {destinations.length}
          </Text>
          <Text style={styles.waypointName}>{currentDest.label}</Text>
          <Text style={styles.distance}>
            {distToDest === Infinity ? 'Locating...' : `${distToDest.toFixed(1)} m away`}
          </Text>
        </View>

        {isAtDestination && (
          <TouchableOpacity style={styles.button} onPress={handleArrived}>
            <Text style={styles.buttonText}>
              {isLast ? '✓ Final Destination Reached' : 'Next Destination →'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// =============================================
// Styles
// =============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#4F8EF7',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotDone: {
    backgroundColor: '#4CAF50',
  },
  // ---- Turn indicator ----
  turnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    width: '100%',
  },
  turnArrowIcon: {
    fontSize: 32,
    marginRight: 12,
    fontFamily: 'Lato_700Bold',
  },
  turnStraightIcon: {
    fontSize: 28,
    marginRight: 12,
    color: '#4CAF50',
    fontFamily: 'Lato_700Bold',
  },
  turnTextCol: {
    flex: 1,
  },
  turnMainText: {
    fontSize: 16,
    fontFamily: 'Lato_700Bold',
    color: '#fff',
  },
  turnSubText: {
    fontSize: 12,
    fontFamily: 'Lato_400Regular',
    color: '#999',
    marginTop: 2,
  },
  // ---- Info box ----
  infoBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    width: '100%',
  },
  label: {
    color: '#aaa',
    fontSize: 13,
    fontFamily: 'Lato_400Regular',
    marginBottom: 2,
  },
  waypointName: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'InstrumentSerif_400Regular',
  },
  distance: {
    color: '#4F8EF7',
    fontSize: 18,
    fontFamily: 'Lato_700Bold',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#4F8EF7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Lato_700Bold',
  },
  finishedContainer: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  finishedEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  finishedTitle: {
    color: '#fff',
    fontSize: 28,
    fontFamily: 'InstrumentSerif_400Regular',
    marginBottom: 8,
  },
  finishedSub: {
    color: '#888',
    fontSize: 16,
    fontFamily: 'Lato_400Regular',
    marginBottom: 32,
  },
  geminiButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(107, 78, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  geminiButtonIcon: {
    color: '#fff',
    fontSize: 24,
  },
  subtitleContainer: {
    position: 'absolute',
    bottom: 240,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 14,
  },
  subtitleText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Lato_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
  // ---- Detecting phase ----
  detectingContainer: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  detectingText: {
    color: '#aaa',
    fontSize: 16,
    fontFamily: 'Lato_400Regular',
    marginTop: 16,
  },
  detectingOverlay: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  detectingTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Lato_700Bold',
    marginBottom: 8,
  },
  detectingPrediction: {
    color: '#4F8EF7',
    fontSize: 16,
    fontFamily: 'Lato_400Regular',
    marginBottom: 16,
  },
  manualButton: {
    backgroundColor: 'rgba(79, 142, 247, 0.2)',
    borderWidth: 1,
    borderColor: '#4F8EF7',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
  },
  manualButtonText: {
    color: '#4F8EF7',
    fontSize: 14,
    fontFamily: 'Lato_700Bold',
  },
  // ---- Manual picker ----
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerContainer: {
    backgroundColor: '#1A2332',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '70%',
  },
  pickerTitle: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Lato_700Bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  pickerItemText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Lato_700Bold',
  },
  pickerItemCoords: {
    color: '#6B7885',
    fontSize: 12,
    fontFamily: 'Lato_400Regular',
    marginTop: 2,
  },
  pickerCancel: {
    marginTop: 16,
    alignItems: 'center',
  },
  pickerCancelText: {
    color: '#FF6B6B',
    fontSize: 15,
    fontFamily: 'Lato_700Bold',
  },
  // ---- Loading phase ----
  loadingContainer: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: 'Lato_700Bold',
    marginTop: 16,
  },
  loadingSubText: {
    color: '#6B7885',
    fontSize: 14,
    fontFamily: 'Lato_400Regular',
    marginTop: 8,
  },
  loadingErrorText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontFamily: 'Lato_400Regular',
    marginBottom: 24,
    textAlign: 'center',
  },
});
