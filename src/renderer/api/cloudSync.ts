import {
  CloudAccountProfile,
  CloudSyncStatus,
  DatabaseSnapshot,
  GateStatus,
  VehicleDocumentFile
} from '../../shared/types';
import { ElectronApi } from '../../preload/preload';
import { mobileStorageApi } from './mobileStorage';

const rawApi: ElectronApi = (typeof window !== 'undefined' && window.api) || mobileStorageApi;

const IMMANUEL_APP_KEY = 'lvmmfp08';
const TEXTDB_UPDATE_URL = 'https://api.textdb.online/update/';
const TEXTDB_READ_BASE = 'https://textdb.online/';
const TEXTDB_CHUNK_SIZE = 165000;
const ACTIVE_ACCOUNT_STORAGE_KEY = 'nd_cloud_active_account_v45';
const LOCAL_ACCOUNTS_CACHE_KEY = 'nd_local_accounts_registry_v45';

interface StoredAccountSession {
  username: string;
  password: string;
  displayName: string;
  companyTitle: string;
  rememberMe: boolean;
  lastSyncedAt?: string | null;
  revision?: number;
}

// Pure JS SHA-256 implementation so hashing works identically on Electron, Android, iOS, and HTTP LAN
function sha256Hex(ascii: string): string {
  const rightRotate = (value: number, amount: number) => (value >>> amount) | (value << (32 - amount));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const utf8 = unescape(encodeURIComponent(ascii));
  const asciiBitLength = utf8.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let str = utf8 + '\x80';
  while ((str.length % 64) - 56) str += '\x00';
  for (let i = 0; i < str.length; i++) {
    const j = str.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function normalizeCloudUsername(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._@-]/g, '');
}

function getAccountKeys(username: string, password: string) {
  const cleanUser = normalizeCloudUsername(username);
  const userHash = sha256Hex(`nd_v45_user:${cleanUser}`).slice(0, 16);
  const authVerifier = sha256Hex(`nd_v45_auth:${cleanUser}:${password}`).slice(0, 24);
  const vaultTopic = `nd_akon_v45_${userHash}_${authVerifier.slice(0, 10)}`;
  return {
    cleanUser,
    userHash,
    authVerifier,
    vaultTopic,
    accKvKey: `nd_acc_${userHash}`,
    ptrKvKey: `nd_ptr_${userHash}`,
    permAccKey: `nd_v45_acc_${userHash}`,
    permMetaKey: `nd_v45_meta_${userHash}`,
    permDbKey: `nd_v45_db_${userHash}`
  };
}

function getDeviceLabel(): string {
  if (typeof window === 'undefined') return 'Masaüstü PC';
  if ((window as any).api) return 'Windows Masaüstü PC';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iOS';
  if (/Android/i.test(ua)) return 'Android Telefon';
  return 'Web / Mobil Cihaz';
}

let currentSession: StoredAccountSession | null = null;
let currentStatus: CloudSyncStatus = {
  isLoggedIn: false,
  username: null,
  displayName: null,
  companyTitle: null,
  syncState: 'idle',
  lastSyncedAt: null,
  revision: 0,
  errorMessage: null
};

let pushDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let pollIntervalTimer: ReturnType<typeof setInterval> | null = null;
let activeEventSource: EventSource | null = null;
let isSyncInProgress = false;
const statusListeners = new Set<(status: CloudSyncStatus) => void>();

function notifyStatusListeners() {
  const snapshot = { ...currentStatus };
  statusListeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {}
  });
}

export function subscribeCloudSyncStatus(listener: (status: CloudSyncStatus) => void): () => void {
  statusListeners.add(listener);
  listener({ ...currentStatus });
  return () => {
    statusListeners.delete(listener);
  };
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return { ...currentStatus };
}

function loadSavedSession(): StoredAccountSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAccountSession;
    if (parsed && parsed.username && parsed.password) {
      return parsed;
    }
  } catch {}
  return null;
}

