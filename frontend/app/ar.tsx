import React, { useCallback, useMemo, useState } from 'react';
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
// DESTINATIONS — The series of nodes to navigate to.
// Each destination is a specific point in AR space.
//
// HOW TO SET A SPECIFIC NODE/SPOT:
// Just add an entry with the exact [x, y, z] coordinates
// in meters relative to where the AR session started (your phone's
// position when the app launched).
//
//   x: left(-) / right(+)
//   y: down(-) / up(+)
//   z: forward(-) / back(+)
//
// Example: A spot 5m to your right, at eye level, 10m ahead:
//   { label: 'My Spot', position: [5.0, 0.0, -10.0] }
// =============================================
const DESTINATIONS: { label: string; position: [number, number, number] }[] = [
  { label: 'Library Entrance', position: [3.0, 0.0, -6.0] },
  { label: 'Science Building', position: [-4.0, 0.0, -12.0] },
  { label: 'Student Center', position: [6.0, 0.0, -20.0] },
  { label: 'Parking Garage', position: [-2.0, 0.0, -28.0] },
];

// Trail settings
const ARROWS_PER_TRAIL = 7;
const ARROW_Y_OFFSET = -0.8;

// Chevron arrow sizing (in meters)
const CHEVRON_WIDTH = 0.18;   // half-width of the arrow "wings"
const CHEVRON_LENGTH = 0.25;  // how long the arrow is tip-to-back
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

/** Chevron arrow shape points (a ">" shape pointing along -Z). */
function chevronPoints(w: number, l: number): [number, number, number][] {
  // Draw a chevron: left wing → tip → right wing
  //   (-w, 0, 0) → (0, 0, -l) → (w, 0, 0)
  return [
    [-w, 0, 0],
    [0, 0, -l],
    [w, 0, 0],
  ];
}

/** Diamond/ring shape for destination marker (flat on XZ plane). */
function diamondPoints(size: number): [number, number, number][] {
  return [
    [0, 0, -size],
    [size, 0, 0],
    [0, 0, size],
    [-size, 0, 0],
    [0, 0, -size], // close the shape
  ];
}

/** Generate evenly-spaced positions from origin to target. */
function generateTrailPositions(
  origin: [number, number, number],
  target: [number, number, number],
  count: number
): [number, number, number][] {
  const positions: [number, number, number][] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    positions.push([
      origin[0] + (target[0] - origin[0]) * t,
      ARROW_Y_OFFSET,
      origin[2] + (target[2] - origin[2]) * t,
    ]);
  }
  return positions;
}



/** Calculate rotation [pitch, yaw, roll] so an object at `from` points toward `to`. */
function getRotationToTarget(
  from: [number, number, number],
  to: [number, number, number]
): [number, number, number] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];

  // Viro positive Y rotation = counter-clockwise from above.
  // Our chevron points along -Z in local space, so we negate
  // the atan2 result to get clockwise rotation toward the target.
  const yawRad = Math.atan2(dx, -dz);
  const yawDeg = -(yawRad * 180) / Math.PI;

  const horizontalDist = Math.sqrt(dx * dx + dz * dz);
  const pitchRad = Math.atan2(dy, horizontalDist);
  const pitchDeg = (pitchRad * 180) / Math.PI;

  return [pitchDeg, yawDeg, 0];
}

// =============================================
// AR Scene — renders the trail of ViroPolyline arrows
// =============================================
const TrailARScene = (props: any) => {
  const { destinationIndex } = props.arSceneNavigator.viroAppProps;
  const destination = DESTINATIONS[destinationIndex];
  const origin: [number, number, number] = [0, 0, 0];

  const trailPositions = useMemo(
    () => generateTrailPositions(origin, destination.position, ARROWS_PER_TRAIL),
    [destinationIndex]
  );

  // Pre-compute chevron shapes once
  const trailChevron = useMemo(() => chevronPoints(CHEVRON_WIDTH, CHEVRON_LENGTH), []);
  const leadChevron = useMemo(() => chevronPoints(LEAD_CHEVRON_WIDTH, LEAD_CHEVRON_LENGTH), []);
  const destDiamond = useMemo(() => diamondPoints(0.35), []);

  return (
    <ViroARScene>
      <ViroAmbientLight color="#ffffff" intensity={1000} />

      {/* Trail of chevron arrows */}
      {trailPositions.map((pos, index) => {
        const rotation = getRotationToTarget(pos, destination.position);
        const isLead = index === 0;
        const opacity = isLead ? 1 : 0.5 + (index / trailPositions.length) * 0.35;

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

      {/* Destination marker — a diamond at the target */}
      <ViroNode
        position={destination.position}
      >
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
  const currentDest = DESTINATIONS[destinationIndex];
  const isLast = destinationIndex === DESTINATIONS.length - 1;
  const isFinished = destinationIndex >= DESTINATIONS.length;

  const handleArrived = useCallback(() => {
    if (isLast) {
      setDestinationIndex(DESTINATIONS.length);
    } else {
      setDestinationIndex((prev) => prev + 1);
    }
  }, [isLast]);

  const handleRestart = useCallback(() => {
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
        viroAppProps={{ destinationIndex }}
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
          <Text style={styles.coords}>
            [{currentDest.position[0]}, {currentDest.position[1]},{' '}
            {currentDest.position[2]}]
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleArrived}>
          <Text style={styles.buttonText}>
            {isLast ? '✓ Final Destination Reached' : "I've Arrived → Next"}
          </Text>
        </TouchableOpacity>
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
  coords: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'monospace',
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
