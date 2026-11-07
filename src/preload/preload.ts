import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Gate & Security
  getGateStatus: () => ipcRenderer.invoke('gate:status'),
  setupVault: (password: string) => ipcRenderer.invoke('gate:setup', password),
  unlockVault: (password: string) => ipcRenderer.invoke('gate:unlock', password),
  lockVault: () => ipcRenderer.invoke('gate:lock'),
  exportEncryptedBackup: () => ipcRenderer.invoke('gate:exportBackup'),
  importEncryptedBackup: (password: string, filePath?: string) =>
    ipcRenderer.invoke('gate:importBackup', { password, filePath }),
  getAutoBackupStatus: () => ipcRenderer.invoke('gate:getAutoBackupStatus'),
  setAutoBackupInterval: (minutes: number) => ipcRenderer.invoke('gate:setAutoBackupInterval', minutes),
  runAutoBackupNow: (reason?: string) => ipcRenderer.invoke('gate:runAutoBackupNow', reason),
  openAutoBackupFolder: () => ipcRenderer.invoke('gate:openAutoBackupFolder'),

  // Dashboard & Search & Notifications
  getDashboard: (selectedMonth?: string) => ipcRenderer.invoke('erp:getDashboard', selectedMonth),
  globalSearch: (query: string) => ipcRenderer.invoke('erp:globalSearch', query),
  getNotifications: () => ipcRenderer.invoke('erp:getNotifications'),

  // Vehicles & Expenses
  getVehicles: () => ipcRenderer.invoke('erp:getVehicles'),
  saveVehicle: (data: any) => ipcRenderer.invoke('erp:saveVehicle', data),
  deleteVehicle: (id: string) => ipcRenderer.invoke('erp:deleteVehicle', id),
  getVehicleExpenses: (filters?: { month?: string; vehicleId?: string }) =>
    ipcRenderer.invoke('erp:getVehicleExpenses', filters || {}),
  saveVehicleExpense: (data: any) => ipcRenderer.invoke('erp:saveVehicleExpense', data),
  deleteVehicleExpense: (id: string) => ipcRenderer.invoke('erp:deleteVehicleExpense', id),

  // Drivers
  getDrivers: () => ipcRenderer.invoke('erp:getDrivers'),
  saveDriver: (data: any) => ipcRenderer.invoke('erp:saveDriver', data),
  deleteDriver: (id: string) => ipcRenderer.invoke('erp:deleteDriver', id),

  // Customers & Statements
  getCustomers: () => ipcRenderer.invoke('erp:getCustomers'),
  saveCustomer: (data: any) => ipcRenderer.invoke('erp:saveCustomer', data),
  deleteCustomer: (id: string) => ipcRenderer.invoke('erp:deleteCustomer', id),
  getCustomerDetail: (customerId: string) => ipcRenderer.invoke('erp:getCustomerDetail', customerId),
  addCustomerTransaction: (payload: any) => ipcRenderer.invoke('erp:addCustomerTransaction', payload),

  // Trips & Stops & Payments
  getTrips: (month?: string) => ipcRenderer.invoke('erp:getTrips', month),
  saveTrip: (payload: any) => ipcRenderer.invoke('erp:saveTrip', payload),
  updateTripStatus: (tripId: string, status: string, invoiceStatus?: number) =>
    ipcRenderer.invoke('erp:updateTripStatus', { tripId, status, invoiceStatus }),
  deleteTrip: (tripId: string) => ipcRenderer.invoke('erp:deleteTrip', tripId),
  getStops: (onlyOpen?: boolean) => ipcRenderer.invoke('erp:getStops', onlyOpen),
  collectStopPayment: (payload: any) => ipcRenderer.invoke('erp:collectStopPayment', payload),

  // Tasks & Reminder Notes & Reports
  getTasks: () => ipcRenderer.invoke('erp:getTasks'),
  saveTask: (data: any) => ipcRenderer.invoke('erp:saveTask', data),
  toggleTaskStatus: (id: string) => ipcRenderer.invoke('erp:toggleTaskStatus', id),
  deleteTask: (id: string) => ipcRenderer.invoke('erp:deleteTask', id),

  getReminderNotes: () => ipcRenderer.invoke('erp:getReminderNotes'),
  saveReminderNote: (data: any) => ipcRenderer.invoke('erp:saveReminderNote', data),
  toggleReminderNote: (id: string) => ipcRenderer.invoke('erp:toggleReminderNote', id),
  deleteReminderNote: (id: string) => ipcRenderer.invoke('erp:deleteReminderNote', id),

  getMonthlyReports: () => ipcRenderer.invoke('erp:getMonthlyReports'),

  // Live Internet Feeds (MGM & Harem Altın & Commodities)
  getMgmWeather: () => ipcRenderer.invoke('live:getMgmWeather'),
  getMarketsBundle: () => ipcRenderer.invoke('live:getMarketsBundle'),

  // External URL
  openExternal: (url: string) => ipcRenderer.invoke('erp:openExternal', url),

  // Isolated Village Tankers (Köy Küçük Tankerleri)
  getVillageTankers: () => ipcRenderer.invoke('erp:getVillageTankers'),
  saveVillageTanker: (data: any) => ipcRenderer.invoke('erp:saveVillageTanker', data),
  deleteVillageTanker: (id: string) => ipcRenderer.invoke('erp:deleteVillageTanker', id),
  getVillageTankerLogs: (tankerId?: string) => ipcRenderer.invoke('erp:getVillageTankerLogs', tankerId),
  saveVillageTankerLog: (data: any) => ipcRenderer.invoke('erp:saveVillageTankerLog', data),
  deleteVillageTankerLog: (id: string) => ipcRenderer.invoke('erp:deleteVillageTankerLog', id)
};

contextBridge.exposeInMainWorld('api', api);

export type ElectronApi = typeof api;
