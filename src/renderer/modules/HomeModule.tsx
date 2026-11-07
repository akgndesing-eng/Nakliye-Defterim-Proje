import React, { useState, useEffect } from 'react';
import {
  Truck,
  Wallet,
  Fuel,
  TrendingUp,
  Plus,
  CalendarRange,
  CheckCircle2,
  MessageSquare,
  ArrowRight,
  ShieldAlert,
  Coins,
  CloudSun,
  DollarSign,
  Users,
  FileSpreadsheet,
  LayoutDashboard,
  MapPin
} from 'lucide-react';
import {
  DashboardData,
  NavTabId,
  Vehicle,
  Customer,
  LiveMarketsBundle,
  LiveMgmWeather
} from '../../shared/types';
import { api, getCached } from '../api';
import {
  formatCurrency,
  formatCompactCurrency,
  formatDate,
  getDaysRemaining,
  getCurrentDate
} from '../utils/format';
import fleetHeroTruck from '../assets/fleet_hero_truck.jpg';

interface HomeModuleProps {
  selectedMonth: string;
  managerName?: string;
  companyTitle?: string;
  onNavigate: (tab: NavTabId, entityId?: string) => void;
  onQuickNewTrip: () => void;
}

export const HomeModule: React.FC<HomeModuleProps> = ({
  selectedMonth,
  managerName = 'Umut Bey',
  companyTitle = 'Gökmen Petrol / AKON Transport',
  onNavigate,
  onQuickNewTrip
}) => {
  const [dash, setDash] = useState<DashboardData | null>(() =>
    getCached<DashboardData>(`dashboard:${selectedMonth}`)
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getCached<Vehicle[]>('vehicles') || []);
  const [customers, setCustomers] = useState<Customer[]>(
    () => getCached<Customer[]>('customers') || []
  );
  const [markets, setMarkets] = useState<LiveMarketsBundle | null>(() =>
    getCached<LiveMarketsBundle>('live:markets')
  );
  const [weather, setWeather] = useState<LiveMgmWeather | null>(() =>
    getCached<LiveMgmWeather>('live:weather')
  );
  const [loading, setLoading] = useState<boolean>(
    () => !getCached<DashboardData>(`dashboard:${selectedMonth}`)
  );

  const loadAll = async () => {
    if (!dash) setLoading(true);
    try {
      const [dRes, vRes, cRes] = await Promise.all([
        api.getDashboard(selectedMonth),
        api.getVehicles(),
        api.getCustomers()
      ]);
      setDash(dRes);
      setVehicles(vRes || []);
      setCustomers(cRes || []);
    } finally {
      setLoading(false);
    }

    api.getMarketsBundle().then(setMarkets).catch(() => {});
    api.getMgmWeather().then(setWeather).catch(() => {});
  };

  useEffect(() => {
    loadAll();
  }, [selectedMonth]);

  const todayFormatted = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  });

  if (loading || !dash) {
    return (
      <div className="p-6 space-y-5">
        <div className="nd-card h-80 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="nd-card h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const todayIso = getCurrentDate();
  const topCustomersWithDebt = customers.filter((c) => c.current_balance > 0).slice(0, 5);
  const gramGold =
    markets?.haremGold?.find((g) => g.code === 'KULCEALTIN') || markets?.haremGold?.[0];
  const usdTry = markets?.haremCurrencies?.find((c) => c.code === 'USDTRY');
  const eurTry = markets?.haremCurrencies?.find((c) => c.code === 'EURTRY');
  const brentOil = markets?.commodities?.find((c) => c.symbol === 'BZ=F');

  return (
    <div className="p-3.5 sm:p-6 space-y-3.5 sm:space-y-6">
      {/* 1. MERKEZİ TANKER HERO VITRİN KARTI (Kullanıcının Gönderdiği Tır Fotoğrafı — Hafif Karartılmış Profesyonel Vitrin) */}
      <div className="relative rounded-2xl overflow-hidden border shadow-2xl min-h-[245px] sm:min-h-[340px] flex flex-col justify-between p-3.5 sm:p-7 select-none" style={{ borderColor: 'var(--border)' }}>
        {/* Background Tanker Photo */}
        <img
          src={fleetHeroTruck}
          alt="Nakliye Defterim Filo Tankeri"
          className="absolute inset-0 w-full h-full object-cover object-center scale-[1.01] transition-transform duration-700"
        />

        {/* Multi-layered slightly darkened professional vignette & gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(95deg, rgba(11, 20, 33, 0.88) 0%, rgba(15, 26, 42, 0.62) 48%, rgba(12, 22, 36, 0.78) 100%)'
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10, 18, 28, 0.35) 0%, rgba(10, 18, 28, 0.15) 45%, rgba(10, 18, 28, 0.85) 100%)'
          }}
        />

        {/* Top Row inside Hero */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
            <span
              className="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-extrabold text-white border"
              style={{
                backgroundColor: 'rgba(31, 82, 62, 0.85)',
                borderColor: 'rgba(255, 255, 255, 0.22)',
                backdropFilter: 'blur(6px)'
              }}
            >
              {todayFormatted}
            </span>
            <span
              className="hidden sm:inline-block px-3 py-1 rounded-full text-xs font-bold text-amber-200 border"
              style={{
                backgroundColor: 'rgba(20, 23, 22, 0.72)',
                borderColor: 'rgba(197, 168, 114, 0.4)',
                backdropFilter: 'blur(6px)'
              }}
            >
              ADR / Akaryakıt Lojistik Yönetim Merkezi
            </span>
          </div>

          {/* Live Weather & Market Pill in Hero */}
          <div
            className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold text-slate-100 flex items-center gap-2 sm:gap-4 border"
            style={{
              backgroundColor: 'rgba(15, 25, 40, 0.72)',
              borderColor: 'rgba(255, 255, 255, 0.18)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <span className="flex items-center gap-1">
              <CloudSun size={13} className="text-sky-400 shrink-0" />
              <span className="hidden sm:inline">Edirne MGM:</span>
              <b className="tabular-nums text-white">
                {weather ? `${weather.temperature.toFixed(1)}°C` : '12.3°C'}
              </b>
            </span>
            <span className="opacity-30">|</span>
            <span className="flex items-center gap-1">
              <Coins size={13} className="text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Gram Altın:</span>
              <b className="tabular-nums text-amber-300">
                {gramGold ? `${gramGold.selling.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '...'}
              </b>
            </span>
          </div>
        </div>

        {/* Center / Bottom Hero Headline & Glass KPI Strip */}
        <div className="relative z-10 mt-3.5 sm:mt-8 space-y-3 sm:space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 sm:gap-4">
            <div className="max-w-2xl">
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight drop-shadow-md leading-snug">
                Nakliye Defterim — Genel Filo & Operasyon Özeti
              </h1>
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-200 mt-1 font-medium leading-relaxed drop-shadow">
                Hoş geldiniz {managerName} ({companyTitle}). Tüm akaryakıt tankerleriniz, çoklu istasyon sevkiyatlarınız, müşteri cari bakiyeleriniz ve canlı piyasa verileriniz tek merkezde hazır.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                onClick={onQuickNewTrip}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-extrabold text-white flex items-center justify-center gap-1.5 shadow-lg transition-transform active:scale-95"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Plus size={15} className="shrink-0" />
                <span className="truncate">Yeni Sefer Başlat</span>
              </button>
              <button
                onClick={() => onNavigate('reports')}
                className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-extrabold text-white flex items-center justify-center gap-1.5 border transition-all hover:bg-white/15"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderColor: 'rgba(255, 255, 255, 0.28)',
                  backdropFilter: 'blur(8px)'
                }}
              >
                <FileSpreadsheet size={14} className="shrink-0" />
                <span className="truncate">Aylık Raporlar</span>
              </button>
            </div>
          </div>

          {/* 4 Glassmorphic Summary Cards Inside the Truck Hero */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 pt-2">
            <div
              onClick={() => onNavigate('trips')}
              className="p-3 sm:p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                backgroundColor: 'rgba(17, 27, 41, 0.76)',
                borderColor: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div className="flex items-center justify-between text-slate-300 text-[10px] sm:text-xs font-bold">
                <span>BUGÜNKÜ SEFERLER</span>
                <Truck size={15} className="text-sky-400 shrink-0" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
                {dash.todayTripsCount} <span className="text-[11px] font-semibold text-slate-300">Sevkiyat</span>
              </p>
              <span className="text-[10px] sm:text-[11px] text-sky-300 font-semibold mt-1 block truncate">
                Sefer ve durak detayları →
              </span>
            </div>

            <div
              onClick={() => onNavigate('payments')}
              className="p-3 sm:p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                backgroundColor: 'rgba(17, 27, 41, 0.76)',
                borderColor: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div className="flex items-center justify-between text-slate-300 text-[10px] sm:text-xs font-bold">
                <span>AÇIK TAHSİLAT</span>
                <Wallet size={15} className="text-amber-400 shrink-0" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-amber-300 mt-1 tabular-nums truncate">
                {formatCompactCurrency(dash.pendingReceivablesTotal)}
              </p>
              <span className="text-[10px] sm:text-[11px] text-amber-200/90 font-semibold mt-1 block truncate">
                {dash.pendingCustomerStops.length} açık istasyon durağı →
              </span>
            </div>

            <div
              onClick={() => onNavigate('vehicles')}
              className="p-3 sm:p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                backgroundColor: 'rgba(17, 27, 41, 0.76)',
                borderColor: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div className="flex items-center justify-between text-slate-300 text-[10px] sm:text-xs font-bold">
                <span>AKTİF FİLO</span>
                <Fuel size={15} className="text-purple-400 shrink-0" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
                {dash.activeTransitVehiclesCount} / {dash.totalFleetCount}{' '}
                <span className="text-[11px] font-semibold text-slate-300">Araç</span>
              </p>
              <span className="text-[10px] sm:text-[11px] text-purple-300 font-semibold mt-1 block truncate">
                Muayene ve giderler →
              </span>
            </div>

            <div
              onClick={() => onNavigate('reports')}
              className="p-3 sm:p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01]"
              style={{
                backgroundColor: 'rgba(17, 27, 41, 0.76)',
                borderColor: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div className="flex items-center justify-between text-slate-300 text-[10px] sm:text-xs font-bold">
                <span>BU AY CİRO</span>
                <TrendingUp size={15} className="text-emerald-400 shrink-0" />
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 tabular-nums truncate">
                {formatCompactCurrency(dash.monthlyFreightRevenue)}
              </p>
              <span className="text-[10px] sm:text-[11px] text-emerald-300 font-semibold mt-1 block truncate">
                Dönem: {selectedMonth} →
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TÜM SİSTEMİN 360° ÖZET PANELLERİ (3 Sütunlu Master Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-6">
        {/* Sütun 1: Son Seferler & Sevkiyat Durumu (4 Cols) */}
        <div className="lg:col-span-4 nd-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Truck size={17} style={{ color: 'var(--accent)' }} />
                <h3 className="text-sm font-extrabold">Son Seferler & Güzergâhlar</h3>
              </div>
              <button
                onClick={() => onNavigate('trips')}
                className="text-xs font-bold flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <span>Tümü</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="space-y-2.5">
              {dash.todayTrips.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  onClick={() => onNavigate('trips', t.id)}
                  className="nd-layer nd-hover-accent p-3 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold tabular-nums">{t.trip_no}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === 'delivered'
                          ? 'nd-badge-green'
                          : t.status === 'transit'
                          ? 'nd-badge-blue'
                          : 'nd-badge-purple'
                      }`}
                    >
                      {t.status === 'delivered'
                        ? 'Teslim Edildi'
                        : t.status === 'transit'
                        ? 'Yolda / Transit'
                        : 'Planlandı'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold mt-1 truncate">
                    {t.origin} → {t.destination}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span>
                      <b className="tabular-nums">{t.vehicle_plate}</b> • {t.driver_name}
                    </span>
                    <b className="tabular-nums" style={{ color: 'var(--text)' }}>
                      {formatCurrency(t.total_freight)}
                    </b>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onQuickNewTrip}
            className="nd-btn-secondary w-full py-2 mt-4 text-xs flex items-center justify-center gap-1.5"
          >
            <Plus size={14} />
            <span>Hızlı Sefer Kaydı Ekle</span>
          </button>
        </div>

        {/* Sütun 2: Açık Müşteri Carileri & Tahsilat Özeti (4 Cols) */}
        <div className="lg:col-span-4 nd-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Users size={17} style={{ color: 'var(--amber)' }} />
                <h3 className="text-sm font-extrabold">Müşteri Cari & Tahsilat Özeti</h3>
              </div>
              <button
                onClick={() => onNavigate('customers')}
                className="text-xs font-bold flex items-center gap-1 hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                <span>Cariler</span>
                <ArrowRight size={13} />
              </button>
            </div>

            <div className="space-y-2.5">
              {topCustomersWithDebt.length === 0 ? (
                <div className="nd-layer p-5 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  Açık bakiyesi olan müşteri bulunmuyor.
                </div>
              ) : (
                topCustomersWithDebt.map((c) => {
                  const hasOverdue = Number(c.overdue_amount || 0) > 0;
                  return (
                    <div
                      key={c.id}
                      onClick={() => onNavigate('customers', c.id)}
                      className="nd-layer nd-hover-amber p-3 cursor-pointer transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold truncate">{c.name}</span>
                          {hasOverdue && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded nd-badge-red">
                              Gecikmiş
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {c.city} • Vade: {formatDate(c.earliest_due_date)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className="text-xs font-extrabold tabular-nums block"
                          style={{ color: hasOverdue ? 'var(--red)' : 'var(--amber)' }}
                        >
                          {formatCurrency(c.current_balance)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('whatsapp')}
            className="nd-btn-primary w-full py-2 mt-4 text-xs flex items-center justify-center gap-1.5"
            style={{ backgroundColor: 'var(--green)' }}
          >
            <MessageSquare size={14} />
            <span>WhatsApp Tahsilat Hatırlatma Gönder</span>
          </button>
        </div>

        {/* Sütun 3: Filo Durumu, Muayene/Sigorta & Günün Görevleri (4 Cols) */}
        <div className="lg:col-span-4 nd-card p-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Filo Özeti */}
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2">
                  <Fuel size={17} style={{ color: 'var(--purple)' }} />
                  <h3 className="text-sm font-extrabold">Filo & Evrak Geri Sayımı</h3>
                </div>
                <button
                  onClick={() => onNavigate('vehicle_info')}
                  className="text-xs font-bold flex items-center gap-1 hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  <span>Araç Bilgileri</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              <div className="space-y-2">
                {vehicles.slice(0, 3).map((v) => {
                  const inspDays = getDaysRemaining(v.inspection_date);
                  const insDays = getDaysRemaining(v.insurance_date);
                  return (
                    <div
                      key={v.id}
                      onClick={() => onNavigate('vehicles', v.id)}
                      className="nd-layer nd-hover-accent p-2.5 flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <span className="text-xs font-extrabold tabular-nums">{v.plate}</span>
                        <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>
                          {v.driver_name} • {Number(v.fuel_capacity || 0).toLocaleString('tr-TR')} Lt
                        </span>
                      </div>
                      <div className="text-right space-y-1">
                        {inspDays !== null && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full block tabular-nums ${
                              inspDays <= 15 ? 'nd-badge-red' : inspDays <= 30 ? 'nd-badge-amber' : 'nd-badge-green'
                            }`}
                          >
                            Vize: {inspDays}g
                          </span>
                        )}
                        {insDays !== null && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full block tabular-nums ${
                              insDays <= 15 ? 'nd-badge-red' : insDays <= 30 ? 'nd-badge-amber' : 'nd-badge-green'
                            }`}
                          >
                            Kasko: {insDays}g
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Günün Görevleri Özeti */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold">Günün Görevleri & Planlama</span>
                <button
                  onClick={() => onNavigate('calendar')}
                  className="text-[11px] font-bold hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  Takvimi Aç →
                </button>
              </div>
              <div className="space-y-1.5">
                {dash.todayTasks.slice(0, 2).map((tsk) => (
                  <div key={tsk.id} className="nd-layer p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2
                        size={14}
                        style={{ color: tsk.status === 'completed' ? 'var(--green)' : 'var(--accent)' }}
                      />
                      <span className="font-semibold truncate">{tsk.title}</span>
                    </div>
                    <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {tsk.task_time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Live Market Quick Bar */}
          <div
            onClick={() => onNavigate('markets')}
            className="nd-layer nd-hover-accent p-3 mt-4 flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs">
              <DollarSign size={15} style={{ color: 'var(--green)' }} />
              <span>
                USD: <b className="tabular-nums">{usdTry ? `${usdTry.selling.toFixed(2)}₺` : '...'}</b> • EUR:{' '}
                <b className="tabular-nums">{eurTry ? `${eurTry.selling.toFixed(2)}₺` : '...'}</b> • Brent:{' '}
                <b className="tabular-nums">{brentOil ? `$${brentOil.price.toFixed(2)}` : '...'}</b>
              </span>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--accent)' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
