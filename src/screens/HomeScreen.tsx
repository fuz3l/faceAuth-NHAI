import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  getDashboardStats,
  getAllPersonnel,
  deletePersonnel,
  initDatabase,
  GalleryItem,
} from '../database/storage';
import { checkNetworkStatus } from '../sync/awsScope';

type RootStackParamList = {
  Home: undefined;
  Camera: { mode: 'ENROL' | 'VERIFY'; name?: string; empId?: string; dept?: string };
  Result: { status: 'SUCCESS' | 'FAILED_LIVENESS' | 'UNKNOWN_FACE'; matchDetail?: any; confidence?: number };
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const isFocused = useIsFocused();

  // Database Stats
  const [stats, setStats] = useState({ totalEnrolled: 0, totalLogs: 0, pendingSync: 0 });
  const [personnel, setPersonnel] = useState<GalleryItem[]>([]);
  const [isOnline, setIsOnline] = useState(false);

  // Form Inputs for Enrolment
  const [enrolName, setEnrolName] = useState('');
  const [enrolEmpId, setEnrolEmpId] = useState('');
  const [enrolDept, setEnrolDept] = useState('');
  const [showEnrolForm, setShowEnrolForm] = useState(false);

  useEffect(() => {
    initDatabase();
    loadDashboardData();
  }, [isFocused]);

  const loadDashboardData = async () => {
    try {
      const dbStats = getDashboardStats();
      setStats(dbStats);

      const gallery = getAllPersonnel();
      setPersonnel(gallery);

      const netStatus = await checkNetworkStatus();
      setIsOnline(netStatus);
    } catch (error) {
      console.warn('Failed to load dashboard:', error);
    }
  };

  const handleStartVerify = () => {
    if (personnel.length === 0) {
      Alert.alert(
        'Empty gallery database',
        'Please enroll a field personnel member before initiating biometric verification.'
      );
      return;
    }
    navigation.navigate('Camera', { mode: 'VERIFY' });
  };

  const handleStartEnrol = () => {
    if (!enrolName.trim() || !enrolEmpId.trim() || !enrolDept.trim()) {
      Alert.alert('Form Error', 'Please complete Name, Employee ID, and Department.');
      return;
    }
    // Navigate to camera screen passing form states
    navigation.navigate('Camera', {
      mode: 'ENROL',
      name: enrolName.trim(),
      empId: enrolEmpId.trim().toUpperCase(),
      dept: enrolDept.trim(),
    });

    // Reset Form
    setEnrolName('');
    setEnrolEmpId('');
    setEnrolDept('');
    setShowEnrolForm(false);
  };

  const handleDeleteRecord = (id: string, name: string) => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to delete ${name} from local datastore?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePersonnel(id);
            loadDashboardData();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Top Header Section */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>DATALAKE OFF-LINE</Text>
          <Text style={styles.headerSubtitle}>NHAI Security Facial Matcher</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, isOnline ? styles.onlineDot : styles.offlineDot]} />
          <Text style={styles.statusText}>{isOnline ? 'CLOUD CONNECT' : 'OFFLINE ACTIVE'}</Text>
        </View>
      </View>

      {/* Aggregate Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>ENROLLED</Text>
          <Text style={styles.statNumber}>{stats.totalEnrolled}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>AUDIT LOGS</Text>
          <Text style={styles.statNumber}>{stats.totalLogs}</Text>
        </View>
        <View style={[styles.statCard, stats.pendingSync > 0 ? styles.alertBorder : null]}>
          <Text style={styles.statLabel}>PENDING SYNC</Text>
          <Text style={[styles.statNumber, stats.pendingSync > 0 ? styles.alertText : null]}>
            {stats.pendingSync}
          </Text>
        </View>
      </View>

      {/* Main Operations Block */}
      <View style={styles.actionBlock}>
        <TouchableOpacity style={styles.scanButton} onPress={handleStartVerify}>
          <Text style={styles.scanButtonText}>✓ START SCAN & VERIFY</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.toggleEnrolButton} 
          onPress={() => setShowEnrolForm(!showEnrolForm)}
        >
          <Text style={styles.toggleEnrolButtonText}>
            {showEnrolForm ? '✕ Close Registration Form' : '+ Register New Personnel'}
          </Text>
        </TouchableOpacity>

        {showEnrolForm && (
          <View style={styles.enrolForm}>
            <Text style={styles.formHeader}>Personnel Details</Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#64748B"
              value={enrolName}
              onChangeText={setEnrolName}
            />
            <TextInput
              style={styles.input}
              placeholder="Employee ID"
              placeholderTextColor="#64748B"
              value={enrolEmpId}
              onChangeText={setEnrolEmpId}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Department"
              placeholderTextColor="#64748B"
              value={enrolDept}
              onChangeText={setEnrolDept}
            />
            <TouchableOpacity style={styles.submitEnrolButton} onPress={handleStartEnrol}>
              <Text style={styles.submitEnrolButtonText}>Open Enrolment Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Enrolled Personnel List */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Local Gallery Records</Text>
      </View>

      {personnel.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No personnel records enrolled yet.</Text>
        </View>
      ) : (
        personnel.map((person) => (
          <View key={person.id} style={styles.personRow}>
            <View>
              <Text style={styles.personName}>{person.name}</Text>
              <Text style={styles.personMeta}>
                ID: {person.employeeId} • Dept: {person.department}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteBtn}
              onPress={() => handleDeleteRecord(person.id, person.name)}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  onlineDot: {
    backgroundColor: '#3B82F6',
  },
  offlineDot: {
    backgroundColor: '#10B981',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  alertBorder: {
    borderColor: '#F59E0B',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 4,
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  alertText: {
    color: '#F59E0B',
  },
  actionBlock: {
    marginBottom: 26,
  },
  scanButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  scanButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toggleEnrolButton: {
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  toggleEnrolButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  enrolForm: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    marginTop: 10,
  },
  formHeader: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
  },
  submitEnrolButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitEnrolButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 34,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  personName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  personMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '800',
  },
});
export default HomeScreen;
