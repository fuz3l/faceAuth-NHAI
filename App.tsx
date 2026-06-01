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

export type RootStackParamList = {
  Home: undefined;
  Camera: { mode: 'ENROL' | 'VERIFY'; name?: string; empId?: string; dept?: string };
  Result: { status: 'SUCCESS' | 'FAILED_LIVENESS' | 'UNKNOWN_FACE'; matchDetail?: any; confidence?: number };
};

const Stack = createStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#0F172A',
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 1,
              borderBottomColor: '#1E293B',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: '800',
              fontSize: 14,
              letterSpacing: 0.5,
            },
            cardStyle: { backgroundColor: '#0F172A' },
          }}
        >
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'OFFLINE TERMINAL' }}
          />
          <Stack.Screen
            name="Camera"
            component={CameraScreen}
            options={{ title: 'BIOMETRIC SCAN' }}
          />
          <Stack.Screen
            name="Result"
            component={ResultScreen}
            options={{ title: 'SCAN SUMMARY', headerLeft: () => null }} // Disable back button in Result
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
