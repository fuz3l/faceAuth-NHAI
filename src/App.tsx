import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import {
  initDatabase,
  enrollPersonnel,
  matchFaceOffline,
  getScanLogsHistory,
  getDashboardStats,
  getAllPersonnel,
  deletePersonnel,
  ScanLog,
} from './database/database';
import { GalleryItem } from './utils/matching';
import FaceCamera, { FaceProcessedEvent, LivenessUpdateEvent } from './components/FaceCamera';

const { width } = Dimensions.get('window');

type Screen = 'DASHBOARD' | 'ENROL' | 'VERIFY' | 'LOGS';

export default function App() {
  // Navigation
  const [currentScreen, setCurrentScreen] = useState<Screen>('DASHBOARD');
  const [dbInitialized, setDbInitialized] = useState(false);

  // Dashboard Stats
  const [stats, setStats] = useState({
    totalEnrolled: 0,
    totalLogs: 0,
    pendingSync: 0,
  });

  // Personnel List (for management)
  const [personnelList, setPersonnelList] = useState<GalleryItem[]>([]);

  // History Logs
  const [logs, setLogs] = useState<ScanLog[]>([]);

  // Enrolment Form State
  const [enrolName, setEnrolName] = useState('');
  const [enrolEmpId, setEnrolEmpId] = useState('');
  const [enrolDept, setEnrolDept] = useState('');
  const [capturedEmbedding, setCapturedEmbedding] = useState<number[] | null>(null);
  const [enrolStatus, setEnrolStatus] = useState('Position face to capture embedding...');
  const [isEnrolCamActive, setIsEnrolCamActive] = useState(false);

  // Verification Screen State
  const [verifyStatus, setVerifyStatus] = useState('Initializing verification...');
  const [livenessState, setLivenessState] = useState({
    step: 'LOOK_CENTER',
    ear: 0.30,
    yaw: 0.50,
    blink: false,
    turnLeft: false,
    turnRight: false,
  });
  
  // Verification Results Modal
  const [showResultModal, setShowResultModal] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    match: GalleryItem | null;
    confidence: number;
    status: ScanLog['status'];
  } | null>(null);

  // Global Loader
  const [loading, setLoading] = useState(false);

  // 1. Initialize SQLite Database on startup
  useEffect(() => {
    async function setup() {
      try {
        await initDatabase();
        setDbInitialized(true);
        await refreshDashboard();
      } catch (e) {
        console.error('Failed to initialize database', e);
        Alert.alert('Database Error', 'Could not initialize SQLite database.');
      }
    }
    setup();
  }, []);

  // Refresh data from SQLite
  const refreshDashboard = async () => {
    try {
      const dbStats = await getDashboardStats();
      setStats(dbStats);

      const enrolled = await getAllPersonnel();
      setPersonnelList(enrolled);

      const scanLogs = await getScanLogsHistory();
      setLogs(scanLogs);
    } catch (e) {
      console.error('Failed to load dashboard data', e);
    }
  };

  // 2. Handle Personnel Enrolment
  const handleStartEnrol = () => {
    setEnrolName('');
    setEnrolEmpId('');
    setEnrolDept('');
    setCapturedEmbedding(null);
    setEnrolStatus('Position face inside the frame to capture embedding.');
    setIsEnrolCamActive(true);
    setCurrentScreen('ENROL');
  };

  const onFaceCapturedForEnrol = (event: FaceProcessedEvent) => {
    if (capturedEmbedding) return; // already captured

    if (event.embedding && event.embedding.length === 128) {
      setCapturedEmbedding(event.embedding);
      setIsEnrolCamActive(false);
      setEnrolStatus('Face Embedding Captured Successfully! Fill form to submit.');
      Alert.alert('Success', 'Face embedding captured successfully.');
    }
  };

  const submitEnrolment = async () => {
    if (!enrolName.trim() || !enrolEmpId.trim() || !enrolDept.trim()) {
      Alert.alert('Validation Error', 'Please fill in all fields.');
      return;
    }
    if (!capturedEmbedding) {
      Alert.alert('Validation Error', 'Please capture face embedding first.');
      return;
    }

    setLoading(true);
    try {
      await enrollPersonnel(
        enrolName.trim(),
        enrolEmpId.trim(),
        enrolDept.trim(),
        capturedEmbedding
      );
      Alert.alert('Success', `Personnel ${enrolName} enrolled successfully.`);
      await refreshDashboard();
      setCurrentScreen('DASHBOARD');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Enrolment Failed', 'Employee ID already exists or database transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  const deletePersonnelRecord = async (id: string, name: string) => {
    Alert.alert(
      'Confirm Deletion',
      `Are you sure you want to delete ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePersonnel(id);
              await refreshDashboard();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete record.');
            }
          },
        },
      ]
    );
  };

  // 3. Handle Live Face Verification & Liveness Checking
  const handleStartVerify = () => {
    if (personnelList.length === 0) {
      Alert.alert(
        'No Personnel Enrolled',
        'Please enroll at least one personnel member before verification.',
        [
          { text: 'Enroll Now', onPress: handleStartEnrol },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    setVerifyStatus('Align face and look straight at the camera.');
    setLivenessState({
      step: 'LOOK_CENTER',
      ear: 0.30,
      yaw: 0.50,
      blink: false,
      turnLeft: false,
      turnRight: false,
    });
    setVerifyResult(null);
    setCurrentScreen('VERIFY');
  };

  const handleLivenessUpdate = (event: LivenessUpdateEvent) => {
    setLivenessState({
      step: event.step,
      ear: event.ear,
      yaw: event.yaw,
      blink: event.blink,
      turnLeft: event.turnLeft,
      turnRight: event.turnRight,
    });
  };

  const handleStatusMessage = (message: string) => {
    setVerifyStatus(message);
  };

  const handleFaceProcessedForVerify = async (event: FaceProcessedEvent) => {
    // This executes once liveness is fully complete and we get the face embedding
    if (showResultModal) return; // Prevent double trigger

    setLoading(true);
    try {
      const matchStatus = await matchFaceOffline(
        event.embedding,
        livenessState.blink,
        livenessState.turnLeft && livenessState.turnRight
      );

      setVerifyResult(matchStatus);
      setShowResultModal(true);
      await refreshDashboard();
    } catch (e) {
      console.error(e);
      Alert.alert('Verification Error', 'Failed to perform matching pipeline.');
    } finally {
      setLoading(false);
    }
  };

  // Navigation Helpers
  const goHome = async () => {
    setIsEnrolCamActive(false);
    await refreshDashboard();
    setCurrentScreen('DASHBOARD');
  };

  if (!dbInitialized) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Initializing Local Datastore...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>DATALAKE FACEAUTH</Text>
          <Text style={styles.headerSubtitle}>NHAI Offline Security Terminal</Text>
        </View>
        <View style={styles.statusBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.statusText}>OFFLINE SECURE</Text>
        </View>
      </View>

      {/* DASHBOARD SCREEN */}
      {currentScreen === 'DASHBOARD' && (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Dashboard Summary Cards */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>ENROLLED</Text>
              <Text style={styles.statValue}>{stats.totalEnrolled}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>VERIFICATIONS</Text>
              <Text style={styles.statValue}>{stats.totalLogs}</Text>
            </View>
            <View style={[styles.statCard, stats.pendingSync > 0 ? styles.alertBorder : null]}>
              <Text style={styles.statLabel}>PENDING SYNC</Text>
              <Text style={[styles.statValue, stats.pendingSync > 0 ? styles.alertText : null]}>
                {stats.pendingSync}
              </Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleStartVerify}>
              <Text style={styles.buttonText}>✓ START SCAN & VERIFY</Text>
            </TouchableOpacity>

            <View style={styles.secondaryButtonGroup}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleStartEnrol}>
                <Text style={styles.secondaryButtonText}>+ Enroll Personnel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => setCurrentScreen('LOGS')}>
                <Text style={styles.secondaryButtonText}>⚏ Audit Logs</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Personnel Database */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Enrolled Personnel Database</Text>
          </View>

          {personnelList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No field personnel registered yet.</Text>
            </View>
          ) : (
            personnelList.map((person) => (
              <View key={person.id} style={styles.personnelRow}>
                <View>
                  <Text style={styles.personName}>{person.name}</Text>
                  <Text style={styles.personMeta}>
                    ID: {person.employeeId} • Dept: {person.department}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deletePersonnelRecord(person.id, person.name)}
                >
                  <Text style={styles.deleteButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ENROLMENT SCREEN */}
      {currentScreen === 'ENROL' && (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.formCard}>
            <Text style={styles.cardHeader}>Enrolment Registration</Text>

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
          </View>

          <View style={styles.cameraWrapper}>
            {isEnrolCamActive ? (
              <FaceCamera
                style={styles.cameraPreview}
                onFaceProcessed={onFaceCapturedForEnrol}
                onStatusMessage={(msg) => setEnrolStatus(msg)}
              />
            ) : (
              <View style={styles.cameraPlaceholder}>
                <Text style={styles.cameraPlaceholderText}>
                  {capturedEmbedding ? '✓ Face Embedding Captured' : 'Camera inactive'}
                </Text>
                {capturedEmbedding && (
                  <TouchableOpacity
                    style={styles.reCaptureButton}
                    onPress={() => {
                      setCapturedEmbedding(null);
                      setIsEnrolCamActive(true);
                      setEnrolStatus('Position face inside the frame to capture embedding.');
                    }}
                  >
                    <Text style={styles.reCaptureButtonText}>Capture Again</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <View style={styles.cameraInstructions}>
              <Text style={styles.cameraInstructionsText}>{enrolStatus}</Text>
            </View>
          </View>

          <View style={styles.navButtonGroup}>
            <TouchableOpacity style={styles.cancelButton} onPress={goHome}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, !capturedEmbedding ? styles.disabledButton : null]}
              onPress={submitEnrolment}
              disabled={!capturedEmbedding}
            >
              <Text style={styles.submitButtonText}>Submit Enrolment</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* VERIFICATION SCREEN (CAMERA + LIVENESS CHECKS) */}
      {currentScreen === 'VERIFY' && (
        <View style={styles.verifyContainer}>
          <FaceCamera
            style={styles.fullscreenCamera}
            onLivenessUpdate={handleLivenessUpdate}
            onFaceProcessed={handleFaceProcessedForVerify}
            onStatusMessage={handleStatusMessage}
          />

          {/* Liveness Check Overlay */}
          <View style={styles.livenessOverlayContainer}>
            <View style={styles.instructionBanner}>
              <Text style={styles.instructionText}>{verifyStatus.toUpperCase()}</Text>
            </View>

            {/* Scanning Guide Ring */}
            <View style={styles.scannerRing} />

            {/* Checklist Box */}
            <View style={styles.checklistCard}>
              <View style={styles.checkItem}>
                <View style={[styles.checkCircle, livenessState.step !== 'LOOK_CENTER' ? styles.checkedCircle : null]}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
                <Text style={styles.checkText}>Look Center</Text>
              </View>

              <View style={styles.checkItem}>
                <View style={[styles.checkCircle, livenessState.blink ? styles.checkedCircle : null]}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
                <Text style={styles.checkText}>Blink Eyes</Text>
              </View>

              <View style={styles.checkItem}>
                <View style={[styles.checkCircle, livenessState.turnLeft ? styles.checkedCircle : null]}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
                <Text style={styles.checkText}>Turn Left</Text>
              </View>

              <View style={styles.checkItem}>
                <View style={[styles.checkCircle, livenessState.turnRight ? styles.checkedCircle : null]}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
                <Text style={styles.checkText}>Turn Right</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.exitVerifyButton} onPress={goHome}>
              <Text style={styles.exitVerifyButtonText}>Exit Scanner</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* HISTORY LOGS SCREEN */}
      {currentScreen === 'LOGS' && (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Verification Logs</Text>
            <TouchableOpacity style={styles.backLink} onPress={goHome}>
              <Text style={styles.backLinkText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>

          {logs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No verifications executed yet.</Text>
            </View>
          ) : (
            logs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logName}>
                    {log.personnelName || 'UNKNOWN FACE'}
                  </Text>
                  <View style={[
                    styles.logBadge,
                    log.status === 'SUCCESS' ? styles.successBadge :
                    log.status === 'FAILED_LIVENESS' ? styles.failedLivenessBadge : styles.unknownBadge
                  ]}>
                    <Text style={styles.logBadgeText}>{log.status}</Text>
                  </View>
                </View>
                {log.employeeId && (
                  <Text style={styles.logMeta}>Employee ID: {log.employeeId}</Text>
                )}
                <Text style={styles.logTime}>
                  Time: {new Date(log.timestamp).toLocaleString()}
                </Text>
                <View style={styles.livenessSpecs}>
                  <Text style={styles.specText}>
                    Blink: {log.livenessBlink ? '✓ Verified' : '✕ Failed'}
                  </Text>
                  <Text style={styles.specText}>
                    Head Turn: {log.livenessHeadTurn ? '✓ Verified' : '✕ Failed'}
                  </Text>
                  {log.confidence > 0 && (
                    <Text style={styles.specText}>
                      Confidence: {(log.confidence * 100).toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* VERIFICATION RESULT MODAL */}
      <Modal
        visible={showResultModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.resultCard,
            verifyResult?.status === 'SUCCESS' ? styles.successResultCard :
            verifyResult?.status === 'FAILED_LIVENESS' ? styles.failedResultCard : styles.unknownResultCard
          ]}>
            <Text style={styles.modalTitle}>
              {verifyResult?.status === 'SUCCESS' ? '✓ ACCESS GRANTED' :
               verifyResult?.status === 'FAILED_LIVENESS' ? '✕ LIVENESS DETECTED FAIL' : '✕ ACCESS DENIED'}
            </Text>

            {verifyResult?.status === 'SUCCESS' && verifyResult.match && (
              <View style={styles.resultDetails}>
                <Text style={styles.resultName}>{verifyResult.match.name}</Text>
                <Text style={styles.resultInfo}>Employee ID: {verifyResult.match.employeeId}</Text>
                <Text style={styles.resultInfo}>Department: {verifyResult.match.department}</Text>
                <Text style={styles.resultScore}>
                  Confidence: {(verifyResult.confidence * 100).toFixed(1)}%
                </Text>
              </View>
            )}

            {verifyResult?.status === 'FAILED_LIVENESS' && (
              <View style={styles.resultDetails}>
                <Text style={styles.resultWarning}>
                  Security System flagged spoofing activity. Liveness coordinates did not match blink/head-turn specifications.
                </Text>
              </View>
            )}

            {verifyResult?.status === 'UNKNOWN_FACE' && (
              <View style={styles.resultDetails}>
                <Text style={styles.resultWarning}>
                  No matching record exists in the local offline datastore. Check alignment or register personnel.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setShowResultModal(false);
                goHome();
              }}
            >
              <Text style={styles.modalCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Premium Slate Dark
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
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
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
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981', // Neon emerald
    marginRight: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#334155',
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
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  alertText: {
    color: '#F59E0B',
  },
  actionContainer: {
    marginBottom: 26,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  secondaryButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  secondaryButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  backLink: {
    paddingVertical: 4,
  },
  backLinkText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  personnelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
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
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
  },
  cameraWrapper: {
    height: 250,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  cameraPlaceholderText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
  },
  reCaptureButton: {
    marginTop: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  reCaptureButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  cameraInstructions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  cameraInstructionsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  navButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  submitButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  verifyContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullscreenCamera: {
    flex: 1,
  },
  livenessOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  instructionBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  instructionText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  scannerRing: {
    width: width * 0.70,
    height: width * 0.70,
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: (width * 0.70) / 2,
    alignSelf: 'center',
    borderStyle: 'dashed',
    opacity: 0.6,
  },
  checklistCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
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
    fontSize: 9,
    fontWeight: '900',
  },
  checkText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  exitVerifyButton: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'center',
    width: '60%',
  },
  exitVerifyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  logCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  successBadge: {
    backgroundColor: '#064E3B',
  },
  failedLivenessBadge: {
    backgroundColor: '#7F1D1D',
  },
  unknownBadge: {
    backgroundColor: '#78350F',
  },
  logBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  logMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
  logTime: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  livenessSpecs: {
    flexDirection: 'row',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  specText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultCard: {
    width: '85%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
  },
  successResultCard: {
    borderColor: '#10B981',
  },
  failedResultCard: {
    borderColor: '#EF4444',
  },
  unknownResultCard: {
    borderColor: '#F59E0B',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  resultDetails: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  resultInfo: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  resultScore: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  resultWarning: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  modalCloseButton: {
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
