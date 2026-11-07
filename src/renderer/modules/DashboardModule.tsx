import React, { useState, useEffect } from 'react';
import {
  Truck,
  Wallet,
  Fuel,
  TrendingUp,
  Plus,
  CalendarRange,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  ArrowRight,
  BarChart3,
  Coins,
  CloudSun,
  DollarSign,
  FileCheck,
  ShieldAlert,
  Receipt
} from 'lucide-react';
import {
  DashboardData,
  NavTabId,
  TripStatus,
  LiveMarketsBundle,
  LiveMgmWeather,
  MonthlyReportSummary,
  Vehicle
} from '../../shared/types';
import { api, getCached } from '../api';
import {
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  getCurrentDate,
  getDaysRemaining
} from '../utils/format';

interface DashboardModuleProps {
  selectedMonth: string;
  managerName?: string;
  companyTitle?: string;
  onNavigate: (tab: NavTabId, entityId?: string) => void;
  onQuickNewTrip: () => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  selectedMonth,
  managerName = 'Umut Bey',
  companyTitle = 'Gökmen Petrol Ürünleri Nakliyat • Edirne',
  onNavigate,
  onQuickNewTrip
}) => {
  const [data, setData] = useState<DashboardData | null>(() =>
    getCached<DashboardData>(`dashboard:${selectedMonth}`)
  );
  const [liveMarkets, setLiveMarkets] = useState<LiveMarketsBundle | null>(() =>
    getCached<LiveMarketsBundle>('live:markets')
  );
  const [liveWeather, setLiveWeather] = useState<LiveMgmWeather | null>(() =>
    getCached<LiveMgmWeather>('live:weather')
  );
  const [reports, setReports] = useState<MonthlyReportSummary[]>(
    () => getCached<MonthlyReportSummary[]>('reports') || []
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>(
    () => getCached<Vehicle[]>('vehicles') || []
  );
  const [loading, setLoading] = useState<boolean>(
    () => !getCached<DashboardData>(`dashboard:${selectedMonth}`)
  );

  const loadDashboard = async () => {
    if (!data) setLoading(true);
    try {
      const [res, repRes, vehRes] = await Promise.all([
        api.getDashboard(selectedMonth),
        api.getMonthlyReports(),
        api.getVehicles()
      ]);
      setData(res);
      setReports(repRes || []);
      setVehicles(vehRes || []);
    } finally {
      setLoading(false);
    }
    // Load live feeds in background without blocking local SQLite dashboard
    api.getMarketsBundle().then(setLiveMarkets).catch(() => {});
    api.getMgmWeather().then(setLiveWeather).catch(() => {});
  };

  useEffect(() => {
    loadDashboard();
  }, [selectedMonth]);

  const handleToggleTask = async (taskId: string) => {
    await api.toggleTaskStatus(taskId);
    loadDashboard();
  };

  const todayFormatted = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  });

  const renderTripStatusBadge = (status: TripStatus) => {
    if (status === 'planned') {
      return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold nd-badge-purple">Planlandı</span>;
    }
    if (status === 'transit') {
      return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold nd-badge-blue">Yolda / Transit</span>;
    }
    return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold nd-badge-green">Teslim Edildi</span>;
  };

  if (loading || !data) {
    return (
      <div className="p-6 space-y-4">
        <div className="nd-card p-6 animate-pulse h-28" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="nd-card p-5 h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const todayIso = getCurrentDate();
  const chartPoints = data.sixMonthsChart || [];
  const maxBarVal = Math.max(
    10000,
    ...chartPoints.map((p) => Math.max(p.revenue, p.expenses))
  );
  const sixMoTotalRev = chartPoints.reduce((acc, p) => acc + p.revenue, 0);
  const sixMoTotalExp = chartPoints.reduce((acc, p) => acc + p.expenses, 0);
  const sixMoNet = sixMoTotalRev - sixMoTotalExp;

  const curMonthReport = reports.find((r) => r.month === selectedMonth) || reports[0];
  const monthTripCount = curMonthReport?.tripCount ?? data.todayTripsCount;
  const monthCollected = curMonthReport?.collectedAmount ?? 0;
  const monthTotalExpenses = curMonthReport?.totalAllExpenses ?? 0;
  const pendingInvoicesCount = data.todayTrips.filter((t) => Number(t.invoice_status) === 0).length;
  const upcomingDocVehicles = vehicles.slice(0, 3);

  return (
    <div className="p-6 space-y-6">
      {/* 1. HERO ALANI */}
      <div className="nd-card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden">
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-1/3 opacity-15"
          style={{
            background: 'radial-gradient(circle at right center, var(--accent), transparent 70%)'
          }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full nd-badge-blue">
              {todayFormatted}
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              {companyTitle}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
            Kolay gelsin, {managerName} 👋
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Tanker filosu sevkiyat durumu, çoklu istasyon bırakımları ve tahsilat vadeleri anlık olarak günceldir.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigate('planning')}
            className="nd-btn-secondary px-4 py-2.5 text-xs flex items-center gap-2"
          >
            <CalendarRange size={15} style={{ color: 'var(--accent)' }} />
            <span>Operasyon Takvimi</span>
          </button>
          <button
            onClick={onQuickNewTrip}
            className="nd-btn-primary px-4 py-2.5 text-xs flex items-center gap-2 shadow-md"
          >
            <Plus size={16} />
            <span>Yeni Sefer Oluştur</span>
          </button>
        </div>
      </div>

      {/* CANLI PİYASALAR & MGM HAVA DURUMU HIZLI DURUM ŞERİDİ */}
      <div className="nd-card px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          <button
            onClick={() => onNavigate('markets')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Coins size={15} style={{ color: 'var(--amber)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Harem Gram Altın:</span>
            <b className="tabular-nums">
              {liveMarkets?.haremGold?.[0]
                ? `${liveMarkets.haremGold[0].selling.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`
                : 'Canlı Bağlanıyor...'}
            </b>
          </button>

          <button
            onClick={() => onNavigate('markets')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <DollarSign size={15} style={{ color: 'var(--green)' }} />
            <span style={{ color: 'var(--text-muted)' }}>USD / EUR:</span>
            <b className="tabular-nums">
              {liveMarkets?.haremCurrencies?.[0]
                ? `${liveMarkets.haremCurrencies[0].selling.toFixed(3)} ₺ / ${
                    liveMarkets.haremCurrencies[1]?.selling.toFixed(3) || '-'
                  } ₺`
                : '...'}
            </b>
          </button>

          <button
            onClick={() => onNavigate('markets')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Fuel size={15} style={{ color: 'var(--accent)' }} />
            <span style={{ color: 'var(--text-muted)' }}>Brent Petrol:</span>
            <b className="tabular-nums">
              {liveMarkets?.commodities?.[0]
                ? `$${liveMarkets.commodities[0].price.toFixed(2)}`
                : '...'}
            </b>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <CloudSun size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-muted)' }}>Edirne MGM:</span>
          <b className="tabular-nums">
            {liveWeather
              ? `${liveWeather.temperature.toFixed(1)}°C • ${liveWeather.conditionText} (Rüzgâr ${liveWeather.windSpeed} km/s)`
              : 'Yükleniyor...'}
          </b>
        </div>
      </div>

      {/* 2. FİNANSAL VE OPERASYONEL ANA GÖSTERGELER (Gelir, Tahsilat, Kalan Alacak, Gider Net Ayrımı) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Toplam Nakliye Tutarı (Aylık Navlun Geliri) */}
        <div
          onClick={() => onNavigate('reports')}
          className="nd-card nd-card-interactive p-5 flex items-start justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Toplam Nakliye Tutarı ({selectedMonth})
            </p>
            <p
              className="text-2xl font-black mt-2 tabular-nums kpi-value"
              style={{ color: 'var(--accent)' }}
            >
              {formatCompactCurrency(data.monthlyFreightRevenue)}
            </p>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Aylık {monthTripCount} sefer • Bugün {data.todayTripsCount} aktif sefer
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <TrendingUp size={20} />
          </div>
        </div>

        {/* KPI 2: Tahsil Edilen Tutar */}
        <div
          onClick={() => onNavigate('payments')}
          className="nd-card nd-card-interactive p-5 flex items-start justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Tahsil Edilen Tutar ({selectedMonth})
            </p>
            <p
              className="text-2xl font-black mt-2 tabular-nums kpi-value"
              style={{ color: 'var(--green)' }}
            >
              {formatCompactCurrency(monthCollected)}
            </p>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Kasaya giren onaylı durak tahsilatı
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: 'var(--green)' }}
          >
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* KPI 3: Kalan Alacak (Tahsilat Bekleyen) */}
        <div
          onClick={() => onNavigate('payments')}
          className="nd-card nd-card-interactive p-5 flex items-start justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Kalan Alacak (Açık Cari)
            </p>
            <p
              className="text-2xl font-black mt-2 tabular-nums kpi-value"
              style={{ color: data.pendingReceivablesTotal > 0 ? 'var(--amber)' : 'var(--green)' }}
            >
              {formatCompactCurrency(data.pendingReceivablesTotal)}
            </p>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {data.pendingCustomerStops.length} açık durak • {pendingInvoicesCount} bekleyen fatura
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: 'var(--amber)' }}
          >
            <Wallet size={20} />
          </div>
        </div>

        {/* KPI 4: Toplam Gider & Filo Durumu */}
        <div
          onClick={() => onNavigate('vehicles')}
          className="nd-card nd-card-interactive p-5 flex items-start justify-between"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Toplam Gider & Filo ({data.activeTransitVehiclesCount}/{data.totalFleetCount})
            </p>
            <p
              className="text-2xl font-black mt-2 tabular-nums kpi-value"
              style={{ color: 'var(--red)' }}
            >
              {formatCompactCurrency(monthTotalExpenses)}
            </p>
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Sefer yakıt/yol + araç aylık bakım gideri
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: 'var(--red)' }}
          >
            <Receipt size={20} />
          </div>
        </div>
      </div>

      {/* YAKLAŞAN ARAÇ BELGE TARİHLERİ & BEKLEYEN FATURALAR ÖZET BARI */}
      <div className="nd-card px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--champagne)' }}>
            <ShieldAlert size={15} />
            <span>Yaklaşan Araç Belge Tarihleri:</span>
          </span>
          {upcomingDocVehicles.map((v) => {
            const vizeDays = getDaysRemaining(v.inspection_date);
            const sigortaDays = getDaysRemaining(v.insurance_date);
            return (
              <button
                key={v.id}
                onClick={() => onNavigate('vehicles', v.id)}
                className="nd-layer nd-hover-accent px-2.5 py-1 flex items-center gap-2 text-[11px]"
              >
                <b className="tabular-nums">{v.plate}</b>
                <span style={{ color: 'var(--text-muted)' }}>
                  Vize: <b className="tabular-nums">{vizeDays ?? '-'}g</b> • Sigorta:{' '}
                  <b className="tabular-nums">{sigortaDays ?? '-'}g</b>
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onNavigate('trips')}
          className="nd-layer nd-hover-accent px-3 py-1 flex items-center gap-2 text-[11px] font-semibold"
        >
          <FileCheck size={14} style={{ color: 'var(--accent)' }} />
          <span>
            Bekleyen Faturalar: <b className="tabular-nums">{pendingInvoicesCount} Sefer</b>
          </span>
        </button>
      </div>

      {/* 3. ORTA BÖLÜM: GÜNÜN SEFERLERİ TABLOSU & MÜŞTERİ TAHSİLAT DÖKÜMÜ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Günün Seferleri Tablosu (7 Cols) */}
        <div className="nd-card p-5 lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold">Günün & Son Dönem Seferleri</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Çıkış rafinerisi, varış güzergâhı, plaka/şoför, durak sayısı ve navlun
                </p>
              </div>
              <button
                onClick={() => onNavigate('trips')}
                className="text-xs font-bold flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <span>Tüm Seferler</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <th className="py-2.5 px-2 font-semibold">Sefer / Tarih</th>
                    <th className="py-2.5 px-2 font-semibold">Güzergâh</th>
                    <th className="py-2.5 px-2 font-semibold">Plaka / Şoför</th>
                    <th className="py-2.5 px-2 font-semibold text-center">Durak</th>
                    <th className="py-2.5 px-2 font-semibold">Durum</th>
                    <th className="py-2.5 px-2 font-semibold text-right">Navlun</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {data.todayTrips.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => onNavigate('trips', t.id)}
                      className="hover:opacity-90 cursor-pointer transition-opacity"
                    >
                      <td className="py-3 px-2">
                        <div className="font-bold">{t.trip_no}</div>
                        <div className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(t.trip_date)}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-semibold truncate max-w-[175px]">{t.origin}</div>
                        <div className="text-[11px] truncate max-w-[175px]" style={{ color: 'var(--text-muted)' }}>
                          → {t.destination}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className="font-bold px-2 py-0.5 rounded nd-layer text-[11px] tabular-nums">
                          {t.vehicle_plate || '-'}
                        </span>
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {t.driver_name}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold nd-layer tabular-nums">
                          {t.stops?.length || 0} İstasyon
                        </span>
                      </td>
                      <td className="py-3 px-2">{renderTripStatusBadge(t.status)}</td>
                      <td className="py-3 px-2 text-right font-bold tabular-nums">
                        {formatCurrency(t.total_freight)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Müşteri Tahsilat Dökümü (5 Cols) */}
        <div className="nd-card p-5 lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold">Müşteri Tahsilat Dökümü</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Geciken ve yaklaşan durak vadeleri (Kırmızı / Amber uyarı)
                </p>
              </div>
              <button
                onClick={() => onNavigate('payments')}
                className="text-xs font-bold flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <span>Tahsilat Ekranı</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {data.pendingCustomerStops.length === 0 ? (
                <div className="nd-layer p-5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  Bekleyen açık müşteri tahsilatı bulunmuyor.
                </div>
              ) : (
                data.pendingCustomerStops.slice(0, 6).map((stop) => {
                  const remaining = Number(stop.stop_amount) - Number(stop.paid_amount || 0);
                  const isOverdue = stop.due_date && stop.due_date < todayIso;
                  return (
                    <div
                      key={stop.id}
                      onClick={() => onNavigate('payments', stop.id)}
                      className="p-3 rounded-xl nd-layer flex items-center justify-between gap-3 cursor-pointer hover:opacity-95 transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold truncate">{stop.customer_name}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isOverdue ? 'nd-badge-red' : 'nd-badge-amber'
                            }`}
                          >
                            {isOverdue ? 'Vadesi Geçti' : 'Bekliyor'}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                          {stop.trip_no} • {stop.delivered_item} ({stop.quantity} Lt) • Vade: {formatDate(stop.due_date)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p
                          className="text-xs font-extrabold tabular-nums"
                          style={{ color: isOverdue ? 'var(--red)' : 'var(--amber)' }}
                        >
                          {formatCurrency(remaining)}
                        </p>
                        {stop.paid_amount > 0 && (
                          <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            Ödenen: {formatCompactCurrency(stop.paid_amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. ALT BÖLÜM: SON 6 AY GELİR - KAYITLI GİDER SVG BAR CHART & GÜNÜN İŞLERİ + CUMA HATIRLATMA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Son 6 Ay Gelir - Kayıtlı Gider Grafiği (7 Cols) */}
        <div className="nd-card p-5 lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} style={{ color: 'var(--accent)' }} />
                <div>
                  <h3 className="text-sm font-bold">Son 6 Ay Gelir — Kayıtlı Gider Grafiği</h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Sefer navlun gelirleri ile sefer + araç aylık giderlerinin karşılaştırması
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: 'var(--accent)' }} />
                  Gelir
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: 'var(--red)' }} />
                  Kayıtlı Gider
                </span>
              </div>
            </div>

            {/* SVG Bar Chart */}
            <div className="nd-layer p-4">
              <svg viewBox="0 0 600 200" className="w-full h-44 overflow-visible">
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const y = 165 - ratio * 140;
                  return (
                    <g key={idx}>
                      <line
                        x1={40}
                        y1={y}
                        x2={580}
                        y2={y}
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text
                        x={34}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="9"
                        fill="var(--text-muted)"
                      >
                        {Math.round((maxBarVal * ratio) / 1000)}k
                      </text>
                    </g>
                  );
                })}

                {chartPoints.map((pt, idx) => {
                  const groupX = 68 + idx * 86;
                  const revH = Math.max(4, Math.round((pt.revenue / maxBarVal) * 140));
                  const expH = Math.max(4, Math.round((pt.expenses / maxBarVal) * 140));
                  return (
                    <g key={pt.month}>
                      {/* Revenue Bar */}
                      <rect
                        x={groupX}
                        y={165 - revH}
                        width={22}
                        height={revH}
                        rx={4}
                        fill="var(--accent)"
                      >
                        <title>{`${pt.label} Gelir: ${formatCurrency(pt.revenue)}`}</title>
                      </rect>
                      {/* Expense Bar */}
                      <rect
                        x={groupX + 26}
                        y={165 - expH}
                        width={22}
                        height={expH}
                        rx={4}
                        fill="var(--red)"
                      >
                        <title>{`${pt.label} Gider: ${formatCurrency(pt.expenses)}`}</title>
                      </rect>
                      {/* Month Label */}
                      <text
                        x={groupX + 24}
                        y={184}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="600"
                        fill="var(--text-muted)"
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* 6-Month Summary Totals */}
              <div
                className="grid grid-cols-3 gap-3 pt-3 mt-2 border-t text-center"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <span className="text-[10px] font-semibold block" style={{ color: 'var(--text-muted)' }}>
                    6 Aylık Toplam Gelir
                  </span>
                  <span className="text-xs font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>
                    {formatCurrency(sixMoTotalRev)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold block" style={{ color: 'var(--text-muted)' }}>
                    6 Aylık Kayıtlı Gider
                  </span>
                  <span className="text-xs font-extrabold tabular-nums" style={{ color: 'var(--red)' }}>
                    {formatCurrency(sixMoTotalExp)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold block" style={{ color: 'var(--text-muted)' }}>
                    Gelir - Gider Net Farkı
                  </span>
                  <span
                    className="text-xs font-extrabold tabular-nums"
                    style={{ color: sixMoNet >= 0 ? 'var(--green)' : 'var(--red)' }}
                  >
                    {formatCurrency(sixMoNet)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Günün Yapılacak İşleri & Hızlı Cuma Tahsilat Hatırlatma Kartı (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Günün Yapılacak İşleri */}
          <div className="nd-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold">Günün Yapılacak İşleri</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Operasyon görevleri ve hatırlatmalar
                </p>
              </div>
              <button
                onClick={() => onNavigate('planning')}
                className="text-xs font-bold hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                + Görev Ekle
              </button>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {data.todayTasks.map((task) => {
                const isDone = task.status === 'completed';
                return (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id)}
                    className="p-2.5 rounded-xl nd-layer flex items-center justify-between gap-2.5 cursor-pointer hover:opacity-90"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CheckCircle2
                        size={16}
                        className="shrink-0"
                        style={{ color: isDone ? 'var(--green)' : 'var(--text-muted)' }}
                      />
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold truncate ${
                            isDone ? 'line-through opacity-60' : ''
                          }`}
                        >
                          {task.title}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {task.task_time || 'Gün içi'} • {task.description}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        task.priority === 'high'
                          ? 'nd-badge-red'
                          : task.priority === 'normal'
                          ? 'nd-badge-blue'
                          : 'nd-badge-green'
                      }`}
                    >
                      {task.priority === 'high' ? 'Acil' : 'Normal'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hızlı Cuma Tahsilat Hatırlatma Kartı */}
          <div
            className="nd-card p-5 border-l-4"
            style={{ borderLeftColor: 'var(--green)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} style={{ color: 'var(--green)' }} />
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--green)' }}>
                    Hızlı Cuma Tahsilat Hatırlatma Motoru
                  </h4>
                </div>
                <p className="text-xs font-semibold mt-1.5">
                  Açık bakiyesi bulunan müşterilere manuel onaylı WhatsApp tahsilat hatırlatması gönderin.
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Toplam Açık Alacak: <b className="tabular-nums">{formatCurrency(data.pendingReceivablesTotal)}</b>
                </p>
              </div>
              <button
                onClick={() => onNavigate('whatsapp')}
                className="nd-btn-primary px-3.5 py-2 text-xs shrink-0 flex items-center gap-1.5 shadow-sm"
                style={{ backgroundColor: 'var(--green)' }}
              >
                <MessageSquare size={14} />
                <span>WhatsApp Motoru</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
