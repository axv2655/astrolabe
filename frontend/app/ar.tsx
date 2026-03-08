import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  ViroAmbientLight,
  ViroARScene,
  ViroARSceneNavigator,
  ViroMaterials,
  ViroNode,
  ViroPolyline,
} from '@reactvision/react-viro';

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
 * Generate arrow positions at FIXED intervals from camera toward destination.
 * As you get further away, more arrows are created. As you get closer, fewer.
 * The first arrow is placed ARROW_SPACING meters ahead of the camera.
 */
function generateFixedSpacingTrail(
  cameraPos: [number, number, number],
  target: [number, number, number]
): [number, number, number][] {
  const dx = target[0] - cameraPos[0];
  const dz = target[2] - cameraPos[2];
  const totalDist = Math.sqrt(dx * dx + dz * dz);

  if (totalDist < 0.5) return []; // Too close, no arrows needed

  // Direction unit vector (XZ plane)
  const dirX = dx / totalDist;
  const dirZ = dz / totalDist;

  const positions: [number, number, number][] = [];
  let d = ARROW_SPACING; // Start first arrow one spacing ahead of camera

  while (d < totalDist - 0.3) {
    // Don't place arrows right on top of destination
    positions.push([
      cameraPos[0] + dirX * d,
      ARROW_Y_OFFSET,
      cameraPos[2] + dirZ * d,
    ]);
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
// AR Scene
// =============================================
const TrailARScene = (props: any) => {
  const { destinationIndex, onDistanceUpdate } = props.arSceneNavigator.viroAppProps;
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
            // Report distance to parent for button visibility
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
          <ViroNode
            key={`arrow-${destinationIndex}-${index}`}
            position={pos}
            rotation={rotation}
          >
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
  const currentDest = DESTINATIONS[destinationIndex];
  const isLast = destinationIndex === DESTINATIONS.length - 1;
  const isFinished = destinationIndex >= DESTINATIONS.length;

  // User is "at" the destination when inside the arrival radius
  const isAtDestination = distToDest < ARRIVAL_RADIUS;

  // Callback from AR scene reporting distance
  const handleDistanceUpdate = useCallback((dist: number) => {
    setDistToDest(dist);
  }, []);

  const handleArrived = useCallback(() => {
    setDistToDest(Infinity); // Reset for next destination
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
        autofocus={true}
        initialScene={{
          scene: TrailARScene as any,
        }}
        viroAppProps={{
          destinationIndex,
          onDistanceUpdate: handleDistanceUpdate,
        }}
        style={styles.flex}
      />

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

        <View style={styles.infoBox}>
          <Text style={styles.label}>
            Navigating to {destinationIndex + 1} of {DESTINATIONS.length}
          </Text>
          <Text style={styles.waypointName}>{currentDest.label}</Text>
          <Text style={styles.distance}>
            {distToDest === Infinity
              ? 'Locating...'
              : `${distToDest.toFixed(1)} m away`}
          </Text>
        </View>

        {/* Only show Next button when user is inside the gold diamond */}
        {isAtDestination && (
          <TouchableOpacity style={styles.button} onPress={handleArrived}>
            <Text style={styles.buttonText}>
              {isLast ? '✓ Final Destination Reached' : "Next Destination →"}
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
    marginBottom: 2,
  },
  waypointName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  distance: {
    color: '#4F8EF7',
    fontSize: 18,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: 'bold',
    marginBottom: 8,
  },
  finishedSub: {
    color: '#888',
    fontSize: 16,
    marginBottom: 32,
  },
});
