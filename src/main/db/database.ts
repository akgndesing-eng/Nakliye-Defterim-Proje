import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { migrations } from './migrations';
import { AutoBackupItem, AutoBackupStatus } from '../../shared/types';

let dbInstance: Database.Database | null = null;
let activePassword: string | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let autoBackupTimer: NodeJS.Timeout | null = null;
let autoBackupIntervalMinutes = 10; // Default every 10 minutes
let lastSnapshotEpochMs = 0;
let lastAutoBackupAtISO: string | null = null;
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes auto-lock support
const MAX_AUTO_BACKUP_FILES = 30;

export interface VaultEnvelope {
  cipher: 'AES-256-GCM-SQLCIPHER-COMPAT';
  version: string;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  authTag: string;
  payload: string; // base64 encrypted SQLite binary
  updatedAt: string;
}

let customWorkingPath: string | null = null;

export function getDatabaseDir(): string {
  if (customWorkingPath || process.env.VITEST) {
    const testDir = path.join(customWorkingPath ? path.dirname(customWorkingPath) : process.cwd(), '.test_vault_v45');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    return testDir;
  }

  let baseDir = '';
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    if (app && app.getPath) {
      baseDir = path.join(app.getPath('userData'), 'vault_v45');
    }
  } catch {
    // Fallback for test or CLI environment
  }

  if (!baseDir) {
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : '/var/local');
    baseDir = path.join(appData, 'NakliyeDefterim', 'vault_v45');
  }

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

export function getEncryptedVaultPath(): string {
  return path.join(getDatabaseDir(), 'nakliye_defterim_v45.enc.db');
}

function getWorkingSqlitePath(): string {
  return customWorkingPath || path.join(getDatabaseDir(), '.working_session_v45.sqlite');
}

function deriveKey(password: string, saltHex: string, iterations = 120000): Buffer {
  return crypto.pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), iterations, 32, 'sha256');
}

export function encryptBufferWithPassword(plainBuffer: Buffer, password: string): VaultEnvelope {
  const salt = crypto.randomBytes(16).toString('hex');
  const iv = crypto.randomBytes(12);
  const iterations = 120000;
  const key = deriveKey(password, salt, iterations);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    cipher: 'AES-256-GCM-SQLCIPHER-COMPAT',
    version: '4.5.0',
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    payload: encrypted.toString('base64'),
    updatedAt: new Date().toISOString()
  };
}

export function decryptBufferWithPassword(envelope: VaultEnvelope, password: string): Buffer {
  try {
    const key = deriveKey(password, envelope.salt, envelope.iterations || 120000);
    const iv = Buffer.from(envelope.iv, 'hex');
    const authTag = Buffer.from(envelope.authTag, 'hex');
    const encryptedData = Buffer.from(envelope.payload, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  } catch {
    throw new Error('Ana parola hatalı veya şifreli veritabanı dosyası bozulmuş.');
  }
}

export function isVaultInitialized(): boolean {
  return fs.existsSync(getEncryptedVaultPath());
}

export function isVaultUnlocked(): boolean {
  return dbInstance !== null && activePassword !== null;
}

function removeWorkingFiles(): void {
  const workPath = getWorkingSqlitePath();
  for (const suffix of ['', '-wal', '-shm']) {
    const p = workPath + suffix;
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {}
    }
  }
}

function getActiveSqlitePath(): string {
  return customWorkingPath || getWorkingSqlitePath();
}

export function getAutoBackupDirs(): { primaryDir: string; secondaryDir: string } {
  const primaryDir = path.join(getDatabaseDir(), 'auto_backups');
  if (!fs.existsSync(primaryDir)) {
    try {
      fs.mkdirSync(primaryDir, { recursive: true });
    } catch {}
  }

  let secondaryDir = primaryDir;
  if (!customWorkingPath && process.versions && process.versions.electron) {
    try {
      let docsBase = path.join(os.homedir(), 'Documents');
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { app } = require('electron');
        if (app && app.getPath) {
          docsBase = app.getPath('documents');
        }
      } catch {}
      const candidate = path.join(docsBase, 'Nakliye Defterim Otomatik Yedekler');
      if (!fs.existsSync(candidate)) {
        fs.mkdirSync(candidate, { recursive: true });
      }
      secondaryDir = candidate;
    } catch {
      secondaryDir = primaryDir;
    }
  }

  return { primaryDir, secondaryDir };
}

function formatBackupTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

function pruneOldAutoBackups(dir: string): void {
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith('NakliyeDefterim_OtoYedek_') && f.endsWith('.json'))
      .map((f) => {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        return { name: f, full, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    if (files.length > MAX_AUTO_BACKUP_FILES) {
      for (const old of files.slice(MAX_AUTO_BACKUP_FILES)) {
        try {
          fs.unlinkSync(old.full);
        } catch {}
      }
    }
  } catch {}
}

function writeAutoBackupPayload(
  envelope: VaultEnvelope,
  reason: string,
  writeTimestamped: boolean
): AutoBackupItem | null {
  try {
    const now = new Date();
    const createdAt = now.toISOString();
    const { primaryDir, secondaryDir } = getAutoBackupDirs();
    const bundle = {
      type: 'NAKLIYE_DEFTERIM_V45_ENCRYPTED_BACKUP',
      autoBackup: true,
      reason,
      createdAt,
      vaultEnvelope: envelope
    };
    const serialized = JSON.stringify(bundle, null, 2);

    const rollingName = 'NakliyeDefterim_Son_Otomatik_Yedek.json';
    const primaryRollingPath = path.join(primaryDir, rollingName);
    fs.writeFileSync(primaryRollingPath, serialized, 'utf-8');
    if (secondaryDir !== primaryDir) {
      try {
        fs.writeFileSync(path.join(secondaryDir, rollingName), serialized, 'utf-8');
      } catch {}
    }

    let targetFileName = rollingName;
    let targetFilePath = secondaryDir !== primaryDir ? path.join(secondaryDir, rollingName) : primaryRollingPath;

    if (writeTimestamped) {
      const snapName = `NakliyeDefterim_OtoYedek_${formatBackupTimestamp(now)}.json`;
      const primarySnapPath = path.join(primaryDir, snapName);
      fs.writeFileSync(primarySnapPath, serialized, 'utf-8');
      pruneOldAutoBackups(primaryDir);

      if (secondaryDir !== primaryDir) {
        try {
          const secondarySnapPath = path.join(secondaryDir, snapName);
          fs.writeFileSync(secondarySnapPath, serialized, 'utf-8');
          pruneOldAutoBackups(secondaryDir);
          targetFilePath = secondarySnapPath;
        } catch {
          targetFilePath = primarySnapPath;
        }
      } else {
        targetFilePath = primarySnapPath;
      }
      targetFileName = snapName;
      lastSnapshotEpochMs = now.getTime();
    }

    lastAutoBackupAtISO = createdAt;
    const sizeBytes = Buffer.byteLength(serialized, 'utf-8');
    return {
      fileName: targetFileName,
      filePath: targetFilePath,
      createdAt,
      sizeBytes,
      reason,
      isLatestRolling: !writeTimestamped
    };
  } catch {
    return null;
  }
}

export function startAutoBackupScheduler(): void {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
  if (autoBackupIntervalMinutes <= 0) return;

  const intervalMs = autoBackupIntervalMinutes * 60 * 1000;
  autoBackupTimer = setInterval(() => {
    if (dbInstance && activePassword) {
      try {
        createAutoBackupSnapshot('Periyodik Otomatik Yedek', true);
      } catch {}
    }
  }, intervalMs);

  if (autoBackupTimer && typeof autoBackupTimer.unref === 'function') {
    autoBackupTimer.unref();
  }
}

export function stopAutoBackupScheduler(): void {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}

export function setAutoBackupIntervalMinutes(minutes: number): AutoBackupStatus {
  autoBackupIntervalMinutes = Math.max(0, Number(minutes || 0));
  if (dbInstance && activePassword) {
    startAutoBackupScheduler();
  } else {
    stopAutoBackupScheduler();
  }
  return getAutoBackupStatus();
}

export function createAutoBackupSnapshot(
  reason = 'Otomatik Yedek',
  forceTimestamped = true
): AutoBackupItem | null {
  if (!dbInstance || !activePassword) return null;
  try {
    dbInstance.pragma('wal_checkpoint(TRUNCATE)');
  } catch {}
  const workPath = getActiveSqlitePath();
  if (!fs.existsSync(workPath)) return null;

  const plainBuffer = fs.readFileSync(workPath);
  const envelope = encryptBufferWithPassword(plainBuffer, activePassword);
  fs.writeFileSync(getEncryptedVaultPath(), JSON.stringify(envelope, null, 2), 'utf-8');
  return writeAutoBackupPayload(envelope, reason, forceTimestamped);
}

export function getAutoBackupStatus(): AutoBackupStatus {
  const { primaryDir, secondaryDir } = getAutoBackupDirs();
  const activeDir = secondaryDir && fs.existsSync(secondaryDir) ? secondaryDir : primaryDir;

  let items: AutoBackupItem[] = [];
  try {
    const files = fs
      .readdirSync(activeDir)
      .filter((f) => f.endsWith('.json') && f.startsWith('NakliyeDefterim_'));

    items = files
      .map((f) => {
        const fullPath = path.join(activeDir, f);
        const stat = fs.statSync(fullPath);
        let createdAt = stat.mtime.toISOString();
        let reason = f === 'NakliyeDefterim_Son_Otomatik_Yedek.json' ? 'Anlık Son Yedek (Canlı)' : 'Otomatik Periyodik Yedek';
        try {
          // Read first 512 bytes to extract createdAt & reason quickly without parsing huge payload
          const fd = fs.openSync(fullPath, 'r');
          const buf = Buffer.alloc(600);
          const bytesRead = fs.readSync(fd, buf, 0, 600, 0);
          fs.closeSync(fd);
          const headStr = buf.subarray(0, bytesRead).toString('utf-8');
          const mCreated = headStr.match(/"createdAt"\s*:\s*"([^"]+)"/);
          const mReason = headStr.match(/"reason"\s*:\s*"([^"]+)"/);
          if (mCreated && mCreated[1]) createdAt = mCreated[1];
          if (mReason && mReason[1]) reason = mReason[1];
        } catch {}
        return {
          fileName: f,
          filePath: fullPath,
          createdAt,
          sizeBytes: stat.size,
          reason,
          isLatestRolling: f === 'NakliyeDefterim_Son_Otomatik_Yedek.json'
        };
      })
      .sort((a, b) => {
        if (a.isLatestRolling && !b.isLatestRolling) return -1;
        if (!a.isLatestRolling && b.isLatestRolling) return 1;
        return b.createdAt.localeCompare(a.createdAt);
      });
  } catch {}

  const newestAt = items.length > 0 ? items[0].createdAt : lastAutoBackupAtISO;

  return {
    enabled: autoBackupIntervalMinutes > 0,
    intervalMinutes: autoBackupIntervalMinutes,
    backupDir: activeDir,
    secondaryDir,
    lastBackupAt: newestAt,
    totalCount: items.length,
    backups: items
  };
}

