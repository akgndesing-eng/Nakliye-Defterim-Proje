import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Calendar,
  Clock,
  Truck,
  User,
  X
} from 'lucide-react';
import { TaskItem, Vehicle, Customer, Driver } from '../../shared/types';
import { api, getCached } from '../api';
import { formatDate, getCurrentDate } from '../utils/format';
import { confirmDialog } from '../utils/dialog';

export const TasksModule: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>(() => getCached<TaskItem[]>('tasks') || []);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getCached<Vehicle[]>('vehicles') || []);
  const [customers, setCustomers] = useState<Customer[]>(() => getCached<Customer[]>('customers') || []);
  const [drivers, setDrivers] = useState<Driver[]>(() => getCached<Driver[]>('drivers') || []);
  const [filter, setFilter] = useState<'all' | 'pending' | 'high' | 'completed'>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<TaskItem>>({});

  const loadData = async () => {
    const [tskList, vList, cList, dList] = await Promise.all([
      api.getTasks(),
      api.getVehicles(),
      api.getCustomers(),
      api.getDrivers()
    ]);
    setTasks(tskList || []);
    setVehicles(vList || []);
    setCustomers(cList || []);
    setDrivers(dList || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewTask = () => {
    setEditingTask({
      title: '',
      description: '',
      task_date: getCurrentDate(),
      task_time: '10:00',
      priority: 'normal',
      status: 'pending',
      customer_id: '',
      vehicle_id: '',
      driver_name: ''
    });
    setShowModal(true);
  };

  const openEditTask = (tsk: TaskItem) => {
    setEditingTask({ ...tsk });
    setShowModal(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask.title?.trim()) return;
    await api.saveTask({
      ...editingTask,
      customer_id: editingTask.customer_id || null,
      vehicle_id: editingTask.vehicle_id || null,
      driver_name: editingTask.driver_name || null
    });
    setShowModal(false);
    loadData();
  };

  const handleToggle = async (id: string) => {
    await api.toggleTaskStatus(id);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog('Bu görevi silmek istediğinize emin misiniz?', 'Görev Silme Onayı'))) return;
    await api.deleteTask(id);
    loadData();
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return t.status === 'pending';
    if (filter === 'completed') return t.status === 'completed';
    if (filter === 'high') return t.priority === 'high' && t.status === 'pending';
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="nd-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            <CheckSquare size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold">Görevler & Operasyon İş Listesi</h3>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Araç bakımı, TÜVTÜRK muayene hazırlığı, sevkiyat planlaması ve günlük yapılacak işleri takip edin
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1 nd-layer p-1 rounded-xl">
            {(
              [
                { id: 'all', label: `Tümü (${tasks.length})` },
                { id: 'pending', label: `Bekleyen (${tasks.filter((t) => t.status === 'pending').length})` },
                {
                  id: 'high',
                  label: `Acil (${tasks.filter((t) => t.priority === 'high' && t.status === 'pending').length})`
                },
                { id: 'completed', label: `Tamamlanan (${tasks.filter((t) => t.status === 'completed').length})` }
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                onClick={() => setFilter(btn.id)}
                className="px-3 py-1 rounded-lg font-semibold transition-all"
                style={{
                  backgroundColor: filter === btn.id ? 'var(--accent)' : 'transparent',
                  color: filter === btn.id ? '#ffffff' : 'var(--text-muted)'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <button
            onClick={openNewTask}
            className="nd-btn-primary px-4 py-2 flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>+ Yeni Görev Ekle</span>
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="nd-card p-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Seçili filtreye uygun görev bulunamadı.
          </div>
        ) : (
          filteredTasks.map((tsk) => (
            <div
              key={tsk.id}
              className="nd-card p-4 flex flex-wrap items-center justify-between gap-4 transition-all"
              style={{ opacity: tsk.status === 'completed' ? 0.72 : 1 }}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  onClick={() => handleToggle(tsk.id)}
                  className="mt-0.5 shrink-0 transition-transform active:scale-90"
                >
                  <CheckCircle2
                    size={20}
                    style={{ color: tsk.status === 'completed' ? 'var(--green)' : 'var(--text-muted)' }}
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4
                      className={`text-sm font-bold ${
                        tsk.status === 'completed' ? 'line-through' : ''
                      }`}
                    >
                      {tsk.title}
                    </h4>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        tsk.priority === 'high'
                          ? 'nd-badge-red'
                          : tsk.priority === 'low'
                          ? 'nd-badge-blue'
                          : 'nd-badge-amber'
                      }`}
                    >
                      {tsk.priority === 'high' ? 'Acil' : tsk.priority === 'low' ? 'Düşük' : 'Normal'}
                    </span>

                    {tsk.vehicle_plate && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full nd-layer tabular-nums">
                        Araç: {tsk.vehicle_plate}
                      </span>
                    )}

                    {tsk.customer_name && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full nd-layer">
                        Cari: {tsk.customer_name}
                      </span>
                    )}

                    {tsk.driver_name && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full nd-layer">
                        Şoför: {tsk.driver_name}
                      </span>
                    )}
                  </div>

                  {tsk.description && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {tsk.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs shrink-0">
                <div className="text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex items-center gap-1 justify-end font-semibold">
                    <Calendar size={12} />
                    <span>{formatDate(tsk.task_date)}</span>
                  </div>
                  <div className="flex items-center gap-1 justify-end text-[11px]">
                    <Clock size={11} />
                    <span>{tsk.task_time}</span>
                  </div>
                </div>

                <button
                  onClick={() => openEditTask(tsk)}
                  className="nd-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1"
                >
                  <Edit3 size={13} />
                  <span>Düzenle</span>
                </button>

                <button
                  onClick={() => handleDelete(tsk.id)}
                  className="p-2 rounded-lg nd-badge-red"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Task Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 14, 13, 0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div className="nd-card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-base font-bold">
                {editingTask.id ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:opacity-75">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Görev Başlığı *</label>
                <input
                  type="text"
                  required
                  value={editingTask.title || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  placeholder="Örn: 22 AEL 228 ADR sızdırmazlık kontrolü..."
                  className="nd-input w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Açıklama / Detay</label>
                <textarea
                  rows={3}
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="Görev detayı..."
                  className="nd-input w-full"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tarih</label>
                  <input
                    type="date"
                    value={editingTask.task_date || getCurrentDate()}
                    onChange={(e) => setEditingTask({ ...editingTask, task_date: e.target.value })}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Saat</label>
                  <input
                    type="time"
                    value={editingTask.task_time || '10:00'}
                    onChange={(e) => setEditingTask({ ...editingTask, task_time: e.target.value })}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Öncelik</label>
                  <select
                    value={editingTask.priority || 'normal'}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, priority: e.target.value as TaskItem['priority'] })
                    }
                    className="nd-input w-full"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">Acil</option>
                    <option value="low">Düşük</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">İlgili Araç (Opsiyonel)</label>
                  <select
                    value={editingTask.vehicle_id || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, vehicle_id: e.target.value || null })}
                    className="nd-input w-full"
                  >
                    <option value="">Seçilmedi</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">İlgili Müşteri (Opsiyonel)</label>
                  <select
                    value={editingTask.customer_id || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, customer_id: e.target.value || null })}
                    className="nd-input w-full"
                  >
                    <option value="">Seçilmedi</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Sorumlu Şoför (Opsiyonel)</label>
                  <select
                    value={editingTask.driver_name || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, driver_name: e.target.value || null })}
                    className="nd-input w-full"
                  >
                    <option value="">Seçilmedi</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
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
