import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import Screens
import HomeScreen from './src/screens/HomeScreen';
import CameraScreen from './src/screens/CameraScreen';
import ResultScreen from './src/screens/ResultScreen';
import RegisterScreen from './src/screens/RegisterScreen';

export type RootStackParamList = {
  Home: undefined;
  Camera: { mode: 'ENROL' | 'VERIFY'; name?: string; empId?: string; dept?: string };
  Result: { 
    status: 'SUCCESS' | 'FAILED_LIVENESS' | 'UNKNOWN_FACE'; 
    matchDetail?: { id: string; name: string; timestamp?: string }; 
    confidence?: number;
    timestamp?: string; 
  };
  Register: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#FFFFFF', // Clean White Header
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 1,
              borderBottomColor: '#E2E8F0', // Thin light-grey divider
            },
            headerTintColor: '#0A2545', // Deep navy for back button/text
            headerTitleStyle: {
              fontWeight: '800',
              fontSize: 15,
              color: '#0F172A', // Slate black title
              letterSpacing: 0.5,
            },
            cardStyle: { backgroundColor: '#F8FAFC' }, // Light grey content background
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'NHAI BIOMETRIC GATEWAY' }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'OFFICER REGISTRATION' }}
          />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{ title: 'SECURE SCANNER' }}
          />
          <Stack.Screen
            name="Result"
            component={ResultScreen}
            options={{ title: 'VERIFICATION RESULT', headerLeft: () => null }} // Disable back button in Result
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