function saveSessionToStorage(session: StoredAccountSession | null): void {
  currentSession = session;
  if (!session) {
    localStorage.removeItem(ACTIVE_ACCOUNT_STORAGE_KEY);
    currentStatus = {
      isLoggedIn: false,
      username: null,
      displayName: null,
      companyTitle: null,
      syncState: 'idle',
      lastSyncedAt: null,
      revision: 0,
      errorMessage: null
    };
    notifyStatusListeners();
    return;
  }

  localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, JSON.stringify(session));
  try {
    const localReg = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_CACHE_KEY) || '{}');
    const { cleanUser, authVerifier } = getAccountKeys(session.username, session.password);
    localReg[cleanUser] = {
      authVerifier,
      displayName: session.displayName,
      companyTitle: session.companyTitle
    };
    localStorage.setItem(LOCAL_ACCOUNTS_CACHE_KEY, JSON.stringify(localReg));
  } catch {}

  currentStatus = {
    isLoggedIn: true,
    username: session.username,
    displayName: session.displayName,
    companyTitle: session.companyTitle,
    syncState: currentStatus.syncState === 'idle' ? 'synced' : currentStatus.syncState,
    lastSyncedAt: session.lastSyncedAt || currentStatus.lastSyncedAt,
    revision: session.revision || currentStatus.revision || 0,
    errorMessage: null
  };
  notifyStatusListeners();
}

