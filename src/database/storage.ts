import { open, QuickSQLiteConnection } from 'react-native-quick-sqlite';

let db: QuickSQLiteConnection | null = null;

export interface GalleryItem {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  embedding: number[];
}

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

/**
 * Initializes the SQLite connection and executes schema migrations.
 */
export function initDatabase(): void {
  if (db) return;

  try {
    db = open({ name: 'DatalakeFaceAuthQuick.db' });
    
    // Enable foreign keys
    db.execute('PRAGMA foreign_keys = ON;');

    // Create Personnel table
    db.execute(`
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
    db.execute(`
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

    // Create Users table
    db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        embedding TEXT NOT NULL,
        registeredAt TEXT NOT NULL
      );
    `);

    // Create Attendance table
    db.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        synced INTEGER DEFAULT 0
      );
    `);

    console.log('react-native-quick-sqlite database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize database via quick-sqlite:', error);
    throw error;
  }
}

function getDb(): QuickSQLiteConnection {
  if (!db) {
    initDatabase();
  }
  return db!;
}

/**
 * Enrolls a new personnel member.
 */
export function enrollPersonnel(
  name: string,
  employeeId: string,
  department: string,
  embedding: number[]
): string {
  const database = getDb();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const createdAt = new Date().toISOString();
  const embeddingStr = JSON.stringify(embedding);

  database.execute(
    `INSERT INTO personnel (id, name, employee_id, department, face_embedding, created_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING');`,
    [id, name, employeeId, department, embeddingStr, createdAt]
  );

  return id;
}

/**
 * Deletes a personnel member by ID.
 */
export function deletePersonnel(id: string): void {
  const database = getDb();
  database.execute('DELETE FROM personnel WHERE id = ?;', [id]);
}

/**
 * Retrieves all enrolled personnel from the SQLite database.
 */
export function getAllPersonnel(): GalleryItem[] {
  const database = getDb();
  const result = database.execute('SELECT id, name, employee_id, department, face_embedding FROM personnel;');
  const list: GalleryItem[] = [];

  const rows = result.rows;
  if (rows) {
    const len = rows.length;
    for (let i = 0; i < len; i++) {
      const row = rows.item(i);
      try {
        list.push({
          id: row.id,
          name: row.name,
          employeeId: row.employee_id,
          department: row.department,
          embedding: JSON.parse(row.face_embedding),
        });
      } catch (e) {
        console.error('Failed to parse embedding for', row.id, e);
      }
    }
  }
  return list;
}

/**
 * Logs a face verification scan attempt.
 */
