import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  X,
  Home,
  Truck,
  Calculator,
  Container,
  TrendingUp,
  Menu
} from 'lucide-react';
import {
  GateStatus,
  NavTabId,
  AppNotification,
  GlobalSearchResult,
  AppPreferences
} from '../shared/types';
import { GateScreen } from './components/GateScreen';
import { BrandLogo } from './components/BrandLogo';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CommandDialog } from './components/CommandDialog';
import { NotificationDrawer } from './components/NotificationDrawer';
import { RoadRadioPlayer } from './components/RoadRadioPlayer';
import { HomeModule } from './modules/HomeModule';
import { DashboardModule } from './modules/DashboardModule';
import { TripsModule } from './modules/TripsModule';
import { TripCostCalculatorModule } from './modules/TripCostCalculatorModule';
import { PaymentsModule } from './modules/PaymentsModule';
import { CustomersModule } from './modules/CustomersModule';
import { VehicleInfoModule } from './modules/VehicleInfoModule';
import { VehiclesModule } from './modules/VehiclesModule';
import { VillageTankersModule } from './modules/VillageTankersModule';
import { DriversModule } from './modules/DriversModule';
import { WhatsAppModule } from './modules/WhatsAppModule';
import { MarketsModule } from './modules/MarketsModule';
import { ReportsModule } from './modules/ReportsModule';
import { PastMonthsModule } from './modules/PastMonthsModule';
import { CalendarModule } from './modules/CalendarModule';
import { NotesModule } from './modules/NotesModule';
import { TasksModule } from './modules/TasksModule';
import { PlanningModule } from './modules/PlanningModule';
import { SettingsModule } from './modules/SettingsModule';
import { getCurrentMonth } from './utils/format';
import { api, preloadAllErpData } from './api';

const DEFAULT_PREFERENCES: AppPreferences = {
  managerName: 'Umut Bey',
  companyTitle: 'Gökmen Petrol / AKON Transport',
  baseCity: 'Edirne Merkez',
  defaultOrigin: 'TÜPRAŞ İzmit Rafinerisi',
  autoLockMinutes: 15,
  autoBackupMinutes: 10,
  fontScale: 'comfortable'
};

