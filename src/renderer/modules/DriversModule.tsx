import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Phone, CreditCard, Fuel, Edit3, Trash2, X } from 'lucide-react';
import { Driver, Vehicle } from '../../shared/types';
import { api, getCached } from '../api';

export const DriversModule: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>(() => getCached<Driver[]>('drivers') || []);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getCached<Vehicle[]>('vehicles') || []);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Driver>>({});

  const loadData = async () => {
    const [dList, vList] = await Promise.all([api.getDrivers(), api.getVehicles()]);
    setDrivers(dList || []);
    setVehicles(vList || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.saveDriver(editing);
    setShowModal(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Şoför kaydını silmek istediğinize emin misiniz?')) return;
    await api.deleteDriver(id);
    loadData();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="nd-card p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">Şoför Kadrosu ({drivers.length} Kayıtlı Şoför)</h3>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            TC Kimlik, telefon, SRC5 / ADR belge sınıfları ve zimmetli araç bilgileri
          </p>
        </div>
        <button
          onClick={() => {
            setEditing({ license_type: 'CE + SRC5 (ADR)', active_vehicle_id: vehicles[0]?.id || null });
            setShowModal(true);
          }}
          className="nd-btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
        >
          <Plus size={15} />
          <span>+ Yeni Şoför Ekle</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {drivers.map((d) => (
          <div key={d.id} className="nd-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <UserCheck size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold">{d.name}</h4>
                  <span className="text-[11px] px-2 py-0.5 rounded-full nd-badge-blue font-semibold">
                    {d.license_type || 'CE + SRC5'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditing(d);
                    setShowModal(true);
                  }}
                  className="nd-btn-secondary p-1.5"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="p-1.5 rounded-lg nd-badge-red"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div className="nd-layer p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Telefon:</span>
                <b className="tabular-nums">{d.phone || '-'}</b>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>TC Kimlik No:</span>
                <b className="tabular-nums">{d.tc_no || '-'}</b>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Aktif Araç Plakası:</span>
                <b className="tabular-nums" style={{ color: 'var(--accent)' }}>
                  {d.active_vehicle_plate || 'Atanmadı'}
                </b>
              </div>
            </div>

            {d.notes && (
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Not: {d.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 18, 28, 0.65)', backdropFilter: 'blur(3px)' }}
        >
          <div className="nd-modal w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-base font-bold">
                {editing.id ? 'Şoför Bilgilerini Düzenle' : 'Yeni Şoför Ekle'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg nd-layer">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">Adı Soyadı</label>
                <input
                  type="text"
                  required
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="nd-input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Telefon</label>
                  <input
                    type="text"
                    value={editing.phone || ''}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">TC Kimlik No</label>
                  <input
                    type="text"
                    value={editing.tc_no || ''}
                    onChange={(e) => setEditing({ ...editing, tc_no: e.target.value })}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Ehliyet / SRC Sınıfı</label>
                  <input
                    type="text"
                    value={editing.license_type || ''}
                    onChange={(e) => setEditing({ ...editing, license_type: e.target.value })}
                    className="nd-input w-full"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Aktif Araç</label>
                  <select
                    value={editing.active_vehicle_id || ''}
                    onChange={(e) => setEditing({ ...editing, active_vehicle_id: e.target.value || null })}
                    className="nd-input w-full"
                  >
                    <option value="">Araç Seçilmedi</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Notlar</label>
                <input
                  type="text"
                  value={editing.notes || ''}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="nd-input w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="nd-btn-secondary px-4 py-2"
                >
                  İptal
                </button>
                <button type="submit" className="nd-btn-primary px-5 py-2">
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
