-- Nakliye Defterim v4.5 Master SQLite Schema

-- 1. Araçlar ve Tankerler
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    plate TEXT NOT NULL UNIQUE,       -- Plaka (Örn: 22 AB 123)
    driver_name TEXT,                 -- Varsayılan Şoför
    vehicle_type TEXT DEFAULT 'tanker', -- Tanker / Çekici vb.
    fuel_capacity REAL,               -- Depo / Tonaj kapasitesi
    inspection_date DATE,             -- Muayene / Vize Tarihi
    insurance_date DATE,              -- Sigorta / Kasko Tarihi
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
    phone TEXT,                       -- WhatsApp için kritik
    city TEXT,
    address TEXT,
    current_balance REAL DEFAULT 0,   -- Güncel Bakiye (Alacak/Borç)
    notes TEXT
);

-- 4. Seferler (Trips)
CREATE TABLE IF NOT EXISTS trips (
    id TEXT PRIMARY KEY,
    trip_no TEXT,                     -- Sefer Kodu
    trip_date DATE NOT NULL,
    vehicle_id TEXT NOT NULL,
    driver_name TEXT,
    origin TEXT,                      -- Çıkış Noktası (Dolum Tesisi)
    destination TEXT,                 -- Varış Güzergâhı
    status TEXT DEFAULT 'transit',    -- 'planned', 'transit', 'delivered'
    total_freight REAL NOT NULL,      -- Toplam Navlun Bedeli
    fuel_cost REAL DEFAULT 0,         -- Yakıt Gideri
    road_cost REAL DEFAULT 0,         -- Otoyol/Köprü Gideri
    other_cost REAL DEFAULT 0,        -- Diğer Giderler
    invoice_status INTEGER DEFAULT 0, -- Fatura Kesildi mi? (1/0)
    notes TEXT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 5. Sefer Durakları (Çoklu İstasyon / Müşteri Bırakımları)
CREATE TABLE IF NOT EXISTS trip_stops (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL,
    stop_order INTEGER NOT NULL,      -- Durak Sırası (1, 2, 3...)
    customer_id TEXT NOT NULL,
    delivered_item TEXT,              -- Ürün Tipi (Motorin, Kurşunsuz vb.)
    quantity REAL,                    -- Ton / Litre
    stop_amount REAL NOT NULL,        -- Bu durağa ait navlun tutarı
    due_date DATE,                    -- Tahsilat Vadesi
    paid_amount REAL DEFAULT 0,       -- Tahsil Edilen Tutar
    payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'partial', 'paid'
    payment_date DATE,                -- Tahsil Edildiği Tarih
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 6. Araç Aylık Ek Giderleri (Periyodik Masraflar)
CREATE TABLE IF NOT EXISTS vehicle_expenses (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    expense_date DATE NOT NULL,
    expense_month TEXT NOT NULL,      -- 'YYYY-MM'
    title TEXT NOT NULL,              -- Lastik, Bakım, Yağ, Kasko taksiti vb.
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
    priority TEXT DEFAULT 'normal',   -- 'low', 'normal', 'high'
    status TEXT DEFAULT 'pending',    -- 'pending', 'completed'
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

-- 9. Müşteri Ek Cari / Ödeme Hareketleri (Cari Hesap Ekstresi Detayı için)
CREATE TABLE IF NOT EXISTS customer_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    trip_stop_id TEXT,
    tx_date DATE NOT NULL,
    tx_type TEXT NOT NULL,            -- 'debit' (Ek Borç), 'credit' (Tahsilat)
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

-- 11. Köy Küçük Tankerleri Hareket / Dağıtım / Masraf Kayıtları (Ana Nakliye Sisteminden Bağımsız)
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
