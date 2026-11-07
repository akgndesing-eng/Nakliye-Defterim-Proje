import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  setupInitialVault,
  unlockVault,
  lockVault,
  closeDatabase,
  isVaultUnlocked,
  getDb
} from '../src/main/db/database';
import { ErpService } from '../src/main/services/erpService';

describe('Nakliye Defterim v4.5 — Master Specification Acceptance Tests', () => {
  const TEST_PASSWORD = 'UmutBeyMasterPass2026!';
  let erp: ErpService;

  beforeEach(() => {
    erp = new ErpService();
    setupInitialVault(TEST_PASSWORD);
  });

  afterEach(() => {
    lockVault();
  });

  afterAll(() => {
    closeDatabase();
    const testVaultDir = path.join(process.cwd(), '.test_vault_v45');
    if (fs.existsSync(testVaultDir)) {
      try {
        fs.rmSync(testVaultDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it('1. Gate Screen & AES-256 Vault Security: enforces >= 10 char password, locks & unlocks properly', () => {
    expect(isVaultUnlocked()).toBe(true);
    expect(() => setupInitialVault('short123')).toThrow();

    erp.lock();
    expect(isVaultUnlocked()).toBe(false);
    expect(() => getDb()).toThrow(/LOCKED/);

    // Wrong password must fail
    expect(() => erp.unlock('WrongPassword12345!')).toThrow();
    expect(isVaultUnlocked()).toBe(false);

    // Correct password unlocks
    const st = erp.unlock(TEST_PASSWORD);
    expect(st.isUnlocked).toBe(true);
  });

  it('2. SQLite Schema & Seed Data: creates all 8 required tables + seed records', () => {
    const vehicles = erp.getVehicles();
    const drivers = erp.getDrivers();
    const customers = erp.getCustomers();
    const trips = erp.getTrips();
    const tasks = erp.getTasks();
    const notes = erp.getReminderNotes();

    expect(vehicles.length).toBeGreaterThanOrEqual(3);
    expect(drivers.length).toBeGreaterThanOrEqual(3);
    expect(customers.length).toBeGreaterThanOrEqual(4);
    expect(trips.length).toBeGreaterThanOrEqual(3);
    expect(tasks.length).toBeGreaterThanOrEqual(3);
    expect(notes.length).toBeGreaterThanOrEqual(2);
  });

  it('3. Multi-Stop Trips & Stop-Level Partial Payment Engine: updates stop status and customer balance', () => {
    const vehicles = erp.getVehicles();
    const customers = erp.getCustomers();
    const c1 = customers[0];
    const c2 = customers[1];

    const newTrip = erp.saveTrip({
      trip_no: 'SFR-TEST-900',
      trip_date: '2026-11-05',
      vehicle_id: vehicles[0].id,
      driver_name: 'Test Şoför',
      origin: 'TÜPRAŞ İzmit',
      destination: 'Edirne & Uzunköprü',
      status: 'transit',
      fuel_cost: 8000,
      road_cost: 1200,
      other_cost: 300,
      invoice_status: 1,
      stops: [
        {
          stop_order: 1,
          customer_id: c1.id,
          delivered_item: 'Motorin',
          quantity: 15000,
          stop_amount: 25000,
          due_date: '2026-11-10',
          paid_amount: 0
        },
        {
          stop_order: 2,
          customer_id: c2.id,
          delivered_item: 'Kurşunsuz 95',
          quantity: 12000,
          stop_amount: 20000,
          due_date: '2026-11-12',
          paid_amount: 0
        }
      ]
    });

    expect(newTrip.total_freight).toBe(45000);
    expect(newTrip.stops.length).toBe(2);

    const stop1 = newTrip.stops[0];
    // Collect partial payment (10,000 TL out of 25,000 TL)
    const afterPartial = erp.collectStopPayment({
      stop_id: stop1.id,
      payment_amount: 10000,
      payment_date: '2026-11-05',
      notes: 'Kısmi EFT'
    });
    expect(afterPartial.paid_amount).toBe(10000);
    expect(afterPartial.payment_status).toBe('partial');

    // Collect remaining 15,000 TL
    const afterFull = erp.collectStopPayment({
      stop_id: stop1.id,
      payment_amount: 15000,
      payment_date: '2026-11-05',
      notes: 'Kalan Bakiye Kapama'
    });
    expect(afterFull.paid_amount).toBe(25000);
    expect(afterFull.payment_status).toBe('paid');
  });

  it('4. Dashboard KPI, 6-Month Chart, Global Search & Monthly Reports work seamlessly', () => {
    const dash = erp.getDashboardData('2026-11');
    expect(dash.totalFleetCount).toBeGreaterThanOrEqual(3);
    expect(dash.sixMonthsChart.length).toBe(6);

    const searchRes = erp.globalSearch('22 AB');
    expect(searchRes.some((r) => r.category === 'vehicle')).toBe(true);

    const reports = erp.getMonthlyReports();
    expect(reports.length).toBeGreaterThanOrEqual(1);
  });

  it('5. Fleet Vehicles, Documents (Inspection/Insurance), Drivers & Monthly Extra Expenses CRUD', () => {
    const savedVeh = erp.saveVehicle({
      plate: '22 ND 450',
      driver_name: 'Hasan Demir',
      vehicle_type: 'tanker',
      fuel_capacity: 34000,
      inspection_date: '2026-11-20',
      insurance_date: '2026-12-01',
      notes: 'ADR Tanker Test'
    });
    expect(savedVeh.plate).toBe('22 ND 450');

    const savedExp = erp.saveVehicleExpense({
      vehicle_id: savedVeh.id,
      expense_date: '2026-11-05',
      expense_month: '2026-11',
      title: 'Periyodik Bakım & ADR Muayene Hazırlık',
      amount: 14500
    });
    expect(savedExp.amount).toBe(14500);

    const expenses = erp.getVehicleExpenses('2026-11', savedVeh.id);
    expect(expenses.some((e) => e.id === savedExp.id)).toBe(true);

    const notifs = erp.getNotifications();
    expect(notifs.some((n) => n.entityId === savedVeh.id)).toBe(true);
  });

  it('6. Historical Month Records & Customer Statement Ledger Verification', () => {
    const customers = erp.getCustomers();
    const vehicles = erp.getVehicles();

    // Create a past month trip (2026-09)
    erp.saveTrip({
      trip_no: 'SFR-2026-099',
      trip_date: '2026-09-18',
      vehicle_id: vehicles[0].id,
      driver_name: vehicles[0].driver_name,
      origin: 'TÜPRAŞ Aliağa',
      destination: 'Keşan İstasyon',
      status: 'delivered',
      fuel_cost: 6500,
      road_cost: 900,
      other_cost: 0,
      invoice_status: 1,
      stops: [
        {
          stop_order: 1,
          customer_id: customers[0].id,
          delivered_item: 'Motorin',
          quantity: 20000,
          stop_amount: 32000,
          due_date: '2026-09-25',
          paid_amount: 12000
        }
      ]
    });

    const sepTrips = erp.getTrips('2026-09');
    expect(sepTrips.length).toBeGreaterThanOrEqual(1);

    const reports = erp.getMonthlyReports();
    const sepReport = reports.find((r) => r.month === '2026-09');
    expect(sepReport).toBeDefined();
    expect(sepReport!.totalRevenue).toBeGreaterThanOrEqual(32000);

    const detail = erp.getCustomerDetail(customers[0].id);
    expect(detail.customer.id).toBe(customers[0].id);
    expect(detail.statement.length).toBeGreaterThan(0);
  });

  it('7. Data Persistence Across Application Close & Reopen (Zero Data Loss Verification)', () => {
    const newCust = erp.saveCustomer({
      name: 'Kalıcılık Test İstasyonu A.Ş.',
      company_title: 'Kalıcılık Petrol Ltd.',
      phone: '05329998877',
      city: 'Edirne / Merkez',
      address: 'Londra Asfaltı No:10',
      notes: 'Veri koruma testi'
    });

    const beforeCount = erp.getCustomers().length;

    // Simulate closing the application completely (flushing encrypted vault to disk)
    closeDatabase();
    expect(isVaultUnlocked()).toBe(false);

    // Simulate reopening the application and unlocking with master password
    const unlockSt = erp.unlock(TEST_PASSWORD);
    expect(unlockSt.isUnlocked).toBe(true);

    const afterCustomers = erp.getCustomers();
    expect(afterCustomers.length).toBe(beforeCount);
    expect(afterCustomers.some((c) => c.id === newCust.id && c.name === 'Kalıcılık Test İstasyonu A.Ş.')).toBe(true);
  });

  it('8. Village Tankers (Tanker Takip) 100% Isolation & Past Months Archive Editing', () => {
    const reportsBefore = erp.getMonthlyReports();
    const totalRevBefore = reportsBefore.reduce((acc, r) => acc + r.totalRevenue, 0);

    // Add a village tanker and a distribution log
    const vt = erp.saveVillageTanker({
      name: 'Köy Tankeri Test #9',
      plate_or_code: '22 KÖY 99',
      village_name: 'Lalapaşa Köyü',
      capacity_liters: 4000,
      current_fuel_liters: 2500,
      driver_name: 'Köy Görevlisi Ali',
      driver_phone: '05331112233',
      status: 'active',
      notes: 'İzole test'
    });
    expect(vt.name).toBe('Köy Tankeri Test #9');

    const vtLog = erp.saveVillageTankerLog({
      tanker_id: vt.id,
      log_date: '2026-11-05',
      villager_or_target: 'Traktör 22 TR 100',
      operation_type: 'dagitim',
      fuel_type: 'Motorin',
      liters: 500,
      cash_amount: 10000,
      card_amount: 5000,
      credit_sale_amount: 6500,
      credit_collected_amount: 2000,
      driver_name: 'Köy Görevlisi Ali',
      notes: 'Harman dağıtımı'
    });
    expect(vtLog.liters).toBe(500);
    expect(vtLog.amount).toBe(21500);
    expect(vtLog.cash_amount).toBe(10000);
    expect(vtLog.credit_collected_amount).toBe(2000);

    // Verify village tanker current_fuel_liters updated automatically (2500 - 500 = 2000)
    const updatedVt = erp.getVillageTankers().find((x) => x.id === vt.id);
    expect(updatedVt?.current_fuel_liters).toBe(2000);

    // CRITICAL: Verify main nakliye reports & revenue are 100% untouched by village tanker logs
    const reportsAfter = erp.getMonthlyReports();
    const totalRevAfter = reportsAfter.reduce((acc, r) => acc + r.totalRevenue, 0);
    expect(totalRevAfter).toBe(totalRevBefore);

    // CRITICAL: Verify adding a vehicle expense in Araçlar does NOT alter nakliye net profit or expenses
    const netProfitBeforeExp = reportsAfter.reduce((acc, r) => acc + r.netOperatingProfit, 0);
    const vehs = erp.getVehicles();
    erp.saveVehicleExpense({
      vehicle_id: vehs[0].id,
      expense_date: '2026-11-06',
      expense_month: '2026-11',
      title: 'İzole Araç Gideri Testi',
      amount: 99999
    });
    const reportsAfterVehExp = erp.getMonthlyReports();
    const netProfitAfterExp = reportsAfterVehExp.reduce((acc, r) => acc + r.netOperatingProfit, 0);
    expect(netProfitAfterExp).toBe(netProfitBeforeExp);
  });

  it('9. Automatic Periodic & On-Change Encrypted Backup System', async () => {
    // Because data changes happened in earlier tests, rolling auto-backup should already exist
    const stInitial = erp.getAutoBackupStatus();
    expect(stInitial.totalCount).toBeGreaterThan(0);

    // Update interval to 5 minutes
    const stUpdated = erp.setAutoBackupInterval(5);
    expect(stUpdated.intervalMinutes).toBe(5);
    expect(stUpdated.enabled).toBe(true);

    // Trigger an immediate timestamped automatic backup
    const snapRes = erp.runAutoBackupNow('Test Otomatik Yedek');
    expect(snapRes.success).toBe(true);
    expect(snapRes.status.backups.length).toBeGreaterThanOrEqual(2);

    const latestBackupFile = snapRes.status.backups[0].filePath;
    // Restore from the automatic backup file using test master password
    const restoreRes = await erp.importEncryptedBackup(TEST_PASSWORD, latestBackupFile);
    expect(restoreRes.success).toBe(true);

    // Verify data integrity after restoring from automatic backup
    const vehiclesAfterRestore = erp.getVehicles();
    expect(vehiclesAfterRestore.length).toBeGreaterThan(0);
  });
});
