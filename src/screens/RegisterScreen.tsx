import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Home: undefined;
  Camera: { mode: 'ENROL' | 'VERIFY'; name?: string; empId?: string; dept?: string };
  Register: undefined;
};

type RegisterScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Register'>;

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const [name, setName] = useState('');

  const handleNext = () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter the user\'s full name.');
      return;
    }
    Keyboard.dismiss();
    
    navigation.navigate('Camera', {
      mode: 'ENROL',
      name: name.trim(),
    });
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>👤</Text>
          </View>

          <Text style={styles.title}>Register Officer</Text>
          <Text style={styles.subtitle}>
            Enter the officer's full name as it appears on official credentials to initiate facial registration.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Rajesh Kumar"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>Open Camera (Enrolment)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelLink}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.cancelLinkText}>Cancel & Exit</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Light theme background
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF', // Clean White Card
    borderRadius: 16,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0', // Thin border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2F6', // Light slate icon background
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    color: '#0F172A', // Slate black
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#64748B', // Steel grey text
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  label: {
    color: '#0A2545',
    fontSize: 11.5,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0F172A',
    fontSize: 14.5,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#0A2545', // Solid Deep Navy
    borderRadius: 10,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#0A2545',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cancelLink: {
    paddingVertical: 8,
  },
  cancelLinkText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default RegisterScreen;
