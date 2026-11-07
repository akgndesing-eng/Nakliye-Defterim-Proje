import Database from 'better-sqlite3';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

export const V45_SCHEMA_SQL = `
-- 1. Araçlar ve Tankerler
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    plate TEXT NOT NULL UNIQUE,
    driver_name TEXT,
    vehicle_type TEXT DEFAULT 'tanker',
    fuel_capacity REAL,
    inspection_date DATE,
    insurance_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Şoförler
CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    tc_no TEXT,
    license_type TEXT,
    active_vehicle_id TEXT,
    notes TEXT,
    FOREIGN KEY (active_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

-- 3. Müşteriler ve İstasyonlar
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_title TEXT,
    phone TEXT,
    city TEXT,
    address TEXT,
    current_balance REAL DEFAULT 0,
    notes TEXT
);

-- 4. Seferler (Trips)
CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    trip_no TEXT,
    trip_date DATE NOT NULL,
    vehicle_id TEXT NOT NULL,
    driver_name TEXT,
    origin TEXT,
    destination TEXT,
    status TEXT DEFAULT 'transit',
    total_freight REAL NOT NULL,
    fuel_cost REAL DEFAULT 0,
    road_cost REAL DEFAULT 0,
    other_cost REAL DEFAULT 0,
    invoice_status INTEGER DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 5. Sefer Durakları (Çoklu İstasyon / Müşteri Bırakımları)
CREATE TABLE IF NOT EXISTS trip_stops (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL,
    stop_order INTEGER NOT NULL,
    customer_id TEXT NOT NULL,
    delivered_item TEXT,
    quantity REAL,
    stop_amount REAL NOT NULL,
    due_date DATE,
    paid_amount REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'unpaid',
    payment_date DATE,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 6. Araç Aylık Ek Giderleri (Periyodik Masraflar)
CREATE TABLE IF NOT EXISTS vehicle_expenses (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    expense_date DATE NOT NULL,
    expense_month TEXT NOT NULL,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 7. Görevler ve Hatırlatıcılar (Tasks & Notes)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    task_date DATE NOT NULL,
    task_time TIME,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'pending',
    customer_id TEXT,
    vehicle_id TEXT,
    driver_name TEXT
);

-- 8. Bağımsız Hatırlatıcı Notlar
CREATE TABLE IF NOT EXISTS reminder_notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    customer_id TEXT,
    remind_date DATE,
    remind_time TIME,
    is_completed INTEGER DEFAULT 0
);

-- 9. Müşteri Ek Cari / Ödeme Hareketleri
CREATE TABLE IF NOT EXISTS customer_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    trip_stop_id TEXT,
    tx_date DATE NOT NULL,
    tx_type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 10. Köy Küçük Tankerleri (Ana Nakliye Sisteminden Bağımsız)
CREATE TABLE IF NOT EXISTS village_tankers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plate_or_code TEXT,
    village_name TEXT,
    capacity_liters REAL DEFAULT 5000,
    current_fuel_liters REAL DEFAULT 0,
    driver_name TEXT,
    driver_phone TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT
);

-- 11. Köy Küçük Tankerleri Hareket / Dağıtım / Masraf Kayıtları
CREATE TABLE IF NOT EXISTS village_tanker_logs (
    id TEXT PRIMARY KEY,
    tanker_id TEXT NOT NULL,
    log_date DATE NOT NULL,
    operation_type TEXT DEFAULT 'dagitim',
    villager_or_target TEXT,
    fuel_type TEXT DEFAULT 'Motorin (Tarım)',
    liters REAL DEFAULT 0,
    amount REAL DEFAULT 0,
    cash_amount REAL DEFAULT 0,
    card_amount REAL DEFAULT 0,
    credit_sale_amount REAL DEFAULT 0,
    credit_collected_amount REAL DEFAULT 0,
    driver_name TEXT,
    notes TEXT,
    FOREIGN KEY (tanker_id) REFERENCES village_tankers(id) ON DELETE CASCADE
);
`;

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'v45_master_schema',
    up: (db: Database.Database) => {
      db.exec(V45_SCHEMA_SQL);
    }
  },
  {
    version: 2,
    name: 'v45_seed_initial_data',
    up: (db: Database.Database) => {
      const countRow = db.prepare('SELECT COUNT(*) as c FROM vehicles').get() as { c: number };
      if (countRow.c > 0) return;

      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const todayStr = formatDate(today);
      const currentMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

      const plusDays = (days: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() + days);
        return formatDate(d);
      };

      // 1. Seed Vehicles
      const insertVehicle = db.prepare(`
        INSERT INTO vehicles (id, plate, driver_name, vehicle_type, fuel_capacity, inspection_date, insurance_date, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertVehicle.run('veh-1', '22 AB 450', 'Mehmet Yılmaz', 'tanker', 32000, plusDays(12), plusDays(45), 'ADR Belgeli 5 Gözlü Akaryakıt Tankeri');
      insertVehicle.run('veh-2', '22 GK 880', 'Hasan Demir', 'tanker', 28000, plusDays(85), plusDays(7), 'Trakya Bölge Dağıtım Tankeri');
      insertVehicle.run('veh-3', '22 ED 104', 'Ali Kaya', 'cekici', 34000, plusDays(140), plusDays(110), 'Uzun Yol Çekici + Dorse');

      // 2. Seed Drivers
      const insertDriver = db.prepare(`
        INSERT INTO drivers (id, name, phone, tc_no, license_type, active_vehicle_id, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertDriver.run('drv-1', 'Mehmet Yılmaz', '0532 411 22 33', '24589102344', 'CE + SRC5 (ADR)', 'veh-1', 'Kıdemli Tanker Şoförü');
      insertDriver.run('drv-2', 'Hasan Demir', '0533 678 90 12', '19384756102', 'CE + SRC5 (ADR)', 'veh-2', 'Bölge Şoförü');
      insertDriver.run('drv-3', 'Ali Kaya', '0542 301 55 66', '38475619284', 'CE + SRC5', 'veh-3', 'Yedek / Uzun Yol');

      // 3. Seed Customers
      const insertCustomer = db.prepare(`
        INSERT INTO customers (id, name, company_title, phone, city, address, current_balance, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertCustomer.run('cust-1', 'Trakya Birlik İstasyonu', 'Trakya Birlik Akaryakıt Tic. A.Ş.', '905321112233', 'Edirne', 'Londra Asfaltı 5. Km Merkez / Edirne', 45000, 'Cuma günleri düzenli ödeme yapar.');
      insertCustomer.run('cust-2', 'Meriç Petrol - Uzunköprü', 'Meriç Akaryakıt ve Nakliyat Ltd. Şti.', '905332223344', 'Edirne', 'Keşan Yolu Üzeri 2. Km Uzunköprü / Edirne', 32500, 'Havale ile çalışır.');
      insertCustomer.run('cust-3', 'Ergene Tarım Koop.', 'S.S. Ergene Tarım Kredi Kooperatifi', '905423334455', 'Tekirdağ', 'Muratlı Caddesi No:84 Çorlu / Tekirdağ', 18000, 'Köy ve tarım motorini teslimatı');
      insertCustomer.run('cust-4', 'Kırklareli Yıldız Petrol', 'Yıldızlar Enerji Petrol Ürünleri A.Ş.', '905354445566', 'Kırklareli', 'Sanayi Kavşağı No:12 Merkez / Kırklareli', 0, 'Peşin / Haftalık');

      // 4. Seed Trips & Stops
      const insertTrip = db.prepare(`
        INSERT INTO trips (id, trip_no, trip_date, vehicle_id, driver_name, origin, destination, status, total_freight, fuel_cost, road_cost, other_cost, invoice_status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertStop = db.prepare(`
        INSERT INTO trip_stops (id, trip_id, stop_order, customer_id, delivered_item, quantity, stop_amount, due_date, paid_amount, payment_status, payment_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // Today's Trip 1 (Transit, 2 stops)
      insertTrip.run('trp-1', 'SFR-2026-101', todayStr, 'veh-1', 'Mehmet Yılmaz', 'TÜPRAŞ İzmit Rafineri', 'Edirne Merkez & Uzunköprü', 'transit', 62000, 14500, 1850, 650, 1, 'Çift istasyon motorin sevkiyatı');
      insertStop.run('stp-1', 'trp-1', 1, 'cust-1', 'Motorin (EuroDiesel)', 18000, 35000, plusDays(-2), 0, 'unpaid', null);
      insertStop.run('stp-2', 'trp-1', 2, 'cust-2', 'Motorin + Kurşunsuz 95', 14000, 27000, plusDays(5), 10000, 'partial', todayStr);

      // Today's Trip 2 (Planned, 1 stop)
      insertTrip.run('trp-2', 'SFR-2026-102', todayStr, 'veh-2', 'Hasan Demir', 'OPET Marmara Ereğlisi Terminali', 'Çorlu / Ergene Koop.', 'planned', 28000, 6200, 800, 300, 0, 'Öğleden sonra dolum yapılacak');
      insertStop.run('stp-3', 'trp-2', 1, 'cust-3', 'Motorin (Tarım)', 26000, 28000, plusDays(-4), 10000, 'partial', null);

      // Recent Delivered Trip (Delivered)
      insertTrip.run('trp-3', 'SFR-2026-099', plusDays(-3), 'veh-3', 'Ali Kaya', 'Aliağa / Star Rafineri', 'Kırklareli Merkez', 'delivered', 54000, 13200, 1600, 500, 1, 'Sorunsuz teslim edildi');
      insertStop.run('stp-4', 'trp-3', 1, 'cust-4', 'Motorin', 32000, 54000, plusDays(-1), 54000, 'paid', plusDays(-1));

      // Extra Trip for Customer 1 & 2 balance consistency
      insertTrip.run('trp-4', 'SFR-2026-095', plusDays(-8), 'veh-1', 'Mehmet Yılmaz', 'Marmara Ereğlisi', 'Edirne & Uzunköprü', 'delivered', 35500, 7800, 950, 250, 1, 'Geçen hafta sevkiyatı');
      insertStop.run('stp-5', 'trp-4', 1, 'cust-1', 'Kurşunsuz 95', 15000, 20000, plusDays(-3), 10000, 'partial', plusDays(-5));
      insertStop.run('stp-6', 'trp-4', 2, 'cust-2', 'Motorin', 16000, 15500, plusDays(-2), 0, 'unpaid', null);

      // 5. Seed Vehicle Expenses
      const insertExpense = db.prepare(`
        INSERT INTO vehicle_expenses (id, vehicle_id, expense_date, expense_month, title, amount)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertExpense.run('exp-1', 'veh-1', plusDays(-5), currentMonth, '10 Numara Sentetik Motor Yağı & Filtre Bakımı', 9400);
      insertExpense.run('exp-2', 'veh-2', plusDays(-2), currentMonth, 'Çekici Ön 2 Lastik Değişimi (Lassa)', 24600);
      insertExpense.run('exp-3', 'veh-3', plusDays(-6), currentMonth, 'ADR Yangın Tüpü & Dolum Ekipman Kontrolü', 4200);

      // 6. Seed Tasks
      const insertTask = db.prepare(`
        INSERT INTO tasks (id, title, description, task_date, task_time, priority, status, customer_id, vehicle_id, driver_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertTask.run('tsk-1', 'Trakya Birlik Cuma Tahsilat Teyidi', 'Muhasebe ile görüşülüp 45.000 TL açık bakiye dekontu istenecek.', todayStr, '14:30', 'high', 'pending', 'cust-1', null, null);
      insertTask.run('tsk-2', '22 AB 450 TÜVTÜRK Randevu Kontrolü', 'Muayene tarihine 12 gün kaldı, fren ve ADR sızdırmazlık testi kontrol edilecek.', todayStr, '11:00', 'high', 'pending', null, 'veh-1', 'Mehmet Yılmaz');
      insertTask.run('tsk-3', 'Marmara Ereğlisi Dolum Fişleri Kontrolü', 'Hasan Demir sefer irsaliyelerini ofise teslim edecek.', todayStr, '17:00', 'normal', 'completed', 'cust-3', 'veh-2', 'Hasan Demir');

      // 7. Seed Reminder Notes
      const insertNote = db.prepare(`
        INSERT INTO reminder_notes (id, title, content, customer_id, remind_date, remind_time, is_completed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertNote.run('not-1', 'Cuma Tahsilat Listesi Hazırlığı', 'Cuma saat 10:00 öncesi tüm vadesi gelen istasyonlara WhatsApp hatırlatma mesajı gönderilecek.', 'cust-1', todayStr, '10:00', 0);
      insertNote.run('not-2', 'Kışlık Antifriz ve Zincir Kontrolü', 'Trakya güzergâhı sis ve buzlanma uyarısı nedeniyle 3 aracın ekipmanı kontrol edilecek.', null, plusDays(2), '09:30', 0);
    }
  },
  {
    version: 3,
    name: 'v45_village_tankers_and_past_months',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS village_tankers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            plate_or_code TEXT,
            village_name TEXT,
            capacity_liters REAL DEFAULT 5000,
            current_fuel_liters REAL DEFAULT 0,
            driver_name TEXT,
            driver_phone TEXT,
            status TEXT DEFAULT 'active',
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS village_tanker_logs (
            id TEXT PRIMARY KEY,
            tanker_id TEXT NOT NULL,
            log_date DATE NOT NULL,
            operation_type TEXT DEFAULT 'dagitim',
            villager_or_target TEXT,
            fuel_type TEXT DEFAULT 'Motorin (Tarım)',
            liters REAL DEFAULT 0,
            amount REAL DEFAULT 0,
            driver_name TEXT,
            notes TEXT,
            FOREIGN KEY (tanker_id) REFERENCES village_tankers(id) ON DELETE CASCADE
        );
      `);

      const vtCount = db.prepare('SELECT COUNT(*) as c FROM village_tankers').get() as { c: number };
      if (vtCount.c === 0) {
        const today = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

        const insTanker = db.prepare(`
          INSERT INTO village_tankers (id, name, plate_or_code, village_name, capacity_liters, current_fuel_liters, driver_name, driver_phone, status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insTanker.run('vt-1', 'Köy Tankeri 1 (Tarım İkmal)', '22 KY 014', 'Merkez Köyleri / Tayakadın', 5000, 3200, 'İsmail Çetin', '0535 712 44 10', 'active', 'Köy içi traktör ve biçerdöver motorin ikmal tankeri');
        insTanker.run('vt-2', 'Köy Tankeri 2 (Mobil Dağıtım)', '22 KY 028', 'Havsa / Osmanlı Köyü', 8000, 5400, 'Mustafa Özkan', '0544 821 90 33', 'active', 'Tarım kooperatif ve çiftlik dağıtım tankeri');

        const insLog = db.prepare(`
          INSERT INTO village_tanker_logs (id, tanker_id, log_date, operation_type, villager_or_target, fuel_type, liters, amount, driver_name, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insLog.run('vtl-1', 'vt-1', todayStr, 'dagitim', 'Ahmet Çavuş Çiftliği (Traktör İkmali)', 'Motorin (Tarım)', 650, 27300, 'İsmail Çetin', 'Köy meydanı teslimat');
        insLog.run('vtl-2', 'vt-2', todayStr, 'dolum', 'Merkez Depodan Küçük Tanker Dolumu', 'Motorin (Tarım)', 3000, 0, 'Mustafa Özkan', 'Haftalık köy dağıtım dolumu');
      }

      const today = new Date();
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 15);
      const pad = (n: number) => String(n).padStart(2, '0');
      const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth() + 1)}`;
      const prevTripDate = `${prevMonthPrefix}-18`;

      const prevCount = db.prepare('SELECT COUNT(*) as c FROM trips WHERE trip_date LIKE ?').get(`${prevMonthPrefix}%`) as { c: number };
      const hasVeh = db.prepare('SELECT id FROM vehicles LIMIT 1').get() as { id: string } | undefined;
      const hasCust = db.prepare('SELECT id FROM customers LIMIT 1').get() as { id: string } | undefined;

      if (prevCount.c === 0 && hasVeh && hasCust) {
        db.prepare(`
          INSERT OR IGNORE INTO trips (id, trip_no, trip_date, vehicle_id, driver_name, origin, destination, status, total_freight, fuel_cost, road_cost, other_cost, invoice_status, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'trp-hist-1',
          `SFR-${prevMonthPrefix.replace('-', '')}-88`,
          prevTripDate,
          hasVeh.id,
          'Mehmet Yılmaz',
          'TÜPRAŞ İzmit Rafineri',
          'Edirne Merkez & Havsa',
          'delivered',
          48500,
          11200,
          1400,
          400,
          1,
          'Geçmiş ay tamamlanan sevkiyat kaydı'
        );

        db.prepare(`
          INSERT OR IGNORE INTO trip_stops (id, trip_id, stop_order, customer_id, delivered_item, quantity, stop_amount, due_date, paid_amount, payment_status, payment_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'stp-hist-1',
          'trp-hist-1',
          1,
          hasCust.id,
          'Motorin (EuroDiesel)',
          24000,
          48500,
          prevTripDate,
          48500,
          'paid',
          prevTripDate
        );

        db.prepare(`
          INSERT OR IGNORE INTO vehicle_expenses (id, vehicle_id, expense_date, expense_month, title, amount)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          'exp-hist-1',
          hasVeh.id,
          prevTripDate,
          prevMonthPrefix,
          'Geçmiş Ay Periyodik Fren & Balata Bakımı',
          8600
        );
      }
    }
  },
  {
    version: 4,
    name: 'v45_village_tanker_daily_sales_columns',
    up: (db: Database.Database) => {
      const cols = db.prepare('PRAGMA table_info(village_tanker_logs)').all() as { name: string }[];
      const colNames = new Set(cols.map((c) => c.name));

      if (!colNames.has('cash_amount')) {
        db.exec('ALTER TABLE village_tanker_logs ADD COLUMN cash_amount REAL DEFAULT 0');
      }
      if (!colNames.has('card_amount')) {
        db.exec('ALTER TABLE village_tanker_logs ADD COLUMN card_amount REAL DEFAULT 0');
      }
      if (!colNames.has('credit_sale_amount')) {
        db.exec('ALTER TABLE village_tanker_logs ADD COLUMN credit_sale_amount REAL DEFAULT 0');
      }
      if (!colNames.has('credit_collected_amount')) {
        db.exec('ALTER TABLE village_tanker_logs ADD COLUMN credit_collected_amount REAL DEFAULT 0');
      }

      // Remove old generic sample logs vtl-1 and vtl-2 if present, and seed the 3 real village tankers & logs
      db.prepare("DELETE FROM village_tanker_logs WHERE id IN ('vtl-1', 'vtl-2')").run();
      db.prepare("DELETE FROM village_tankers WHERE id IN ('vt-1', 'vt-2')").run();

      const insTanker = db.prepare(`
        INSERT OR IGNORE INTO village_tankers (id, name, plate_or_code, village_name, capacity_liters, current_fuel_liters, driver_name, driver_phone, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insTanker.run('vt-sait', '22AED744 — SAİT EROL', '22AED744', 'Köy Satış Operasyonu', 10000, 5000, 'SAİT EROL', '', 'active', 'Köy satış tankeri');
      insTanker.run('vt-oner', '22AFH886 — ÖNER KURAR', '22AFH886', 'Köy Satış Operasyonu', 10000, 5000, 'ÖNER KURAR', '', 'active', 'Köy satış tankeri');
      insTanker.run('vt-erol', '22ADD729 — EROL BULUT', '22ADD729', 'Köy Satış Operasyonu', 10000, 5000, 'EROL BULUT', '', 'active', 'Köy satış tankeri');

      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const curMonthDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-03`;

      const insLog = db.prepare(`
        INSERT OR IGNORE INTO village_tanker_logs
        (id, tanker_id, log_date, operation_type, villager_or_target, fuel_type, liters, amount, cash_amount, card_amount, credit_sale_amount, credit_collected_amount, driver_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insLog.run(
        'vtl-daily-1',
        'vt-sait',
        curMonthDate,
        'dagitim',
        'Günlük Köy Satışı',
        'Motorin',
        583.7,
        64896.86,
        6557.24,
        1499.4,
        56840.22,
        0,
        'SAİT EROL',
        ''
      );
      insLog.run(
        'vtl-daily-2',
        'vt-oner',
        curMonthDate,
        'dagitim',
        'Günlük Köy Satışı',
        'Motorin',
        0.1,
        0.03,
        0.01,
        0.01,
        0.01,
        55848.0,
        'ÖNER KURAR',
        'ÖNCEKİ AYDAN KALAN VERESİYE ÖDEMELERİNİN ALINMASI'
      );
      insLog.run(
        'vtl-daily-3',
        'vt-erol',
        curMonthDate,
        'dagitim',
        'Günlük Köy Satışı',
        'Motorin',
        0.01,
        0.03,
        0.01,
        0.01,
        0.01,
        500.0,
        'EROL BULUT',
        'ÖNCEKİ AYDAN KALAN VERESİYELERİN ÖDEMESİNİN ALINMASI'
      );
    }
  }
];
