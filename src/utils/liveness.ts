export interface Landmark {
  x: number;
  y: number;
  z: number;
}

// MediaPipe Face Mesh indices for EAR
// Left Eye:
// - Horizontal: 263 (outer), 362 (inner)
// - Vertical pairs: (385, 380), (387, 373)
// Right Eye:
// - Horizontal: 33 (outer), 133 (inner)
// - Vertical pairs: (160, 144), (158, 153)
export const LEFT_EYE_INDICES = {
  outer: 263,
  inner: 362,
  v1Top: 385,
  v1Bot: 380,
  v2Top: 387,
  v2Bot: 373,
};

export const RIGHT_EYE_INDICES = {
  outer: 33,
  inner: 133,
  v1Top: 160,
  v1Bot: 144,
  v2Top: 158,
  v2Bot: 153,
};

// Landmarks for head turn (yaw estimation)
// Nose tip: 4
// Left cheek boundary: 234
// Right cheek boundary: 454
export const HEAD_TURN_INDICES = {
  noseTip: 4,
  leftCheek: 234,
  rightCheek: 454,
};

/**
 * Calculates the Euclidean distance between two 3D landmarks.
 */
function getDistance(p1: Landmark, p2: Landmark): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2)
  );
}

/**
 * Calculates the Eye Aspect Ratio (EAR) for a single eye.
 */
export function calculateEyeEAR(
  landmarks: Landmark[],
  indices: typeof LEFT_EYE_INDICES | typeof RIGHT_EYE_INDICES
): number {
  const pOuter = landmarks[indices.outer];
  const pInner = landmarks[indices.inner];
  const pV1Top = landmarks[indices.v1Top];
  const pV1Bot = landmarks[indices.v1Bot];
  const pV2Top = landmarks[indices.v2Top];
  const pV2Bot = landmarks[indices.v2Bot];

  if (!pOuter || !pInner || !pV1Top || !pV1Bot || !pV2Top || !pV2Bot) {
    return 0.3; // Default open state if missing
  }

  const vertical1 = getDistance(pV1Top, pV1Bot);
  const vertical2 = getDistance(pV2Top, pV2Bot);
  const horizontal = getDistance(pOuter, pInner);

  if (horizontal === 0) return 0.0;

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Calculates the average EAR of both eyes.
 */
export function calculateAverageEAR(landmarks: Landmark[]): number {
  const leftEAR = calculateEyeEAR(landmarks, LEFT_EYE_INDICES);
  const rightEAR = calculateEyeEAR(landmarks, RIGHT_EYE_INDICES);
  return (leftEAR + rightEAR) / 2.0;
}

/**
 * Estimates head turn (yaw ratio) based on the position of the nose tip
 * relative to the outer bounds of the face mesh.
 * 
 * @returns Ratio: ~0.5 means center, < 0.35 means turned left, > 0.65 means turned right
 */
export function calculateHeadYawRatio(landmarks: Landmark[]): number {
  const nose = landmarks[HEAD_TURN_INDICES.noseTip];
  const left = landmarks[HEAD_TURN_INDICES.leftCheek];
  const right = landmarks[HEAD_TURN_INDICES.rightCheek];

  if (!nose || !left || !right) {
    return 0.5; // Default center
  }

  // We use the 2D X-coordinates for horizontal yaw estimation
  const distLeft = Math.abs(nose.x - left.x);
  const distRight = Math.abs(nose.x - right.x);
  const totalDist = distLeft + distRight;

  if (totalDist === 0) return 0.5;

  return distLeft / totalDist;
}

export type LivenessStep = 'LOOK_CENTER' | 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'COMPLETED';

export interface LivenessState {
  currentStep: LivenessStep;
  centerCalibrated: boolean;
  blinkDetected: boolean;
  leftTurnDetected: boolean;
  rightTurnDetected: boolean;
}

/**
 * Checks if a liveness gesture is satisfied given the current landmarks.
 * This function handles step-by-step state transitions.
 * 
 * @param landmarks FaceMesh landmarks
 * @param state Current liveness checklist state
 * @returns Updated liveness checklist state
 */
export function processLivenessFrame(
  landmarks: Landmark[],
  state: LivenessState,
  earThreshold = 0.20,
  yawLeftThreshold = 0.35,
  yawRightThreshold = 0.65
): LivenessState {
  const newState = { ...state };
  const ear = calculateAverageEAR(landmarks);
  const yawRatio = calculateHeadYawRatio(landmarks);

  switch (state.currentStep) {
    case 'LOOK_CENTER':
      // Ensure face is centered
      if (yawRatio >= 0.40 && yawRatio <= 0.60 && ear >= 0.25) {
        newState.centerCalibrated = true;
        newState.currentStep = 'BLINK';
      }
      break;

    case 'BLINK':
      // Detect a blink: EAR drops below threshold
      if (ear < earThreshold) {
        newState.blinkDetected = true;
      }
      // Advance to next step once they open their eyes again
      if (newState.blinkDetected && ear >= 0.24) {
        newState.currentStep = 'TURN_LEFT';
      }
      break;

    case 'TURN_LEFT':
      // Detect left turn: nose closer to left boundary
      if (yawRatio < yawLeftThreshold) {
        newState.leftTurnDetected = true;
        newState.currentStep = 'TURN_RIGHT';
      }
      break;

    case 'TURN_RIGHT':
      // Detect right turn: nose closer to right boundary
      if (yawRatio > yawRightThreshold) {
        newState.rightTurnDetected = true;
        newState.currentStep = 'COMPLETED';
      }
      break;

    case 'COMPLETED':
    default:
      break;
  }

  return newState;
}
