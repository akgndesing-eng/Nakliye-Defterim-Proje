// Nakliye Defterim v4.5 — Master Types & Models

export type TripStatus = 'planned' | 'transit' | 'delivered';
export type StopPaymentStatus = 'unpaid' | 'partial' | 'paid';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TaskStatus = 'pending' | 'completed';

export interface GateStatus {
  isInitialized: boolean;
  isUnlocked: boolean;
  vaultPath: string;
}

// 1. Araçlar ve Tankerler
export interface Vehicle {
  id: string;
  plate: string;
  driver_name: string;
  vehicle_type: string; // 'tanker' | 'cekici' | ...
  fuel_capacity: number;
  inspection_date: string; // YYYY-MM-DD
  insurance_date: string;  // YYYY-MM-DD
  notes: string;
  created_at?: string;
}

// 2. Şoförler
export interface Driver {
  id: string;
  name: string;
  phone: string;
  tc_no: string;
  license_type: string;
  active_vehicle_id: string | null;
  active_vehicle_plate?: string;
  notes: string;
}

// 3. Müşteriler ve İstasyonlar
export interface Customer {
  id: string;
  name: string;
  company_title: string;
  phone: string;
  city: string;
  address: string;
  current_balance: number;
  notes: string;
  overdue_amount?: number;
  earliest_due_date?: string | null;
}

// 4. Seferler (Trips) & 5. Sefer Durakları (Trip Stops)
export interface TripStop {
  id: string;
  trip_id: string;
  stop_order: number;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  customer_city?: string;
  delivered_item: string;
  quantity: number;
  stop_amount: number;
  due_date: string;
  paid_amount: number;
  payment_status: StopPaymentStatus;
  payment_date?: string | null;
  // Joined from trip when listing stops/payments
  trip_no?: string;
  trip_date?: string;
  vehicle_plate?: string;
  driver_name?: string;
  origin?: string;
  destination?: string;
}

export interface Trip {
  id: string;
  trip_no: string;
  trip_date: string;
  vehicle_id: string;
  vehicle_plate?: string;
  driver_name: string;
  origin: string;
  destination: string;
  status: TripStatus;
  total_freight: number;
  fuel_cost: number;
  road_cost: number;
  other_cost: number;
  invoice_status: number; // 1 | 0
  notes: string;
  stops: TripStop[];
}

// 6. Araç Aylık Ek Giderleri
export interface VehicleExpense {
  id: string;
  vehicle_id: string;
  vehicle_plate?: string;
  expense_date: string;
  expense_month: string; // 'YYYY-MM'
  title: string;
  amount: number;
}

// 7. Görevler ve Hatırlatıcılar
export interface TaskItem {
  id: string;
  title: string;
  description: string;
  task_date: string;
  task_time: string;
  priority: TaskPriority;
  status: TaskStatus;
  customer_id?: string | null;
  customer_name?: string;
  vehicle_id?: string | null;
  vehicle_plate?: string;
  driver_name?: string | null;
}

// 8. Bağımsız Hatırlatıcı Notlar
export interface ReminderNote {
  id: string;
  title: string;
  content: string;
  customer_id?: string | null;
  customer_name?: string;
  remind_date: string;
  remind_time: string;
  is_completed: number; // 1 | 0
}

// 9. Cari Hesap Ekstresi Hareketi
export interface CustomerStatementItem {
  id: string;
  date: string;
  type: 'trip_stop' | 'manual_debit' | 'payment';
  title: string;
  description: string;
  debit: number;  // Borç
  credit: number; // Alacak / Ödeme
  balanceAfter?: number;
  stop_id?: string;
  due_date?: string;
  payment_status?: StopPaymentStatus;
}

export interface CustomerDetailProfile {
  customer: Customer;
  tripsHistory: TripStop[];
  statement: CustomerStatementItem[];
  notes: ReminderNote[];
}

// Bildirim Merkezi Öğesi
export interface AppNotification {
  id: string;
  category: 'overdue_payment' | 'vehicle_inspection' | 'vehicle_insurance' | 'today_task';
  severity: 'danger' | 'warning' | 'info';
  title: string;
  subtitle: string;
  dateStr: string;
  amount?: number;
  targetTab: NavTabId;
  entityId?: string;
}

// Dashboard Verileri
export interface MonthlyChartPoint {
  month: string;      // 'YYYY-MM'
  label: string;      // 'Kas 26'
  revenue: number;    // Toplam Navlun Geliri
  expenses: number;   // Sefer Giderleri + Araç Ek Giderleri
  netProfit: number;
}

export interface DashboardData {
  todayTripsCount: number;
  pendingReceivablesTotal: number;
  activeTransitVehiclesCount: number;
  totalFleetCount: number;
  monthlyFreightRevenue: number;
  todayTrips: Trip[];
  pendingCustomerStops: TripStop[];
  sixMonthsChart: MonthlyChartPoint[];
  todayTasks: TaskItem[];
  notifications: AppNotification[];
}

