import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FolderCheck,
  ChevronDown,
  Truck,
  Bell,
  BellOff,
  Save,
  Plus,
  Trash2,
  Upload,
  Download,
  Eye,
  X,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Send,
  Cloud,
  RefreshCw,
  Search
} from 'lucide-react';
import {
  Vehicle,
  VehicleDocumentRecord,
  VehicleDocumentFile,
  VehicleDocumentExtraItem
} from '../../shared/types';
import { api, getCached } from '../api';
import { ensureDocumentFileDownloaded } from '../api/cloudSync';
import {
  syncVehicleDocumentReminderNotifications,
  sendTestVehicleDocNotification
} from '../api/notifications';
import { formatDate, getDaysRemaining } from '../utils/format';
import { confirmDialog, alertDialog } from '../utils/dialog';

interface VehicleDocsModuleProps {
  highlightVehicleId?: string;
  onDataChanged?: () => void;
}

const DOC_CATEGORIES = [
  'Araç Ruhsatı',
  'ADR Belgesi',
  'Trafik Sigortası',
  'Kasko Poliçesi',
  'Muayene Belgesi',
  'Tehlikeli Madde / Atık Poliçesi',
  'Taşıt Kartı / Yetki Belgesi',
  'Diğer Evrak'
];

function createEmptyDocRecord(vehicle: Vehicle): VehicleDocumentRecord {
  return {
    id: `vdoc_${vehicle.id}`,
    vehicle_id: vehicle.id,
    vehicle_plate: vehicle.plate,
    traffic_insurance_end: vehicle.insurance_date || '',
    traffic_insurance_remind: 1,
    kasko_end: '',
    kasko_remind: 1,
    inspection_end: vehicle.inspection_date || '',
    inspection_remind: 1,
    adr_other_label: 'ADR - Diğer Belge Bitiş Tarihi',
    adr_other_end: '',
    adr_other_remind: 1,
    hazmat_policy_start: '',
    hazmat_policy_start_remind: 1,
    hazmat_policy_end: '',
    hazmat_policy_end_remind: 1,
    reminder_days_before: 30,
    extra_info: '',
    extra_items: []
  };
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function compressDocumentFile(file: File): Promise<{
  dataUrl: string;
  mimeType: string;
  size: number;
}> {
  if (!file.type.startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        resolve({
          dataUrl: result,
          mimeType: file.type || 'application/octet-stream',
          size: file.size || result.length
        });
      };
      reader.onerror = () => reject(new Error('Dosya okunamadı.'));
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ dataUrl: rawUrl, mimeType: file.type, size: file.size });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve({
            dataUrl: compressed.length < rawUrl.length ? compressed : rawUrl,
            mimeType: compressed.length < rawUrl.length ? 'image/jpeg' : file.type,
            size: Math.round((Math.min(compressed.length, rawUrl.length) * 3) / 4)
          });
        } catch {
          resolve({ dataUrl: rawUrl, mimeType: file.type, size: file.size });
        }
      };
      img.onerror = () => resolve({ dataUrl: rawUrl, mimeType: file.type, size: file.size });
      img.src = rawUrl;
    };
    reader.onerror = () => reject(new Error('Görsel okunamadı.'));
    reader.readAsDataURL(file);
  });
}

function getCountdownBadge(dateStr?: string | null, thresholdDays = 30) {
  if (!dateStr) {
    return {
      text: 'Tarih Girilmedi',
      badgeClass: 'nd-layer',
      textColor: 'var(--text-dim)',
      isAlert: false
    };
  }
  const days = getDaysRemaining(dateStr);
  if (days === null) {
    return { text: '-', badgeClass: 'nd-layer', textColor: 'var(--text-dim)', isAlert: false };
  }
  if (days < 0) {
    return {
      text: `${Math.abs(days)} gün geçti`,
      badgeClass: 'nd-badge-red',
      textColor: 'var(--red)',
      isAlert: true
    };
  }
  if (days === 0) {
    return {
      text: 'BUGÜN SON GÜN!',
      badgeClass: 'nd-badge-red',
      textColor: 'var(--red)',
      isAlert: true
    };
  }
  if (days <= thresholdDays) {
    return {
      text: `Kalan ${days} gün (Bildirim Aktif)`,
      badgeClass: days <= 7 ? 'nd-badge-red' : 'nd-badge-amber',
      textColor: days <= 7 ? 'var(--red)' : 'var(--amber)',
      isAlert: true
    };
  }
  return {
    text: `Kalan ${days} gün`,
    badgeClass: 'nd-badge-green',
    textColor: 'var(--green)',
    isAlert: false
  };
}

interface DateReminderRowProps {
  title: string;
  subtitle?: string;
  dateValue: string;
  remindEnabled: boolean;
  thresholdDays: number;
  isStartDate?: boolean;
  editableTitle?: boolean;
  onTitleChange?: (val: string) => void;
  onDateChange: (val: string) => void;
  onRemindToggle: () => void;
}

