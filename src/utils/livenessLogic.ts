export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

// Helper to get 3D Euclidean distance
function getDistance(p1: Landmark, p2: Landmark): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow((p1.z || 0) - (p2.z || 0), 2)
  );
}

/**
 * Calculates Eye Aspect Ratio (EAR) for a single eye.
 */
export function calculateEyeEAR(
  landmarks: Landmark[],
  indices: { outer: number; inner: number; v1Top: number; v1Bot: number; v2Top: number; v2Bot: number }
): number {
  const pOuter = landmarks[indices.outer];
  const pInner = landmarks[indices.inner];
  const pV1Top = landmarks[indices.v1Top];
  const pV1Bot = landmarks[indices.v1Bot];
  const pV2Top = landmarks[indices.v2Top];
  const pV2Bot = landmarks[indices.v2Bot];

  if (!pOuter || !pInner || !pV1Top || !pV1Bot || !pV2Top || !pV2Bot) {
    return 0.30;
  }

  const vertical1 = getDistance(pV1Top, pV1Bot);
  const vertical2 = getDistance(pV2Top, pV2Bot);
  const horizontal = getDistance(pOuter, pInner);

  if (horizontal === 0) return 0.0;

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Calculates average EAR across both eyes using specific landmarks:
 * Left Eye: 33, 160, 158, 133, 153, 144
 * Right Eye: 362, 385, 387, 263, 373, 380
 */
export function calculateAverageEAR(landmarks: Landmark[]): number {
  if (!landmarks || landmarks.length < 468) {
    return 0.30;
  }

  const leftEAR = calculateEyeEAR(landmarks, {
    outer: 33,
    inner: 133,
    v1Top: 160,
    v1Bot: 144,
    v2Top: 158,
    v2Bot: 153,
  });

  const rightEAR = calculateEyeEAR(landmarks, {
    outer: 263,
    inner: 362,
    v1Top: 385,
    v1Bot: 380,
    v2Top: 387,
    v2Bot: 373,
  });

  return (leftEAR + rightEAR) / 2.0;
}

/**
 * Calculates head turn horizontal ratio (shift as a percentage of face width)
 * Nose Tip: Landmark 1
 * Left Cheek boundary: Landmark 234
 * Right Cheek boundary: Landmark 454
 */
export function calculateHeadTurnRatio(landmarks: Landmark[]): number {
  if (!landmarks || landmarks.length < 468) {
    return 0.0;
  }

  const noseTip = landmarks[1];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];

  if (!noseTip || !leftCheek || !rightCheek) {
    return 0.0;
  }

  // Face Width: horizontal distance between cheeks
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
  if (faceWidth === 0) return 0.0;

  // Face Center X: midpoint between left and right cheeks
  const faceCenterX = (leftCheek.x + rightCheek.x) / 2;

  // Horizontal Shift: offset from nose tip to face center
  const horizontalShift = noseTip.x - faceCenterX;

  // Shift ratio relative to face width
  return Math.abs(horizontalShift) / faceWidth;
}

/**
 * Legacy head turn yaw ratio calculator, preserved to maintain existing unit tests.
 */
export function calculateHeadYawRatio(landmarks: Landmark[]): number {
  const nose = landmarks[4];
  const left = landmarks[234];
  const right = landmarks[454];

  if (!nose || !left || !right) {
    return 0.50;
  }

  const distLeft = Math.abs(nose.x - left.x);
  const distRight = Math.abs(nose.x - right.x);
  const total = distLeft + distRight;

  if (total === 0) return 0.50;

  return distLeft / total;
}
