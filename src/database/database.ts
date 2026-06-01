import SQLite from 'react-native-sqlite-storage';
import { GalleryItem, findBestMatch } from '../utils/matching';

SQLite.enablePromise(true);

const DATABASE_NAME = 'DatalakeFaceAuth.db';

export interface ScanLog {
  id: string;
  personnelId: string | null;
  personnelName?: string;
  employeeId?: string;
  timestamp: string;
  confidence: number;
  status: 'SUCCESS' | 'FAILED_LIVENESS' | 'UNKNOWN_FACE';
  livenessBlink: boolean;
  livenessHeadTurn: boolean;
  syncStatus: 'PENDING' | 'SYNCED';
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Gets or opens the database connection.
 */
export async function getDBConnection(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  const db = await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default',
  });
  dbInstance = db;
  return db;
}

/**
 * Initializes tables in SQLite.
 */
export async function initDatabase(): Promise<void> {
  const db = await getDBConnection();
  
  // Enable foreign keys
  await db.executeSql('PRAGMA foreign_keys = ON;');

  // Create Personnel table
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS personnel (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      employee_id TEXT UNIQUE NOT NULL,
      department TEXT,
      face_embedding TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'PENDING'
    );
  `);

  // Create Scan Logs table
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS scan_logs (
      id TEXT PRIMARY KEY,
      personnel_id TEXT,
      timestamp TEXT NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL,
      liveness_blink INTEGER NOT NULL DEFAULT 0,
      liveness_head_turn INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT DEFAULT 'PENDING',
      FOREIGN KEY(personnel_id) REFERENCES personnel(id) ON DELETE SET NULL
    );
  `);

  console.log('SQLite Database initialized successfully.');
}

/**
 * Enrolls a new personnel member.
 */
export async function enrollPersonnel(
  name: string,
  employeeId: string,
  department: string,
  embedding: number[]
): Promise<string> {
  const db = await getDBConnection();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); // UUID fallback
  const createdAt = new Date().toISOString();
  const embeddingStr = JSON.stringify(embedding);

  await db.executeSql(
    `INSERT INTO personnel (id, name, employee_id, department, face_embedding, created_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING');`,
    [id, name, employeeId, department, embeddingStr, createdAt]
  );

  return id;
}

/**
 * Deletes personnel member.
 */
export async function deletePersonnel(id: string): Promise<void> {
  const db = await getDBConnection();
  await db.executeSql('DELETE FROM personnel WHERE id = ?;', [id]);
}

/**
 * Returns all enrolled personnel.
 */
export async function getAllPersonnel(): Promise<GalleryItem[]> {
  const db = await getDBConnection();
  const results = await db.executeSql('SELECT id, name, employee_id, department, face_embedding FROM personnel;');
  const list: GalleryItem[] = [];

  const len = results[0].rows.length;
  for (let i = 0; i < len; i++) {
    const row = results[0].rows.item(i);
    try {
      list.push({
        id: row.id,
        name: row.name,
        employeeId: row.employee_id,
        department: row.department,
        embedding: JSON.parse(row.face_embedding),
      });
    } catch (e) {
      console.error(`Failed to parse embedding for personnel ${row.id}`, e);
    }
  }
  return list;
}

/**
 * Logs a verification attempt.
 */
export async function saveScanLog(
  personnelId: string | null,
  confidence: number,
  status: ScanLog['status'],
  livenessBlink: boolean,
  livenessHeadTurn: boolean
): Promise<string> {
  const db = await getDBConnection();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();

  await db.executeSql(
    `INSERT INTO scan_logs (id, personnel_id, timestamp, confidence, status, liveness_blink, liveness_head_turn, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING');`,
    [
      id,
      personnelId,
      timestamp,
      confidence,
      status,
      livenessBlink ? 1 : 0,
      livenessHeadTurn ? 1 : 0,
    ]
  );

  return id;
}

/**
 * Performs a 1:N face match offline.
 * Queries all gallery items, compares embeddings, and saves the scan log automatically.
 */
export async function matchFaceOffline(
  probeEmbedding: number[],
  livenessBlink: boolean,
  livenessHeadTurn: boolean,
  threshold = 0.80
): Promise<{ match: GalleryItem | null; confidence: number; status: ScanLog['status'] }> {
  // If liveness fails, log it immediately and do not match
  if (!livenessBlink || !livenessHeadTurn) {
    await saveScanLog(null, 0.0, 'FAILED_LIVENESS', livenessBlink, livenessHeadTurn);
    return { match: null, confidence: 0.0, status: 'FAILED_LIVENESS' };
  }

  const gallery = await getAllPersonnel();
  const matchResult = findBestMatch(probeEmbedding, gallery, threshold);

  if (matchResult) {
    await saveScanLog(
      matchResult.personnel.id,
      matchResult.similarity,
      'SUCCESS',
      livenessBlink,
      livenessHeadTurn
    );
    return {
      match: matchResult.personnel,
      confidence: matchResult.similarity,
      status: 'SUCCESS',
    };
  } else {
    await saveScanLog(null, 0.0, 'UNKNOWN_FACE', livenessBlink, livenessHeadTurn);
    return {
      match: null,
      confidence: 0.0,
      status: 'UNKNOWN_FACE',
    };
  }
}

/**
 * Retrieves the verification log history, joined with personnel data.
 */
export async function getScanLogsHistory(): Promise<ScanLog[]> {
  const db = await getDBConnection();
  const results = await db.executeSql(`
    SELECT l.id, l.personnel_id, l.timestamp, l.confidence, l.status, 
           l.liveness_blink, l.liveness_head_turn, l.sync_status,
           p.name as personnel_name, p.employee_id
    FROM scan_logs l
    LEFT JOIN personnel p ON l.personnel_id = p.id
    ORDER BY l.timestamp DESC
    LIMIT 100;
  `);

  const list: ScanLog[] = [];
  const len = results[0].rows.length;
  for (let i = 0; i < len; i++) {
    const row = results[0].rows.item(i);
    list.push({
      id: row.id,
      personnelId: row.personnel_id,
      personnelName: row.personnel_name || undefined,
      employeeId: row.employee_id || undefined,
      timestamp: row.timestamp,
      confidence: row.confidence,
      status: row.status as ScanLog['status'],
      livenessBlink: row.liveness_blink === 1,
      livenessHeadTurn: row.liveness_head_turn === 1,
      syncStatus: row.sync_status as ScanLog['syncStatus'],
    });
  }
  return list;
}

/**
 * Returns summary stats for the dashboard.
 */
export async function getDashboardStats(): Promise<{
  totalEnrolled: number;
  totalLogs: number;
  pendingSync: number;
}> {
  const db = await getDBConnection();
  
  const enrolledRes = await db.executeSql('SELECT COUNT(*) as count FROM personnel;');
  const logsRes = await db.executeSql('SELECT COUNT(*) as count FROM scan_logs;');
  
  const pSyncRes = await db.executeSql("SELECT COUNT(*) as count FROM personnel WHERE sync_status = 'PENDING';");
  const lSyncRes = await db.executeSql("SELECT COUNT(*) as count FROM scan_logs WHERE sync_status = 'PENDING';");

  return {
    totalEnrolled: enrolledRes[0].rows.item(0).count,
    totalLogs: logsRes[0].rows.item(0).count,
    pendingSync: pSyncRes[0].rows.item(0).count + lSyncRes[0].rows.item(0).count,
  };
}