export const App: React.FC = () => {
  const [gateStatus, setGateStatus] = useState<GateStatus>({
    isInitialized: true,
    isUnlocked: false,
    vaultPath: ''
  });
  const [checkingGate, setCheckingGate] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('nd_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });
  const [activeTab, setActiveTab] = useState<NavTabId>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('nd_sidebar_collapsed') === 'true';
  });
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [preferences, setPreferences] = useState<AppPreferences>(() => {
    try {
      const raw = localStorage.getItem('nd_preferences_v45');
      if (raw) return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_PREFERENCES;
  });

  // Quick Overlays & Cross-Module Navigation States
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [openPaymentCount, setOpenPaymentCount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [newTripSignal, setNewTripSignal] = useState<number>(0);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  // Sync theme attribute on document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('nd_dark_mode', String(darkMode));
  }, [darkMode]);

  // Sync sidebar collapsed preference
  useEffect(() => {
    localStorage.setItem('nd_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Sync font size scaling preference (proportional to phone screen width on mobile, full size on desktop)
  useEffect(() => {
    const applyResponsiveFontScale = () => {
      const w = window.innerWidth;
      if (w < 360) {
        document.documentElement.style.fontSize = '13px';
      } else if (w < 415) {
        document.documentElement.style.fontSize = '13.75px';
      } else if (w < 768) {
        document.documentElement.style.fontSize = '14.25px';
      } else {
        const px =
          preferences.fontScale === 'normal'
            ? '16px'
            : preferences.fontScale === 'large'
            ? '17.5px'
            : '16.75px';
        document.documentElement.style.fontSize = px;
      }
    };
    applyResponsiveFontScale();
    window.addEventListener('resize', applyResponsiveFontScale);
    return () => window.removeEventListener('resize', applyResponsiveFontScale);
  }, [preferences.fontScale]);

  const handleSavePreferences = (nextPrefs: AppPreferences) => {
    setPreferences(nextPrefs);
    localStorage.setItem('nd_preferences_v45', JSON.stringify(nextPrefs));
  };

  // Check initial Gate status
  useEffect(() => {
    api
      .getGateStatus()
      .then((st) => {
        setGateStatus(st);
        if (st.isUnlocked) {
          preloadAllErpData(selectedMonth);
        }
      })
      .finally(() => setCheckingGate(false));
  }, []);

  // Load notifications & badge counts when unlocked
  const refreshGlobalBadges = useCallback(async () => {
    if (!gateStatus.isUnlocked) return;
    try {
      const [notifs, openStops] = await Promise.all([
        api.getNotifications(),
        api.getStops(true)
      ]);
      setNotifications(notifs || []);
      setOpenPaymentCount((openStops || []).length);
    } catch {
      // If backend auto-locked due to idle timeout
    }
  }, [gateStatus.isUnlocked]);

  useEffect(() => {
    if (gateStatus.isUnlocked) {
      preloadAllErpData(selectedMonth).then(() => {
        refreshGlobalBadges();
      });
    }
  }, [gateStatus.isUnlocked, selectedMonth, refreshGlobalBadges]);

  // Global keyboard shortcuts: Ctrl+K for CommandDialog, Ctrl+L for Quick Lock, Ctrl+B for Sidebar Collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (gateStatus.isUnlocked) {
          setCommandOpen((prev) => !prev);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (gateStatus.isUnlocked) {
          handleLockVault();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (gateStatus.isUnlocked) {
          setSidebarCollapsed((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gateStatus.isUnlocked]);

  // Idle auto-lock timer in renderer (configurable via preferences.autoLockMinutes)
  useEffect(() => {
    if (!gateStatus.isUnlocked || preferences.autoLockMinutes <= 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleLockVault();
      }, preferences.autoLockMinutes * 60 * 1000);
    };
    resetTimer();
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [gateStatus.isUnlocked, preferences.autoLockMinutes]);

  // Automatic periodic backup scheduler sync & heartbeat
  useEffect(() => {
    if (!gateStatus.isUnlocked) return;
    const intervalMins = preferences.autoBackupMinutes ?? 10;
    api
      .setAutoBackupInterval(intervalMins)
      .then((st) => {
        if (st.lastBackupAt) {
          localStorage.setItem('nd_last_backup_time', new Date(st.lastBackupAt).toLocaleString('tr-TR'));
        }
      })
      .catch(() => {});

    if (intervalMins <= 0) return;
    const timer = setInterval(() => {
      api
        .runAutoBackupNow('Otomatik Zamanlayıcı Yedeği')
        .then((res) => {
          if (res.success) {
            localStorage.setItem('nd_last_backup_time', new Date().toLocaleString('tr-TR'));
          }
        })
        .catch(() => {});
    }, intervalMins * 60 * 1000);

    return () => clearInterval(timer);
  }, [gateStatus.isUnlocked, preferences.autoBackupMinutes]);

  const handleLockVault = async () => {
    const st = await api.lockVault();
    setGateStatus(st);
    setCommandOpen(false);
    setNotifDrawerOpen(false);
  };

  const handleExportBackup = async () => {
    try {
      const res = await api.exportEncryptedBackup();
      if (res.success) {
        const nowStr = new Date().toLocaleString('tr-TR');
        localStorage.setItem('nd_last_backup_time', nowStr);
        showToast('success', res.message);
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Yedek alma sırasında hata oluştu.');
    }
  };

  const handleNavigate = (tab: NavTabId, entityId?: string) => {
    if (tab === 'customers' && entityId) setSelectedCustomerId(entityId);
    if (tab === 'vehicles' && entityId) setSelectedVehicleId(entityId);
    if (tab === 'trips' && entityId) setSelectedTripId(entityId);
    setActiveTab(tab);
  };

  const handleCommandResult = (
    tab: NavTabId,
    entityId: string,
    category: GlobalSearchResult['category']
  ) => {
    if (category === 'customer') setSelectedCustomerId(entityId);
    if (category === 'vehicle') setSelectedVehicleId(entityId);
    if (category === 'trip') setSelectedTripId(entityId);
    setActiveTab(tab);
  };

  if (checkingGate) {
    return (
      <div className="nd-page h-screen w-screen flex flex-col items-center justify-center gap-3 select-none">
        <BrandLogo size={56} />
        <div className="text-center">
          <h1 className="text-base font-extrabold tracking-tight">Nakliye Defterim</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Şifreli veritabanı bağlantısı kontrol ediliyor...
          </p>
        </div>
      </div>
    );
  }

  // Show Gate Screen when database is not unlocked
  if (!gateStatus.isUnlocked) {
    return (
      <GateScreen
        gateStatus={gateStatus}
        onUnlocked={(nextSt) => {
          setGateStatus(nextSt);
          preloadAllErpData(selectedMonth);
        }}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
      />
    );
  }

  return (
    <div className="nd-page flex h-screen w-screen overflow-hidden">
      {/* Collapsible Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        openPaymentCount={openPaymentCount}
        notificationCount={notifications.length}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Topbar */}
        <Header
          activeTab={activeTab}
          selectedMonth={selectedMonth}
          onSelectMonth={setSelectedMonth}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode(!darkMode)}
          notificationCount={notifications.length}
          onToggleNotificationDrawer={() => setNotifDrawerOpen(!notifDrawerOpen)}
          onOpenCommandSearch={() => setCommandOpen(true)}
          onOpenSettings={() => setActiveTab('settings')}
          onLockVault={handleLockVault}
          managerName={preferences.managerName}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />

        {/* Floating Toast Notification */}
        {toast && (
          <div className="fixed top-20 right-6 z-50 max-w-md nd-toast-enter">
            <div
              className={`p-3.5 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold ${
                toast.type === 'success' ? 'nd-badge-green' : 'nd-badge-red'
              }`}
              style={{ backdropFilter: 'blur(12px)' }}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 size={17} className="shrink-0" />
              ) : (
                <AlertCircle size={17} className="shrink-0" />
              )}
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="p-1 rounded-lg opacity-80 hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Module Viewport with GPU-Accelerated Smooth Page Transition */}
        <main className="flex-1 overflow-y-auto pb-28 md:pb-16">
          <div key={activeTab} className="nd-page-transition">
            {activeTab === 'home' && (
              <HomeModule
                selectedMonth={selectedMonth}
                managerName={preferences.managerName}
                companyTitle={preferences.companyTitle}
                onNavigate={handleNavigate}
                onQuickNewTrip={() => {
                  setActiveTab('trips');
                  setNewTripSignal(Date.now());
                }}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardModule
                selectedMonth={selectedMonth}
                managerName={preferences.managerName}
                companyTitle={`${preferences.companyTitle} • ${preferences.baseCity}`}
                onNavigate={handleNavigate}
                onQuickNewTrip={() => {
                  setActiveTab('trips');
                  setNewTripSignal(Date.now());
                }}
              />
            )}

            {activeTab === 'trips' && (
              <TripsModule
                selectedMonth={selectedMonth}
                openModalSignal={newTripSignal}
                highlightTripId={selectedTripId}
              />
            )}

            {activeTab === 'trip_cost_calc' && <TripCostCalculatorModule />}

            {activeTab === 'payments' && (
              <PaymentsModule
                onOpenCustomerProfile={(custId) => {
                  setSelectedCustomerId(custId);
                  setActiveTab('customers');
                }}
              />
            )}

            {activeTab === 'customers' && (
              <CustomersModule
                initialCustomerId={selectedCustomerId}
                onNavigateWhatsApp={(custId) => {
                  setSelectedCustomerId(custId);
                  setActiveTab('whatsapp');
                }}
              />
            )}

            {activeTab === 'whatsapp' && (
              <WhatsAppModule initialCustomerId={selectedCustomerId} />
            )}

            {activeTab === 'vehicle_info' && (
              <VehicleInfoModule
                highlightVehicleId={selectedVehicleId}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'vehicles' && (
              <VehiclesModule
                selectedMonth={selectedMonth}
                highlightVehicleId={selectedVehicleId}
              />
            )}

            {activeTab === 'village_tankers' && <VillageTankersModule />}

            {activeTab === 'drivers' && <DriversModule />}

            {activeTab === 'planning' && (
              <PlanningModule selectedMonth={selectedMonth} />
            )}

            {activeTab === 'calendar' && (
              <CalendarModule selectedMonth={selectedMonth} />
            )}

            {activeTab === 'notes' && <NotesModule />}

            {activeTab === 'tasks' && <TasksModule />}

            {activeTab === 'reports' && (
              <ReportsModule
                onExportBackup={handleExportBackup}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'past_months' && <PastMonthsModule />}

            {activeTab === 'markets' && <MarketsModule />}

            {activeTab === 'settings' && (
              <SettingsModule
                vaultPath={gateStatus.vaultPath}
                darkMode={darkMode}
                onToggleTheme={() => setDarkMode(!darkMode)}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
                preferences={preferences}
                onSavePreferences={handleSavePreferences}
                onLockVault={handleLockVault}
                selectedMonth={selectedMonth}
                onDataRestored={refreshGlobalBadges}
              />
            )}
          </div>
        </main>

        {/* Mobile Quick Bottom Navigation Bar (Visible on all phone screens < 768px) */}
        <nav
          className="md:hidden min-h-[56px] nd-safe-bottom border-t grid grid-cols-6 items-center px-1 shrink-0 z-30 select-none"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)'
          }}
        >
          {(
            [
              { id: 'home', label: 'Ana Sayfa', icon: <Home size={16} /> },
              { id: 'trips', label: 'Seferler', icon: <Truck size={16} /> },
              { id: 'trip_cost_calc', label: 'Maliyet', icon: <Calculator size={16} /> },
              { id: 'village_tankers', label: 'Tanker', icon: <Container size={16} /> },
              { id: 'markets', label: 'Piyasalar', icon: <TrendingUp size={16} /> }
            ] as const
          ).map((item) => {
            const isActive = activeTab === item.id && !mobileMenuOpen;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className="flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all"
                style={{
                  color: isActive ? 'var(--champagne)' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'var(--layer)' : 'transparent',
                  fontWeight: isActive ? 800 : 600
                }}
              >
                {item.icon}
                <span className="text-[9px] tracking-tight truncate max-w-full px-0.5">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex flex-col items-center justify-center gap-0.5 py-1 rounded-xl transition-all"
            style={{
              color: mobileMenuOpen ? 'var(--champagne)' : 'var(--text-muted)',
              backgroundColor: mobileMenuOpen ? 'var(--layer)' : 'transparent',
              fontWeight: mobileMenuOpen ? 800 : 600
            }}
          >
            <Menu size={16} />
            <span className="text-[9px] tracking-tight truncate">Tüm Menü</span>
          </button>
        </nav>
      </div>

      {/* Global Search Command Dialog (⌘K / Ctrl+K) */}
      <CommandDialog
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        onSelectResult={handleCommandResult}
      />

      {/* Right Notification Drawer */}
      <NotificationDrawer
        isOpen={notifDrawerOpen}
        onClose={() => setNotifDrawerOpen(false)}
        notifications={notifications}
        onNavigate={handleNavigate}
      />

      {/* Persistent Minimizable Road Radio Player */}
      <RoadRadioPlayer />
    </div>
  );
};
