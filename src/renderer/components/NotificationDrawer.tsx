import React from 'react';
import { X, AlertTriangle, ShieldAlert, CheckSquare, ArrowRight, Bell } from 'lucide-react';
import { AppNotification, NavTabId } from '../../shared/types';
import { formatCurrency } from '../utils/format';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onNavigate: (tab: NavTabId, entityId?: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onNavigate
}) => {
  if (!isOpen) return null;

  const overdueList = notifications.filter((n) => n.category === 'overdue_payment');
  const vehicleList = notifications.filter(
    (n) => n.category === 'vehicle_inspection' || n.category === 'vehicle_insurance'
  );
  const taskList = notifications.filter((n) => n.category === 'today_task');

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ backgroundColor: 'rgba(10, 18, 28, 0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full flex flex-col justify-between border-l p-5 overflow-y-auto"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--modal-shadow)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Drawer Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Bell size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold">Bildirim Merkezi</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Geciken ödemeler, araç muayene/sigorta ve günün görevleri
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg nd-layer hover:opacity-80">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-5">
            {/* Section 1: Overdue Payments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--red)' }}>
                  <AlertTriangle size={14} />
                  <span>Vadesi Geçen / Gelen Tahsilatlar ({overdueList.length})</span>
                </span>
              </div>
              {overdueList.length === 0 ? (
                <div className="nd-layer p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Geciken durak tahsilatı bulunmuyor.
                </div>
              ) : (
                <div className="space-y-2">
                  {overdueList.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        onNavigate(n.targetTab, n.entityId);
                        onClose();
                      }}
                      className="w-full text-left p-3 rounded-xl nd-layer nd-hover-red transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{n.title}</p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {n.subtitle} • Vade: {n.dateStr}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {n.amount !== undefined && (
                          <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-lg nd-badge-red block">
                            {formatCurrency(n.amount)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2: Approaching Vehicle Inspection / Insurance */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--amber)' }}>
                  <ShieldAlert size={14} />
                  <span>Araç Vize / Muayene & Sigorta ({vehicleList.length})</span>
                </span>
              </div>
              {vehicleList.length === 0 ? (
                <div className="nd-layer p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  30 gün içinde yaklaşan araç muayene veya sigorta kaydı yok.
                </div>
              ) : (
                <div className="space-y-2">
                  {vehicleList.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        onNavigate(n.targetTab, n.entityId);
                        onClose();
                      }}
                      className="w-full text-left p-3 rounded-xl nd-layer nd-hover-amber transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{n.title}</p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {n.subtitle}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-lg nd-badge-amber shrink-0">
                        {n.dateStr}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Today's Tasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                  <CheckSquare size={14} />
                  <span>Günün Bekleyen Görevleri ({taskList.length})</span>
                </span>
              </div>
              {taskList.length === 0 ? (
                <div className="nd-layer p-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Bugün için bekleyen görev bulunmuyor.
                </div>
              ) : (
                <div className="space-y-2">
                  {taskList.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        onNavigate(n.targetTab, n.entityId);
                        onClose();
                      }}
                      className="w-full text-left p-3 rounded-xl nd-layer nd-hover-accent transition-all flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{n.title}</p>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {n.subtitle}
                        </p>
                      </div>
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} className="shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t text-center" style={{ borderColor: 'var(--border)' }}>
          <button onClick={onClose} className="nd-btn-secondary w-full py-2 text-xs">
            Paneli Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
