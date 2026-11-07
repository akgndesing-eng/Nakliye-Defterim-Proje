import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Edit3,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  CalendarClock,
  Fuel,
  UserCheck,
  Search,
  X
} from 'lucide-react';
import { Vehicle, Driver, NavTabId } from '../../shared/types';
import { api, getCached } from '../api';
import { formatDate, getDaysRemaining } from '../utils/format';
import { confirmDialog, alertDialog } from '../utils/dialog';

interface VehicleInfoModuleProps {
  highlightVehicleId?: string | null;
  onNavigate?: (tab: NavTabId, entityId?: string) => void;
}

export const VehicleInfoModule: React.FC<VehicleInfoModuleProps> = ({ highlightVehicleId }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getCached<Vehicle[]>('vehicles') || []);
  const [drivers, setDrivers] = useState<Driver[]>(() => getCached<Driver[]>('drivers') || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'tanker' | 'cekici'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Vehicle>>({});

  const loadData = async () => {
    const [vList, dList] = await Promise.all([api.getVehicles(), api.getDrivers()]);
    setVehicles(vList || []);
    setDrivers(dList || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewModal = () => {
    setEditing({
      plate: '',
      driver_name: drivers[0]?.name || '',
      vehicle_type: 'tanker',
      fuel_capacity: 32000,
      inspection_date: '',
      insurance_date: '',
      notes: 'ADR Belgeli Akaryakıt Tankeri'
    });
    setShowModal(true);
  };

  const openEditModal = (v: Vehicle) => {
    setEditing({ ...v });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing.plate?.trim()) {
      await alertDialog('Lütfen araç plakasını girin.', 'Eksik Bilgi');
      return;
    }
    await api.saveVehicle(editing);
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog('Bu araç künyesini silmek istediğinize emin misiniz?', 'Araç Künyesi Silme Onayı'))) return;
    await api.deleteVehicle(id);
    loadData();
  };

  const filteredVehicles = vehicles.filter((v) => {
    const matchesType = typeFilter === 'all' || v.vehicle_type === typeFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      v.plate.toLowerCase().includes(q) ||
      (v.driver_name || '').toLowerCase().includes(q) ||
      (v.notes || '').toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const totalCapacity = vehicles.reduce((acc, v) => acc + Number(v.fuel_capacity || 0), 0);
  const approachingInspCount = vehicles.filter((v) => {
    const d = getDaysRemaining(v.inspection_date);
    return d !== null && d <= 30;
  }).length;
  const approachingInsCount = vehicles.filter((v) => {
    const d = getDaysRemaining(v.insurance_date);
    return d !== null && d <= 30;
  }).length;

  const renderCountdownBadge = (dateStr: string | undefined, label: string) => {
    const days = getDaysRemaining(dateStr);
    if (days === null) {
      return <span className="text-[11px] opacity-60">Belirtilmedi</span>;
    }
    const badgeClass =
      days < 0 || days <= 10
        ? 'nd-badge-red'
        : days <= 30
        ? 'nd-badge-amber'
        : 'nd-badge-green';
    const text =
      days < 0
        ? `${Math.abs(days)} gün geçti!`
        : days === 0
        ? 'Bugün Son Gün!'
        : `${days} gün kaldı`;
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${badgeClass}`}>
        {label}: {text}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* 1. ÜST ÖZET KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="nd-card p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Kayıtlı Araç Künyesi
            </p>
            <p className="text-2xl font-black mt-2 tabular-nums">{vehicles.length} Araç</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Tanker ve çekici teknik sicil kartları
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <FileText size={20} />
          </div>
        </div>

        <div className="nd-card p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Toplam Depo / Tonaj Kapasitesi
            </p>
            <p className="text-2xl font-black mt-2 tabular-nums" style={{ color: 'var(--green)' }}>
              {totalCapacity.toLocaleString('tr-TR')} Lt
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Filo toplam akaryakıt taşıma hacmi
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--green)' }}
          >
            <Fuel size={20} />
          </div>
        </div>

        <div className="nd-card p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Yaklaşan Muayene / Vize
            </p>
            <p
              className="text-2xl font-black mt-2 tabular-nums"
              style={{ color: approachingInspCount > 0 ? 'var(--amber)' : 'var(--green)' }}
            >
              {approachingInspCount} Araç
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              30 gün içinde vizesi dolacak araçlar
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--amber)' }}
          >
            <CalendarClock size={20} />
          </div>
        </div>

        <div className="nd-card p-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Yaklaşan Sigorta / Kasko
            </p>
            <p
              className="text-2xl font-black mt-2 tabular-nums"
              style={{ color: approachingInsCount > 0 ? 'var(--red)' : 'var(--green)' }}
            >
              {approachingInsCount} Araç
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              30 gün içinde poliçesi yenilenecekler
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--red)' }}
          >
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* 2. FİLTRE, ARAMA VE YENİ ARAÇ BİLGİSİ EKLEME BARI */}
      <div className="nd-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Plaka, şoför adı veya ADR/teknik not ara..."
              className="nd-input w-full pl-9"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'all', label: 'Tüm Araçlar' },
                { id: 'tanker', label: 'Akaryakıt Tankerleri' },
                { id: 'cekici', label: 'Çekici & Dorse' }
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  typeFilter === f.id ? 'nd-btn-primary' : 'nd-layer'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={openNewModal}
          className="nd-btn-primary px-4 py-2.5 text-xs flex items-center gap-2"
        >
          <Plus size={16} />
          <span>+ Yeni Araç Künyesi Ekle</span>
        </button>
      </div>

      {/* 3. ARAÇ TEKNİK KÜNYE VE BELGE TAKİP TABLOSU */}
      <div className="nd-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-extrabold">Araç Teknik Bilgileri, Kapasite ve Resmi Evrak Tarihleri</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Plaka, araç cinsi, zimmetli şoför, litre kapasitesi, TÜVTÜRK muayene/vize, sigorta/kasko ve ADR teknik notları
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <th className="py-2.5 px-3">Plaka & Cinsi</th>
                <th className="py-2.5 px-3">Zimmetli Şoför</th>
                <th className="py-2.5 px-3 text-right">Depo / Tonaj Kapasitesi</th>
                <th className="py-2.5 px-3">Muayene / Vize Tarihi</th>
                <th className="py-2.5 px-3">Sigorta / Kasko Tarihi</th>
                <th className="py-2.5 px-3">Teknik & ADR Notları</th>
                <th className="py-2.5 px-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filteredVehicles.map((v) => {
                const isHighlighted = highlightVehicleId === v.id;
                return (
                  <tr
                    key={v.id}
                    style={
                      isHighlighted
                        ? { backgroundColor: 'rgba(45, 110, 85, 0.12)' }
                        : undefined
                    }
                  >
                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-sm tabular-nums">{v.plate}</div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded nd-badge-champagne inline-block mt-0.5">
                        {v.vehicle_type === 'tanker' ? 'ADR Tanker' : 'Çekici / Tır'}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <UserCheck size={14} style={{ color: 'var(--accent)' }} />
                        <span>{v.driver_name || 'Atanmadı'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-extrabold tabular-nums">
                      {Number(v.fuel_capacity || 0).toLocaleString('tr-TR')} Lt
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold tabular-nums mb-1">{formatDate(v.inspection_date)}</div>
                      {renderCountdownBadge(v.inspection_date, 'Vize')}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold tabular-nums mb-1">{formatDate(v.insurance_date)}</div>
                      {renderCountdownBadge(v.insurance_date, 'Poliçe')}
                    </td>
                    <td className="py-3.5 px-3 max-w-xs">
                      <p className="text-xs truncate" title={v.notes}>
                        {v.notes || '-'}
                      </p>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditModal(v)}
                          className="p-1.5 rounded-lg nd-layer nd-hover-accent"
                          title="Araç Bilgilerini Düzenle"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-1.5 rounded-lg nd-badge-red"
                          title="Aracı Sil"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ARAÇ KÜNYE EKLE / DÜZENLE MODALI */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 20, 18, 0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div className="nd-modal w-full max-w-lg p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-base font-extrabold">
                {editing.id ? 'Araç Teknik Bilgilerini Düzenle' : 'Yeni Araç Künyesi Oluştur'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg nd-layer">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Araç Plakası *</label>
                  <input
                    type="text"
                    required
                    value={editing.plate || ''}
                    onChange={(e) => setEditing({ ...editing, plate: e.target.value.toUpperCase() })}
                    placeholder="Örn: 22 AB 450"
                    className="nd-input w-full font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Araç Tipi / Cinsi</label>
                  <select
                    value={editing.vehicle_type || 'tanker'}
                    onChange={(e) => setEditing({ ...editing, vehicle_type: e.target.value })}
                    className="nd-input w-full"
                  >
                    <option value="tanker">Akaryakıt Tankeri (ADR)</option>
                    <option value="cekici">Çekici + Tanker Dorse</option>
                    <option value="kamyon">Dağıtım Kamyonu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Varsayılan Şoför</label>
                  <input
                    type="text"
                    value={editing.driver_name || ''}
                    onChange={(e) => setEditing({ ...editing, driver_name: e.target.value })}
                    placeholder="Şoför Adı Soyadı"
                    className="nd-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Depo / Tank Kapasitesi (Litre)</label>
                  <input
                    type="number"
                    value={editing.fuel_capacity ?? 32000}
                    onChange={(e) => setEditing({ ...editing, fuel_capacity: Number(e.target.value) })}
                    className="nd-input w-full tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Muayene / Vize Tarihi</label>
                  <input
                    type="date"
                    value={editing.inspection_date || ''}
                    onChange={(e) => setEditing({ ...editing, inspection_date: e.target.value })}
                    className="nd-input w-full tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Sigorta / Kasko Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={editing.insurance_date || ''}
                    onChange={(e) => setEditing({ ...editing, insurance_date: e.target.value })}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Teknik Notlar, Göz Sayısı & ADR Belge Bilgisi</label>
                <textarea
                  rows={3}
                  value={editing.notes || ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Örn: 5 gözlü tanker, T9 belgesi ve sayaç kalibrasyonu tam..."
                  className="nd-input w-full"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="nd-btn-secondary px-4 py-2 text-xs"
                >
                  İptal
                </button>
                <button type="submit" className="nd-btn-primary px-5 py-2 text-xs">
                  Bilgileri Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
