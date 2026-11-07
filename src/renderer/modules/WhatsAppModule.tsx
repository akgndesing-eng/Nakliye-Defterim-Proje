import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Phone,
  RefreshCw,
  Check,
  Edit3,
  ExternalLink,
  UserCheck
} from 'lucide-react';
import { Customer } from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency, formatDate } from '../utils/format';
import { alertDialog } from '../utils/dialog';

interface WhatsAppModuleProps {
  initialCustomerId?: string | null;
}

export const WhatsAppModule: React.FC<WhatsAppModuleProps> = ({ initialCustomerId }) => {
  const [customers, setCustomers] = useState<Customer[]>(() =>
    (getCached<Customer[]>('customers') || []).filter((c) => c.current_balance > 0)
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messageText, setMessageText] = useState<string>('');
  const [editingPhone, setEditingPhone] = useState<string>('');
  const [phoneSavedMsg, setPhoneSavedMsg] = useState<boolean>(false);

  const buildTemplate = (c: Customer) => {
    const dueStr = c.earliest_due_date ? formatDate(c.earliest_due_date) : 'Güncel Dönem';
    return `Sayın ${c.name}${c.company_title ? ` (${c.company_title})` : ''},\n\nCari kayıtlarımıza göre ${dueStr} vadeli toplam *${formatCurrency(c.current_balance)}* açık bakiyeniz bulunmaktadır.\n\nÖdeme planlamanız hakkında bilgi rica eder, iyi çalışmalar dileriz.`;
  };

  const normalizeTrPhone = (rawPhone?: string | null): string => {
    const digits = (rawPhone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('90') && digits.length >= 12) return digits;
    if (digits.startsWith('0') && digits.length >= 11) return '90' + digits.slice(1);
    if (digits.length === 10) return '90' + digits;
    return digits;
  };

  const loadList = async () => {
    const all: Customer[] = (await api.getCustomers()) || [];
    const withBalance = all.filter((c: Customer) => c.current_balance > 0);
    setCustomers(withBalance);

    const target =
      withBalance.find((c: Customer) => c.id === initialCustomerId) ||
      (selectedCustomer && withBalance.find((c: Customer) => c.id === selectedCustomer.id)) ||
      withBalance[0] ||
      null;

    if (target) {
      setSelectedCustomer(target);
      setEditingPhone(target.phone || '');
      if (!messageText) {
        setMessageText(buildTemplate(target));
      }
    }
  };

  useEffect(() => {
    loadList();
  }, [initialCustomerId]);

  const handleSelect = (c: Customer) => {
    setSelectedCustomer(c);
    setEditingPhone(c.phone || '');
    setMessageText(buildTemplate(c));
    setPhoneSavedMsg(false);
  };

  const handleSaveProfilePhone = async () => {
    if (!selectedCustomer) return;
    const updated = await api.saveCustomer({
      ...selectedCustomer,
      phone: editingPhone.trim()
    });
    setSelectedCustomer({ ...selectedCustomer, phone: updated.phone });
    setCustomers((prev) =>
      prev.map((c) => (c.id === selectedCustomer.id ? { ...c, phone: updated.phone } : c))
    );
    setPhoneSavedMsg(true);
    setTimeout(() => setPhoneSavedMsg(false), 2500);
  };

  const handleOpenWhatsAppApp = async () => {
    if (!selectedCustomer) return;
    const targetPhone = normalizeTrPhone(editingPhone || selectedCustomer.phone);
    if (!targetPhone) {
      await alertDialog('Lütfen müşterinin profil telefon numarasını girin.', 'Telefon Numarası Eksik');
      return;
    }
    // Opens WhatsApp Desktop application directly with phone & pre-filled message without auto-sending
    const appUrl = `whatsapp://send?phone=${targetPhone}&text=${encodeURIComponent(messageText)}`;
    api.openExternal(appUrl);
  };

  const handleOpenWhatsAppWeb = async () => {
    if (!selectedCustomer) return;
    const targetPhone = normalizeTrPhone(editingPhone || selectedCustomer.phone);
    if (!targetPhone) {
      await alertDialog('Lütfen müşterinin profil telefon numarasını girin.', 'Telefon Numarası Eksik');
      return;
    }
    const webUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(messageText)}`;
    api.openExternal(webUrl);
  };

  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* Sol Sütun: Borcu Olan Müşteriler Listesi */}
      <div className="lg:col-span-5 nd-card p-4 sm:p-5 flex flex-col max-h-[320px] lg:max-h-none lg:h-[calc(100vh-120px)]">
        <div className="pb-3 mb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <MessageSquare size={17} style={{ color: 'var(--green)' }} />
            <span>Borcu Olan Müşteriler ({customers.length})</span>
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Listeden borcu olan bir müşteri seçin; profilindeki telefon numarasına göre sağda mesajınız hazırlanır
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {customers.length === 0 ? (
            <div className="nd-layer p-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              Şu anda borcu (açık bakiyesi) bulunan müşteri bulunmamaktadır.
            </div>
          ) : (
            customers.map((c) => {
              const isSelected = selectedCustomer?.id === c.id;
              const isOverdue = Number(c.overdue_amount || 0) > 0;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className="w-full text-left p-3.5 rounded-xl border transition-all"
                  style={{
                    backgroundColor: isSelected ? 'var(--layer)' : 'transparent',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    boxShadow: isSelected ? '0 0 0 2px var(--accent-subtle)' : undefined
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold truncate">{c.name}</span>
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: isOverdue ? 'var(--red)' : 'var(--amber)' }}
                    >
                      {formatCurrency(c.current_balance)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    <span className="tabular-nums flex items-center gap-1">
                      <Phone size={11} style={{ color: 'var(--green)' }} />
                      <b>{c.phone || 'Numara Yok'}</b>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOverdue ? 'nd-badge-red' : 'nd-badge-amber'
                      }`}
                    >
                      {isOverdue ? `Vadesi Geçti (${formatDate(c.earliest_due_date)})` : `Vade: ${formatDate(c.earliest_due_date)}`}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Sağ Sütun: Mesaj Yazma ve WhatsApp Uygulamasında Hazırlama Alanı */}
      <div className="lg:col-span-7 nd-card p-4 sm:p-6 flex flex-col justify-between h-auto lg:h-[calc(100vh-120px)]">
        {!selectedCustomer ? (
          <div className="h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Lütfen soldaki listeden borcu olan bir müşteri seçin.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Seçili Müşteri & Profil Telefon Numarası Bilgisi */}
              <div className="pb-4 border-b space-y-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold">{selectedCustomer.name}</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {selectedCustomer.company_title || 'Cari Müşteri'} • Açık Borç Bakiyesi:{' '}
                      <b className="tabular-nums" style={{ color: 'var(--red)' }}>
                        {formatCurrency(selectedCustomer.current_balance)}
                      </b>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMessageText('')}
                      className="nd-btn-secondary px-3 py-1.5 text-xs"
                    >
                      Metni Temizle
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageText(buildTemplate(selectedCustomer))}
                      className="nd-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
                    >
                      <RefreshCw size={13} />
                      <span>Hazır Şablon Doldur</span>
                    </button>
                  </div>
                </div>

                {/* Müşteri Profil Telefonu Düzenleme / Doğrulama Satırı */}
                <div className="nd-layer p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Phone size={15} style={{ color: 'var(--accent)' }} />
                    <span className="font-semibold">Müşteri Profilindeki Telefon Numarası:</span>
                  </div>

                  <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <input
                      type="text"
                      value={editingPhone}
                      onChange={(e) => setEditingPhone(e.target.value)}
                      placeholder="0532 000 00 00"
                      className="nd-input py-1.5 px-3 text-xs font-bold tabular-nums flex-1"
                    />
                    {editingPhone.trim() !== (selectedCustomer.phone || '').trim() && (
                      <button
                        type="button"
                        onClick={handleSaveProfilePhone}
                        className="nd-btn-primary px-3 py-1.5 text-xs flex items-center gap-1 shrink-0"
                      >
                        <Check size={13} />
                        <span>Profile Kaydet</span>
                      </button>
                    )}
                    {phoneSavedMsg && (
                      <span className="text-[11px] font-bold" style={{ color: 'var(--green)' }}>
                        ✓ Kaydedildi
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mesaj Yazma Alanı */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold">
                    Gönderilecek WhatsApp Mesajı (İstediğiniz Gibi Yazın veya Düzenleyin)
                  </label>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Otomatik gönderilmez; WhatsApp uygulamasında hazır bekler
                  </span>
                </div>
                <textarea
                  rows={10}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Müşteriye göndermek istediğiniz mesajı buraya yazın..."
                  className="nd-input w-full text-xs leading-relaxed font-medium resize-none p-4"
                />
              </div>

              <div className="nd-layer p-3.5 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold block">Nasıl Çalışır?</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Aşağıdaki butona bastığınızda müşterinin profilindeki{' '}
                    <b className="tabular-nums">{editingPhone || 'numara'}</b> ile WhatsApp uygulaması açılır ve yazdığınız mesaj sohbet kutusuna hazır olarak yerleştirilir. Siz göndere basana kadar otomatik gönderilmez.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[11px] tabular-nums font-semibold" style={{ color: 'var(--text-muted)' }}>
                Hedef Numara: +{normalizeTrPhone(editingPhone || selectedCustomer.phone) || 'Belirtilmedi'}
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenWhatsAppWeb}
                  disabled={!messageText.trim()}
                  className="nd-btn-secondary px-4 py-2.5 text-xs flex items-center gap-1.5 disabled:opacity-40"
                >
                  <ExternalLink size={14} />
                  <span>Tarayıcı / Web ile Aç</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenWhatsAppApp}
                  disabled={!messageText.trim()}
                  className="nd-btn-primary px-6 py-2.5 text-xs flex items-center gap-2 shadow-md disabled:opacity-40"
                  style={{ backgroundColor: 'var(--green)' }}
                >
                  <Send size={15} />
                  <span>WhatsApp Uygulamasını Aç ve Mesajı Hazırla</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
