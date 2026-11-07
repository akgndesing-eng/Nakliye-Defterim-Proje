import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  MapPin,
  Fuel,
  Calculator,
  X,
  FileCheck,
  Truck
} from 'lucide-react';
import { Trip, TripStop, Vehicle, Customer, Driver, TripStatus } from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency, formatDate, getCurrentDate } from '../utils/format';
import { confirmDialog, alertDialog } from '../utils/dialog';

interface TripsModuleProps {
  selectedMonth: string;
  openModalSignal?: number;
  highlightTripId?: string | null;
}

export const TripsModule: React.FC<TripsModuleProps> = ({
  selectedMonth,
  openModalSignal,
  highlightTripId
}) => {
  const [trips, setTrips] = useState<Trip[]>(
    () => getCached<Trip[]>(`trips:${selectedMonth}`) || getCached<Trip[]>('trips:') || []
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getCached<Vehicle[]>('vehicles') || []);
  const [customers, setCustomers] = useState<Customer[]>(() => getCached<Customer[]>('customers') || []);
  const [drivers, setDrivers] = useState<Driver[]>(() => getCached<Driver[]>('drivers') || []);
  const [statusFilter, setStatusFilter] = useState<'all' | TripStatus>('all');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tripNo, setTripNo] = useState('');
  const [tripDate, setTripDate] = useState(getCurrentDate());
  const [vehicleId, setVehicleId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [origin, setOrigin] = useState('TÜPRAŞ İzmit Rafineri');
  const [destination, setDestination] = useState('Edirne Merkez & İstasyonlar');
  const [status, setStatus] = useState<TripStatus>('transit');
  const [fuelCost, setFuelCost] = useState<number>(0);
  const [roadCost, setRoadCost] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);
  const [invoiceStatus, setInvoiceStatus] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [stops, setStops] = useState<Partial<TripStop>[]>([]);

  const loadAll = async () => {
    const [tList, vList, cList, dList] = await Promise.all([
      api.getTrips(selectedMonth),
      api.getVehicles(),
      api.getCustomers(),
      api.getDrivers()
    ]);
    setTrips(tList || []);
    setVehicles(vList || []);
    setCustomers(cList || []);
    setDrivers(dList || []);
  };

  useEffect(() => {
    loadAll();
  }, [selectedMonth]);

  useEffect(() => {
    if (openModalSignal && openModalSignal > 0) {
      openNewTripModal();
    }
  }, [openModalSignal]);

  const openNewTripModal = () => {
    const defaultVeh = vehicles[0];
    const defaultCust = customers[0];
    setEditingId(null);
    setTripNo(`SFR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 899)}`);
    setTripDate(getCurrentDate());
    setVehicleId(defaultVeh?.id || '');
    setDriverName(defaultVeh?.driver_name || drivers[0]?.name || '');
    setOrigin('TÜPRAŞ İzmit Rafineri');
    setDestination('Edirne Merkez');
    setStatus('transit');
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
        quantity: 20000,
        stop_amount: 30000,
        due_date: getCurrentDate(),
        paid_amount: 0,
        payment_status: 'unpaid'
      }
    ]);
    setShowModal(true);
  };

  const openEditTripModal = (trip: Trip) => {
    setEditingId(trip.id);
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
              quantity: 15000,
              stop_amount: trip.total_freight,
              due_date: trip.trip_date,
              paid_amount: 0,
              payment_status: 'unpaid'
            }
          ]
    );
    setShowModal(true);
  };

  const handleVehicleChange = (newVehId: string) => {
    setVehicleId(newVehId);
    const v = vehicles.find((x) => x.id === newVehId);
    if (v && v.driver_name) {
      setDriverName(v.driver_name);
    }
  };

  const handleAddStopRow = () => {
    setStops((prev) => [
      ...prev,
      {
        stop_order: prev.length + 1,
        customer_id: customers[0]?.id || '',
        delivered_item: 'Motorin (EuroDiesel)',
        quantity: 10000,
        stop_amount: 15000,
        due_date: tripDate,
        paid_amount: 0,
        payment_status: 'unpaid'
      }
    ]);
  };

  const handleRemoveStopRow = (index: number) => {
    if (stops.length <= 1) return;
    setStops((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStopFieldChange = (index: number, field: keyof TripStop, value: any) => {
    setStops((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const calculatedTotalFreight = stops.reduce((acc, s) => acc + Number(s.stop_amount || 0), 0);
  const calculatedTotalExpenses = Number(fuelCost || 0) + Number(roadCost || 0) + Number(otherCost || 0);
  const calculatedNetProfit = calculatedTotalFreight - calculatedTotalExpenses;

  const handleSaveTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedVehicleId = vehicleId || vehicles[0]?.id || '';
    if (!resolvedVehicleId) {
      await alertDialog('Lütfen önce Araçlar sekmesinden en az bir araç ekleyin veya araç seçin.', 'Eksik Bilgi');
      return;
    }
    await api.saveTrip({
      id: editingId || undefined,
      trip_no: tripNo,
      trip_date: tripDate,
      vehicle_id: resolvedVehicleId,
      driver_name: driverName,
      origin,
      destination,
      status,
      total_freight: calculatedTotalFreight,
      fuel_cost: Number(fuelCost || 0),
      road_cost: Number(roadCost || 0),
      other_cost: Number(otherCost || 0),
      invoice_status: invoiceStatus,
      notes,
      stops: stops.map((s, idx) => ({
        ...s,
        stop_order: idx + 1,
        customer_id: s.customer_id || customers[0]?.id || ''
      }))
    });
    setShowModal(false);
    loadAll();
  };

  const handleQuickStatusChange = async (tripId: string, nextStatus: TripStatus) => {
    await api.updateTripStatus(tripId, nextStatus);
    loadAll();
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!(await confirmDialog('Bu seferi ve bağlı durak kayıtlarını silmek istediğinize emin misiniz?', 'Sefer Silme Onayı'))) return;
    await api.deleteTrip(tripId);
    loadAll();
  };

  const filteredTrips = trips.filter((t) => (statusFilter === 'all' ? true : t.status === statusFilter));

  const renderStatusBadge = (st: TripStatus) => {
    if (st === 'planned') {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold nd-badge-purple">Planlandı</span>;
    }
    if (st === 'transit') {
      return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold nd-badge-blue">Yolda / Transit</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold nd-badge-green">Teslim Edildi</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Action Bar */}
      <div className="nd-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(['all', 'planned', 'transit', 'delivered'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === st ? 'nd-btn-primary shadow-sm' : 'nd-layer'
              }`}
            >
              {st === 'all'
                ? `Tümü (${trips.length})`
                : st === 'planned'
                ? 'Planlandı (Mor)'
                : st === 'transit'
                ? 'Yolda / Transit (Mavi)'
                : 'Teslim Edildi (Yeşil)'}
            </button>
          ))}
        </div>

        <button
          onClick={openNewTripModal}
          className="nd-btn-primary px-4 py-2 text-xs flex items-center gap-2 shadow-md"
        >
          <Plus size={15} />
          <span>Sefer Ekle</span>
        </button>
      </div>

      {/* Trips List Cards */}
      <div className="space-y-4">
        {filteredTrips.length === 0 ? (
          <div className="nd-card p-10 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Bu dönemde kayıtlı sefer bulunamadı. Sağ üstten yeni sefer oluşturabilirsiniz.
          </div>
        ) : (
          filteredTrips.map((trip) => {
            const tripExpenses =
              Number(trip.fuel_cost || 0) + Number(trip.road_cost || 0) + Number(trip.other_cost || 0);
            const tripProfit = Number(trip.total_freight || 0) - tripExpenses;
            const isHighlighted = highlightTripId === trip.id;

            return (
              <div
                key={trip.id}
                className="nd-card p-5 transition-all"
                style={{
                  borderColor: isHighlighted ? 'var(--accent)' : 'var(--border)'
                }}
              >
                {/* Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <Truck size={19} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-extrabold tabular-nums">{trip.trip_no}</span>
                        {renderStatusBadge(trip.status)}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            trip.invoice_status ? 'nd-badge-green' : 'nd-badge-amber'
                          }`}
                        >
                          {trip.invoice_status ? 'Fatura Kesildi' : 'Fatura Bekliyor'}
                        </span>
                      </div>
                      <p className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>
                        Tarih: <b className="tabular-nums">{formatDate(trip.trip_date)}</b> • Plaka:{' '}
                        <b className="tabular-nums">{trip.vehicle_plate}</b> • Şoför: <b>{trip.driver_name}</b>
                      </p>
                    </div>
                  </div>

                  {/* Quick Status Switch & Actions */}
                  <div className="flex items-center gap-2">
                    <select
                      value={trip.status}
                      onChange={(e) => handleQuickStatusChange(trip.id, e.target.value as TripStatus)}
                      className="nd-input py-1.5 px-2.5 text-xs font-bold"
                    >
                      <option value="planned">Durum: Planlandı</option>
                      <option value="transit">Durum: Yolda / Transit</option>
                      <option value="delivered">Durum: Teslim Edildi</option>
                    </select>
                    <button
                      onClick={() => openEditTripModal(trip)}
                      className="nd-btn-secondary p-2"
                      title="Seferi ve Durakları Düzenle"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTrip(trip.id)}
                      className="p-2 rounded-xl nd-badge-red hover:opacity-80"
                      title="Seferi Sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Route & Profitability Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
                  <div className="lg:col-span-5 nd-layer p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                        Çıkış Noktası (Dolum Tesisi)
                      </span>
                      <p className="text-xs font-bold mt-0.5">{trip.origin}</p>
                    </div>
                    <span className="text-sm font-black px-2" style={{ color: 'var(--accent)' }}>
                      ➔
                    </span>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
                        Varış Güzergâhı
                      </span>
                      <p className="text-xs font-bold mt-0.5">{trip.destination}</p>
                    </div>
                  </div>

                  <div className="lg:col-span-7 grid grid-cols-3 gap-2.5 text-center">
                    <div className="nd-layer p-3">
                      <span className="text-[10px] font-bold block" style={{ color: 'var(--text-muted)' }}>
                        Toplam Navlun
                      </span>
                      <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>
                        {formatCurrency(trip.total_freight)}
                      </span>
                    </div>
                    <div className="nd-layer p-3">
                      <span className="text-[10px] font-bold block" style={{ color: 'var(--text-muted)' }}>
                        Sefer Giderleri (Yakıt/Yol)
                      </span>
                      <span className="text-sm font-extrabold tabular-nums" style={{ color: 'var(--red)' }}>
                        {formatCurrency(tripExpenses)}
                      </span>
                    </div>
                    <div className="nd-layer p-3">
                      <span className="text-[10px] font-bold block" style={{ color: 'var(--text-muted)' }}>
                        Sefer Net Kârlılığı
                      </span>
                      <span
                        className="text-sm font-extrabold tabular-nums"
                        style={{ color: tripProfit >= 0 ? 'var(--green)' : 'var(--red)' }}
                      >
                        {formatCurrency(tripProfit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Multi-Stops Table */}
                <div className="nd-layer p-3">
                  <p className="text-[11px] font-bold mb-2 flex items-center gap-1.5">
                    <MapPin size={13} style={{ color: 'var(--accent)' }} />
                    <span>Sefer Durakları / İstasyon Bırakımları ({trip.stops?.length || 0} Durak)</span>
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b text-[10px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                          <th className="py-1.5 px-2">Sıra</th>
                          <th className="py-1.5 px-2">Müşteri / İstasyon</th>
                          <th className="py-1.5 px-2">Teslim Edilen Ürün</th>
                          <th className="py-1.5 px-2 text-right">Miktar (Lt/Ton)</th>
                          <th className="py-1.5 px-2">Tahsilat Vadesi</th>
                          <th className="py-1.5 px-2 text-right">Durak Navlun</th>
                          <th className="py-1.5 px-2 text-right">Tahsil Edilen</th>
                          <th className="py-1.5 px-2 text-center">Durum</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {(trip.stops || []).map((st) => (
                          <tr key={st.id}>
                            <td className="py-2 px-2 font-bold tabular-nums">#{st.stop_order}</td>
                            <td className="py-2 px-2 font-bold">{st.customer_name || '-'}</td>
                            <td className="py-2 px-2">{st.delivered_item}</td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {Number(st.quantity || 0).toLocaleString('tr-TR')} Lt
                            </td>
                            <td className="py-2 px-2 tabular-nums">{formatDate(st.due_date)}</td>
                            <td className="py-2 px-2 text-right font-bold tabular-nums">
                              {formatCurrency(st.stop_amount)}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums" style={{ color: 'var(--green)' }}>
                              {formatCurrency(st.paid_amount)}
                            </td>
                            <td className="py-2 px-2 text-center">
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
                                  : 'Açık'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT MULTI-STOP TRIP MODAL (Rendered via Portal at document.body) */}
      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            style={{ backgroundColor: 'rgba(10, 16, 14, 0.72)', backdropFilter: 'blur(4px)' }}
          >
            <form
              onSubmit={handleSaveTrip}
              className="nd-modal w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden"
            >
              {/* Sticky Modal Header */}
              <div
                className="px-6 py-4 border-b flex items-center justify-between shrink-0"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                <div>
                  <h3 className="text-base font-bold">
                    {editingId ? 'Sefer ve Durakları Düzenle' : 'Sefer Ekle'}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Çıkış dolum tesisini seçin, ardından + Durak Ekle ile istasyon bırakımlarını ve giderleri girin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-xl nd-layer hover:opacity-80"
                  title="Kapat"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Top Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">Sefer Kodu</label>
                    <input
                      type="text"
                      required
                      value={tripNo}
                      onChange={(e) => setTripNo(e.target.value)}
                      className="nd-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Sefer Tarihi</label>
                    <input
                      type="date"
                      required
                      value={tripDate}
                      onChange={(e) => setTripDate(e.target.value)}
                      className="nd-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Araç / Tanker Plakası</label>
                    <select
                      required
                      value={vehicleId}
                      onChange={(e) => handleVehicleChange(e.target.value)}
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
                    <label className="block text-xs font-bold mb-1">Şoför Adı</label>
                    <input
                      type="text"
                      required
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="nd-input w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold mb-1">Çıkış Noktası (Dolum Tesisi)</label>
                    <input
                      type="text"
                      required
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="Örn: TÜPRAŞ İzmit Rafineri / OPET Marmara Ereğlisi"
                      className="nd-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Varış Güzergâhı</label>
                    <input
                      type="text"
                      required
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Örn: Edirne & Uzunköprü"
                      className="nd-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Sefer Durumu</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as TripStatus)}
                      className="nd-input w-full font-bold"
                    >
                      <option value="planned">Planlandı (Mor)</option>
                      <option value="transit">Yolda / Transit (Mavi)</option>
                      <option value="delivered">Teslim Edildi (Yeşil)</option>
                    </select>
                  </div>
                </div>

                {/* Multi-Stops Builder */}
                <div className="nd-layer p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Çoklu İstasyon / Müşteri Durakları ({stops.length} Durak)
                      </h4>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Her durağa bırakılan ürün tipi, litre/tonaj, durak navlun tutarı ve tahsilat vadesi
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddStopRow}
                      className="nd-btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>+ Durak Ekle</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {stops.map((stop, idx) => (
                      <div
                        key={idx}
                        className="nd-card p-3 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end"
                      >
                        <div className="md:col-span-3">
                          <label className="block text-[10px] font-bold mb-1">
                            #{idx + 1}. Durak Müşteri / İstasyon
                          </label>
                          <select
                            required
                            value={stop.customer_id || ''}
                            onChange={(e) => handleStopFieldChange(idx, 'customer_id', e.target.value)}
                            className="nd-input w-full py-1.5 text-xs"
                          >
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.city})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold mb-1">Ürün Tipi</label>
                          <input
                            type="text"
                            value={stop.delivered_item || ''}
                            onChange={(e) => handleStopFieldChange(idx, 'delivered_item', e.target.value)}
                            placeholder="Motorin / Kurşunsuz"
                            className="nd-input w-full py-1.5 text-xs"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold mb-1">Miktar (Lt/Ton)</label>
                          <input
                            type="number"
                            value={stop.quantity || 0}
                            onChange={(e) => handleStopFieldChange(idx, 'quantity', Number(e.target.value))}
                            className="nd-input w-full py-1.5 text-xs tabular-nums"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold mb-1">Durak Navlun (₺)</label>
                          <input
                            type="number"
                            required
                            value={stop.stop_amount || 0}
                            onChange={(e) => handleStopFieldChange(idx, 'stop_amount', Number(e.target.value))}
                            className="nd-input w-full py-1.5 text-xs font-bold tabular-nums"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold mb-1">Tahsilat Vadesi</label>
                          <input
                            type="date"
                            value={stop.due_date || tripDate}
                            onChange={(e) => handleStopFieldChange(idx, 'due_date', e.target.value)}
                            className="nd-input w-full py-1.5 text-xs tabular-nums"
                          />
                        </div>

                        <div className="md:col-span-1 flex justify-end">
                          <button
                            type="button"
                            disabled={stops.length <= 1}
                            onClick={() => handleRemoveStopRow(idx)}
                            className="p-2 rounded-lg nd-badge-red disabled:opacity-30"
                            title="Durağı Kaldır"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expense & Profitability Calculator */}
                <div className="nd-layer p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Calculator size={16} style={{ color: 'var(--accent)' }} />
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      Sefer Gider & Kârlılık Hesaplayıcı
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 items-end">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">Yakıt Gideri (₺)</label>
                      <input
                        type="number"
                        value={fuelCost}
                        onChange={(e) => setFuelCost(Number(e.target.value))}
                        className="nd-input w-full tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">Otoyol / Köprü (₺)</label>
                      <input
                        type="number"
                        value={roadCost}
                        onChange={(e) => setRoadCost(Number(e.target.value))}
                        className="nd-input w-full tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">Diğer Giderler (₺)</label>
                      <input
                        type="number"
                        value={otherCost}
                        onChange={(e) => setOtherCost(Number(e.target.value))}
                        className="nd-input w-full tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">Fatura Durumu</label>
                      <select
                        value={invoiceStatus}
                        onChange={(e) => setInvoiceStatus(Number(e.target.value))}
                        className="nd-input w-full"
                      >
                        <option value={1}>Fatura Kesildi</option>
                        <option value={0}>Fatura Bekliyor</option>
                      </select>
                    </div>
                    <div className="nd-card p-2.5 text-center">
                      <span className="text-[10px] font-bold block" style={{ color: 'var(--text-muted)' }}>
                        Toplam Navlun
                      </span>
                      <span className="text-xs font-black tabular-nums" style={{ color: 'var(--accent)' }}>
                        {formatCurrency(calculatedTotalFreight)}
                      </span>
                    </div>
                    <div className="nd-card p-2.5 text-center">
                      <span className="text-[10px] font-bold block" style={{ color: 'var(--text-muted)' }}>
                        Net Sefer Kârı
                      </span>
                      <span
                        className="text-xs font-black tabular-nums"
                        style={{ color: calculatedNetProfit >= 0 ? 'var(--green)' : 'var(--red)' }}
                      >
                        {formatCurrency(calculatedNetProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Modal Footer */}
              <div
                className="px-6 py-3.5 border-t flex items-center justify-end gap-2.5 shrink-0"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="nd-btn-secondary px-4 py-2 text-xs"
                >
                  İptal
                </button>
                <button type="submit" className="nd-btn-primary px-5 py-2 text-xs shadow-md">
                  Seferi ve Durakları Kaydet
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
};
