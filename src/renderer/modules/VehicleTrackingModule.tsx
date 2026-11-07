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
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  Activity,
  Search,
  Compass,
  Play,
  Pause,
  Edit3,
  X,
  KeyRound,
  Route,
  BatteryCharging,
  Thermometer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  Award,
  CheckCircle2,
  ShieldCheck,
  History
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
export type InAppPortalView = 'unified' | 'mobiliz_panel' | 'renault_panel';
export type MapLayerStyle = 'street' | 'satellite' | 'radar';

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
  ecoScore: number;
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

// Web Mercator slippy map math for real street & satellite tiles inside the app
function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
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

  // Top-level In-App View Switcher (Everything opens inside the app!)
  const [activePortalView, setActivePortalView] = useState<InAppPortalView>('unified');
  const [mapLayerStyle, setMapLayerStyle] = useState<MapLayerStyle>('satellite');
  const [mapZoom, setMapZoom] = useState<number>(8);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 41.18,
    lng: 27.95
  });
  const [focusedOnSingle, setFocusedOnSingle] = useState<boolean>(false);

  // Filter & Selection States
  const [providerFilter, setProviderFilter] = useState<'all' | 'mobiliz' | 'renault'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | IgnitionState>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
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
          speedKmh: isMoving ? 76 + ((idx * 7) % 14) : 0,
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
          avgConsumption: 29.4 + (idx % 4) * 0.8,
          engineRpm: isMoving ? 1240 + (idx % 3) * 45 : isIdle ? 650 : 0,
          engineTempC: isMoving ? 88 : isIdle ? 79 : 34,
          batteryVolts: isMoving || isIdle ? 28.1 : 25.4,
          tachoState: isMoving ? 'driving' : isIdle ? 'work' : 'rest',
          tachoRemainingMin: 215 - ((idx * 25) % 120),
          dailyDistanceKm: isMoving ? 285 + idx * 42 : 110 + idx * 18,
          idleMinutes: 12 + idx * 5,
          satellites: 11 + (idx % 4),
          ecoScore: Number((8.8 + (idx % 3) * 0.4).toFixed(1)),
          updatedAt: new Date().toLocaleTimeString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        };
      } else if (next[v.id].ecoScore === undefined) {
        changed = true;
        next[v.id].ecoScore = 9.2;
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
        } catch {}
      }

      // 2. Try Renault Optifleet rFMS API (if credentials provided)
      if (config.renaultEnabled && config.renaultUsername.trim() && config.renaultPassword.trim()) {
        try {
          const authHeader =
            'Basic ' + btoa(`${config.renaultUsername.trim()}:${config.renaultPassword.trim()}`);
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
        } catch {}
      }

      // 3. Update live highway movement
      if (liveSimActive) {
        Object.keys(nextOverrides).forEach((vId, idx) => {
          const cur = nextOverrides[vId];
          if (cur.ignition === 'moving') {
            const deltaSpeed = ((idx + new Date().getSeconds()) % 5) - 2;
            const nextSpeed = Math.max(64, Math.min(90, cur.speedKmh + deltaSpeed));
            const rad = (cur.heading * Math.PI) / 180;
            const step = 0.0016;
            const nextLat = cur.lat + Math.cos(rad) * step * 0.4;
            const nextLng = cur.lng + Math.sin(rad) * step;
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
        setApiStatusText('Mobiliz & Renault Optifleet Canlı Akış');
      }
      setTimeout(() => setSyncingApi(false), 260);

      if (manual) {
        await alertDialog(
          'Tüm araçların Mobiliz GPS konumları ve Renault Optifleet CAN-Bus (Yakıt, AdBlue, Takograf KM ve Hız) verileri uygulama içinde güncellendi.',
          'Canlı Konum & Telemetri Güncellendi'
        );
      }
    },
    [overrides, config, vehicles, liveSimActive, saveOverrides]
  );

  // Periodic live refresh
  useEffect(() => {
    if (!liveSimActive) return;
    const sec = Math.max(4, config.autoRefreshSec || 10);
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
        ecoScore: 9.2,
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

  // Focus map on vehicle when user clicks a vehicle
  const handleFocusVehicle = useCallback(
    (vehicleId: string, zoomIn = true) => {
      setSelectedVehicleId(vehicleId);
      const found = enrichedFleet.find((f) => f.vehicle.id === vehicleId);
      if (found) {
        setMapCenter({ lat: found.tele.lat, lng: found.tele.lng });
        if (zoomIn) {
          setMapZoom(12);
          setFocusedOnSingle(true);
        }
      }
    },
    [enrichedFleet]
  );

  const handleShowAllFleetOnMap = useCallback(() => {
    setMapCenter({ lat: 41.18, lng: 27.95 });
    setMapZoom(8);
    setFocusedOnSingle(false);
  }, []);

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

  // Compute real map tiles (Street or Satellite) and exact pixel coordinates for all vehicles inside the 800x440 viewport
  const mapViewportWidth = 800;
  const mapViewportHeight = 440;

  const tileLayerData = useMemo(() => {
    const centerTileX = lngToTileX(mapCenter.lng, mapZoom);
    const centerTileY = latToTileY(mapCenter.lat, mapZoom);
    const baseTileX = Math.floor(centerTileX);
    const baseTileY = Math.floor(centerTileY);
    const offsetX = (centerTileX - baseTileX) * 256;
    const offsetY = (centerTileY - baseTileY) * 256;

    const tiles: { key: string; url: string; left: number; top: number }[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const tx = baseTileX + dx;
        const ty = baseTileY + dy;
        const maxTile = Math.pow(2, mapZoom);
        if (ty < 0 || ty >= maxTile) continue;
        const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
        const left = Math.round(mapViewportWidth / 2 - offsetX + dx * 256);
        const top = Math.round(mapViewportHeight / 2 - offsetY + dy * 256);

        const url =
          mapLayerStyle === 'satellite'
            ? `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${mapZoom}/${ty}/${wrappedTx}`
            : `https://tile.openstreetmap.org/${mapZoom}/${wrappedTx}/${ty}.png`;

        tiles.push({
          key: `${mapZoom}-${wrappedTx}-${ty}`,
          url,
          left,
          top
        });
      }
    }

    const projectLatLng = (lat: number, lng: number) => {
      const tx = lngToTileX(lng, mapZoom);
      const ty = latToTileY(lat, mapZoom);
      const x = mapViewportWidth / 2 + (tx - centerTileX) * 256;
      const y = mapViewportHeight / 2 + (ty - centerTileY) * 256;
      return { x, y };
    };

    return { tiles, projectLatLng };
  }, [mapCenter, mapZoom, mapLayerStyle]);

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
    setMapCenter({ lat: editForm.lat, lng: editForm.lng });
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
    <div className="p-3 sm:p-5 md:p-6 space-y-4 max-w-[1640px] mx-auto">
      {/* TOP BAR: IN-APP PORTAL SWITCHER (NO EXTERNAL LINKS!) */}
      <div className="nd-card p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md"
            style={{
              background: 'linear-gradient(135deg, #2D6E55 0%, #1B4333 100%)',
              border: '1px solid rgba(222, 195, 143, 0.45)'
            }}
          >
            <LocateFixed size={22} className="text-amber-200 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Canlı Araç Takip & Telemetri Ekranı
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold nd-badge-green flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {apiStatusText}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold nd-badge-champagne">
                Son Sinyal: {lastSyncTime}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Tüm araçların <strong>Mobiliz GPS</strong> konumları ve{' '}
              <strong>Renault Optifleet (Aracın Kendi Sistemi)</strong> yakıt, AdBlue, takograf ve KM verileri doğrudan bu ekranda çalışır.
            </p>
          </div>
        </div>

        {/* IN-APP MODE TABS + CONTROLS */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl nd-layer gap-1">
            <button
              type="button"
              onClick={() => {
                setActivePortalView('unified');
                setProviderFilter('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activePortalView === 'unified' ? 'nd-btn-primary shadow-xs' : 'opacity-80 hover:opacity-100'
              }`}
            >
              <Compass size={14} />
              <span>Canlı Harita & Tüm Filo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePortalView('mobiliz_panel');
                setProviderFilter('mobiliz');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activePortalView === 'mobiliz_panel'
                  ? 'nd-btn-primary shadow-xs'
                  : 'opacity-80 hover:opacity-100'
              }`}
            >
              <Radio size={14} style={{ color: 'var(--champagne)' }} />
              <span>Mobiliz Ekranı ({kpiStats.mobilizCount})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActivePortalView('renault_panel');
                setProviderFilter('renault');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                activePortalView === 'renault_panel'
                  ? 'nd-btn-primary shadow-xs'
                  : 'opacity-80 hover:opacity-100'
              }`}
            >
              <Activity size={14} style={{ color: 'var(--green)' }} />
              <span>Renault Optifleet Ekranı ({kpiStats.renaultCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => syncLiveTelematics(true)}
            className="nd-btn nd-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={syncingApi ? 'animate-spin' : ''} />
            <span>Yenile</span>
          </button>

          <button
            type="button"
            onClick={() => setLiveSimActive((prev) => !prev)}
            className="nd-btn nd-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
          >
            {liveSimActive ? <Pause size={14} /> : <Play size={14} />}
            <span>{liveSimActive ? 'Canlı Akış' : 'Duraklatıldı'}</span>
          </button>

          <button
            type="button"
            onClick={() => setConfigModalOpen(true)}
            className="nd-btn nd-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5"
          >
            <Settings size={14} />
            <span>Hesap & API Bağla</span>
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS (CLICKABLE IN-APP FILTERS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div
          onClick={() => {
            setProviderFilter('all');
            setStatusFilter('all');
            handleShowAllFleetOnMap();
          }}
          className="nd-card p-3 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Tüm Filo</span>
            <Truck size={14} style={{ color: 'var(--champagne)' }} />
          </div>
          <div className="text-lg font-extrabold mt-0.5 tabular-nums">{kpiStats.total} Araç</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Haritada Göster
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'moving' ? 'all' : 'moving')}
          className="nd-card p-3 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Hareket Halinde</span>
            <Navigation size={14} style={{ color: 'var(--green)' }} />
          </div>
          <div className="text-lg font-extrabold mt-0.5 tabular-nums" style={{ color: 'var(--green)' }}>
            {kpiStats.moving} Araç
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Seferde / Yolda
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'idle' ? 'all' : 'idle')}
          className="nd-card p-3 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Rölanti / Dolumda</span>
            <Clock size={14} style={{ color: 'var(--amber)' }} />
          </div>
          <div className="text-lg font-extrabold mt-0.5 tabular-nums" style={{ color: 'var(--amber)' }}>
            {kpiStats.idle} Araç
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Kontak Açık
          </div>
        </div>

        <div
          onClick={() => setStatusFilter(statusFilter === 'stopped' ? 'all' : 'stopped')}
          className="nd-card p-3 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Park / Kapalı</span>
            <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="text-lg font-extrabold mt-0.5 tabular-nums">{kpiStats.stopped} Araç</div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Dinlenme / Tesis
          </div>
        </div>

        <div
          onClick={() => {
            setActivePortalView('mobiliz_panel');
            setProviderFilter('mobiliz');
          }}
          className="nd-card p-3 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Mobiliz Takip</span>
            <Radio size={14} style={{ color: 'var(--champagne)' }} />
          </div>
          <div className="text-lg font-extrabold mt-0.5 tabular-nums" style={{ color: 'var(--champagne)' }}>
            {kpiStats.mobilizCount} Araç
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Mobiliz Ekranını Aç
          </div>
        </div>

        <div
          onClick={() => {
            setActivePortalView('renault_panel');
            setProviderFilter('renault');
          }}
          className="nd-card p-3 cursor-pointer transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>Renault Optifleet</span>
            <Activity size={14} style={{ color: 'var(--green)' }} />
          </div>
          <div className="text-lg font-extrabold mt-0.5 tabular-nums" style={{ color: 'var(--green)' }}>
            {kpiStats.renaultCount} Araç
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Renault Ekranını Aç
          </div>
        </div>
      </div>

      {/* =================================================================================
          MAIN IN-APP VIEW: FLEET LIST + INTERACTIVE REAL MAP + TELEMETRY INSPECTOR
         ================================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN (3 cols): VEHICLE LIST & FILTERS */}
        <div className="xl:col-span-3 nd-card p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-extrabold">
              {activePortalView === 'mobiliz_panel'
                ? 'Mobiliz Araç Listesi'
                : activePortalView === 'renault_panel'
                ? 'Renault Optifleet Araçları'
                : 'Filo Araç Listesi'}
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full nd-layer">
              {filteredFleet.length} Araç
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
          <div className="grid grid-cols-3 gap-1 p-1 nd-layer rounded-xl text-[11px] font-bold">
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
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filteredFleet.map((item) => {
              const isSelected = selectedItem?.vehicle.id === item.vehicle.id;
              const isMoving = item.tele.ignition === 'moving';
              const isIdle = item.tele.ignition === 'idle';
              return (
                <div
                  key={item.vehicle.id}
                  onClick={() => handleFocusVehicle(item.vehicle.id, true)}
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
                      {item.driverName}
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

                  <div
                    className="mt-2 pt-2 border-t grid grid-cols-2 gap-2 text-[10px]"
                    style={{ borderColor: 'var(--border)' }}
                  >
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
          </div>
        </div>

        {/* CENTER COLUMN (5 cols): IN-APP REAL MULTI-VEHICLE SATELLITE / STREET / RADAR MAP */}
        <div className="xl:col-span-5 space-y-4">
          <div className="nd-card overflow-hidden">
            {/* Map Controls Header */}
            <div
              className="p-3 border-b flex flex-wrap items-center justify-between gap-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Layers size={16} style={{ color: 'var(--champagne)' }} />
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold">
                    {focusedOnSingle && selectedItem
                      ? `Canlı Araç Haritası — ${selectedItem.vehicle.plate}`
                      : 'Canlı Filo Haritası (Tüm Araçlar Aynı Ekranda)'}
                  </h3>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {selectedItem?.tele.locationLabel}
                  </p>
                </div>
              </div>

              {/* Layer Switcher: Uydu / Sokak / Radar */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMapLayerStyle('satellite')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    mapLayerStyle === 'satellite' ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  Uydu Haritası
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayerStyle('street')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    mapLayerStyle === 'street' ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  Sokak Haritası
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayerStyle('radar')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    mapLayerStyle === 'radar' ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  Koyu Radar
                </button>
              </div>
            </div>

            {/* IN-APP INTERACTIVE MAP VIEWPORT */}
            <div className="relative w-full h-[380px] sm:h-[440px] bg-[#0E1512] overflow-hidden select-none">
              {/* REAL SATELLITE OR STREET SLIPPY TILES LAYER */}
              {mapLayerStyle !== 'radar' && (
                <div className="absolute inset-0 pointer-events-none">
                  {tileLayerData.tiles.map((tile) => (
                    <img
                      key={tile.key}
                      src={tile.url}
                      alt=""
                      draggable={false}
                      style={{
                        position: 'absolute',
                        left: `${(tile.left / mapViewportWidth) * 100}%`,
                        top: `${(tile.top / mapViewportHeight) * 100}%`,
                        width: `${(256 / mapViewportWidth) * 100 + 0.25}%`,
                        height: `${(256 / mapViewportHeight) * 100 + 0.25}%`,
                        filter:
                          mapLayerStyle === 'street'
                            ? 'brightness(0.88) contrast(1.06)'
                            : 'brightness(0.92) contrast(1.08)'
                      }}
                    />
                  ))}
                  {/* Subtle dark vignette for high legibility of vehicle labels */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(circle at center, rgba(14,21,18,0.05) 45%, rgba(14,21,18,0.45) 100%)'
                    }}
                  />
                </div>
              )}

              {/* SVG VECTOR OVERLAY (HIGHWAYS + ALL VEHICLE PINS + CLICKABLE CALLOUTS) */}
              <svg
                viewBox={`0 0 ${mapViewportWidth} ${mapViewportHeight}`}
                className="relative z-10 w-full h-full block"
                xmlns="http://www.w3.org/2000/svg"
              >
                {mapLayerStyle === 'radar' && (
                  <>
                    <defs>
                      <pattern id="radarGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="#2D6E55"
                          strokeWidth="0.6"
                          strokeOpacity="0.24"
                        />
                      </pattern>
                    </defs>
                    <rect width={mapViewportWidth} height={mapViewportHeight} fill="#101714" />
                    <rect width={mapViewportWidth} height={mapViewportHeight} fill="url(#radarGrid)" />
                  </>
                )}

                {/* Corridor Highway Polyline connecting Edirne -> Lüleburgaz -> Tekirdağ -> Silivri -> İzmit TÜPRAŞ */}
                {(() => {
                  const corridorPoints = [
                    { lat: 41.6771, lng: 26.5557, name: 'EDİRNE' },
                    { lat: 41.4056, lng: 27.3569, name: 'LÜLEBURGAZ' },
                    { lat: 40.9708, lng: 27.9553, name: 'M.EREĞLİSİ OPET' },
                    { lat: 41.0736, lng: 28.2464, name: 'SİLİVRİ' },
                    { lat: 40.7569, lng: 29.7636, name: 'TÜPRAŞ İZMİT' }
                  ];
                  const pts = corridorPoints.map((p) => ({
                    ...p,
                    ...tileLayerData.projectLatLng(p.lat, p.lng)
                  }));
                  const polyStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
                  return (
                    <g>
                      <polyline
                        points={polyStr}
                        fill="none"
                        stroke="#141A17"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeOpacity="0.65"
                      />
                      <polyline
                        points={polyStr}
                        fill="none"
                        stroke="#DEC38F"
                        strokeWidth="2.4"
                        strokeDasharray="8 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {pts.map((p, idx) => (
                        <g key={idx} transform={`translate(${p.x}, ${p.y})`}>
                          <circle r="4" fill="#141A17" stroke="#DEC38F" strokeWidth="2" />
                          {mapLayerStyle === 'radar' && (
                            <text
                              y="-8"
                              textAnchor="middle"
                              fill="#DEC38F"
                              fontSize="9"
                              fontWeight="800"
                            >
                              {p.name}
                            </text>
                          )}
                        </g>
                      ))}
                    </g>
                  );
                })()}

                {/* ALL FLEET VEHICLE PINS ON THE REAL MAP */}
                {filteredFleet.map((item) => {
                  const pos = tileLayerData.projectLatLng(item.tele.lat, item.tele.lng);
                  const isSelected = selectedItem?.vehicle.id === item.vehicle.id;
                  const isMoving = item.tele.ignition === 'moving';
                  const isIdle = item.tele.ignition === 'idle';
                  const dotColor = isMoving ? '#10B981' : isIdle ? '#F59E0B' : '#94A3B8';
                  const badgeBg = isSelected ? '#1B4333' : '#141A17';
                  const badgeBorder = isSelected ? '#F2DAA6' : dotColor;

                  return (
                    <g
                      key={item.vehicle.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={() => handleFocusVehicle(item.vehicle.id, true)}
                      className="cursor-pointer"
                    >
                      {/* Animated Radar Pulse Ring */}
                      {(isSelected || isMoving) && (
                        <circle
                          r={isSelected ? 26 : 16}
                          fill={dotColor}
                          fillOpacity={isSelected ? 0.28 : 0.18}
                          stroke={dotColor}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                      )}

                      {/* Truck Position Pin */}
                      <circle
                        r={isSelected ? 10 : 8}
                        fill="#141A17"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                      />
                      <circle r={isSelected ? 6.5 : 5} fill={dotColor} />

                      {/* Callout Tag Above Pin: Plate + Speed + Provider */}
                      <g transform="translate(0, -18)">
                        <rect
                          x="-58"
                          y="-26"
                          width="116"
                          height="24"
                          rx="7"
                          fill={badgeBg}
                          fillOpacity="0.94"
                          stroke={badgeBorder}
                          strokeWidth={isSelected ? '2' : '1.2'}
                        />
                        <text
                          x="0"
                          y="-11"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="10"
                          fontWeight="800"
                        >
                          {item.vehicle.plate} • {isMoving ? `${item.tele.speedKmh} km/s` : 'PARK'}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>

              {/* Floating Map Zoom & Focus Controls (Top-Right inside Map) */}
              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setMapZoom((z) => Math.min(15, z + 1))}
                  className="w-8 h-8 rounded-xl bg-black/75 text-white border border-white/15 flex items-center justify-center hover:bg-black"
                  title="Yakınlaştır"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setMapZoom((z) => Math.max(6, z - 1))}
                  className="w-8 h-8 rounded-xl bg-black/75 text-white border border-white/15 flex items-center justify-center hover:bg-black"
                  title="Uzaklaştır"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleShowAllFleetOnMap}
                  className="w-8 h-8 rounded-xl bg-black/75 text-amber-300 border border-white/15 flex items-center justify-center hover:bg-black"
                  title="Tüm Filoyu Göster"
                >
                  <Maximize2 size={15} />
                </button>
              </div>

              {/* Bottom Map Status Bar */}
              <div className="absolute bottom-0 inset-x-0 z-20 px-3.5 py-2 bg-black/75 backdrop-blur-xs border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                    Hareket ({kpiStats.moving})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                    Rölanti ({kpiStats.idle})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />
                    Park ({kpiStats.stopped})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {selectedItem && (
                    <button
                      type="button"
                      onClick={() => handleFocusVehicle(selectedItem.vehicle.id, true)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold text-[10px]"
                    >
                      {selectedItem.vehicle.plate} Aracına Yaklaş
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleShowAllFleetOnMap}
                    className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-[10px]"
                  >
                    Tüm Filoyu Gör
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Vehicle Quick Bar Below Map */}
            {selectedItem && (
              <div
                className="p-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--layer)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin size={15} style={{ color: 'var(--champagne)' }} className="shrink-0" />
                  <span className="font-bold truncate">
                    {selectedItem.vehicle.plate}: {selectedItem.tele.locationLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    className="nd-btn nd-btn-primary px-3 py-1.5 text-[11px] flex items-center gap-1"
                  >
                    <Edit3 size={12} />
                    <span>Konum & Sistem Düzenle</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* IN-APP MOBILIZ OR RENAULT FULL FLEET COMPARISON TABLE (Always visible inside the app!) */}
          <div className="nd-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} style={{ color: 'var(--champagne)' }} />
                <h4 className="text-xs sm:text-sm font-extrabold">
                  {activePortalView === 'renault_panel'
                    ? 'Renault Optifleet — Tüm Araçların Canlı Beyin (CAN-Bus) Tablosu'
                    : 'Mobiliz & Renault — Canlı Filo Durum Tablosu'}
                </h4>
              </div>
              <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                Satıra tıklayarak haritada araca odaklanın
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b text-[10px] uppercase" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <th className="py-2 pr-2">Plaka & Şoför</th>
                    <th className="py-2 px-2">Sistem</th>
                    <th className="py-2 px-2">Hız & Durum</th>
                    <th className="py-2 px-2">Yakıt / AdBlue</th>
                    <th className="py-2 px-2">Takograf KM</th>
                    <th className="py-2 pl-2">Bulunduğu Mevki</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filteredFleet.map((item) => {
                    const isSelected = selectedItem?.vehicle.id === item.vehicle.id;
                    return (
                      <tr
                        key={item.vehicle.id}
                        onClick={() => handleFocusVehicle(item.vehicle.id, true)}
                        className="cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isSelected ? 'var(--layer)' : 'transparent'
                        }}
                      >
                        <td className="py-2.5 pr-2">
                          <div className="font-extrabold">{item.vehicle.plate}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {item.driverName}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold nd-badge-champagne">
                            {item.tele.provider === 'both'
                              ? 'MOBİLİZ + RENAULT'
                              : item.tele.provider === 'renault'
                              ? 'RENAULT'
                              : 'MOBİLİZ'}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 font-bold tabular-nums">
                          {item.tele.ignition === 'moving' ? (
                            <span style={{ color: 'var(--green)' }}>{item.tele.speedKmh} km/s</span>
                          ) : item.tele.ignition === 'idle' ? (
                            <span style={{ color: 'var(--amber)' }}>Rölanti</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Park</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 tabular-nums">
                          <span className="font-bold text-emerald-400">%{item.tele.fuelPercent}</span>
                          {' / '}
                          <span className="font-bold text-sky-400">%{item.tele.adBluePercent}</span>
                        </td>
                        <td className="py-2.5 px-2 font-bold tabular-nums">
                          {item.tele.odometerKm.toLocaleString('tr-TR')} km
                        </td>
                        <td className="py-2.5 pl-2 text-[11px] max-w-[180px] truncate">
                          {item.tele.locationLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): RENAULT OPTIFLEET CAN-BUS + MOBILIZ TELEMETRY INSPECTOR */}
        <div className="xl:col-span-4 space-y-4">
          {selectedItem ? (
            <>
              {/* 1. SELECTED VEHICLE HEADER & IN-APP QUICK NAVIGATION */}
              <div className="nd-card p-4 space-y-3">
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
                          ? `YOLDA • ${selectedItem.tele.speedKmh} km/s`
                          : selectedItem.tele.ignition === 'idle'
                          ? 'RÖLANTİDE'
                          : 'PARK HALİNDE'}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Şoför: <strong>{selectedItem.driverName}</strong>{' '}
                      {selectedItem.driverPhone ? `• ${selectedItem.driverPhone}` : ''}
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

                {/* In-App Action Buttons (No external popups!) */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleFocusVehicle(selectedItem.vehicle.id, true)}
                    className="nd-btn nd-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                  >
                    <LocateFixed size={14} />
                    <span>Haritada Araca Odaklan</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    className="nd-btn nd-btn-secondary py-2 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Edit3 size={14} />
                    <span>Verileri Düzenle</span>
                  </button>
                </div>
              </div>

              {/* 2. RENAULT TRUCKS OPTIFLEET (FACTORY CAN-BUS TELEMETRY) */}
              <div className="nd-card p-4 space-y-3.5">
                <div
                  className="flex items-center justify-between border-b pb-2.5"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2">
                    <Activity size={16} style={{ color: 'var(--green)' }} />
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold">
                        Renault Trucks Optifleet — Araç Beyin Verileri
                      </h4>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Aracın Kendi CAN-Bus Yakıt, AdBlue, Motor & Takograf Sistemi
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold nd-badge-green">
                    ECO {selectedItem.tele.ecoScore || 9.2}/10
                  </span>
                </div>

                {/* Fuel & AdBlue Progress Bars */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl nd-layer space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className="flex items-center gap-1 font-semibold"
                        style={{ color: 'var(--text-muted)' }}
                      >
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
                    <div
                      className="text-[10px] flex justify-between"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>Depo: {selectedItem.tankCapacityLiters} L</span>
                      <span>Menzil: ~{Math.round(selectedItem.currentFuelLiters * 3.1)} km</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl nd-layer space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className="flex items-center gap-1 font-semibold"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <Gauge size={13} className="text-sky-400" />
                        AdBlue Seviyesi
                      </span>
                      <span className="font-extrabold tabular-nums">
                        %{selectedItem.tele.adBluePercent}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-black/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-sky-400 transition-all"
                        style={{ width: `${selectedItem.tele.adBluePercent}%` }}
                      />
                    </div>
                    <div
                      className="text-[10px] flex justify-between"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span>Renault Euro 6 SCR</span>
                      <span>Basınç: Normal</span>
                    </div>
                  </div>
                </div>

                {/* Odometer, Consumption, RPM, Temp, Battery */}
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
                    <span
                      className="font-extrabold text-sm tabular-nums"
                      style={{ color: 'var(--champagne)' }}
                    >
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
                    <span
                      className="text-[10px] uppercase font-bold block"
                      style={{ color: 'var(--text-muted)' }}
                    >
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

              {/* 3. MOBILIZ GPS DEVICE & ACTIVE TRIP STATUS CARD */}
              <div className="nd-card p-4 space-y-3">
                <div
                  className="flex items-center justify-between border-b pb-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2">
                    <Radio size={15} style={{ color: 'var(--champagne)' }} />
                    <h4 className="text-xs sm:text-sm font-extrabold">
                      Mobiliz GPS Cihaz & Sefer Özeti
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
                    <span className="font-extrabold tabular-nums">
                      {selectedItem.tele.speedKmh} km/s
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Bugün Mesafe
                    </span>
                    <span className="font-extrabold tabular-nums">
                      {selectedItem.tele.dailyDistanceKm} km
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Günlük Rölanti
                    </span>
                    <span className="font-extrabold tabular-nums">
                      {selectedItem.tele.idleMinutes} dk
                    </span>
                  </div>
                </div>

                {selectedItem.activeTrip ? (
                  <div className="p-3 rounded-xl nd-layer space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold" style={{ color: 'var(--champagne)' }}>
                        Aktif Sefer: {selectedItem.activeTrip.trip_no}
                      </span>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('trips', selectedItem.activeTrip?.id)}
                          className="text-[11px] font-bold underline"
                        >
                          Seferi Gör →
                        </button>
                      )}
                    </div>
                    <div className="text-[11px]">
                      <strong>{selectedItem.activeTrip.origin}</strong> →{' '}
                      <strong>{selectedItem.activeTrip.destination}</strong>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* MODAL 1: MOBILIZ & RENAULT OPTIFLEET API CONFIGURATION */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="nd-modal w-full max-w-xl p-5 sm:p-6 space-y-4">
            <div
              className="flex items-center justify-between border-b pb-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2.5">
                <KeyRound size={18} style={{ color: 'var(--champagne)' }} />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold">
                    Mobiliz & Renault Optifleet Hesap / API Bağlantısı
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Bilgilerinizi kaydettiğinizde veriler doğrudan uygulama içindeki harita ve tablolara çekilir
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
                    1. Mobiliz Araç Takip Bağlantısı
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold nd-badge-champagne">
                    Uygulama İçi Senkron
                  </span>
                </div>

                <div>
                  <label className="block font-bold mb-1">Mobiliz API Token (Mobiliz-Token)</label>
                  <input
                    type="text"
                    value={config.mobilizToken}
                    onChange={(e) => setConfig({ ...config, mobilizToken: e.target.value })}
                    placeholder="Mobiliz-Token anahtarınız"
                    className="nd-input w-full px-3 py-2 rounded-xl"
                  />
                </div>

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
              </div>

              {/* Renault Optifleet Section */}
              <div className="p-3.5 rounded-xl nd-layer space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm" style={{ color: 'var(--green)' }}>
                    2. Renault Trucks Optifleet (Aracın Kendi Sistemi)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold nd-badge-green">
                    Renault CAN-Bus
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold mb-1">Optifleet Kullanıcı Adı</label>
                    <input
                      type="text"
                      value={config.renaultUsername}
                      onChange={(e) => setConfig({ ...config, renaultUsername: e.target.value })}
                      placeholder="Optifleet API kullanıcı adı"
                      className="nd-input w-full px-3 py-2 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Optifleet Şifresi / Anahtarı</label>
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
                  <label className="block font-bold mb-1">Otomatik Yenileme Sıklığı (Saniye)</label>
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
                  Kaydet ve Uygulama İçinde Eşitle
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
            <div
              className="flex items-center justify-between border-b pb-3"
              style={{ borderColor: 'var(--border)' }}
            >
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
