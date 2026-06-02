import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Camera, CameraPermissionStatus, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import Svg, { Rect } from 'react-native-svg';

import { Landmark } from '../utils/livenessLogic';
import { initializeFaceMeshModel, detectFaceFromFrame, FaceDetector } from '../components/FaceDetector';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CIRCLE_SIZE = SCREEN_WIDTH * 0.72;
const TOP_OFFSET = (SCREEN_HEIGHT - CIRCLE_SIZE) / 2 - 40;

type RootStackParamList = {
  Home: undefined;
  Camera: { mode: 'ENROL' | 'VERIFY'; name?: string; empId?: string; dept?: string };
  Result: { status: 'SUCCESS' | 'FAILED_LIVENESS' | 'UNKNOWN_FACE'; matchDetail?: any; confidence?: number };
};

type CameraScreenRouteProp = RouteProp<RootStackParamList, 'Camera'>;
type CameraScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Camera'>;

export const CameraScreen: React.FC = () => {
  const route = useRoute<CameraScreenRouteProp>();
  const navigation = useNavigation<CameraScreenNavigationProp>();
  
  // Camera permission states
  const [permissionStatus, setPermissionStatus] = useState<CameraPermissionStatus | 'checking'>('checking');
  const [isActive, setIsActive] = useState(true);

  // TensorFlow / Face Detection States
  const [modelLoaded, setModelLoaded] = useState(false);
  const [tfEngineActive, setTfEngineActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  // Get front camera device
  const device = useCameraDevice('front');

  // 1. Initialize Permissions
  useEffect(() => {
    let isMounted = true;

    async function checkPermission() {
      try {
        const status = await Camera.getCameraPermissionStatus();
        if (!isMounted) return;

        if (status === 'granted') {
          setPermissionStatus('granted');
        } else if (status === 'not-determined') {
          const requestedStatus = await Camera.requestCameraPermission();
          if (isMounted) {
            setPermissionStatus(requestedStatus);
          }
        } else {
          setPermissionStatus(status);
        }
      } catch (error) {
        console.error('Error verifying camera permissions:', error);
        if (isMounted) {
          setPermissionStatus('denied');
        }
      }
    }

    checkPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Initialize TensorFlow and load TFLite model on mount
  useEffect(() => {
    async function loadModels() {
      const ok = await initializeFaceMeshModel();
      setModelLoaded(ok);
      setTfEngineActive(ok);
    }
    loadModels();
  }, []);

  // JS Thread callback for frame processing and face detection
  const processFrameJS = (width: number, height: number, time: number) => {
    if (!isActive) return;
    const detectedLandmarks = detectFaceFromFrame(width, height, time, true);
    if (detectedLandmarks) {
      setLandmarks(detectedLandmarks);
      setFaceDetected(true);
    } else {
      setLandmarks([]);
      setFaceDetected(false);
    }
  };

  const processFrameWorklet = useRunOnJS(processFrameJS, [isActive]);

  // 3. Vision Camera Frame Processor integration
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    processFrameWorklet(SCREEN_WIDTH, SCREEN_HEIGHT, Date.now());
  }, [isActive]);

  // 4. Request animation frame fallback loop for simulator testing
  useEffect(() => {
    let animationFrameId: number;
    
    const updateLoop = () => {
      if (isActive) {
        processFrameJS(SCREEN_WIDTH, SCREEN_HEIGHT, Date.now());
        animationFrameId = requestAnimationFrame(updateLoop);
      }
    };
    
    updateLoop();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive]);

  const requestPermissionAgain = async () => {
    try {
      const requestedStatus = await Camera.requestCameraPermission();
      setPermissionStatus(requestedStatus);
      if (requestedStatus === 'denied') {
        Alert.alert(
          'Permission Required',
          'Camera access is required. Please enable it in the system settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => Linking.openSettings() }
          ]
        );
      }
    } catch (error) {
      console.error('Failed to request permission:', error);
    }
  };

  const handleExit = () => {
    setIsActive(false);
    navigation.navigate('Home');
  };

  // Compute Face Bounding Box boundaries dynamically from 468 landmarks
  const boundingBox = (() => {
    if (!faceDetected || landmarks.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    for (const p of landmarks) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    
    const padding = 12;
    const x = Math.max(0, minX - padding);
    const y = Math.max(0, minY - padding);
    const w = Math.min(SCREEN_WIDTH - x, (maxX - minX) + padding * 2);
    const h = Math.min(SCREEN_HEIGHT - y, (maxY - minY) + padding * 2);
    
    return { x, y, width: w, height: h };
  })();

  // Render Checking/Loading State
  if (permissionStatus === 'checking') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Verifying Camera Permissions...</Text>
      </View>
    );
  }

  // Render Permission Denied State
  if (permissionStatus === 'denied' || permissionStatus === 'restricted' || !device) {
    return (
      <View style={styles.deniedContainer}>
        <View style={styles.deniedCard}>
          <View style={styles.iconCircle}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
          <Text style={styles.deniedTitle}>
            {!device ? 'Camera Device Missing' : 'Camera Permission Required'}
          </Text>
          <Text style={styles.deniedText}>
            {!device
              ? 'A front-facing camera could not be found on this device.'
              : 'DatalakeFaceAuth requires front camera access to perform secure facial registration and identity verification.'}
          </Text>

          {device && (
            <TouchableOpacity style={styles.grantButton} onPress={requestPermissionAgain}>
              <Text style={styles.grantButtonText}>Grant Camera Permission</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.cancelLink} onPress={handleExit}>
            <Text style={styles.cancelLinkText}>Cancel & Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render Live Camera Feed with Overlay
  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
      />

      {/* SVG Bounding Box Overlay */}
      {faceDetected && boundingBox && (
        <Svg style={StyleSheet.absoluteFill}>
          <Rect
            x={boundingBox.x}
            y={boundingBox.y}
            width={boundingBox.width}
            height={boundingBox.height}
            stroke="#10B981"
            strokeWidth={3}
            fill="transparent"
            rx={8}
          />
        </Svg>
      )}

      {/* Screen Mask Overlay */}
      <View style={styles.overlayContainer}>
        {/* Top Overlay */}
        <View style={[styles.overlayTop, { height: TOP_OFFSET }]} />

        {/* Middle Row with Cutout */}
        <View style={[styles.overlayRow, { height: CIRCLE_SIZE }]}>
          <View style={styles.overlaySide} />
          
          <View style={styles.circleGuide}>
            <View style={[styles.cornerTick, styles.tickTopLeft]} />
            <View style={[styles.cornerTick, styles.tickTopRight]} />
            <View style={[styles.cornerTick, styles.tickBottomLeft]} />
            <View style={[styles.cornerTick, styles.tickBottomRight]} />
          </View>
          
          <View style={styles.overlaySide} />
        </View>

        {/* Bottom Overlay */}
        <View style={[styles.overlayBottom, { height: SCREEN_HEIGHT - TOP_OFFSET - CIRCLE_SIZE }]}>
          <Text style={styles.statusText}>Position your face in the circle</Text>
          
          <View style={[
            styles.detectionBadge,
            faceDetected ? styles.badgeSuccess : styles.badgeDanger
          ]}>
            <Text style={faceDetected ? styles.badgeTextSuccess : styles.badgeTextDanger}>
              {faceDetected ? '✓ Face Detected' : '✕ No Face Found'}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
            <Text style={styles.exitButtonText}>Cancel Scan</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Model Load State Status Bar */}
      <View style={styles.detectorStatus}>
        <FaceDetector modelLoaded={modelLoaded} tfEngineActive={tfEngineActive} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deniedCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  lockIcon: {
    fontSize: 28,
  },
  deniedTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  deniedText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  grantButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  grantButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cancelLink: {
    paddingVertical: 12,
  },
  cancelLinkText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },
  overlayRow: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  overlayTop: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  overlayBottom: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    paddingTop: 20,
  },
  circleGuide: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 3,
    borderColor: '#10B981',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  cornerTick: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#10B981',
  },
  tickTopLeft: {
    top: 25,
    left: 25,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
  },
  tickTopRight: {
    top: 25,
    right: 25,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
  },
  tickBottomLeft: {
    bottom: 25,
    left: 25,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
  },
  tickBottomRight: {
    bottom: 25,
    right: 25,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  detectionBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  badgeDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#EF4444',
  },
  badgeTextSuccess: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextDanger: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  exitButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignSelf: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  exitButtonText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  detectorStatus: {
    position: 'absolute',
    bottom: 86,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

export default CameraScreen;
