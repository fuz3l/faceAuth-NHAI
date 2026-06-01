/**
 * Calculates the cosine similarity between two 128-dimensional face embedding vectors.
 * Cosine similarity measures the cosine of the angle between two non-zero vectors of an inner product space.
 * It is calculated as: (A . B) / (||A|| * ||B||)
 * 
 * @param vecA First 128-dimensional float array
 * @param vecB Second 128-dimensional float array
 * @returns Similarity score between -1.0 and 1.0 (where 1.0 is identical)
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    throw new Error('Embeddings must be of the same non-zero length (expected 128 dimensions).');
  }

  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0.0; // Avoid division by zero
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compares a probe face embedding against a list of enrolled gallery embeddings
 * and returns the best match above a specified threshold.
 * 
 * @param probeEmbedding The 128D embedding of the face being verified
 * @param gallery An array of enrolled records, each containing an ID and its 128D embedding
 * @param threshold The confidence threshold (default is 0.80 for MobileFaceNet)
 * @returns The best matching record with its confidence score, or null if no match exceeds threshold
 */
export interface GalleryItem {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  embedding: number[];
}

export interface MatchResult {
  personnel: GalleryItem;
  similarity: number;
}

export function findBestMatch(
  probeEmbedding: number[],
  gallery: GalleryItem[],
  threshold = 0.80
): MatchResult | null {
  let bestMatch: GalleryItem | null = null;
  let highestSimilarity = -1.0;

  for (const item of gallery) {
    try {
      const similarity = calculateCosineSimilarity(probeEmbedding, item.embedding);
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = item;
      }
    } catch (e) {
      console.warn(`Error comparing with personnel ${item.id}:`, e);
    }
  }

  if (bestMatch && highestSimilarity >= threshold) {
    return {
      personnel: bestMatch,
      similarity: highestSimilarity,
    };
  }

  return null;
}