export function syncEncryptedVault(reason = 'Veri Değişikliği Otomatik Yedek'): void {
  if (!dbInstance || !activePassword) return;
  try {
    dbInstance.pragma('wal_checkpoint(TRUNCATE)');
  } catch {}
  const workPath = getActiveSqlitePath();
  if (!fs.existsSync(workPath)) return;

  const plainBuffer = fs.readFileSync(workPath);
  const envelope = encryptBufferWithPassword(plainBuffer, activePassword);
  fs.writeFileSync(getEncryptedVaultPath(), JSON.stringify(envelope, null, 2), 'utf-8');

  const nowMs = Date.now();
  const minGapMs = Math.max(1, autoBackupIntervalMinutes || 10) * 60 * 1000;
  const shouldWriteTimestamped = lastSnapshotEpochMs === 0 || nowMs - lastSnapshotEpochMs >= minGapMs;
  writeAutoBackupPayload(envelope, reason, shouldWriteTimestamped);
}

function runMigrations(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
  const appliedVersions = new Set(appliedRows.map(r => r.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      const runInTx = db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString());
      });
      runInTx();
    }
  }
}

export function setupInitialVault(password: string): void {
  if (!password || password.length < 10) {
    throw new Error('Ana parola güvenlik gereği en az 10 karakter olmalıdır.');
  }
  if (dbInstance) {
    lockVault();
  }
  customWorkingPath = null;
  removeWorkingFiles();

  const workPath = getWorkingSqlitePath();
  const db = new Database(workPath);
  // Apply SQLCipher compatible pragma key if supported
  try {
    db.pragma(`key = '${password.replace(/'/g, "''")}'`);
  } catch {}

  runMigrations(db);
  dbInstance = db;
  activePassword = password;
  syncEncryptedVault('İlk Kurulum Otomatik Yedeği');
  startAutoBackupScheduler();
  touchSessionActivity();
}

