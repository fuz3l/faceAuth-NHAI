import React from 'react';
import { requireNativeComponent, ViewStyle, NativeSyntheticEvent } from 'react-native';

export interface FaceProcessedEvent {
  embedding: number[];
  livenessSuccess: boolean;
}

export interface LivenessUpdateEvent {
  step: 'LOOK_CENTER' | 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'COMPLETED';
  ear: number;
  yaw: number;
  blink: boolean;
  turnLeft: boolean;
  turnRight: boolean;
}

export interface StatusMessageEvent {
  message: string;
}

interface FaceCameraNativeProps {
  style?: ViewStyle;
  onFaceProcessed?: (event: NativeSyntheticEvent<FaceProcessedEvent>) => void;
  onLivenessUpdate?: (event: NativeSyntheticEvent<LivenessUpdateEvent>) => void;
  onStatusMessage?: (event: NativeSyntheticEvent<StatusMessageEvent>) => void;
}

// Require the native component bridged from Kotlin/Swift
const NativeFaceCaptureView = requireNativeComponent<FaceCameraNativeProps>('FaceCaptureView');

interface FaceCameraProps {
  style?: ViewStyle;
  onFaceProcessed?: (data: FaceProcessedEvent) => void;
  onLivenessUpdate?: (data: LivenessUpdateEvent) => void;
  onStatusMessage?: (message: string) => void;
}

export const FaceCamera: React.FC<FaceCameraProps> = ({
  style,
  onFaceProcessed,
  onLivenessUpdate,
  onStatusMessage,
}) => {
  const handleFaceProcessed = (event: NativeSyntheticEvent<FaceProcessedEvent>) => {
    if (onFaceProcessed) {
      onFaceProcessed(event.nativeEvent);
    }
  };

  const handleLivenessUpdate = (event: NativeSyntheticEvent<LivenessUpdateEvent>) => {
    if (onLivenessUpdate) {
      onLivenessUpdate(event.nativeEvent);
    }
  };

  const handleStatusMessage = (event: NativeSyntheticEvent<StatusMessageEvent>) => {
    if (onStatusMessage) {
      onStatusMessage(event.nativeEvent.message);
    }
  };

  return (
    <NativeFaceCaptureView
      style={style}
      onFaceProcessed={handleFaceProcessed}
      onLivenessUpdate={handleLivenessUpdate}
      onStatusMessage={handleStatusMessage}
    />
  );
};
export default FaceCamera;
