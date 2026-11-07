import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Fuel,
  DollarSign,
  Coins,
  ExternalLink,
  RefreshCw,
  Signal,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { LiveMarketsBundle, CommodityQuote } from '../../shared/types';
import { api, getCached } from '../api';

export const MarketsModule: React.FC = () => {
  const [bundle, setBundle] = useState<LiveMarketsBundle | null>(() =>
    getCached<LiveMarketsBundle>('live:markets')
  );
  const [loading, setLoading] = useState<boolean>(() => !getCached<LiveMarketsBundle>('live:markets'));
  const [refreshKey, setRefreshKey] = useState(Date.now());
  const [goldFilter, setGoldFilter] = useState<'all' | 'gold' | 'silver'>('all');

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getMarketsBundle();
      setBundle(res);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarkets();
    const timer = setInterval(loadMarkets, 15000); // Auto-refresh every 15 seconds
    return () => clearInterval(timer);
  }, [loadMarkets]);

  // Investing.com Live Technical Iframe URLs
  const investingBrentUrl = `https://ssltvc.investing.com/?pair_ID=8833&height=300&width=580&interval=300&plotStyle=area&domain_ID=10&lang_ID=10&timezone_ID=15&t=${refreshKey}`;
  const investingGasOilUrl = `https://ssltvc.investing.com/?pair_ID=8861&height=300&width=580&interval=300&plotStyle=area&domain_ID=10&lang_ID=10&timezone_ID=15&t=${refreshKey}`;

  const formatNum = (val: number, decimals = 2) =>
    new Intl.NumberFormat('tr-TR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(Number(val || 0));

  const renderSparkline = (quote: CommodityQuote) => {
    const pts = quote.history || [];
    if (pts.length < 2) return null;
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    const width = 130;
    const height = 36;

    const polyPoints = pts
      .map((val, idx) => {
        const x = (idx / (pts.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 6) - 3;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const isPositive = quote.changePercent >= 0;
    const strokeColor = isPositive ? 'var(--green)' : 'var(--red)';

    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyPoints}
        />
      </svg>
    );
  };

  const brentItem = bundle?.commodities.find((c) => c.symbol === 'BZ=F');
  const gasOilTonItem = bundle?.commodities.find((c) => c.symbol === 'LGO-TON');
  const usdTryItem = bundle?.haremCurrencies.find((c) => c.code === 'USDTRY');
  const eurTryItem = bundle?.haremCurrencies.find((c) => c.code === 'EURTRY');
  const gramGoldItem =
    bundle?.haremGold.find((g) => g.code === 'KULCEALTIN') ||
    bundle?.haremGold.find((g) => g.code === 'ALTIN');

  const filteredGoldList = (bundle?.haremGold || []).filter((item) =>
    goldFilter === 'all' ? true : item.category === goldFilter
  );

  return (
    <div className="p-6 space-y-6">
      {/* 1. TOP LIVE TICKER SUMMARY BAR */}
      <div className="nd-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* Harem Gram Altın */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: 'var(--amber)' }}
            >
              <Coins size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--text-muted)' }}>
                Harem Gram Altın (Satış)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tabular-nums">
                  {gramGoldItem ? `${formatNum(gramGoldItem.selling, 2)} ₺` : 'Yükleniyor...'}
                </span>
                {gramGoldItem && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                      gramGoldItem.changePercent >= 0 ? 'nd-badge-green' : 'nd-badge-red'
                    }`}
                  >
                    {gramGoldItem.changePercent >= 0 ? '+' : ''}
                    {gramGoldItem.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* USD/TRY & EUR/TRY */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: 'var(--green)' }}
            >
              <DollarSign size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--text-muted)' }}>
                Harem Döviz (USD / EUR)
              </span>
              <span className="text-sm font-black tabular-nums">
                {usdTryItem ? `${formatNum(usdTryItem.selling, 4)} ₺` : '-'} /{' '}
                {eurTryItem ? `${formatNum(eurTryItem.selling, 4)} ₺` : '-'}
              </span>
            </div>
          </div>

          {/* Brent Oil */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Fuel size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--text-muted)' }}>
                Brent Petrol (Varil)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black tabular-nums">
                  {brentItem ? `$${formatNum(brentItem.price, 2)}` : '-'}
                </span>
                {brentItem && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                      brentItem.changePercent >= 0 ? 'nd-badge-green' : 'nd-badge-red'
                    }`}
                  >
                    {brentItem.changePercent >= 0 ? '+' : ''}
                    {brentItem.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* London Gas Oil */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: 'var(--purple)' }}
            >
              <TrendingUp size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--text-muted)' }}>
                Londra Gaz Yağı (ICE Ton)
              </span>
              <span className="text-sm font-black tabular-nums">
                {gasOilTonItem ? `$${formatNum(gasOilTonItem.price, 2)}` : '-'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden md:block">
            <span className="text-[10px] font-bold flex items-center justify-end gap-1" style={{ color: 'var(--green)' }}>
              <Signal size={11} />
              <span>Canlı Veri Akışı Aktif</span>
            </span>
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              Son Okuma: {bundle?.fetchedAt || '-'}
            </span>
          </div>
          <button
            onClick={() => {
              loadMarkets();
              setRefreshKey(Date.now());
            }}
            className="nd-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Anlık Yenile</span>
          </button>
        </div>
      </div>

      {/* 2. HAREM ALTIN CANLI SERBEST PİYASA TABLOSU & DÖVİZ KURLARI */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Harem Altın Canlı Tablo (8 Cols) */}
        <div className="lg:col-span-8 nd-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold">
                  Harem Altın (`haremaltin.com`) — Canlı Kapalıçarşı & Serbest Piyasa
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full nd-badge-amber">
                  WebSocket Canlı Akış
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Veriler doğrudan `hrmsocketonly.haremaltin.com` canlı soketinden anlık olarak çekilmektedir
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'Tümü' },
                  { id: 'gold', label: 'Altın Sarrafiye' },
                  { id: 'silver', label: 'Gümüş' }
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setGoldFilter(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    goldFilter === t.id ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={() => api.openExternal('https://canlipiyasalar.haremaltin.com')}
                className="nd-btn-secondary px-2.5 py-1 text-xs flex items-center gap-1"
                title="Harem Altın Web Sayfasını Aç"
              >
                <span>Harem</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <th className="py-2 px-2">Birim / Altın Cinsi</th>
                  <th className="py-2 px-2 text-right">Alış Fiyatı</th>
                  <th className="py-2 px-2 text-right">Satış Fiyatı</th>
                  <th className="py-2 px-2 text-right">Gün İçi Düşük / Yüksek</th>
                  <th className="py-2 px-2 text-right">Değişim</th>
                  <th className="py-2 px-2 text-right">Saat</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {filteredGoldList.map((item) => {
                  const isUp = item.changePercent >= 0;
                  const isUsd = item.code === 'ONS' || item.code === 'USDKG' || item.code === 'XAGUSD';
                  const sym = isUsd ? '$' : item.code === 'EURKG' ? '€' : '₺';
                  return (
                    <tr key={item.code} className="hover:opacity-95">
                      <td className="py-2.5 px-2">
                        <div className="font-bold flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: isUp ? 'var(--green)' : 'var(--red)' }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-60">{item.code}</span>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold tabular-nums">
                        {formatNum(item.buying, 2)} {sym}
                      </td>
                      <td
                        className="py-2.5 px-2 text-right font-extrabold tabular-nums text-sm"
                        style={{ color: 'var(--amber)' }}
                      >
                        {formatNum(item.selling, 2)} {sym}
                      </td>
                      <td className="py-2.5 px-2 text-right text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {formatNum(item.low, 2)} / {formatNum(item.high, 2)}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span
                          className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                            isUp ? 'nd-badge-green' : 'nd-badge-red'
                          }`}
                        >
                          {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                          {isUp ? '+' : ''}
                          {item.changePercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {item.updatedAt.split(' ').pop()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Harem Canlı Döviz Kurları & Pariteler (4 Cols) */}
        <div className="lg:col-span-4 nd-card p-5 flex flex-col justify-between">
          <div>
            <div className="pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-sm font-extrabold">Canlı Döviz Kurları & Pariteler</h3>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Serbest piyasa döviz alış / satış ve günlük marjlar
              </p>
            </div>

            <div className="space-y-2.5">
              {(bundle?.haremCurrencies || []).map((cur) => {
                const isUp = cur.changePercent >= 0;
                const decimals = cur.code === 'EURUSD' ? 4 : 4;
                return (
                  <div key={cur.code} className="nd-layer p-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold">{cur.name}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                            isUp ? 'nd-badge-green' : 'nd-badge-red'
                          }`}
                        >
                          {isUp ? '+' : ''}
                          {cur.changePercent.toFixed(2)}%
                        </span>
                      </div>
                      <p className="text-[10px] tabular-nums mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Gün İçi: {formatNum(cur.low, 3)} - {formatNum(cur.high, 3)}
                      </p>
                    </div>

                    <div className="text-right tabular-nums">
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Alış: <b>{formatNum(cur.buying, decimals)}</b>
                      </div>
                      <div className="text-sm font-black" style={{ color: 'var(--green)' }}>
                        Satış: {formatNum(cur.selling, decimals)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t text-[11px] flex items-center justify-between" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <span>Otomatik Yenileme: 15 sn</span>
            <span>Kaynak: Harem Altın Soket</span>
          </div>
        </div>
      </div>

      {/* 3. KÜRESEL ENERJİ & AKARYAKIT EMTİA KARTLARI (BRENT, LONDRA GAZ YAĞI, WTI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {(bundle?.commodities || []).map((com) => {
          const isUp = com.changePercent >= 0;
          return (
            <div key={com.symbol} className="nd-card p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    {com.unit}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                      isUp ? 'nd-badge-green' : 'nd-badge-red'
                    }`}
                  >
                    {isUp ? '+' : ''}
                    {com.changePercent.toFixed(2)}%
                  </span>
                </div>
                <h4 className="text-xs font-extrabold mt-1 truncate" title={com.name}>
                  {com.name}
                </h4>
              </div>

              <div className="my-3 flex items-end justify-between gap-2">
                <div>
                  <p className="text-lg font-black tabular-nums">${formatNum(com.price, 2)}</p>
                  <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    Önceki: ${formatNum(com.prevClose, 2)}
                  </p>
                </div>
                {renderSparkline(com)}
              </div>

              <div className="pt-2 border-t flex justify-between text-[10px] tabular-nums" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <span>Düşük: ${formatNum(com.low, 2)}</span>
                <span>Yüksek: ${formatNum(com.high, 2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. INVESTING.COM CANLI TEKNİK GRAFİKLER (BRENT & LONDRA GAZ YAĞI) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="nd-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold">Investing.com — Brent Petrol Canlı Teknik Grafik</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Akaryakıt rafineri fiyatlaması için küresel Brent Petrol göstergesi
              </p>
            </div>
            <button
              onClick={() => api.openExternal('https://tr.investing.com/commodities/brent-oil')}
              className="text-xs font-bold flex items-center gap-1 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <span>Investing</span>
              <ExternalLink size={12} />
            </button>
          </div>
          <div className="nd-layer overflow-hidden h-[300px]">
            <iframe title="Brent Petrol" src={investingBrentUrl} className="w-full h-full border-0" />
          </div>
        </div>

        <div className="nd-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold">Investing.com — Londra Gaz Yağı (London Gas Oil)</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Motorin (EuroDiesel) uluslararası ton bazlı referans grafiği
              </p>
            </div>
            <button
              onClick={() => api.openExternal('https://tr.investing.com/commodities/london-gas-oil')}
              className="text-xs font-bold flex items-center gap-1 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <span>Investing</span>
              <ExternalLink size={12} />
            </button>
          </div>
          <div className="nd-layer overflow-hidden h-[300px]">
            <iframe title="Londra Gaz Yağı" src={investingGasOilUrl} className="w-full h-full border-0" />
          </div>
        </div>
      </div>
    </div>
  );
};