// Permanent CORS-enabled Cloud KV helpers (textdb.online)
async function permGet(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${TEXTDB_READ_BASE}${encodeURIComponent(key)}?t=${Date.now()}`);
    if (!res.ok) return null;
    const text = await res.text();
    return text && text.trim().length > 0 ? text : null;
  } catch {
    return null;
  }
}

async function permSet(key: string, value: string): Promise<boolean> {
  try {
    const body = `key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`;
    const res = await fetch(TEXTDB_UPDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { status?: number };
    return json?.status === 1;
  } catch {
    return false;
  }
}

export async function permSetLarge(baseKey: string, payloadStr: string): Promise<boolean> {
  if (payloadStr.length <= TEXTDB_CHUNK_SIZE) {
    return permSet(baseKey, JSON.stringify({ single: true, data: payloadStr }));
  }

  const chunks: string[] = [];
  for (let i = 0; i < payloadStr.length; i += TEXTDB_CHUNK_SIZE) {
    chunks.push(payloadStr.slice(i, i + TEXTDB_CHUNK_SIZE));
  }

  const results = await Promise.all(chunks.map((chunk, idx) => permSet(`${baseKey}_c${idx}`, chunk)));
  if (results.some((ok) => !ok)) return false;

  return permSet(baseKey, JSON.stringify({ single: false, count: chunks.length, totalLen: payloadStr.length }));
}

export async function permGetLarge(baseKey: string): Promise<string | null> {
  const raw = await permGet(baseKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.single === true && typeof parsed.data === 'string') {
      return parsed.data;
    }
    if (parsed && parsed.single === false && Number(parsed.count) > 0) {
      const count = Number(parsed.count);
      const parts = await Promise.all(
        Array.from({ length: count }, (_, idx) => permGet(`${baseKey}_c${idx}`))
      );
      if (parts.some((p) => p === null)) return null;
      return parts.join('');
    }
  } catch {}
  return raw;
}

// Legacy fallback KV helpers (immanuel) for seamless account migration
async function kvGet(key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${IMMANUEL_APP_KEY}/${encodeURIComponent(key)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const text = await res.text();
    const val = JSON.parse(text);
    return val ? String(val).trim() : null;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${IMMANUEL_APP_KEY}/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
      {
        method: 'POST',
        body: ''
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

function getLocalRevision(username: string): number {
  try {
    return Number(localStorage.getItem(`nd_cloud_rev_${normalizeCloudUsername(username)}`) || 0);
  } catch {
    return 0;
  }
}

function setLocalRevision(username: string, rev: number): void {
  try {
    localStorage.setItem(`nd_cloud_rev_${normalizeCloudUsername(username)}`, String(rev));
  } catch {}
}

function createEmptySnapshot(account: CloudAccountProfile): DatabaseSnapshot {
  return {
    revision: Date.now(),
    updatedAt: new Date().toISOString(),
    deviceName: getDeviceLabel(),
    account,
    vehicles: [],
    drivers: [],
    customers: [],
    trips: [],
    trip_stops: [],
    vehicle_expenses: [],
    tasks: [],
    reminder_notes: [],
    customer_transactions: [],
    village_tankers: [],
    village_tanker_logs: [],
    vehicle_documents: [],
    vehicle_document_files: []
  };
}

// On-demand cloud photo downloader when viewing/downloading a file synced from another device
export async function ensureDocumentFileDownloaded(file: VehicleDocumentFile): Promise<VehicleDocumentFile> {
  if (file.data_url && file.data_url.length > 20) {
    return file;
  }
  if (!file.cloud_key) {
    return file;
  }
  const downloadedDataUrl = await permGetLarge(file.cloud_key);
  if (downloadedDataUrl && downloadedDataUrl.startsWith('data:')) {
    const hydrated: VehicleDocumentFile = { ...file, data_url: downloadedDataUrl };
    try {
      await rawApi.saveVehicleDocumentFile(hydrated);
    } catch {}
    return hydrated;
  }
  return file;
}

async function hydrateMissingRemotePhotos(files: VehicleDocumentFile[]): Promise<boolean> {
  let updatedAny = false;
  for (const f of files) {
    if ((!f.data_url || f.data_url.length < 20) && f.cloud_key) {
      try {
        const res = await ensureDocumentFileDownloaded(f);
        if (res.data_url && res.data_url.length > 20) {
          updatedAny = true;
        }
      } catch {}
    }
  }
  return updatedAny;
}

// Push current local database snapshot permanently to the user's cloud vault
export async function pushLocalVaultToCloud(force = false): Promise<boolean> {
  const session = currentSession || loadSavedSession();
  if (!session) return false;
  if (isSyncInProgress && !force) return false;

  isSyncInProgress = true;
  currentStatus = { ...currentStatus, syncState: 'syncing', errorMessage: null };
  notifyStatusListeners();

  try {
    const { cleanUser, userHash, authVerifier, vaultTopic, permAccKey, permMetaKey, permDbKey } = getAccountKeys(
      session.username,
      session.password
    );

    const snapshot = await rawApi.exportDatabaseSnapshot();
    const revision = Date.now();
    const nowStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Upload any un-synced photo attachments ONCE under their permanent cloud key
    const lightweightFiles: VehicleDocumentFile[] = [];
    for (const f of snapshot.vehicle_document_files || []) {
      let cloudKey = f.cloud_key;
      if (!cloudKey && f.data_url && f.data_url.length > 20) {
        const candidateKey = `nd_v45_file_${userHash}_${f.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
        const okFile = await permSetLarge(candidateKey, f.data_url);
        if (okFile) {
          cloudKey = candidateKey;
          try {
            await rawApi.saveVehicleDocumentFile({ ...f, cloud_key: cloudKey });
          } catch {}
        }
      }
      lightweightFiles.push({
        ...f,
        cloud_key: cloudKey,
        data_url: cloudKey ? '' : f.data_url
      });
    }

    const bundle: DatabaseSnapshot = {
      ...snapshot,
      vehicle_document_files: lightweightFiles,
      revision,
      updatedAt: new Date().toISOString(),
      deviceName: getDeviceLabel(),
      account: {
        username: cleanUser,
        displayName: session.displayName || cleanUser,
        companyTitle: session.companyTitle || 'Akon Group'
      }
    };

    // 1. Ensure permanent account verifier exists
    await permSet(
      permAccKey,
      JSON.stringify({
        authVerifier,
        displayName: bundle.account?.displayName || cleanUser,
        companyTitle: bundle.account?.companyTitle || 'Akon Group'
      })
    );

    // 2. Store full ERP database snapshot permanently (single or chunked on textdb.online)
    const dbOk = await permSetLarge(permDbKey, JSON.stringify(bundle));
    if (!dbOk) {
      throw new Error('Bulut veritabanı kaydı başarısız oldu.');
    }

    // 3. Update tiny fast-poll metadata pointer
    await permSet(
      permMetaKey,
      JSON.stringify({
        rev: revision,
        updatedAt: bundle.updatedAt,
        deviceName: bundle.deviceName
      })
    );

    // 4. Fire non-blocking instant real-time wake-up ping to connected Android / iOS / PC sessions
    fetch(`https://ntfy.sh/${vaultTopic}`, {
      method: 'POST',
      body: JSON.stringify({ rev: revision, device: bundle.deviceName })
    }).catch(() => {});

    setLocalRevision(cleanUser, revision);
    session.lastSyncedAt = nowStr;
    session.revision = revision;
    saveSessionToStorage(session);

    currentStatus = {
      ...currentStatus,
      isLoggedIn: true,
      syncState: 'synced',
      lastSyncedAt: nowStr,
      revision,
      errorMessage: null
    };
    notifyStatusListeners();
    return true;
  } catch (err: any) {
    currentStatus = {
      ...currentStatus,
      syncState: 'offline',
      errorMessage: err?.message || 'Bulut bağlantısı kurulamadı'
    };
    notifyStatusListeners();
    return false;
  } finally {
    isSyncInProgress = false;
  }
}

