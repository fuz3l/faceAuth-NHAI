/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

// Mock native gesture handler module
jest.mock('react-native-gesture-handler', () => {
  return {
    GestureHandlerRootView: jest.fn(({ children }) => children),
  };
});

// Mock @react-navigation/stack
jest.mock('@react-navigation/stack', () => {
  const React = require('react');
  return {
    createStackNavigator: () => ({
      Navigator: jest.fn(({ children }) => React.createElement('Navigator', null, children)),
      Screen: jest.fn(({ children }) => React.createElement('Screen', null, children)),
    }),
  };
});

// Mock react-native-screens
jest.mock('react-native-screens', () => {
  return {
    enableScreens: jest.fn(),
  };
});

// Mock react-native-quick-sqlite
jest.mock('react-native-quick-sqlite', () => {
  return {
    open: jest.fn(() => ({
      execute: jest.fn(() => ({
        rows: {
          length: 0,
          item: () => null,
        },
      })),
    })),
  };
});

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => {
  return {
    fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
    addEventListener: jest.fn(),
  };
});

jest.mock('react-native-vision-camera', () => {
  return {
    Camera: {
      requestCameraPermission: jest.fn(() => Promise.resolve('granted')),
      getCameraPermissionStatus: jest.fn(() => Promise.resolve('granted')),
    },
    useCameraDevice: jest.fn(() => ({})),
    useFrameProcessor: jest.fn(() => jest.fn()),
  };
});

jest.mock('react-native-worklets-core', () => {
  return {
    useRunOnJS: jest.fn((fn) => fn),
    Worklets: {
      createRunOnJS: jest.fn((fn) => fn),
    },
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: jest.fn(({ children }) => React.createElement('Svg', null, children)),
    Rect: jest.fn(() => React.createElement('Rect', null)),
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const SafeAreaContext = React.createContext(inset);
  return {
    __esModule: true,
    SafeAreaContext,
    SafeAreaProvider: jest.fn(({ children }) => children),
    SafeAreaView: jest.fn(({ children }) => children),
    SafeAreaConsumer: SafeAreaContext.Consumer,
    useSafeAreaInsets: jest.fn(() => inset),
  };
});

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
