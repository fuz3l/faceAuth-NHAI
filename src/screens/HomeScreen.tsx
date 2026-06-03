import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Path } from 'react-native-svg';
import { getRegisteredUsersCount, initDatabase } from '../database/storage';

type RootStackParamList = {
  Home: undefined;
  Camera: { mode: 'ENROL' | 'VERIFY'; name?: string; empId?: string; dept?: string };
  Register: undefined;
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    if (isFocused) {
      try {
        initDatabase();
        const count = getRegisteredUsersCount();
        setUserCount(count);
      } catch (error) {
        console.warn('Failed to load user count on Home:', error);
      }
    }
  }, [isFocused]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Branding Section */}
        <View style={styles.headerSection}>
          <Text style={styles.appTitle}>DatalakeFaceAuth</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.govtText}>National Highways Authority of India</Text>
            <View style={styles.mapBadge}>
              <Text style={styles.mapBadgeText}>📍 Gateway Node 01</Text>
            </View>
          </View>
        </View>

        {/* Status Tab / Pills Row (Inspired by Total Defects tab buttons) */}
        <View style={styles.pillsRow}>
          <View style={[styles.pill, styles.pillActive]}>
            <Text style={styles.pillActiveText}>Active Users {userCount}</Text>
          </View>
          <View style={[styles.pill, styles.pillOutline]}>
            <Text style={styles.pillOutlineText}>Secure Offline Mode</Text>
          </View>
        </View>

        {/* Action Panel Container (Inspired by Help topics list card) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Biometric Actions</Text>
          
          <View style={styles.listCard}>
            {/* Action 1: Authenticate Face */}
            <TouchableOpacity
              style={[styles.listItem, styles.listDivider]}
              onPress={() => navigation.navigate('Camera', { mode: 'VERIFY' })}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.iconCircle, styles.primaryIconBg]}>
                  <Text style={styles.itemIcon}>🛡️</Text>
                </View>
                <Text style={styles.itemLabel}>Authenticate</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            {/* Action 2: Register New User */}
            <TouchableOpacity
              style={styles.listItem}
              onPress={() => navigation.navigate('Register')}
            >
              <View style={styles.listItemLeft}>
                <View style={[styles.iconCircle, styles.secondaryIconBg]}>
                  <Text style={styles.itemIcon}>📝</Text>
                </View>
                <Text style={styles.itemLabel}>Register New User</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Help / Secondary Actions Row (Inspired by Ask us / Mail us cards) */}
        <View style={styles.helpRow}>
          <TouchableOpacity style={styles.helpCard}>
            <Text style={styles.helpCardIcon}>❓</Text>
            <Text style={styles.helpCardText}>Ask Info</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.helpCard}>
            <Text style={styles.helpCardIcon}>⚙️</Text>
            <Text style={styles.helpCardText}>Diagnostics</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Official Government style footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>NHAI SECURE TERMINAL GATEWAY V1.0</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Light background
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 30,
  },
  headerSection: {
    marginBottom: 20,
  },
  appTitle: {
    color: '#0F172A', // Slate black
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  govtText: {
    color: '#64748B', // Steel grey
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  mapBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  mapBadgeText: {
    color: '#134074',
    fontSize: 10,
    fontWeight: '800',
  },
  pillsRow: {
    flexDirection: 'row',
    marginBottom: 26,
  },
  pill: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: '#0A2545', // Deep Navy Active
  },
  pillActiveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  pillOutline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  pillOutlineText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    color: '#1A1C1E',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  listDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  primaryIconBg: {
    backgroundColor: '#EEF2F6',
  },
  secondaryIconBg: {
    backgroundColor: '#F5F5F7',
  },
  itemIcon: {
    fontSize: 18,
  },
  itemLabel: {
    color: '#0F172A',
    fontSize: 14.5,
    fontWeight: '700',
  },
  chevron: {
    color: '#CBD5E1',
    fontSize: 22,
    fontWeight: '600',
  },
  helpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  helpCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1.5,
  },
  helpCardIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  helpCardText: {
    color: '#0F172A',
    fontSize: 12.5,
    fontWeight: '800',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});

export default HomeScreen;
