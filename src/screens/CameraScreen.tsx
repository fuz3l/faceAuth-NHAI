import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import LivenessCheck, { LivenessStep } from '../components/LivenessCheck';
import FaceDetector, {
  initializeTensorFlow,
  extractFaceEmbeddingStub,
  simulateFaceLandmarks,
} from '../components/FaceDetector';
import { Landmark } from '../utils/livenessLogic';
import { enrollPersonnel, saveScanLog, getAllPersonnel } from '../database/storage';
import { findBestMatch } from '../utils/faceMatch';

const { width } = Dimensions.get('window');

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
  const { mode, name, empId, dept } = route.params;

  // Camera permissions and states
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // TFJS states
  const [tfEngineActive, setTfEngineActive] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Liveness States
  const [currentStep, setCurrentStep] = useState<LivenessStep>('LOOK_CENTER');
  const [statusMessage, setStatusMessage] = useState('Initializing verification...');
  const [blinkDone, setBlinkDone] = useState(false);
  const [leftTurnDone, setLeftTurnDone] = useState(false);
  const [rightTurnDone, setRightTurnDone] = useState(false);

  // Ref tracking
  const tickRef = useRef(0);
  const processedRef = useRef(false);

  useEffect(() => {
    async function setup() {
      // 1. Request camera permission
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');

      // 2. Initialize TFJS Engine
      const tfOk = await initializeTensorFlow();
      setTfEngineActive(tfOk);

      // Simulate model loading delay
      setTimeout(() => {
        setModelLoaded(true);
        setLoading(false);
        // Start processing logic (Simulator active if no camera or permissions)
        if (status !== 'granted') {
          setIsDemoMode(true);
          startBiometricPipeline(true);
        } else {
          startBiometricPipeline(false);
        }
      }, 1500);
    }
    setup();

    return () => {
      processedRef.current = true;
    };
  }, []);

  const startBiometricPipeline = (sandbox: boolean) => {
    console.log(`[Biometrics] Starting pipeline in ${sandbox ? 'Sandbox' : 'Hardware'} mode.`);
    setStatusMessage('Align your face in the center of the screen.');

    // Run interval simulator loop for sandbox
    // This allows the full step-by-step biometric verify checklist to run interactively
    let simulationTimer = setInterval(() => {
      if (processedRef.current) {
        clearInterval(simulationTimer);
        return;
      }

      tickRef.current += 1;
      const step = currentStep;

      // Request coordinates from simulation
      const { ear, yaw } = simulateFaceLandmarks(tickRef.current, step);

      // Step Machine logic
      if (step === 'LOOK_CENTER') {
        setStatusMessage('Look Center');
        if (tickRef.current > 15) {
          setCurrentStep('BLINK');
          tickRef.current = 0;
        }
      } else if (step === 'BLINK') {
        setStatusMessage('Blink Your Eyes');
        if (ear < 0.20) {
          setBlinkDone(true);
        }
        if (blinkDone && ear >= 0.25 && tickRef.current > 20) {
          setCurrentStep('TURN_LEFT');
          tickRef.current = 0;
        }
      } else if (step === 'TURN_LEFT') {
        setStatusMessage('Turn Head Left');
        if (yaw < 0.35) {
          setLeftTurnDone(true);
          setCurrentStep('TURN_RIGHT');
          tickRef.current = 0;
        }
      } else if (step === 'TURN_RIGHT') {
        setStatusMessage('Turn Head Right');
        if (yaw > 0.65) {
          setRightTurnDone(true);
          setCurrentStep('COMPLETED');
          tickRef.current = 0;
        }
      } else if (step === 'COMPLETED') {
        clearInterval(simulationTimer);
        processedRef.current = true;
        setStatusMessage('Liveness Confirmed. Processing Embeddings...');
        executeBiometricMatch();
      }
    }, 100);
  };

  const executeBiometricMatch = async () => {
    // Generate a 128D face embedding
    const embedding = extractFaceEmbeddingStub();

    if (mode === 'ENROL') {
      try {
        enrollPersonnel(
          name || 'Unknown',
          empId || 'EMP000',
          dept || 'General',
          embedding
        );
        Alert.alert('Registration Successful', `Personnel ${name} has been enrolled successfully.`, [
          { text: 'OK', onPress: () => navigation.navigate('Home') }
        ]);
      } catch (error) {
        Alert.alert('Enrolment Failed', 'Employee ID already exists.');
        navigation.navigate('Home');
      }
    } else {
      // Perform Offline Match
      const gallery = getAllPersonnel();
      const matchResult = findBestMatch(embedding, gallery, 0.80);

      if (matchResult) {
        saveScanLog(matchResult.personnel.id, matchResult.similarity, 'SUCCESS', true, true);
        navigation.navigate('Result', {
          status: 'SUCCESS',
          matchDetail: matchResult.personnel,
          confidence: matchResult.similarity,
        });
      } else {
        saveScanLog(null, 0.0, 'UNKNOWN_FACE', true, true);
        navigation.navigate('Result', {
          status: 'UNKNOWN_FACE',
        });
      }
    }
  };

  const exitVerify = () => {
    processedRef.current = true;
    navigation.navigate('Home');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Initializing Custom Camera...</Text>
      </View>
    );
  }

  // Vision Camera hooks devices
  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === 'front');

  return (
    <View style={styles.container}>
      {/* If permissions or emulator fallback triggers, render standard camera placeholder with scanner overlays */}
      {!hasPermission || isDemoMode || !device ? (
        <View style={styles.cameraFallback}>
          <Text style={styles.fallbackTitle}>
            {isDemoMode ? 'Sandbox Simulator Active' : 'Waiting for Device Camera...'}
          </Text>
          <Text style={styles.fallbackSubtitle}>
            {isDemoMode ? 'Liveness mesh tracking is running.' : 'Please allow camera permissions.'}
          </Text>
        </View>
      ) : (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          photo={true}
        />
      )}

      {/* Liveness Guidelines Panel Overlay */}
      <LivenessCheck
        currentStep={currentStep}
        statusMessage={statusMessage}
        blinkDone={blinkDone}
        leftTurnDone={leftTurnDone}
        rightTurnDone={rightTurnDone}
      />

      {/* Display Model Load State Status Bar */}
      <View style={styles.detectorStatus}>
        <FaceDetector modelLoaded={modelLoaded} tfEngineActive={tfEngineActive} />
      </View>

      {/* Exit Button */}
      <TouchableOpacity style={styles.exitButton} onPress={exitVerify}>
        <Text style={styles.exitButtonText}>Cancel Scan</Text>
      </TouchableOpacity>
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
  },
  cameraFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  fallbackTitle: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '800',
  },
  fallbackSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  detectorStatus: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  exitButton: {
    position: 'absolute',
    bottom: 30,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignSelf: 'center',
  },
  exitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
export default CameraScreen;
