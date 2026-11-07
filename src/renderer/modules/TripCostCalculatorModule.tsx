import React, { useState } from 'react';
import {
  Calculator,
  Fuel,
  Route,
  UserCheck,
  Wallet,
  Receipt,
  Gauge,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '../utils/format';

interface CalculationResult {
  distanceKm: number;
  avgFuelPer100Km: number;
  dieselPrice: number;
  driverWageShare: number;
  allowance: number;
  otherExpenses: number;
  totalFuelLiters: number;
  totalFuelCost: number;
  fuelCostPerKm: number;
  totalTripCost: number;
  totalCostPerKm: number;
}

function parseInputNumber(val: string): number {
  if (!val) return 0;
  const normalized = String(val).trim().replace(/\s+/g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function formatNumberTR(num: number, decimals = 2): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num || 0);
}

export const TripCostCalculatorModule: React.FC = () => {
  // 6 Input Fields in exact requested layout:
  // Row 1: Left = Eleman Maaşı / Bu Sefere Düşen Pay | Right = Gidilecek Toplam Mesafe (KM)
  // Row 2: Left = 100 KM'DE Ortalama Yakılan Yakıt | Right = Güncel Motorin Fiyatı
  // Row 3: Left = Harcırah | Right = Diğer Giderler
  const [driverWageShare, setDriverWageShare] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [avgFuelPer100Km, setAvgFuelPer100Km] = useState<string>('');
  const [dieselPrice, setDieselPrice] = useState<string>('');
  const [allowance, setAllowance] = useState<string>('');
  const [otherExpenses, setOtherExpenses] = useState<string>('');

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [calcPulse, setCalcPulse] = useState<boolean>(false);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();

    const km = parseInputNumber(distanceKm);
    const lPer100 = parseInputNumber(avgFuelPer100Km);
    const literPrice = parseInputNumber(dieselPrice);
    const wage = parseInputNumber(driverWageShare);
    const harcirah = parseInputNumber(allowance);
    const extra = parseInputNumber(otherExpenses);

    // 1. Gidilecek toplam mesafede toplam kaç litre yakıt yakıldığı: (KM * 100kmLitre) / 100
    const totalFuelLiters = (km * lPer100) / 100;

    // 2. O litrenin kaç TL olduğu (Toplam Yakıt Gideri): Toplam Litre * Güncel Motorin Fiyatı
    const totalFuelCost = totalFuelLiters * literPrice;

    // 3. KM başına kaç lira yaktığı:
    const fuelCostPerKm = km > 0 ? totalFuelCost / km : (lPer100 * literPrice) / 100;

    // 4. Toplam Sefer Maliyeti: Yakıt Gideri + Diğer Giderler + Harcırah + Eleman Maaşı/Payı
    const totalTripCost = totalFuelCost + extra + harcirah + wage;
    const totalCostPerKm = km > 0 ? totalTripCost / km : 0;

    setResult({
      distanceKm: km,
      avgFuelPer100Km: lPer100,
      dieselPrice: literPrice,
      driverWageShare: wage,
      allowance: harcirah,
      otherExpenses: extra,
      totalFuelLiters,
      totalFuelCost,
      fuelCostPerKm,
      totalTripCost,
      totalCostPerKm
    });

    setCalcPulse(true);
    setTimeout(() => setCalcPulse(false), 500);
  };

  const handleReset = () => {
    setDriverWageShare('');
    setDistanceKm('');
    setAvgFuelPer100Km('');
    setDieselPrice('');
    setAllowance('');
    setOtherExpenses('');
    setResult(null);
  };

  return (
    <div className="p-6 md:p-8 flex flex-col items-center justify-start min-h-full">
      {/* Ortalı Ana Hesaplama Kutucuğu */}
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div
          className="nd-card p-6 md:p-8"
          style={{
            borderRadius: '18px'
          }}
        >
          {/* Üst Başlık */}
          <div
            className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Calculator size={24} />
              </div>
              <div>
                <span
                  className="text-[11px] font-bold uppercase tracking-widest block"
                  style={{ color: 'var(--champagne)' }}
                >
                  MÜŞTERİ ZİYARETİ & FİYATLANDIRMA ARACI
                </span>
                <h1 className="text-xl md:text-2xl font-black tracking-tight mt-0.5">
                  Tır Sefer Maliyet Hesaplama
                </h1>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Müşteriye hızlı ve net fiyat teklifi vermek için bağımsız sefer maliyet hesaplayıcı.
                </p>
              </div>
            </div>

            <span className="text-[11px] font-bold px-3 py-1.5 rounded-full nd-badge-green">
              Bağımsız Hesaplama Aracı
            </span>
          </div>

          {/* 6 Kutucuklu Giriş Formu */}
          <form onSubmit={handleCalculate} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 1. Sol Üst: Eleman Maaşı / Bu Sefere Düşen Pay */}
              <div className="nd-layer p-4 rounded-2xl space-y-2">
                <label className="flex items-center justify-between text-xs font-extrabold">
                  <span className="flex items-center gap-2">
                    <UserCheck size={15} style={{ color: 'var(--accent)' }} />
                    <span>Eleman Maaşı / Bu Sefere Düşen Pay</span>
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    TL (₺)
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={driverWageShare}
                  onChange={(e) => setDriverWageShare(e.target.value)}
                  placeholder="Örn: 3500"
                  className="nd-input w-full py-3 px-3.5 text-sm font-bold tabular-nums"
                />
                <span className="block text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Şoför maaşından bu sefere düşen pay tutarı
                </span>
              </div>

              {/* 2. Sağ Üst: Gidilecek Toplam Mesafe (KM) */}
              <div className="nd-layer p-4 rounded-2xl space-y-2">
                <label className="flex items-center justify-between text-xs font-extrabold">
                  <span className="flex items-center gap-2">
                    <Route size={15} style={{ color: 'var(--accent)' }} />
                    <span>Gidilecek Toplam Mesafe</span>
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    KM
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="Örn: 450"
                  className="nd-input w-full py-3 px-3.5 text-sm font-bold tabular-nums"
                />
                <span className="block text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Seferin toplam kilometresi (KM cinsinden)
                </span>
              </div>

              {/* 3. Sol Orta: 100 KM'DE Ortalama Yakılan Yakıt */}
              <div className="nd-layer p-4 rounded-2xl space-y-2">
                <label className="flex items-center justify-between text-xs font-extrabold">
                  <span className="flex items-center gap-2">
                    <Gauge size={15} style={{ color: 'var(--amber)' }} />
                    <span>100 KM&apos;DE Ortalama Yakılan Yakıt</span>
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    Litre / 100 KM
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={avgFuelPer100Km}
                  onChange={(e) => setAvgFuelPer100Km(e.target.value)}
                  placeholder="Örn: 32"
                  className="nd-input w-full py-3 px-3.5 text-sm font-bold tabular-nums"
                />
                <span className="block text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Tırın 100 kilometrede ortalama yaktığı motorin (Litre)
                </span>
              </div>

              {/* 4. Sağ Orta: Güncel Motorin Fiyatı */}
              <div className="nd-layer p-4 rounded-2xl space-y-2">
                <label className="flex items-center justify-between text-xs font-extrabold">
                  <span className="flex items-center gap-2">
                    <Fuel size={15} style={{ color: 'var(--amber)' }} />
                    <span>Güncel Motorin Fiyatı</span>
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    TL / Litre
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={dieselPrice}
                  onChange={(e) => setDieselPrice(e.target.value)}
                  placeholder="Örn: 46,50"
                  className="nd-input w-full py-3 px-3.5 text-sm font-bold tabular-nums"
                />
                <span className="block text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Hesaplamada kullanılacak 1 litre güncel motorin fiyatı (₺)
                </span>
              </div>

              {/* 5. Sol Alt: Harcırah */}
              <div className="nd-layer p-4 rounded-2xl space-y-2">
                <label className="flex items-center justify-between text-xs font-extrabold">
                  <span className="flex items-center gap-2">
                    <Wallet size={15} style={{ color: 'var(--green)' }} />
                    <span>Harcırah</span>
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    TL (₺)
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={allowance}
                  onChange={(e) => setAllowance(e.target.value)}
                  placeholder="Örn: 1500"
                  className="nd-input w-full py-3 px-3.5 text-sm font-bold tabular-nums"
                />
                <span className="block text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Şoförün bu sefer için aldığı harcırah tutarı
                </span>
              </div>

              {/* 6. Sağ Alt: Diğer Giderler */}
              <div className="nd-layer p-4 rounded-2xl space-y-2">
                <label className="flex items-center justify-between text-xs font-extrabold">
                  <span className="flex items-center gap-2">
                    <Receipt size={15} style={{ color: 'var(--green)' }} />
                    <span>Diğer Giderler</span>
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                    TL (₺)
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={otherExpenses}
                  onChange={(e) => setOtherExpenses(e.target.value)}
                  placeholder="Örn: 1200"
                  className="nd-input w-full py-3 px-3.5 text-sm font-bold tabular-nums"
                />
                <span className="block text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Otoyol, köprü, kantar veya diğer ekstra sefer giderleri
                </span>
              </div>
            </div>

            {/* Kutucukların Altında Sağ Tarafta: Maliyeti Hesapla Butonu */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="nd-btn-secondary px-4 py-3 text-xs font-bold flex items-center gap-2"
              >
                <RotateCcw size={15} />
                <span>Temizle</span>
              </button>

              <button
                type="submit"
                className="nd-btn-primary px-7 py-3.5 text-sm font-extrabold flex items-center gap-2.5 shadow-md"
              >
                <Calculator size={18} />
                <span>Maliyeti Hesapla</span>
              </button>
            </div>
          </form>

          {/* Hesaplama Sonuç Alanı */}
          <div
            className={`mt-7 pt-6 border-t space-y-5 transition-all duration-300 ${
              calcPulse ? 'scale-[1.01]' : ''
            }`}
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                HESAPLANAN YAKIT VE KM MALİYET DÖKÜMÜ
              </span>
              {result && (
                <span className="text-[11px] font-bold flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 size={14} />
                  <span>Hesaplama Güncel</span>
                </span>
              )}
            </div>

            {/* 3 Ara Sonuç Kutucuğu: Yakılan Litre, Yakıt Tutarı (TL), KM Başına Yakıt (TL/KM) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. O KM'de Kaç Litre Yaktığı */}
              <div className="nd-layer p-4 rounded-2xl">
                <span className="text-xs font-bold block" style={{ color: 'var(--text-muted)' }}>
                  Toplam Yakılan Yakıt (Litre)
                </span>
                <p className="text-2xl font-black tabular-nums mt-1.5">
                  {formatNumberTR(result ? result.totalFuelLiters : 0, 2)} L
                </p>
                <span className="text-[11px] block mt-1" style={{ color: 'var(--text-dim)' }}>
                  {result
                    ? `${formatNumberTR(result.distanceKm, 0)} KM × (${formatNumberTR(result.avgFuelPer100Km, 1)} L / 100 KM)`
                    : 'Mesafe × (100 KM Yakıt / 100)'}
                </span>
              </div>

              {/* 2. Yakılan Litrenin Kaç TL Olduğu */}
              <div className="nd-layer p-4 rounded-2xl">
                <span className="text-xs font-bold block" style={{ color: 'var(--text-muted)' }}>
                  Toplam Yakıt Gideri (TL)
                </span>
                <p
                  className="text-2xl font-black tabular-nums mt-1.5"
                  style={{ color: 'var(--amber)' }}
                >
                  {formatCurrency(result ? result.totalFuelCost : 0)}
                </p>
                <span className="text-[11px] block mt-1" style={{ color: 'var(--text-dim)' }}>
                  {result
                    ? `${formatNumberTR(result.totalFuelLiters, 2)} L × ${formatCurrency(result.dieselPrice)}`
                    : 'Yakılan Litre × Güncel Motorin Fiyatı'}
                </span>
              </div>

              {/* 3. KM Başına Maliyet (Toplam Sefer Maliyeti / KM) */}
              <div className="nd-layer p-4 rounded-2xl">
                <span className="text-xs font-bold block" style={{ color: 'var(--text-muted)' }}>
                  KM Başına Maliyet (TL / KM)
                </span>
                <p
                  className="text-2xl font-black tabular-nums mt-1.5"
                  style={{ color: 'var(--champagne)' }}
                >
                  {formatCurrency(result ? result.totalCostPerKm : 0)}{' '}
                  <span className="text-xs font-bold">/ KM</span>
                </p>
                <span className="text-[11px] block mt-1" style={{ color: 'var(--text-dim)' }}>
                  {result
                    ? `Saf Yakıt: ${formatCurrency(result.fuelCostPerKm)}/KM • Toplam ÷ ${formatNumberTR(result.distanceKm, 0)} KM`
                    : 'Toplam Sefer Maliyeti ÷ Toplam Mesafe (KM)'}
                </span>
              </div>
            </div>

            {/* En Altta: TOPLAM SEFER MALİYETİ Kutucuğu */}
            <div
              className="p-6 rounded-2xl border-2 space-y-4"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--accent)'
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span
                    className="text-xs font-extrabold uppercase tracking-wider block"
                    style={{ color: 'var(--champagne)' }}
                  >
                    GENEL TOPLAM (YAKIT + ELEMAN MAAŞ PAYI + HARCIRAH + DİĞER GİDERLER)
                  </span>
                  <h2 className="text-lg font-extrabold mt-0.5">Toplam Sefer Maliyeti</h2>
                </div>

                <div className="text-right">
                  <p
                    className="text-3xl md:text-4xl font-black tabular-nums tracking-tight"
                    style={{ color: 'var(--green)' }}
                  >
                    {formatCurrency(result ? result.totalTripCost : 0)}
                  </p>
                  {result && result.distanceKm > 0 && (
                    <span className="text-xs font-bold block mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      KM Başına Toplam Maliyet: <b>{formatCurrency(result.totalCostPerKm)} / KM</b>
                    </span>
                  )}
                </div>
              </div>

              {/* Kalem Kalem Toplam Özeti */}
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t text-xs"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="nd-card p-3 rounded-xl">
                  <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>
                    Yakıt Gideri
                  </span>
                  <b className="text-sm tabular-nums mt-0.5 block">
                    {formatCurrency(result ? result.totalFuelCost : 0)}
                  </b>
                </div>

                <div className="nd-card p-3 rounded-xl">
                  <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>
                    Eleman Maaşı / Payı
                  </span>
                  <b className="text-sm tabular-nums mt-0.5 block">
                    {formatCurrency(result ? result.driverWageShare : 0)}
                  </b>
                </div>

                <div className="nd-card p-3 rounded-xl">
                  <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>
                    Harcırah
                  </span>
                  <b className="text-sm tabular-nums mt-0.5 block">
                    {formatCurrency(result ? result.allowance : 0)}
                  </b>
                </div>

                <div className="nd-card p-3 rounded-xl">
                  <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>
                    Diğer Giderler
                  </span>
                  <b className="text-sm tabular-nums mt-0.5 block">
                    {formatCurrency(result ? result.otherExpenses : 0)}
                  </b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
