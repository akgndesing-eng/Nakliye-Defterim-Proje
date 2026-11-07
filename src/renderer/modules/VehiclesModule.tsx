import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Fuel,
  Plus,
  Edit3,
  Trash2,
  Wrench,
  ShieldCheck,
  X
} from 'lucide-react';
import { Vehicle, VehicleExpense } from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency, formatDate, getDaysRemaining, getCurrentDate } from '../utils/format';
import { confirmDialog, alertDialog } from '../utils/dialog';

interface VehiclesModuleProps {
  selectedMonth: string;
  highlightVehicleId?: string | null;
}

export const VehiclesModule: React.FC<VehiclesModuleProps> = ({
  selectedMonth,
  highlightVehicleId
}) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getCached<Vehicle[]>('vehicles') || []);
  const [expenses, setExpenses] = useState<VehicleExpense[]>(
    () => getCached<VehicleExpense[]>(`vehicleExpenses:${selectedMonth}:`) || []
  );

  // Vehicle Add/Edit Modal
  const [showVehModal, setShowVehModal] = useState(false);
  const [editingVeh, setEditingVeh] = useState<Partial<Vehicle>>({});

  // Expense Form State
  const [expVehicleId, setExpVehicleId] = useState('');
  const [expDate, setExpDate] = useState(getCurrentDate());
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState<string>('');
  const expFormRef = useRef<HTMLDivElement>(null);
  const expTitleInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    const [vList, eList] = await Promise.all([
      api.getVehicles(),
      api.getVehicleExpenses({ month: selectedMonth })
    ]);
    setVehicles(vList || []);
    setExpenses(eList || []);
    if (!expVehicleId && vList && vList.length > 0) {
      setExpVehicleId(vList[0].id);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  useEffect(() => {
    if (highlightVehicleId) {
      setExpVehicleId(highlightVehicleId);
    }
  }, [highlightVehicleId]);

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.saveVehicle(editingVeh);
    setShowVehModal(false);
    loadData();
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!(await confirmDialog('Bu aracı ve bağlı gider kayıtlarını silmek istediğinize emin misiniz?', 'Araç Silme Onayı'))) return;
    await api.deleteVehicle(id);
    loadData();
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetVehId = expVehicleId || vehicles[0]?.id || '';
    const numericAmt = parseFloat(String(expAmount).replace(',', '.')) || 0;
    if (!targetVehId) {
      await alertDialog('Lütfen önce bir araç ekleyin veya araç seçin.', 'Eksik Bilgi');
      return;
    }
    if (!expTitle.trim() || numericAmt <= 0) {
      await alertDialog('Lütfen gider açıklamasını ve 0 TL üzeri gider tutarını girin.', 'Eksik Bilgi');
      return;
    }
    await api.saveVehicleExpense({
      vehicle_id: targetVehId,
      expense_date: expDate,
      expense_month: selectedMonth,
      title: expTitle.trim(),
      amount: numericAmt
    });
    setExpTitle('');
    setExpAmount('');
    loadData();
  };

  const handleDeleteExpense = async (id: string) => {
    if (!(await confirmDialog('Bu araç gider kaydını silmek istediğinize emin misiniz?', 'Gider Silme Onayı'))) return;
    await api.deleteVehicleExpense(id);
    loadData();
  };

  const renderCountdownBadge = (dateStr?: string | null, label = 'Vize') => {
    const days = getDaysRemaining(dateStr);
    if (days === null) {
      return <span className="text-[11px] opacity-60">Belirtilmedi</span>;
    }
    const badgeClass =
      days < 0 ? 'nd-badge-red' : days <= 15 ? 'nd-badge-red' : days <= 30 ? 'nd-badge-amber' : 'nd-badge-green';
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${badgeClass}`}>
        {label}: {days < 0 ? `${Math.abs(days)}g geçti` : `${days}g kaldı`}
      </span>
    );
  };

  const grandTotalAllVehicles = expenses.reduce((acc, x) => acc + Number(x.amount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Üst Bilgi & İzolasyon Garantisi + Yeni Araç Butonu */}
      <div
        className="nd-card p-4 flex flex-wrap items-center justify-between gap-4 border-l-4"
        style={{ borderLeftColor: 'var(--accent)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">
                Araçlar & Araç Başına Bağımsız Gider Takibi ({vehicles.length} Araç)
              </h3>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full nd-badge-green">
                Nakliye Hesaplarından Bağımsız
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Burada eklediğiniz araç giderleri hiçbir nakliye hesabını, müşteri ödemesini veya sefer bilançosunu karıştırmaz. Her aracın kendi giderleri kendi kutusunda listelenir ve en altında toplanır.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingVeh({
              vehicle_type: 'tanker',
              fuel_capacity: 32000,
              inspection_date: getCurrentDate(),
              insurance_date: getCurrentDate()
            });
            setShowVehModal(true);
          }}
          className="nd-btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
        >
          <Plus size={15} />
          <span>+ Yeni Araç / Tanker Ekle</span>
        </button>
      </div>

      {/* Hızlı Araç Gideri Ekleme Kutusu */}
      <div ref={expFormRef} className="nd-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wrench size={16} style={{ color: 'var(--accent)' }} />
          <div>
            <h4 className="text-sm font-bold">Araca Gider Yaz ({selectedMonth})</h4>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Seçtiğiniz araca bakım, lastik, yağ, parça veya sigorta gideri ekleyin (Sadece o aracın kendi listesine yazılır)
            </p>
          </div>
        </div>

        <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs">
          <div className="md:col-span-3">
            <label className="block font-semibold mb-1">Araç Plakası</label>
            <select
              required
              value={expVehicleId}
              onChange={(e) => setExpVehicleId(e.target.value)}
              className="nd-input w-full"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} ({v.driver_name || 'Şoförsüz'})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">Gider Tarihi</label>
            <input
              type="date"
              required
              value={expDate}
              onChange={(e) => setExpDate(e.target.value)}
              className="nd-input w-full tabular-nums"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block font-semibold mb-1">Gider / Masraf Açıklaması</label>
            <input
              ref={expTitleInputRef}
              type="text"
              required
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              placeholder="Örn: Ön 2 Lastik Değişimi, Motor Yağı Bakımı..."
              className="nd-input w-full"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block font-semibold mb-1">Tutar (₺)</label>
            <input
              type="number"
              step="0.01"
              required
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="0,00"
              className="nd-input w-full font-bold tabular-nums"
            />
          </div>

          <div className="md:col-span-1">
            <button
              type="submit"
              className="nd-btn-primary w-full py-2.5 text-xs flex items-center justify-center gap-1"
            >
              <Plus size={15} />
              <span>Ekle</span>
            </button>
          </div>
        </form>
      </div>

      {/* HER ARACIN KENDİ GİDER LİSTESİ VE KENDİ ALT TOPLAMI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {vehicles.map((v) => {
          const vehExpenses = expenses.filter((e) => e.vehicle_id === v.id);
          const vehTotal = vehExpenses.reduce((acc, e) => acc + Number(e.amount || 0), 0);
          const isHighlighted = expVehicleId === v.id;

          return (
            <div
              key={v.id}
              className="nd-card p-5 flex flex-col justify-between space-y-4"
              style={{
                borderColor: isHighlighted ? 'var(--accent)' : 'var(--border)'
              }}
            >
              <div className="space-y-4">
                {/* Araç Başlığı */}
                <div
                  className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <Fuel size={19} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold tabular-nums">{v.plate}</h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-full nd-layer tabular-nums">
                          {Number(v.fuel_capacity || 0).toLocaleString('tr-TR')} Lt
                        </span>
                      </div>
                      <span className="text-xs block mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Şoför: <b>{v.driver_name || '-'}</b>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {renderCountdownBadge(v.inspection_date, 'Vize')}
                    {renderCountdownBadge(v.insurance_date, 'Kasko')}
                    <button
                      onClick={() => {
                        setEditingVeh(v);
                        setShowVehModal(true);
                      }}
                      className="nd-btn-secondary p-1.5"
                      title="Araç Bilgilerini Düzenle"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteVehicle(v.id)}
                      className="p-1.5 rounded-lg nd-badge-red"
                      title="Aracı Sil"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Bu Aracın Kendi Giderleri Tablosu */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold">
                      {v.plate} — Araç Giderleri ({vehExpenses.length} kayıt)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setExpVehicleId(v.id);
                        expFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(() => expTitleInputRef.current?.focus(), 180);
                      }}
                      className="text-[11px] font-semibold hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      + Bu Araca Gider Seç
                    </button>
                  </div>

                  {vehExpenses.length === 0 ? (
                    <div
                      className="nd-layer p-5 text-center text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {v.plate} plakalı araç için bu dönemde gider kaydı bulunmuyor.
                    </div>
                  ) : (
                    <div className="nd-layer overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr
                            className="border-b text-[10px] uppercase"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                          >
                            <th className="py-2 px-3">Tarih</th>
                            <th className="py-2 px-3">Gider / Masraf Kalemi</th>
                            <th className="py-2 px-3 text-right">Tutar</th>
                            <th className="py-2 px-2 text-right">Sil</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                          {vehExpenses.map((exp) => (
                            <tr key={exp.id}>
                              <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                                {formatDate(exp.expense_date)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold">{exp.title}</td>
                              <td
                                className="py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap"
                                style={{ color: 'var(--red)' }}
                              >
                                {formatCurrency(exp.amount)}
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  className="p-1 rounded-lg nd-badge-red"
                                  title="Gideri Sil"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Aracın Kendi Alt Toplam Satırı */}
              <div
                className="pt-3 border-t flex items-center justify-between"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                  {v.plate} Toplam Araç Gideri:
                </span>
                <span
                  className="text-base font-bold tabular-nums"
                  style={{ color: vehTotal > 0 ? 'var(--red)' : 'var(--text)' }}
                >
                  {formatCurrency(vehTotal)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* EN ALTTA TÜM ARAÇLARIN GENEL GİDER TOPLAMI KUTUSU */}
      <div className="nd-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold">
            Araç Giderleri Alt Toplamı ({selectedMonth} Dönemi)
          </h4>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {vehicles.map((v) => {
              const sum = expenses
                .filter((e) => e.vehicle_id === v.id)
                .reduce((a, b) => a + Number(b.amount || 0), 0);
              return (
                <span key={v.id} className="px-2.5 py-1 rounded-lg nd-layer tabular-nums">
                  <b>{v.plate}:</b> {formatCurrency(sum)}
                </span>
              );
            })}
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-semibold block" style={{ color: 'var(--text-muted)' }}>
            Tüm Araçların Toplam Gideri (Nakliye Ödemelerinden Bağımsız)
          </span>
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--red)' }}>
            {formatCurrency(grandTotalAllVehicles)}
          </span>
        </div>
      </div>

      {/* ADD / EDIT VEHICLE MODAL */}
      {showVehModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(10, 16, 14, 0.72)', backdropFilter: 'blur(4px)' }}
          >
            <div className="nd-modal w-full max-w-lg p-6">
              <div
                className="flex items-center justify-between pb-3 mb-4 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <h3 className="text-base font-bold">
                  {editingVeh.id ? 'Araç / Tanker Kartını Düzenle' : 'Yeni Araç / Tanker Ekle'}
                </h3>
                <button onClick={() => setShowVehModal(false)} className="p-1.5 rounded-lg nd-layer">
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveVehicle} className="space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Plaka (Örn: 22 AB 123)</label>
                    <input
                      type="text"
                      required
                      value={editingVeh.plate || ''}
                      onChange={(e) => setEditingVeh({ ...editingVeh, plate: e.target.value })}
                      className="nd-input w-full font-bold uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Varsayılan Şoför</label>
                    <input
                      type="text"
                      value={editingVeh.driver_name || ''}
                      onChange={(e) => setEditingVeh({ ...editingVeh, driver_name: e.target.value })}
                      className="nd-input w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Araç Tipi</label>
                    <select
                      value={editingVeh.vehicle_type || 'tanker'}
                      onChange={(e) => setEditingVeh({ ...editingVeh, vehicle_type: e.target.value })}
                      className="nd-input w-full"
                    >
                      <option value="tanker">Akaryakıt Tankeri</option>
                      <option value="cekici">Çekici + Dorse</option>
                      <option value="kucuk_tanker">Küçük Dağıtım Tankeri</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Depo / Tonaj Kapasitesi (Lt)</label>
                    <input
                      type="number"
                      value={editingVeh.fuel_capacity || 0}
                      onChange={(e) =>
                        setEditingVeh({ ...editingVeh, fuel_capacity: Number(e.target.value) })
                      }
                      className="nd-input w-full tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Muayene / Vize Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={editingVeh.inspection_date || ''}
                      onChange={(e) => setEditingVeh({ ...editingVeh, inspection_date: e.target.value })}
                      className="nd-input w-full tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Sigorta / Kasko Bitiş Tarihi</label>
                    <input
                      type="date"
                      value={editingVeh.insurance_date || ''}
                      onChange={(e) => setEditingVeh({ ...editingVeh, insurance_date: e.target.value })}
                      className="nd-input w-full tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Araç Notları</label>
                  <input
                    type="text"
                    value={editingVeh.notes || ''}
                    onChange={(e) => setEditingVeh({ ...editingVeh, notes: e.target.value })}
                    className="nd-input w-full"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowVehModal(false)}
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
          </div>,
          document.body
        )}
    </div>
  );
};
