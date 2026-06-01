import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as tf from '@tensorflow/tfjs';
import { cameraWithTensors } from '@tensorflow/tfjs-react-native';
import { Landmark } from '../utils/livenessLogic';

// Initialize TFJS model helper stubs
let isTfReady = false;

/**
 * Initializes TensorFlow JS engine and allocates buffers.
 */
export async function initializeTensorFlow(): Promise<boolean> {
  if (isTfReady) return true;
  try {
    await tf.ready();
    isTfReady = true;
    console.log('[TFJS] TensorFlow engine is ready.');
    return true;
  } catch (error) {
    console.warn('[TFJS] Failed to initialize TensorFlow engine:', error);
    return false;
  }
}

interface FaceDetectorProps {
  modelLoaded: boolean;
  tfEngineActive: boolean;
}

export const FaceDetector: React.FC<FaceDetectorProps> = ({ modelLoaded, tfEngineActive }) => {
  const [status, setStatus] = useState('Initializing AI Engines...');

  useEffect(() => {
    if (tfEngineActive && modelLoaded) {
      setStatus('MobileFaceNet & FaceMesh TFLite Models Loaded Offline');
    } else if (tfEngineActive) {
      setStatus('TensorFlow Ready. Loading model templates...');
    }
  }, [modelLoaded, tfEngineActive]);

  return (
    <View style={styles.container}>
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(15, 23, 42, 0.80)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignSelf: 'center',
    marginTop: 10,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});

/**
 * Mocks embedding vector extraction from a cropped face image.
 */
export function extractFaceEmbeddingStub(): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < 128; i++) {
    embedding.push(Math.sin(i * 0.1));
  }
  // Normalize
  let sum = 0.0;
  for (const v of embedding) sum += v * v;
  const norm = Math.sqrt(sum);
  return embedding.map((v) => v / (norm === 0 ? 1 : norm));
}

/**
 * Simulates a frame processor emitting landmarks to update liveness states.
 */
export function simulateFaceLandmarks(tick: number, step: string): {
  landmarks: Landmark[];
  ear: number;
  yaw: number;
} {
  const scaleX = 400.0;
  const scaleY = 600.0;
  const centerX = scaleX / 2.0;
  const centerY = scaleY / 2.0;
  
  const landmarks: Landmark[] = [];
  for (let i = 0; i < 468; i++) {
    landmarks.push({ x: centerX, y: centerY, z: 0.0 });
  }

  let ear = 0.32;
  let yaw = 0.50;

  switch (step) {
    case 'LOOK_CENTER':
      yaw = 0.50;
      break;
    case 'BLINK':
      if (tick >= 6 && tick <= 9) {
        ear = 0.12; // Closed eye
      } else {
        ear = 0.32;
      }
      break;
    case 'TURN_LEFT':
      const leftProgress = Math.min(tick / 15, 1.0);
      yaw = 0.50 - leftProgress * 0.25; // drops to 0.25
      break;
    case 'TURN_RIGHT':
      const rightProgress = Math.min(tick / 15, 1.0);
      yaw = 0.25 + rightProgress * 0.50; // goes to 0.75
      break;
    default:
      break;
  }

  // Set indices
  // Left eye
  landmarks[263] = { x: centerX + 50, y: centerY - 30 };
  landmarks[362] = { x: centerX + 10, y: centerY - 30 };
  landmarks[385] = { x: centerX + 30, y: centerY - 30 - (ear * 40) };
  landmarks[380] = { x: centerX + 30, y: centerY - 30 + (ear * 40) };
  landmarks[387] = { x: centerX + 30, y: centerY - 30 - (ear * 40) };
  landmarks[373] = { x: centerX + 30, y: centerY - 30 + (ear * 40) };

  // Right eye
  landmarks[33] = { x: centerX - 50, y: centerY - 30 };
  landmarks[133] = { x: centerX - 10, y: centerY - 30 };
  landmarks[160] = { x: centerX - 30, y: centerY - 30 - (ear * 40) };
  landmarks[144] = { x: centerX - 30, y: centerY - 30 + (ear * 40) };
  landmarks[158] = { x: centerX - 30, y: centerY - 30 - (ear * 40) };
  landmarks[153] = { x: centerX - 30, y: centerY - 30 + (ear * 40) };

  // Nose & cheek limits
  // If yaw is 0.25, nose tip shifts left (closer to leftCheek)
  const offset = (yaw - 0.50) * 160.0;
  landmarks[4] = { x: centerX + offset, y: centerY };
  landmarks[234] = { x: centerX - 100, y: centerY }; // Left Cheek
  landmarks[454] = { x: centerX + 100, y: centerY }; // Right Cheek

  return { landmarks, ear, yaw };
}
export default FaceDetector;
