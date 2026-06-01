export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

// Landmark Indices
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

export const HEAD_TURN_INDICES = {
  noseTip: 4,
  leftCheek: 234,
  rightCheek: 454,
};

function getDistance(p1: Landmark, p2: Landmark): number {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow((p1.z || 0) - (p2.z || 0), 2)
  );
}

/**
 * Calculates EAR for one eye.
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
    return 0.30;
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
 * Estimates head turn (yaw ratio) based on the nose tip
 * position relative to cheek boundaries.
 * 
 * @returns ~0.50 is centered, < 0.35 is turned left, > 0.65 is turned right
 */
export function calculateHeadYawRatio(landmarks: Landmark[]): number {
  const nose = landmarks[HEAD_TURN_INDICES.noseTip];
  const left = landmarks[HEAD_TURN_INDICES.leftCheek];
  const right = landmarks[HEAD_TURN_INDICES.rightCheek];

  if (!nose || !left || !right) {
    return 0.50;
  }

  const distLeft = Math.abs(nose.x - left.x);
  const distRight = Math.abs(nose.x - right.x);
  const total = distLeft + distRight;

  if (total === 0) return 0.50;

  return distLeft / total;
}
