import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu,
  Search,
  CloudSun,
  Bell,
  Lock,
  Sun,
  Moon,
  Calendar,
  ExternalLink,
  RefreshCw,
  X,
  Wind,
  Droplets,
  Thermometer,
  Gauge,
  Eye,
  Settings,
  User
} from 'lucide-react';
import { NavTabId, LiveMgmWeather } from '../../shared/types';
import { BrandLogo } from './BrandLogo';
import { api, getCached } from '../api';

interface HeaderProps {
  activeTab: NavTabId;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
  notificationCount: number;
  onToggleNotificationDrawer: () => void;
  onOpenCommandSearch: () => void;
  onOpenSettings: () => void;
  onLockVault: () => void;
  managerName?: string;
  onToggleMobileMenu?: () => void;
}

const TAB_TITLES: Record<NavTabId, { title: string; subtitle: string }> = {
  home: {
    title: 'Ana Sayfa — Genel Filo & Operasyon Özeti',
    subtitle: 'Tanker filosu, güncel seferler, tahsilatlar, yaklaşan vize/sigortalar ve canlı piyasalar tek ekranda'
  },
  dashboard: {
    title: 'Ana Sayfa & Operasyon Özeti',
    subtitle: 'Günlük tanker sevkiyatları, açık tahsilatlar ve 6 aylık finansal performans'
  },
  trips: {
    title: 'Seferler & Çoklu Durak Takip Modülü',
    subtitle: 'Dolum tesisinden çoklu müşteri istasyonlarına bırakım, navlun ve gider hesaplayıcı'
  },
  trip_cost_calc: {
    title: 'Tır Sefer Maliyet Hesaplama',
    subtitle: 'Müşteri ziyaretlerinde hızlı fiyat teklifi için yakıt, KM başı tüketim, harcırah ve toplam sefer maliyet hesaplayıcı'
  },
  customers: {
    title: 'Müşteriler & İstasyon Carileri',
    subtitle: 'İstasyon profilleri, telefon bilgileri, sefer geçmişi, cari hesap ekstresi ve özel notlar'
  },
  vehicle_info: {
    title: 'Araç Bilgileri & Evrak Takip Sicili',
    subtitle: 'Plaka, kapasite, TÜVTÜRK muayene/vize, kasko/sigorta geri sayımları ve ADR teknik sicil kartları'
  },
  vehicles: {
    title: 'Araçlar & Aylık Ek Giderler',
    subtitle: 'Filo araç yönetimi ve araç başı aylık bakım, lastik, vergi ve tamir masrafları'
  },
  village_tankers: {
    title: 'Tanker Takip (Köydeki Küçük Tankerlerin Bağımsız Takibi)',
    subtitle: 'Köy tankerlerinin dolum, dağıtım ve köylü/traktör kayıtları (Ana nakliye sistemiyle kesinlikle karışmaz)'
  },
  drivers: {
    title: 'Tanker Şoförleri & Zimmetli Araçlar',
    subtitle: 'Tanker ve çekici şoförleri, SRC5/ADR ehliyet bilgileri ve aktif araç eşleşmeleri'
  },
  payments: {
    title: 'Tahsilatlar & Durak Vadeleri',
    subtitle: 'Açık durak bakiyeleri, kısmi tahsilat girişi ve vade takibi'
  },
  whatsapp: {
    title: 'WhatsApp — Borçlu Müşteriler & Mesaj Hazırlama',
    subtitle: 'Borcu olan müşterileri seçin, mesajınızı yazın ve profil numarasına göre WhatsApp uygulamasında hazır açın'
  },
  markets: {
    title: 'Piyasalar (Altın, Döviz, Brent Petrol, Gaz Yağı & Emtia)',
    subtitle: 'Harem Altın canlı serbest piyasa verileri, ICE Brent Petrol, Londra Gaz Yağı ve Döviz kurları'
  },
  reports: {
    title: 'Raporlar & Aylık Finansal Bilanço',
    subtitle: 'Ay bazında tur/durak sayısı, ciro, sefer ve araç giderleri, net kâr dökümü'
  },
  past_months: {
    title: 'Geçmiş Aylar Arşivi & Düzenleme Merkezi',
    subtitle: 'Tamamlanan eski ayların tüm sefer, durak ve gider verilerini görüntüleyin ve dilediğiniz gibi düzenleyin'
  },
  calendar: {
    title: 'Takvim — Aylık Operasyon & Vade Takvimi',
    subtitle: 'Sefer günleri, tahsilat vadeleri, görevler ve hatırlatıcıların aylık takvim görünümü'
  },
  notes: {
    title: 'Notlar ve Hatırlatıcılar',
    subtitle: 'Müşteri görüşmeleri, ödeme sözleri ve tarihli hatırlatıcı notların yönetimi'
  },
  tasks: {
    title: 'Görevler & Operasyon İş Listesi',
    subtitle: 'Araç bakımı, evrak yenileme ve günlük operasyon görevlerinin öncelik ve durum takibi'
  },
  planning: {
    title: 'Takvim & Planlama',
    subtitle: 'Renk kodlu seferler, ödeme vadeleri, görevler ve bağımsız hatırlatıcı notlar'
  },
  settings: {
    title: 'Ayarlar, Şifreli Yedekleme & Kasa Güvenlik Merkezi',
    subtitle: 'Yedek Al (Export), Yedek Aç (Import), Defteri Kilitle, görünüm ölçeği ve firma profil ayarları'
  }
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  selectedMonth,
  onSelectMonth,
  darkMode,
  onToggleTheme,
  notificationCount,
  onToggleNotificationDrawer,
  onOpenCommandSearch,
  onOpenSettings,
  onLockVault,
  managerName = 'Umut Bey',
  onToggleMobileMenu
}) => {
  const [showMgmPopover, setShowMgmPopover] = useState(false);
  const [weather, setWeather] = useState<LiveMgmWeather | null>(() => getCached<LiveMgmWeather>('live:weather'));
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [mgmKey, setMgmKey] = useState(Date.now());
  const info = TAB_TITLES[activeTab] || TAB_TITLES.dashboard;
  const todayShort = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const refreshWeather = useCallback(async () => {
    setLoadingWeather(true);
    setMgmKey(Date.now());
    try {
      const res = await api.getMgmWeather();
      setWeather(res);
    } finally {
      setLoadingWeather(false);
    }
  }, []);

  useEffect(() => {
    refreshWeather();
    const interval = setInterval(refreshWeather, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshWeather]);

  // Official MGM Son Gözlem Meteogram URL for Edirne Merkez (Station 17050 / EDIRNE)
  const mgmGraphUrl = `https://www.mgm.gov.tr/sunum/sondurum-show-2.aspx?m=EDIRNE&rC=111&rZ=fff&t=${mgmKey}`;
  const mgmForecastUrl = `https://www.mgm.gov.tr/sunum/tahmin-show-2.aspx?m=EDIRNE&basla=1&bitir=5&rC=111&rZ=fff&t=${mgmKey}`;

  return (
    <header
      className="min-h-[56px] md:min-h-[64px] nd-safe-top px-2.5 sm:px-4 md:px-6 border-b flex items-center justify-between gap-2 shrink-0 relative z-30"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)'
      }}
    >
      {/* Left: Mobile Hamburger & Brand Emblem & Screen Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 pr-1 sm:pr-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 rounded-xl nd-layer shrink-0 text-amber-400 hover:text-white"
            title="Sol Menüyü Aç"
          >
            <Menu size={19} />
          </button>
        )}
        <div className="hidden sm:flex items-center shrink-0">
          <BrandLogo size={30} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs sm:text-sm md:text-base font-bold tracking-tight truncate">
              {info.title.split('—')[0].trim()}
              <span className="hidden md:inline">
                {info.title.includes('—') ? ` — ${info.title.split('—')[1].trim()}` : ''}
              </span>
            </h2>
            <span
              className="hidden lg:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full nd-badge-champagne shrink-0"
            >
              {todayShort}
            </span>
          </div>
          <p className="hidden sm:block text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
            {info.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Quick Tools */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* 1. Global Search Button (⌘K / Ctrl+K) */}
        <button
          onClick={onOpenCommandSearch}
          className="nd-layer nd-hover-accent p-2 sm:px-3 sm:py-1.5 flex items-center gap-2 text-xs transition-colors"
          title="Global Arama (Ctrl+K / ⌘K)"
        >
          <Search size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ color: 'var(--text-muted)' }} className="hidden xl:inline">
            Müşteri, Plaka, Sefer ara...
          </span>
          <kbd
            className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-bold rounded border tabular-nums"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)'
            }}
          >
            Ctrl+K
          </kbd>
        </button>

        {/* 2. Edirne Merkez MGM Live Weather Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowMgmPopover(!showMgmPopover)}
            className={`px-2 sm:px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 sm:gap-2 rounded-xl border transition-all ${
              showMgmPopover ? 'nd-btn-primary' : 'nd-layer'
            }`}
            title="Edirne Merkez MGM Canlı Hava Durumu"
          >
            <CloudSun size={15} style={{ color: showMgmPopover ? '#fff' : 'var(--accent)' }} />
            <span className="hidden lg:inline">Edirne MGM</span>
            <span className="font-extrabold tabular-nums">
              {weather ? `${weather.temperature.toFixed(1)}°C` : '...'}
            </span>
            {weather?.isLive && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: showMgmPopover ? '#fff' : 'var(--green)' }}
                title="Canlı MGM İstasyon Bağlantısı Aktif"
              />
            )}
          </button>

          {showMgmPopover && (
            <div className="nd-modal fixed sm:absolute left-2.5 right-2.5 sm:left-auto sm:right-0 top-15 sm:top-auto sm:mt-2 w-auto sm:w-[480px] max-h-[82vh] overflow-y-auto p-3.5 sm:p-4 z-50">
              <div
                className="flex items-center justify-between pb-3 mb-3 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-xs font-extrabold flex items-center gap-1.5">
                      <CloudSun size={15} style={{ color: 'var(--accent)' }} />
                      <span>{weather?.city || 'Edirne Merkez'} — MGM Canlı Rasat</span>
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full nd-badge-green">
                      İstasyon #{weather?.stationId || 17050}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    T.C. Meteoroloji Genel Müdürlüğü • Son Güncelleme: {weather?.updatedAt}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={refreshWeather}
                    className="p-1.5 rounded-lg nd-layer hover:opacity-80"
                    title="MGM Verisini Yenile"
                  >
                    <RefreshCw size={13} className={loadingWeather ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => setShowMgmPopover(false)}
                    className="p-1.5 rounded-lg nd-layer hover:opacity-80"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Live MGM Instant Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
                <div className="nd-layer p-2.5">
                  <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <Thermometer size={12} style={{ color: 'var(--accent)' }} />
                    <span>Sıcaklık</span>
                  </div>
                  <p className="text-sm font-black tabular-nums mt-0.5">
                    {weather ? `${weather.temperature.toFixed(1)} °C` : '-'}
                  </p>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                    Hissedilen: {weather?.feelsLike.toFixed(1)}°
                  </span>
                </div>

                <div className="nd-layer p-2.5">
                  <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <Droplets size={12} style={{ color: 'var(--accent)' }} />
                    <span>Nem / Hadise</span>
                  </div>
                  <p className="text-sm font-black tabular-nums mt-0.5">%{weather?.humidity ?? 55}</p>
                  <span className="text-[9px] truncate block" style={{ color: 'var(--text-muted)' }}>
                    {weather?.conditionText || 'Parçalı Bulutlu'}
                  </span>
                </div>

                <div className="nd-layer p-2.5">
                  <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <Wind size={12} style={{ color: 'var(--accent)' }} />
                    <span>Rüzgâr</span>
                  </div>
                  <p className="text-sm font-black tabular-nums mt-0.5">
                    {weather?.windSpeed ?? 6} km/s
                  </p>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                    Yön: {weather?.windDirection ?? 0}°
                  </span>
                </div>

                <div className="nd-layer p-2.5">
                  <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    <Gauge size={12} style={{ color: 'var(--accent)' }} />
                    <span>Basınç & Görüş</span>
                  </div>
                  <p className="text-sm font-black tabular-nums mt-0.5">
                    {weather?.pressure ?? 1020} hPa
                  </p>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                    Görüş: {Math.round((weather?.visibilityMeters || 20000) / 1000)} km
                  </span>
                </div>
              </div>

              {/* 5-Day Live Forecast Table from MGM API */}
              {weather?.forecast5Days && weather.forecast5Days.length > 0 && (
                <div className="nd-layer p-2.5 sm:p-3 mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    MGM Edirne 5 Günlük Resmi Hava Tahmini
                  </p>
                  <div className="grid grid-cols-5 gap-1 sm:gap-1.5 text-center">
                    {weather.forecast5Days.map((day) => (
                      <div key={day.date} className="nd-card p-1.5 sm:p-2">
                        <span className="text-[10px] font-bold block">{day.dayLabel.slice(0, 3)}</span>
                        <span className="text-[9px] block mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                          {day.conditionText.split(' ')[0]}
                        </span>
                        <div className="mt-1 text-[11px] sm:text-xs font-extrabold tabular-nums">
                          <span style={{ color: 'var(--accent)' }}>{day.minTemp}°</span> /{' '}
                          <span style={{ color: 'var(--amber)' }}>{day.maxTemp}°</span>
                        </div>
                        <span className="text-[9px] tabular-nums block" style={{ color: 'var(--text-muted)' }}>
                          Nem %{day.maxHumidity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Official MGM Classic Graphics */}
              <div className="nd-layer p-2.5 space-y-2 text-center overflow-hidden">
                <p className="text-[10px] font-semibold text-left" style={{ color: 'var(--text-muted)' }}>
                  MGM Resmi Son Gözlem & Tahmin Meteogramı:
                </p>
                <div className="bg-white rounded-lg p-2 flex flex-col items-center gap-2 overflow-x-auto">
                  <img
                    src={mgmGraphUrl}
                    alt="MGM Edirne Merkez Son Gözlem"
                    className="max-w-full h-auto rounded"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <img
                    src={mgmForecastUrl}
                    alt="MGM Edirne 5 Günlük Tahmin"
                    className="max-w-full h-auto rounded"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[10px] flex items-center gap-1 truncate" style={{ color: 'var(--text-muted)' }}>
                  <Eye size={12} className="shrink-0" />
                  <span className="truncate">Güzergâh: {weather?.conditionText}</span>
                </span>
                <button
                  onClick={() => api.openExternal('https://www.mgm.gov.tr/tahmin/il-ve-ilceler.aspx?il=Edirne')}
                  className="text-[11px] font-semibold flex items-center gap-1 hover:underline shrink-0"
                  style={{ color: 'var(--accent)' }}
                >
                  <span>MGM Resmi Sayfa</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Month Selector */}
        <div className="hidden sm:flex nd-layer px-2.5 py-1 items-center gap-1.5">
          <Calendar size={13} style={{ color: 'var(--accent)' }} />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="bg-transparent text-xs font-bold outline-none tabular-nums"
            style={{ color: 'var(--text)' }}
          />
        </div>

        {/* 4. Notification Drawer Trigger */}
        <button
          onClick={onToggleNotificationDrawer}
          className="nd-layer p-2 relative hover:opacity-90 transition-opacity"
          title="Bildirim Merkezi (Geciken Ödemeler, Muayene/Sigorta, Görevler)"
        >
          <Bell size={15} />
          {notificationCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center tabular-nums"
              style={{ backgroundColor: 'var(--red)' }}
            >
              {notificationCount}
            </span>
          )}
        </button>

        {/* 5. Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="nd-layer p-2"
          title={darkMode ? 'Açık Moda Geç' : 'Koyu Moda Geç'}
        >
          {darkMode ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} style={{ color: 'var(--accent)' }} />}
        </button>

        {/* 6. Profile & Settings Menu Button */}
        <button
          onClick={onOpenSettings}
          className={`p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
            activeTab === 'settings' ? 'nd-btn-primary' : 'nd-layer nd-hover-accent'
          }`}
          title="Kullanıcı Profili, Ayarlar, Yedek Al, Yedek Aç ve Defteri Kilitle"
        >
          <User size={14} className="hidden sm:inline" style={{ color: activeTab === 'settings' ? '#fff' : 'var(--champagne)' }} />
          <span className="hidden lg:inline">{managerName}</span>
          <Settings size={15} style={{ color: activeTab === 'settings' ? '#fff' : 'var(--accent)' }} />
        </button>

        {/* 7. Quick Lock Button */}
        <button
          onClick={onLockVault}
          className="nd-badge-red p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
          title="Defteri Hızlı Kilitle (Ctrl+L)"
        >
          <Lock size={14} />
          <span className="hidden xl:inline">Kilitle</span>
        </button>
      </div>
    </header>
  );
};