const DateReminderRow: React.FC<DateReminderRowProps> = ({
  title,
  subtitle,
  dateValue,
  remindEnabled,
  thresholdDays,
  isStartDate,
  editableTitle,
  onTitleChange,
  onDateChange,
  onRemindToggle
}) => {
  const badge = getCountdownBadge(dateValue, thresholdDays);

  return (
    <div
      className="nd-layer p-3.5 rounded-xl border transition-all space-y-2.5"
      style={{
        borderColor:
          remindEnabled && badge.isAlert ? badge.textColor : 'var(--border)'
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {editableTitle && onTitleChange ? (
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="nd-input py-1 px-2 text-xs font-extrabold w-full"
              placeholder="ADR / Özel Belge Adı"
            />
          ) : (
            <h4 className="text-xs font-extrabold leading-snug">{title}</h4>
          )}
          {subtitle && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>

        <span
          className={`${badge.badgeClass} px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 tabular-nums`}
        >
          {isStartDate && dateValue && !badge.isAlert ? `Tarih: ${formatDate(dateValue)}` : badge.text}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[155px]">
          <Calendar
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--accent)' }}
          />
          <input
            type="date"
            value={dateValue || ''}
            onChange={(e) => onDateChange(e.target.value)}
            className="nd-input w-full pl-8 pr-2.5 py-2 text-xs font-bold tabular-nums"
          />
        </div>

        <button
          type="button"
          onClick={onRemindToggle}
          className={`px-3 py-2 rounded-xl text-[11px] font-extrabold flex items-center gap-1.5 transition-all border shrink-0 ${
            remindEnabled ? 'nd-badge-green' : 'nd-layer opacity-75'
          }`}
          style={{
            borderColor: remindEnabled ? 'var(--green)' : 'var(--border)'
          }}
          title={
            remindEnabled
              ? `${thresholdDays} gün (1 ay) kala PC, Android ve iOS cihazlara otomatik bildirim gider`
              : 'Hatırlatıcı kapalı (Açmak için tıklayın)'
          }
        >
          {remindEnabled ? <Bell size={13} /> : <BellOff size={13} />}
          <span>{remindEnabled ? 'Hatırlatıcı Açık' : 'Hatırlatıcı Kapalı'}</span>
        </button>
      </div>
    </div>
  );
};

export const VehicleDocsModule: React.FC<VehicleDocsModuleProps> = ({
  highlightVehicleId,
  onDataChanged
}) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => getCached<Vehicle[]>('vehicles') || []);
  const [docs, setDocs] = useState<VehicleDocumentRecord[]>(
    () => getCached<VehicleDocumentRecord[]>('vehicleDocs:all') || []
  );
  const [files, setFiles] = useState<VehicleDocumentFile[]>(
    () => getCached<VehicleDocumentFile[]>('vehicleDocFiles:all') || []
  );

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(highlightVehicleId || '');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [plateSearch, setPlateSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<VehicleDocumentRecord | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Extra custom date input row
  const [newExtraLabel, setNewExtraLabel] = useState('');
  const [newExtraDate, setNewExtraDate] = useState('');

  // Photo / File Upload state
  const [uploadCategory, setUploadCategory] = useState<string>('Araç Ruhsatı');
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('Tümü');
  const [previewFile, setPreviewFile] = useState<VehicleDocumentFile | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAll = async () => {
    const [vList, dList, fList] = await Promise.all([
      api.getVehicles(),
      api.getVehicleDocuments(),
      api.getVehicleDocumentFiles()
    ]);
    setVehicles(vList);
    setDocs(dList);
    setFiles(fList);
  };

  useEffect(() => {
    loadAll();
    const onCloudUpdated = () => {
      loadAll();
    };
    window.addEventListener('nd-cloud-sync-updated', onCloudUpdated);
    return () => window.removeEventListener('nd-cloud-sync-updated', onCloudUpdated);
  }, []);

  // Auto-select vehicle when navigated from notifications
  useEffect(() => {
    if (highlightVehicleId) {
      setSelectedVehicleId(highlightVehicleId);
      setDropdownOpen(false);
    }
  }, [highlightVehicleId]);

  // Close top-left dropdown on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  // Sync draft whenever selected vehicle or docs refresh from DB/Cloud
  useEffect(() => {
    if (!selectedVehicle) {
      setDraft(null);
      return;
    }
    const existing = docs.find((d) => d.vehicle_id === selectedVehicle.id);
    if (existing) {
      setDraft({
        ...createEmptyDocRecord(selectedVehicle),
        ...existing,
        extra_items: Array.isArray(existing.extra_items) ? existing.extra_items : []
      });
    } else {
      setDraft(createEmptyDocRecord(selectedVehicle));
    }
    setActiveCategoryFilter('Tümü');
  }, [selectedVehicle, docs]);

  const selectedVehicleFiles = useMemo(() => {
    if (!selectedVehicleId) return [];
    const perVehicle = files.filter((f) => f.vehicle_id === selectedVehicleId);
    if (activeCategoryFilter === 'Tümü') return perVehicle;
    return perVehicle.filter((f) => f.category === activeCategoryFilter);
  }, [files, selectedVehicleId, activeCategoryFilter]);

  const totalVehicleFilesCount = useMemo(() => {
    if (!selectedVehicleId) return 0;
    return files.filter((f) => f.vehicle_id === selectedVehicleId).length;
  }, [files, selectedVehicleId]);

  const filteredDropdownVehicles = useMemo(() => {
    const q = plateSearch.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(q) ||
        (v.driver_name || '').toLowerCase().includes(q) ||
        (v.vehicle_type || '').toLowerCase().includes(q)
    );
  }, [vehicles, plateSearch]);

  const vehicleStatsMap = useMemo(() => {
    const map = new Map<string, { fileCount: number; warningCount: number }>();
    for (const v of vehicles) {
      const vFiles = files.filter((f) => f.vehicle_id === v.id).length;
      const doc = docs.find((d) => d.vehicle_id === v.id);
      let warnings = 0;
      const threshold = doc?.reminder_days_before ?? 30;
      const checkDates: Array<[number | undefined, string | undefined]> = [
        [doc?.traffic_insurance_remind, doc?.traffic_insurance_end || v.insurance_date],
        [doc?.kasko_remind, doc?.kasko_end],
        [doc?.inspection_remind, doc?.inspection_end || v.inspection_date],
        [doc?.adr_other_remind, doc?.adr_other_end],
        [doc?.hazmat_policy_start_remind, doc?.hazmat_policy_start],
        [doc?.hazmat_policy_end_remind, doc?.hazmat_policy_end]
      ];
      for (const [rem, dt] of checkDates) {
        if ((rem ?? 1) === 1 && dt) {
          const left = getDaysRemaining(dt);
          if (left !== null && left <= threshold) warnings++;
        }
      }
      for (const ex of doc?.extra_items || []) {
        if (ex.remind && ex.date) {
          const left = getDaysRemaining(ex.date);
          if (left !== null && left <= threshold) warnings++;
        }
      }
      map.set(v.id, { fileCount: vFiles, warningCount: warnings });
    }
    return map;
  }, [vehicles, docs, files]);

  const handleSelectPlate = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setDropdownOpen(false);
    setPlateSearch('');
    setSaveFeedback(null);
  };

  const handleSaveDoc = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!draft || !selectedVehicle) return;
    setSavingDoc(true);
    setSaveFeedback(null);
    try {
      const payload: VehicleDocumentRecord = {
        ...draft,
        vehicle_id: selectedVehicle.id,
        vehicle_plate: selectedVehicle.plate
      };
      await api.saveVehicleDocument(payload);
      await loadAll();
      onDataChanged?.();
      await syncVehicleDocumentReminderNotifications(undefined, { forceImmediate: true });
      setSaveFeedback({
        type: 'success',
        text: `${selectedVehicle.plate} evrak tarihleri & hatırlatıcıları kaydedildi ve buluta/telefonlara senkronize edildi.`
      });
    } catch (err: any) {
      setSaveFeedback({
        type: 'error',
        text: err?.message || 'Evrak bilgileri kaydedilirken bir hata oluştu.'
      });
    } finally {
      setSavingDoc(false);
    }
  };

  const handleAddExtraDate = () => {
    if (!draft) return;
    if (!newExtraLabel.trim()) {
      alertDialog('Lütfen eklemek istediğiniz evrak veya belge adını yazın.');
      return;
    }
    const newItem: VehicleDocumentExtraItem = {
      id: `ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: newExtraLabel.trim(),
      date: newExtraDate,
      remind: true
    };
    setDraft({
      ...draft,
      extra_items: [...(draft.extra_items || []), newItem]
    });
    setNewExtraLabel('');
    setNewExtraDate('');
  };

  const handleToggleExtraRemind = (itemId: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      extra_items: (draft.extra_items || []).map((it) =>
        it.id === itemId ? { ...it, remind: !it.remind } : it
      )
    });
  };

  const handleUpdateExtraDate = (itemId: string, newDate: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      extra_items: (draft.extra_items || []).map((it) =>
        it.id === itemId ? { ...it, date: newDate } : it
      )
    });
  };

  const handleDeleteExtraItem = (itemId: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      extra_items: (draft.extra_items || []).filter((it) => it.id !== itemId)
    });
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selectedVehicle || picked.length === 0) return;

    setUploadingFiles(true);
    setSaveFeedback(null);
    let successCount = 0;

    try {
      for (let i = 0; i < picked.length; i++) {
        const rawFile = picked[i];
        if (!rawFile.type.startsWith('image/') && rawFile.size > 6 * 1024 * 1024) {
          await alertDialog(
            `"${rawFile.name}" 6 MB sınırını aştığı için atlandı. PDF yerine fotoğraf yükleyebilir veya boyutu küçültebilirsiniz.`
          );
          continue;
        }
        const processed = await compressDocumentFile(rawFile);
        const cleanTitle =
          uploadTitle.trim()
            ? picked.length > 1
              ? `${uploadTitle.trim()} (${i + 1})`
              : uploadTitle.trim()
            : rawFile.name.replace(/\.[^/.]+$/, '') || uploadCategory;

        const record: VehicleDocumentFile = {
          id: `vfile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${i}`,
          vehicle_id: selectedVehicle.id,
          vehicle_plate: selectedVehicle.plate,
          title: cleanTitle,
          category: uploadCategory,
          file_name: rawFile.name,
          mime_type: processed.mimeType,
          file_size: processed.size,
          data_url: processed.dataUrl,
          created_at: new Date().toISOString()
        };

        await api.saveVehicleDocumentFile(record);
        successCount++;
      }

      if (successCount > 0) {
        setUploadTitle('');
        await loadAll();
        onDataChanged?.();
        setSaveFeedback({
          type: 'success',
          text: `${selectedVehicle.plate} plakasına ${successCount} adet evrak fotoğrafı/dosyası eklendi ve buluta yedeklendi.`
        });
      }
    } catch (err: any) {
      setSaveFeedback({
        type: 'error',
        text: err?.message || 'Fotoğraf yüklenirken hata oluştu.'
      });
    } finally {
      setUploadingFiles(false);
    }
  };

  const resolveFileData = async (f: VehicleDocumentFile): Promise<VehicleDocumentFile | null> => {
    if (f.data_url && f.data_url.length > 20) return f;
    setDownloadingId(f.id);
    try {
      const hydrated = await ensureDocumentFileDownloaded(f);
      if (hydrated?.data_url) {
        await loadAll();
        return hydrated;
      }
      await alertDialog('Fotoğraf buluttan indirilemedi. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.');
      return null;
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenPreview = async (f: VehicleDocumentFile) => {
    const resolved = await resolveFileData(f);
    if (resolved) setPreviewFile(resolved);
  };

  const handleDownloadFile = async (f: VehicleDocumentFile) => {
    const resolved = await resolveFileData(f);
    if (!resolved || !resolved.data_url) return;

    setDownloadingId(f.id);
    try {
      const extMatch = resolved.mime_type.includes('pdf')
        ? '.pdf'
        : resolved.mime_type.includes('png')
        ? '.png'
        : '.jpg';
      const safePlate = (resolved.vehicle_plate || selectedVehicle?.plate || 'ARAC').replace(
        /[^a-zA-Z0-9_-]/g,
        ''
      );
      const safeTitle = (resolved.title || 'evrak').replace(/[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ _-]/g, '');
      const hasExt = /\.[a-z0-9]{2,5}$/i.test(resolved.file_name || '');
      const downloadName = hasExt
        ? `${safePlate}_${safeTitle}_${resolved.file_name}`
        : `${safePlate}_${safeTitle}${extMatch}`;

      const res = await api.saveDocumentFile(downloadName, resolved.data_url);
      if (res?.saved) {
        setSaveFeedback({
          type: 'success',
          text: `"${resolved.title}" başarıyla indirildi / kaydedildi.`
        });
      }
    } catch (err: any) {
      await alertDialog(err?.message || 'Dosya indirilemedi.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteFile = async (f: VehicleDocumentFile) => {
    const ok = await confirmDialog(
      `"${f.title}" (${f.category}) evrak dosyasını silmek istediğinize emin misiniz?`,
      'Evrak Dosyasını Sil'
    );
    if (!ok) return;
    await api.deleteVehicleDocumentFile(f.id);
    if (previewFile?.id === f.id) setPreviewFile(null);
    await loadAll();
    onDataChanged?.();
  };

  const handleTestNotification = async () => {
    if (!selectedVehicle) return;
    await sendTestVehicleDocNotification(
      selectedVehicle.plate,
      `${selectedVehicle.plate} plakalı araç evrak bildirimleri (bitişe 1 ay kala PC + Android + iOS) test edildi ve aktif!`
    );
  };

  const thresholdDays = draft?.reminder_days_before ?? 30;
  const totalApproachingCount = useMemo(() => {
    let sum = 0;
    vehicleStatsMap.forEach((st) => {
      sum += st.warningCount;
    });
    return sum;
  }, [vehicleStatsMap]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Top Bar: Top-Left "Araç Seçin" Box + Summary Strip */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* TOP-LEFT CORNER: "Araç Seçin" Selector Box */}
        <div className="relative z-30" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="nd-card px-4 py-3 rounded-2xl border-2 flex items-center gap-3 min-w-[270px] sm:min-w-[330px] text-left transition-all hover:shadow-md"
            style={{
              borderColor: selectedVehicle ? 'var(--accent)' : 'var(--border-strong)'
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: selectedVehicle ? 'var(--accent)' : 'var(--charcoal)' }}
            >
              <Truck size={19} />
            </div>

            <div className="flex-1 min-w-0">
              <span
                className="text-[10px] font-extrabold uppercase tracking-wider block"
                style={{ color: 'var(--accent)' }}
              >
                Araç Seçin
              </span>
              {selectedVehicle ? (
                <div className="flex items-center gap-2">
                  <span className="text-base font-black tracking-tight truncate">
                    {selectedVehicle.plate}
                  </span>
                  <span
                    className="text-[11px] font-semibold truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    • {selectedVehicle.driver_name || selectedVehicle.vehicle_type}
                  </span>
                </div>
              ) : (
                <span className="text-sm font-bold block" style={{ color: 'var(--text-muted)' }}>
                  Plaka Seçmek İçin Tıklayın ({vehicles.length} Araç)
                </span>
              )}
            </div>

            <ChevronDown
              size={18}
              className={`shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
              style={{ color: 'var(--text-muted)' }}
            />
          </button>

          {/* Dropdown Menu Listing Saved Plates */}
          {dropdownOpen && (
            <div
              className="nd-modal absolute left-0 top-full mt-2 w-[310px] sm:w-[390px] rounded-2xl border shadow-2xl overflow-hidden z-50"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border-strong)'
              }}
            >
              <div
                className="p-2.5 border-b flex items-center gap-2"
                style={{ borderColor: 'var(--border)' }}
              >
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  autoFocus
                  value={plateSearch}
                  onChange={(e) => setPlateSearch(e.target.value)}
                  placeholder="Plaka, şoför veya model ara..."
                  className="bg-transparent text-xs font-semibold outline-none flex-1"
                  style={{ color: 'var(--text)' }}
                />
              </div>

              <div className="max-h-[340px] overflow-y-auto p-1.5 space-y-1">
                {filteredDropdownVehicles.length === 0 ? (
                  <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    {vehicles.length === 0
                      ? 'Henüz "Araçlar" sekmesinden kayıtlı araç yok.'
                      : 'Aramaya uygun plaka bulunamadı.'}
                  </div>
                ) : (
                  filteredDropdownVehicles.map((v) => {
                    const stats = vehicleStatsMap.get(v.id) || { fileCount: 0, warningCount: 0 };
                    const active = v.id === selectedVehicleId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectPlate(v.id)}
                        className={`w-full p-2.5 rounded-xl flex items-center justify-between gap-2 text-left transition-all ${
                          active ? 'nd-btn-primary text-white' : 'nd-layer hover:opacity-90'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black tracking-wide">{v.plate}</span>
                            {stats.warningCount > 0 && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                style={{
                                  backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(217,119,6,0.18)',
                                  color: active ? '#fff' : 'var(--amber)'
                                }}
                              >
                                {stats.warningCount} Uyarı
                              </span>
                            )}
                          </div>
                          <span
                            className="text-[11px] block truncate"
                            style={{ color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)' }}
                          >
                            {v.vehicle_type} • Şoför: {v.driver_name || 'Atanmadı'}
                          </span>
                        </div>

                        <span
                          className="text-[11px] font-bold px-2 py-1 rounded-lg shrink-0"
                          style={{
                            backgroundColor: active ? 'rgba(255,255,255,0.18)' : 'var(--surface)',
                            color: active ? '#fff' : 'var(--text-muted)'
                          }}
                        >
                          {stats.fileCount} Fotoğraf
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Summary KPI Chips */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="nd-card px-3.5 py-2.5 flex items-center gap-2.5">
            <Truck size={16} style={{ color: 'var(--accent)' }} />
            <div>
              <span className="text-[10px] font-bold block" style={{ color: 'var(--text-muted)' }}>
                Kayıtlı Filo
              </span>
              <span className="text-sm font-black tabular-nums">{vehicles.length} Plaka</span>
            </div>
          </div>

          <div className="nd-card px-3.5 py-2.5 flex items-center gap-2.5">
            <AlertTriangle
              size={16}
              style={{ color: totalApproachingCount > 0 ? 'var(--amber)' : 'var(--green)' }}
            />
            <div>
              <span className="text-[10px] font-bold block" style={{ color: 'var(--text-muted)' }}>
                1 Ay Kala / Geciken
              </span>
              <span className="text-sm font-black tabular-nums">
                {totalApproachingCount} Evrak
              </span>
            </div>
          </div>

          <div className="nd-card px-3.5 py-2.5 flex items-center gap-2.5">
            <ImageIcon size={16} style={{ color: 'var(--green)' }} />
            <div>
              <span className="text-[10px] font-bold block" style={{ color: 'var(--text-muted)' }}>
                Toplam Arşivlenen Evrak
              </span>
              <span className="text-sm font-black tabular-nums">{files.length} Dosya</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {saveFeedback && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between gap-3 ${
            saveFeedback.type === 'success' ? 'nd-badge-green' : 'nd-badge-red'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            {saveFeedback.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0" />
            ) : (
              <AlertTriangle size={16} className="shrink-0" />
            )}
            <span>{saveFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveFeedback(null)}
            className="text-xs font-extrabold px-2 py-0.5 rounded-lg nd-layer"
          >
            Kapat
          </button>
        </div>
      )}

      {/* INITIAL STATE: No Plate Selected Yet */}
      {!selectedVehicle || !draft ? (
        <div className="space-y-4">
          <div className="nd-card p-6 text-center space-y-3">
            <div
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
              style={{ backgroundColor: 'rgba(198,139,89,0.16)', color: 'var(--accent)' }}
            >
              <FolderCheck size={28} />
            </div>
            <h3 className="text-base font-extrabold">
              Araç Evrak & Fotoğraf Kasası İçin Plaka Seçin
            </h3>
            <p className="text-xs max-w-xl mx-auto" style={{ color: 'var(--text-muted)' }}>
              Sol üst köşedeki <strong>"Araç Seçin"</strong> kutusuna tıklayarak veya aşağıdaki araç
              kartlarından bir plakaya dokunarak; sigorta, kasko, muayene, ADR ve tehlikeli madde
              poliçe tarihlerini yönetebilir, bitişe 1 ay kala tüm cihazlarınıza bildirim
              kurabilir ve aracın ruhsat/evrak fotoğraflarını sınırsız ekleyip indirebilirsiniz.
            </p>
          </div>

          {vehicles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {vehicles.map((v) => {
                const stats = vehicleStatsMap.get(v.id) || { fileCount: 0, warningCount: 0 };
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectPlate(v.id)}
                    className="nd-card p-4 text-left hover:scale-[1.01] transition-all flex flex-col justify-between gap-3 border"
                    style={{
                      borderColor: stats.warningCount > 0 ? 'var(--amber)' : 'var(--border)'
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-lg font-black tracking-wide block">{v.plate}</span>
                        <span className="text-xs font-semibold block" style={{ color: 'var(--text-muted)' }}>
                          {v.vehicle_type}
                        </span>
                      </div>
                      <span
                        className="px-2 py-1 rounded-lg text-[10px] font-bold"
                        style={{ backgroundColor: 'var(--layer)', color: 'var(--text-muted)' }}
                      >
                        {v.vehicle_type}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t text-[11px] font-bold" style={{ borderColor: 'var(--border)' }}>
                      <span style={{ color: stats.warningCount > 0 ? 'var(--amber)' : 'var(--green)' }}>
                        {stats.warningCount > 0
                          ? `${stats.warningCount} Yaklaşan Evrak`
                          : 'Evraklar Güncel'}
                      </span>
                      <span style={{ color: 'var(--accent)' }}>{stats.fileCount} Fotoğraf →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* SELECTED VEHICLE WORKSPACE */
        <div className="space-y-6">
          {/* Active Plate Header */}
          <div className="nd-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border-2" style={{ borderColor: 'var(--accent)' }}>
            <div className="flex items-center gap-3.5">
              <div
                className="px-3.5 py-2 rounded-xl text-white font-black text-lg tracking-wider shadow"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {selectedVehicle.plate}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold">
                  {selectedVehicle.vehicle_type} • Evrak & Belge Merkezi
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Şoför: {selectedVehicle.driver_name || 'Atanmadı'} • Kapasite:{' '}
                  {selectedVehicle.fuel_capacity ? `${selectedVehicle.fuel_capacity} L` : '-'} •{' '}
                  {totalVehicleFilesCount} Kayıtlı Fotoğraf/Belge
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleTestNotification}
                className="nd-btn-secondary px-3 py-2 text-xs font-bold flex items-center gap-1.5"
                title="Masaüstü, Android ve iOS bildirim sistemini test et"
              >
                <Send size={13} />
                <span>Bildirimi Test Et</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveDoc()}
                disabled={savingDoc}
                className="nd-btn-primary px-4 py-2 text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <Save size={14} />
                <span>{savingDoc ? 'Kaydediliyor...' : 'Tarihleri & Hatırlatıcıları Kaydet'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 1: 6 CORE DATES + REMINDERS + EXTRA ITEMS */}
          <form onSubmit={handleSaveDoc} className="nd-card p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                  <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                  <span>Zorunlu Araç Evrak Tarihleri & Otomatik Hatırlatıcılar</span>
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Hatırlatıcı açık olan evrakların bitiş tarihine <strong>{thresholdDays} gün (1 ay)</strong> kala
                  hem bilgisayar hem Android hem iOS uygulamanıza otomatik bildirim düşer.
                </p>
              </div>

              <div className="flex items-center gap-2 nd-layer px-3 py-1.5 rounded-xl">
                <Bell size={13} style={{ color: 'var(--amber)' }} />
                <span className="text-[11px] font-bold">Bildirim Zamanı:</span>
                <select
                  value={thresholdDays}
                  onChange={(e) =>
                    setDraft({ ...draft, reminder_days_before: Number(e.target.value) || 30 })
                  }
                  className="bg-transparent text-xs font-extrabold outline-none"
                  style={{ color: 'var(--accent)' }}
                >
                  <option value={30}>Bitime 1 Ay (30 Gün) Kala</option>
                  <option value={45}>Bitime 45 Gün Kala</option>
                  <option value={15}>Bitime 15 Gün Kala</option>
                  <option value={7}>Bitime 7 Gün Kala</option>
                </select>
              </div>
            </div>

            {/* 6 Required Document Fields */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              <DateReminderRow
                title="Trafik Sigortası Bitiş Tarihi"
                subtitle="Zorunlu Mali Sorumluluk Trafik Sigortası"
                dateValue={draft.traffic_insurance_end || ''}
                remindEnabled={(draft.traffic_insurance_remind ?? 1) === 1}
                thresholdDays={thresholdDays}
                onDateChange={(val) => setDraft({ ...draft, traffic_insurance_end: val })}
                onRemindToggle={() =>
                  setDraft({
                    ...draft,
                    traffic_insurance_remind: draft.traffic_insurance_remind === 1 ? 0 : 1
                  })
                }
              />

              <DateReminderRow
                title="Kasko Bitiş Tarihi"
                subtitle="Araç / Çekici / Tanker Kasko Poliçe Bitişi"
                dateValue={draft.kasko_end || ''}
                remindEnabled={(draft.kasko_remind ?? 1) === 1}
                thresholdDays={thresholdDays}
                onDateChange={(val) => setDraft({ ...draft, kasko_end: val })}
                onRemindToggle={() =>
                  setDraft({
                    ...draft,
                    kasko_remind: draft.kasko_remind === 1 ? 0 : 1
                  })
                }
              />

              <DateReminderRow
                title="Muayene Bitiş Tarihi"
                subtitle="TÜVTÜRK Periyodik Araç / Fenni Muayene Bitişi"
                dateValue={draft.inspection_end || ''}
                remindEnabled={(draft.inspection_remind ?? 1) === 1}
                thresholdDays={thresholdDays}
                onDateChange={(val) => setDraft({ ...draft, inspection_end: val })}
                onRemindToggle={() =>
                  setDraft({
                    ...draft,
                    inspection_remind: draft.inspection_remind === 1 ? 0 : 1
                  })
                }
              />

              <DateReminderRow
                title={draft.adr_other_label || 'ADR - Diğer Belge Bitiş Tarihi'}
                subtitle="T9 ADR Uygunluk / Diğer Özel Belge (Başlık düzenlenebilir)"
                editableTitle
                onTitleChange={(val) => setDraft({ ...draft, adr_other_label: val })}
                dateValue={draft.adr_other_end || ''}
                remindEnabled={(draft.adr_other_remind ?? 1) === 1}
                thresholdDays={thresholdDays}
                onDateChange={(val) => setDraft({ ...draft, adr_other_end: val })}
                onRemindToggle={() =>
                  setDraft({
                    ...draft,
                    adr_other_remind: draft.adr_other_remind === 1 ? 0 : 1
                  })
                }
              />

              <DateReminderRow
                title="Tehlikeli Madde - Atık Poliçe Başlangıç Tarihi"
                subtitle="Tehlikeli Madde & Tehlikeli Atık Zorunlu Sorumluluk Başlangıcı"
                isStartDate
                dateValue={draft.hazmat_policy_start || ''}
                remindEnabled={(draft.hazmat_policy_start_remind ?? 1) === 1}
                thresholdDays={thresholdDays}
                onDateChange={(val) => setDraft({ ...draft, hazmat_policy_start: val })}
                onRemindToggle={() =>
                  setDraft({
                    ...draft,
                    hazmat_policy_start_remind: draft.hazmat_policy_start_remind === 1 ? 0 : 1
                  })
                }
              />

              <DateReminderRow
                title="Tehlikeli Madde - Atık Poliçe Bitiş Tarihi"
                subtitle="Tehlikeli Madde & Atık Poliçe Bitişine 1 Ay Kala Uyarı Verir"
                dateValue={draft.hazmat_policy_end || ''}
                remindEnabled={(draft.hazmat_policy_end_remind ?? 1) === 1}
                thresholdDays={thresholdDays}
                onDateChange={(val) => setDraft({ ...draft, hazmat_policy_end: val })}
                onRemindToggle={() =>
                  setDraft({
                    ...draft,
                    hazmat_policy_end_remind: draft.hazmat_policy_end_remind === 1 ? 0 : 1
                  })
                }
              />
            </div>

            {/* Extra Custom Vehicle Dates */}
            <div className="pt-3 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold">
                  Ekstra Evrak / Belge Tarihleri (K1 Taşıt Kartı, Takograf, Tanker Kalibrasyonu vb.)
                </h4>
              </div>

              {(draft.extra_items || []).length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {(draft.extra_items || []).map((ex) => {
                    const badge = getCountdownBadge(ex.date, thresholdDays);
                    return (
                      <div
                        key={ex.id}
                        className="nd-layer p-3 rounded-xl flex flex-wrap items-center gap-2 justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold truncate">{ex.label}</span>
                            <span className={`${badge.badgeClass} px-2 py-0.5 rounded text-[10px] font-bold`}>
                              {badge.text}
                            </span>
                          </div>
                          <input
                            type="date"
                            value={ex.date || ''}
                            onChange={(e) => handleUpdateExtraDate(ex.id, e.target.value)}
                            className="nd-input mt-1.5 py-1 px-2 text-xs font-bold w-40"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleExtraRemind(ex.id)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                              ex.remind ? 'nd-badge-green' : 'nd-layer opacity-70'
                            }`}
                          >
                            {ex.remind ? <Bell size={12} /> : <BellOff size={12} />}
                            <span>{ex.remind ? 'Açık' : 'Kapalı'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExtraItem(ex.id)}
                            className="nd-badge-red p-1.5 rounded-lg"
                            title="Satırı Sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newExtraLabel}
                  onChange={(e) => setNewExtraLabel(e.target.value)}
                  placeholder="Ek Evrak Adı (Örn: Takograf Muayene, K1 Taşıt Kartı)"
                  className="nd-input flex-1 min-w-[200px] py-2 px-3 text-xs font-semibold"
                />
                <input
                  type="date"
                  value={newExtraDate}
                  onChange={(e) => setNewExtraDate(e.target.value)}
                  className="nd-input py-2 px-3 text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={handleAddExtraDate}
                  className="nd-btn-secondary px-3.5 py-2 text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Ek Evrak Tarihi Ekle</span>
                </button>
              </div>
            </div>

            {/* Extra Notes & Info for This Vehicle */}
            <div className="pt-2 space-y-2">
              <label className="text-xs font-extrabold block">
                Araç Evrak Ek Bilgileri (Ruhsat Seri No, Sigorta Acentesi, Poliçe No, Tanker Notları)
              </label>
              <textarea
                rows={3}
                value={draft.extra_info || ''}
                onChange={(e) => setDraft({ ...draft, extra_info: e.target.value })}
                placeholder={`${selectedVehicle.plate} aracına ait sigorta şirketi, poliçe numaraları, şasi/motor veya özel ruhsat notlarını buraya ekleyebilirsiniz...`}
                className="nd-input w-full p-3 text-xs font-medium resize-y"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingDoc}
                className="nd-btn-primary px-6 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow"
              >
                <Save size={15} />
                <span>
                  {savingDoc
                    ? 'Kaydediliyor ve Eşitleniyor...'
                    : `${selectedVehicle.plate} Bilgilerini Kaydet`}
                </span>
              </button>
            </div>
          </form>

          {/* SECTION 2: UNLIMITED PER-PLATE PHOTO & DOCUMENT VAULT */}
          <div className="nd-card p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                  <ImageIcon size={18} style={{ color: 'var(--accent)' }} />
                  <span>
                    {selectedVehicle.plate} — Sınırsız Evrak & Fotoğraf Kasası ({totalVehicleFilesCount} Adet)
                  </span>
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Araç ruhsatı, ADR belgesi, sigorta poliçeleri veya muayene evraklarını bu plakaya özel
                  sınırsız ekleyin; ihtiyacınız olduğunda cihazınıza yüksek kalitede tek tıkla indirin.
                </p>
              </div>
              <span className="nd-badge-green px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5">
                <Cloud size={12} />
                <span>Bulut İle PC • Android • iOS Yedekli</span>
              </span>
            </div>

            {/* Upload Controls */}
            <div className="nd-layer p-4 rounded-2xl border-2 border-dashed space-y-3" style={{ borderColor: 'var(--border-strong)' }}>
              <div className="flex flex-wrap gap-1.5">
                {DOC_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setUploadCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      uploadCategory === cat ? 'nd-btn-primary text-white' : 'nd-card hover:opacity-90'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Fotoğraf / Evrak Başlığı (İsteğe bağlı, örn: Ön Yüz Ruhsat)"
                  className="nd-input flex-1 min-w-[220px] py-2.5 px-3 text-xs font-semibold"
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFilesSelected}
                  className="hidden"
                />

                <button
                  type="button"
                  disabled={uploadingFiles}
                  onClick={() => fileInputRef.current?.click()}
                  className="nd-btn-primary px-5 py-2.5 text-xs font-extrabold flex items-center gap-2 shadow-sm"
                >
                  {uploadingFiles ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <Upload size={15} />
                  )}
                  <span>
                    {uploadingFiles
                      ? 'Sıkıştırılıyor ve Yükleniyor...'
                      : 'Sınırsız Fotoğraf / Belge Seç ve Ekle'}
                  </span>
                </button>
              </div>
            </div>

            {/* Category Filter Bar */}
            {totalVehicleFilesCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {['Tümü', ...DOC_CATEGORIES].map((cat) => {
                  const count =
                    cat === 'Tümü'
                      ? totalVehicleFilesCount
                      : files.filter((f) => f.vehicle_id === selectedVehicle.id && f.category === cat).length;
                  if (cat !== 'Tümü' && count === 0) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all ${
                        activeCategoryFilter === cat ? 'nd-btn-primary text-white' : 'nd-layer'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Photo & Document Gallery */}
            {selectedVehicleFiles.length === 0 ? (
              <div className="nd-layer p-8 rounded-2xl text-center space-y-2">
                <ImageIcon size={30} className="mx-auto opacity-45" />
                <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                  {selectedVehicle.plate} plakası için bu kategoride henüz yüklenmiş evrak fotoğrafı yok.
                </p>
                <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Yukarıdan kategori seçip "Sınırsız Fotoğraf / Belge Seç ve Ekle" butonuna basarak aracın
                  ruhsat, ADR, sigorta veya kasko görsellerini yükleyebilirsiniz.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {selectedVehicleFiles.map((file) => {
                  const isImage = file.mime_type.startsWith('image/');
                  const hasData = Boolean(file.data_url && file.data_url.length > 20);
                  const isBusy = downloadingId === file.id;

                  return (
                    <div
                      key={file.id}
                      className="nd-layer rounded-2xl overflow-hidden border flex flex-col justify-between transition-all hover:shadow-md"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {/* Thumbnail Area */}
                      <button
                        type="button"
                        onClick={() => handleOpenPreview(file)}
                        className="relative w-full h-44 bg-black/20 flex items-center justify-center overflow-hidden group"
                        title="Büyük Ekranda Görüntüle"
                      >
                        {isImage && hasData ? (
                          <img
                            src={file.data_url}
                            alt={file.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 p-4 text-center">
                            {isBusy ? (
                              <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                            ) : (
                              <FileText size={34} style={{ color: 'var(--accent)' }} />
                            )}
                            <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
                              {hasData
                                ? 'PDF / Belge Dosyası'
                                : 'Buluttan İndirmek İçin Tıklayın'}
                            </span>
                          </div>
                        )}

                        <span
                          className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold text-white shadow"
                          style={{ backgroundColor: 'rgba(15, 22, 19, 0.78)' }}
                        >
                          {file.category}
                        </span>
                      </button>

                      {/* Meta & Action Buttons */}
                      <div className="p-3 space-y-2.5">
                        <div>
                          <h4 className="text-xs font-extrabold truncate" title={file.title}>
                            {file.title}
                          </h4>
                          <div className="flex items-center justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            <span>
                              {file.created_at ? formatDate(file.created_at) : '-'} •{' '}
                              {formatFileSize(file.file_size)}
                            </span>
                            <span style={{ color: file.cloud_key ? 'var(--green)' : 'var(--text-dim)' }}>
                              {file.cloud_key ? 'Bulut Yedekli' : 'Yerel'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(file)}
                            disabled={isBusy}
                            className="nd-card flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 hover:opacity-90"
                          >
                            <Eye size={13} />
                            <span>Gör</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadFile(file)}
                            disabled={isBusy}
                            className="nd-btn-primary flex-1 py-1.5 px-2 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1"
                            title="Bu evrak fotoğrafını bilgisayara veya telefona indir"
                          >
                            {isBusy ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <Download size={13} />
                            )}
                            <span>İndir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteFile(file)}
                            className="nd-badge-red p-1.5 rounded-lg"
                            title="Dosyayı Sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(6, 10, 8, 0.88)', backdropFilter: 'blur(6px)' }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="nd-modal max-w-4xl w-full max-h-[92vh] rounded-2xl border overflow-hidden flex flex-col"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-4 py-3 border-b flex items-center justify-between gap-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="min-w-0">
                <span className="text-[10px] font-extrabold uppercase block" style={{ color: 'var(--accent)' }}>
                  {previewFile.vehicle_plate || selectedVehicle?.plate} • {previewFile.category}
                </span>
                <h4 className="text-sm font-black truncate">{previewFile.title}</h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewFile)}
                  className="nd-btn-primary px-3.5 py-2 text-xs font-extrabold flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Cihaza İndir</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="nd-layer p-2 rounded-xl"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/30">
              {previewFile.mime_type.startsWith('image/') ? (
                <img
                  src={previewFile.data_url}
                  alt={previewFile.title}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-xl"
                />
              ) : (
                <div className="p-8 text-center space-y-3">
                  <FileText size={54} className="mx-auto" style={{ color: 'var(--accent)' }} />
                  <p className="text-sm font-bold">{previewFile.file_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Bu belge PDF veya döküman formatındadır. Görüntülemek için yukarıdaki "Cihaza İndir" butonuna
                    tıklayın.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
