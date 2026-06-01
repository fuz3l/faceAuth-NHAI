import React from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export type LivenessStep = 'LOOK_CENTER' | 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'COMPLETED';

interface LivenessCheckProps {
  currentStep: LivenessStep;
  statusMessage: string;
  blinkDone: boolean;
  leftTurnDone: boolean;
  rightTurnDone: boolean;
}

export const LivenessCheck: React.FC<LivenessCheckProps> = ({
  currentStep,
  statusMessage,
  blinkDone,
  leftTurnDone,
  rightTurnDone,
}) => {
  return (
    <View style={styles.overlayContainer}>
      {/* Dynamic Instruction Banner */}
      <View style={styles.instructionBanner}>
        <Text style={styles.instructionText}>{statusMessage.toUpperCase()}</Text>
      </View>

      {/* Target Scanning Circle Guide */}
      <View style={styles.scannerRing} />

      {/* Verification Steps Card */}
      <View style={styles.checklistCard}>
        <Text style={styles.checklistTitle}>Liveness Requirements</Text>
        
        <View style={styles.checkItem}>
          <View style={[
            styles.checkCircle,
            currentStep !== 'LOOK_CENTER' ? styles.checkedCircle : null
          ]}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.checkText}>Align Center Face</Text>
        </View>

        <View style={styles.checkItem}>
          <View style={[
            styles.checkCircle,
            blinkDone ? styles.checkedCircle : null
          ]}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.checkText}>Blink Eyes (EAR check)</Text>
        </View>

        <View style={styles.checkItem}>
          <View style={[
            styles.checkCircle,
            leftTurnDone ? styles.checkedCircle : null
          ]}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.checkText}>Turn Head Left</Text>
        </View>

        <View style={styles.checkItem}>
          <View style={[
            styles.checkCircle,
            rightTurnDone ? styles.checkedCircle : null
          ]}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.checkText}>Turn Head Right</Text>
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
  },
  instructionBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  instructionText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  scannerRing: {
    width: width * 0.72,
    height: width * 0.72,
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: (width * 0.72) / 2,
    alignSelf: 'center',
    borderStyle: 'dashed',
    opacity: 0.6,
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
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
export default LivenessCheck;
