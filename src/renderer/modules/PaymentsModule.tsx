import React, { useState, useEffect } from 'react';
import { Wallet, CheckCircle2, AlertTriangle, Clock, Plus, X, ArrowUpRight } from 'lucide-react';
import { TripStop, NavTabId } from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency, formatDate, getCurrentDate } from '../utils/format';
import { alertDialog } from '../utils/dialog';

interface PaymentsModuleProps {
  onOpenCustomerProfile: (customerId: string) => void;
}

export const PaymentsModule: React.FC<PaymentsModuleProps> = ({ onOpenCustomerProfile }) => {
  const [stops, setStops] = useState<TripStop[]>(() => getCached<TripStop[]>('stops:all') || []);
  const [filterMode, setFilterMode] = useState<'open' | 'overdue' | 'paid' | 'all'>('open');
  const [selectedStop, setSelectedStop] = useState<TripStop | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(getCurrentDate());
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  const loadStops = async () => {
    const list = await api.getStops(false);
    setStops(list || []);
  };

  useEffect(() => {
    loadStops();
  }, []);

  const today = getCurrentDate();

  const filteredStops = stops.filter((s) => {
    const rem = Number(s.stop_amount) - Number(s.paid_amount || 0);
    if (filterMode === 'open') return rem > 0;
    if (filterMode === 'overdue') return rem > 0 && s.due_date && s.due_date < today;
    if (filterMode === 'paid') return s.payment_status === 'paid' || rem <= 0;
    return true;
  });

  const totalOpenAmount = stops.reduce(
    (acc, s) => acc + Math.max(0, Number(s.stop_amount) - Number(s.paid_amount || 0)),
    0
  );
  const totalOverdueAmount = stops
    .filter((s) => s.payment_status !== 'paid' && s.due_date && s.due_date < today)
    .reduce((acc, s) => acc + Math.max(0, Number(s.stop_amount) - Number(s.paid_amount || 0)), 0);
  const totalCollectedAmount = stops.reduce((acc, s) => acc + Number(s.paid_amount || 0), 0);

  const openCollectionModal = (stop: TripStop) => {
    const remaining = Math.max(0, Number(stop.stop_amount) - Number(stop.paid_amount || 0));
    setSelectedStop(stop);
    setPaymentAmount(remaining);
    setPaymentDate(getCurrentDate());
    setPaymentNotes(`${stop.trip_no || ''} - ${stop.delivered_item || ''} tahsilatı`);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStop) return;
    if (paymentAmount <= 0) {
      await alertDialog('Lütfen 0 TL üzeri geçerli bir tahsilat tutarı girin.', 'Geçersiz Tutar');
      return;
    }
    await api.collectStopPayment({
      stop_id: selectedStop.id,
      payment_amount: Number(paymentAmount),
      payment_date: paymentDate,
      notes: paymentNotes
    });
    setSelectedStop(null);
    loadStops();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="nd-card p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
              Toplam Kalan Açık Alacak
            </span>
            <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: 'var(--amber)' }}>
              {formatCurrency(totalOpenAmount)}
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--amber)' }}
          >
            <Wallet size={20} />
          </div>
        </div>

        <div className="nd-card p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
              Vadesi Geçmiş Alacaklar
            </span>
            <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: 'var(--red)' }}>
              {formatCurrency(totalOverdueAmount)}
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--red)' }}
          >
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="nd-card p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
              Tahsil Edilen Toplam
            </span>
            <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: 'var(--green)' }}>
              {formatCurrency(totalCollectedAmount)}
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--green)' }}
          >
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Filter Bar & Table */}
      <div className="nd-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold">Sefer Durağı Bazlı Tahsilat Tablosu</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Tahsilat Ekle butonu ile durak bakiyesinden ve müşteri genel carisinden anında düşüm yapılır
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'open', label: 'Açık Bakiyeler' },
                { id: 'overdue', label: 'Vadesi Geçenler' },
                { id: 'paid', label: 'Tahsil Edilenler' },
                { id: 'all', label: 'Tüm Duraklar' }
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterMode === f.id ? 'nd-btn-primary' : 'nd-layer'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <th className="py-2.5 px-2">Müşteri / İstasyon</th>
                <th className="py-2.5 px-2">Sefer / Tarih</th>
                <th className="py-2.5 px-2">Ürün & Miktar</th>
                <th className="py-2.5 px-2">Tahsilat Vadesi</th>
                <th className="py-2.5 px-2 text-right">Durak Tutarı</th>
                <th className="py-2.5 px-2 text-right">Ödenen</th>
                <th className="py-2.5 px-2 text-right">Kalan Açık</th>
                <th className="py-2.5 px-2 text-center">Durum</th>
                <th className="py-2.5 px-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filteredStops.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    Seçili filtreye uygun durak kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredStops.map((s) => {
                  const remaining = Math.max(0, Number(s.stop_amount) - Number(s.paid_amount || 0));
                  const isOverdue = remaining > 0 && s.due_date && s.due_date < today;
                  return (
                    <tr key={s.id} className="hover:opacity-95">
                      <td className="py-3 px-2">
                        <button
                          onClick={() => onOpenCustomerProfile(s.customer_id)}
                          className="font-bold hover:underline flex items-center gap-1 text-left"
                          style={{ color: 'var(--accent)' }}
                        >
                          <span>{s.customer_name}</span>
                          <ArrowUpRight size={12} />
                        </button>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {s.customer_city} • {s.vehicle_plate}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-bold tabular-nums">{s.trip_no}</div>
                        <div className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {formatDate(s.trip_date)}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-semibold">{s.delivered_item}</div>
                        <div className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          {Number(s.quantity || 0).toLocaleString('tr-TR')} Lt
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`font-bold tabular-nums ${
                            isOverdue ? 'text-rose-500' : ''
                          }`}
                        >
                          {formatDate(s.due_date)}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-semibold tabular-nums">
                        {formatCurrency(s.stop_amount)}
                      </td>
                      <td className="py-3 px-2 text-right font-semibold tabular-nums" style={{ color: 'var(--green)' }}>
                        {formatCurrency(s.paid_amount)}
                      </td>
                      <td
                        className="py-3 px-2 text-right font-extrabold tabular-nums"
                        style={{ color: remaining > 0 ? (isOverdue ? 'var(--red)' : 'var(--amber)') : 'var(--green)' }}
                      >
                        {formatCurrency(remaining)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            remaining <= 0
                              ? 'nd-badge-green'
                              : isOverdue
                              ? 'nd-badge-red'
                              : s.payment_status === 'partial'
                              ? 'nd-badge-amber'
                              : 'nd-badge-blue'
                          }`}
                        >
                          {remaining <= 0
                            ? 'Tamamlandı'
                            : isOverdue
                            ? 'Gecikmiş'
                            : s.payment_status === 'partial'
                            ? 'Kısmi Ödeme'
                            : 'Vade Bekliyor'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        {remaining > 0 ? (
                          <button
                            onClick={() => openCollectionModal(s)}
                            className="nd-btn-primary px-3 py-1.5 text-xs inline-flex items-center gap-1"
                            style={{ backgroundColor: 'var(--green)' }}
                          >
                            <Plus size={13} />
                            <span>Tahsilat Ekle</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--green)' }}>
                            ✓ Tahsil Edildi
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TAHSİLAT EKLE MODALI */}
      {selectedStop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 18, 28, 0.65)', backdropFilter: 'blur(3px)' }}
        >
          <div className="nd-modal w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-base font-bold">Durak Tahsilatı Ekle</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {selectedStop.customer_name} • {selectedStop.trip_no}
                </p>
              </div>
              <button onClick={() => setSelectedStop(null)} className="p-1.5 rounded-lg nd-layer">
                <X size={15} />
              </button>
            </div>

            <div className="nd-layer p-3.5 mb-4 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Durak Navlun Tutarı:</span>
                <b className="tabular-nums">{formatCurrency(selectedStop.stop_amount)}</b>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Daha Önce Tahsil Edilen:</span>
                <b className="tabular-nums" style={{ color: 'var(--green)' }}>
                  {formatCurrency(selectedStop.paid_amount)}
                </b>
              </div>
              <div className="flex justify-between pt-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
                <span className="font-bold">Kalan Açık Bakiye:</span>
                <b className="tabular-nums text-sm" style={{ color: 'var(--amber)' }}>
                  {formatCurrency(Number(selectedStop.stop_amount) - Number(selectedStop.paid_amount || 0))}
                </b>
              </div>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Tahsil Edilen Tutar (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={Number(selectedStop.stop_amount) - Number(selectedStop.paid_amount || 0)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="nd-input w-full text-sm font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Tahsilat Tarihi</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="nd-input w-full tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Açıklama / Dekont Notu</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Havale / EFT veya Nakit tahsilat"
                  className="nd-input w-full"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedStop(null)}
                  className="nd-btn-secondary px-4 py-2 text-xs"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="nd-btn-primary px-5 py-2 text-xs shadow-md"
                  style={{ backgroundColor: 'var(--green)' }}
                >
                  Tahsilatı Onayla ve Cariden Düş
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