export async function pushLocalVaultWithFeedback(force = false): Promise<{ success: boolean; message: string }> {
  const ok = await pushLocalVaultToCloud(force);
  return ok
    ? { success: true, message: 'Bu cihazdaki tüm veriler ve evraklar bulut hesabınıza başarıyla yedeklendi.' }
    : { success: false, message: currentStatus.errorMessage || 'Buluta yükleme yapılamadı, internet bağlantınızı kontrol edin.' };
}

// Schedule a debounced cloud push after any local database write
export function scheduleCloudPush(): void {
  if (!currentSession && !loadSavedSession()) return;
  if (pushDebounceTimer) {
    clearTimeout(pushDebounceTimer);
  }
  pushDebounceTimer = setTimeout(() => {
    pushLocalVaultToCloud(true).catch(() => {});
  }, 550);
}

async function applyRemoteSnapshotToLocal(
  cleanUser: string,
  remoteBundle: DatabaseSnapshot,
  remoteRevision: number
): Promise<void> {
  await rawApi.importDatabaseSnapshot(remoteBundle);
  setLocalRevision(cleanUser, remoteRevision);

  const nowStr = new Date().toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  if (remoteBundle.account && currentSession) {
    currentSession.displayName = remoteBundle.account.displayName || currentSession.displayName;
    currentSession.companyTitle = remoteBundle.account.companyTitle || currentSession.companyTitle;
    currentSession.lastSyncedAt = nowStr;
    currentSession.revision = remoteRevision;
    saveSessionToStorage(currentSession);

    try {
      const rawPrefs = localStorage.getItem('nd_preferences_v45');
      const prefs = rawPrefs ? JSON.parse(rawPrefs) : {};
      if (remoteBundle.account.displayName) prefs.managerName = remoteBundle.account.displayName;
      if (remoteBundle.account.companyTitle) prefs.companyTitle = remoteBundle.account.companyTitle;
      localStorage.setItem('nd_preferences_v45', JSON.stringify(prefs));
    } catch {}
  }

  currentStatus = {
    ...currentStatus,
    isLoggedIn: true,
    syncState: 'synced',
    lastSyncedAt: nowStr,
    revision: remoteRevision,
    errorMessage: null
  };
  notifyStatusListeners();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nd-cloud-sync-updated', { detail: remoteBundle }));
  }

  // Lazily download and cache any missing document photos in the background
  if (remoteBundle.vehicle_document_files && remoteBundle.vehicle_document_files.length > 0) {
    hydrateMissingRemotePhotos(remoteBundle.vehicle_document_files)
      .then((downloadedAny) => {
        if (downloadedAny && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nd-cloud-sync-updated', { detail: remoteBundle }));
        }
      })
      .catch(() => {});
  }
}