export function saveScanLog(
  personnelId: string | null,
  confidence: number,
  status: ScanLog['status'],
  livenessBlink: boolean,
  livenessHeadTurn: boolean
): string {
  const database = getDb();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();

  database.execute(
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
 * Retrieves the verification log history, joined with personnel data.
 */
export function getScanLogsHistory(): ScanLog[] {
  const database = getDb();
  const result = database.execute(`
    SELECT l.id, l.personnel_id, l.timestamp, l.confidence, l.status, 
           l.liveness_blink, l.liveness_head_turn, l.sync_status,
           p.name as personnel_name, p.employee_id
    FROM scan_logs l
    LEFT JOIN personnel p ON l.personnel_id = p.id
    ORDER BY l.timestamp DESC
    LIMIT 100;
  `);

  const list: ScanLog[] = [];
  const rows = result.rows;
  if (rows) {
    const len = rows.length;
    for (let i = 0; i < len; i++) {
      const row = rows.item(i);
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
  }
  return list;
}

/**
 * Returns dashboard aggregates.
 */
export function getDashboardStats(): {
  totalEnrolled: number;
  totalLogs: number;
  pendingSync: number;
} {
  const database = getDb();
  
  const enrolledRes = database.execute('SELECT COUNT(*) as count FROM personnel;');
  const logsRes = database.execute('SELECT COUNT(*) as count FROM scan_logs;');
  
  const pSyncRes = database.execute("SELECT COUNT(*) as count FROM personnel WHERE sync_status = 'PENDING';");
  const lSyncRes = database.execute("SELECT COUNT(*) as count FROM scan_logs WHERE sync_status = 'PENDING';");

  const totalEnrolled = enrolledRes.rows?.item(0)?.count || 0;
  const totalLogs = logsRes.rows?.item(0)?.count || 0;
  const pendingSync = (pSyncRes.rows?.item(0)?.count || 0) + (lSyncRes.rows?.item(0)?.count || 0);

  return {
    totalEnrolled,
    totalLogs,
    pendingSync,
  };
}

export interface User {
  id: string;
  name: string;
  embedding: number[];
  registeredAt: string;
}

/**
 * Registers a new user.
 */
export function registerUser(name: string, embedding: number[]): User {
  const database = getDb();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const registeredAt = new Date().toISOString();
  const embeddingStr = JSON.stringify(embedding);

  database.execute(
    `INSERT INTO users (id, name, embedding, registeredAt)
     VALUES (?, ?, ?, ?);`,
    [id, name, embeddingStr, registeredAt]
  );

  return { id, name, embedding, registeredAt };
}

/**
 * Retrieves all registered users from the SQLite database.
 */
export function getAllUsers(): User[] {
  const database = getDb();
  const result = database.execute('SELECT id, name, embedding, registeredAt FROM users;');
  const list: User[] = [];

  const rows = result.rows;
  if (rows) {
    const len = rows.length;
    for (let i = 0; i < len; i++) {
      const row = rows.item(i);
      try {
        list.push({
          id: row.id,
          name: row.name,
          embedding: JSON.parse(row.embedding),
          registeredAt: row.registeredAt,
        });
      } catch (e) {
        console.error('Failed to parse embedding for user', row.id, e);
      }
    }
  }
  return list;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  timestamp: string;
  status: string;
  synced: boolean;
}

/**
 * Logs a user's attendance status.
 */
export function saveAttendanceLog(userId: string, status: string): string {
  const database = getDb();
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();

  database.execute(
    `INSERT INTO attendance (id, userId, timestamp, status, synced)
     VALUES (?, ?, ?, ?, 0);`,
    [id, userId, timestamp, status]
  );

  return id;
}

/**
 * Fetches all unsynced attendance records (synced = 0).
 */
export function getUnsyncedAttendance(): AttendanceLog[] {
  const database = getDb();
  const result = database.execute('SELECT id, userId, timestamp, status, synced FROM attendance WHERE synced = 0;');
  const list: AttendanceLog[] = [];

  const rows = result.rows;
  if (rows) {
    const len = rows.length;
    for (let i = 0; i < len; i++) {
      const row = rows.item(i);
      list.push({
        id: row.id,
        userId: row.userId,
        timestamp: row.timestamp,
        status: row.status,
        synced: row.synced === 1,
      });
    }
  }
  return list;
}

/**
 * Marks given attendance record IDs as synced (synced = 1) in the local database.
 */
export function markAttendanceAsSynced(ids: string[]): void {
  if (ids.length === 0) return;
  const database = getDb();
  const placeholders = ids.map(() => '?').join(',');
  database.execute(
    `UPDATE attendance SET synced = 1 WHERE id IN (${placeholders});`,
    ids
  );
}

/**
 * Deletes all attendance records that have been successfully synced (synced = 1).
 */
export function purgeSyncedAttendance(): void {
  const database = getDb();
  database.execute('DELETE FROM attendance WHERE synced = 1;');
}

/**
 * Returns the total count of registered users in the SQLite users table.
 */
export function getRegisteredUsersCount(): number {
  const database = getDb();
  const result = database.execute('SELECT COUNT(*) as count FROM users;');
  return result.rows?.item(0)?.count || 0;
}
