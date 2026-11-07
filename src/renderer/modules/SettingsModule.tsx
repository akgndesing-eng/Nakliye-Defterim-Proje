import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Download,
  Upload,
  Lock,
  ShieldCheck,
  Sun,
  Moon,
  Type,
  Clock,
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HardDrive,
  Radio,
  Coins,
  CloudSun,
  PanelLeft,
  Save,
  KeyRound,
  FolderOpen,
  History,
  RotateCcw
} from 'lucide-react';
import { AppPreferences, AutoBackupStatus, AutoBackupItem } from '../../shared/types';
import { api, preloadAllErpData } from '../api';

interface SettingsModuleProps {
  vaultPath: string;
  darkMode: boolean;
  onToggleTheme: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  preferences: AppPreferences;
  onSavePreferences: (prefs: AppPreferences) => void;
  onLockVault: () => void;
  selectedMonth: string;
  onDataRestored: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  vaultPath,
  darkMode,
  onToggleTheme,
  sidebarCollapsed,
  onToggleSidebar,
  preferences,
  onSavePreferences,
  onLockVault,
  selectedMonth,
  onDataRestored
}) => {
  const [importPassword, setImportPassword] = useState('');
  const [showImportPass, setShowImportPass] = useState(false);
  const [busyAction, setBusyAction] = useState<'export' | 'import' | 'sync' | 'auto_now' | 'restore_auto' | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string>(
    () => localStorage.getItem('nd_last_backup_time') || 'Henüz bu oturumda yedek alınmadı'
  );
  const [autoBackupStatus, setAutoBackupStatus] = useState<AutoBackupStatus | null>(null);

  // Local form state for company & operation profile
  const [formPrefs, setFormPrefs] = useState<AppPreferences>(preferences);

  const refreshAutoBackups = useCallback(async () => {
    try {
      const st = await api.getAutoBackupStatus();
      setAutoBackupStatus(st);
      if (st.lastBackupAt) {
        const formatted = new Date(st.lastBackupAt).toLocaleString('tr-TR');
        setLastBackupTime(formatted);
        localStorage.setItem('nd_last_backup_time', formatted);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshAutoBackups();
  }, [refreshAutoBackups]);

  const handleRunAutoBackupNow = async () => {
    setBanner(null);
    setBusyAction('auto_now');
    try {
      const res = await api.runAutoBackupNow('Kullanıcı Anlık Otomatik Yedek');
      setAutoBackupStatus(res.status);
      if (res.success) {
        const nowStr = new Date().toLocaleString('tr-TR');
        localStorage.setItem('nd_last_backup_time', nowStr);
        setLastBackupTime(nowStr);
        setBanner({ type: 'success', message: res.message });
      } else {
        setBanner({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err?.message || 'Otomatik yedek oluşturulurken hata oluştu.'
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleChangeAutoBackupInterval = async (minutes: number) => {
    const updated = { ...formPrefs, autoBackupMinutes: minutes };
    setFormPrefs(updated);
    onSavePreferences(updated);
    try {
      const st = await api.setAutoBackupInterval(minutes);
      setAutoBackupStatus(st);
      setBanner({
        type: 'success',
        message:
          minutes > 0
            ? `Otomatik yedekleme aralığı "Her ${minutes} Dakikada Bir + Her Veri Değişikliğinde" olarak güncellendi.`
            : 'Periyodik zamanlayıcı kapatıldı; yalnızca veri değişikliklerinde ve çıkışta otomatik yedek alınacak.'
      });
    } catch {}
  };

  const handleRestoreFromAutoBackup = async (item: AutoBackupItem) => {
    setBanner(null);
    if (importPassword.length < 10) {
      setBanner({
        type: 'error',
        message: `"${item.fileName}" yedeğini geri yüklemek için lütfen üstteki "Yedek Dosyasının Ana Parolası" kutucuğuna en az 10 karakterli Ana Parolanızı yazın.`
      });
      return;
    }

    setBusyAction('restore_auto');
    try {
      const res = await api.importEncryptedBackup(importPassword, item.filePath);
      if (res.success) {
        setImportPassword('');
        await preloadAllErpData(selectedMonth);
        await refreshAutoBackups();
        onDataRestored();
        setBanner({
          type: 'success',
          message: `"${item.fileName}" otomatik yedeği başarıyla geri yüklendi.`
        });
      } else {
        setBanner({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err?.message || 'Seçilen otomatik yedek geri yüklenemedi.'
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleExport = async () => {
    setBanner(null);
    setBusyAction('export');
    try {
      const res = await api.exportEncryptedBackup();
      if (res.success) {
        const nowStr = new Date().toLocaleString('tr-TR');
        localStorage.setItem('nd_last_backup_time', nowStr);
        setLastBackupTime(nowStr);
        setBanner({ type: 'success', message: res.message });
      } else {
        setBanner({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err?.message || 'Şifreli yedek dışa aktarılırken bir hata oluştu.'
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    if (importPassword.length < 10) {
      setBanner({
        type: 'error',
        message: 'Yedek dosyasının şifresini çözmek için en az 10 karakterli Ana Parolanızı girin.'
      });
      return;
    }

    setBusyAction('import');
    try {
      const res = await api.importEncryptedBackup(importPassword);
      if (res.success) {
        setImportPassword('');
        await preloadAllErpData(selectedMonth);
        onDataRestored();
        setBanner({ type: 'success', message: res.message });
      } else {
        setBanner({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setBanner({
        type: 'error',
        message: err?.message || 'Şifreli yedek dosyası yüklenemedi.'
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePreferences(formPrefs);
    setBanner({
      type: 'success',
      message: 'Firma, yönetici ve sistem tercihleri başarıyla kaydedildi.'
    });
  };

  const handleQuickPreferenceChange = (partial: Partial<AppPreferences>) => {
    const updated = { ...formPrefs, ...partial };
    setFormPrefs(updated);
    onSavePreferences(updated);
  };

  const handleForceSyncFeeds = async () => {
    setBusyAction('sync');
    setBanner(null);
    try {
      await preloadAllErpData(selectedMonth);
      setBanner({
        type: 'success',
        message: 'Harem Altın, MGM Edirne Hava Durumu ve yerel veritabanı önbelleği anlık olarak yenilendi.'
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Status Banner */}
      {banner && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 nd-toast-enter ${
            banner.type === 'success' ? 'nd-badge-green' : 'nd-badge-red'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            {banner.type === 'success' ? (
              <CheckCircle2 size={18} className="shrink-0" />
            ) : (
              <AlertCircle size={18} className="shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-xs font-extrabold px-2.5 py-1 rounded-lg nd-layer"
          >
            Tamam
          </button>
        </div>
      )}

      {/* 1. ANA GÜVENLİK & YEDEKLEME MERKEZİ (Yedek Al, Yedek Aç, Defteri Kilitle) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* KART 1: YEDEK AL (EXPORT) */}
        <div className="nd-card p-6 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: 'var(--green)' }}
              >
                <Download size={22} />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full nd-badge-green">
                AES-256 Şifreli Export
              </span>
            </div>

            <h3 className="text-base font-extrabold tracking-tight">
              Şifreli Tam Yedek Al (Yedek Al)
            </h3>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Tüm araç, şoför, müşteri cari, çoklu durak sefer, tahsilat ve görev kayıtlarınızı tek tıkla şifreli <b>.json / .db</b> paketi olarak bilgisayarınıza kaydedin.
            </p>

            <div className="mt-4 p-3 rounded-xl nd-layer text-[11px] flex items-center justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Son Yedekleme:</span>
              <b className="tabular-nums">{lastBackupTime}</b>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={busyAction === 'export'}
            className="nd-btn-primary w-full py-3 mt-5 text-xs flex items-center justify-center gap-2 shadow-md"
            style={{ backgroundColor: 'var(--green)' }}
          >
            <Download size={16} />
            <span>
              {busyAction === 'export'
                ? 'Yedek Dosyası Hazırlanıyor...'
                : 'Bilgisayara Şifreli Yedek Al (Export)'}
            </span>
          </button>
        </div>

        {/* KART 2: YEDEK AÇ (IMPORT) */}
        <form
          onSubmit={handleImport}
          className="nd-card p-6 flex flex-col justify-between relative overflow-hidden"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <Upload size={22} />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full nd-badge-blue">
                Yedekten Geri Yükle
              </span>
            </div>

            <h3 className="text-base font-extrabold tracking-tight">
              Şifreli Yedekten Geri Yükle (Yedek Aç)
            </h3>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Daha önce aldığınız şifreli yedek dosyasını seçip ana parolanızla doğrulayarak tüm veritabanını geri yükleyin.
            </p>

            <div className="mt-4">
              <label className="block text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Yedek Dosyasının Ana Parolası (En az 10 karakter)
              </label>
              <div className="nd-layer flex items-center gap-2.5 px-3 py-2">
                <KeyRound size={15} className="shrink-0" style={{ color: 'var(--accent)' }} />
                <input
                  type={showImportPass ? 'text' : 'password'}
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  placeholder="Ana parolanızı buraya yazın..."
                  className="flex-1 min-w-0 bg-transparent text-xs font-semibold outline-none border-0"
                  style={{ color: 'var(--text)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowImportPass(!showImportPass)}
                  className="shrink-0 p-1 rounded opacity-75 hover:opacity-100"
                  title={showImportPass ? 'Parolayı Gizle' : 'Parolayı Göster'}
                >
                  {showImportPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={busyAction === 'import'}
            className="nd-btn-primary w-full py-3 mt-5 text-xs flex items-center justify-center gap-2 shadow-md"
          >
            <Upload size={16} />
            <span>
              {busyAction === 'import'
                ? 'Yedek Çözülüyor ve Yükleniyor...'
                : 'Yedek Dosyası Seç ve Geri Yükle (Yedek Aç)'}
            </span>
          </button>
        </form>

        {/* KART 3: DEFTERİ KİLİTLE (LOCK VAULT) */}
        <div className="nd-card p-6 flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: 'var(--red)' }}
              >
                <Lock size={22} />
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full nd-badge-red">
                Kısayol: Ctrl + L
              </span>
            </div>

            <h3 className="text-base font-extrabold tracking-tight">
              Oturumu Kapat & Defteri Kilitle
            </h3>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Bilgisayar başından ayrılırken veritabanını anında AES-256 ile şifreleyip kilit ekranına (Gate Screen) dönün.
            </p>

            <div className="mt-4 p-3 rounded-xl nd-layer space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Şifreleme Standardı:</span>
                <b className="text-emerald-400">AES-256-GCM / SQLCipher</b>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0" style={{ color: 'var(--text-muted)' }}>Kasa Dosyası:</span>
                <span className="font-mono text-[10px] truncate" title={vaultPath}>
                  {vaultPath ? vaultPath.split(/[\\/]/).pop() : 'nakliye_defterim_v45.enc.db'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onLockVault}
            className="w-full py-3 mt-5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 text-white shadow-md"
            style={{ backgroundColor: 'var(--red)' }}
          >
            <Lock size={16} />
            <span>Defteri Şimdi Kilitle (Gate Ekranına Dön)</span>
          </button>
        </div>
      </div>

      {/* 1.5 OTOMATİK YEDEKLEME SİSTEMİ (KESİNTİSİZ PERİYODİK KORUMA) */}
      <div className="nd-card p-6 space-y-5">
        <div
          className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0"
              style={{ backgroundColor: 'var(--green)' }}
            >
              <History size={21} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">
                  Otomatik Yedekleme Sistemi (Kesintisiz Koruma)
                </h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full nd-badge-green">
                  {(formPrefs.autoBackupMinutes ?? 10) > 0
                    ? `Aktif • Her ${formPrefs.autoBackupMinutes ?? 10} Dakikada Bir`
                    : 'Canlı Kayıt Koruması Aktif'}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Sistem belirlediğiniz aralıklarla, her kayıt/değişiklik işleminde ve uygulama kapatılırken otomatik olarak AES-256 şifreli yedek alır ve kaydeder.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => api.openAutoBackupFolder()}
              className="nd-btn-secondary px-3.5 py-2.5 text-xs flex items-center gap-2"
            >
              <FolderOpen size={15} />
              <span>Yedek Klasörünü Aç</span>
            </button>

            <button
              type="button"
              onClick={handleRunAutoBackupNow}
              disabled={busyAction === 'auto_now'}
              className="nd-btn-primary px-4 py-2.5 text-xs flex items-center gap-2 shadow-sm"
              style={{ backgroundColor: 'var(--green)' }}
            >
              <RefreshCw size={15} className={busyAction === 'auto_now' ? 'animate-spin' : ''} />
              <span>
                {busyAction === 'auto_now'
                  ? 'Otomatik Yedek Kaydediliyor...'
                  : 'Şimdi Otomatik Yedek Kaydet'}
              </span>
            </button>
          </div>
        </div>

        {/* Ayarlar Satırı: Yedekleme Sıklığı + Klasör Konumu + Son Otomatik Yedek */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="nd-layer p-3.5 rounded-xl">
            <label className="block text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Otomatik Yedekleme Aralığı (Periyot)
            </label>
            <select
              value={formPrefs.autoBackupMinutes ?? 10}
              onChange={(e) => handleChangeAutoBackupInterval(Number(e.target.value))}
              className="nd-input w-full py-2 text-xs font-bold"
            >
              <option value={5}>Her 5 Dakikada Bir + Her Kayıtta (Yüksek Koruma)</option>
              <option value={10}>Her 10 Dakikada Bir + Her Kayıtta (Önerilen)</option>
              <option value={15}>Her 15 Dakikada Bir + Her Kayıtta</option>
              <option value={30}>Her 30 Dakikada Bir + Her Kayıtta</option>
              <option value={60}>Her 60 Dakikada Bir + Her Kayıtta (Saatlik)</option>
              <option value={0}>Sadece Kayıt Değiştiğinde ve Çıkışta</option>
            </select>
          </div>

          <div className="nd-layer p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              Otomatik Yedeklerin Kaydedildiği Klasör
            </span>
            <p
              className="text-xs font-mono font-bold truncate mt-1.5"
              title={autoBackupStatus?.backupDir || ''}
            >
              {autoBackupStatus?.backupDir || 'Belgeler\\Nakliye Defterim Otomatik Yedekler'}
            </p>
            <span className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
              En son 30 otomatik yedek dosyası otomatik korunur
            </span>
          </div>

          <div className="nd-layer p-3.5 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>
              Son Otomatik Yedekleme Zamanı & Adedi
            </span>
            <p className="text-sm font-extrabold tabular-nums mt-1" style={{ color: 'var(--green)' }}>
              {autoBackupStatus?.lastBackupAt
                ? new Date(autoBackupStatus.lastBackupAt).toLocaleString('tr-TR')
                : lastBackupTime}
            </p>
            <span className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
              Klasörde toplam <b>{autoBackupStatus?.totalCount || 0}</b> adet şifreli otomatik yedek mevcut
            </span>
          </div>
        </div>

        {/* Son Otomatik Yedek Dosyaları Listesi */}
        {autoBackupStatus && autoBackupStatus.backups.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold">
                Kaydedilen Son Otomatik Yedekler ({Math.min(6, autoBackupStatus.backups.length)} / {autoBackupStatus.backups.length})
              </span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Tek tıkla geri yüklemek için önce yukarıdaki &ldquo;Yedek Dosyasının Ana Parolası&rdquo; alanına parolanızı girin
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <table className="nd-table">
                <thead>
                  <tr>
                    <th>YEDEK DOSYASI</th>
                    <th>TARİH & SAAT</th>
                    <th>KAYIT TÜRÜ</th>
                    <th className="text-right">BOYUT</th>
                    <th className="text-right">İŞLEM</th>
                  </tr>
                </thead>
                <tbody>
                  {autoBackupStatus.backups.slice(0, 6).map((item) => (
                    <tr key={item.filePath}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold">{item.fileName}</span>
                          {item.isLatestRolling && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full nd-badge-green">
                              Canlı Son Yedek
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="tabular-nums text-xs">
                        {new Date(item.createdAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {item.reason}
                      </td>
                      <td className="text-right tabular-nums text-xs font-semibold">
                        {Math.max(1, Math.round(item.sizeBytes / 1024))} KB
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          disabled={busyAction === 'restore_auto'}
                          onClick={() => handleRestoreFromAutoBackup(item)}
                          className="nd-btn-secondary px-2.5 py-1 text-[11px] inline-flex items-center gap-1.5"
                        >
                          <RotateCcw size={12} />
                          <span>Bu Yedeği Yükle</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 2. GÖRÜNÜM, TEMA, ÖLÇEKLEME VE OTOMATİK KİLİT TERCİHLERİ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sol: Görünüm & Arayüz Tercihleri (6 Cols) */}
        <div className="lg:col-span-6 nd-card p-6 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <Settings size={18} style={{ color: 'var(--accent)' }} />
            <div>
              <h3 className="text-sm font-extrabold">Görünüm, Tema ve Arayüz Ayarları</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Renk teması, yazı tipi büyüklüğü, sol menü durumu ve otomatik kilit süresi
              </p>
            </div>
          </div>

          {/* Tema Seçimi */}
          <div>
            <label className="block text-xs font-bold mb-2">Uygulama Renk Teması</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => !darkMode && onToggleTheme()}
                className={`p-3.5 rounded-xl flex items-center gap-3 text-left ${
                  darkMode ? 'nd-btn-primary' : 'nd-layer'
                }`}
              >
                <Moon size={18} />
                <div>
                  <span className="text-xs font-extrabold block">Koyu Tema (Gece)</span>
                  <span className="text-[10px] opacity-80 block">Koyu Füme & Antrasit</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => darkMode && onToggleTheme()}
                className={`p-3.5 rounded-xl flex items-center gap-3 text-left ${
                  !darkMode ? 'nd-btn-primary' : 'nd-layer'
                }`}
              >
                <Sun size={18} />
                <div>
                  <span className="text-xs font-extrabold block">Açık Tema (Gündüz)</span>
                  <span className="text-[10px] opacity-80 block">Kırık Beyaz & Orman Yeşili</span>
                </div>
              </button>
            </div>
          </div>

          {/* Yazı Boyutu Ölçekleme */}
          <div>
            <label className="block text-xs font-bold mb-2 flex items-center gap-1.5">
              <Type size={14} style={{ color: 'var(--accent)' }} />
              <span>Yazı Boyutu ve Okunaklılık Ölçeği</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  { id: 'normal', label: 'Standart (16px)', desc: 'Kompakt görünüm' },
                  { id: 'comfortable', label: 'Kurumsal Net (Önerilen)', desc: '16.75px Dengeli' },
                  { id: 'large', label: 'Büyük Yazı (17.5px)', desc: 'Maksimum okunaklılık' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleQuickPreferenceChange({ fontScale: opt.id })}
                  className={`p-3 rounded-xl text-left ${
                    formPrefs.fontScale === opt.id ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  <span className="text-xs font-extrabold block">{opt.label}</span>
                  <span className="text-[10px] opacity-80 block mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sol Menü & Otomatik Kilit Süresi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-2 flex items-center gap-1.5">
                <PanelLeft size={14} style={{ color: 'var(--accent)' }} />
                <span>Sol Menü Çubuğu (Ctrl+B)</span>
              </label>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="nd-layer w-full p-3 text-left flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-extrabold block">
                    {sidebarCollapsed ? 'Kompakt İkon Modu (78px)' : 'Genişletilmiş Menü (276px)'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Değiştirmek için tıklayın
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded nd-badge-blue">
                  Değiştir
                </span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 flex items-center gap-1.5">
                <Clock size={14} style={{ color: 'var(--amber)' }} />
                <span>Boşta Kalınca Otomatik Kilit</span>
              </label>
              <select
                value={formPrefs.autoLockMinutes}
                onChange={(e) =>
                  handleQuickPreferenceChange({ autoLockMinutes: Number(e.target.value) })
                }
                className="nd-input w-full py-2.5 text-xs font-bold"
              >
                <option value={5}>5 Dakika Sonra Kilitle</option>
                <option value={15}>15 Dakika Sonra Kilitle (Önerilen)</option>
                <option value={30}>30 Dakika Sonra Kilitle</option>
                <option value={60}>60 Dakika Sonra Kilitle</option>
                <option value={0}>Otomatik Kilidi Kapat</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sağ: Firma & Operasyon Profili + Canlı Bağlantı Kontrolü (6 Cols) */}
        <div className="lg:col-span-6 nd-card p-6 flex flex-col justify-between space-y-5">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2.5">
                <Building2 size={18} style={{ color: 'var(--green)' }} />
                <div>
                  <h3 className="text-sm font-extrabold">Firma & Operasyon Profili</h3>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Ana sayfa, selamlama ve yeni sefer varsayılanlarında kullanılır
                  </p>
                </div>
              </div>
              <button
                type="submit"
                className="nd-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>Profili Kaydet</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold mb-1">Yönetici / Kullanıcı Adı</label>
                <input
                  type="text"
                  value={formPrefs.managerName}
                  onChange={(e) => setFormPrefs({ ...formPrefs, managerName: e.target.value })}
                  className="nd-input w-full"
                  placeholder="Örn: Umut Bey"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Firma / Filo Unvanı</label>
                <input
                  type="text"
                  value={formPrefs.companyTitle}
                  onChange={(e) => setFormPrefs({ ...formPrefs, companyTitle: e.target.value })}
                  className="nd-input w-full"
                  placeholder="Örn: Gökmen Petrol / AKON Transport"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Merkez Şehir / Operasyon Üssü</label>
                <input
                  type="text"
                  value={formPrefs.baseCity}
                  onChange={(e) => setFormPrefs({ ...formPrefs, baseCity: e.target.value })}
                  className="nd-input w-full"
                  placeholder="Örn: Edirne Merkez"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Varsayılan Dolum Tesisi</label>
                <input
                  type="text"
                  value={formPrefs.defaultOrigin}
                  onChange={(e) => setFormPrefs({ ...formPrefs, defaultOrigin: e.target.value })}
                  className="nd-input w-full"
                  placeholder="Örn: TÜPRAŞ İzmit Rafinerisi"
                />
              </div>
            </div>
          </form>

          {/* Canlı Servisler & Veri Akışı Durumu */}
          <div className="nd-layer p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold flex items-center gap-1.5">
                <ShieldCheck size={15} style={{ color: 'var(--green)' }} />
                <span>Canlı İnternet Servisleri & Önbellek Durumu</span>
              </span>
              <button
                type="button"
                onClick={handleForceSyncFeeds}
                disabled={busyAction === 'sync'}
                className="nd-btn-secondary px-3 py-1.5 text-[11px] flex items-center gap-1.5"
              >
                <RefreshCw size={12} className={busyAction === 'sync' ? 'animate-spin' : ''} />
                <span>Tüm Servisleri Şimdi Senkronize Et</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="nd-card p-2.5 flex items-center gap-2">
                <Coins size={14} style={{ color: 'var(--amber)' }} />
                <div className="min-w-0">
                  <span className="font-bold block truncate">Harem Altın</span>
                  <span className="text-[10px] text-emerald-400 font-bold">WebSocket Aktif</span>
                </div>
              </div>

              <div className="nd-card p-2.5 flex items-center gap-2">
                <CloudSun size={14} style={{ color: 'var(--accent)' }} />
                <div className="min-w-0">
                  <span className="font-bold block truncate">MGM Edirne</span>
                  <span className="text-[10px] text-emerald-400 font-bold">İstasyon #17050</span>
                </div>
              </div>

              <div className="nd-card p-2.5 flex items-center gap-2">
                <Radio size={14} style={{ color: 'var(--purple)' }} />
                <div className="min-w-0">
                  <span className="font-bold block truncate">Yol Radyosu</span>
                  <span className="text-[10px] text-emerald-400 font-bold">24 Canlı Kanal</span>
                </div>
              </div>

              <div className="nd-card p-2.5 flex items-center gap-2">
                <HardDrive size={14} style={{ color: 'var(--green)' }} />
                <div className="min-w-0">
                  <span className="font-bold block truncate">SQLite Kasa</span>
                  <span className="text-[10px] text-emerald-400 font-bold">0ms Önbellek</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
