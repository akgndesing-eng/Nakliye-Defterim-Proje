import React, { useState, useEffect } from 'react';
import {
  CalendarRange,
  Plus,
  CheckCircle2,
  Trash2,
  StickyNote,
  CheckSquare,
  Truck,
  Wallet
} from 'lucide-react';
import { Trip, TripStop, TaskItem, ReminderNote } from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency, formatDate, getCurrentDate } from '../utils/format';

interface PlanningModuleProps {
  selectedMonth: string;
}

export const PlanningModule: React.FC<PlanningModuleProps> = ({ selectedMonth }) => {
  const [trips, setTrips] = useState<Trip[]>(
    () => getCached<Trip[]>(`trips:${selectedMonth}`) || getCached<Trip[]>('trips:') || []
  );
  const [stops, setStops] = useState<TripStop[]>(() => getCached<TripStop[]>('stops:all') || []);
  const [tasks, setTasks] = useState<TaskItem[]>(() => getCached<TaskItem[]>('tasks') || []);
  const [notes, setNotes] = useState<ReminderNote[]>(() => getCached<ReminderNote[]>('notes') || []);
  const [selectedDay, setSelectedDay] = useState<string>(getCurrentDate());

  // New Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskTime, setTaskTime] = useState('10:00');
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high'>('normal');

  // New Note Form
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const loadAll = async () => {
    const [tList, sList, tskList, nList] = await Promise.all([
      api.getTrips(selectedMonth),
      api.getStops(false),
      api.getTasks(),
      api.getReminderNotes()
    ]);
    setTrips(tList || []);
    setStops(sList || []);
    setTasks(tskList || []);
    setNotes(nList || []);
  };

  useEffect(() => {
    loadAll();
    if (!selectedDay.startsWith(selectedMonth)) {
      setSelectedDay(`${selectedMonth}-01`);
    }
  }, [selectedMonth]);

  // Build Calendar Days for selectedMonth ('YYYY-MM')
  const [yearNum, monthNum] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayWeekday = (new Date(yearNum, monthNum - 1, 1).getDay() + 6) % 7; // Monday = 0

  const calendarCells: (string | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
    calendarCells.push(dayStr);
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await api.saveTask({
      title: taskTitle,
      description: taskDesc,
      task_date: selectedDay,
      task_time: taskTime,
      priority: taskPriority,
      status: 'pending'
    });
    setTaskTitle('');
    setTaskDesc('');
    loadAll();
  };

  const handleToggleTask = async (id: string) => {
    await api.toggleTaskStatus(id);
    loadAll();
  };

  const handleDeleteTask = async (id: string) => {
    await api.deleteTask(id);
    loadAll();
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;
    await api.saveReminderNote({
      title: noteTitle,
      content: noteContent,
      remind_date: selectedDay,
      remind_time: '09:30',
      is_completed: 0
    });
    setNoteTitle('');
    setNoteContent('');
    loadAll();
  };

  const handleToggleNote = async (id: string) => {
    await api.toggleReminderNote(id);
    loadAll();
  };

  const handleDeleteNote = async (id: string) => {
    await api.deleteReminderNote(id);
    loadAll();
  };

  // Selected Day Agenda Items
  const dayTrips = trips.filter((t) => t.trip_date === selectedDay);
  const dayDueStops = stops.filter((s) => s.due_date === selectedDay);
  const dayTasks = tasks.filter((t) => t.task_date === selectedDay);
  const dayNotes = notes.filter((n) => n.remind_date === selectedDay);

  return (
    <div className="p-6 space-y-6">
      {/* Legend & Month Info */}
      <div className="nd-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={18} style={{ color: 'var(--accent)' }} />
          <div>
            <h3 className="text-sm font-bold">Aylık Operasyon Takvimi ({selectedMonth})</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Bir güne tıklayarak o günün tüm sevkiyat, tahsilat vadesi ve görev programını aşağıda yönetin
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="px-2.5 py-1 rounded-full nd-badge-blue">● Seferler (Mavi)</span>
          <span className="px-2.5 py-1 rounded-full nd-badge-amber">● Ödeme Vadeleri (Sarı/Amber)</span>
          <span className="px-2.5 py-1 rounded-full nd-badge-purple">● Görevler (Mor)</span>
          <span className="px-2.5 py-1 rounded-full nd-badge-green">● Tamamlanan İşler (Yeşil)</span>
        </div>
      </div>

      {/* Monthly Calendar Grid */}
      <div className="nd-card p-5">
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
          {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((dName) => (
            <div key={dName} className="py-1">
              {dName}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarCells.map((dateStr, idx) => {
            if (!dateStr) {
              return <div key={`empty-${idx}`} className="h-24 rounded-xl opacity-25 nd-layer" />;
            }

            const isSelected = dateStr === selectedDay;
            const cellTrips = trips.filter((t) => t.trip_date === dateStr);
            const cellDues = stops.filter((s) => s.due_date === dateStr && s.payment_status !== 'paid');
            const cellPendingTasks = tasks.filter((t) => t.task_date === dateStr && t.status === 'pending');
            const cellCompleted =
              tasks.filter((t) => t.task_date === dateStr && t.status === 'completed').length +
              stops.filter((s) => s.payment_date === dateStr && s.payment_status === 'paid').length;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(dateStr)}
                className="h-24 p-2 rounded-xl text-left flex flex-col justify-between transition-all border overflow-hidden"
                style={{
                  backgroundColor: isSelected ? 'var(--layer)' : 'var(--surface)',
                  borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                  boxShadow: isSelected ? '0 0 0 2px rgba(55, 104, 157, 0.25)' : 'none'
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className="text-xs font-extrabold tabular-nums"
                    style={{ color: isSelected ? 'var(--accent)' : 'var(--text)' }}
                  >
                    {dateStr.slice(-2)}
                  </span>
                  {dateStr === getCurrentDate() && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded nd-badge-blue">
                      Bugün
                    </span>
                  )}
                </div>

                {/* Color-coded Mini Badges */}
                <div className="space-y-1 w-full">
                  {cellTrips.length > 0 && (
                    <div className="text-[10px] font-bold px-1.5 py-0.5 rounded nd-badge-blue truncate tabular-nums">
                      🚛 {cellTrips.length} Sefer
                    </div>
                  )}
                  {cellDues.length > 0 && (
                    <div className="text-[10px] font-bold px-1.5 py-0.5 rounded nd-badge-amber truncate tabular-nums">
                      💳 {cellDues.length} Vade
                    </div>
                  )}
                  {cellPendingTasks.length > 0 && (
                    <div className="text-[10px] font-bold px-1.5 py-0.5 rounded nd-badge-purple truncate tabular-nums">
                      📌 {cellPendingTasks.length} Görev
                    </div>
                  )}
                  {cellCompleted > 0 && (
                    <div className="text-[10px] font-bold px-1.5 py-0.5 rounded nd-badge-green truncate tabular-nums">
                      ✓ {cellCompleted} Tamamlandı
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Selected Day Agenda & Task / Reminder Note Managers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Selected Day Full Schedule (5 Cols) */}
        <div className="lg:col-span-5 nd-card p-5 space-y-4">
          <div className="pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h4 className="text-sm font-extrabold">
              Seçili Gün Programı: <span className="tabular-nums">{formatDate(selectedDay)}</span>
            </h4>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              O güne ait seferler, tahsilat vadeleri ve görevler
            </p>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1 text-xs">
            {dayTrips.map((t) => (
              <div key={t.id} className="p-3 rounded-xl nd-badge-blue flex items-center justify-between">
                <div>
                  <p className="font-bold">Sefer: {t.trip_no} ({t.vehicle_plate})</p>
                  <p className="text-[11px] opacity-85">{t.origin} → {t.destination}</p>
                </div>
                <b className="tabular-nums">{formatCurrency(t.total_freight)}</b>
              </div>
            ))}

            {dayDueStops.map((s) => (
              <div key={s.id} className="p-3 rounded-xl nd-badge-amber flex items-center justify-between">
                <div>
                  <p className="font-bold">Tahsilat Vadesi: {s.customer_name}</p>
                  <p className="text-[11px] opacity-85">{s.trip_no} • {s.delivered_item}</p>
                </div>
                <b className="tabular-nums">{formatCurrency(Number(s.stop_amount) - Number(s.paid_amount || 0))}</b>
              </div>
            ))}

            {dayTasks.map((tsk) => (
              <div
                key={tsk.id}
                className={`p-3 rounded-xl flex items-center justify-between ${
                  tsk.status === 'completed' ? 'nd-badge-green' : 'nd-badge-purple'
                }`}
              >
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleTask(tsk.id)}>
                    <CheckCircle2 size={15} />
                  </button>
                  <div>
                    <p className={`font-bold ${tsk.status === 'completed' ? 'line-through' : ''}`}>
                      {tsk.title}
                    </p>
                    <p className="text-[11px] opacity-85">{tsk.task_time} • {tsk.description}</p>
                  </div>
                </div>
                <button onClick={() => handleDeleteTask(tsk.id)} className="opacity-75 hover:opacity-100">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {dayTrips.length === 0 && dayDueStops.length === 0 && dayTasks.length === 0 && (
              <div className="nd-layer p-5 text-center" style={{ color: 'var(--text-muted)' }}>
                {formatDate(selectedDay)} günü için kayıtlı etkinlik bulunmuyor. Sağ taraftan görev veya not ekleyebilirsiniz.
              </div>
            )}
          </div>
        </div>

        {/* Tasks & Independent Reminder Notes Manager (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Add Task Card */}
          <div className="nd-card p-5">
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
              <CheckSquare size={16} style={{ color: 'var(--purple)' }} />
              <span>Seçili Güne ({formatDate(selectedDay)}) Yeni Görev Ekle</span>
            </h4>
            <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end text-xs">
              <div className="md:col-span-4">
                <label className="block text-[10px] font-bold mb-1">Görev Başlığı</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Örn: TÜVTÜRK muayene kontrolü..."
                  className="nd-input w-full py-1.5"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[10px] font-bold mb-1">Açıklama</label>
                <input
                  type="text"
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Detay..."
                  className="nd-input w-full py-1.5"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold mb-1">Saat</label>
                <input
                  type="time"
                  value={taskTime}
                  onChange={(e) => setTaskTime(e.target.value)}
                  className="nd-input w-full py-1.5 tabular-nums"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold mb-1">Öncelik</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as any)}
                  className="nd-input w-full py-1.5"
                >
                  <option value="normal">Normal</option>
                  <option value="high">Acil</option>
                  <option value="low">Düşük</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <button type="submit" className="nd-btn-primary w-full py-2 flex items-center justify-center">
                  <Plus size={16} />
                </button>
              </div>
            </form>
          </div>

          {/* Independent Reminder Notes Card */}
          <div className="nd-card p-5">
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
              <StickyNote size={16} style={{ color: 'var(--amber)' }} />
              <span>Bağımsız Hatırlatıcı Notlar ({notes.length})</span>
            </h4>

            <form onSubmit={handleAddNote} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 mb-4 items-end text-xs">
              <div className="md:col-span-4">
                <label className="block text-[10px] font-bold mb-1">Not Başlığı</label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Hatırlatıcı başlığı..."
                  className="nd-input w-full py-1.5"
                />
              </div>
              <div className="md:col-span-6">
                <label className="block text-[10px] font-bold mb-1">Not İçeriği</label>
                <input
                  type="text"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Not detayı..."
                  className="nd-input w-full py-1.5"
                />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="nd-btn-primary w-full py-2 text-xs">
                  + Not Kaydet
                </button>
              </div>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
              {notes.map((n) => (
                <div key={n.id} className="nd-layer p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button onClick={() => handleToggleNote(n.id)}>
                      <CheckCircle2
                        size={16}
                        style={{ color: n.is_completed ? 'var(--green)' : 'var(--text-muted)' }}
                      />
                    </button>
                    <div className="min-w-0">
                      <p className={`font-bold truncate ${n.is_completed ? 'line-through opacity-60' : ''}`}>
                        {n.title}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {n.content} • Tarih: {formatDate(n.remind_date)}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteNote(n.id)} className="p-1.5 rounded-lg nd-badge-red">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
