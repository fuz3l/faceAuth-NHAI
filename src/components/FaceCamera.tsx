import { requireNativeComponent, ViewStyle } from 'react-native';

export interface FaceProcessedEvent {
  nativeEvent: {
    embedding: number[];
    livenessSuccess: boolean;
  };
}

export interface LivenessUpdateEvent {
  nativeEvent: {
    step: string;
    ear: number;
    yaw: number;
    blink: boolean;
    turnLeft: boolean;
    turnRight: boolean;
  };
}

export interface StatusMessageEvent {
  nativeEvent: {
    message: string;
  };
}

interface FaceCameraProps {
  style?: ViewStyle;
  onFaceProcessed?: (event: FaceProcessedEvent) => void;
  onLivenessUpdate?: (event: LivenessUpdateEvent) => void;
  onStatusMessage?: (event: StatusMessageEvent) => void;
}

export const FaceCamera = requireNativeComponent<FaceCameraProps>('FaceCaptureView');

export default FaceCamera;
