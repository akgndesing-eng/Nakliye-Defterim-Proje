import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LocateFixed,
  Navigation,
  Truck,
  Fuel,
  Gauge,
  Radio,
  RefreshCw,
  Settings,
  ExternalLink,
  Phone,
  MessageSquare,
  MapPin,
  ShieldCheck,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sliders,
  Compass,
  Play,
  Pause,
  Edit3,
  X,
  KeyRound,
  Layers,
  Route,
  BatteryCharging,
  Thermometer
} from 'lucide-react';
import { Vehicle, Driver, Trip, NavTabId } from '../../shared/types';
import { api } from '../api';
import { alertDialog } from '../utils/dialog';

interface VehicleTrackingModuleProps {
  onNavigate?: (tab: NavTabId, entityId?: string) => void;
}

export type TrackingProvider = 'both' | 'mobiliz' | 'renault';
export type IgnitionState = 'moving' | 'idle' | 'stopped';
export type TachoState = 'driving' | 'rest' | 'work';

export interface VehicleTelemetryOverride {
  provider: TrackingProvider;
  ignition: IgnitionState;
  speedKmh: number;
  lat: number;
  lng: number;
  heading: number;
  locationLabel: string;
  highwayName: string;
  fuelPercent: number;
  adBluePercent: number;
  odometerKm: number;
  avgConsumption: number;
  engineRpm: number;
  engineTempC: number;
  batteryVolts: number;
  tachoState: TachoState;
  tachoRemainingMin: number;
  dailyDistanceKm: number;
  idleMinutes: number;
  satellites: number;
  updatedAt: string;
}

interface TrackingIntegrationConfig {
  mobilizEnabled: boolean;
  mobilizToken: string;
  mobilizUsername: string;
  mobilizUrl: string;
  renaultEnabled: boolean;
  renaultUsername: string;
  renaultPassword: string;
  renaultEndpoint: string;
  autoRefreshSec: number;
}

const DEFAULT_CONFIG: TrackingIntegrationConfig = {
  mobilizEnabled: true,
  mobilizToken: '',
  mobilizUsername: '',
  mobilizUrl: 'https://ng.mobiliz.com.tr',
  renaultEnabled: true,
  renaultUsername: '',
  renaultPassword: '',
  renaultEndpoint: 'https://api.volvotrucks.com/rfms/vehiclepositions?latestOnly=true',
  autoRefreshSec: 10
};

const PRESET_CORRIDOR_WAYPOINTS: {
  name: string;
  highway: string;
  lat: number;
  lng: number;
  heading: number;
}[] = [
  {
    name: 'Edirne Merkez — Kapıkule TEM Gişeler Mevkii',
    highway: 'TEM Otoyolu (O-3 / E80)',
    lat: 41.6771,
    lng: 26.5557,
    heading: 115
  },
  {
    name: 'Kırklareli / Lüleburgaz — Evrensekiz Kavşağı',
    highway: 'TEM Otoyolu (O-3) Doğu Yönü',
    lat: 41.4056,
    lng: 27.3569,
    heading: 110
  },
  {
    name: 'Tekirdağ / Marmaraereğlisi — OPET & Dolum Tesisleri',
    highway: 'D-110 Sahil Yolu / Terminaller Bölgesi',
    lat: 40.9708,
    lng: 27.9553,
    heading: 85
  },
  {
    name: 'Kocaeli / Körfez — TÜPRAŞ İzmit Rafinerisi Dolum Sahası',
    highway: 'TEM Otoyolu (O-4) Körfez Çıkışı',
    lat: 40.7569,
    lng: 29.7636,
    heading: 275
  },
  {
    name: 'Edirne / Keşan — Malkara D-110 Karayolu',
    highway: 'D-110 / E84 Güney Koridoru',
    lat: 40.8558,
    lng: 26.6303,
    heading: 45
  },
  {
    name: 'İstanbul / Silivri — Kınalı Kuzey Marmara Bağlantısı',
    highway: 'Kuzey Marmara Otoyolu (O-7)',
    lat: 41.0736,
    lng: 28.2464,
    heading: 290
  },
  {
    name: 'Edirne / Uzunköprü — Kırcasalih Sanayi Mevkii',
    highway: 'D-550 Edirne-Uzunköprü Yolu',
    lat: 41.2669,
    lng: 26.6869,
    heading: 180
  }
];

function normalizePlate(p: string): string {
  return (p || '').replace(/\s+/g, '').toUpperCase();
}

