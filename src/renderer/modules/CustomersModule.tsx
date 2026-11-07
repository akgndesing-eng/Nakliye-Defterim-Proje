import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Phone,
  MapPin,
  FileText,
  Truck,
  Wallet,
  StickyNote,
  Edit3,
  Trash2,
  X,
  MessageSquare
} from 'lucide-react';
import { Customer, CustomerDetailProfile, NavTabId } from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency, formatDate, getCurrentDate } from '../utils/format';

interface CustomersModuleProps {
  initialCustomerId?: string | null;
  onNavigateWhatsApp: (customerId: string) => void;
}

export const CustomersModule: React.FC<CustomersModuleProps> = ({
  initialCustomerId,
  onNavigateWhatsApp
}) => {
  const [customers, setCustomers] = useState<Customer[]>(() => getCached<Customer[]>('customers') || []);
  const [selectedId, setSelectedId] = useState<string | null>(initialCustomerId || null);
  const [profile, setProfile] = useState<CustomerDetailProfile | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<'general' | 'trips' | 'statement' | 'notes'>('statement');

  // Customer Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer>>({});

  // Manual Ledger Entry Modal
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState<'debit' | 'credit'>('credit');
  const [txAmount, setTxAmount] = useState<number>(0);
  const [txDesc, setTxDesc] = useState('');

  // Quick Note Input
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const loadCustomers = async () => {
    const list = await api.getCustomers();
    setCustomers(list || []);
    const target = selectedId || initialCustomerId || list?.[0]?.id || null;
    if (target) {
      setSelectedId(target);
      loadDetail(target);
    }
  };

  const loadDetail = async (id: string) => {
    try {
      const det = await api.getCustomerDetail(id);
      setProfile(det);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedId(initialCustomerId);
      loadDetail(initialCustomerId);
    }
  }, [initialCustomerId]);

  const handleSelectCustomer = (id: string) => {
    setSelectedId(id);
    loadDetail(id);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await api.saveCustomer(editingCustomer);
    setShowModal(false);
    await loadCustomers();
    if (saved?.id) {
      handleSelectCustomer(saved.id);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('Müşteri kaydını silmek istediğinize emin misiniz?')) return;
    await api.deleteCustomer(id);
    setSelectedId(null);
    loadCustomers();
  };

  const handleSaveManualTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || txAmount <= 0) return;
    await api.addCustomerTransaction({
      customer_id: selectedId,
      tx_type: txType,
      amount: Number(txAmount),
      tx_date: getCurrentDate(),
      description: txDesc
    });
    setShowTxModal(false);
    setTxAmount(0);
    setTxDesc('');
    loadCustomers();
  };

  const handleAddCustomerNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !noteTitle.trim()) return;
    await api.saveReminderNote({
      title: noteTitle,
      content: noteContent,
      customer_id: selectedId,
      remind_date: getCurrentDate(),
      remind_time: '10:00',
      is_completed: 0
    });
    setNoteTitle('');
    setNoteContent('');
    loadDetail(selectedId);
  };

  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* Left Column: Customer List (4 Cols) */}
      <div className="lg:col-span-4 nd-card p-4 flex flex-col max-h-[340px] lg:max-h-none lg:h-[calc(100vh-120px)]">
        <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-sm font-bold">Müşteriler & İstasyonlar</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Toplam {customers.length} kayıtlı istasyon/cari
            </p>
          </div>
          <button
            onClick={() => {
              setEditingCustomer({ city: 'Edirne' });
              setShowModal(true);
            }}
            className="nd-btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
          >
            <Plus size={14} />
            <span>Yeni Müşteri</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {customers.map((c) => {
            const isSelected = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => handleSelectCustomer(c.id)}
                className="w-full text-left p-3 rounded-xl transition-all border"
                style={{
                  backgroundColor: isSelected ? 'var(--layer)' : 'transparent',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)'
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate">{c.name}</span>
                  <span
                    className="text-xs font-extrabold tabular-nums shrink-0"
                    style={{
                      color:
                        Number(c.overdue_amount || 0) > 0
                          ? 'var(--red)'
                          : c.current_balance > 0
                          ? 'var(--amber)'
                          : 'var(--green)'
                    }}
                  >
                    {formatCurrency(c.current_balance)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span className="truncate">{c.city || 'Edirne'} • {c.phone}</span>
                  {Number(c.overdue_amount || 0) > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded nd-badge-red">
                      Gecikmiş
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Detailed Customer Profile (8 Cols) */}
      <div className="lg:col-span-8 nd-card p-4 sm:p-6 h-auto lg:h-[calc(100vh-120px)] overflow-y-auto">
        {!profile ? (
          <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Detaylarını görüntülemek için soldan bir müşteri seçin.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Profile Top Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-extrabold">{profile.customer.name}</h2>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full nd-badge-blue">
                    {profile.customer.city}
                  </span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {profile.customer.company_title || 'Resmi ticari unvan belirtilmedi'}
                </p>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
                  <span className="flex items-center gap-1">
                    <Phone size={13} style={{ color: 'var(--accent)' }} />
                    <b className="tabular-nums">{profile.customer.phone || '-'}</b>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={13} style={{ color: 'var(--accent)' }} />
                    <span>{profile.customer.address || '-'}</span>
                  </span>
                </div>
              </div>

              <div className="text-right space-y-2">
                <div>
                  <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--text-muted)' }}>
                    Güncel Cari Bakiye
                  </span>
                  <span
                    className="text-2xl font-black tabular-nums"
                    style={{ color: profile.customer.current_balance > 0 ? 'var(--amber)' : 'var(--green)' }}
                  >
                    {formatCurrency(profile.customer.current_balance)}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => onNavigateWhatsApp(profile.customer.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1"
                    style={{ backgroundColor: 'var(--green)' }}
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp Hatırlat</span>
                  </button>
                  <button
                    onClick={() => {
                      setTxType('credit');
                      setShowTxModal(true);
                    }}
                    className="nd-btn-primary px-2.5 py-1.5 text-xs"
                  >
                    + Cari İşlem
                  </button>
                  <button
                    onClick={() => {
                      setEditingCustomer(profile.customer);
                      setShowModal(true);
                    }}
                    className="nd-btn-secondary p-1.5"
                    title="Müşteri Bilgilerini Düzenle"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteCustomer(profile.customer.id)}
                    className="p-1.5 rounded-lg nd-badge-red"
                    title="Sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Profile Sub-Tabs */}
            <div className="grid grid-cols-4 gap-2 p-1 nd-layer">
              {(
                [
                  { id: 'statement', label: 'Cari Hesap Ekstresi', icon: <Wallet size={14} /> },
                  { id: 'trips', label: `Sefer Geçmişi (${profile.tripsHistory.length})`, icon: <Truck size={14} /> },
                  { id: 'general', label: 'Genel Bilgiler', icon: <FileText size={14} /> },
                  { id: 'notes', label: `Özel Notlar (${profile.notes.length})`, icon: <StickyNote size={14} /> }
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveProfileTab(t.id)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeProfileTab === t.id ? 'nd-btn-primary shadow-sm' : 'opacity-75 hover:opacity-100'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* TAB 1: CARİ HESAP EKSTRESİ */}
            {activeProfileTab === 'statement' && (
              <div className="space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        <th className="py-2 px-2">Tarih</th>
                        <th className="py-2 px-2">İşlem Türü</th>
                        <th className="py-2 px-2">Açıklama</th>
                        <th className="py-2 px-2 text-right">Borç (+)</th>
                        <th className="py-2 px-2 text-right">Alacak / Ödeme (-)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {profile.statement.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-2 tabular-nums font-medium">{formatDate(item.date)}</td>
                          <td className="py-2.5 px-2 font-bold">{item.title}</td>
                          <td className="py-2.5 px-2" style={{ color: 'var(--text-muted)' }}>
                            {item.description}
                          </td>
                          <td className="py-2.5 px-2 text-right font-bold tabular-nums" style={{ color: 'var(--amber)' }}>
                            {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                          </td>
                          <td className="py-2.5 px-2 text-right font-bold tabular-nums" style={{ color: 'var(--green)' }}>
                            {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: SEFER GEÇMİŞİ */}
            {activeProfileTab === 'trips' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                      <th className="py-2 px-2">Sefer Kodu / Tarih</th>
                      <th className="py-2 px-2">Plaka / Şoför</th>
                      <th className="py-2 px-2">Teslim Edilen Ürün</th>
                      <th className="py-2 px-2 text-right">Miktar</th>
                      <th className="py-2 px-2 text-right">Navlun Tutarı</th>
                      <th className="py-2 px-2 text-right">Ödenen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {profile.tripsHistory.map((st) => (
                      <tr key={st.id}>
                        <td className="py-2.5 px-2">
                          <div className="font-bold">{st.trip_no}</div>
                          <div className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            {formatDate(st.trip_date)}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-bold">{st.vehicle_plate}</span> • {st.driver_name}
                        </td>
                        <td className="py-2.5 px-2 font-semibold">{st.delivered_item}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums">
                          {Number(st.quantity || 0).toLocaleString('tr-TR')} Lt
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold tabular-nums">
                          {formatCurrency(st.stop_amount)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold tabular-nums" style={{ color: 'var(--green)' }}>
                          {formatCurrency(st.paid_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 3: GENEL BİLGİLER */}
            {activeProfileTab === 'general' && (
              <div className="nd-layer p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-bold block" style={{ color: 'var(--text-muted)' }}>
                      İstasyon / Müşteri Adı
                    </span>
                    <p className="font-bold text-sm mt-0.5">{profile.customer.name}</p>
                  </div>
                  <div>
                    <span className="font-bold block" style={{ color: 'var(--text-muted)' }}>
                      Resmi Şirket Unvanı
                    </span>
                    <p className="font-bold text-sm mt-0.5">{profile.customer.company_title || '-'}</p>
                  </div>
                  <div>
                    <span className="font-bold block" style={{ color: 'var(--text-muted)' }}>
                      WhatsApp Telefon Numarası
                    </span>
                    <p className="font-bold text-sm mt-0.5 tabular-nums">{profile.customer.phone || '-'}</p>
                  </div>
                  <div>
                    <span className="font-bold block" style={{ color: 'var(--text-muted)' }}>
                      Şehir / Bölge
                    </span>
                    <p className="font-bold text-sm mt-0.5">{profile.customer.city || '-'}</p>
                  </div>
                </div>
                <div>
                  <span className="font-bold block" style={{ color: 'var(--text-muted)' }}>
                    Açık Adres
                  </span>
                  <p className="mt-0.5">{profile.customer.address || '-'}</p>
                </div>
                <div>
                  <span className="font-bold block" style={{ color: 'var(--text-muted)' }}>
                    Cari Notlar
                  </span>
                  <p className="mt-0.5">{profile.customer.notes || '-'}</p>
                </div>
              </div>
            )}

            {/* TAB 4: ÖZEL NOTLAR */}
            {activeProfileTab === 'notes' && (
              <div className="space-y-4">
                <form onSubmit={handleAddCustomerNote} className="nd-layer p-3.5 flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold mb-1">Not Başlığı</label>
                    <input
                      type="text"
                      required
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Örn: Cuma ödeme sözü..."
                      className="nd-input w-full py-1.5"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold mb-1">Detay</label>
                    <input
                      type="text"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Not açıklaması..."
                      className="nd-input w-full py-1.5"
                    />
                  </div>
                  <button type="submit" className="nd-btn-primary px-4 py-2 text-xs">
                    + Not Ekle
                  </button>
                </form>

                <div className="space-y-2">
                  {profile.notes.map((n) => (
                    <div key={n.id} className="nd-layer p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold">{n.title}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {n.content} • Tarih: {formatDate(n.remind_date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 18, 28, 0.65)', backdropFilter: 'blur(3px)' }}
        >
          <div className="nd-modal w-full max-w-lg p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-base font-bold">
                {editingCustomer.id ? 'Müşteri Profilini Düzenle' : 'Yeni Müşteri / İstasyon Ekle'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg nd-layer">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1">Müşteri / İstasyon Kısa Adı</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.name || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="nd-input w-full"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Resmi Ticari Unvan</label>
                <input
                  type="text"
                  value={editingCustomer.company_title || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, company_title: e.target.value })}
                  className="nd-input w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">WhatsApp Telefon (905...)</label>
                  <input
                    type="text"
                    value={editingCustomer.phone || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    placeholder="90532..."
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Şehir</label>
                  <input
                    type="text"
                    value={editingCustomer.city || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, city: e.target.value })}
                    className="nd-input w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Açık Adres</label>
                <input
                  type="text"
                  value={editingCustomer.address || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                  className="nd-input w-full"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Özel Notlar</label>
                <input
                  type="text"
                  value={editingCustomer.notes || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
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

      {/* MANUAL LEDGER ENTRY MODAL */}
      {showTxModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 18, 28, 0.65)', backdropFilter: 'blur(3px)' }}
        >
          <div className="nd-modal w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-base font-bold">Cari Hesap Hareketi Ekle</h3>
              <button onClick={() => setShowTxModal(false)} className="p-1.5 rounded-lg nd-layer">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleSaveManualTx} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1">İşlem Türü</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as 'debit' | 'credit')}
                  className="nd-input w-full font-bold"
                >
                  <option value="credit">Genel Tahsilat / Ödeme Düşümü (-)</option>
                  <option value="debit">Ek Cari Borç Ekleme (+)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Tutar (₺)</label>
                <input
                  type="number"
                  required
                  value={txAmount}
                  onChange={(e) => setTxAmount(Number(e.target.value))}
                  className="nd-input w-full tabular-nums font-bold"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Açıklama</label>
                <input
                  type="text"
                  required
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  placeholder="Banka Havalesi / Devir bakiyesi vb."
                  className="nd-input w-full"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="nd-btn-secondary px-4 py-2"
                >
                  İptal
                </button>
                <button type="submit" className="nd-btn-primary px-5 py-2">
                  Cariye İşle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
