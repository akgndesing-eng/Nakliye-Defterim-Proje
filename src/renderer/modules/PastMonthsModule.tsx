import React, { useState, useEffect } from 'react';
import {
  History,
  Plus,
  Edit3,
  Trash2,
  Truck,
  Wrench,
  Calendar,
  CheckCircle2,
  X,
  TrendingUp,
  Wallet,
  Fuel
} from 'lucide-react';
import {
  MonthlyReportSummary,
  Trip,
  TripStop,
  Vehicle,
  VehicleExpense,
  Customer,
  Driver,
  TripStatus
} from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency, formatDate, getCurrentMonth } from '../utils/format';
import { confirmDialog, alertDialog } from '../utils/dialog';

export const PastMonthsModule: React.FC = () => {
  const currentMonth = getCurrentMonth();

  const [reports, setReports] = useState<MonthlyReportSummary[]>(
    () => getCached<MonthlyReportSummary[]>('reports') || []
  );
  const [archiveMonth, setArchiveMonth] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });

  const [trips, setTrips] = useState<Trip[]>([]);
  const [expenses, setExpenses] = useState<VehicleExpense[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getCached<Vehicle[]>('vehicles') || []);
  const [customers, setCustomers] = useState<Customer[]>(() => getCached<Customer[]>('customers') || []);
  const [drivers, setDrivers] = useState<Driver[]>(() => getCached<Driver[]>('drivers') || []);
  const [activeSubTab, setActiveSubTab] = useState<'trips' | 'expenses'>('trips');

  // Trip Edit/Create Modal State
  const [showTripModal, setShowTripModal] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [tripNo, setTripNo] = useState('');
  const [tripDate, setTripDate] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [status, setStatus] = useState<TripStatus>('delivered');
  const [fuelCost, setFuelCost] = useState<number>(0);
  const [roadCost, setRoadCost] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);
  const [invoiceStatus, setInvoiceStatus] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [stops, setStops] = useState<Partial<TripStop>[]>([]);

  // Vehicle Expense Edit/Create Modal State
  const [showExpModal, setShowExpModal] = useState(false);
  const [editingExp, setEditingExp] = useState<Partial<VehicleExpense>>({});

  const loadArchiveData = async (targetMonth = archiveMonth) => {
    const [repList, tList, eList, vList, cList, dList] = await Promise.all([
      api.getMonthlyReports(),
      api.getTrips(targetMonth),
      api.getVehicleExpenses({ month: targetMonth }),
      api.getVehicles(),
      api.getCustomers(),
      api.getDrivers()
    ]);

    setReports(repList || []);
    setTrips(tList || []);
    setExpenses(eList || []);
    setVehicles(vList || []);
    setCustomers(cList || []);
    setDrivers(dList || []);
  };

  useEffect(() => {
    loadArchiveData(archiveMonth);
  }, [archiveMonth]);

  // Past months list (prioritizing months < currentMonth, plus any month in reports)
  const pastReports = reports.filter((r) => r.month < currentMonth);
  const allAvailableMonths = Array.from(
    new Set([archiveMonth, ...reports.map((r) => r.month)])
  ).sort((a, b) => b.localeCompare(a));

  const formatMonthTitle = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    if (!y || !m) return ym;
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  };

  // Calculate live summary for selected archiveMonth (Vehicle extra expenses are isolated to Araçlar screen)
  const monthFreight = trips.reduce((acc, t) => acc + Number(t.total_freight || 0), 0);
  const monthTripExpenses = trips.reduce(
    (acc, t) => acc + Number(t.fuel_cost || 0) + Number(t.road_cost || 0) + Number(t.other_cost || 0),
    0
  );
  const monthVehicleExpenses = 0;
  const monthCollected = trips.reduce(
    (acc, t) =>
      acc + (t.stops || []).reduce((sAcc, s) => sAcc + Number(s.paid_amount || 0), 0),
    0
  );
  const monthRemaining = Math.max(0, monthFreight - monthCollected);
  const monthNetProfit = monthFreight - monthTripExpenses;

  // ==========================================
  // TRIP ADD / EDIT HANDLERS FOR PAST MONTH
  // ==========================================
  const openNewPastTripModal = () => {
    const defaultVeh = vehicles[0];
    const defaultCust = customers[0];
    const defaultDate = `${archiveMonth}-15`;
    setEditingTripId(null);
    setTripNo(`SFR-${archiveMonth.replace('-', '')}-${Math.floor(100 + Math.random() * 899)}`);
    setTripDate(defaultDate);
    setVehicleId(defaultVeh?.id || '');
    setDriverName(defaultVeh?.driver_name || drivers[0]?.name || '');
    setOrigin('TÜPRAŞ İzmit Rafineri');
    setDestination('Edirne Merkez & İstasyonlar');
    setStatus('delivered');
    setFuelCost(0);
    setRoadCost(0);
    setOtherCost(0);
    setInvoiceStatus(1);
    setNotes('');
    setStops([
      {
        stop_order: 1,
        customer_id: defaultCust?.id || '',
        delivered_item: 'Motorin (EuroDiesel)',
        quantity: 22000,
        stop_amount: 34000,
        due_date: defaultDate,
        paid_amount: 34000,
        payment_status: 'paid'
      }
    ]);
    setShowTripModal(true);
  };

  const openEditPastTripModal = (trip: Trip) => {
    setEditingTripId(trip.id);
    setTripNo(trip.trip_no);
    setTripDate(trip.trip_date);
    setVehicleId(trip.vehicle_id);
    setDriverName(trip.driver_name);
    setOrigin(trip.origin);
    setDestination(trip.destination);
    setStatus(trip.status);
    setFuelCost(Number(trip.fuel_cost || 0));
    setRoadCost(Number(trip.road_cost || 0));
    setOtherCost(Number(trip.other_cost || 0));
    setInvoiceStatus(trip.invoice_status ? 1 : 0);
    setNotes(trip.notes || '');
    setStops(
      trip.stops && trip.stops.length > 0
        ? trip.stops.map((s) => ({ ...s }))
        : [
            {
              stop_order: 1,
              customer_id: customers[0]?.id || '',
              delivered_item: 'Motorin',
              quantity: 20000,
              stop_amount: Number(trip.total_freight || 0),
              due_date: trip.trip_date,
              paid_amount: 0,
              payment_status: 'unpaid'
            }
          ]
    );
    setShowTripModal(true);
  };

  const handleSavePastTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedVehicleId = vehicleId || vehicles[0]?.id || '';
    if (!resolvedVehicleId) {
      await alertDialog('Lütfen önce Araçlar sekmesinden en az bir araç ekleyin veya araç seçin.', 'Eksik Bilgi');
      return;
    }
    if (stops.length === 0) {
      await alertDialog('Lütfen sefere en az 1 durak ekleyin.', 'Eksik Bilgi');
      return;
    }
    await api.saveTrip({
      id: editingTripId || undefined,
      trip_no: tripNo,
      trip_date: tripDate,
      vehicle_id: resolvedVehicleId,
      driver_name: driverName,
      origin,
      destination,
      status,
      fuel_cost: Number(fuelCost || 0),
      road_cost: Number(roadCost || 0),
      other_cost: Number(otherCost || 0),
      invoice_status: invoiceStatus,
      notes,
      stops: stops.map((s, idx) => ({
        ...s,
        stop_order: idx + 1,
        customer_id: s.customer_id || customers[0]?.id || '',
        quantity: Number(s.quantity || 0),
        stop_amount: Number(s.stop_amount || 0),
        paid_amount: Number(s.paid_amount || 0)
      }))
    });
    setShowTripModal(false);
    loadArchiveData(archiveMonth);
  };

  const handleDeletePastTrip = async (id: string) => {
    if (!(await confirmDialog('Geçmiş aya ait bu seferi ve duraklarını silmek istediğinize emin misiniz?', 'Sefer Silme Onayı'))) {
      return;
    }
    await api.deleteTrip(id);
    loadArchiveData(archiveMonth);
  };

  // ==========================================
  // VEHICLE EXPENSE ADD / EDIT HANDLERS
  // ==========================================
  const openNewExpModal = () => {
    setEditingExp({
      vehicle_id: vehicles[0]?.id || '',
      expense_date: `${archiveMonth}-10`,
      expense_month: archiveMonth,
      title: '',
      amount: 0
    });
    setShowExpModal(true);
  };

  const openEditExpModal = (exp: VehicleExpense) => {
    setEditingExp({ ...exp });
    setShowExpModal(true);
  };

  const handleSaveExp = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedVehId = editingExp.vehicle_id || vehicles[0]?.id || '';
    if (!resolvedVehId || !editingExp.title?.trim()) {
      await alertDialog('Lütfen araç seçin ve gider başlığını girin.', 'Eksik Bilgi');
      return;
    }
    const expDate = editingExp.expense_date || `${archiveMonth}-10`;
    await api.saveVehicleExpense({
      ...editingExp,
      vehicle_id: resolvedVehId,
      expense_date: expDate,
      expense_month: expDate.slice(0, 7),
      amount: Number(editingExp.amount || 0)
    });
    setShowExpModal(false);
    loadArchiveData(archiveMonth);
  };

  const handleDeleteExp = async (id: string) => {
    if (!(await confirmDialog('Geçmiş aya ait bu araç gider kaydını silmek istediğinize emin misiniz?', 'Gider Silme Onayı'))) return;
    await api.deleteVehicleExpense(id);
    loadArchiveData(archiveMonth);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Üst Bilgi & Ay Seçici Kartı */}
      <div className="nd-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--accent-subtle)', color: 'var(--accent)' }}
          >
            <History size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold">
              Geçmiş Aylar Arşivi & Düzenleme Merkezi
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Tamamlanan ayların tüm sefer, durak, tahsilat ve araç gider verileri otomatik olarak burada arşivlenir. İstediğiniz eski ayı seçip verileri görüntüleyebilir ve düzenleyebilirsiniz.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <label className="font-semibold" style={{ color: 'var(--text-muted)' }}>
            Dönem Seçin:
          </label>
          <input
            type="month"
            value={archiveMonth}
            onChange={(e) => e.target.value && setArchiveMonth(e.target.value)}
            className="nd-input py-1.5 px-3 font-bold tabular-nums"
          />
          <button
            onClick={openNewPastTripModal}
            className="nd-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5"
          >
            <Plus size={14} />
            <span>+ Seçili Aya Sefer Ekle</span>
          </button>
          <button
            onClick={openNewExpModal}
            className="nd-btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5"
          >
            <Wrench size={14} />
            <span>+ Araç Gideri Ekle</span>
          </button>
        </div>
      </div>

      {/* Arşivlenen Aylar Hızlı Seçim Şeridi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
        {(pastReports.length > 0 ? pastReports : reports).map((rep) => {
          const isSelected = rep.month === archiveMonth;
          const isPast = rep.month < currentMonth;
          return (
            <button
              key={rep.month}
              onClick={() => setArchiveMonth(rep.month)}
              className="nd-card p-4 text-left transition-all"
              style={{
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                boxShadow: isSelected ? '0 0 0 2px var(--accent-subtle)' : undefined
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">{formatMonthTitle(rep.month)}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isPast ? 'nd-badge-amber' : 'nd-badge-green'
                  }`}
                >
                  {isPast ? 'Geçmiş Ay' : 'Bu Ay'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {rep.tripCount} Sefer • {rep.stopCount} Durak
                </span>
                <b className="text-xs font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                  {formatCurrency(rep.totalRevenue)}
                </b>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <span>Net Bilanço:</span>
                <b
                  className="tabular-nums"
                  style={{ color: rep.netOperatingProfit >= 0 ? 'var(--green)' : 'var(--red)' }}
                >
                  {formatCurrency(rep.netOperatingProfit)}
                </b>
              </div>
            </button>
          );
        })}
      </div>

      {/* Seçili Ayın Finansal Özeti */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="nd-card p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {formatMonthTitle(archiveMonth)} — Toplam Ciro
          </span>
          <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--accent)' }}>
            {formatCurrency(monthFreight)}
          </p>
          <span className="text-[11px] mt-1 block" style={{ color: 'var(--text-muted)' }}>
            {trips.length} Sefer • {trips.reduce((a, t) => a + (t.stops?.length || 0), 0)} Durak
          </span>
        </div>

        <div className="nd-card p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Tahsil Edilen / Kalan
          </span>
          <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--green)' }}>
            {formatCurrency(monthCollected)}
          </p>
          <span className="text-[11px] mt-1 block" style={{ color: 'var(--amber)' }}>
            Kalan Alacak: <b className="tabular-nums">{formatCurrency(monthRemaining)}</b>
          </span>
        </div>

        <div className="nd-card p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Toplam Ay Giderleri
          </span>
          <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: 'var(--red)' }}>
            {formatCurrency(monthTripExpenses + monthVehicleExpenses)}
          </p>
          <span className="text-[11px] mt-1 block" style={{ color: 'var(--text-muted)' }}>
            Sefer: {formatCurrency(monthTripExpenses)} • Araç: {formatCurrency(monthVehicleExpenses)}
          </span>
        </div>

        <div className="nd-card p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Ay Sonu Net Kâr
          </span>
          <p
            className="text-2xl font-bold mt-1 tabular-nums"
            style={{ color: monthNetProfit >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {formatCurrency(monthNetProfit)}
          </p>
          <span className="text-[11px] mt-1 block" style={{ color: 'var(--text-muted)' }}>
            Tüm değişiklikler anında bilançoya yansır
          </span>
        </div>
      </div>

      {/* Seçili Ayın Detay Sekmeleri (Seferler vs Araç Ek Giderleri) */}
      <div className="nd-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('trips')}
              className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
              style={{
                backgroundColor: activeSubTab === 'trips' ? 'var(--accent)' : 'var(--layer)',
                color: activeSubTab === 'trips' ? '#ffffff' : 'var(--text)'
              }}
            >
              <Truck size={15} />
              <span>{formatMonthTitle(archiveMonth)} Seferleri & Durakları ({trips.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('expenses')}
              className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
              style={{
                backgroundColor: activeSubTab === 'expenses' ? 'var(--accent)' : 'var(--layer)',
                color: activeSubTab === 'expenses' ? '#ffffff' : 'var(--text)'
              }}
            >
              <Wrench size={15} />
              <span>{formatMonthTitle(archiveMonth)} Araç Ek Giderleri ({expenses.length})</span>
            </button>
          </div>

          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            İstediğiniz kaydın sağındaki <b>Düzenle</b> butonuna tıklayarak geçmiş ay verilerini değiştirebilirsiniz.
          </span>
        </div>

        {activeSubTab === 'trips' ? (
          <div className="space-y-4">
            {trips.length === 0 ? (
              <div className="nd-layer p-8 text-center space-y-3">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatMonthTitle(archiveMonth)} dönemi için kayıtlı sefer bulunmuyor.
                </p>
                <button onClick={openNewPastTripModal} className="nd-btn-primary px-4 py-2 text-xs">
                  + {formatMonthTitle(archiveMonth)} Dönemine Sefer Ekle
                </button>
              </div>
            ) : (
              trips.map((trip) => (
                <div key={trip.id} className="nd-layer p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums">{trip.trip_no}</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                          • {formatDate(trip.trip_date)}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full nd-badge-blue tabular-nums">
                          {trip.vehicle_plate}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Şoför: <b>{trip.driver_name}</b>
                        </span>
                      </div>
                      <p className="text-xs font-bold mt-1">
                        {trip.origin} → {trip.destination}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right text-xs">
                        <span style={{ color: 'var(--text-muted)' }}>Navlun: </span>
                        <b className="tabular-nums" style={{ color: 'var(--accent)' }}>
                          {formatCurrency(trip.total_freight)}
                        </b>
                        <span className="mx-2 opacity-30">|</span>
                        <span style={{ color: 'var(--text-muted)' }}>Gider: </span>
                        <b className="tabular-nums" style={{ color: 'var(--red)' }}>
                          {formatCurrency(
                            Number(trip.fuel_cost || 0) +
                              Number(trip.road_cost || 0) +
                              Number(trip.other_cost || 0)
                          )}
                        </b>
                      </div>

                      <button
                        onClick={() => openEditPastTripModal(trip)}
                        className="nd-btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                      >
                        <Edit3 size={13} />
                        <span>Seferi & Durakları Düzenle</span>
                      </button>

                      <button
                        onClick={() => handleDeletePastTrip(trip.id)}
                        className="p-2 rounded-lg nd-badge-red"
                        title="Seferi Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Duraklar Tablosu */}
                  {trip.stops && trip.stops.length > 0 && (
                    <div className="overflow-x-auto pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            <th className="py-1 px-2">#</th>
                            <th className="py-1 px-2">Müşteri / İstasyon</th>
                            <th className="py-1 px-2">Teslim Edilen Ürün</th>
                            <th className="py-1 px-2 text-right">Miktar</th>
                            <th className="py-1 px-2 text-right">Durak Navlun</th>
                            <th className="py-1 px-2 text-right">Tahsil Edilen</th>
                            <th className="py-1 px-2 text-center">Durum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trip.stops.map((st) => (
                            <tr key={st.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                              <td className="py-1.5 px-2 tabular-nums">{st.stop_order}</td>
                              <td className="py-1.5 px-2 font-semibold">{st.customer_name}</td>
                              <td className="py-1.5 px-2">{st.delivered_item}</td>
                              <td className="py-1.5 px-2 text-right tabular-nums">
                                {Number(st.quantity || 0).toLocaleString('tr-TR')} Lt
                              </td>
                              <td className="py-1.5 px-2 text-right font-bold tabular-nums">
                                {formatCurrency(st.stop_amount)}
                              </td>
                              <td className="py-1.5 px-2 text-right font-semibold tabular-nums" style={{ color: 'var(--green)' }}>
                                {formatCurrency(st.paid_amount)}
                              </td>
                              <td className="py-1.5 px-2 text-center">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    st.payment_status === 'paid'
                                      ? 'nd-badge-green'
                                      : st.payment_status === 'partial'
                                      ? 'nd-badge-amber'
                                      : 'nd-badge-red'
                                  }`}
                                >
                                  {st.payment_status === 'paid'
                                    ? 'Ödendi'
                                    : st.payment_status === 'partial'
                                    ? 'Kısmi'
                                    : 'Bekliyor'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <th className="py-2.5 px-2">Tarih</th>
                  <th className="py-2.5 px-2">Araç Plakası</th>
                  <th className="py-2.5 px-2">Gider / Masraf Açıklaması</th>
                  <th className="py-2.5 px-2 text-right">Tutar</th>
                  <th className="py-2.5 px-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatMonthTitle(archiveMonth)} dönemi için araç ek gideri bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="py-3 px-2 tabular-nums font-semibold">{formatDate(exp.expense_date)}</td>
                      <td className="py-3 px-2 font-bold tabular-nums">{exp.vehicle_plate}</td>
                      <td className="py-3 px-2 font-semibold">{exp.title}</td>
                      <td className="py-3 px-2 text-right font-bold tabular-nums" style={{ color: 'var(--red)' }}>
                        {formatCurrency(exp.amount)}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openEditExpModal(exp)}
                            className="nd-btn-secondary px-2.5 py-1 text-xs flex items-center gap-1"
                          >
                            <Edit3 size={12} />
                            <span>Düzenle</span>
                          </button>
                          <button
                            onClick={() => handleDeleteExp(exp.id)}
                            className="p-1.5 rounded-lg nd-badge-red"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GEÇMİŞ AY SEFER & DURAK DÜZENLEME MODALI */}
      {showTripModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backgroundColor: 'rgba(10, 14, 13, 0.68)', backdropFilter: 'blur(4px)' }}
        >
          <div className="nd-card w-full max-w-4xl p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-base font-bold">
                {editingTripId ? 'Geçmiş Ay Seferini & Duraklarını Düzenle' : `${formatMonthTitle(archiveMonth)} Dönemine Sefer Ekle`}
              </h3>
              <button onClick={() => setShowTripModal(false)} className="p-1 rounded-lg hover:opacity-75">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePastTrip} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Sefer Kodu</label>
                  <input
                    type="text"
                    required
                    value={tripNo}
                    onChange={(e) => setTripNo(e.target.value)}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Sefer Tarihi</label>
                  <input
                    type="date"
                    required
                    value={tripDate}
                    onChange={(e) => setTripDate(e.target.value)}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tanker / Araç</label>
                  <select
                    required
                    value={vehicleId}
                    onChange={(e) => {
                      const v = vehicles.find((x) => x.id === e.target.value);
                      setVehicleId(e.target.value);
                      if (v?.driver_name) setDriverName(v.driver_name);
                    }}
                    className="nd-input w-full"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate} ({v.driver_name})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Şoför</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="nd-input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Çıkış / Dolum Tesisi</label>
                  <input
                    type="text"
                    required
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="nd-input w-full"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Varış Güzergâhı</label>
                  <input
                    type="text"
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="nd-input w-full"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Sevkiyat Durumu</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TripStatus)}
                    className="nd-input w-full"
                  >
                    <option value="delivered">Teslim Edildi</option>
                    <option value="transit">Yolda / Transit</option>
                    <option value="planned">Planlandı</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 nd-layer p-3">
                <div>
                  <label className="block font-semibold mb-1">Mazot / Yakıt Gideri (₺)</label>
                  <input
                    type="number"
                    value={fuelCost}
                    onChange={(e) => setFuelCost(Number(e.target.value))}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Yol / HGS / Köprü Gideri (₺)</label>
                  <input
                    type="number"
                    value={roadCost}
                    onChange={(e) => setRoadCost(Number(e.target.value))}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Diğer Sefer Gideri (₺)</label>
                  <input
                    type="number"
                    value={otherCost}
                    onChange={(e) => setOtherCost(Number(e.target.value))}
                    className="nd-input w-full tabular-nums"
                  />
                </div>
              </div>

              {/* Duraklar Düzenleme Alanı */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-xs">İstasyon / Müşteri Durakları ve Tahsilat Durumu</label>
                  <button
                    type="button"
                    onClick={() =>
                      setStops([
                        ...stops,
                        {
                          stop_order: stops.length + 1,
                          customer_id: customers[0]?.id || '',
                          delivered_item: 'Motorin',
                          quantity: 15000,
                          stop_amount: 25000,
                          due_date: tripDate,
                          paid_amount: 25000,
                          payment_status: 'paid'
                        }
                      ])
                    }
                    className="nd-btn-secondary px-3 py-1 text-xs"
                  >
                    + Durak Ekle
                  </button>
                </div>

                {stops.map((st, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 nd-layer p-3 items-end">
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-semibold mb-1">Müşteri / İstasyon</label>
                      <select
                        value={st.customer_id || ''}
                        onChange={(e) => {
                          const next = [...stops];
                          next[idx] = { ...next[idx], customer_id: e.target.value };
                          setStops(next);
                        }}
                        className="nd-input w-full py-1.5"
                      >
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold mb-1">Ürün</label>
                      <input
                        type="text"
                        value={st.delivered_item || ''}
                        onChange={(e) => {
                          const next = [...stops];
                          next[idx] = { ...next[idx], delivered_item: e.target.value };
                          setStops(next);
                        }}
                        className="nd-input w-full py-1.5"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold mb-1">Miktar (Lt)</label>
                      <input
                        type="number"
                        value={st.quantity ?? 0}
                        onChange={(e) => {
                          const next = [...stops];
                          next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                          setStops(next);
                        }}
                        className="nd-input w-full py-1.5 tabular-nums"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold mb-1">Navlun Tutarı (₺)</label>
                      <input
                        type="number"
                        value={st.stop_amount ?? 0}
                        onChange={(e) => {
                          const next = [...stops];
                          next[idx] = { ...next[idx], stop_amount: Number(e.target.value) };
                          setStops(next);
                        }}
                        className="nd-input w-full py-1.5 tabular-nums"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-semibold mb-1">Ödenen Tutar (₺)</label>
                      <input
                        type="number"
                        value={st.paid_amount ?? 0}
                        onChange={(e) => {
                          const paidVal = Number(e.target.value);
                          const stopAmt = Number(st.stop_amount || 0);
                          const next = [...stops];
                          next[idx] = {
                            ...next[idx],
                            paid_amount: paidVal,
                            payment_status: paidVal >= stopAmt ? 'paid' : paidVal > 0 ? 'partial' : 'unpaid'
                          };
                          setStops(next);
                        }}
                        className="nd-input w-full py-1.5 tabular-nums"
                      />
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      {stops.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setStops(stops.filter((_, i) => i !== idx))}
                          className="p-2 rounded-lg nd-badge-red"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  className="nd-btn-secondary px-4 py-2"
                >
                  İptal
                </button>
                <button type="submit" className="nd-btn-primary px-5 py-2">
                  Değişiklikleri Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GEÇMİŞ AY ARAÇ GİDERİ EKLE / DÜZENLE MODALI */}
      {showExpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(10, 14, 13, 0.68)', backdropFilter: 'blur(4px)' }}
        >
          <div className="nd-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-base font-bold">
                {editingExp.id ? 'Geçmiş Ay Araç Giderini Düzenle' : 'Geçmiş Aya Araç Gideri Ekle'}
              </h3>
              <button onClick={() => setShowExpModal(false)} className="p-1 rounded-lg hover:opacity-75">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExp} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Araç Seçin</label>
                <select
                  required
                  value={editingExp.vehicle_id || ''}
                  onChange={(e) => setEditingExp({ ...editingExp, vehicle_id: e.target.value })}
                  className="nd-input w-full"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} ({v.driver_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Gider Tarihi</label>
                <input
                  type="date"
                  required
                  value={editingExp.expense_date || `${archiveMonth}-10`}
                  onChange={(e) => setEditingExp({ ...editingExp, expense_date: e.target.value })}
                  className="nd-input w-full tabular-nums"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Gider / Bakım Açıklaması</label>
                <input
                  type="text"
                  required
                  value={editingExp.title || ''}
                  onChange={(e) => setEditingExp({ ...editingExp, title: e.target.value })}
                  placeholder="Örn: Periyodik bakım, kasko taksiti, lastik değişimi..."
                  className="nd-input w-full"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Tutar (₺)</label>
                <input
                  type="number"
                  required
                  value={editingExp.amount ?? 0}
                  onChange={(e) => setEditingExp({ ...editingExp, amount: Number(e.target.value) })}
                  className="nd-input w-full tabular-nums"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setShowExpModal(false)}
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
