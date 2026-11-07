import crypto from 'crypto';
import fs from 'fs';
import { dialog } from 'electron';
import {
  getDb,
  syncEncryptedVault,
  isVaultInitialized,
  isVaultUnlocked,
  getEncryptedVaultPath,
  setupInitialVault,
  unlockVault,
  lockVault,
  encryptBufferWithPassword,
  decryptBufferWithPassword,
  createAutoBackupSnapshot,
  getAutoBackupStatus,
  setAutoBackupIntervalMinutes,
  VaultEnvelope
} from '../db/database';
import {
  GateStatus,
  AutoBackupStatus,
  Vehicle,
  Driver,
  Customer,
  Trip,
  TripStop,
  VehicleExpense,
  TaskItem,
  ReminderNote,
  CustomerDetailProfile,
  CustomerStatementItem,
  DashboardData,
  MonthlyChartPoint,
  AppNotification,
  GlobalSearchResult,
  MonthlyReportSummary,
  VillageTanker,
  VillageTankerLog
} from '../../shared/types';

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currentMonthISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

const TURKISH_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export class ErpService {
  // ==========================================
  // 1. GATE & SECURITY (KİLİT EKRANI VE YEDEK)
  // ==========================================
  getGateStatus(): GateStatus {
    return {
      isInitialized: isVaultInitialized(),
      isUnlocked: isVaultUnlocked(),
      vaultPath: getEncryptedVaultPath()
    };
  }

  setupVault(password: string): GateStatus {
    setupInitialVault(password);
    return this.getGateStatus();
  }

  unlock(password: string): GateStatus {
    unlockVault(password);
    return this.getGateStatus();
  }

  lock(): GateStatus {
    lockVault();
    return this.getGateStatus();
  }

  // Recalculate a customer's current_balance from unpaid trip_stops + manual transactions
  recalculateCustomerBalance(customerId: string): number {
    const db = getDb();
    const stopRow = db.prepare(`
      SELECT COALESCE(SUM(stop_amount - paid_amount), 0) AS open_stops
      FROM trip_stops
      WHERE customer_id = ?
    `).get(customerId) as { open_stops: number };

    const txRow = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN tx_type = 'debit' THEN amount ELSE 0 END), 0) AS extra_debit,
        COALESCE(SUM(CASE WHEN tx_type = 'credit' AND trip_stop_id IS NULL THEN amount ELSE 0 END), 0) AS general_credit
      FROM customer_transactions
      WHERE customer_id = ?
    `).get(customerId) as { extra_debit: number; general_credit: number };

    const balance = Math.max(0, Number(stopRow.open_stops || 0) + Number(txRow.extra_debit || 0) - Number(txRow.general_credit || 0));
    db.prepare('UPDATE customers SET current_balance = ? WHERE id = ?').run(balance, customerId);
    return balance;
  }

  recalculateAllCustomerBalances(): void {
    const db = getDb();
    const rows = db.prepare('SELECT id FROM customers').all() as { id: string }[];
    for (const r of rows) {
      this.recalculateCustomerBalance(r.id);
    }
  }

  // ==========================================
  // 2. ARAÇLAR (VEHICLES) & AYLIK EK GİDERLER
  // ==========================================
  getVehicles(): Vehicle[] {
    const db = getDb();
    return db.prepare('SELECT * FROM vehicles ORDER BY plate ASC').all() as Vehicle[];
  }

  saveVehicle(data: Partial<Vehicle>): Vehicle {
    const db = getDb();
    const id = data.id || genId('veh');
    const existing = db.prepare('SELECT id FROM vehicles WHERE id = ?').get(id);

    if (existing) {
      db.prepare(`
        UPDATE vehicles
        SET plate = ?, driver_name = ?, vehicle_type = ?, fuel_capacity = ?, inspection_date = ?, insurance_date = ?, notes = ?
        WHERE id = ?
      `).run(
        (data.plate || '').trim().toUpperCase(),
        data.driver_name || '',
        data.vehicle_type || 'tanker',
        Number(data.fuel_capacity || 0),
        data.inspection_date || null,
        data.insurance_date || null,
        data.notes || '',
        id
      );
    } else {
      db.prepare(`
        INSERT INTO vehicles (id, plate, driver_name, vehicle_type, fuel_capacity, inspection_date, insurance_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        (data.plate || '').trim().toUpperCase(),
        data.driver_name || '',
        data.vehicle_type || 'tanker',
        Number(data.fuel_capacity || 0),
        data.inspection_date || null,
        data.insurance_date || null,
        data.notes || ''
      );
    }
    syncEncryptedVault();
    return db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Vehicle;
  }

  deleteVehicle(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
    syncEncryptedVault();
    return true;
  }

  getVehicleExpenses(month?: string, vehicleId?: string): VehicleExpense[] {
    const db = getDb();
    let sql = `
      SELECT ve.*, v.plate AS vehicle_plate
      FROM vehicle_expenses ve
      LEFT JOIN vehicles v ON v.id = ve.vehicle_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (month) {
      sql += ' AND ve.expense_month = ?';
      params.push(month);
    }
    if (vehicleId) {
      sql += ' AND ve.vehicle_id = ?';
      params.push(vehicleId);
    }
    sql += ' ORDER BY ve.expense_date DESC, ve.id DESC';
    return db.prepare(sql).all(...params) as VehicleExpense[];
  }

  saveVehicleExpense(data: Partial<VehicleExpense>): VehicleExpense {
    const db = getDb();
    const id = data.id || genId('exp');
    const expDate = data.expense_date || todayISO();
    const expMonth = data.expense_month || expDate.slice(0, 7);

    db.prepare(`
      INSERT OR REPLACE INTO vehicle_expenses (id, vehicle_id, expense_date, expense_month, title, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.vehicle_id, expDate, expMonth, (data.title || '').trim(), Number(data.amount || 0));

    syncEncryptedVault();
    return db.prepare(`
      SELECT ve.*, v.plate AS vehicle_plate
      FROM vehicle_expenses ve
      LEFT JOIN vehicles v ON v.id = ve.vehicle_id
      WHERE ve.id = ?
    `).get(id) as VehicleExpense;
  }

  deleteVehicleExpense(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM vehicle_expenses WHERE id = ?').run(id);
    syncEncryptedVault();
    return true;
  }

  // ==========================================
  // 3. ŞOFÖRLER (DRIVERS)
  // ==========================================
  getDrivers(): Driver[] {
    const db = getDb();
    return db.prepare(`
      SELECT d.*, v.plate AS active_vehicle_plate
      FROM drivers d
      LEFT JOIN vehicles v ON v.id = d.active_vehicle_id
      ORDER BY d.name ASC
    `).all() as Driver[];
  }

  saveDriver(data: Partial<Driver>): Driver {
    const db = getDb();
    const id = data.id || genId('drv');
    db.prepare(`
      INSERT OR REPLACE INTO drivers (id, name, phone, tc_no, license_type, active_vehicle_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      (data.name || '').trim(),
      data.phone || '',
      data.tc_no || '',
      data.license_type || 'CE + SRC5',
      data.active_vehicle_id || null,
      data.notes || ''
    );
    syncEncryptedVault();
    return db.prepare(`
      SELECT d.*, v.plate AS active_vehicle_plate
      FROM drivers d
      LEFT JOIN vehicles v ON v.id = d.active_vehicle_id
      WHERE d.id = ?
    `).get(id) as Driver;
  }

  deleteDriver(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM drivers WHERE id = ?').run(id);
    syncEncryptedVault();
    return true;
  }

  // ==========================================
  // 4. MÜŞTERİLER & CARİ (CUSTOMERS & PAYMENTS)
  // ==========================================
  getCustomers(): Customer[] {
    const db = getDb();
    this.recalculateAllCustomerBalances();
    const today = todayISO();

    const customers = db.prepare('SELECT * FROM customers ORDER BY current_balance DESC, name ASC').all() as Customer[];
    for (const c of customers) {
      const overdueRow = db.prepare(`
        SELECT
          COALESCE(SUM(stop_amount - paid_amount), 0) AS overdue_amt,
          MIN(due_date) AS min_due
        FROM trip_stops
        WHERE customer_id = ? AND payment_status != 'paid' AND due_date IS NOT NULL AND due_date < ?
      `).get(c.id, today) as { overdue_amt: number; min_due: string | null };

      const anyDueRow = db.prepare(`
        SELECT MIN(due_date) AS earliest_due
        FROM trip_stops
        WHERE customer_id = ? AND payment_status != 'paid'
      `).get(c.id) as { earliest_due: string | null };

      c.overdue_amount = Number(overdueRow.overdue_amt || 0);
      c.earliest_due_date = overdueRow.min_due || anyDueRow.earliest_due || null;
    }
    return customers;
  }

  saveCustomer(data: Partial<Customer>): Customer {
    const db = getDb();
    const id = data.id || genId('cust');
    const existing = db.prepare('SELECT id, current_balance FROM customers WHERE id = ?').get(id) as { id: string; current_balance: number } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE customers
        SET name = ?, company_title = ?, phone = ?, city = ?, address = ?, notes = ?
        WHERE id = ?
      `).run(
        (data.name || '').trim(),
        data.company_title || '',
        data.phone || '',
        data.city || 'Edirne',
        data.address || '',
        data.notes || '',
        id
      );
    } else {
      db.prepare(`
        INSERT INTO customers (id, name, company_title, phone, city, address, current_balance, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        (data.name || '').trim(),
        data.company_title || '',
        data.phone || '',
        data.city || 'Edirne',
        data.address || '',
        Number(data.current_balance || 0),
        data.notes || ''
      );
    }
    this.recalculateCustomerBalance(id);
    syncEncryptedVault();
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer;
  }

  deleteCustomer(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    syncEncryptedVault();
    return true;
  }

  getCustomerDetail(customerId: string): CustomerDetailProfile {
    const db = getDb();
    this.recalculateCustomerBalance(customerId);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as Customer;
    if (!customer) {
      throw new Error('Müşteri bulunamadı.');
    }

    const tripsHistory = db.prepare(`
      SELECT ts.*, t.trip_no, t.trip_date, t.origin, t.destination, t.driver_name, v.plate AS vehicle_plate
      FROM trip_stops ts
      JOIN trips t ON t.id = ts.trip_id
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE ts.customer_id = ?
      ORDER BY t.trip_date DESC, ts.stop_order ASC
    `).all(customerId) as TripStop[];

    const rawTxs = db.prepare(`
      SELECT * FROM customer_transactions
      WHERE customer_id = ?
      ORDER BY tx_date DESC, created_at DESC
    `).all(customerId) as any[];

    const statement: CustomerStatementItem[] = [];

    for (const s of tripsHistory) {
      statement.push({
        id: `stmt-stop-${s.id}`,
        date: s.trip_date || todayISO(),
        type: 'trip_stop',
        title: `Sefer Navlun (${s.trip_no || 'Sefer'})`,
        description: `${s.origin || ''} -> ${s.destination || ''} | ${s.delivered_item || 'Akaryakıt'} (${s.quantity || 0} Lt/Ton)`,
        debit: Number(s.stop_amount || 0),
        credit: 0,
        stop_id: s.id,
        due_date: s.due_date,
        payment_status: s.payment_status
      });

      if (Number(s.paid_amount || 0) > 0) {
        statement.push({
          id: `stmt-paid-${s.id}`,
          date: s.payment_date || s.trip_date || todayISO(),
          type: 'payment',
          title: `Durak Tahsilatı (${s.trip_no || ''})`,
          description: `${s.delivered_item || ''} sevkiyatı tahsilatı`,
          debit: 0,
          credit: Number(s.paid_amount || 0),
          stop_id: s.id
        });
      }
    }

    for (const tx of rawTxs) {
      // Avoid duplicating stop payments if already represented above
      if (tx.trip_stop_id) continue;
      statement.push({
        id: tx.id,
        date: tx.tx_date,
        type: tx.tx_type === 'debit' ? 'manual_debit' : 'payment',
        title: tx.tx_type === 'debit' ? 'Ek Cari Borç Kaydı' : 'Genel Cari Tahsilat',
        description: tx.description || '',
        debit: tx.tx_type === 'debit' ? Number(tx.amount) : 0,
        credit: tx.tx_type === 'credit' ? Number(tx.amount) : 0
      });
    }

    statement.sort((a, b) => b.date.localeCompare(a.date));

    const notes = db.prepare(`
      SELECT rn.*, c.name AS customer_name
      FROM reminder_notes rn
      LEFT JOIN customers c ON c.id = rn.customer_id
      WHERE rn.customer_id = ?
      ORDER BY rn.remind_date DESC
    `).all(customerId) as ReminderNote[];

    return {
      customer,
      tripsHistory,
      statement,
      notes
    };
  }

  addCustomerManualTransaction(payload: {
    customer_id: string;
    tx_type: 'debit' | 'credit';
    amount: number;
    tx_date?: string;
    description?: string;
  }): CustomerDetailProfile {
    const db = getDb();
    const id = genId('ctx');
    db.prepare(`
      INSERT INTO customer_transactions (id, customer_id, trip_stop_id, tx_date, tx_type, amount, description)
      VALUES (?, ?, NULL, ?, ?, ?, ?)
    `).run(
      id,
      payload.customer_id,
      payload.tx_date || todayISO(),
      payload.tx_type,
      Number(payload.amount || 0),
      payload.description || ''
    );
    this.recalculateCustomerBalance(payload.customer_id);
    syncEncryptedVault();
    return this.getCustomerDetail(payload.customer_id);
  }

  // ==========================================
  // 5. SEFERLER & ÇOKLU DURAKLAR (TRIPS & STOPS)
  // ==========================================
  getTrips(month?: string): Trip[] {
    const db = getDb();
    let sql = `
      SELECT t.*, v.plate AS vehicle_plate
      FROM trips t
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (month) {
      sql += ' AND t.trip_date LIKE ?';
      params.push(`${month}%`);
    }
    sql += ' ORDER BY t.trip_date DESC, t.trip_no DESC';

    const trips = db.prepare(sql).all(...params) as Trip[];
    const stopStmt = db.prepare(`
      SELECT ts.*, c.name AS customer_name, c.phone AS customer_phone, c.city AS customer_city
      FROM trip_stops ts
      LEFT JOIN customers c ON c.id = ts.customer_id
      WHERE ts.trip_id = ?
      ORDER BY ts.stop_order ASC
    `);

    for (const t of trips) {
      t.stops = stopStmt.all(t.id) as TripStop[];
    }
    return trips;
  }

  saveTrip(payload: Partial<Trip> & { stops: Partial<TripStop>[] }): Trip {
    const db = getDb();
    const tripId = payload.id || genId('trp');
    const tripDate = payload.trip_date || todayISO();
    const stopsInput = payload.stops && payload.stops.length > 0 ? payload.stops : [];

    // Calculate total_freight from stops if stops have amounts, or use provided total_freight
    const sumStopAmounts = stopsInput.reduce((acc, s) => acc + Number(s.stop_amount || 0), 0);
    const totalFreight = sumStopAmounts > 0 ? sumStopAmounts : Number(payload.total_freight || 0);

    const tx = db.transaction(() => {
      const existing = db.prepare('SELECT id FROM trips WHERE id = ?').get(tripId);
      if (existing) {
        db.prepare(`
          UPDATE trips
          SET trip_no = ?, trip_date = ?, vehicle_id = ?, driver_name = ?, origin = ?, destination = ?,
              status = ?, total_freight = ?, fuel_cost = ?, road_cost = ?, other_cost = ?, invoice_status = ?, notes = ?
          WHERE id = ?
        `).run(
          payload.trip_no || `SFR-${tripId.slice(-4).toUpperCase()}`,
          tripDate,
          payload.vehicle_id,
          payload.driver_name || '',
          payload.origin || '',
          payload.destination || '',
          payload.status || 'transit',
          totalFreight,
          Number(payload.fuel_cost || 0),
          Number(payload.road_cost || 0),
          Number(payload.other_cost || 0),
          payload.invoice_status ? 1 : 0,
          payload.notes || '',
          tripId
        );
        db.prepare('DELETE FROM trip_stops WHERE trip_id = ?').run(tripId);
      } else {
        db.prepare(`
          INSERT INTO trips (id, trip_no, trip_date, vehicle_id, driver_name, origin, destination, status, total_freight, fuel_cost, road_cost, other_cost, invoice_status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          tripId,
          payload.trip_no || `SFR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`,
          tripDate,
          payload.vehicle_id,
          payload.driver_name || '',
          payload.origin || '',
          payload.destination || '',
          payload.status || 'transit',
          totalFreight,
          Number(payload.fuel_cost || 0),
          Number(payload.road_cost || 0),
          Number(payload.other_cost || 0),
          payload.invoice_status ? 1 : 0,
          payload.notes || ''
        );
      }

      const insertStop = db.prepare(`
        INSERT INTO trip_stops (id, trip_id, stop_order, customer_id, delivered_item, quantity, stop_amount, due_date, paid_amount, payment_status, payment_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stopsInput.forEach((s, idx) => {
        const stopId = s.id || genId('stp');
        const stopAmt = Number(s.stop_amount || 0);
        const paidAmt = Math.min(stopAmt, Math.max(0, Number(s.paid_amount || 0)));
        let payStatus: 'unpaid' | 'partial' | 'paid' = 'unpaid';
        if (paidAmt >= stopAmt && stopAmt > 0) payStatus = 'paid';
        else if (paidAmt > 0) payStatus = 'partial';

        insertStop.run(
          stopId,
          tripId,
          idx + 1,
          s.customer_id,
          s.delivered_item || 'Motorin',
          Number(s.quantity || 0),
          stopAmt,
          s.due_date || tripDate,
          paidAmt,
          payStatus,
          paidAmt > 0 ? (s.payment_date || todayISO()) : null
        );
      });

      this.recalculateAllCustomerBalances();
    });

    tx();
    syncEncryptedVault();
    return this.getTrips().find(t => t.id === tripId)!;
  }

  updateTripStatus(tripId: string, status: 'planned' | 'transit' | 'delivered', invoiceStatus?: number): Trip {
    const db = getDb();
    if (invoiceStatus !== undefined) {
      db.prepare('UPDATE trips SET status = ?, invoice_status = ? WHERE id = ?').run(status, invoiceStatus, tripId);
    } else {
      db.prepare('UPDATE trips SET status = ? WHERE id = ?').run(status, tripId);
    }
    syncEncryptedVault();
    return this.getTrips().find(t => t.id === tripId)!;
  }

  deleteTrip(tripId: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM trip_stops WHERE trip_id = ?').run(tripId);
    db.prepare('DELETE FROM trips WHERE id = ?').run(tripId);
    this.recalculateAllCustomerBalances();
    syncEncryptedVault();
    return true;
  }

  // ==========================================
  // 6. DURAK BAZLI TAHSİLAT MOTORU (PAYMENTS)
  // ==========================================
  getAllStopsWithDetails(onlyOpen = false): TripStop[] {
    const db = getDb();
    let sql = `
      SELECT
        ts.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.city AS customer_city,
        t.trip_no,
        t.trip_date,
        t.origin,
        t.destination,
        t.driver_name,
        v.plate AS vehicle_plate
      FROM trip_stops ts
      JOIN trips t ON t.id = ts.trip_id
      JOIN customers c ON c.id = ts.customer_id
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
    `;
    if (onlyOpen) {
      sql += " WHERE ts.payment_status != 'paid'";
    }
    sql += ' ORDER BY COALESCE(ts.due_date, t.trip_date) ASC, t.trip_date DESC';
    return db.prepare(sql).all() as TripStop[];
  }

  collectStopPayment(payload: {
    stop_id: string;
    payment_amount: number;
    payment_date?: string;
    notes?: string;
  }): TripStop {
    const db = getDb();
    const stop = db.prepare('SELECT * FROM trip_stops WHERE id = ?').get(payload.stop_id) as TripStop | undefined;
    if (!stop) {
      throw new Error('Sefer durağı bulunamadı.');
    }

    const addAmt = Number(payload.payment_amount || 0);
    if (addAmt <= 0) {
      throw new Error('Tahsilat tutarı 0\'dan büyük olmalıdır.');
    }

    const newPaid = Math.min(Number(stop.stop_amount), Number(stop.paid_amount || 0) + addAmt);
    const status: 'unpaid' | 'partial' | 'paid' =
      newPaid >= Number(stop.stop_amount) ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    const pDate = payload.payment_date || todayISO();

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE trip_stops
        SET paid_amount = ?, payment_status = ?, payment_date = ?
        WHERE id = ?
      `).run(newPaid, status, pDate, stop.id);

      db.prepare(`
        INSERT INTO customer_transactions (id, customer_id, trip_stop_id, tx_date, tx_type, amount, description)
        VALUES (?, ?, ?, ?, 'credit', ?, ?)
      `).run(
        genId('ctx'),
        stop.customer_id,
        stop.id,
        pDate,
        addAmt,
        payload.notes || 'Durak tahsilatı'
      );

      this.recalculateCustomerBalance(stop.customer_id);
    });

    tx();
    syncEncryptedVault();
    return this.getAllStopsWithDetails(false).find(s => s.id === stop.id)!;
  }

  // ==========================================
  // 7. GÖREVLER VE HATIRLATICILAR (TASKS & NOTES)
  // ==========================================
  getTasks(): TaskItem[] {
    const db = getDb();
    return db.prepare(`
      SELECT t.*, c.name AS customer_name, v.plate AS vehicle_plate
      FROM tasks t
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      ORDER BY t.status ASC, t.task_date ASC, t.task_time ASC
    `).all() as TaskItem[];
  }

  saveTask(data: Partial<TaskItem>): TaskItem {
    const db = getDb();
    const id = data.id || genId('tsk');
    db.prepare(`
      INSERT OR REPLACE INTO tasks (id, title, description, task_date, task_time, priority, status, customer_id, vehicle_id, driver_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      (data.title || '').trim(),
      data.description || '',
      data.task_date || todayISO(),
      data.task_time || '09:00',
      data.priority || 'normal',
      data.status || 'pending',
      data.customer_id || null,
      data.vehicle_id || null,
      data.driver_name || null
    );
    syncEncryptedVault();
    return this.getTasks().find(t => t.id === id)!;
  }

  toggleTaskStatus(id: string): TaskItem {
    const db = getDb();
    const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as { status: string } | undefined;
    if (row) {
      const next = row.status === 'completed' ? 'pending' : 'completed';
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(next, id);
      syncEncryptedVault();
    }
    return this.getTasks().find(t => t.id === id)!;
  }

  deleteTask(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    syncEncryptedVault();
    return true;
  }

  getReminderNotes(): ReminderNote[] {
    const db = getDb();
    return db.prepare(`
      SELECT rn.*, c.name AS customer_name
      FROM reminder_notes rn
      LEFT JOIN customers c ON c.id = rn.customer_id
      ORDER BY rn.is_completed ASC, rn.remind_date ASC
    `).all() as ReminderNote[];
  }

  saveReminderNote(data: Partial<ReminderNote>): ReminderNote {
    const db = getDb();
    const id = data.id || genId('not');
    db.prepare(`
      INSERT OR REPLACE INTO reminder_notes (id, title, content, customer_id, remind_date, remind_time, is_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      (data.title || '').trim(),
      data.content || '',
      data.customer_id || null,
      data.remind_date || todayISO(),
      data.remind_time || '10:00',
      data.is_completed ? 1 : 0
    );
    syncEncryptedVault();
    return this.getReminderNotes().find(n => n.id === id)!;
  }

  toggleReminderNote(id: string): ReminderNote {
    const db = getDb();
    const row = db.prepare('SELECT is_completed FROM reminder_notes WHERE id = ?').get(id) as { is_completed: number } | undefined;
    if (row) {
      const next = row.is_completed ? 0 : 1;
      db.prepare('UPDATE reminder_notes SET is_completed = ? WHERE id = ?').run(next, id);
      syncEncryptedVault();
    }
    return this.getReminderNotes().find(n => n.id === id)!;
  }

  deleteReminderNote(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM reminder_notes WHERE id = ?').run(id);
    syncEncryptedVault();
    return true;
  }

  // ==========================================
  // 8. BİLDİRİM MERKEZİ & DASHBOARD & ARAMA
  // ==========================================
  getNotifications(): AppNotification[] {
    const db = getDb();
    const today = todayISO();
    const items: AppNotification[] = [];

    // 1. Overdue stop payments
    const overdueStops = db.prepare(`
      SELECT ts.*, c.name AS customer_name, t.trip_no
      FROM trip_stops ts
      JOIN customers c ON c.id = ts.customer_id
      JOIN trips t ON t.id = ts.trip_id
      WHERE ts.payment_status != 'paid' AND ts.due_date IS NOT NULL AND ts.due_date <= ?
      ORDER BY ts.due_date ASC
    `).all(today) as any[];

    for (const s of overdueStops) {
      const rem = Number(s.stop_amount) - Number(s.paid_amount || 0);
      if (rem <= 0) continue;
      items.push({
        id: `notif-stop-${s.id}`,
        category: 'overdue_payment',
        severity: s.due_date < today ? 'danger' : 'warning',
        title: `${s.customer_name} — Tahsilat Vadesi`,
        subtitle: `${s.trip_no || 'Sefer'} (${s.delivered_item || 'Akaryakıt'}) kalan bakiye`,
        dateStr: s.due_date,
        amount: rem,
        targetTab: 'payments',
        entityId: s.customer_id
      });
    }

    // 2. Approaching vehicle inspection / insurance (within 30 days)
    const vehicles = this.getVehicles();
    const nowTime = new Date(today).getTime();

    for (const v of vehicles) {
      if (v.inspection_date) {
        const diffDays = Math.ceil((new Date(v.inspection_date).getTime() - nowTime) / (1000 * 3600 * 24));
        if (diffDays <= 30) {
          items.push({
            id: `notif-insp-${v.id}`,
            category: 'vehicle_inspection',
            severity: diffDays <= 7 ? 'danger' : 'warning',
            title: `${v.plate} — Muayene / Vize Tarihi`,
            subtitle: diffDays < 0 ? `${Math.abs(diffDays)} gün geçti!` : `${diffDays} gün kaldı (${v.driver_name || 'Şoför'})`,
            dateStr: v.inspection_date,
            targetTab: 'vehicles',
            entityId: v.id
          });
        }
      }
      if (v.insurance_date) {
        const diffDays = Math.ceil((new Date(v.insurance_date).getTime() - nowTime) / (1000 * 3600 * 24));
        if (diffDays <= 30) {
          items.push({
            id: `notif-ins-${v.id}`,
            category: 'vehicle_insurance',
            severity: diffDays <= 7 ? 'danger' : 'warning',
            title: `${v.plate} — Sigorta / Kasko Yenileme`,
            subtitle: diffDays < 0 ? `${Math.abs(diffDays)} gün geçti!` : `${diffDays} gün kaldı (${v.driver_name || 'Şoför'})`,
            dateStr: v.insurance_date,
            targetTab: 'vehicles',
            entityId: v.id
          });
        }
      }
    }

    // 3. Today's pending tasks
    const tasks = db.prepare(`
      SELECT * FROM tasks WHERE status = 'pending' AND task_date <= ? ORDER BY priority DESC, task_time ASC
    `).all(today) as TaskItem[];

    for (const t of tasks) {
      items.push({
        id: `notif-task-${t.id}`,
        category: 'today_task',
        severity: t.priority === 'high' ? 'warning' : 'info',
        title: `Görev: ${t.title}`,
        subtitle: t.description || `Saat: ${t.task_time || 'Gün içi'}`,
        dateStr: t.task_date,
        targetTab: 'planning',
        entityId: t.id
      });
    }

    return items;
  }

  getDashboardData(selectedMonth?: string): DashboardData {
    const db = getDb();
    this.recalculateAllCustomerBalances();
    const today = todayISO();
    const month = selectedMonth || currentMonthISO();

    const allTrips = this.getTrips();
    const todayTrips = allTrips.filter(t => t.trip_date === today);

    const openBalanceRow = db.prepare('SELECT COALESCE(SUM(current_balance), 0) AS total FROM customers').get() as { total: number };
    const transitVehiclesRow = db.prepare("SELECT COUNT(DISTINCT vehicle_id) AS c FROM trips WHERE status = 'transit'").get() as { c: number };
    const totalFleetRow = db.prepare('SELECT COUNT(*) AS c FROM vehicles').get() as { c: number };

    const monthlyRevRow = db.prepare(`
      SELECT COALESCE(SUM(total_freight), 0) AS rev
      FROM trips
      WHERE trip_date LIKE ?
    `).get(`${month}%`) as { rev: number };

    const pendingCustomerStops = this.getAllStopsWithDetails(true);

    // Build last 6 months chart
    const sixMonthsChart: MonthlyChartPoint[] = [];
    const baseDate = new Date(`${month}-01T00:00:00`);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = `${TURKISH_MONTHS_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;

      const tRow = db.prepare(`
        SELECT
          COALESCE(SUM(total_freight), 0) AS rev,
          COALESCE(SUM(fuel_cost + road_cost + other_cost), 0) AS trip_exp
        FROM trips
        WHERE trip_date LIKE ?
      `).get(`${mKey}%`) as { rev: number; trip_exp: number };

      const revenue = Number(tRow.rev || 0);
      const expenses = Number(tRow.trip_exp || 0);
      sixMonthsChart.push({
        month: mKey,
        label: mLabel,
        revenue,
        expenses,
        netProfit: revenue - expenses
      });
    }

    const todayTasks = this.getTasks().filter(t => t.task_date === today || t.status === 'pending').slice(0, 8);

    return {
      todayTripsCount: todayTrips.length,
      pendingReceivablesTotal: Number(openBalanceRow.total || 0),
      activeTransitVehiclesCount: Number(transitVehiclesRow.c || 0),
      totalFleetCount: Number(totalFleetRow.c || 0),
      monthlyFreightRevenue: Number(monthlyRevRow.rev || 0),
      todayTrips: todayTrips.length > 0 ? todayTrips : allTrips.slice(0, 5),
      pendingCustomerStops,
      sixMonthsChart,
      todayTasks,
      notifications: this.getNotifications()
    };
  }

  globalSearch(query: string): GlobalSearchResult[] {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const db = getDb();
    const results: GlobalSearchResult[] = [];

    // Customers
    const customers = db.prepare(`
      SELECT * FROM customers
      WHERE LOWER(name) LIKE ? OR LOWER(company_title) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(city) LIKE ?
      LIMIT 6
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as Customer[];

    for (const c of customers) {
      results.push({
        id: c.id,
        category: 'customer',
        title: c.name,
        subtitle: `${c.company_title || c.city} • Tel: ${c.phone || '-'}`,
        badge: `${c.current_balance.toLocaleString('tr-TR')} ₺`,
        targetTab: 'customers'
      });
    }

    // Vehicles
    const vehicles = db.prepare(`
      SELECT * FROM vehicles
      WHERE LOWER(plate) LIKE ? OR LOWER(driver_name) LIKE ? OR LOWER(notes) LIKE ?
      LIMIT 5
    `).all(`%${q}%`, `%${q}%`, `%${q}%`) as Vehicle[];

    for (const v of vehicles) {
      results.push({
        id: v.id,
        category: 'vehicle',
        title: v.plate,
        subtitle: `Şoför: ${v.driver_name || '-'} • Kapasite: ${v.fuel_capacity || 0} Lt`,
        badge: v.vehicle_type.toUpperCase(),
        targetTab: 'vehicles'
      });
    }

    // Trips
    const trips = db.prepare(`
      SELECT t.*, v.plate AS vehicle_plate
      FROM trips t
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE LOWER(t.trip_no) LIKE ? OR LOWER(t.origin) LIKE ? OR LOWER(t.destination) LIKE ? OR LOWER(t.driver_name) LIKE ? OR LOWER(v.plate) LIKE ?
      LIMIT 6
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as Trip[];

    for (const t of trips) {
      results.push({
        id: t.id,
        category: 'trip',
        title: `${t.trip_no} — ${t.origin} → ${t.destination}`,
        subtitle: `${t.trip_date} • Plaka: ${t.vehicle_plate || '-'} (${t.driver_name || '-'})`,
        badge: `${t.total_freight.toLocaleString('tr-TR')} ₺`,
        targetTab: 'trips'
      });
    }

    // Drivers
    const drivers = db.prepare(`
      SELECT d.*, v.plate AS active_vehicle_plate
      FROM drivers d
      LEFT JOIN vehicles v ON v.id = d.active_vehicle_id
      WHERE LOWER(d.name) LIKE ? OR LOWER(d.phone) LIKE ?
      LIMIT 5
    `).all(`%${q}%`, `%${q}%`) as Driver[];

    for (const d of drivers) {
      results.push({
        id: d.id,
        category: 'driver',
        title: d.name,
        subtitle: `Tel: ${d.phone || '-'} • Belge: ${d.license_type || '-'}`,
        badge: d.active_vehicle_plate || 'Araç Yok',
        targetTab: 'drivers'
      });
    }

    return results;
  }

  // ==========================================
  // 9. RAPORLAR VE ŞİFRELİ YEDEK (EXPORT / IMPORT)
  // ==========================================
  getMonthlyReports(): MonthlyReportSummary[] {
    const db = getDb();
    const monthsSet = new Set<string>();
    monthsSet.add(currentMonthISO());

    const tripMonths = db.prepare('SELECT DISTINCT substr(trip_date, 1, 7) AS m FROM trips').all() as { m: string }[];
    const expMonths = db.prepare('SELECT DISTINCT expense_month AS m FROM vehicle_expenses').all() as { m: string }[];

    tripMonths.forEach(r => { if (r.m) monthsSet.add(r.m); });
    expMonths.forEach(r => { if (r.m) monthsSet.add(r.m); });

    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    const reports: MonthlyReportSummary[] = [];

    for (const m of sortedMonths) {
      const tStats = db.prepare(`
        SELECT
          COUNT(*) AS trip_count,
          COALESCE(SUM(total_freight), 0) AS total_rev,
          COALESCE(SUM(fuel_cost), 0) AS fuel,
          COALESCE(SUM(road_cost), 0) AS road,
          COALESCE(SUM(other_cost), 0) AS other
        FROM trips
        WHERE trip_date LIKE ?
      `).get(`${m}%`) as any;

      const sStats = db.prepare(`
        SELECT
          COUNT(*) AS stop_count,
          COALESCE(SUM(stop_amount), 0) AS stop_total,
          COALESCE(SUM(paid_amount), 0) AS paid_total
        FROM trip_stops ts
        JOIN trips t ON t.id = ts.trip_id
        WHERE t.trip_date LIKE ?
      `).get(`${m}%`) as any;

      const totalRevenue = Number(tStats.total_rev || 0);
      const tripFuelCost = Number(tStats.fuel || 0);
      const tripRoadCost = Number(tStats.road || 0);
      const tripOtherCost = Number(tStats.other || 0);
      const totalTripExpenses = tripFuelCost + tripRoadCost + tripOtherCost;
      const vehicleExtraExpenses = 0;
      const totalAllExpenses = totalTripExpenses;
      const collectedAmount = Number(sStats.paid_total || 0);
      const remainingReceivables = Math.max(0, Number(sStats.stop_total || 0) - collectedAmount);

      reports.push({
        month: m,
        tripCount: Number(tStats.trip_count || 0),
        stopCount: Number(sStats.stop_count || 0),
        totalRevenue,
        tripFuelCost,
        tripRoadCost,
        tripOtherCost,
        totalTripExpenses,
        vehicleExtraExpenses,
        totalAllExpenses,
        netOperatingProfit: totalRevenue - totalTripExpenses,
        collectedAmount,
        remainingReceivables
      });
    }

    return reports;
  }

  async exportEncryptedBackup(): Promise<{ success: boolean; filePath?: string; message: string }> {
    syncEncryptedVault();
    const vaultPath = getEncryptedVaultPath();
    if (!fs.existsSync(vaultPath)) {
      throw new Error('Şifreli veritabanı dosyası bulunamadı.');
    }

    const db = getDb();
    const snapshotJson = {
      exportedAt: new Date().toISOString(),
      app: 'Nakliye Defterim v4.5',
      vehicles: db.prepare('SELECT * FROM vehicles').all(),
      drivers: db.prepare('SELECT * FROM drivers').all(),
      customers: db.prepare('SELECT * FROM customers').all(),
      trips: db.prepare('SELECT * FROM trips').all(),
      trip_stops: db.prepare('SELECT * FROM trip_stops').all(),
      vehicle_expenses: db.prepare('SELECT * FROM vehicle_expenses').all(),
      tasks: db.prepare('SELECT * FROM tasks').all(),
      reminder_notes: db.prepare('SELECT * FROM reminder_notes').all(),
      customer_transactions: db.prepare('SELECT * FROM customer_transactions').all(),
      village_tankers: db.prepare('SELECT * FROM village_tankers').all(),
      village_tanker_logs: db.prepare('SELECT * FROM village_tanker_logs').all()
    };

    const rawVaultEnvelope = JSON.parse(fs.readFileSync(vaultPath, 'utf-8'));
    const exportBundle = {
      type: 'NAKLIYE_DEFTERIM_V45_ENCRYPTED_BACKUP',
      createdAt: new Date().toISOString(),
      vaultEnvelope: rawVaultEnvelope,
      encryptedJsonMirror: encryptBufferWithPassword(Buffer.from(JSON.stringify(snapshotJson), 'utf-8'), 'NAKLIYE_INTERNAL_MIRROR')
    };

    const defaultName = `Nakliye_Defterim_v45_Yedek_${todayISO()}.json`;
    const res = await dialog.showSaveDialog({
      title: 'Şifreli Tam Yedek Dışa Aktar (.json / .db)',
      defaultPath: defaultName,
      filters: [
        { name: 'Şifreli Yedek Dosyası (.json, .db)', extensions: ['json', 'db'] }
      ]
    });

    if (res.canceled || !res.filePath) {
      return { success: false, message: 'Dışa aktarma iptal edildi.' };
    }

    fs.writeFileSync(res.filePath, JSON.stringify(exportBundle, null, 2), 'utf-8');
    return {
      success: true,
      filePath: res.filePath,
      message: `Şifreli yedek başarıyla kaydedildi: ${res.filePath}`
    };
  }

  async importEncryptedBackup(password: string, customFilePath?: string): Promise<{ success: boolean; message: string }> {
    if (!password || password.length < 10) {
      throw new Error('Yedek dosyasını çözmek için en az 10 karakterli ana parolanızı girmelisiniz.');
    }

    let targetFile = customFilePath;
    if (!targetFile) {
      const res = await dialog.showOpenDialog({
        title: 'Şifreli Yedek Dosyası Seç (.json / .db)',
        properties: ['openFile'],
        filters: [
          { name: 'Şifreli Yedek (.json, .db, .sqlite)', extensions: ['json', 'db', 'sqlite'] }
        ]
      });
      if (res.canceled || res.filePaths.length === 0) {
        return { success: false, message: 'Dosya seçimi iptal edildi.' };
      }
      targetFile = res.filePaths[0];
    }

    if (!fs.existsSync(targetFile)) {
      throw new Error('Seçilen yedek dosyası bulunamadı.');
    }

    const rawText = fs.readFileSync(targetFile, 'utf-8');
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error('Seçilen dosya geçerli bir şifreli JSON/DB formatında değil.');
    }

    const envelope: VaultEnvelope = parsed.vaultEnvelope || parsed;
    if (!envelope.payload || !envelope.salt || !envelope.iv || !envelope.authTag) {
      throw new Error('Yedek dosyasında AES-256 şifreleme zarfı bulunamadı.');
    }

    // Verify password can decrypt the backup BEFORE overwriting current vault
    decryptBufferWithPassword(envelope, password);

    lockVault();
    fs.writeFileSync(getEncryptedVaultPath(), JSON.stringify(envelope, null, 2), 'utf-8');
    unlockVault(password);

    return {
      success: true,
      message: 'Şifreli yedek başarıyla doğrulandı ve defter açıldı.'
    };
  }

  getAutoBackupStatus(): AutoBackupStatus {
    return getAutoBackupStatus();
  }

  setAutoBackupInterval(minutes: number): AutoBackupStatus {
    return setAutoBackupIntervalMinutes(minutes);
  }

  runAutoBackupNow(reason = 'Manuel Otomatik Yedek'): {
    success: boolean;
    message: string;
    status: AutoBackupStatus;
  } {
    const item = createAutoBackupSnapshot(reason, true);
    const status = getAutoBackupStatus();
    if (!item) {
      return {
        success: false,
        message: 'Otomatik yedek oluşturulamadı (Defter kilitli olabilir).',
        status
      };
    }
    return {
      success: true,
      message: `Otomatik şifreli yedek kaydedildi: ${item.fileName}`,
      status
    };
  }

  // ==========================================
  // 10. BAĞIMSIZ KÖY KÜÇÜK TANKERLERİ TAKİP SİSTEMİ
  // (Ana Nakliye / Cari Sisteminden Tamamen Ayrıdır)
  // ==========================================
  getVillageTankers(): VillageTanker[] {
    const db = getDb();
    return db.prepare('SELECT * FROM village_tankers ORDER BY name ASC').all() as VillageTanker[];
  }

  saveVillageTanker(data: Partial<VillageTanker>): VillageTanker {
    const db = getDb();
    const id = data.id || genId('vt');
    db.prepare(`
      INSERT OR REPLACE INTO village_tankers
      (id, name, plate_or_code, village_name, capacity_liters, current_fuel_liters, driver_name, driver_phone, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      (data.name || '').trim(),
      (data.plate_or_code || '').trim(),
      data.village_name || 'Merkez Köyleri',
      Number(data.capacity_liters || 5000),
      Number(data.current_fuel_liters || 0),
      data.driver_name || '',
      data.driver_phone || '',
      data.status || 'active',
      data.notes || ''
    );
    syncEncryptedVault();
    return db.prepare('SELECT * FROM village_tankers WHERE id = ?').get(id) as VillageTanker;
  }

  deleteVillageTanker(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM village_tanker_logs WHERE tanker_id = ?').run(id);
    db.prepare('DELETE FROM village_tankers WHERE id = ?').run(id);
    syncEncryptedVault();
    return true;
  }

  getVillageTankerLogs(tankerId?: string): VillageTankerLog[] {
    const db = getDb();
    let sql = `
      SELECT vtl.*, vt.name AS tanker_name, vt.plate_or_code, vt.village_name
      FROM village_tanker_logs vtl
      LEFT JOIN village_tankers vt ON vt.id = vtl.tanker_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (tankerId && tankerId !== 'all') {
      sql += ' AND vtl.tanker_id = ?';
      params.push(tankerId);
    }
    sql += ' ORDER BY vtl.log_date DESC, vtl.id DESC';
    return db.prepare(sql).all(...params) as VillageTankerLog[];
  }

  saveVillageTankerLog(data: Partial<VillageTankerLog>): VillageTankerLog {
    const db = getDb();
    const id = data.id || genId('vtl');
    const isNew = !data.id;
    const liters = Number(data.liters || 0);
    const opType = data.operation_type || 'dagitim';
    const cashAmt = Number(data.cash_amount || 0);
    const cardAmt = Number(data.card_amount || 0);
    const creditSaleAmt = Number(data.credit_sale_amount || 0);
    const creditCollAmt = Number(data.credit_collected_amount || 0);
    const computedSaleTotal = cashAmt + cardAmt + creditSaleAmt;
    const finalAmount = computedSaleTotal > 0 ? computedSaleTotal : Number(data.amount || 0);

    // Ensure tanker_id exists in village_tankers (e.g., if user picked a vehicle or created inline)
    if (data.tanker_id) {
      const existsVt = db.prepare('SELECT id FROM village_tankers WHERE id = ?').get(data.tanker_id);
      if (!existsVt) {
        db.prepare(`
          INSERT OR IGNORE INTO village_tankers (id, name, plate_or_code, village_name, capacity_liters, current_fuel_liters, driver_name, driver_phone, status, notes)
          VALUES (?, ?, ?, 'Köy Satış Operasyonu', 10000, 5000, ?, '', 'active', '')
        `).run(
          data.tanker_id,
          data.plate_or_code || data.tanker_name || 'Köy Tankeri',
          data.plate_or_code || '',
          data.driver_name || ''
        );
      }
    }

    db.prepare(`
      INSERT OR REPLACE INTO village_tanker_logs
      (id, tanker_id, log_date, operation_type, villager_or_target, fuel_type, liters, amount, cash_amount, card_amount, credit_sale_amount, credit_collected_amount, driver_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.tanker_id,
      data.log_date || todayISO(),
      opType,
      (data.villager_or_target || '').trim(),
      data.fuel_type || 'Motorin (Tarım)',
      liters,
      finalAmount,
      cashAmt,
      cardAmt,
      creditSaleAmt,
      creditCollAmt,
      data.driver_name || '',
      data.notes || ''
    );

    // If new log, automatically adjust village tanker's current_fuel_liters
    if (isNew && data.tanker_id && liters > 0) {
      const vt = db.prepare('SELECT current_fuel_liters, capacity_liters FROM village_tankers WHERE id = ?').get(data.tanker_id) as
        | { current_fuel_liters: number; capacity_liters: number }
        | undefined;
      if (vt) {
        let nextFuel = Number(vt.current_fuel_liters || 0);
        if (opType === 'dolum') {
          nextFuel = Math.min(Number(vt.capacity_liters || 999999), nextFuel + liters);
        } else if (opType === 'dagitim') {
          nextFuel = Math.max(0, nextFuel - liters);
        }
        db.prepare('UPDATE village_tankers SET current_fuel_liters = ? WHERE id = ?').run(nextFuel, data.tanker_id);
      }
    }

    syncEncryptedVault();
    return this.getVillageTankerLogs().find((l) => l.id === id)!;
  }

  deleteVillageTankerLog(id: string): boolean {
    const db = getDb();
    db.prepare('DELETE FROM village_tanker_logs WHERE id = ?').run(id);
    syncEncryptedVault();
    return true;
  }
}
