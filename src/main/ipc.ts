import { ipcMain, shell } from 'electron';
import { ErpService } from './services/erpService';
import { LiveFeedService } from './services/liveFeedService';

export function registerIpcHandlers(): void {
  const erp = new ErpService();
  const liveFeed = new LiveFeedService();

  // 1. Gate & Security
  ipcMain.handle('gate:status', async () => erp.getGateStatus());
  ipcMain.handle('gate:setup', async (_, password: string) => erp.setupVault(password));
  ipcMain.handle('gate:unlock', async (_, password: string) => erp.unlock(password));
  ipcMain.handle('gate:lock', async () => erp.lock());
  ipcMain.handle('gate:exportBackup', async () => erp.exportEncryptedBackup());
  ipcMain.handle('gate:importBackup', async (_, { password, filePath }: { password: string; filePath?: string }) =>
    erp.importEncryptedBackup(password, filePath)
  );
  ipcMain.handle('gate:getAutoBackupStatus', async () => erp.getAutoBackupStatus());
  ipcMain.handle('gate:setAutoBackupInterval', async (_, minutes: number) => erp.setAutoBackupInterval(minutes));
  ipcMain.handle('gate:runAutoBackupNow', async (_, reason?: string) => erp.runAutoBackupNow(reason));
  ipcMain.handle('gate:openAutoBackupFolder', async () => {
    const st = erp.getAutoBackupStatus();
    if (st.backupDir) {
      await shell.openPath(st.backupDir);
    }
    return true;
  });

  // 2. Dashboard & Global Search & Notifications
  ipcMain.handle('erp:getDashboard', async (_, selectedMonth?: string) => erp.getDashboardData(selectedMonth));
  ipcMain.handle('erp:globalSearch', async (_, query: string) => erp.globalSearch(query));
  ipcMain.handle('erp:getNotifications', async () => erp.getNotifications());

  // 3. Vehicles & Monthly Expenses
  ipcMain.handle('erp:getVehicles', async () => erp.getVehicles());
  ipcMain.handle('erp:saveVehicle', async (_, data) => erp.saveVehicle(data));
  ipcMain.handle('erp:deleteVehicle', async (_, id: string) => erp.deleteVehicle(id));
  ipcMain.handle('erp:getVehicleExpenses', async (_, { month, vehicleId }: { month?: string; vehicleId?: string } = {}) =>
    erp.getVehicleExpenses(month, vehicleId)
  );
  ipcMain.handle('erp:saveVehicleExpense', async (_, data) => erp.saveVehicleExpense(data));
  ipcMain.handle('erp:deleteVehicleExpense', async (_, id: string) => erp.deleteVehicleExpense(id));

  // 4. Drivers
  ipcMain.handle('erp:getDrivers', async () => erp.getDrivers());
  ipcMain.handle('erp:saveDriver', async (_, data) => erp.saveDriver(data));
  ipcMain.handle('erp:deleteDriver', async (_, id: string) => erp.deleteDriver(id));

  // 5. Customers & Statements
  ipcMain.handle('erp:getCustomers', async () => erp.getCustomers());
  ipcMain.handle('erp:saveCustomer', async (_, data) => erp.saveCustomer(data));
  ipcMain.handle('erp:deleteCustomer', async (_, id: string) => erp.deleteCustomer(id));
  ipcMain.handle('erp:getCustomerDetail', async (_, customerId: string) => erp.getCustomerDetail(customerId));
  ipcMain.handle('erp:addCustomerTransaction', async (_, payload) => erp.addCustomerManualTransaction(payload));

  // 6. Trips & Multi-Stops & Payments
  ipcMain.handle('erp:getTrips', async (_, month?: string) => erp.getTrips(month));
  ipcMain.handle('erp:saveTrip', async (_, payload) => erp.saveTrip(payload));
  ipcMain.handle('erp:updateTripStatus', async (_, { tripId, status, invoiceStatus }) =>
    erp.updateTripStatus(tripId, status, invoiceStatus)
  );
  ipcMain.handle('erp:deleteTrip', async (_, tripId: string) => erp.deleteTrip(tripId));
  ipcMain.handle('erp:getStops', async (_, onlyOpen?: boolean) => erp.getAllStopsWithDetails(onlyOpen));
  ipcMain.handle('erp:collectStopPayment', async (_, payload) => erp.collectStopPayment(payload));

  // 7. Tasks & Reminder Notes & Reports
  ipcMain.handle('erp:getTasks', async () => erp.getTasks());
  ipcMain.handle('erp:saveTask', async (_, data) => erp.saveTask(data));
  ipcMain.handle('erp:toggleTaskStatus', async (_, id: string) => erp.toggleTaskStatus(id));
  ipcMain.handle('erp:deleteTask', async (_, id: string) => erp.deleteTask(id));

  ipcMain.handle('erp:getReminderNotes', async () => erp.getReminderNotes());
  ipcMain.handle('erp:saveReminderNote', async (_, data) => erp.saveReminderNote(data));
  ipcMain.handle('erp:toggleReminderNote', async (_, id: string) => erp.toggleReminderNote(id));
  ipcMain.handle('erp:deleteReminderNote', async (_, id: string) => erp.deleteReminderNote(id));

  ipcMain.handle('erp:getMonthlyReports', async () => erp.getMonthlyReports());

  // 8. Live Internet Feeds (MGM Weather, Harem Altın, ICE/NYMEX Commodities)
  ipcMain.handle('live:getMgmWeather', async () => liveFeed.fetchMgmEdirneWeather());
  ipcMain.handle('live:getMarketsBundle', async () => liveFeed.fetchLiveMarketsBundle());

  // 9. External URL Launcher (WhatsApp etc.)
  ipcMain.handle('erp:openExternal', async (_, url: string) => {
    await shell.openExternal(url);
    return true;
  });

  // 10. Isolated Village Tankers (Köy Küçük Tankerleri Takip Sistemi)
  ipcMain.handle('erp:getVillageTankers', async () => erp.getVillageTankers());
  ipcMain.handle('erp:saveVillageTanker', async (_, data) => erp.saveVillageTanker(data));
  ipcMain.handle('erp:deleteVillageTanker', async (_, id: string) => erp.deleteVillageTanker(id));
  ipcMain.handle('erp:getVillageTankerLogs', async (_, tankerId?: string) => erp.getVillageTankerLogs(tankerId));
  ipcMain.handle('erp:saveVillageTankerLog', async (_, data) => erp.saveVillageTankerLog(data));
  ipcMain.handle('erp:deleteVillageTankerLog', async (_, id: string) => erp.deleteVillageTankerLog(id));
}
