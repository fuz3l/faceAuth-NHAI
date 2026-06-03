import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import { Landmark, calculateAverageEAR, calculateHeadTurnRatio } from '../utils/livenessLogic';

const { width } = Dimensions.get('window');

interface LivenessCheckProps {
  landmarks: Landmark[];
  onLivenessConfirmed: () => void;
}

export type LivenessStep = 'BLINK' | 'HEAD_TURN' | 'COMPLETED';

export const LivenessCheck: React.FC<LivenessCheckProps> = ({
  landmarks,
  onLivenessConfirmed,
}) => {
  const [step, setStep] = useState<LivenessStep>('BLINK');
  const [blinkDone, setBlinkDone] = useState(false);
  const [headTurnDone, setHeadTurnDone] = useState(false);
  const [isEyeClosed, setIsEyeClosed] = useState(false);

  // Keep track of the callback invocation to prevent double execution
  const confirmedCalled = useRef(false);

  useEffect(() => {
    if (!landmarks || landmarks.length === 0) return;

    if (step === 'BLINK') {
      const ear = calculateAverageEAR(landmarks);
      if (ear < 0.20) {
        setIsEyeClosed(true);
      } else if (isEyeClosed && ear >= 0.25) {
        setIsEyeClosed(false);
        setBlinkDone(true);
        setStep('HEAD_TURN');
      }
    } else if (step === 'HEAD_TURN') {
      const turnRatio = calculateHeadTurnRatio(landmarks);
      if (turnRatio > 0.15) {
        setHeadTurnDone(true);
        setStep('COMPLETED');
        if (!confirmedCalled.current) {
          confirmedCalled.current = true;
          onLivenessConfirmed();
        }
      }
    }
  }, [landmarks, step, isEyeClosed, onLivenessConfirmed]);

  const getStatusMessage = () => {
    switch (step) {
      case 'BLINK':
        return 'Please blink';
      case 'HEAD_TURN':
        return 'Turn your head slightly';
      case 'COMPLETED':
        return 'Liveness Confirmed';
      default:
        return '';
    }
  };

  return (
    <View style={styles.overlayContainer}>
      {/* Dynamic Instruction Banner */}
      <View style={[
        styles.instructionBanner,
        step === 'COMPLETED' ? styles.bannerSuccess : null
      ]}>
        <Text style={[
          styles.instructionText,
          step === 'COMPLETED' ? styles.textSuccess : null
        ]}>
          {getStatusMessage().toUpperCase()}
        </Text>
      </View>

      {/* Target Scanning Circle Guide */}
      <View style={[
        styles.scannerRing,
        step === 'COMPLETED' ? styles.ringSuccess : null
      ]} />

      {/* Verification Steps Card */}
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
            headTurnDone ? styles.checkedCircle : null
          ]}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={[
            styles.checkText,
            headTurnDone ? styles.checkTextCompleted : null
          ]}>
            Head Turn Detection (15% Shift)
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    pointerEvents: 'none', // Allow touches to pass through
  },
  instructionBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#3B82F6', // Blue default indicator
  },
  bannerSuccess: {
    borderColor: '#10B981', // Green for completed
  },
  instructionText: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  textSuccess: {
    color: '#10B981',
  },
  scannerRing: {
    width: width * 0.72,
    height: width * 0.72,
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: (width * 0.72) / 2,
    alignSelf: 'center',
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  ringSuccess: {
    borderColor: '#10B981',
    opacity: 0.8,
  },
  checklistCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  checklistTitle: {
    color: '#FFFFFF',
    fontSize: 13,
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
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkedCircle: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  checkMark: {
    color: '#0F172A',
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
});

export default LivenessCheck;
