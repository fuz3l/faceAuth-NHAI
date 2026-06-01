import { calculateCosineSimilarity, findBestMatch, GalleryItem } from '../src/utils/faceMatch';
import { calculateAverageEAR, calculateHeadYawRatio, Landmark } from '../src/utils/livenessLogic';

describe('Face Embedding Matching (Cosine Similarity)', () => {
  it('should return 1.0 for identical vectors', () => {
    const vec = Array(128).fill(0).map(() => Math.random());
    const similarity = calculateCosineSimilarity(vec, vec);
    expect(similarity).toBeCloseTo(1.0, 5);
  });

  it('should return -1.0 for opposite vectors', () => {
    const vecA = [1.0, 0.0, -1.0];
    const vecB = [-1.0, 0.0, 1.0];
    const similarity = calculateCosineSimilarity(vecA, vecB);
    expect(similarity).toBeCloseTo(-1.0, 5);
  });

  it('should find the best matching personnel in the gallery', () => {
    const probe = [0.5, 0.5, 0.0];
    const gallery: GalleryItem[] = [
      { id: '1', name: 'Alice', employeeId: 'A01', department: 'IT', embedding: [0.5, 0.48, 0.0] },
      { id: '2', name: 'Bob', employeeId: 'B02', department: 'HR', embedding: [-0.5, 0.5, 0.0] }
    ];

    const result = findBestMatch(probe, gallery, 0.90);
    expect(result).not.toBeNull();
    expect(result?.personnel.name).toBe('Alice');
    expect(result?.similarity).toBeGreaterThan(0.95);
  });

  it('should return null if no matching personnel is above threshold', () => {
    const probe = [0.5, 0.5, 0.0];
    const gallery: GalleryItem[] = [
      { id: '1', name: 'Bob', employeeId: 'B02', department: 'HR', embedding: [-0.5, 0.5, 0.0] }
    ];

    const result = findBestMatch(probe, gallery, 0.80);
    expect(result).toBeNull();
  });
});

describe('Liveness Heuristics (EAR & Yaw)', () => {
  // Generate dummy landmarks array of size 468
  const createMockLandmarks = (): Landmark[] => {
    return Array(468).fill(null).map(() => ({ x: 0.0, y: 0.0, z: 0.0 }));
  };

  it('should calculate Eye Aspect Ratio (EAR) correctly', () => {
    const landmarks = createMockLandmarks();
    
    // Left eye landmarks: 263 (outer), 362 (inner), 385, 380, 387, 373
    landmarks[263] = { x: 2.0, y: 0.0, z: 0.0 }; // Outer
    landmarks[362] = { x: 0.0, y: 0.0, z: 0.0 }; // Inner (width = 2.0)
    
    // Verticals pairs: (385, 380) and (387, 373)
    landmarks[385] = { x: 1.0, y: 0.5, z: 0.0 };
    landmarks[380] = { x: 1.0, y: -0.5, z: 0.0 }; // vert1 = 1.0
    
    landmarks[387] = { x: 1.0, y: 0.5, z: 0.0 };
    landmarks[373] = { x: 1.0, y: -0.5, z: 0.0 }; // vert2 = 1.0

    // Right Eye same configuration
    landmarks[33] = { x: 2.0, y: 0.0, z: 0.0 };
    landmarks[133] = { x: 0.0, y: 0.0, z: 0.0 };
    landmarks[160] = { x: 1.0, y: 0.5, z: 0.0 };
    landmarks[144] = { x: 1.0, y: -0.5, z: 0.0 };
    landmarks[158] = { x: 1.0, y: 0.5, z: 0.0 };
    landmarks[153] = { x: 1.0, y: -0.5, z: 0.0 };

    // EAR should be (1.0 + 1.0) / (2.0 * 2.0) = 2.0 / 4.0 = 0.50
    const ear = calculateAverageEAR(landmarks);
    expect(ear).toBeCloseTo(0.50, 5);
  });

  it('should calculate Head Turn Yaw Ratio correctly', () => {
    const landmarks = createMockLandmarks();
    
    // Nose tip: 4
    // Left cheek: 234, Right cheek: 454
    // Case 1: Centered nose
    landmarks[4] = { x: 0.0, y: 0.0, z: 0.0 };
    landmarks[234] = { x: -10.0, y: 0.0, z: 0.0 };
    landmarks[454] = { x: 10.0, y: 0.0, z: 0.0 };
    // Yaw ratio should be |0 - (-10)| / (10 + 10) = 10 / 20 = 0.50
    let yaw = calculateHeadYawRatio(landmarks);
    expect(yaw).toBeCloseTo(0.50, 5);

    // Case 2: Turned left (nose shifts left, closer to left cheek)
    landmarks[4] = { x: -5.0, y: 0.0, z: 0.0 };
    // distLeft = |-5 - (-10)| = 5
    // distRight = |-5 - 10| = 15
    // Yaw ratio = 5 / (5 + 15) = 5 / 20 = 0.25
    yaw = calculateHeadYawRatio(landmarks);
    expect(yaw).toBe(0.25);
  });
});
