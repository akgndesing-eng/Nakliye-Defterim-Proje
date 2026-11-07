import React, { useState, useEffect } from 'react';
import {
  CalendarRange,
  Plus,
  CheckCircle2,
  Trash2,
  Truck,
  Wallet,
  StickyNote,
  CheckSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Trip, TripStop, TaskItem, ReminderNote } from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency, formatDate, getCurrentDate } from '../utils/format';

interface CalendarModuleProps {
  selectedMonth: string;
}

export const CalendarModule: React.FC<CalendarModuleProps> = ({ selectedMonth }) => {
  const [calMonth, setCalMonth] = useState<string>(selectedMonth);
  const [trips, setTrips] = useState<Trip[]>(
    () => getCached<Trip[]>(`trips:${selectedMonth}`) || getCached<Trip[]>('trips:') || []
  );
  const [stops, setStops] = useState<TripStop[]>(() => getCached<TripStop[]>('stops:all') || []);
  const [tasks, setTasks] = useState<TaskItem[]>(() => getCached<TaskItem[]>('tasks') || []);
  const [notes, setNotes] = useState<ReminderNote[]>(() => getCached<ReminderNote[]>('notes') || []);
  const [selectedDay, setSelectedDay] = useState<string>(getCurrentDate());

  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState<'task' | 'note'>('task');
  const [quickTime, setQuickTime] = useState('10:00');

  const loadAll = async (targetMonth = calMonth) => {
    const [tList, sList, tskList, nList] = await Promise.all([
      api.getTrips(targetMonth),
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
    setCalMonth(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    loadAll(calMonth);
    if (!selectedDay.startsWith(calMonth)) {
      setSelectedDay(`${calMonth}-01`);
    }
  }, [calMonth]);

  const shiftMonth = (delta: number) => {
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCalMonth(nextYm);
  };

  const [yearNum, monthNum] = calMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayWeekday = (new Date(yearNum, monthNum - 1, 1).getDay() + 6) % 7;

  const calendarCells: (string | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(`${calMonth}-${String(d).padStart(2, '0')}`);
  }

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    if (quickType === 'task') {
      await api.saveTask({
        title: quickTitle,
        description: 'Takvim üzerinden eklendi',
        task_date: selectedDay,
        task_time: quickTime,
        priority: 'normal',
        status: 'pending'
      });
    } else {
      await api.saveReminderNote({
        title: quickTitle,
        content: 'Takvim hatırlatıcısı',
        remind_date: selectedDay,
        remind_time: quickTime,
        is_completed: 0
      });
    }
    setQuickTitle('');
    loadAll(calMonth);
  };

  const dayTrips = trips.filter((t) => t.trip_date === selectedDay);
  const dayDueStops = stops.filter((s) => s.due_date === selectedDay);
  const dayTasks = tasks.filter((t) => t.task_date === selectedDay);
  const dayNotes = notes.filter((n) => n.remind_date === selectedDay);

  return (
    <div className="p-6 space-y-6">
      {/* Top Bar */}
      <div className="nd-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            <CalendarRange size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold">Operasyon & Vade Takvimi ({calMonth})</h3>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Sevkiyat günlerini, müşteri ödeme vadelerini, görevleri ve hatırlatıcıları tek takvimde takip edin
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className="px-2.5 py-1 rounded-full nd-badge-blue">● Seferler</span>
            <span className="px-2.5 py-1 rounded-full nd-badge-amber">● Tahsilat Vadeleri</span>
            <span className="px-2.5 py-1 rounded-full nd-badge-purple">● Görevler</span>
            <span className="px-2.5 py-1 rounded-full nd-badge-green">● Notlar</span>
          </div>

          <div className="flex items-center gap-1 nd-layer p-1 rounded-xl">
            <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:opacity-80">
              <ChevronLeft size={15} />
            </button>
            <input
              type="month"
              value={calMonth}
              onChange={(e) => e.target.value && setCalMonth(e.target.value)}
              className="bg-transparent text-xs font-bold tabular-nums px-2 outline-none"
            />
            <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:opacity-80">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Grid (8 Cols) */}
        <div className="lg:col-span-8 nd-card p-3 sm:p-5">
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
            {[
              { full: 'Pazartesi', short: 'Pzt' },
              { full: 'Salı', short: 'Sal' },
              { full: 'Çarşamba', short: 'Çar' },
              { full: 'Perşembe', short: 'Per' },
              { full: 'Cuma', short: 'Cum' },
              { full: 'Cumartesi', short: 'Cmt' },
              { full: 'Pazar', short: 'Paz' }
            ].map((dName) => (
              <div key={dName.full} className="py-1 truncate">
                <span className="hidden sm:inline">{dName.full}</span>
                <span className="sm:hidden">{dName.short}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarCells.map((dateStr, idx) => {
              if (!dateStr) {
                return <div key={`empty-${idx}`} className="h-16 sm:h-24 rounded-xl opacity-25 nd-layer" />;
              }

              const isSelected = dateStr === selectedDay;
              const cellTrips = trips.filter((t) => t.trip_date === dateStr);
              const cellDues = stops.filter((s) => s.due_date === dateStr && s.payment_status !== 'paid');
              const cellTasks = tasks.filter((t) => t.task_date === dateStr);
              const cellNotes = notes.filter((n) => n.remind_date === dateStr);

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDay(dateStr)}
                  className="h-16 sm:h-24 p-1.5 sm:p-2 rounded-xl text-left flex flex-col justify-between transition-all border overflow-hidden"
                  style={{
                    backgroundColor: isSelected ? 'var(--layer)' : 'var(--surface)',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    boxShadow: isSelected ? '0 0 0 2px var(--accent-subtle)' : 'none'
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className="text-xs font-bold tabular-nums"
                      style={{ color: isSelected ? 'var(--accent)' : 'var(--text)' }}
                    >
                      {dateStr.slice(-2)}
                    </span>
                    {dateStr === getCurrentDate() && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded nd-badge-green">
                        Bugün
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 w-full">
                    {cellTrips.length > 0 && (
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded nd-badge-blue truncate tabular-nums">
                        {cellTrips.length} Sefer
                      </div>
                    )}
                    {cellDues.length > 0 && (
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded nd-badge-amber truncate tabular-nums">
                        {cellDues.length} Vade
                      </div>
                    )}
                    {cellTasks.length > 0 && (
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded nd-badge-purple truncate tabular-nums">
                        {cellTasks.length} Görev
                      </div>
                    )}
                    {cellNotes.length > 0 && (
                      <div className="text-[10px] font-bold px-1.5 py-0.5 rounded nd-badge-green truncate tabular-nums">
                        {cellNotes.length} Not
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda & Quick Add (4 Cols) */}
        <div className="lg:col-span-4 nd-card p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h4 className="text-sm font-bold">
                Seçili Gün: <span className="tabular-nums">{formatDate(selectedDay)}</span>
              </h4>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                O güne kayıtlı seferler, ödeme vadeleri, görevler ve hatırlatıcılar
              </p>
            </div>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 text-xs">
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
                <div key={tsk.id} className="p-3 rounded-xl nd-badge-purple flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        await api.toggleTaskStatus(tsk.id);
                        loadAll(calMonth);
                      }}
                    >
                      <CheckCircle2 size={15} />
                    </button>
                    <div>
                      <p className={`font-bold ${tsk.status === 'completed' ? 'line-through' : ''}`}>
                        Görev: {tsk.title}
                      </p>
                      <p className="text-[11px] opacity-85">{tsk.task_time} • {tsk.description}</p>
                    </div>
                  </div>
                </div>
              ))}

              {dayNotes.map((n) => (
                <div key={n.id} className="p-3 rounded-xl nd-badge-green flex items-center justify-between">
                  <div>
                    <p className={`font-bold ${n.is_completed ? 'line-through' : ''}`}>Not: {n.title}</p>
                    <p className="text-[11px] opacity-85">{n.content}</p>
                  </div>
                </div>
              ))}

              {dayTrips.length === 0 &&
                dayDueStops.length === 0 &&
                dayTasks.length === 0 &&
                dayNotes.length === 0 && (
                  <div className="nd-layer p-6 text-center" style={{ color: 'var(--text-muted)' }}>
                    {formatDate(selectedDay)} günü için kayıtlı etkinlik yok.
                  </div>
                )}
            </div>
          </div>

          <form onSubmit={handleQuickAdd} className="pt-3 border-t space-y-2.5 text-xs" style={{ borderColor: 'var(--border)' }}>
            <label className="block font-bold">
              {formatDate(selectedDay)} Gününe Hızlı Ekle
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={quickType}
                onChange={(e) => setQuickType(e.target.value as 'task' | 'note')}
                className="nd-input py-1.5"
              >
                <option value="task">Görev Ekle</option>
                <option value="note">Hatırlatıcı Not Ekle</option>
              </select>
              <input
                type="time"
                value={quickTime}
                onChange={(e) => setQuickTime(e.target.value)}
                className="nd-input py-1.5 tabular-nums"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="Başlık yazın..."
                className="nd-input flex-1 py-1.5"
              />
              <button type="submit" className="nd-btn-primary px-3.5 py-1.5 flex items-center gap-1">
                <Plus size={14} />
                <span>Ekle</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
