import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LocateFixed,
  Navigation,
  Truck,
  Fuel,
  Gauge,
  Radio,
  RefreshCw,
  MapPin,
  Clock,
  Activity,
  Search,
  Compass,
  Play,
  Pause,
  Edit3,
  X,
  BatteryCharging,
  Thermometer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  History,
  ArrowLeft,
  ArrowRight,
  Columns,
  Globe,
  Lock
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
export type TrackingScreenTab = 'mobiliz_site' | 'renault_site' | 'split_sites' | 'internal_map';
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

function lngToTileX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * Math.pow(2, zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
}

// Embedded Live Website Box (Uses Electron <webview> on Desktop for 100% login compatibility + persistent cookies, and <iframe> on Mobile)
interface EmbeddedPortalBoxProps {
  title: string;
  badgeText: string;
  badgeClass: string;
  initialUrl: string;
  storageKey: string;
  presets: { label: string; url: string }[];
  isFullHeight?: boolean;
}

const EmbeddedPortalBox: React.FC<EmbeddedPortalBoxProps> = ({
  title,
  badgeText,
  badgeClass,
  initialUrl,
  storageKey,
  presets
}) => {
  const isElectron =
    typeof window !== 'undefined' &&
    (Boolean((window as any).api) || navigator.userAgent.includes('Electron'));
  const [currentUrl, setCurrentUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || initialUrl;
    } catch {
      return initialUrl;
    }
  });
  const [urlInput, setUrlInput] = useState<string>(currentUrl);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [reloadCounter, setReloadCounter] = useState<number>(0);
  const webviewRef = useRef<any>(null);

  const navigateTo = (targetUrl: string) => {
    let formatted = targetUrl.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = 'https://' + formatted;
    }
    setCurrentUrl(formatted);
    setUrlInput(formatted);
    try {
      localStorage.setItem(storageKey, formatted);
    } catch {}
    if (isElectron && webviewRef.current) {
      try {
        webviewRef.current.loadURL(formatted);
      } catch {}
    }
  };

  const handleGoBack = () => {
    if (isElectron && webviewRef.current) {
      try {
        if (webviewRef.current.canGoBack()) webviewRef.current.goBack();
      } catch {}
    }
  };

  const handleGoForward = () => {
    if (isElectron && webviewRef.current) {
      try {
        if (webviewRef.current.canGoForward()) webviewRef.current.goForward();
      } catch {}
    }
  };

  const handleReload = () => {
    if (isElectron && webviewRef.current) {
      try {
        webviewRef.current.reload();
        return;
      } catch {}
    }
    setReloadCounter((c) => c + 1);
  };

  return (
    <div
      className={`nd-card overflow-hidden flex flex-col ${
        isMaximized ? 'fixed inset-2 z-50 shadow-2xl' : 'w-full'
      }`}
      style={{
        height: isMaximized ? 'calc(100dvh - 16px)' : 'calc(100dvh - 210px)',
        minHeight: '560px'
      }}
    >
      {/* Top Browser Toolbar inside the App */}
      <div
        className="px-3 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div className="flex items-center gap-2">
          <Globe size={16} style={{ color: 'var(--champagne)' }} />
          <span className="font-extrabold text-xs sm:text-sm">{title}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${badgeClass}`}>
            {badgeText}
          </span>
        </div>

        {/* Preset Quick Switch Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((p, idx) => {
            const active = currentUrl.includes(p.url.replace('https://', '').replace('www.', ''));
            return (
              <button
                key={idx}
                type="button"
                onClick={() => navigateTo(p.url)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  active ? 'nd-btn-primary' : 'nd-layer hover:opacity-100 opacity-85'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Navigation & URL Bar */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[240px] max-w-md">
          <button
            type="button"
            onClick={handleGoBack}
            className="p-1.5 rounded-lg nd-layer"
            title="Geri"
          >
            <ArrowLeft size={14} />
          </button>
          <button
            type="button"
            onClick={handleGoForward}
            className="p-1.5 rounded-lg nd-layer"
            title="İleri"
          >
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            onClick={handleReload}
            className="p-1.5 rounded-lg nd-layer"
            title="Sayfayı Yenile"
          >
            <RefreshCw size={14} />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigateTo(urlInput);
            }}
            className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg nd-layer text-[11px]"
          >
            <Lock size={11} style={{ color: 'var(--green)' }} className="shrink-0" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-[11px] font-medium"
            />
          </form>

          <button
            type="button"
            onClick={() => setIsMaximized((prev) => !prev)}
            className="p-1.5 rounded-lg nd-layer"
            title={isMaximized ? 'Normal Boyuta Dön' : 'Ekranı Büyüt'}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Live Website Viewport */}
      <div className="flex-1 w-full bg-[#141A17] relative overflow-hidden flex">
        {isElectron ? (
          React.createElement('webview' as any, {
            ref: webviewRef,
            key: reloadCounter,
            src: currentUrl,
            partition: 'persist:nakliye_tracking_v45',
            style: {
              display: 'inline-flex',
              width: '100%',
              height: '100%',
              flex: '1 1 auto',
              border: 'none'
            }
          })
        ) : (
          <iframe
            key={`${currentUrl}-${reloadCounter}`}
            src={currentUrl}
            title={title}
            className="w-full h-full border-0 flex-1"
            allow="geolocation *; fullscreen *"
          />
        )}
      </div>
    </div>
  );
};

export const VehicleTrackingModule: React.FC<VehicleTrackingModuleProps> = ({ onNavigate }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() =>
    new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Default to Mobiliz Live Site Screen or Split Screen so user immediately sees the login page!
  const [screenTab, setScreenTab] = useState<TrackingScreenTab>('mobiliz_site');
  const [mapLayerStyle, setMapLayerStyle] = useState<MapLayerStyle>('satellite');
  const [mapZoom, setMapZoom] = useState<number>(8);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 41.18,
    lng: 27.95
  });
  const [focusedOnSingle, setFocusedOnSingle] = useState<boolean>(false);

  // Filter & Selection States for Internal Map Tab
  const [providerFilter, setProviderFilter] = useState<'all' | 'mobiliz' | 'renault'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | IgnitionState>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [liveSimActive, setLiveSimActive] = useState<boolean>(true);
  const [editModalOpen, setEditModalOpen] = useState(false);

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

  // Initialize telemetry for internal map
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
      }
    });

    if (changed) {
      saveOverrides(next);
    }
  }, [vehicles, trips, overrides, saveOverrides]);

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
        ) || null;

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

  if (loading) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Araç takip ekranları hazırlanıyor...
      </div>
    );
  }

  return (
    <div className="p-2.5 sm:p-4 md:p-5 space-y-3.5 max-w-[1720px] mx-auto">
      {/* TOP BAR: DIRECT EMBEDDED SITE TABS (MOBILIZ SITE / RENAULT SITE / SPLIT / INTERNAL MAP) */}
      <div className="nd-card p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #2D6E55 0%, #1B4333 100%)',
              border: '1px solid rgba(222, 195, 143, 0.45)'
            }}
          >
            <LocateFixed size={20} className="text-amber-200" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
              Araç Takip — Mobiliz & Renault Optifleet Doğrudan Giriş Ekranı
            </h2>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              API anahtarına gerek olmadan doğrudan aşağıdan <strong>Mobiliz</strong> ve{' '}
              <strong>Renault Optifleet</strong> sitelerine kullanıcı adı ve şifrenizle giriş yapıp araçlarınızı takip edebilirsiniz.
            </p>
          </div>
        </div>

        {/* 4 MAIN SCREEN MODE BUTTONS */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl nd-layer">
          <button
            type="button"
            onClick={() => setScreenTab('mobiliz_site')}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              screenTab === 'mobiliz_site' ? 'nd-btn-primary shadow-sm' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <Radio size={14} style={{ color: 'var(--champagne)' }} />
            <span>1. Mobiliz Giriş & Takip Ekranı</span>
          </button>

          <button
            type="button"
            onClick={() => setScreenTab('renault_site')}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              screenTab === 'renault_site' ? 'nd-btn-primary shadow-sm' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <Activity size={14} style={{ color: 'var(--green)' }} />
            <span>2. Renault Optifleet Giriş & Takip Ekranı</span>
          </button>

          <button
            type="button"
            onClick={() => setScreenTab('split_sites')}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              screenTab === 'split_sites' ? 'nd-btn-primary shadow-sm' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <Columns size={14} />
            <span>İkisi Yan Yana (Mobiliz + Renault)</span>
          </button>

          <button
            type="button"
            onClick={() => setScreenTab('internal_map')}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
              screenTab === 'internal_map' ? 'nd-btn-primary shadow-sm' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <Compass size={14} />
            <span>Defter İçi Özet Harita</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          PERSISTENTLY MOUNTED MOBILIZ & RENAULT LIVE WEB PORTALS
          (Never using display:none so Electron <webview> guest processes initialize immediately!)
         ========================================================================= */}
      <div
        className={
          screenTab === 'split_sites'
            ? 'grid grid-cols-1 xl:grid-cols-2 gap-3.5 relative'
            : 'relative'
        }
        style={
          screenTab === 'internal_map'
            ? {
                position: 'fixed',
                left: '-9999px',
                top: 0,
                width: '1024px',
                height: '700px',
                opacity: 0,
                pointerEvents: 'none'
              }
            : undefined
        }
      >
        {/* MOBILIZ LIVE WEBSITE VIEWPORT */}
        <div
          style={
            screenTab === 'mobiliz_site' || screenTab === 'split_sites'
              ? undefined
              : {
                  position: 'fixed',
                  left: '-9999px',
                  top: 0,
                  width: '900px',
                  height: '650px',
                  opacity: 0,
                  pointerEvents: 'none'
                }
          }
        >
          <EmbeddedPortalBox
            title="Mobiliz Araç Takip Sistemi"
            badgeText="MOBİLİZ CANLI EKRAN"
            badgeClass="nd-badge-champagne"
            initialUrl="https://ng.mobiliz.com.tr"
            storageKey="nd_portal_url_mobiliz_v2"
            presets={[
              { label: 'Mobiliz Giriş Paneli (ng.mobiliz.com.tr)', url: 'https://ng.mobiliz.com.tr' },
              { label: 'Mobiliz Web (mobiliz.com.tr)', url: 'https://www.mobiliz.com.tr' }
            ]}
          />
        </div>

        {/* RENAULT OPTIFLEET LIVE WEBSITE VIEWPORT */}
        <div
          style={
            screenTab === 'renault_site' || screenTab === 'split_sites'
              ? undefined
              : {
                  position: 'fixed',
                  left: '-9999px',
                  top: 0,
                  width: '900px',
                  height: '650px',
                  opacity: 0,
                  pointerEvents: 'none'
                }
          }
        >
          <EmbeddedPortalBox
            title="Renault Trucks Optifleet (Aracın Kendi Takip Sistemi)"
            badgeText="RENAULT OPTIFLEET CANLI EKRAN"
            badgeClass="nd-badge-green"
            initialUrl="https://www.volvoconnect.com"
            storageKey="nd_portal_url_renault_v2"
            presets={[
              { label: 'Renault / Volvo Connect Giriş', url: 'https://www.volvoconnect.com' },
              { label: 'Optifleet Portal (optifleet.net)', url: 'https://optifleet.net' }
            ]}
          />
        </div>
      </div>

      {/* =========================================================================
          4TH TAB: INTERNAL FLEET MAP & TELEMETRY SUMMARY
         ========================================================================= */}
      {screenTab === 'internal_map' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* LEFT COLUMN: VEHICLE LIST */}
          <div className="xl:col-span-3 nd-card p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-extrabold">Kayıtlı Filo Araçları</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full nd-layer">
                {filteredFleet.length} Araç
              </span>
            </div>

            <div className="nd-layer flex items-center gap-2 px-3 py-2 rounded-xl">
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Plaka veya şoför ara..."
                className="bg-transparent border-none outline-none text-xs w-full"
              />
            </div>

            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
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
                      <span className="font-extrabold text-xs sm:text-sm">{item.vehicle.plate}</span>
                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold rounded nd-badge-champagne">
                        {isMoving ? `${item.tele.speedKmh} km/s` : isIdle ? 'Rölanti' : 'Park'}
                      </span>
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Şoför: {item.driverName}
                    </div>
                    <div className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {item.tele.locationLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CENTER COLUMN: SATELLITE / STREET MAP */}
          <div className="xl:col-span-5 nd-card overflow-hidden">
            <div
              className="p-3 border-b flex flex-wrap items-center justify-between gap-2"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Layers size={16} style={{ color: 'var(--champagne)' }} />
                <span className="text-xs sm:text-sm font-extrabold">
                  Defter İçi Uydu & Sokak Haritası
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMapLayerStyle('satellite')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    mapLayerStyle === 'satellite' ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  Uydu
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayerStyle('street')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    mapLayerStyle === 'street' ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  Sokak
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayerStyle('radar')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    mapLayerStyle === 'radar' ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  Radar
                </button>
              </div>
            </div>

            <div className="relative w-full h-[420px] bg-[#0E1512] overflow-hidden select-none">
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
                        height: `${(256 / mapViewportHeight) * 100 + 0.25}%`
                      }}
                    />
                  ))}
                </div>
              )}

              <svg
                viewBox={`0 0 ${mapViewportWidth} ${mapViewportHeight}`}
                className="relative z-10 w-full h-full block"
              >
                {filteredFleet.map((item) => {
                  const pos = tileLayerData.projectLatLng(item.tele.lat, item.tele.lng);
                  const isSelected = selectedItem?.vehicle.id === item.vehicle.id;
                  return (
                    <g
                      key={item.vehicle.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={() => handleFocusVehicle(item.vehicle.id, true)}
                      className="cursor-pointer"
                    >
                      <circle r={isSelected ? 10 : 8} fill="#141A17" stroke="#FFFFFF" strokeWidth="2" />
                      <circle r={isSelected ? 6 : 4.5} fill="#10B981" />
                      <g transform="translate(0, -16)">
                        <rect
                          x="-52"
                          y="-22"
                          width="104"
                          height="20"
                          rx="6"
                          fill="#141A17"
                          stroke="#DEC38F"
                          strokeWidth="1.2"
                        />
                        <text
                          x="0"
                          y="-9"
                          textAnchor="middle"
                          fill="#FFFFFF"
                          fontSize="9.5"
                          fontWeight="800"
                        >
                          {item.vehicle.plate}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>

              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setMapZoom((z) => Math.min(15, z + 1))}
                  className="w-8 h-8 rounded-xl bg-black/75 text-white border border-white/15 flex items-center justify-center"
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setMapZoom((z) => Math.max(6, z - 1))}
                  className="w-8 h-8 rounded-xl bg-black/75 text-white border border-white/15 flex items-center justify-center"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleShowAllFleetOnMap}
                  className="w-8 h-8 rounded-xl bg-black/75 text-amber-300 border border-white/15 flex items-center justify-center"
                >
                  <Maximize2 size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: SELECTED VEHICLE SUMMARY */}
          <div className="xl:col-span-4 space-y-4">
            {selectedItem && (
              <div className="nd-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-extrabold">{selectedItem.vehicle.plate}</h4>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Şoför: {selectedItem.driverName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenEditModal}
                    className="nd-btn nd-btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
                  >
                    <Edit3 size={13} />
                    <span>Düzenle</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Depo Yakıt
                    </span>
                    <span className="font-extrabold">
                      %{selectedItem.tele.fuelPercent} ({selectedItem.currentFuelLiters} L)
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      AdBlue
                    </span>
                    <span className="font-extrabold">%{selectedItem.tele.adBluePercent}</span>
                  </div>
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Takograf KM
                    </span>
                    <span className="font-extrabold">
                      {selectedItem.tele.odometerKm.toLocaleString('tr-TR')} km
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl nd-layer">
                    <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>
                      Anlık Hız
                    </span>
                    <span className="font-extrabold">{selectedItem.tele.speedKmh} km/s</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT VEHICLE TELEMETRY MODAL */}
      {editModalOpen && selectedItem && editForm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="nd-modal w-full max-w-lg p-5 space-y-4">
            <div
              className="flex items-center justify-between border-b pb-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <h3 className="text-sm font-extrabold">
                {selectedItem.vehicle.plate} — Konum & Bilgileri Güncelle
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 rounded-lg nd-layer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditModal} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Bulunduğu Mevki</label>
                <input
                  type="text"
                  value={editForm.locationLabel}
                  onChange={(e) => setEditForm({ ...editForm, locationLabel: e.target.value })}
                  className="nd-input w-full px-3 py-2 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block font-bold mb-1">Hız (km/s)</label>
                  <input
                    type="number"
                    value={editForm.speedKmh}
                    onChange={(e) => setEditForm({ ...editForm, speedKmh: Number(e.target.value) })}
                    className="nd-input w-full px-2.5 py-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Yakıt (%)</label>
                  <input
                    type="number"
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
                    value={editForm.adBluePercent}
                    onChange={(e) =>
                      setEditForm({ ...editForm, adBluePercent: Number(e.target.value) })
                    }
                    className="nd-input w-full px-2.5 py-1.5 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">KM</label>
                  <input
                    type="number"
                    value={editForm.odometerKm}
                    onChange={(e) =>
                      setEditForm({ ...editForm, odometerKm: Number(e.target.value) })
                    }
                    className="nd-input w-full px-2.5 py-1.5 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="nd-btn nd-btn-secondary px-4 py-2 text-xs"
                >
                  Vazgeç
                </button>
                <button type="submit" className="nd-btn nd-btn-primary px-5 py-2 text-xs font-extrabold">
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
