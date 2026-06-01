import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Home: undefined;
  Camera: { mode: 'ENROL' | 'VERIFY'; name?: string; empId?: string; dept?: string };
  Result: { status: 'SUCCESS' | 'FAILED_LIVENESS' | 'UNKNOWN_FACE'; matchDetail?: any; confidence?: number };
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

  return (
    <View style={styles.container}>
      <View style={[
        styles.card,
        status === 'SUCCESS' ? styles.successCard :
        status === 'FAILED_LIVENESS' ? styles.failedCard : styles.unknownCard
      ]}>
        {/* Status Indicator Icon */}
        <View style={styles.statusCircle}>
          <Text style={styles.statusIcon}>
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
           status === 'FAILED_LIVENESS' ? 'LIVENESS DETECTED FAIL' : 'ACCESS DENIED'}
        </Text>

        {/* Result Templates */}
        {status === 'SUCCESS' && matchDetail && (
          <View style={styles.detailsBlock}>
            <Text style={styles.name}>{matchDetail.name}</Text>
            <Text style={styles.info}>ID: {matchDetail.employeeId}</Text>
            <Text style={styles.info}>Department: {matchDetail.department}</Text>
            {confidence && (
              <Text style={styles.score}>
                Confidence: {(confidence * 100).toFixed(1)}%
              </Text>
            )}
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
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '90%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
  },
  successCard: {
    borderColor: '#10B981',
  },
  failedCard: {
    borderColor: '#EF4444',
  },
  unknownCard: {
    borderColor: '#F59E0B',
  },
  statusCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  statusIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 20,
    letterSpacing: 1.0,
  },
  successText: {
    color: '#10B981',
  },
  failedText: {
    color: '#EF4444',
  },
  unknownText: {
    color: '#F59E0B',
  },
  detailsBlock: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  info: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  score: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  warningText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
export default ResultScreen;
