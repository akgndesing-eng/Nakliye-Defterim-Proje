import React from 'react';
import {
  Home,
  Truck,
  Calculator,
  Users,
  FileBadge2,
  Fuel,
  Container,
  UserCheck,
  Wallet,
  MessageSquare,
  TrendingUp,
  FileSpreadsheet,
  History,
  CalendarRange,
  StickyNote,
  CheckSquare,
  Settings,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
  X
} from 'lucide-react';
import { NavTabId } from '../../shared/types';
import { BrandLogo } from './BrandLogo';

interface SidebarProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  openPaymentCount: number;
  notificationCount: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  openPaymentCount,
  collapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile
}) => {
  const navItems: {
    id: NavTabId;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: string;
  }[] = [
    { id: 'home', label: 'Ana Sayfa', icon: <Home size={17} /> },
    { id: 'trips', label: 'Seferler', icon: <Truck size={17} /> },
    { id: 'trip_cost_calc', label: 'Tır Sefer Maliyet Hesaplama', icon: <Calculator size={17} /> },
    { id: 'customers', label: 'Müşteriler', icon: <Users size={17} /> },
    { id: 'vehicle_info', label: 'Araç Bilgileri', icon: <FileBadge2 size={17} /> },
    { id: 'vehicles', label: 'Araçlar', icon: <Fuel size={17} /> },
    { id: 'village_tankers', label: 'Tanker Takip', icon: <Container size={17} /> },
    { id: 'drivers', label: 'Tanker Şoförleri', icon: <UserCheck size={17} /> },
    {
      id: 'payments',
      label: 'Tahsilatlar',
      icon: <Wallet size={17} />,
      badge: openPaymentCount > 0 ? openPaymentCount : undefined,
      badgeColor: 'var(--amber)'
    },
    { id: 'whatsapp', label: 'WhatsApp', icon: <MessageSquare size={17} /> },
    { id: 'markets', label: 'Piyasalar', icon: <TrendingUp size={17} /> },
    { id: 'reports', label: 'Raporlar', icon: <FileSpreadsheet size={17} /> },
    { id: 'past_months', label: 'Geçmiş Aylar', icon: <History size={17} /> },
    { id: 'calendar', label: 'Takvim', icon: <CalendarRange size={17} /> },
    { id: 'notes', label: 'Notlar ve Hatırlatıcılar', icon: <StickyNote size={17} /> },
    { id: 'tasks', label: 'Görevler', icon: <CheckSquare size={17} /> },
    { id: 'settings', label: 'Ayarlar', icon: <Settings size={17} /> }
  ];

  const isCollapsed = collapsed && !mobileOpen;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto nd-safe-top nd-safe-bottom ${
          isCollapsed ? 'md:w-[76px]' : 'md:w-[266px]'
        } w-[276px] max-w-[85vw] shrink-0 h-[100dvh] flex flex-col justify-between select-none border-r transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)'
        }}
      >
        {/* Top Brand Header + Collapse Toggle */}
        <div className="flex flex-col min-h-0 flex-1">
          <div
            className={`px-3.5 py-3 border-b flex items-center shrink-0 ${
              isCollapsed ? 'justify-center' : 'justify-between'
            }`}
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              onClick={() => {
                onSelectTab('home');
                if (onCloseMobile) onCloseMobile();
              }}
              className="flex items-center gap-3 cursor-pointer min-w-0 group"
            >
              <div className="transition-transform duration-200 group-hover:scale-105">
                <BrandLogo size={38} />
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <h1 className="font-bold text-sm tracking-tight leading-tight truncate">
                    Nakliye Defterim
                  </h1>
                  <span
                    className="text-[10px] font-semibold tracking-wider uppercase block truncate"
                    style={{ color: 'var(--champagne)' }}
                  >
                    Kurumsal Lojistik
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {!isCollapsed && (
                <button
                  onClick={onToggleCollapse}
                  title="Sol Menüyü Daralt (Ctrl+B)"
                  className="hidden md:flex p-2 rounded-xl nd-layer shrink-0"
                >
                  <PanelLeftClose size={16} />
                </button>
              )}
              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="md:hidden p-2 rounded-xl nd-layer text-slate-400 hover:text-white"
                  title="Menüyü Kapat"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {isCollapsed && (
            <div className="hidden md:flex px-3 pt-2 justify-center shrink-0">
              <button
                onClick={onToggleCollapse}
                title="Sol Menüyü Aç (Ctrl+B)"
                className="w-full py-1.5 rounded-xl nd-layer flex items-center justify-center"
              >
                <PanelLeftOpen size={15} style={{ color: 'var(--accent)' }} />
              </button>
            </div>
          )}

          {/* Sequential Navigation Items */}
          <nav className="p-2 space-y-0.5 overflow-y-auto flex-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  title={isCollapsed ? item.label : undefined}
                  className={`nd-nav-item w-full flex items-center ${
                    isCollapsed ? 'justify-center px-0 py-2' : 'justify-between px-3 py-2.5 md:py-2'
                  } rounded-xl text-xs font-semibold ${isActive ? 'nd-nav-item-active' : ''}`}
                  style={{
                    color: isActive ? '#ffffff' : 'var(--text)'
                  }}
                >
                  {isActive && !isCollapsed && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"
                      style={{ backgroundColor: 'var(--champagne)' }}
                    />
                  )}

                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'} min-w-0`}>
                    <span
                      className={`shrink-0 transition-transform duration-200 ${
                        isActive ? 'scale-105' : 'opacity-80'
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums shrink-0"
                      style={{
                        backgroundColor: isActive
                          ? 'rgba(255,255,255,0.26)'
                          : item.badgeColor || 'var(--amber)',
                        color: '#ffffff'
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Clean Vault Status & Settings Shortcut Pill */}
        <div className="p-2 border-t shrink-0 space-y-1.5" style={{ borderColor: 'var(--border)' }}>
          {!isCollapsed ? (
            <>
              <button
                onClick={() => {
                  onSelectTab('settings');
                  if (onCloseMobile) onCloseMobile();
                }}
                className="w-full nd-layer nd-hover-accent p-2 flex items-center justify-between gap-2 text-left"
                title="Ayarlar, Yedek Al, Yedek Aç ve Defteri Kilitle ekranına git"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    <ShieldCheck size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: 'var(--champagne)' }}
                      />
                      <span className="text-[11px] font-bold truncate">Şifreli Kasa Aktif</span>
                    </div>
                    <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>
                      Yedekleme & Kilit → Ayarlar
                    </span>
                  </div>
                </div>
                <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
              </button>

              <div className="px-1.5 pt-0.5 text-center">
                <p
                  className="text-[10px] font-semibold tracking-tight leading-snug"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Nakliye Defterim bir <span style={{ color: 'var(--champagne)' }}>Umut Ergil</span> uygulamasıdır{' '}
                  <span className="font-bold" style={{ color: 'var(--text)' }}>
                    -Akon Group
                  </span>
                </p>
              </div>
            </>
          ) : (
            <button
              onClick={() => {
                onSelectTab('settings');
                if (onCloseMobile) onCloseMobile();
              }}
              title="Ayarlar, Yedekleme & Defter Kilidi"
              className="w-full py-2 rounded-xl nd-layer nd-hover-accent flex items-center justify-center"
            >
              <Settings size={16} style={{ color: 'var(--accent)' }} />
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
