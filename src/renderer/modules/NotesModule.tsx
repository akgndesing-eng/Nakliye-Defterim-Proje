import React, { useState, useEffect } from 'react';
import {
  StickyNote,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Search,
  Calendar,
  Clock,
  User,
  X
} from 'lucide-react';
import { ReminderNote, Customer } from '../../shared/types';
import { api, getCached } from '../api';
import { formatDate, getCurrentDate } from '../utils/format';
import { confirmDialog } from '../utils/dialog';

export const NotesModule: React.FC = () => {
  const [notes, setNotes] = useState<ReminderNote[]>(() => getCached<ReminderNote[]>('notes') || []);
  const [customers, setCustomers] = useState<Customer[]>(() => getCached<Customer[]>('customers') || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Partial<ReminderNote>>({});

  const loadData = async () => {
    const [nList, cList] = await Promise.all([
      api.getReminderNotes(),
      api.getCustomers()
    ]);
    setNotes(nList || []);
    setCustomers(cList || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewNote = () => {
    setEditingNote({
      title: '',
      content: '',
      customer_id: '',
      remind_date: getCurrentDate(),
      remind_time: '09:30',
      is_completed: 0
    });
    setShowModal(true);
  };

  const openEditNote = (n: ReminderNote) => {
    setEditingNote({ ...n });
    setShowModal(true);
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote.title?.trim()) return;
    await api.saveReminderNote({
      ...editingNote,
      customer_id: editingNote.customer_id || null
    });
    setShowModal(false);
    loadData();
  };

  const handleToggleNote = async (id: string) => {
    await api.toggleReminderNote(id);
    loadData();
  };

  const handleDeleteNote = async (id: string) => {
    if (!(await confirmDialog('Bu notu/hatırlatıcıyı silmek istediğinize emin misiniz?', 'Not Silme Onayı'))) return;
    await api.deleteReminderNote(id);
    loadData();
  };

  const filteredNotes = notes.filter((n) => {
    if (statusFilter === 'pending' && n.is_completed) return false;
    if (statusFilter === 'completed' && !n.is_completed) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.customer_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Top Header & Actions */}
      <div className="nd-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            <StickyNote size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold">Notlar ve Hatırlatıcılar Merkezi</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Müşteri görüşmelerini, tahsilat sözlerini, özel sevkiyat notlarını ve tarihli hatırlatıcıları yönetin
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Notlarda ara..."
              className="nd-input pl-8 pr-3 py-1.5 w-52"
            />
          </div>

          <div className="flex items-center gap-1 nd-layer p-1 rounded-xl">
            {(
              [
                { id: 'all', label: `Tümü (${notes.length})` },
                { id: 'pending', label: `Aktif (${notes.filter((n) => !n.is_completed).length})` },
                { id: 'completed', label: `Tamamlanan (${notes.filter((n) => n.is_completed).length})` }
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                onClick={() => setStatusFilter(btn.id)}
                className="px-3 py-1 rounded-lg font-semibold transition-all"
                style={{
                  backgroundColor: statusFilter === btn.id ? 'var(--accent)' : 'transparent',
                  color: statusFilter === btn.id ? '#ffffff' : 'var(--text-muted)'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <button
            onClick={openNewNote}
            className="nd-btn-primary px-4 py-2 flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>+ Yeni Not / Hatırlatıcı</span>
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNotes.length === 0 ? (
          <div className="col-span-full nd-card p-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Kayıtlı not veya hatırlatıcı bulunamadı. Sağ üstten yeni not ekleyebilirsiniz.
          </div>
        ) : (
          filteredNotes.map((n) => (
            <div
              key={n.id}
              className="nd-card p-5 flex flex-col justify-between transition-all"
              style={{ opacity: n.is_completed ? 0.72 : 1 }}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      onClick={() => handleToggleNote(n.id)}
                      className="shrink-0 transition-transform active:scale-90"
                    >
                      <CheckCircle2
                        size={19}
                        style={{ color: n.is_completed ? 'var(--green)' : 'var(--text-muted)' }}
                      />
                    </button>
                    <h4 className={`text-sm font-bold truncate ${n.is_completed ? 'line-through' : ''}`}>
                      {n.title}
                    </h4>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      n.is_completed ? 'nd-badge-green' : 'nd-badge-amber'
                    }`}
                  >
                    {n.is_completed ? 'Tamamlandı' : 'Hatırlatıcı'}
                  </span>
                </div>

                <p className="text-xs mt-3 leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                  {n.content || 'Açıklama girilmedi.'}
                </p>

                {n.customer_name && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg nd-layer text-[11px] font-semibold">
                    <User size={12} style={{ color: 'var(--accent)' }} />
                    <span>Cari: {n.customer_name}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} />
                    <span>{formatDate(n.remind_date)}</span>
                  </span>
                  {n.remind_time && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      <span>{n.remind_time}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditNote(n)}
                    className="nd-btn-secondary px-2.5 py-1 text-[11px] flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    <span>Düzenle</span>
                  </button>
                  <button
                    onClick={() => handleDeleteNote(n.id)}
                    className="p-1.5 rounded-lg nd-badge-red"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Note Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 14, 13, 0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div className="nd-card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-base font-bold">
                {editingNote.id ? 'Notu / Hatırlatıcıyı Düzenle' : 'Yeni Not / Hatırlatıcı Ekle'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:opacity-75">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Not / Hatırlatıcı Başlığı *</label>
                <input
                  type="text"
                  required
                  value={editingNote.title || ''}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  placeholder="Örn: Trakya Birlik tahsilat görüşmesi..."
                  className="nd-input w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Detaylı İçerik</label>
                <textarea
                  rows={4}
                  value={editingNote.content || ''}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  placeholder="Not detaylarını buraya yazabilirsiniz..."
                  className="nd-input w-full"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Hatırlatma Tarihi</label>
                  <input
                    type="date"
                    value={editingNote.remind_date || getCurrentDate()}
                    onChange={(e) => setEditingNote({ ...editingNote, remind_date: e.target.value })}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Saat</label>
                  <input
                    type="time"
                    value={editingNote.remind_time || '09:30'}
                    onChange={(e) => setEditingNote({ ...editingNote, remind_time: e.target.value })}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">İlgili Müşteri (Opsiyonel)</label>
                  <select
                    value={editingNote.customer_id || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, customer_id: e.target.value || null })}
                    className="nd-input w-full"
                  >
                    <option value="">Bağımsız Not</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
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
