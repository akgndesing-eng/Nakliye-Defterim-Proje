import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Truck,
  Database,
  Wallet,
  Calendar,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import { VillageTanker, VillageTankerLog, Vehicle } from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency, getCurrentDate, getCurrentMonth } from '../utils/format';

const MONTH_NAMES_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık'
];

export const VillageTankersModule: React.FC = () => {
  const [viewMonth, setViewMonth] = useState<string>(getCurrentMonth());
  const [showMonthPicker, setShowMonthPicker] = useState<boolean>(false);
  const [pickerYear, setPickerYear] = useState<number>(() =>
    Number(getCurrentMonth().split('-')[0])
  );

  const [tankers, setTankers] = useState<VillageTanker[]>(
    () => getCached<VillageTanker[]>('villageTankers') || []
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>(
    () => getCached<Vehicle[]>('vehicles') || []
  );
  const [logs, setLogs] = useState<VillageTankerLog[]>(
    () => getCached<VillageTankerLog[]>('villageTankerLogs:all') || []
  );
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Daily Sales Form State
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logDate, setLogDate] = useState<string>(getCurrentDate());
  const [selectedTankerId, setSelectedTankerId] = useState<string>('');
  const [litersInput, setLitersInput] = useState<string>('');
  const [cashInput, setCashInput] = useState<string>('');
  const [cardInput, setCardInput] = useState<string>('');
  const [creditSaleInput, setCreditSaleInput] = useState<string>('');
  const [creditCollectedInput, setCreditCollectedInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const tankerSelectRef = useRef<HTMLSelectElement | null>(null);
  const litersInputRef = useRef<HTMLInputElement | null>(null);

  // Quick Add Village Tanker Modal State
  const [showNewTankerModal, setShowNewTankerModal] = useState<boolean>(false);
  const [newPlate, setNewPlate] = useState<string>('');
  const [newDriver, setNewDriver] = useState<string>('');
  const [newVillage, setNewVillage] = useState<string>('Köy Satış Operasyonu');

  const loadData = async () => {
    const [tList, lList, vList] = await Promise.all([
      api.getVillageTankers(),
      api.getVillageTankerLogs(),
      api.getVehicles()
    ]);
    setTankers(tList || []);
    setLogs(lList || []);
    setVehicles(vList || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Combine registered village tankers + any fleet vehicles not already in village_tankers by plate
  const selectableVehicles = React.useMemo(() => {
    const map = new Map<
      string,
      { id: string; plate: string; driver_name: string; label: string }
    >();

    for (const vt of tankers) {
      const plate = (vt.plate_or_code || vt.name || '').trim();
      const driver = (vt.driver_name || '').trim();
      map.set(vt.id, {
        id: vt.id,
        plate,
        driver_name: driver,
        label: driver ? `${plate} — ${driver}` : plate
      });
    }

    for (const v of vehicles) {
      const cleanPlate = v.plate.replace(/\s+/g, '');
      const alreadyHas = Array.from(map.values()).some(
        (x) => x.plate.replace(/\s+/g, '') === cleanPlate
      );
      if (!alreadyHas) {
        map.set(v.id, {
          id: v.id,
          plate: v.plate,
          driver_name: v.driver_name || '',
          label: v.driver_name ? `${v.plate} — ${v.driver_name}` : v.plate
        });
      }
    }

    return Array.from(map.values());
  }, [tankers, vehicles]);

  // Group all months that have sales records so user can see and pick previous months easily
  const recordedMonthsSummary = React.useMemo(() => {
    const map = new Map<string, { count: number; liters: number; totalSales: number }>();
    for (const l of logs) {
      const m = (l.log_date || '').slice(0, 7);
      if (!m || m.length !== 7) continue;
      const cur = map.get(m) || { count: 0, liters: 0, totalSales: 0 };
      const sale =
        Number(l.cash_amount || 0) +
          Number(l.card_amount || 0) +
          Number(l.credit_sale_amount || 0) || Number(l.amount || 0);
      cur.count += 1;
      cur.liters += Number(l.liters || 0);
      cur.totalSales += sale;
      map.set(m, cur);
    }
    return Array.from(map.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [logs]);

  const parseNum = (val: string): number => {
    if (!val) return 0;
    const normalized = val.replace(',', '.');
    const n = parseFloat(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const showTempFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const resetForm = (focusField = false) => {
    setEditingLogId(null);
    const curMonth = getCurrentMonth();
    setLogDate(viewMonth === curMonth ? getCurrentDate() : `${viewMonth}-01`);
    setSelectedTankerId('');
    setLitersInput('');
    setCashInput('');
    setCardInput('');
    setCreditSaleInput('');
    setCreditCollectedInput('');
    setNoteInput('');
    if (focusField) {
      setTimeout(() => {
        tankerSelectRef.current?.focus();
      }, 50);
    }
  };

  const handleSelectMonth = (nextMonth: string) => {
    setViewMonth(nextMonth);
    const [y] = nextMonth.split('-').map(Number);
    if (y) setPickerYear(y);
    setShowMonthPicker(false);
    if (!editingLogId) {
      const curMonth = getCurrentMonth();
      setLogDate(nextMonth === curMonth ? getCurrentDate() : `${nextMonth}-01`);
    }
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = viewMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    handleSelectMonth(nextYm);
  };

  const handleEditLog = (log: VillageTankerLog) => {
    setEditingLogId(log.id);
    setLogDate(log.log_date || getCurrentDate());
    setSelectedTankerId(log.tanker_id || '');
    setLitersInput(log.liters ? String(log.liters) : '');
    setCashInput(log.cash_amount ? String(log.cash_amount) : '');
    setCardInput(log.card_amount ? String(log.card_amount) : '');
    setCreditSaleInput(log.credit_sale_amount ? String(log.credit_sale_amount) : '');
    setCreditCollectedInput(
      log.credit_collected_amount ? String(log.credit_collected_amount) : ''
    );
    setNoteInput(log.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveCurrentRecord = async () => {
    if (!selectedTankerId) {
      tankerSelectRef.current?.focus();
      window.alert('Lütfen kayıt eklemek için Tanker / Araç seçin.');
      return;
    }

    const chosen = selectableVehicles.find((v) => v.id === selectedTankerId);
    const liters = parseNum(litersInput);
    const cashAmt = parseNum(cashInput);
    const cardAmt = parseNum(cardInput);
    const creditSaleAmt = parseNum(creditSaleInput);
    const creditCollAmt = parseNum(creditCollectedInput);
    const totalSale = cashAmt + cardAmt + creditSaleAmt;

    if (liters <= 0 && totalSale <= 0 && creditCollAmt <= 0 && !noteInput.trim()) {
      litersInputRef.current?.focus();
      window.alert('Lütfen satılan mazot (litre), satış tutarı veya tahsilat bilgisi girin.');
      return;
    }

    const isUpdate = Boolean(editingLogId);

    await api.saveVillageTankerLog({
      id: editingLogId || undefined,
      tanker_id: selectedTankerId,
      tanker_name: chosen?.label || chosen?.plate || 'Köy Tankeri',
      plate_or_code: chosen?.plate || '',
      log_date: logDate || getCurrentDate(),
      operation_type: 'dagitim',
      villager_or_target: 'Günlük Köy Satışı',
      fuel_type: 'Motorin',
      liters,
      amount: totalSale,
      cash_amount: cashAmt,
      card_amount: cardAmt,
      credit_sale_amount: creditSaleAmt,
      credit_collected_amount: creditCollAmt,
      driver_name: chosen?.driver_name || '',
      notes: noteInput.trim()
    });

    if (logDate && logDate.slice(0, 7) !== viewMonth) {
      setViewMonth(logDate.slice(0, 7));
    }

    resetForm(false);
    await loadData();
    showTempFeedback(
      isUpdate ? 'Günlük satış kaydı güncellendi.' : 'Yeni günlük satış kaydı eklendi.'
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCurrentRecord();
  };

  // Top-right "Yeni kayıt" button handler:
  // - If user is editing an existing record and clicks "Yeni kayıt", it switches to a fresh blank form (or saves if new data was entered).
  // - If user entered data in the form and clicks "Yeni kayıt", it saves the record immediately!
  // - If form is empty, it resets & focuses the Tanker/Araç dropdown so user can enter a new record immediately.
  const handleTopNewRecordButton = async () => {
    const hasAnyValue =
      Boolean(selectedTankerId) &&
      (parseNum(litersInput) > 0 ||
        parseNum(cashInput) > 0 ||
        parseNum(cardInput) > 0 ||
        parseNum(creditSaleInput) > 0 ||
        parseNum(creditCollectedInput) > 0 ||
        noteInput.trim().length > 0);

    if (!editingLogId && hasAnyValue) {
      await saveCurrentRecord();
      return;
    }

    resetForm(true);
    showTempFeedback('Yeni kayıt için form hazırlandı.');
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Bu günlük satış kaydını silmek istediğinize emin misiniz?')) return;
    await api.deleteVillageTankerLog(id);
    if (editingLogId === id) resetForm();
    loadData();
  };

  const handleAddTankerVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlate.trim()) return;
    const saved = await api.saveVillageTanker({
      name: newDriver.trim()
        ? `${newPlate.trim().toUpperCase()} — ${newDriver.trim().toUpperCase()}`
        : newPlate.trim().toUpperCase(),
      plate_or_code: newPlate.trim().toUpperCase(),
      village_name: newVillage.trim() || 'Köy Satış Operasyonu',
      capacity_liters: 10000,
      current_fuel_liters: 5000,
      driver_name: newDriver.trim().toUpperCase(),
      driver_phone: '',
      status: 'active',
      notes: ''
    });
    setShowNewTankerModal(false);
    setNewPlate('');
    setNewDriver('');
    await loadData();
    setSelectedTankerId(saved.id);
  };

  // Filter logs by selected month
  const monthLogs = logs.filter((l) => (l.log_date || '').startsWith(viewMonth));

  // Filter month logs by search query
  const filteredMonthLogs = monthLogs.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.plate_or_code || '').toLowerCase().includes(q) ||
      (l.tanker_name || '').toLowerCase().includes(q) ||
      (l.driver_name || '').toLowerCase().includes(q) ||
      (l.notes || '').toLowerCase().includes(q)
    );
  });

  // Top 3 KPI Calculations for Selected Month
  const monthTotalLiters = monthLogs.reduce((acc, l) => acc + Number(l.liters || 0), 0);
  const monthTotalCash = monthLogs.reduce((acc, l) => acc + Number(l.cash_amount || 0), 0);
  const monthTotalCard = monthLogs.reduce((acc, l) => acc + Number(l.card_amount || 0), 0);
  const monthTotalCreditSale = monthLogs.reduce(
    (acc, l) => acc + Number(l.credit_sale_amount || 0),
    0
  );
  const monthTotalCreditCollected = monthLogs.reduce(
    (acc, l) => acc + Number(l.credit_collected_amount || 0),
    0
  );
  const monthTotalSales = monthTotalCash + monthTotalCard + monthTotalCreditSale;
  const monthCreditBalance = monthTotalCreditSale - monthTotalCreditCollected;

  // Live Form Preview Calculations
  const formCash = parseNum(cashInput);
  const formCard = parseNum(cardInput);
  const formCreditSale = parseNum(creditSaleInput);
  const formCreditCollected = parseNum(creditCollectedInput);
  const formDailyTotalSale = formCash + formCard + formCreditSale;
  const formCreditNetChange = formCreditSale - formCreditCollected;

  const formatMonthLabel = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return ym;
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  };

  const formatShortDate = (isoDate: string) => {
    if (!isoDate) return '-';
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* ÜST BAŞLIK VE INTERAKTİF GÖRÜNTÜLENEN AY SEÇİCİ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span
            className="text-[11px] font-bold uppercase tracking-widest block mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            KÖY SATIŞ OPERASYONU
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Tanker Takip</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Köylerde satış yapan küçük tankerlerin günlük litre, satış ve tahsilat hesabı. Nakliye seferlerinden tamamen ayrı tutulur.
          </p>
        </div>

        {/* Sağ Üst: Görüntülenen Ay Seçici (Tıklayınca Tüm Ayları ve Kayıtlı Eski Ayları Açar) */}
        <div className="relative">
          <label
            className="block text-[11px] font-semibold mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Görüntülenen ay
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="nd-card p-2 hover:opacity-80"
              title="Önceki Ay"
            >
              <ChevronLeft size={15} />
            </button>

            <button
              type="button"
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="nd-card px-4 py-2 flex items-center gap-3 text-xs font-bold tabular-nums cursor-pointer min-w-[155px] justify-between"
              style={{
                borderColor: showMonthPicker ? 'var(--accent)' : 'var(--border)'
              }}
            >
              <span>{formatMonthLabel(viewMonth)}</span>
              <Calendar size={14} style={{ color: 'var(--accent)' }} />
            </button>

            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="nd-card p-2 hover:opacity-80"
              title="Sonraki Ay"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          {/* Açılır Ay ve Eski Kayıtlı Dönem Seçici */}
          {showMonthPicker && (
            <div className="nd-modal fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-24 sm:top-auto sm:mt-2 w-auto sm:w-80 p-4 z-50 space-y-4">
              <div
                className="flex items-center justify-between pb-2.5 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-xs font-bold">Ay / Dönem Seçin</span>
                <button
                  type="button"
                  onClick={() => setShowMonthPicker(false)}
                  className="p-1 rounded-lg nd-layer"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Kayıt Bulunan Aylar Hızlı Listesi */}
              {recordedMonthsSummary.length > 0 && (
                <div className="space-y-1.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider block"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Satış Kaydı Bulunan Aylar
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {recordedMonthsSummary.map((item) => {
                      const isSel = item.month === viewMonth;
                      return (
                        <button
                          key={item.month}
                          type="button"
                          onClick={() => handleSelectMonth(item.month)}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all"
                          style={{
                            backgroundColor: isSel ? 'var(--accent)' : 'var(--layer)',
                            color: isSel ? '#ffffff' : 'var(--text)'
                          }}
                        >
                          <div>
                            <span className="font-bold block">
                              {formatMonthLabel(item.month)}
                            </span>
                            <span
                              className="text-[10px] opacity-80 tabular-nums"
                            >
                              {item.count} kayıt · {item.liters.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} L
                            </span>
                          </div>
                          <span className="font-bold tabular-nums text-[11px]">
                            {formatCurrency(item.totalSales)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Yıl ve 12 Ay Seçim Izgarası */}
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setPickerYear((y) => y - 1)}
                    className="nd-layer px-2.5 py-1 text-xs font-bold"
                  >
                    ‹ {pickerYear - 1}
                  </button>
                  <span className="text-xs font-bold tabular-nums">{pickerYear} Yılı</span>
                  <button
                    type="button"
                    onClick={() => setPickerYear((y) => y + 1)}
                    className="nd-layer px-2.5 py-1 text-xs font-bold"
                  >
                    {pickerYear + 1} ›
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_NAMES_TR.map((mName, idx) => {
                    const ym = `${pickerYear}-${String(idx + 1).padStart(2, '0')}`;
                    const isSelected = ym === viewMonth;
                    const hasData = recordedMonthsSummary.some((r) => r.month === ym);
                    return (
                      <button
                        key={ym}
                        type="button"
                        onClick={() => handleSelectMonth(ym)}
                        className="py-2 px-2 rounded-lg text-xs font-semibold relative transition-all"
                        style={{
                          backgroundColor: isSelected ? 'var(--accent)' : 'var(--layer)',
                          color: isSelected ? '#ffffff' : 'var(--text)'
                        }}
                      >
                        <span>{mName}</span>
                        {hasData && !isSelected && (
                          <span
                            className="w-1.5 h-1.5 rounded-full absolute top-1.5 right-1.5"
                            style={{ backgroundColor: 'var(--green)' }}
                            title="Bu ayda satış kaydı var"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ÜSTTEKİ 3 ÖZET KUTUCUĞU */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Kutu: Satılan Yakıt */}
        <div className="nd-card p-5 flex flex-col justify-between min-h-[126px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Satılan yakıt
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center nd-layer"
              style={{ color: 'var(--accent)' }}
            >
              <Truck size={15} />
            </div>
          </div>

          <div className="my-2">
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {monthTotalLiters.toLocaleString('tr-TR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}{' '}
              L
            </p>
          </div>

          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Seçili ay ({formatMonthLabel(viewMonth)})
          </span>
        </div>

        {/* 2. Kutu: Toplam Satış (Nakit + kart + veresiye) */}
        <div className="nd-card p-5 flex flex-col justify-between min-h-[126px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Toplam satış
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center nd-layer"
              style={{ color: 'var(--green)' }}
            >
              <Database size={15} />
            </div>
          </div>

          <div className="my-2">
            <p
              className="text-2xl font-bold tabular-nums tracking-tight"
              style={{ color: 'var(--green)' }}
            >
              {formatCurrency(monthTotalSales)}
            </p>
          </div>

          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Nakit + kart + veresiye
          </span>
        </div>

        {/* 3. Kutu: Veresiye Bakiyesi */}
        <div className="nd-card p-5 flex flex-col justify-between min-h-[126px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
              Veresiye bakiyesi
            </span>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center nd-layer"
              style={{ color: 'var(--champagne)' }}
            >
              <Wallet size={15} />
            </div>
          </div>

          <div className="my-2">
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {formatCurrency(monthCreditBalance)}
            </p>
          </div>

          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Veresiye satış - alınan veresiye ödemesi
          </span>
        </div>
      </div>

      {/* ORTALI BÜYÜK KUTUCUK: GÜNLÜK SATIŞ KAYDI */}
      <form onSubmit={handleFormSubmit} className="nd-card p-6 space-y-5">
        {/* Form Kart Başlığı */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold">
                {editingLogId ? 'Günlük satış kaydını düzenle' : 'Günlük satış kaydı'}
              </h2>
              {feedbackMsg && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full nd-badge-green inline-flex items-center gap-1">
                  <Check size={12} />
                  <span>{feedbackMsg}</span>
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Şoförün gün sonunda bildirdiği rakamları gir.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewTankerModal(true)}
              className="nd-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Plus size={13} />
              <span>Tanker / Araç Tanımla</span>
            </button>

            {editingLogId && (
              <button
                type="button"
                onClick={() => resetForm(true)}
                className="nd-btn-secondary px-3 py-1.5 text-xs"
              >
                Formu Temizle
              </button>
            )}

            <button
              type="button"
              onClick={handleTopNewRecordButton}
              className="nd-btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Yeni kayıt</span>
            </button>
          </div>
        </div>

        {/* Satır 1: Satış tarihi | Tanker / araç | Toplam satılan mazot (litre) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">Satış tarihi</label>
            <input
              type="date"
              required
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="nd-input w-full tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">Tanker / araç</label>
            <select
              ref={tankerSelectRef}
              required
              value={selectedTankerId}
              onChange={(e) => setSelectedTankerId(e.target.value)}
              className="nd-input w-full"
            >
              <option value="">Kayıtlı araç seç</option>
              {selectableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Toplam satılan mazot (litre)
            </label>
            <input
              ref={litersInputRef}
              type="number"
              step="0.01"
              value={litersInput}
              onChange={(e) => setLitersInput(e.target.value)}
              placeholder="Örn. 1250"
              className="nd-input w-full tabular-nums"
            />
          </div>
        </div>

        {/* Satır 2: Nakit Satış (₺) | Kredi Kartı Satış (₺) | Veresiye Satış (₺) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Nakit Satış / Toplanan nakit (₺)
            </label>
            <input
              type="number"
              step="0.01"
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              placeholder="0,00"
              className="nd-input w-full tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Kredi Kartı Satış (₺)
            </label>
            <input
              type="number"
              step="0.01"
              value={cardInput}
              onChange={(e) => setCardInput(e.target.value)}
              placeholder="0,00"
              className="nd-input w-full tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Veresiye Satış (₺)
            </label>
            <input
              type="number"
              step="0.01"
              value={creditSaleInput}
              onChange={(e) => setCreditSaleInput(e.target.value)}
              placeholder="0,00"
              className="nd-input w-full tabular-nums"
            />
          </div>
        </div>

        {/* Satır 3: Alınan Veresiye Ödemeleri (₺) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Alınan Veresiye Ödemeleri (₺)
            </label>
            <input
              type="number"
              step="0.01"
              value={creditCollectedInput}
              onChange={(e) => setCreditCollectedInput(e.target.value)}
              placeholder="0,00"
              className="nd-input w-full tabular-nums"
            />
          </div>
        </div>

        {/* Satır 4: İnce Uzun Not (isteğe bağlı) Kutucuğu */}
        <div>
          <label className="block text-xs font-semibold mb-1.5">Not (isteğe bağlı)</label>
          <input
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Köy, müşteri veya gün sonu notu"
            className="nd-input w-full"
          />
        </div>

        {/* Alt Özet & Kaydetme Çubuğu */}
        <div
          className="pt-4 border-t flex flex-wrap items-center justify-between gap-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex flex-wrap items-center gap-8">
            <div>
              <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>
                Günlük satış toplamı
              </span>
              <b className="text-base font-bold tabular-nums">
                {formatCurrency(formDailyTotalSale)}
              </b>
            </div>

            <div>
              <span className="text-[11px] block" style={{ color: 'var(--text-muted)' }}>
                Veresiye net değişimi
              </span>
              <b className="text-base font-bold tabular-nums">
                {formatCurrency(formCreditNetChange)}
              </b>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {editingLogId && (
              <button
                type="button"
                onClick={() => resetForm(false)}
                className="nd-btn-secondary px-4 py-2 text-xs"
              >
                Vazgeç
              </button>
            )}
            <button type="submit" className="nd-btn-primary px-5 py-2.5 text-xs">
              {editingLogId ? 'Kaydı Güncelle' : 'Günlük Satışı Kaydet'}
            </button>
          </div>
        </div>
      </form>

      {/* ALTTAKİ GÜNLÜK SATIŞ KAYITLARI TABLOSU */}
      <div className="nd-card p-6 space-y-4">
        <div
          className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <h3 className="text-sm font-bold">Günlük satış kayıtları</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {filteredMonthLogs.length} kayıt · {formatMonthLabel(viewMonth)}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 opacity-50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Plaka veya şoför ara"
              className="nd-input w-full pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className="border-b text-[10px] font-bold uppercase tracking-wider"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <th className="py-3 px-2">TARİH</th>
                <th className="py-3 px-2">TANKER / ŞOFÖR</th>
                <th className="py-3 px-2 text-right">LİTRE</th>
                <th className="py-3 px-2 text-right">NAKİT</th>
                <th className="py-3 px-2 text-right">KART</th>
                <th className="py-3 px-2 text-right">VERESİYE SATIŞ</th>
                <th className="py-3 px-2 text-right">VERESİYE TAHSİLAT</th>
                <th className="py-3 px-2 text-right">SATIŞ TOPLAMI</th>
                <th className="py-3 px-2 text-right">İŞLEM</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filteredMonthLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-10 text-center text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {formatMonthLabel(viewMonth)} dönemi için günlük satış kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredMonthLogs.map((row) => {
                  const cash = Number(row.cash_amount || 0);
                  const card = Number(row.card_amount || 0);
                  const credSale = Number(row.credit_sale_amount || 0);
                  const credColl = Number(row.credit_collected_amount || 0);
                  const rowTotal =
                    cash + card + credSale > 0
                      ? cash + card + credSale
                      : Number(row.amount || 0);
                  const displayPlate = (
                    row.plate_or_code ||
                    row.tanker_name?.split('—')[0] ||
                    'TANKER'
                  ).trim();

                  return (
                    <tr key={row.id}>
                      <td
                        className="py-3.5 px-2 whitespace-nowrap tabular-nums"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {formatShortDate(row.log_date)}
                      </td>

                      <td className="py-3.5 px-2">
                        <div className="font-bold text-xs tabular-nums">{displayPlate}</div>
                        {row.driver_name && (
                          <div
                            className="text-[10px] font-semibold uppercase mt-0.5"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {row.driver_name}
                          </div>
                        )}
                        {row.notes && (
                          <div
                            className="text-[10px] uppercase mt-0.5"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {row.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-2 text-right tabular-nums">
                        {Number(row.liters || 0).toLocaleString('tr-TR', {
                          maximumFractionDigits: 2
                        })}
                      </td>

                      <td className="py-3.5 px-2 text-right font-bold tabular-nums">
                        {formatCurrency(cash)}
                      </td>

                      <td className="py-3.5 px-2 text-right font-bold tabular-nums">
                        {formatCurrency(card)}
                      </td>

                      <td className="py-3.5 px-2 text-right font-bold tabular-nums">
                        {formatCurrency(credSale)}
                      </td>

                      <td className="py-3.5 px-2 text-right font-bold tabular-nums">
                        {formatCurrency(credColl)}
                      </td>

                      <td className="py-3.5 px-2 text-right font-bold tabular-nums">
                        {formatCurrency(rowTotal)}
                      </td>

                      <td className="py-3.5 px-2 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditLog(row)}
                            className="text-xs font-semibold hover:underline px-1.5 py-1"
                            style={{ color: 'var(--text)' }}
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(row.id)}
                            className="nd-btn-secondary px-2.5 py-1 text-xs"
                          >
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* YENİ KÖY TANKERİ / ARAÇ TANIMLAMA MODALI */}
      {showNewTankerModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(10, 16, 14, 0.72)', backdropFilter: 'blur(4px)' }}
          >
            <div className="nd-modal w-full max-w-md p-6 space-y-4">
              <div
                className="flex items-center justify-between pb-3 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <h3 className="text-sm font-bold">Yeni Köy Tankeri / Araç Tanımla</h3>
                <button
                  type="button"
                  onClick={() => setShowNewTankerModal(false)}
                  className="p-1.5 rounded-lg nd-layer"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleAddTankerVehicle} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">Tanker Plakası *</label>
                  <input
                    type="text"
                    required
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    placeholder="Örn: 22AED744"
                    className="nd-input w-full tabular-nums uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Şoför Adı Soyadı *</label>
                  <input
                    type="text"
                    required
                    value={newDriver}
                    onChange={(e) => setNewDriver(e.target.value)}
                    placeholder="Örn: SAİT EROL"
                    className="nd-input w-full uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Köy / Bölge (İsteğe bağlı)</label>
                  <input
                    type="text"
                    value={newVillage}
                    onChange={(e) => setNewVillage(e.target.value)}
                    placeholder="Köy Satış Operasyonu"
                    className="nd-input w-full"
                  />
                </div>

                <div
                  className="flex justify-end gap-2 pt-3 border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <button
                    type="button"
                    onClick={() => setShowNewTankerModal(false)}
                    className="nd-btn-secondary px-4 py-2"
                  >
                    İptal
                  </button>
                  <button type="submit" className="nd-btn-primary px-5 py-2">
                    Ekle ve Seç
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