// Global Arama (⌘K / Ctrl+K)
export interface GlobalSearchResult {
  id: string;
  category: 'customer' | 'vehicle' | 'trip' | 'driver';
  title: string;
  subtitle: string;
  badge?: string;
  targetTab: NavTabId;
}

export type NavTabId =
  | 'home'
  | 'dashboard'
  | 'trips'
  | 'trip_cost_calc'
  | 'customers'
  | 'vehicle_tracking'
  | 'vehicle_info'
  | 'vehicles'
  | 'village_tankers'
  | 'drivers'
  | 'payments'
  | 'whatsapp'
  | 'markets'
  | 'reports'
  | 'past_months'
  | 'calendar'
  | 'notes'
  | 'tasks'
  | 'planning'
  | 'settings';

// Bağımsız Köy Küçük Tankerleri Takip Modelleri (Ana Nakliye Sisteminden Tamamen Ayrıdır)
export interface VillageTanker {
  id: string;
  name: string;
  plate_or_code: string;
  village_name: string;
  capacity_liters: number;
  current_fuel_liters: number;
  driver_name: string;
  driver_phone: string;
  status: 'active' | 'filling' | 'maintenance';
  notes: string;
}

export interface VillageTankerLog {
  id: string;
  tanker_id: string;
  tanker_name?: string;
  plate_or_code?: string;
  village_name?: string;
  log_date: string;
  operation_type: 'dagitim' | 'dolum' | 'masraf';
  villager_or_target: string;
  fuel_type: string;
  liters: number;
  amount: number;
  cash_amount?: number;
  card_amount?: number;
  credit_sale_amount?: number;
  credit_collected_amount?: number;
  driver_name: string;
  notes: string;
}

export interface AutoBackupItem {
  fileName: string;
  filePath: string;
  createdAt: string;
  sizeBytes: number;
  reason: string;
  isLatestRolling?: boolean;
}

export interface AutoBackupStatus {
  enabled: boolean;
  intervalMinutes: number;
  backupDir: string;
  secondaryDir: string;
  lastBackupAt: string | null;
  totalCount: number;
  backups: AutoBackupItem[];
}

export interface AppPreferences {
  managerName: string;
  companyTitle: string;
  baseCity: string;
  defaultOrigin: string;
  autoLockMinutes: number; // 0 = disabled, 5, 15, 30, 60
  autoBackupMinutes?: number; // 0 = disabled, 5, 10, 15, 30, 60
  fontScale: 'normal' | 'comfortable' | 'large';
}

export interface MonthlyReportSummary {
  month: string;
  tripCount: number;
  stopCount: number;
  totalRevenue: number;
  tripFuelCost: number;
  tripRoadCost: number;
  tripOtherCost: number;
  totalTripExpenses: number;
  vehicleExtraExpenses: number;
  totalAllExpenses: number;
  netOperatingProfit: number;
  collectedAmount: number;
  remainingReceivables: number;
}

// ==========================================
// 10. CANLI İNTERNET SERVİSLERİ (MGM, HAREM ALTIN, EMTİA, RADYO)
// ==========================================
export interface MgmDailyForecastItem {
  date: string;
  dayLabel: string;
  minTemp: number;
  maxTemp: number;
  minHumidity: number;
  maxHumidity: number;
  conditionCode: string;
  conditionText: string;
  windSpeed: number;
}

export interface LiveMgmWeather {
  city: string;
  stationId: number;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  pressure: number;
  visibilityMeters: number;
  conditionCode: string;
  conditionText: string;
  updatedAt: string;
  forecast5Days: MgmDailyForecastItem[];
  isLive: boolean;
}

export interface HaremGoldItem {
  code: string;
  name: string;
  category: 'gold' | 'currency' | 'silver';
  buying: number;
  selling: number;
  low: number;
  high: number;
  close: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
  updatedAt: string;
}

export interface CommodityQuote {
  symbol: string;
  name: string;
  unit: string;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  history: number[]; // sparkline points
  updatedAt: string;
}

export interface LiveMarketsBundle {
  source: string;
  fetchedAt: string;
  isLive: boolean;
  haremGold: HaremGoldItem[];
  haremCurrencies: HaremGoldItem[];
  commodities: CommodityQuote[];
}

export interface RadioStationItem {
  id: string;
  name: string;
  category: 'Ulusal & Haber' | 'Pop & Hit' | 'Arabesk & Damar' | 'Türkü & Halk' | 'Slow & Nostalji';
  frequency?: string;
  streamUrl: string;
  backupUrl?: string;
  codec: string;
}