export function unlockVault(password: string): void {
  if (!password) {
    throw new Error('Lütfen ana parolanızı girin.');
  }
  const vaultPath = getEncryptedVaultPath();
  if (!fs.existsSync(vaultPath)) {
    throw new Error('Henüz kurulu bir veritabanı bulunamadı. Lütfen ilk kurulumu yapın.');
  }

  const rawContent = fs.readFileSync(vaultPath, 'utf-8');
  let envelope: VaultEnvelope;
  try {
    envelope = JSON.parse(rawContent) as VaultEnvelope;
  } catch {
    throw new Error('Veritabanı kasa formatı okunamadı.');
  }

  const decryptedSqlite = decryptBufferWithPassword(envelope, password);

  if (dbInstance) {
    try { dbInstance.close(); } catch {}
    dbInstance = null;
  }
  removeWorkingFiles();

  const workPath = getWorkingSqlitePath();
  fs.writeFileSync(workPath, decryptedSqlite);

  const db = new Database(workPath);
  try {
    db.pragma(`key = '${password.replace(/'/g, "''")}'`);
  } catch {}

  runMigrations(db);
  dbInstance = db;
  activePassword = password;
  syncEncryptedVault('Oturum Açılış Otomatik Yedeği');
  startAutoBackupScheduler();
  touchSessionActivity();
}

export function lockVault(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  stopAutoBackupScheduler();
  if (dbInstance && activePassword) {
    try {
      createAutoBackupSnapshot('Oturum Kapatma Otomatik Yedeği', true);
    } catch {}
  }
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
  activePassword = null;
  removeWorkingFiles();
}

export function touchSessionActivity(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  if (dbInstance && activePassword) {
    idleTimer = setTimeout(() => {
      lockVault();
    }, IDLE_TIMEOUT_MS);
  }
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error('LOCKED: Defter kilitli. Lütfen ana parola ile kilidi açın.');
  }
  touchSessionActivity();
  return dbInstance;
}

export function getActivePassword(): string {
  if (!activePassword) {
    throw new Error('LOCKED: Oturum anahtarı bulunamadı.');
  }
  return activePassword;
}

// Keep compatibility helpers for test runner if needed
export function initDatabase(customPath?: string): Database.Database {
  if (customPath) {
    customWorkingPath = path.resolve(customPath);
    const db = new Database(customWorkingPath);
    runMigrations(db);
    dbInstance = db;
    activePassword = 'test-password-12345';
    return db;
  }
  if (!dbInstance) {
    throw new Error('LOCKED: Veritabanı henüz parola ile açılmadı.');
  }
  return dbInstance;
}

export function closeDatabase(): void {
  const wasTestDir = customWorkingPath ? path.join(path.dirname(customWorkingPath), '.test_vault_v45') : null;
  lockVault();
  customWorkingPath = null;
  if (wasTestDir && fs.existsSync(wasTestDir)) {
    try {
      fs.rmSync(wasTestDir, { recursive: true, force: true });
    } catch {}
  }
}
