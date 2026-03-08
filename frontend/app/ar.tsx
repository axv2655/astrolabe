import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Octicons from '@expo/vector-icons/Octicons';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Audio } from 'expo-av';
import { File, Paths } from 'expo-file-system/next';
import {
  ViroAmbientLight,
  ViroARScene,
  ViroARSceneNavigator,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
} from '@reactvision/react-viro';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// =============================================
// DESTINATIONS
// =============================================
const DESTINATIONS: { label: string; position: [number, number, number] }[] = [
  { label: 'Node 1', position: [2.0, 0.0, 0.0] },
  { label: 'Node 2', position: [4.0, 0.0, 0] },
  { label: 'Node 3', position: [6.0, 0.0, 0.0] },
  { label: 'Node 4', position: [6.0, 0.0, 4.0] },
];

// Trail settings
const ARROW_SPACING = 1.5; // Fixed distance (meters) between each arrow
const ARROW_Y_OFFSET = -0.8;
const DIAMOND_RADIUS = 0.35; // Size of the destination diamond
const ARRIVAL_RADIUS = 1.0; // How close (m) to destination to show "Next" button

// Chevron sizing
const CHEVRON_WIDTH = 0.18;
const CHEVRON_LENGTH = 0.25;
const LEAD_CHEVRON_WIDTH = 0.25;
const LEAD_CHEVRON_LENGTH = 0.35;

// Turn detection
const STRAIGHT_THRESHOLD_DEG = 10; // Angles below this are considered "straight"

// =============================================
// Types
// =============================================
type TurnInfo = {
  direction: 'left' | 'right';
  angleDeg: number;
  /** How many nodes ahead the turn is (1 = at the very next node) */
  nodesAhead: number;
  /** Label of the node WHERE the turn happens */
  atNodeLabel: string;
};

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

/** XZ distance (ignoring height). */
function distanceXZ(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * Compute the turn from segment A→B to segment B→C.
 * Returns the signed angle in degrees (positive = right, negative = left)
 * using the 2D cross product on the XZ plane.
 */
function computeTurnAngle(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number]
): number {
  // Vector AB (in XZ)
  const abx = b[0] - a[0];
  const abz = b[2] - a[2];
  // Vector BC (in XZ)
  const bcx = c[0] - b[0];
  const bcz = c[2] - b[2];

  // Cross product (AB × BC) — positive means right turn, negative means left
  const cross = abx * bcz - abz * bcx;
  // Dot product
  const dot = abx * bcx + abz * bcz;

  const angleRad = Math.atan2(cross, dot);
  return (angleRad * 180) / Math.PI;
}

/**
 * Starting from the current destination index, look ahead through the path
 * to find the next upcoming turn.
 *
 * Logic:
 *   - We treat the segment from the PREVIOUS node (or user position for the
 *     first segment) to the current target as the "incoming" direction.
 *   - Then we check the angle at each future node.
 *   - If three consecutive nodes are roughly collinear (angle < threshold),
 *     we skip ahead and keep looking.
 *   - The first non-straight angle is returned as the upcoming turn.
 */
function getUpcomingTurn(
  currentIndex: number,
  cameraPos: [number, number, number]
): TurnInfo | null {
  // We need at least two more nodes after the current one to detect a turn
  // A (prev or camera) → B (current target) → C (next) forms the first check
  // Then B → C → D, etc.

  // Build the "path ahead" starting from the previous reference point
  const prevPos = currentIndex > 0 ? DESTINATIONS[currentIndex - 1].position : cameraPos;

  // Walk forward looking for the first non-straight angle
  for (let i = currentIndex; i < DESTINATIONS.length - 1; i++) {
    const a = i === currentIndex ? prevPos : DESTINATIONS[i - 1].position;
    const b = DESTINATIONS[i].position;
    const c = DESTINATIONS[i + 1].position;

    const angleDeg = computeTurnAngle(a, b, c);
    const absAngle = Math.abs(angleDeg);

    if (absAngle >= STRAIGHT_THRESHOLD_DEG) {
      return {
        direction: angleDeg > 0 ? 'right' : 'left',
        angleDeg: Math.round(absAngle),
        nodesAhead: i - currentIndex + 1, // 1 = at the very next node
        atNodeLabel: DESTINATIONS[i].label,
      };
    }
    // Otherwise it's straight — keep scanning ahead
  }

  return null; // No turns found ahead — path is straight to the end
}

