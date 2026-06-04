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
import { Camera, CameraPermissionStatus } from 'react-native-vision-camera';

import FaceCamera, { FaceProcessedEvent, LivenessUpdateEvent, StatusMessageEvent } from '../components/FaceCamera';
import { registerUser, getAllUsers } from '../database/storage';
import { calculateCosineSimilarity } from '../utils/faceMatch';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CIRCLE_SIZE = SCREEN_WIDTH * 0.72;
const TOP_OFFSET = (SCREEN_HEIGHT - CIRCLE_SIZE) / 2 - 40;

type RootStackParamList = {
  Home: undefined;
  Camera: { mode: 'ENROL' | 'VERIFY'; name?: string; empId?: string; dept?: string };
  Result: { 
    status: 'SUCCESS' | 'FAILED_LIVENESS' | 'UNKNOWN_FACE'; 
    matchDetail?: { id: string; name: string; timestamp?: string }; 
    confidence?: number;
    timestamp?: string; 
  };
};

type CameraScreenRouteProp = RouteProp<RootStackParamList, 'Camera'>;
type CameraScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Camera'>;

export const CameraScreen: React.FC = () => {
  const route = useRoute<CameraScreenRouteProp>();
  const navigation = useNavigation<CameraScreenNavigationProp>();

  // Camera permission states
  const [permissionStatus, setPermissionStatus] = useState<CameraPermissionStatus | 'checking'>('checking');
  const [isActive, setIsActive] = useState(true);

  // Liveness Checklist states
  const [statusMessage, setStatusMessage] = useState('Position your face in the circle');
  const [blinkDone, setBlinkDone] = useState(false);
  const [leftTurnDone, setLeftTurnDone] = useState(false);
  const [rightTurnDone, setRightTurnDone] = useState(false);

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

  // Handlers for native events
  const handleStatusMessage = (e: StatusMessageEvent) => {
    setStatusMessage(e.nativeEvent.message);
  };

  const handleLivenessUpdate = (e: LivenessUpdateEvent) => {
    const { step, blink, turnLeft, turnRight } = e.nativeEvent;
    if (blink) setBlinkDone(true);
    if (turnLeft) setLeftTurnDone(true);
    if (turnRight) setRightTurnDone(true);
  };

  const handleFaceProcessed = async (e: FaceProcessedEvent) => {
    const { embedding, livenessSuccess } = e.nativeEvent;
    if (!livenessSuccess || !embedding) return;

    setIsActive(false);

    try {
      if (route.params.mode === 'ENROL') {
        const name = route.params.name || 'Enrolled User';
        const newUser = registerUser(name, embedding);
        
        Alert.alert(
          'Registration Success',
          `Successfully registered ${newUser.name}.`,
          [
            {
              text: 'OK',
              onPress: () => {
                navigation.navigate('Result', {
                  status: 'SUCCESS',
                  confidence: 1.0,
                  timestamp: newUser.registeredAt,
                  matchDetail: {
                    id: newUser.id,
                    name: newUser.name,
                    timestamp: newUser.registeredAt,
                  },
                });
              },
            },
          ]
        );
      } else {
        // mode === 'VERIFY'
        const users = getAllUsers();
        
        let bestMatchUser: any = null;
        let highestSimilarity = -1.0;

        for (const user of users) {
          const similarity = calculateCosineSimilarity(embedding, user.embedding);
          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatchUser = user;
          }
        }

        if (bestMatchUser && highestSimilarity > 0.85) {
          const timestamp = new Date().toISOString();
          Alert.alert(
            'Authentication Success',
            `Match found: ${bestMatchUser.name} (${(highestSimilarity * 100).toFixed(1)}%)`,
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.navigate('Result', {
                    status: 'SUCCESS',
                    confidence: highestSimilarity,
                    timestamp: timestamp,
                    matchDetail: {
                      id: bestMatchUser.id,
                      name: bestMatchUser.name,
                      timestamp: timestamp,
                    },
                  });
                },
              },
            ]
          );
        } else {
          // If no match show 'Face Not Recognised' message
          Alert.alert(
            'Authentication Failed',
            'Face Not Recognised',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.navigate('Result', {
                    status: 'UNKNOWN_FACE',
                  });
                },
              },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error during biometric verification flow:', error);
      Alert.alert(
        'System Error',
        'Biometric verification failed due to an internal error.',
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
    }
  };

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
  if (permissionStatus === 'denied' || permissionStatus === 'restricted') {
    return (
      <View style={styles.deniedContainer}>
        <View style={styles.deniedCard}>
          <View style={styles.iconCircle}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
          <Text style={styles.deniedTitle}>Camera Permission Required</Text>
          <Text style={styles.deniedText}>
            DatalakeFaceAuth requires front camera access to perform secure facial registration and identity verification.
          </Text>
          <TouchableOpacity style={styles.grantButton} onPress={requestPermissionAgain}>
            <Text style={styles.grantButtonText}>Grant Camera Permission</Text>
          </TouchableOpacity>
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
      {isActive && (
        <FaceCamera
          style={StyleSheet.absoluteFill}
          onStatusMessage={handleStatusMessage}
          onLivenessUpdate={handleLivenessUpdate}
          onFaceProcessed={handleFaceProcessed}
        />
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
          <Text style={styles.statusText}>{statusMessage}</Text>

          {/* Liveness Check Requirements Checklist Panel */}
          <View style={styles.checklistCard}>
            <Text style={styles.checklistTitle}>Biometric Check Verification</Text>
            
            <View style={styles.checkItem}>
              <View style={[
                styles.checkCircle,
                blinkDone ? styles.checkedCircle : null
              ]}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={[
                styles.checkText,
                blinkDone ? styles.checkTextCompleted : null
              ]}>
                Blink Detection (EAR check)
              </Text>
            </View>

            <View style={styles.checkItem}>
              <View style={[
                styles.checkCircle,
                leftTurnDone ? styles.checkedCircle : null
              ]}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={[
                styles.checkText,
                leftTurnDone ? styles.checkTextCompleted : null
              ]}>
                Head Turn Left Verified
              </Text>
            </View>

            <View style={styles.checkItem}>
              <View style={[
                styles.checkCircle,
                rightTurnDone ? styles.checkedCircle : null
              ]}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={[
                styles.checkText,
                rightTurnDone ? styles.checkTextCompleted : null
              ]}>
                Head Turn Right Verified
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
            <Text style={styles.exitButtonText}>Cancel Scan</Text>
          </TouchableOpacity>
        </View>
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
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  deniedContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deniedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  lockIcon: {
    fontSize: 28,
  },
  deniedTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  deniedText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  grantButton: {
    backgroundColor: '#0A2545',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  grantButtonText: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  overlayTop: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  overlayBottom: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    paddingTop: 16,
  },
  circleGuide: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  cornerTick: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
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
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  checklistCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: '90%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 16,
  },
  checklistTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkedCircle: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  checkText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  checkTextCompleted: {
    color: '#10B981',
  },
  exitButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 20,
  },
  exitButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default CameraScreen;