// Pull latest cloud vault for active account if newer (or when forced on login)
export async function pullCloudVaultToLocal(force = false): Promise<{
  updated: boolean;
  hadCloudData: boolean;
}> {
  const session = currentSession || loadSavedSession();
  if (!session) return { updated: false, hadCloudData: false };
  if (isSyncInProgress && !force) return { updated: false, hadCloudData: false };

  isSyncInProgress = true;
  if (force) {
    currentStatus = { ...currentStatus, syncState: 'syncing', errorMessage: null };
    notifyStatusListeners();
  }

  try {
    const { cleanUser, vaultTopic, ptrKvKey, permMetaKey, permDbKey } = getAccountKeys(
      session.username,
      session.password
    );
    const localRev = getLocalRevision(cleanUser);

    let remoteRev = 0;
    const metaRaw = await permGet(permMetaKey);
    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw);
        remoteRev = Number(meta?.rev || 0);
      } catch {}
    }

    if (!force && remoteRev > 0 && remoteRev <= localRev) {
      currentStatus = { ...currentStatus, syncState: 'synced', errorMessage: null };
      notifyStatusListeners();
      return { updated: false, hadCloudData: true };
    }

    let fetchedBundle: DatabaseSnapshot | null = null;

    // 1. Primary permanent cloud storage (textdb.online, chunked if multi-MB)
    const permDbRaw = await permGetLarge(permDbKey);
    if (permDbRaw) {
      try {
        const candidate = JSON.parse(permDbRaw) as DatabaseSnapshot;
        if (candidate && Array.isArray(candidate.vehicles)) {
          fetchedBundle = candidate;
          remoteRev = Number(candidate.revision || remoteRev || Date.now());
        }
      } catch {}
    }

    // 2. Legacy fallback: check previous ntfy attachment / immanuel pointer if permanent DB is empty
    if (!fetchedBundle) {
      let remoteFileId: string | null = null;
      const ptrVal = await kvGet(ptrKvKey);
      if (ptrVal && ptrVal.includes('_')) {
        const parts = ptrVal.split('_');
        remoteFileId = parts[0];
        remoteRev = Number(parts[1] || 0);
      }

      if (remoteFileId) {
        try {
          const fileRes = await fetch(`https://ntfy.sh/file/${remoteFileId}.json`, { cache: 'no-store' });
          if (fileRes.ok) {
            fetchedBundle = (await fileRes.json()) as DatabaseSnapshot;
          }
        } catch {}
      }

      if (!fetchedBundle) {
        try {
          const pollRes = await fetch(`https://ntfy.sh/${vaultTopic}/json?poll=1&since=all`, {
            cache: 'no-store'
          });
          if (pollRes.ok) {
            const text = (await pollRes.text()).trim();
            if (text) {
              const lines = text.split('\n').filter(Boolean);
              for (let i = lines.length - 1; i >= 0; i--) {
                const ev = JSON.parse(lines[i]);
                if (ev?.attachment?.url || ev?.id) {
                  const candidateUrl = ev?.attachment?.url || `https://ntfy.sh/file/${ev.id}.json`;
                  const attRes = await fetch(candidateUrl, { cache: 'no-store' });
                  if (attRes.ok) {
                    const candidateBundle = (await attRes.json()) as DatabaseSnapshot;
                    if (candidateBundle && Array.isArray(candidateBundle.vehicles)) {
                      fetchedBundle = candidateBundle;
                      remoteRev = Number(candidateBundle.revision || ev.time * 1000 || Date.now());
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch {}
      }
    }

    if (!fetchedBundle) {
      currentStatus = { ...currentStatus, syncState: 'synced', errorMessage: null };
      notifyStatusListeners();
      return { updated: false, hadCloudData: false };
    }

    const finalRev = Number(fetchedBundle.revision || remoteRev || Date.now());
    if (finalRev > localRev || (force && localRev === 0)) {
      await applyRemoteSnapshotToLocal(cleanUser, fetchedBundle, finalRev);
      return { updated: true, hadCloudData: true };
    }

    if (fetchedBundle.vehicle_document_files && fetchedBundle.vehicle_document_files.length > 0) {
      hydrateMissingRemotePhotos(fetchedBundle.vehicle_document_files)
        .then((downloadedAny) => {
          if (downloadedAny && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nd-cloud-sync-updated', { detail: fetchedBundle }));
          }
        })
        .catch(() => {});
    }

    currentStatus = { ...currentStatus, syncState: 'synced', errorMessage: null };
    notifyStatusListeners();
    return { updated: false, hadCloudData: true };
  } catch (err: any) {
    if (force) {
      currentStatus = {
        ...currentStatus,
        syncState: 'offline',
        errorMessage: err?.message || 'Bulut verisi çekilemedi'
      };
      notifyStatusListeners();
    }
    return { updated: false, hadCloudData: false };
  } finally {
    isSyncInProgress = false;
  }
}

export async function pullCloudVaultWithFeedback(): Promise<{
  updated: boolean;
  hadCloudData: boolean;
  message: string;
}> {
  const res = await pullCloudVaultToLocal(true);
  if (!res.hadCloudData) {
    return { ...res, message: 'Bulutta henüz kayıtlı veri bulunamadı veya bağlantı offline.' };
  }
  return {
    ...res,
    message: res.updated
      ? 'Buluttaki en güncel veriler ve araç evrakları indirildi.'
      : 'Verileriniz zaten güncel.'
  };
}

export function stopCloudSyncWatcher(): void {
  if (pollIntervalTimer) {
    clearInterval(pollIntervalTimer);
    pollIntervalTimer = null;
  }
  if (activeEventSource) {
    try {
      activeEventSource.close();
    } catch {}
    activeEventSource = null;
  }
}

export function startCloudSyncWatcher(): void {
  stopCloudSyncWatcher();
  const session = currentSession || loadSavedSession();
  if (!session) return;

  const { cleanUser, vaultTopic } = getAccountKeys(session.username, session.password);

  // 1. Real-time SSE listener for instant (<300ms) cross-device wake-up & sync
  if (typeof EventSource !== 'undefined') {
    try {
      const es = new EventSource(`https://ntfy.sh/${vaultTopic}/sse`);
      es.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data?.event !== 'message') return;

          if (data?.message) {
            try {
              const ping = JSON.parse(data.message);
              const rev = Number(ping?.rev || 0);
              if (rev > getLocalRevision(cleanUser)) {
                await pullCloudVaultToLocal(true);
                return;
              }
            } catch {}
          }

          if (data?.attachment?.url || data?.id) {
            const url = data?.attachment?.url || `https://ntfy.sh/file/${data.id}.json`;
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
              const bundle = (await res.json()) as DatabaseSnapshot;
              const rev = Number(bundle.revision || Date.now());
              if (rev > getLocalRevision(cleanUser)) {
                await applyRemoteSnapshotToLocal(cleanUser, bundle, rev);
              }
            }
          }
        } catch {}
      };
      activeEventSource = es;
    } catch {}
  }

  // 2. Periodic lightweight pointer check every 6 seconds
  pollIntervalTimer = setInterval(() => {
    if (!isSyncInProgress) {
      pullCloudVaultToLocal(false).catch(() => {});
    }
  }, 6000);
}

// Register a brand new cloud user account
export async function registerCloudAccount(params: {
  username: string;
  password: string;
  displayName: string;
  companyTitle: string;
  keepCurrentLocalData: boolean;
}): Promise<GateStatus> {
  const cleanUser = normalizeCloudUsername(params.username);
  if (!cleanUser || cleanUser.length < 3) {
    throw new Error('Kullanıcı adı en az 3 karakter olmalıdır (Örn: umutergil).');
  }
  if (!params.password || params.password.length < 4) {
    throw new Error('Hesap şifresi en az 4 karakter olmalıdır.');
  }

  const { authVerifier, accKvKey, permAccKey } = getAccountKeys(cleanUser, params.password);
  const displayName = (params.displayName || cleanUser).trim();
  const companyTitle = (params.companyTitle || 'Akon Group').trim();

  // Check if username is already taken in permanent or legacy cloud storage
  let existingVerifier: string | null = null;
  const permAccRaw = await permGet(permAccKey);
  if (permAccRaw) {
    try {
      existingVerifier = JSON.parse(permAccRaw)?.authVerifier || null;
    } catch {
      existingVerifier = permAccRaw;
    }
  }
  if (!existingVerifier) {
    existingVerifier = await kvGet(accKvKey);
  }
  if (existingVerifier && existingVerifier !== authVerifier) {
    throw new Error(
      'Bu kullanıcı adı zaten kayıtlı! Eğer hesap size aitse "Hesaba Giriş Yap" sekmesinden şifrenizle giriş yapabilirsiniz.'
    );
  }

  await permSet(permAccKey, JSON.stringify({ authVerifier, displayName, companyTitle }));
  kvSet(accKvKey, authVerifier).catch(() => {});

  // Switch local database to this user's isolated vault
  const gateStatus = await rawApi.switchUserVault({
    username: cleanUser,
    password: params.password,
    migrateCurrent: params.keepCurrentLocalData
  });

  if (!params.keepCurrentLocalData) {
    await rawApi.importDatabaseSnapshot(
      createEmptySnapshot({ username: cleanUser, displayName, companyTitle })
    );
  }

  const session: StoredAccountSession = {
    username: cleanUser,
    password: params.password,
    displayName,
    companyTitle,
    rememberMe: true
  };
  saveSessionToStorage(session);

  // Update local preferences with user's display name & company
  try {
    const rawPrefs = localStorage.getItem('nd_preferences_v45');
    const prefs = rawPrefs ? JSON.parse(rawPrefs) : {};
    prefs.managerName = displayName;
    prefs.companyTitle = companyTitle;
    localStorage.setItem('nd_preferences_v45', JSON.stringify(prefs));
  } catch {}

  // Push initial data to cloud immediately
  await pushLocalVaultToCloud(true);
  startCloudSyncWatcher();

  return {
    ...gateStatus,
    isUnlocked: true,
    activeUsername: cleanUser,
    activeDisplayName: displayName,
    activeCompanyTitle: companyTitle
  };
}

// Log in to an existing cloud user account (from PC, Android, or iOS)
export async function loginCloudAccount(params: {
  username: string;
  password: string;
  rememberMe?: boolean;
}): Promise<GateStatus> {
  const cleanUser = normalizeCloudUsername(params.username);
  if (!cleanUser) {
    throw new Error('Lütfen kullanıcı adınızı girin.');
  }
  if (!params.password) {
    throw new Error('Lütfen hesap şifrenizi girin.');
  }

  const { authVerifier, accKvKey, permAccKey } = getAccountKeys(cleanUser, params.password);

  let remoteVerifier: string | null = null;
  let remoteDisplayName: string | undefined;
  let remoteCompanyTitle: string | undefined;

  const permAccRaw = await permGet(permAccKey);
  if (permAccRaw) {
    try {
      const parsed = JSON.parse(permAccRaw);
      remoteVerifier = parsed?.authVerifier || null;
      remoteDisplayName = parsed?.displayName;
      remoteCompanyTitle = parsed?.companyTitle;
    } catch {
      remoteVerifier = permAccRaw;
    }
  }

  let migratedFromLegacyKv = false;
  if (!remoteVerifier) {
    remoteVerifier = await kvGet(accKvKey);
    if (remoteVerifier) migratedFromLegacyKv = true;
  }

  let localCachedAccount: any = null;
  try {
    const localReg = JSON.parse(localStorage.getItem(LOCAL_ACCOUNTS_CACHE_KEY) || '{}');
    localCachedAccount = localReg[cleanUser] || null;
  } catch {}

  if (remoteVerifier) {
    if (remoteVerifier !== authVerifier) {
      throw new Error('Kullanıcı adı veya şifre hatalı! Lütfen kontrol edip tekrar deneyin.');
    }
    if (migratedFromLegacyKv) {
      permSet(
        permAccKey,
        JSON.stringify({
          authVerifier,
          displayName: localCachedAccount?.displayName || cleanUser,
          companyTitle: localCachedAccount?.companyTitle || 'Akon Group'
        })
      ).catch(() => {});
    }
  } else if (localCachedAccount) {
    if (localCachedAccount.authVerifier !== authVerifier) {
      throw new Error('Kullanıcı adı veya şifre hatalı!');
    }
    // Re-publish verifier to permanent cloud storage
    await permSet(
      permAccKey,
      JSON.stringify({
        authVerifier,
        displayName: localCachedAccount?.displayName || cleanUser,
        companyTitle: localCachedAccount?.companyTitle || 'Akon Group'
      })
    );
    kvSet(accKvKey, authVerifier).catch(() => {});
  } else {
    throw new Error(
      `"${cleanUser}" adına kayıtlı bir hesap bulunamadı. Lütfen "Yeni Hesap Oluştur" sekmesinden hesabınızı oluşturun.`
    );
  }

  // Open user's isolated vault on this device
  const gateStatus = await rawApi.switchUserVault({
    username: cleanUser,
    password: params.password,
    migrateCurrent: false
  });

  const session: StoredAccountSession = {
    username: cleanUser,
    password: params.password,
    displayName: remoteDisplayName || localCachedAccount?.displayName || cleanUser,
    companyTitle: remoteCompanyTitle || localCachedAccount?.companyTitle || 'Akon Group',
    rememberMe: params.rememberMe !== false
  };
  saveSessionToStorage(session);

  // Pull latest cloud data for this user immediately
  const pullResult = await pullCloudVaultToLocal(true);
  if (!pullResult.hadCloudData) {
    // Cloud didn't have a snapshot file yet, push local vault to initialize it
    await pushLocalVaultToCloud(true);
  }

  startCloudSyncWatcher();

  return {
    ...gateStatus,
    isUnlocked: true,
    activeUsername: cleanUser,
    activeDisplayName: currentSession?.displayName || cleanUser,
    activeCompanyTitle: currentSession?.companyTitle || 'Akon Group'
  };
}

// Auto-restore saved cloud session on app launch (PC, Android, iOS)
export async function tryAutoRestoreCloudSession(): Promise<GateStatus | null> {
  const saved = loadSavedSession();
  if (!saved || !saved.rememberMe) return null;

  try {
    const gateStatus = await rawApi.switchUserVault({
      username: saved.username,
      password: saved.password,
      migrateCurrent: false
    });
    currentSession = saved;
    saveSessionToStorage(saved);

    // Pull latest cloud changes in background/startup
    pullCloudVaultToLocal(true)
      .then((res) => {
        if (!res.hadCloudData) {
          pushLocalVaultToCloud(true).catch(() => {});
        }
      })
      .catch(() => {});

    startCloudSyncWatcher();

    return {
      ...gateStatus,
      isUnlocked: true,
      activeUsername: saved.username,
      activeDisplayName: saved.displayName,
      activeCompanyTitle: saved.companyTitle
    };
  } catch {
    return null;
  }
}

export async function logoutCloudAccount(): Promise<GateStatus> {
  // Push any final pending changes before logging out
  if (currentSession) {
    try {
      await pushLocalVaultToCloud(true);
    } catch {}
  }
  stopCloudSyncWatcher();
  saveSessionToStorage(null);
  return rawApi.lockVault();
}
