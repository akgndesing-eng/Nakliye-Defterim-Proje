import { ElectronApi } from '../../preload/preload';
import { mobileStorageApi } from './mobileStorage';
import { scheduleCloudPush } from './cloudSync';

declare global {
  interface Window {
    api?: ElectronApi;
  }
}

// Fast in-memory synchronous cache for 0ms tab transitions (Stale-While-Revalidate)
const memoryCache = new Map<string, any>();

export function getCached<T>(key: string): T | null {
  return memoryCache.has(key) ? (memoryCache.get(key) as T) : null;
}

export function setCached(key: string, value: any): void {
  memoryCache.set(key, value);
}

export function clearErpCache(): void {
  for (const key of Array.from(memoryCache.keys())) {
    if (!key.startsWith('live:')) {
      memoryCache.delete(key);
    }
  }
}

function onErpMutation(): void {
  clearErpCache();
  scheduleCloudPush();
}

if (typeof window !== 'undefined') {
  window.addEventListener('nd-cloud-sync-updated', () => {
    clearErpCache();
  });
}

// When running inside Electron on desktop, window.api is injected via preload.
// When running inside Capacitor APK on Android / mobile, mobileStorageApi provides
// full offline AES-256 encrypted local persistence.
const rawApi: ElectronApi = window.api || mobileStorageApi;

