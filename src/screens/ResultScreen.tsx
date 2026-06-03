import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { saveAttendanceLog } from '../database/storage';

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

type ResultScreenRouteProp = RouteProp<RootStackParamList, 'Result'>;
type ResultScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Result'>;

export const ResultScreen: React.FC = () => {
  const route = useRoute<ResultScreenRouteProp>();
  const navigation = useNavigation<ResultScreenNavigationProp>();
  const { status, matchDetail, confidence } = route.params;

  const handleReturn = () => {
    navigation.navigate('Home');
  };

  useEffect(() => {
    if (status === 'SUCCESS' && matchDetail && matchDetail.id) {
      try {
        saveAttendanceLog(matchDetail.id, 'PRESENT');
        console.log('[ResultScreen] Saved attendance log for:', matchDetail.name);
      } catch (error) {
        console.error('[ResultScreen] Failed to save attendance log:', error);
      }
    }
  }, [status, matchDetail]);

  return (
    <View style={styles.container}>
      <View style={[
        styles.card,
        status === 'SUCCESS' ? styles.successCard :
        status === 'FAILED_LIVENESS' ? styles.failedCard : styles.unknownCard
      ]}>
        {/* Status Indicator Icon */}
        <View style={[
          styles.statusCircle,
          status === 'SUCCESS' ? styles.successStatusCircle :
          status === 'FAILED_LIVENESS' ? styles.failedStatusCircle : styles.unknownStatusCircle
        ]}>
          <Text style={[
            styles.statusIcon,
            status === 'SUCCESS' ? styles.successIconText :
            status === 'FAILED_LIVENESS' ? styles.failedIconText : styles.unknownIconText
          ]}>
            {status === 'SUCCESS' ? '✓' : '✕'}
          </Text>
        </View>

        {/* Title */}
        <Text style={[
          styles.title,
          status === 'SUCCESS' ? styles.successText :
          status === 'FAILED_LIVENESS' ? styles.failedText : styles.unknownText
        ]}>
          {status === 'SUCCESS' ? 'ACCESS GRANTED' :
           status === 'FAILED_LIVENESS' ? 'LIVENESS FAILED' : 'ACCESS DENIED'}
        </Text>

        {/* Result Templates */}
        {status === 'SUCCESS' && matchDetail && (
          <View style={styles.detailsBlock}>
            <Text style={styles.name}>{matchDetail.name}</Text>
            <Text style={styles.info}>User ID: {matchDetail.id}</Text>
            {confidence !== undefined && (
              <Text style={styles.score}>
                Confidence: {(confidence * 100).toFixed(1)}%
              </Text>
            )}
            <Text style={styles.timestamp}>
              Verified: {matchDetail.timestamp ? new Date(matchDetail.timestamp).toLocaleString() : new Date().toLocaleString()}
            </Text>
          </View>
        )}

        {status === 'FAILED_LIVENESS' && (
          <View style={styles.detailsBlock}>
            <Text style={styles.warningText}>
              Security System flagged spoofing activity. Liveness checks (EAR/Yaw ratios) were not completed successfully.
            </Text>
          </View>
        )}

        {status === 'UNKNOWN_FACE' && (
          <View style={styles.detailsBlock}>
            <Text style={styles.warningText}>
              Face embedding does not match any enrolled personnel in the local offline datastore.
            </Text>
          </View>
        )}

        {/* Action Button */}
        <TouchableOpacity style={styles.button} onPress={handleReturn}>
          <Text style={styles.buttonText}>Return to Terminal</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Light theme background
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '95%',
    backgroundColor: '#FFFFFF', // Clean white card
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  successCard: {
    borderColor: '#10B981', // Green border
    backgroundColor: '#ECFDF5', // Soft green background
  },
  failedCard: {
    borderColor: '#EF4444', // Red border
    backgroundColor: '#FEF2F2', // Soft red background
  },
  unknownCard: {
    borderColor: '#F59E0B', // Yellow border
    backgroundColor: '#FFFBEB', // Soft yellow background
  },
  statusCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
  },
  successStatusCircle: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  failedStatusCircle: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  unknownStatusCircle: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusIcon: {
    fontSize: 24,
    fontWeight: '800',
  },
  successIconText: {
    color: '#059669',
  },
  failedIconText: {
    color: '#DC2626',
  },
  unknownIconText: {
    color: '#D97706',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  successText: {
    color: '#059669',
  },
  failedText: {
    color: '#DC2626',
  },
  unknownText: {
    color: '#D97706',
  },
  detailsBlock: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  name: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  info: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 6,
    fontWeight: '600',
  },
  score: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
  },
  timestamp: {
    color: '#64748B',
    fontSize: 12.5,
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  warningText: {
    color: '#64748B',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: '#0A2545', // Solid Deep Navy
    borderRadius: 10,
    paddingVertical: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
    shadowColor: '#0A2545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default ResultScreen;