/**
 * Generate arrow positions at FIXED intervals from camera toward destination.
 */
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

/** Calculate rotation so an object at `from` points toward `to`. */
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

  // Contextual distance label
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
// AR Scene
// =============================================
const TrailARScene = (props: any) => {
  const { destinationIndex, onDistanceUpdate, onCameraPosUpdate } =
    props.arSceneNavigator.viroAppProps;
  const destination = DESTINATIONS[destinationIndex];

  const [cameraPos, setCameraPos] = useState<[number, number, number]>([0, 0, 0]);
  const sceneRef = useRef<any>(null);

  // Poll camera position every 100ms for faster updates
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

  // Generate fixed-spacing trail from camera to destination
  const trailPositions = generateFixedSpacingTrail(cameraPos, destination.position);

  const trailChevron = useMemo(() => chevronPoints(CHEVRON_WIDTH, CHEVRON_LENGTH), []);
  const leadChevron = useMemo(() => chevronPoints(LEAD_CHEVRON_WIDTH, LEAD_CHEVRON_LENGTH), []);
  const destDiamond = useMemo(() => diamondPoints(DIAMOND_RADIUS), []);

  return (
    <ViroARScene ref={sceneRef}>
      <ViroAmbientLight color="#ffffff" intensity={1000} />

      {/* Trail of chevron arrows at fixed spacing */}
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

      {/* Gold destination diamond */}
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
// Main Screen
// =============================================
export default function ARScreen() {
  const [destinationIndex, setDestinationIndex] = useState(0);
  const [distToDest, setDistToDest] = useState<number>(Infinity);
  const [cameraPos, setCameraPos] = useState<[number, number, number]>([0, 0, 0]);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const navigatorRef = useRef<any>(null);

  const currentDest = DESTINATIONS[destinationIndex];
  const isLast = destinationIndex === DESTINATIONS.length - 1;
  const isFinished = destinationIndex >= DESTINATIONS.length;

  // User is "at" the destination when inside the arrival radius
  const isAtDestination = distToDest < ARRIVAL_RADIUS;

  // Compute upcoming turn from current path position
  const upcomingTurn = useMemo(
    () => (isFinished ? null : getUpcomingTurn(destinationIndex, cameraPos)),
    [destinationIndex, cameraPos, isFinished]
  );

  // Callbacks from AR scene
  const handleDistanceUpdate = useCallback((dist: number) => {
    setDistToDest(dist);
  }, []);

  const handleCameraPosUpdate = useCallback((pos: [number, number, number]) => {
    setCameraPos(pos);
  }, []);

  const handleArrived = useCallback(() => {
    setDistToDest(Infinity);
    if (isLast) {
      setDestinationIndex(DESTINATIONS.length);
    } else {
      setDestinationIndex((prev) => prev + 1);
    }
  }, [isLast]);

  const handleRestart = useCallback(() => {
    setDistToDest(Infinity);
    setDestinationIndex(0);
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
      // Unload previous audio
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      // Take screenshot from AR navigator
      const result = await navigatorRef.current._takeScreenshot('gemini_capture', false);
      if (!result?.success || !result?.url) {
        console.warn('Screenshot failed', result);
        setGeminiLoading(false);
        return;
      }

      // Build FormData with screenshot — ensure file:// prefix for RN fetch
      const uri = result.url.startsWith('file://') ? result.url : `file://${result.url}`;
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'capture.jpg',
        type: 'image/jpeg',
      } as any);

      // POST to backend
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

      // Show transcript
      setTranscript(text);
      setTranscriptVisible(true);

      // Play audio from base64
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
          {DESTINATIONS.map((_, i) => (
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
            Navigating to {destinationIndex + 1} of {DESTINATIONS.length}
          </Text>
          <Text style={styles.waypointName}>{currentDest.label}</Text>
          <Text style={styles.distance}>
            {distToDest === Infinity ? 'Locating...' : `${distToDest.toFixed(1)} m away`}
          </Text>
        </View>

        {/* Only show Next button when user is inside the gold diamond */}
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
});