// Wrapped API that automatically caches reads, invalidates on writes, and pushes to Cloud Sync
export const api: ElectronApi = {
  ...rawApi,
  getDashboard: async (selectedMonth?: string) => {
    const res = await rawApi.getDashboard(selectedMonth);
    setCached(`dashboard:${selectedMonth || ''}`, res);
    return res;
  },
  getNotifications: async () => {
    const res = await rawApi.getNotifications();
    setCached('notifications', res);
    return res;
  },
  getVehicles: async () => {
    const res = await rawApi.getVehicles();
    setCached('vehicles', res);
    return res;
  },
  saveVehicle: async (data: any) => {
    const res = await rawApi.saveVehicle(data);
    onErpMutation();
    return res;
  },
  deleteVehicle: async (id: string) => {
    const res = await rawApi.deleteVehicle(id);
    onErpMutation();
    return res;
  },
  getVehicleExpenses: async (filters?: { month?: string; vehicleId?: string }) => {
    const res = await rawApi.getVehicleExpenses(filters);
    setCached(`vehicleExpenses:${filters?.month || ''}:${filters?.vehicleId || ''}`, res);
    return res;
  },
  saveVehicleExpense: async (data: any) => {
    const res = await rawApi.saveVehicleExpense(data);
    onErpMutation();
    return res;
  },
  deleteVehicleExpense: async (id: string) => {
    const res = await rawApi.deleteVehicleExpense(id);
    onErpMutation();
    return res;
  },
  getDrivers: async () => {
    const res = await rawApi.getDrivers();
    setCached('drivers', res);
    return res;
  },
  saveDriver: async (data: any) => {
    const res = await rawApi.saveDriver(data);
    onErpMutation();
    return res;
  },
  deleteDriver: async (id: string) => {
    const res = await rawApi.deleteDriver(id);
    onErpMutation();
    return res;
  },
  getCustomers: async () => {
    const res = await rawApi.getCustomers();
    setCached('customers', res);
    return res;
  },
  saveCustomer: async (data: any) => {
    const res = await rawApi.saveCustomer(data);
    onErpMutation();
    return res;
  },
  deleteCustomer: async (id: string) => {
    const res = await rawApi.deleteCustomer(id);
    onErpMutation();
    return res;
  },
  addCustomerTransaction: async (payload: any) => {
    const res = await rawApi.addCustomerTransaction(payload);
    onErpMutation();
    return res;
  },
  getTrips: async (month?: string) => {
    const res = await rawApi.getTrips(month);
    setCached(`trips:${month || ''}`, res);
    return res;
  },
  saveTrip: async (payload: any) => {
    const res = await rawApi.saveTrip(payload);
    onErpMutation();
    return res;
  },
  updateTripStatus: async (tripId: string, status: string, invoiceStatus?: number) => {
    const res = await rawApi.updateTripStatus(tripId, status, invoiceStatus);
    onErpMutation();
    return res;
  },
  deleteTrip: async (tripId: string) => {
    const res = await rawApi.deleteTrip(tripId);
    onErpMutation();
    return res;
  },
  getStops: async (onlyOpen?: boolean) => {
    const res = await rawApi.getStops(onlyOpen);
    setCached(`stops:${onlyOpen ? 'open' : 'all'}`, res);
    return res;
  },
  collectStopPayment: async (payload: any) => {
    const res = await rawApi.collectStopPayment(payload);
    onErpMutation();
    return res;
  },
  getTasks: async () => {
    const res = await rawApi.getTasks();
    setCached('tasks', res);
    return res;
  },
  saveTask: async (data: any) => {
    const res = await rawApi.saveTask(data);
    onErpMutation();
    return res;
  },
  toggleTaskStatus: async (id: string) => {
    const res = await rawApi.toggleTaskStatus(id);
    onErpMutation();
    return res;
  },
  deleteTask: async (id: string) => {
    const res = await rawApi.deleteTask(id);
    onErpMutation();
    return res;
  },
  getReminderNotes: async () => {
    const res = await rawApi.getReminderNotes();
    setCached('notes', res);
    return res;
  },
  saveReminderNote: async (data: any) => {
    const res = await rawApi.saveReminderNote(data);
    onErpMutation();
    return res;
  },
  toggleReminderNote: async (id: string) => {
    const res = await rawApi.toggleReminderNote(id);
    onErpMutation();
    return res;
  },
  deleteReminderNote: async (id: string) => {
    const res = await rawApi.deleteReminderNote(id);
    onErpMutation();
    return res;
  },
  getMonthlyReports: async () => {
    const res = await rawApi.getMonthlyReports();
    setCached('reports', res);
    return res;
  },
  getMgmWeather: async () => {
    const res = await rawApi.getMgmWeather();
    setCached('live:weather', res);
    return res;
  },
  getMarketsBundle: async () => {
    const res = await rawApi.getMarketsBundle();
    setCached('live:markets', res);
    return res;
  },
  getVillageTankers: async () => {
    const res = await rawApi.getVillageTankers();
    setCached('villageTankers', res);
    return res;
  },
  saveVillageTanker: async (data: any) => {
    const res = await rawApi.saveVillageTanker(data);
    onErpMutation();
    return res;
  },
  deleteVillageTanker: async (id: string) => {
    const res = await rawApi.deleteVillageTanker(id);
    onErpMutation();
    return res;
  },
  getVillageTankerLogs: async (tankerId?: string) => {
    const res = await rawApi.getVillageTankerLogs(tankerId);
    setCached(`villageTankerLogs:${tankerId || 'all'}`, res);
    return res;
  },
  saveVillageTankerLog: async (data: any) => {
    const res = await rawApi.saveVillageTankerLog(data);
    onErpMutation();
    return res;
  },
  deleteVillageTankerLog: async (id: string) => {
    const res = await rawApi.deleteVillageTankerLog(id);
    onErpMutation();
    return res;
  },
  getVehicleDocuments: async (vehicleId?: string) => {
    const res = await rawApi.getVehicleDocuments(vehicleId);
    setCached(`vehicleDocs:${vehicleId || 'all'}`, res);
    return res;
  },
  saveVehicleDocument: async (data: any) => {
    const res = await rawApi.saveVehicleDocument(data);
    onErpMutation();
    return res;
  },
  deleteVehicleDocument: async (id: string) => {
    const res = await rawApi.deleteVehicleDocument(id);
    onErpMutation();
    return res;
  },
  getVehicleDocumentFiles: async (vehicleId?: string) => {
    const res = await rawApi.getVehicleDocumentFiles(vehicleId);
    setCached(`vehicleDocFiles:${vehicleId || 'all'}`, res);
    return res;
  },
  saveVehicleDocumentFile: async (data: any) => {
    const res = await rawApi.saveVehicleDocumentFile(data);
    onErpMutation();
    return res;
  },
  deleteVehicleDocumentFile: async (id: string) => {
    const res = await rawApi.deleteVehicleDocumentFile(id);
    onErpMutation();
    return res;
  },
  showOsNotification: async (title: string, body: string) => {
    return rawApi.showOsNotification(title, body);
  },
  saveDocumentFile: async (fileName: string, dataUrl: string) => {
    return rawApi.saveDocumentFile(fileName, dataUrl);
  }
};

// Preload all core ERP tables into memory once unlocked so tab switching is 100% instant
export async function preloadAllErpData(selectedMonth: string): Promise<void> {
  try {
    await Promise.all([
      api.getDashboard(selectedMonth),
      api.getVehicles(),
      api.getVehicleDocuments(),
      api.getVehicleDocumentFiles(),
      api.getCustomers(),
      api.getDrivers(),
      api.getTrips(),
      api.getStops(false),
      api.getStops(true),
      api.getTasks(),
      api.getReminderNotes(),
      api.getMonthlyReports(),
      api.getVillageTankers(),
      api.getVillageTankerLogs('all')
    ]);
  } catch {}
  api.getMgmWeather().catch(() => {});
  api.getMarketsBundle().catch(() => {});
}