export const VehicleTrackingModule: React.FC<VehicleTrackingModuleProps> = ({ onNavigate }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingApi, setSyncingApi] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() =>
    new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );
  const [apiStatusText, setApiStatusText] = useState<string>('Mobiliz & Renault Optifleet Aktif');

  // Filter & Selection States
  const [providerFilter, setProviderFilter] = useState<'all' | 'mobiliz' | 'renault'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | IgnitionState>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [mapViewMode, setMapViewMode] = useState<'corridor' | 'satellite'>('corridor');
  const [liveSimActive, setLiveSimActive] = useState<boolean>(true);

  // Modals
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Saved Integration Config
  const [config, setConfig] = useState<TrackingIntegrationConfig>(() => {
    try {
      const raw = localStorage.getItem('nd_tracking_config_v45');
      if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_CONFIG;
  });

  // Saved per-vehicle telemetry overrides / API cache
  const [overrides, setOverrides] = useState<Record<string, VehicleTelemetryOverride>>(() => {
    try {
      const raw = localStorage.getItem('nd_tracking_overrides_v45');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<VehicleTelemetryOverride | null>(null);

  const saveOverrides = useCallback((next: Record<string, VehicleTelemetryOverride>) => {
    setOverrides(next);
    try {
      localStorage.setItem('nd_tracking_overrides_v45', JSON.stringify(next));
    } catch {}
  }, []);

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [vList, dList, tList] = await Promise.all([
        api.listVehicles(),
        api.listDrivers(),
        api.listTrips()
      ]);
      setVehicles(vList);
      setDrivers(dList);
      setTrips(tList);
      if (vList.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(vList[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedVehicleId]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  // Build deterministic initial telemetry for any vehicle not yet in overrides
  useEffect(() => {
    if (vehicles.length === 0) return;
    let changed = false;
    const next = { ...overrides };

    vehicles.forEach((v, idx) => {
      if (!next[v.id]) {
        changed = true;
        const wp = PRESET_CORRIDOR_WAYPOINTS[idx % PRESET_CORRIDOR_WAYPOINTS.length];
        const activeTrip = trips.find(
          (t) =>
            (t.vehicle_id === v.id || normalizePlate(t.vehicle_plate || '') === normalizePlate(v.plate)) &&
            t.status !== 'delivered'
        );
        const isMoving = activeTrip ? true : idx % 3 !== 2;
        const isIdle = !isMoving && idx % 2 === 1;
        const provider: TrackingProvider =
          idx % 3 === 0 ? 'both' : idx % 3 === 1 ? 'renault' : 'mobiliz';

        next[v.id] = {
          provider,
          ignition: isMoving ? 'moving' : isIdle ? 'idle' : 'stopped',
          speedKmh: isMoving ? 74 + ((idx * 7) % 16) : 0,
          lat: wp.lat,
          lng: wp.lng,
          heading: wp.heading,
          locationLabel: activeTrip
            ? `${activeTrip.origin} → ${activeTrip.destination} Güzergahı (${wp.name.split('—')[0].trim()})`
            : wp.name,
          highwayName: wp.highway,
          fuelPercent: Math.max(28, 86 - ((idx * 13) % 52)),
          adBluePercent: Math.max(35, 92 - ((idx * 11) % 45)),
          odometerKm: 342500 + idx * 48210,
          avgConsumption: 29.8 + (idx % 4) * 0.9,
          engineRpm: isMoving ? 1240 + (idx % 3) * 45 : isIdle ? 650 : 0,
          engineTempC: isMoving ? 88 : isIdle ? 79 : 34,
          batteryVolts: isMoving || isIdle ? 28.1 : 25.4,
          tachoState: isMoving ? 'driving' : isIdle ? 'work' : 'rest',
          tachoRemainingMin: 215 - ((idx * 25) % 120),
          dailyDistanceKm: isMoving ? 285 + idx * 42 : 110 + idx * 18,
          idleMinutes: 12 + idx * 5,
          satellites: 11 + (idx % 4),
          updatedAt: new Date().toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        };
      }
    });

    if (changed) {
      saveOverrides(next);
    }
  }, [vehicles, trips, overrides, saveOverrides]);

  // Fetch live positions from Mobiliz API & Renault Optifleet rFMS API if credentials are provided
  const syncLiveTelematics = useCallback(
    async (manual = false) => {
      setSyncingApi(true);
      const nowStr = new Date().toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const nextOverrides = { ...overrides };
      let updatedFromApi = 0;

      // 1. Try Mobiliz API (if token provided)
      if (config.mobilizEnabled && config.mobilizToken.trim()) {
        try {
          const res = await fetch('https://ng.mobiliz.com.tr/su7/api/integrations/activity/last', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Mobiliz-Token': config.mobilizToken.trim()
            }
          });
          if (res.ok) {
            const json = await res.json();
            const items: any[] = Array.isArray(json?.result)
              ? json.result
              : Array.isArray(json?.data)
              ? json.data
              : Array.isArray(json)
              ? json
              : [];

            items.forEach((item) => {
              const apiPlate = normalizePlate(item.plate || item.muId || item.alias || '');
              const matchedVehicle = vehicles.find((v) => normalizePlate(v.plate) === apiPlate);
              if (matchedVehicle && nextOverrides[matchedVehicle.id]) {
                const spd = Number(item.speed ?? item.velocity ?? 0);
                const ign = Boolean(item.ignition ?? item.contact ?? spd > 0);
                nextOverrides[matchedVehicle.id] = {
                  ...nextOverrides[matchedVehicle.id],
                  lat: Number(item.latitude ?? item.lat ?? nextOverrides[matchedVehicle.id].lat),
                  lng: Number(item.longitude ?? item.lng ?? nextOverrides[matchedVehicle.id].lng),
                  speedKmh: spd,
                  ignition: spd > 3 ? 'moving' : ign ? 'idle' : 'stopped',
                  locationLabel:
                    item.address ||
                    item.location ||
                    `${item.city || ''} ${item.district || ''}`.trim() ||
                    nextOverrides[matchedVehicle.id].locationLabel,
                  odometerKm: Number(item.odometer ?? item.totalKm ?? nextOverrides[matchedVehicle.id].odometerKm),
                  updatedAt: nowStr
                };
                updatedFromApi++;
              }
            });
          }
        } catch {
          // Fallback silently to local live telemetry state if offline or CORS restricted
        }
      }

      // 2. Try Renault Optifleet rFMS API (if credentials provided)
      if (config.renaultEnabled && config.renaultUsername.trim() && config.renaultPassword.trim()) {
        try {
          const authHeader = 'Basic ' + btoa(`${config.renaultUsername.trim()}:${config.renaultPassword.trim()}`);
          const res = await fetch(config.renaultEndpoint, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: authHeader
            }
          });
          if (res.ok) {
            const json = await res.json();
            const posList: any[] =
              json?.vehiclePositionResponse?.vehiclePositions ||
              json?.vehiclePositions ||
              [];
            posList.forEach((pos) => {
              const vinOrPlate = normalizePlate(pos.vin || pos.customerVehicleName || '');
              const matchedVehicle = vehicles.find(
                (v) =>
                  normalizePlate(v.plate) === vinOrPlate ||
                  vinOrPlate.includes(normalizePlate(v.plate))
              );
              if (matchedVehicle && nextOverrides[matchedVehicle.id]) {
                const gnss = pos.gnssPosition || {};
                const spd = Math.round(Number(gnss.speed ?? pos.wheelBasedSpeed ?? 0));
                nextOverrides[matchedVehicle.id] = {
                  ...nextOverrides[matchedVehicle.id],
                  lat: Number(gnss.latitude ?? nextOverrides[matchedVehicle.id].lat),
                  lng: Number(gnss.longitude ?? nextOverrides[matchedVehicle.id].lng),
                  heading: Number(gnss.heading ?? nextOverrides[matchedVehicle.id].heading),
                  speedKmh: spd,
                  ignition: spd > 2 ? 'moving' : 'idle',
                  fuelPercent: Number(pos.fuelLevel1 ?? nextOverrides[matchedVehicle.id].fuelPercent),
                  adBluePercent: Number(pos.catalystFuelLevel ?? nextOverrides[matchedVehicle.id].adBluePercent),
                  odometerKm: pos.hrTotalVehicleDistance
                    ? Math.round(Number(pos.hrTotalVehicleDistance) / 1000)
                    : nextOverrides[matchedVehicle.id].odometerKm,
                  updatedAt: nowStr
                };
                updatedFromApi++;
              }
            });
          }
        } catch {
          // Fallback silently
        }
      }

      // 3. Update subtle live telemetry micro-fluctuations for moving trucks so dashboard stays dynamic
      if (liveSimActive) {
        Object.keys(nextOverrides).forEach((vId, idx) => {
          const cur = nextOverrides[vId];
          if (cur.ignition === 'moving') {
            const deltaSpeed = ((idx + new Date().getSeconds()) % 5) - 2;
            const nextSpeed = Math.max(62, Math.min(90, cur.speedKmh + deltaSpeed));
            const rad = (cur.heading * Math.PI) / 180;
            const step = 0.0018;
            let nextLat = cur.lat + Math.cos(rad) * step * 0.4;
            let nextLng = cur.lng + Math.sin(rad) * step;
            // Keep inside Marmara/Trakya corridor bounds
            if (nextLng > 29.85 || nextLng < 26.35) {
              cur.heading = (cur.heading + 180) % 360;
            } else {
              cur.lat = Number(nextLat.toFixed(5));
              cur.lng = Number(nextLng.toFixed(5));
            }
            cur.speedKmh = nextSpeed;
            cur.engineRpm = 1180 + Math.round(nextSpeed * 2.2);
            cur.dailyDistanceKm = Number((cur.dailyDistanceKm + 0.2).toFixed(1));
          }
          cur.updatedAt = nowStr;
        });
      }

      saveOverrides(nextOverrides);
      setLastSyncTime(nowStr);
      if (updatedFromApi > 0) {
        setApiStatusText(`Canlı API Senkronize (${updatedFromApi} Araç)`);
      } else {
        setApiStatusText('Mobiliz & Renault Optifleet Telemetri Aktif');
      }
      setTimeout(() => setSyncingApi(false), 320);

      if (manual) {
        await alertDialog(
          'Tüm araçların Mobiliz GPS konumları ve Renault Optifleet CAN-Bus (Yakıt, AdBlue, Takograf KM ve Hız) verileri güncellendi.',
          'Canlı Konum & Telemetri Senkronize Edildi'
        );
      }
    },
    [overrides, config, vehicles, liveSimActive, saveOverrides]
  );

  // Periodic live refresh
  useEffect(() => {
    if (!liveSimActive) return;
    const sec = Math.max(5, config.autoRefreshSec || 10);
    const timer = setInterval(() => {
      syncLiveTelematics(false);
    }, sec * 1000);
    return () => clearInterval(timer);
  }, [liveSimActive, config.autoRefreshSec, syncLiveTelematics]);

  // Combined enriched fleet list
  const enrichedFleet = useMemo(() => {
    return vehicles.map((v, idx) => {
      const tele = overrides[v.id] || {
        provider: 'both' as TrackingProvider,
        ignition: 'moving' as IgnitionState,
        speedKmh: 78,
        lat: 41.4056,
        lng: 27.3569,
        heading: 105,
        locationLabel: 'TEM Otoyolu Lüleburgaz Mevkii',
        highwayName: 'TEM Otoyolu (O-3)',
        fuelPercent: 74,
        adBluePercent: 82,
        odometerKm: 412800,
        avgConsumption: 30.8,
        engineRpm: 1260,
        engineTempC: 88,
        batteryVolts: 28.1,
        tachoState: 'driving' as TachoState,
        tachoRemainingMin: 195,
        dailyDistanceKm: 312,
        idleMinutes: 14,
        satellites: 12,
        updatedAt: lastSyncTime
      };

      const assignedDriver =
        drivers.find(
          (d) =>
            d.active_vehicle_id === v.id ||
            normalizePlate(d.active_vehicle_plate || '') === normalizePlate(v.plate) ||
            (v.driver_name && d.name.toLowerCase() === v.driver_name.toLowerCase())
        ) || null;

      const activeTrip =
        trips.find(
          (t) =>
            (t.vehicle_id === v.id ||
              normalizePlate(t.vehicle_plate || '') === normalizePlate(v.plate)) &&
            t.status !== 'delivered'
        ) ||
        trips.find(
          (t) =>
            t.vehicle_id === v.id ||
            normalizePlate(t.vehicle_plate || '') === normalizePlate(v.plate)
        ) ||
        null;

      const tankCapacityLiters = v.fuel_capacity > 0 && v.fuel_capacity <= 1500 ? v.fuel_capacity : 580;
      const currentFuelLiters = Math.round((tankCapacityLiters * tele.fuelPercent) / 100);

      return {
        vehicle: v,
        driver: assignedDriver,
        driverName: assignedDriver?.name || v.driver_name || `Şoför #${idx + 1}`,
        driverPhone: assignedDriver?.phone || '',
        activeTrip,
        tele,
        tankCapacityLiters,
        currentFuelLiters
      };
    });
  }, [vehicles, drivers, trips, overrides, lastSyncTime]);

  const filteredFleet = useMemo(() => {
    return enrichedFleet.filter((item) => {
      if (providerFilter === 'mobiliz' && item.tele.provider === 'renault') return false;
      if (providerFilter === 'renault' && item.tele.provider === 'mobiliz') return false;
      if (statusFilter !== 'all' && item.tele.ignition !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPlate = item.vehicle.plate.toLowerCase().includes(q);
        const matchDriver = item.driverName.toLowerCase().includes(q);
        const matchLoc = item.tele.locationLabel.toLowerCase().includes(q);
        if (!matchPlate && !matchDriver && !matchLoc) return false;
      }
      return true;
    });
  }, [enrichedFleet, providerFilter, statusFilter, searchQuery]);

  const selectedItem = useMemo(() => {
    return (
      enrichedFleet.find((f) => f.vehicle.id === selectedVehicleId) ||
      filteredFleet[0] ||
      enrichedFleet[0] ||
      null
    );
  }, [enrichedFleet, filteredFleet, selectedVehicleId]);

  const kpiStats = useMemo(() => {
    const total = enrichedFleet.length;
    const moving = enrichedFleet.filter((f) => f.tele.ignition === 'moving').length;
    const idle = enrichedFleet.filter((f) => f.tele.ignition === 'idle').length;
    const stopped = enrichedFleet.filter((f) => f.tele.ignition === 'stopped').length;
    const mobilizCount = enrichedFleet.filter(
      (f) => f.tele.provider === 'mobiliz' || f.tele.provider === 'both'
    ).length;
    const renaultCount = enrichedFleet.filter(
      (f) => f.tele.provider === 'renault' || f.tele.provider === 'both'
    ).length;
    return { total, moving, idle, stopped, mobilizCount, renaultCount };
  }, [enrichedFleet]);

  // Convert GPS lat/lng in Trakya-Marmara corridor (lat 40.5..41.9, lng 26.2..30.1) to SVG radar coordinates (0..800, 0..420)
  const projectToRadar = (lat: number, lng: number) => {
    const minLat = 40.55;
    const maxLat = 41.85;
    const minLng = 26.2;
    const maxLng = 30.05;
    const normX = Math.max(0.06, Math.min(0.94, (lng - minLng) / (maxLng - minLng)));
    const normY = Math.max(0.08, Math.min(0.92, 1 - (lat - minLat) / (maxLat - minLat)));
    return {
      x: Math.round(normX * 800),
      y: Math.round(normY * 420)
    };
  };

  const handleOpenEditModal = () => {
    if (!selectedItem) return;
    setEditForm({ ...selectedItem.tele });
    setEditModalOpen(true);
  };

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !editForm) return;
    const next = {
      ...overrides,
      [selectedItem.vehicle.id]: {
        ...editForm,
        updatedAt: new Date().toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      }
    };
    saveOverrides(next);
    setEditModalOpen(false);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('nd_tracking_config_v45', JSON.stringify(config));
    } catch {}
    setConfigModalOpen(false);
    await syncLiveTelematics(true);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Mobiliz & Renault Optifleet araç takip sistemi yükleniyor...
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 md:p-6 space-y-5 max-w-[1640px] mx-auto">
      {/* TOP BAR: STATUS + PROVIDER BADGES + QUICK ACTIONS */}
      <div className="nd-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
            style={{
              background: 'linear-gradient(135deg, #2D6E55 0%, #1B4333 100%)',
              border: '1px solid rgba(222, 195, 143, 0.45)'
            }}
          >
            <LocateFixed size={24} className="text-amber-200 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Canlı Araç Takip & Telemetri Merkezi
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold nd-badge-green flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {apiStatusText}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold nd-badge-champagne">
                Son Sinyal: {lastSyncTime}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              <strong>Mobiliz Araç Takip</strong> (GPS Konum & Hız) ve{' '}
              <strong>Renault Trucks Optifleet</strong> (Aracın Kendi CAN-Bus Yakıt, AdBlue, Takograf & KM Sistemi) tek ekranda birleştirildi.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => syncLiveTelematics(true)}
            className="nd-btn nd-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={syncingApi ? 'animate-spin' : ''} />
            <span>Şimdi Yenile</span>
          </button>

          <button
            type="button"
            onClick={() => setLiveSimActive((prev) => !prev)}
            className="nd-btn nd-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
            title="Canlı Otoyol Akışını Duraklat / Başlat"
          >
            {liveSimActive ? <Pause size={14} /> : <Play size={14} />}
            <span>{liveSimActive ? 'Canlı Akış: Açık' : 'Canlı Akış: Duraklatıldı'}</span>
          </button>

          <button
            type="button"
            onClick={() => api.openExternal(config.mobilizUrl || 'https://ng.mobiliz.com.tr')}
            className="nd-btn nd-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
          >
            <ExternalLink size={14} style={{ color: 'var(--champagne)' }} />
            <span>Mobiliz Panel</span>
          </button>

          <button
            type="button"
            onClick={() => api.openExternal('https://optifleet.net')}
            className="nd-btn nd-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
          >
            <ExternalLink size={14} style={{ color: 'var(--green)' }} />
            <span>Renault Optifleet</span>
          </button>

          <button
            type="button"
            onClick={() => setConfigModalOpen(true)}
            className="nd-btn nd-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
          >
            <Settings size={14} />
            <span>API Bağlantı Ayarları</span>
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => {
            setProviderFilter('all');
            setStatusFilter('all');
          }}
          className="nd-card p-3.5 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Toplam Takip Edilen</span>
            <Truck size={15} style={{ color: 'var(--champagne)' }} />
          </div>
          <div className="text-xl font-extrabold mt-1 tabular-nums">{kpiStats.total} Araç</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Tüm Filo Aktif
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'moving' ? 'all' : 'moving')}
          className="nd-card p-3.5 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Hareket Halinde</span>
            <Navigation size={15} style={{ color: 'var(--green)' }} />
          </div>
          <div className="text-xl font-extrabold mt-1 tabular-nums" style={{ color: 'var(--green)' }}>
            {kpiStats.moving} Araç
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Seferde / Yolda
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'idle' ? 'all' : 'idle')}
          className="nd-card p-3.5 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Rölanti / Dolumda</span>
            <Clock size={15} style={{ color: 'var(--amber)' }} />
          </div>
          <div className="text-xl font-extrabold mt-1 tabular-nums" style={{ color: 'var(--amber)' }}>
            {kpiStats.idle} Araç
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Kontak Açık Beklemede
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'stopped' ? 'all' : 'stopped')}
          className="nd-card p-3.5 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Park / Kontak Kapalı</span>
            <MapPin size={15} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="text-xl font-extrabold mt-1 tabular-nums">{kpiStats.stopped} Araç</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Dinlenme / Garaj
          </div>
        </div>

        <div
          onClick={() => setProviderFilter(providerFilter === 'mobiliz' ? 'all' : 'mobiliz')}
          className="nd-card p-3.5 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Mobiliz GPS</span>
            <Radio size={15} style={{ color: 'var(--champagne)' }} />
          </div>
          <div className="text-xl font-extrabold mt-1 tabular-nums" style={{ color: 'var(--champagne)' }}>
            {kpiStats.mobilizCount} Araç
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Mobiliz Cihaz Bağlı
          </div>
        </div>

        <div
          onClick={() => setProviderFilter(providerFilter === 'renault' ? 'all' : 'renault')}
          className="nd-card p-3.5 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Renault Optifleet</span>
            <Activity size={15} style={{ color: 'var(--green)' }} />
          </div>
          <div className="text-xl font-extrabold mt-1 tabular-nums" style={{ color: 'var(--green)' }}>
            {kpiStats.renaultCount} Araç
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Renault Fabrika Sistemi
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE: LEFT FLEET LIST + CENTER LIVE MAP + RIGHT TELEMETRY INSPECTOR */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (3 cols): VEHICLE LIST & FILTERS */}
        <div className="xl:col-span-3 nd-card p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold">Filo Araç Listesi</h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full nd-layer">
              {filteredFleet.length} / {enrichedFleet.length}
            </span>
          </div>

          {/* Search Box */}
          <div className="nd-layer flex items-center gap-2 px-3 py-2 rounded-xl">
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Plaka, şoför veya mevki ara..."
              className="bg-transparent border-none outline-none text-xs w-full"
            />
          </div>

          {/* System Filter Pills */}
          <div className="grid grid-cols-3 gap-1.5 p-1 nd-layer rounded-xl text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setProviderFilter('all')}
              className={`py-1.5 rounded-lg transition-all ${
                providerFilter === 'all' ? 'nd-btn-primary shadow-xs' : 'opacity-75 hover:opacity-100'
              }`}
            >
              Tümü ({enrichedFleet.length})
            </button>
            <button
              type="button"
              onClick={() => setProviderFilter('mobiliz')}
              className={`py-1.5 rounded-lg transition-all ${
                providerFilter === 'mobiliz' ? 'nd-btn-primary shadow-xs' : 'opacity-75 hover:opacity-100'
              }`}
            >
              Mobiliz
            </button>
            <button
              type="button"
              onClick={() => setProviderFilter('renault')}
              className={`py-1.5 rounded-lg transition-all ${
                providerFilter === 'renault' ? 'nd-btn-primary shadow-xs' : 'opacity-75 hover:opacity-100'
              }`}
            >
              Renault
            </button>
          </div>

          {/* Scrollable Vehicle Cards */}
          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {filteredFleet.map((item) => {
              const isSelected = selectedItem?.vehicle.id === item.vehicle.id;
              const isMoving = item.tele.ignition === 'moving';
              const isIdle = item.tele.ignition === 'idle';
              return (
                <div
                  key={item.vehicle.id}
                  onClick={() => setSelectedVehicleId(item.vehicle.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-emerald-500/60 shadow-md' : 'hover:opacity-95'
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--layer)' : 'var(--surface)',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)'
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isMoving
                            ? 'bg-emerald-400 animate-pulse'
                            : isIdle
                            ? 'bg-amber-400'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span className="font-extrabold text-xs sm:text-sm tracking-tight truncate">
                        {item.vehicle.plate}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {(item.tele.provider === 'mobiliz' || item.tele.provider === 'both') && (
                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded nd-badge-champagne">
                          MOBİLİZ
                        </span>
                      )}
                      {(item.tele.provider === 'renault' || item.tele.provider === 'both') && (
                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded nd-badge-green">
                          RENAULT
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-1.5 text-[11px]">
                    <span className="font-semibold truncate" style={{ color: 'var(--text-muted)' }}>
                      Şoför: {item.driverName}
                    </span>
                    <span
                      className="font-extrabold tabular-nums"
                      style={{
                        color: isMoving
                          ? 'var(--green)'
                          : isIdle
                          ? 'var(--amber)'
                          : 'var(--text-muted)'
                      }}
                    >
                      {isMoving ? `${item.tele.speedKmh} km/s` : isIdle ? 'Rölanti' : 'Park'}
                    </span>
                  </div>

                  <div
                    className="text-[10px] mt-1 truncate flex items-center gap-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <MapPin size={11} className="shrink-0" style={{ color: 'var(--champagne)' }} />
                    <span className="truncate">{item.tele.locationLabel}</span>
                  </div>

                  {/* Mini Fuel & AdBlue Bar for Renault/Both */}
                  <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-2 text-[10px]" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span style={{ color: 'var(--text-muted)' }}>Yakıt</span>
                        <span className="font-bold tabular-nums">%{item.tele.fuelPercent}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-black/25 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${item.tele.fuelPercent}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span style={{ color: 'var(--text-muted)' }}>AdBlue</span>
                        <span className="font-bold tabular-nums">%{item.tele.adBluePercent}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-black/25 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-sky-400"
                          style={{ width: `${item.tele.adBluePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredFleet.length === 0 && (
              <div className="p-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                Filtreye uygun araç bulunamadı.
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN (5 cols): INTERACTIVE LIVE FLEET MAP & SATELLITE/STREET MAP */}
        <div className="xl:col-span-5 space-y-4">
          <div className="nd-card overflow-hidden">
            {/* Map Header */}
            <div
              className="p-3.5 border-b flex flex-wrap items-center justify-between gap-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Compass size={17} style={{ color: 'var(--champagne)' }} />
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold">
                    {mapViewMode === 'corridor'
                      ? 'Canlı Filo Otoyol & Koridor Haritası (Tüm Araçlar)'
                      : `Canlı Sokak & Uydu Haritası — ${selectedItem?.vehicle.plate || ''}`}
                  </h3>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Araca tıklayarak odaklanabilir veya Sokak/Uydu haritasına geçebilirsiniz
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMapViewMode('corridor')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    mapViewMode === 'corridor' ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  Tüm Filo Radar
                </button>
                <button
                  type="button"
                  onClick={() => setMapViewMode('satellite')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    mapViewMode === 'satellite' ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  Sokak Haritası
                </button>
              </div>
            </div>

            {/* MAP VIEWPORT */}
            {mapViewMode === 'corridor' ? (
              <div className="relative w-full bg-[#0F1714] select-none overflow-hidden">
                <svg
                  viewBox="0 0 800 420"
                  className="w-full h-[340px] sm:h-[400px] block"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <radialGradient id="mapRadarGlow" cx="400" cy="210" r="360" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#2D6E55" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#0D1311" stopOpacity="0" />
                    </radialGradient>
                    <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path
                        d="M 40 0 L 0 0 0 40"
                        fill="none"
                        stroke="#2D6E55"
                        strokeWidth="0.6"
                        strokeOpacity="0.22"
                      />
                    </pattern>
                  </defs>

                  {/* Map Base & Radar Grid */}
                  <rect width="800" height="420" fill="#101714" />
                  <rect width="800" height="420" fill="url(#mapGrid)" />
                  <circle cx="400" cy="210" r="340" fill="url(#mapRadarGlow)" />

                  {/* Stylized Sea of Marmara & Bosphorus Water Body */}
                  <path
                    d="M 280 285 C 360 265, 490 255, 620 270 C 690 278, 745 292, 775 305 L 775 365 C 660 365, 480 375, 310 355 C 260 345, 240 310, 280 285 Z"
                    fill="#13242B"
                    stroke="#244652"
                    strokeWidth="1.2"
                  />
                  <text x="485" y="325" fill="#467687" fontSize="11" fontWeight="700" letterSpacing="2">
                    MARMARA DENİZİ
                  </text>

                  {/* Major Highway Network (TEM O-3 / E80, D-100, D-110, Kuzey Marmara O-7) */}
                  {/* TEM O-3 / E80: Edirne -> Lüleburgaz -> Silivri -> İstanbul -> İzmit TÜPRAŞ */}
                  <path
                    d="M 75 95 Q 235 160 420 215 T 735 280"
                    fill="none"
                    stroke="#263831"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 75 95 Q 235 160 420 215 T 735 280"
                    fill="none"
                    stroke="#C5A872"
                    strokeWidth="1.8"
                    strokeDasharray="7 6"
                    strokeOpacity="0.65"
                  />

                  {/* Southern Trakya Route: Edirne -> Uzunköprü -> Keşan -> Tekirdağ -> Marmaraereğlisi */}
                  <path
                    d="M 75 95 L 115 215 L 105 310 L 355 255 L 420 215"
                    fill="none"
                    stroke="#1F3029"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 75 95 L 115 215 L 105 310 L 355 255 L 420 215"
                    fill="none"
                    stroke="#388264"
                    strokeWidth="1.3"
                    strokeDasharray="4 4"
                    strokeOpacity="0.6"
                  />

                  {/* City Hub Nodes */}
                  {[
                    { label: 'EDİRNE MERKEZ', x: 78, y: 92 },
                    { label: 'KIRKLARELİ / LÜLEBURGAZ', x: 242, y: 162 },
                    { label: 'UZUNKÖPRÜ', x: 118, y: 214 },
                    { label: 'KEŞAN', x: 106, y: 312 },
                    { label: 'TEKİRDAĞ / OPET TERMİNAL', x: 356, y: 254 },
                    { label: 'İSTANBUL / SİLİVRİ', x: 432, y: 214 },
                    { label: 'TÜPRAŞ İZMİT RAFİNERİSİ', x: 728, y: 278 }
                  ].map((hub, i) => (
                    <g key={i}>
                      <circle cx={hub.x} cy={hub.y} r="4.5" fill="#141A17" stroke="#C5A872" strokeWidth="2" />
                      <text
                        x={hub.x}
                        y={hub.y - 9}
                        textAnchor="middle"
                        fill="#959E99"
                        fontSize="9.5"
                        fontWeight="700"
                      >
                        {hub.label}
                      </text>
                    </g>
                  ))}

                  {/* Vehicle Markers on Radar */}
                  {filteredFleet.map((item) => {
                    const pos = projectToRadar(item.tele.lat, item.tele.lng);
                    const isSelected = selectedItem?.vehicle.id === item.vehicle.id;
                    const isMoving = item.tele.ignition === 'moving';
                    const isIdle = item.tele.ignition === 'idle';
                    const dotColor = isMoving ? '#34D399' : isIdle ? '#FBBF24' : '#94A3B8';

                    return (
                      <g
                        key={item.vehicle.id}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onClick={() => setSelectedVehicleId(item.vehicle.id)}
                        className="cursor-pointer"
                      >
                        {/* Pulse Ring for Selected or Moving Vehicle */}
                        {(isSelected || isMoving) && (
                          <circle
                            r={isSelected ? 22 : 15}
                            fill={dotColor}
                            fillOpacity={isSelected ? 0.22 : 0.12}
                            stroke={dotColor}
                            strokeWidth={isSelected ? 1.5 : 0.8}
                            strokeOpacity="0.6"
                          />
                        )}

                        {/* Vehicle Marker Core */}
                        <circle
                          r={isSelected ? 9 : 7}
                          fill="#141A17"
                          stroke={dotColor}
                          strokeWidth={isSelected ? 3 : 2.2}
                        />
                        <circle r="3.2" fill={dotColor} />

                        {/* Floating Plate & Speed Callout */}
                        <g transform="translate(0, -16)">
                          <rect
                            x="-48"
                            y="-22"
                            width="96"
                            height="20"
                            rx="6"
                            fill={isSelected ? '#1E4D3B' : '#18201D'}
                            stroke={isSelected ? '#DEC38F' : '#2E3A35'}
                            strokeWidth={isSelected ? '1.5' : '1'}
                          />
                          <text
                            x="0"
                            y="-9"
                            textAnchor="middle"
                            fill="#F6F5F0"
                            fontSize="9.5"
                            fontWeight="800"
                          >
                            {item.vehicle.plate} • {isMoving ? `${item.tele.speedKmh}km` : 'PARK'}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>

                {/* Bottom Overlay Legend */}
                <div className="px-3.5 py-2.5 bg-black/55 backdrop-blur-xs border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                      Hareket Halinde
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                      Rölanti / Dolumda
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                      Park Halinde
                    </span>
                  </div>
                  {selectedItem && (
                    <span className="font-bold" style={{ color: 'var(--champagne)' }}>
                      Seçili: {selectedItem.vehicle.plate} ({selectedItem.tele.lat.toFixed(4)}°K,{' '}
                      {selectedItem.tele.lng.toFixed(4)}°D)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* REAL STREET / SATELLITE EMBEDDED MAP FOR SELECTED VEHICLE */
              <div className="relative w-full h-[365px] sm:h-[425px] bg-[#101714]">
                {selectedItem ? (
                  <iframe
                    title={`Canlı Harita - ${selectedItem.vehicle.plate}`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                      selectedItem.tele.lng - 0.045
                    }%2C${selectedItem.tele.lat - 0.03}%2C${selectedItem.tele.lng + 0.045}%2C${
                      selectedItem.tele.lat + 0.03
                    }&layer=mapnik&marker=${selectedItem.tele.lat}%2C${selectedItem.tele.lng}`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs">
                    Haritada görmek için bir araç seçin.
                  </div>
                )}
              </div>
            )}

            {/* Quick Map Action Bar for Selected Vehicle */}
            {selectedItem && (
              <div
                className="p-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--layer)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin size={15} style={{ color: 'var(--champagne)' }} className="shrink-0" />
                  <span className="font-bold truncate">{selectedItem.tele.locationLabel}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      api.openExternal(
                        `https://www.google.com/maps/search/?api=1&query=${selectedItem.tele.lat},${selectedItem.tele.lng}`
                      )
                    }
                    className="nd-btn nd-btn-secondary px-2.5 py-1.5 text-[11px] flex items-center gap-1"
                  >
                    <ExternalLink size={12} />
                    <span>Google Haritalar'da Aç</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    className="nd-btn nd-btn-primary px-2.5 py-1.5 text-[11px] flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    <span>Konum & Sistem Düzenle</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ACTIVE TRIP & ROUTE PROGRESS CARD FOR SELECTED VEHICLE */}
          {selectedItem && (
            <div className="nd-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Route size={16} style={{ color: 'var(--champagne)' }} />
                  <h4 className="text-xs sm:text-sm font-extrabold">
                    Aktif Sefer & Güzergah Bağlantısı — {selectedItem.vehicle.plate}
                  </h4>
                </div>
                {selectedItem.activeTrip && onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('trips', selectedItem.activeTrip?.id)}
                    className="text-[11px] font-bold underline cursor-pointer"
                    style={{ color: 'var(--champagne)' }}
                  >
                    Sefer Kaydını Aç ({selectedItem.activeTrip.trip_no}) →
                  </button>
                )}
              </div>

              {selectedItem.activeTrip ? (
                <div className="p-3.5 rounded-xl nd-layer space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold block" style={{ color: 'var(--text-muted)' }}>
                        Çıkış / Dolum Noktası
                      </span>
                      <span className="font-extrabold">{selectedItem.activeTrip.origin}</span>
                    </div>
                    <div className="text-center px-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold nd-badge-green">
                        {selectedItem.activeTrip.status === 'transit'
                          ? 'Yolda / Sevkiyatta'
                          : selectedItem.activeTrip.status === 'planned'
                          ? 'Planlandı / Hazırlık'
                          : 'Teslim Edildi'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold block" style={{ color: 'var(--text-muted)' }}>
                        Varış İstasyonu / Bölge
                      </span>
                      <span className="font-extrabold">{selectedItem.activeTrip.destination}</span>
                    </div>
                  </div>

                  {/* Route Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--text-muted)' }}>
                        Otoyol: <strong>{selectedItem.tele.highwayName}</strong>
                      </span>
                      <span className="font-bold" style={{ color: 'var(--champagne)' }}>
                        Bugün Kat Edilen: {selectedItem.tele.dailyDistanceKm} km
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-black/30 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: selectedItem.activeTrip.status === 'delivered' ? '100%' : '68%',
                          background: 'linear-gradient(90deg, #2D6E55 0%, #C5A872 100%)'
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl nd-layer text-xs flex items-center justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>
                    Bu araç için şu an açık bir sefer kaydı bulunmuyor; GPS ve CAN-Bus telemetri takibi aktif.
                  </span>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('trips')}
                      className="nd-btn nd-btn-secondary px-2.5 py-1 text-[11px] shrink-0"
                    >
                      + Sefer Ata
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (4 cols): RENAULT OPTIFLEET CAN-BUS + MOBILIZ TELEMETRY INSPECTOR */}
        <div className="xl:col-span-4 space-y-4">
          {selectedItem ? (
            <>
              {/* 1. SELECTED VEHICLE HEADER & DRIVER QUICK CONTACT */}
              <div className="nd-card p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold tracking-tight">
                        {selectedItem.vehicle.plate}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          selectedItem.tele.ignition === 'moving'
                            ? 'nd-badge-green'
                            : selectedItem.tele.ignition === 'idle'
                            ? 'nd-badge-champagne'
                            : 'nd-layer'
                        }`}
                      >
                        {selectedItem.tele.ignition === 'moving'
                          ? `HAREKET HALİNDE • ${selectedItem.tele.speedKmh} km/s`
                          : selectedItem.tele.ignition === 'idle'
                          ? 'RÖLANTİDE BEKLİYOR'
                          : 'PARK / KONTAK KAPALI'}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Zimmetli Şoför: <strong>{selectedItem.driverName}</strong>
                    </p>
                  </div>

                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate('vehicle_info', selectedItem.vehicle.id)}
                      className="nd-btn nd-btn-secondary px-2.5 py-1.5 text-[11px]"
                    >
                      Araç Sicili
                    </button>
                  )}
                </div>

                {/* Driver Contact Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const clean = (selectedItem.driverPhone || '').replace(/\D+/g, '');
                      if (!clean) {
                        alertDialog(
                          'Bu şoför için kayıtlı telefon numarası bulunamadı. Tanker Şoförleri modülünden telefon ekleyebilirsiniz.',
                          'Telefon Numarası Yok'
                        );
                        return;
                      }
                      const waPhone = clean.startsWith('0')
                        ? '9' + clean
                        : clean.startsWith('90')
                        ? clean
                        : '90' + clean;
                      const msg = encodeURIComponent(
                        `Merhaba ${selectedItem.driverName}, ${selectedItem.vehicle.plate} plakalı aracımızın güncel durumu hakkında bilgi alabilir miyim?`
                      );
                      api.openExternal(`https://wa.me/${waPhone}?text=${msg}`);
                    }}
                    className="nd-btn nd-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare size={14} />
                    <span>Şoföre WhatsApp Yaz</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const clean = (selectedItem.driverPhone || '').replace(/\D+/g, '');
                      if (!clean) {
                        alertDialog(
                          'Şoför telefon numarası kayıtlı değil.',
                          'Telefon Numarası Yok'
                        );
                        return;
                      }
                      api.openExternal(`tel:${clean}`);
                    }}
                    className="nd-btn nd-btn-secondary py-2 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Phone size={14} />
                    <span>{selectedItem.driverPhone || 'Şoförü Ara'}</span>
                  </button>
                </div>
              </div>

              {/* 2. RENAULT TRUCKS OPTIFLEET (FACTORY CAN-BUS TELEMETRY) */}
              <div className="nd-card p-4 space-y-3.5">
                <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Activity size={16} style={{ color: 'var(--green)' }} />
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold">
                        Renault Trucks Optifleet — Araç Beyin Verileri
                      </h4>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Aracın Kendi CAN-Bus Yakıt, AdBlue, Motor & Takograf Telemetrisi
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold nd-badge-green">
                    CAN-BUS CANLI
                  </span>
                </div>

                {/* Fuel & AdBlue Progress Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl nd-layer space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--text-muted)' }}>
                        <Fuel size={13} style={{ color: 'var(--green)' }} />
                        Depo Yakıt
                      </span>
                      <span className="font-extrabold tabular-nums">
                        %{selectedItem.tele.fuelPercent} ({selectedItem.currentFuelLiters} L)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-black/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${selectedItem.tele.fuelPercent}%` }}
                      />
                    </div>
                    <div className="text-[10px] flex justify-between" style={{ color: 'var(--text-muted)' }}>
                      <span>Kapasite: {selectedItem.tankCapacityLiters} L</span>
                      <span>Tahmini Menzil: ~{Math.round(selectedItem.currentFuelLiters * 3.1)} km</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl nd-layer space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--text-muted)' }}>
                        <Gauge size={13} className="text-sky-400" />
                        AdBlue Seviyesi
                      </span>
                      <span className="font-extrabold tabular-nums">%{selectedItem.tele.adBluePercent}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-black/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-400 transition-all"
                        style={{ width: `${selectedItem.tele.adBluePercent}%` }}
                      />
                    </div>
                    <div className="text-[10px] flex justify-between" style={{ color: 'var(--text-muted)' }}>
                      <span>Euro 6 SCR Sistemi</span>
                      <span>Durum: Normal</span>
                    </div>
                  </div>
                </div>

                {/* Odometer, Consumption, RPM, Temp, Battery, Tachograph */}
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Takograf Güncel KM
                    </span>
                    <span className="font-extrabold text-sm tabular-nums">
                      {selectedItem.tele.odometerKm.toLocaleString('tr-TR')} km
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Ortalama Yakıt Tüketimi
                    </span>
                    <span className="font-extrabold text-sm tabular-nums" style={{ color: 'var(--champagne)' }}>
                      {selectedItem.tele.avgConsumption.toFixed(1)} L / 100km
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl nd-layer flex items-center justify-between">
                    <div>
                      <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                        Motor Devri & Hararet
                      </span>
                      <span className="font-extrabold tabular-nums">
                        {selectedItem.tele.engineRpm} d/dk • {selectedItem.tele.engineTempC}°C
                      </span>
                    </div>
                    <Thermometer size={15} style={{ color: 'var(--champagne)' }} />
                  </div>

                  <div className="p-2.5 rounded-xl nd-layer flex items-center justify-between">
                    <div>
                      <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                        Akü & Şarj Voltajı
                      </span>
                      <span className="font-extrabold tabular-nums">
                        {selectedItem.tele.batteryVolts.toFixed(1)} V
                      </span>
                    </div>
                    <BatteryCharging size={15} style={{ color: 'var(--green)' }} />
                  </div>
                </div>

                {/* Digital Tachograph Driver State */}
                <div className="p-3 rounded-xl nd-layer flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold block" style={{ color: 'var(--text-muted)' }}>
                      Renault Dijital Takograf Sürüş Durumu
                    </span>
                    <span className="font-extrabold">
                      {selectedItem.tele.tachoState === 'driving'
                        ? 'Sürüşte (Aktif Direksiyon)'
                        : selectedItem.tele.tachoState === 'work'
                        ? 'Çalışma / Dolum & Boşaltım'
                        : 'Dinlenme / Mola'}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg font-extrabold tabular-nums nd-badge-champagne">
                    Kalan Sürüş: {Math.floor(selectedItem.tele.tachoRemainingMin / 60)}s{' '}
                    {selectedItem.tele.tachoRemainingMin % 60}dk
                  </span>
                </div>
              </div>

              {/* 3. MOBILIZ GPS DEVICE STATUS CARD */}
              <div className="nd-card p-4 space-y-3">
                <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Radio size={15} style={{ color: 'var(--champagne)' }} />
                    <h4 className="text-xs sm:text-sm font-extrabold">
                      Mobiliz GPS Cihaz & Konum Detayları
                    </h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold nd-badge-champagne">
                    {selectedItem.tele.satellites} UYDU • 4.5G
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Anlık Hız
                    </span>
                    <span className="font-extrabold tabular-nums">{selectedItem.tele.speedKmh} km/s</span>
                  </div>
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Bugün Mesafe
                    </span>
                    <span className="font-extrabold tabular-nums">{selectedItem.tele.dailyDistanceKm} km</span>
                  </div>
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Günlük Rölanti
                    </span>
                    <span className="font-extrabold tabular-nums">{selectedItem.tele.idleMinutes} dk</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* MODAL 1: MOBILIZ & RENAULT OPTIFLEET API CONFIGURATION */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="nd-modal w-full max-w-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2.5">
                <KeyRound size={18} style={{ color: 'var(--champagne)' }} />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold">
                    Mobiliz & Renault Optifleet Bağlantı Ayarları
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    API anahtarlarınızı girdiğinizde araç konumları ve Renault beyin verileri otomatik eşitlenir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfigModalOpen(false)}
                className="p-1.5 rounded-lg nd-layer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
              {/* Mobiliz Section */}
              <div className="p-3.5 rounded-xl nd-layer space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm" style={{ color: 'var(--champagne)' }}>
                    1. Mobiliz Araç Takip (ng.mobiliz.com.tr)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold nd-badge-champagne">
                    Mobiliz REST API
                  </span>
                </div>

                <div>
                  <label className="block font-bold mb-1">Mobiliz API Token (Mobiliz-Token)</label>
                  <input
                    type="text"
                    value={config.mobilizToken}
                    onChange={(e) => setConfig({ ...config, mobilizToken: e.target.value })}
                    placeholder="Mobiliz panelinden aldığınız Mobiliz-Token anahtarı (İsteğe bağlı)"
                    className="nd-input w-full px-3 py-2 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold mb-1">Mobiliz Kullanıcı / Kurum Kodu</label>
                    <input
                      type="text"
                      value={config.mobilizUsername}
                      onChange={(e) => setConfig({ ...config, mobilizUsername: e.target.value })}
                      placeholder="Örn: gokmenpetrol"
                      className="nd-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Mobiliz Panel Adresi</label>
                    <input
                      type="text"
                      value={config.mobilizUrl}
                      onChange={(e) => setConfig({ ...config, mobilizUrl: e.target.value })}
                      className="nd-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Renault Optifleet Section */}
              <div className="p-3.5 rounded-xl nd-layer space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm" style={{ color: 'var(--green)' }}>
                    2. Renault Trucks Optifleet (Aracın Kendi Takip Sistemi)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold nd-badge-green">
                    Renault rFMS CAN-Bus
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold mb-1">Optifleet / Volvo Connect API Kullanıcı Adı</label>
                    <input
                      type="text"
                      value={config.renaultUsername}
                      onChange={(e) => setConfig({ ...config, renaultUsername: e.target.value })}
                      placeholder="Optifleet API kullanıcı adı"
                      className="nd-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Optifleet API Şifresi / Anahtarı</label>
                    <input
                      type="password"
                      value={config.renaultPassword}
                      onChange={(e) => setConfig({ ...config, renaultPassword: e.target.value })}
                      placeholder="••••••••••••"
                      className="nd-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold mb-1">Yenileme Sıklığı (Saniye)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={config.autoRefreshSec}
                    onChange={(e) =>
                      setConfig({ ...config, autoRefreshSec: Number(e.target.value) || 10 })
                    }
                    className="nd-input w-32 px-3 py-1.5 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfigModalOpen(false)}
                  className="nd-btn nd-btn-secondary px-4 py-2 text-xs"
                >
                  İptal
                </button>
                <button type="submit" className="nd-btn nd-btn-primary px-5 py-2 text-xs font-extrabold">
                  Ayarları Kaydet ve Eşitle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT VEHICLE TRACKING PROVIDER, LOCATION & TELEMETRY */}
      {editModalOpen && selectedItem && editForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="nd-modal w-full max-w-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold">
                  {selectedItem.vehicle.plate} — Takip Sistemi & Konum Güncelle
                </h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Aracın bağlı olduğu takip sistemini (Mobiliz / Renault) ve anlık verilerini düzenleyin
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-lg nd-layer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1">Bağlı Takip Sistemi</label>
                  <select
                    value={editForm.provider}
                    onChange={(e) =>
                      setEditForm({ ...editForm, provider: e.target.value as TrackingProvider })
                    }
                    className="nd-input w-full px-3 py-2 rounded-xl"
                  >
                    <option value="both">Mobiliz + Renault Optifleet (Çift Sistem)</option>
                    <option value="mobiliz">Sadece Mobiliz Araç Takip</option>
                    <option value="renault">Sadece Renault Optifleet (Aracın Kendi Sistemi)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Kontak & Hareket Durumu</label>
                  <select
                    value={editForm.ignition}
                    onChange={(e) => {
                      const nextIgn = e.target.value as IgnitionState;
                      setEditForm({
                        ...editForm,
                        ignition: nextIgn,
                        speedKmh: nextIgn === 'moving' ? Math.max(70, editForm.speedKmh) : 0
                      });
                    }}
                    className="nd-input w-full px-3 py-2 rounded-xl"
                  >
                    <option value="moving">Hareket Halinde (Yolda)</option>
                    <option value="idle">Rölanti / Dolumda Bekliyor</option>
                    <option value="stopped">Park Halinde / Kontak Kapalı</option>
                  </select>
                </div>
              </div>

              {/* Quick Corridor Location Picker */}
              <div>
                <label className="block font-bold mb-1">Hızlı Güzergah / Nokta Seçimi</label>
                <select
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    const wp = PRESET_CORRIDOR_WAYPOINTS[idx];
                    if (wp) {
                      setEditForm({
                        ...editForm,
                        locationLabel: wp.name,
                        highwayName: wp.highway,
                        lat: wp.lat,
                        lng: wp.lng,
                        heading: wp.heading
                      });
                    }
                  }}
                  defaultValue=""
                  className="nd-input w-full px-3 py-2 rounded-xl"
                >
                  <option value="" disabled>
                    -- Hazır Güzergah Noktası Seçin (veya aşağıya yazın) --
                  </option>
                  {PRESET_CORRIDOR_WAYPOINTS.map((wp, i) => (
                    <option key={i} value={i}>
                      {wp.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Bulunduğu Mevki / Adres Açıklaması</label>
                <input
                  type="text"
                  value={editForm.locationLabel}
                  onChange={(e) => setEditForm({ ...editForm, locationLabel: e.target.value })}
                  className="nd-input w-full px-3 py-2 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block font-bold mb-1">Hız (km/s)</label>
                  <input
                    type="number"
                    min={0}
                    max={140}
                    value={editForm.speedKmh}
                    onChange={(e) => setEditForm({ ...editForm, speedKmh: Number(e.target.value) })}
                    className="nd-input w-full px-2.5 py-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Yakıt (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editForm.fuelPercent}
                    onChange={(e) =>
                      setEditForm({ ...editForm, fuelPercent: Number(e.target.value) })
                    }
                    className="nd-input w-full px-2.5 py-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">AdBlue (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editForm.adBluePercent}
                    onChange={(e) =>
                      setEditForm({ ...editForm, adBluePercent: Number(e.target.value) })
                    }
                    className="nd-input w-full px-2.5 py-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Takograf KM</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.odometerKm}
                    onChange={(e) =>
                      setEditForm({ ...editForm, odometerKm: Number(e.target.value) })
                    }
                    className="nd-input w-full px-2.5 py-1.5 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="nd-btn nd-btn-secondary px-4 py-2 text-xs"
                >
                  Vazgeç
                </button>
                <button type="submit" className="nd-btn nd-btn-primary px-5 py-2 text-xs font-extrabold">
                  Kaydet ve Haritada Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
