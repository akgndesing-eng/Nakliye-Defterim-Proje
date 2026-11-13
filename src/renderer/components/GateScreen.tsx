import React, { useState } from 'react';
import {
  Lock,
  Upload,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  UserCheck,
  UserPlus,
  Cloud,
  Building2,
  Smartphone,
  Monitor
} from 'lucide-react';
import { GateStatus } from '../../shared/types';
import { BrandLogo } from './BrandLogo';
import { api } from '../api';
import { loginCloudAccount, registerCloudAccount } from '../api/cloudSync';

interface GateScreenProps {
  gateStatus: GateStatus;
  onUnlocked: (status: GateStatus) => void;
  darkMode: boolean;
  onToggleTheme: () => void;
}

export const GateScreen: React.FC<GateScreenProps> = ({
  gateStatus,
  onUnlocked,
  darkMode,
  onToggleTheme
}) => {
  const [mode, setMode] = useState<'cloud_login' | 'cloud_register' | 'restore'>('cloud_login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('Umut Ergil');
  const [companyTitle, setCompanyTitle] = useState('Akon Group / Gökmen Petrol');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [keepLocalData, setKeepLocalData] = useState(true);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCloudLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!username.trim()) {
      setError('Lütfen kullanıcı adınızı girin.');
      return;
    }
    if (!password) {
      setError('Lütfen hesap şifrenizi girin.');
      return;
    }

    setLoading(true);
    try {
      const nextStatus = await loginCloudAccount({
        username: username.trim(),
        password,
        rememberMe
      });
      onUnlocked(nextStatus);
    } catch (err: any) {
      setError(err?.message || 'Hesaba giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloudRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (username.trim().length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalıdır (Örn: umutergil).');
      return;
    }
    if (password.length < 4) {
      setError('Hesap şifresi en az 4 karakter olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Girdiğiniz şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      const nextStatus = await registerCloudAccount({
        username: username.trim(),
        password,
        displayName: displayName.trim() || username.trim(),
        companyTitle: companyTitle.trim() || 'Akon Group',
        keepCurrentLocalData: keepLocalData
      });
      onUnlocked(nextStatus);
    } catch (err: any) {
      setError(err?.message || 'Hesap oluşturulurken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalOrBackupUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!password || password.length < 4) {
      setError('Lütfen en az 4 karakterli kasa/yedek parolanızı girin.');
      return;
    }

    setLoading(true);
    try {
      if (gateStatus.isInitialized) {
        const nextStatus = await api.unlockVault(password);
        onUnlocked(nextStatus);
      } else {
        const nextStatus = await api.setupVault(password);
        onUnlocked(nextStatus);
      }
    } catch (err: any) {
      setError(err?.message || 'Yerel kasa kilidi açılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFromBackupFile = async () => {
    setError(null);
    setInfoMessage(null);

    if (!password || password.length < 4) {
      setError('Yedek dosyasının şifresini çözmek için önce yukarıdaki alana parolanızı girin.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.importEncryptedBackup(password);
      if (res.success) {
        setInfoMessage(res.message);
        const st = await api.getGateStatus();
        onUnlocked(st);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Yedek dosyası içe aktarılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nd-page min-h-[100dvh] w-screen flex flex-col justify-between p-4 sm:p-6 select-none relative overflow-y-auto">
      {/* Subtle architectural ambient backdrop */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 18% 15%, rgba(45, 110, 85, 0.14), transparent 50%), radial-gradient(circle at 82% 85%, rgba(197, 168, 114, 0.12), transparent 50%)'
        }}
      />

      {/* Top Bar */}
      <div className="relative z-10 flex items-center justify-between gap-2 max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <BrandLogo size={38} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight">Nakliye Defterim</span>
              <span className="hidden sm:inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full nd-badge-champagne">
                Bulut Senkronizasyonlu ERP
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
              Masaüstü PC • Android • iOS Ortak Bulut Hesap Sistemi
            </p>
          </div>
        </div>

        <button
          onClick={onToggleTheme}
          className="nd-btn-secondary px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs flex items-center gap-2 shrink-0"
        >
          <span>{darkMode ? 'Açık Tema' : 'Koyu Tema'}</span>
        </button>
      </div>

      {/* Center Gate Modal Card */}
      <div className="relative z-10 my-4 sm:my-auto mx-auto w-full max-w-[490px] nd-page-transition">
        <div className="nd-modal p-5 sm:p-7">
          {/* Icon & Header */}
          <div className="text-center mb-5">
            <div className="mx-auto mb-3 flex items-center justify-center">
              <BrandLogo size={62} />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full nd-layer text-[11px] font-bold mb-2">
              <Monitor size={12} style={{ color: 'var(--accent)' }} />
              <span>PC</span>
              <span className="opacity-40">•</span>
              <Smartphone size={12} style={{ color: 'var(--green)' }} />
              <span>Android & iOS</span>
              <span className="opacity-40">•</span>
              <Cloud size={12} style={{ color: 'var(--champagne)' }} />
              <span>Anlık Bulut Eşitleme</span>
            </div>

            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
              {mode === 'cloud_login'
                ? 'Kullanıcı Hesabınıza Giriş Yapın'
                : mode === 'cloud_register'
                ? 'Yeni Kullanıcı Hesabı Oluşturun'
                : 'Yerel Kasa & Şifreli Yedek'}
            </h1>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {mode === 'cloud_login'
                ? 'Hesabınızla giriş yaptığınızda Masaüstü, Android ve iOS cihazlarınızdaki tüm nakliye verileriniz otomatik olarak eşitlenir.'
                : mode === 'cloud_register'
                ? 'Kendinize özel bir kullanıcı hesabı açın; her hesabın veritabanı tamamen bağımsızdır ve tüm cihazlarınızda senkronize çalışır.'
                : 'Çevrimdışı yerel kasanızı açabilir veya yedek dosyasını (.json / .db) içe aktarabilirsiniz.'}
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1.5 mb-5 nd-layer rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('cloud_login');
                setError(null);
              }}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'cloud_login' ? 'nd-btn-primary shadow-sm' : 'opacity-75 hover:opacity-100'
              }`}
            >
              <UserCheck size={14} />
              <span>Giriş Yap</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('cloud_register');
                setError(null);
              }}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'cloud_register' ? 'nd-btn-primary shadow-sm' : 'opacity-75 hover:opacity-100'
              }`}
            >
              <UserPlus size={14} />
              <span>Hesap Aç</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('restore');
                setError(null);
              }}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mode === 'restore' ? 'nd-btn-primary shadow-sm' : 'opacity-75 hover:opacity-100'
              }`}
            >
              <Upload size={14} />
              <span>Yedek / Yerel</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl nd-badge-red text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-3.5 rounded-xl nd-badge-green text-xs flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* 1. CLOUD ACCOUNT LOGIN FORM */}
          {mode === 'cloud_login' && (
            <form onSubmit={handleCloudLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold mb-1.5">Kullanıcı Adı veya E-posta</label>
                <div
                  className="nd-layer flex items-center gap-2.5 px-3.5 py-2.5 transition-all"
                  style={{ borderRadius: '0.7rem' }}
                >
                  <UserCheck size={17} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  <input
                    type="text"
                    autoFocus
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Örn: umutergil"
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-0"
                    style={{ color: 'var(--text)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5">Hesap Şifresi</label>
                <div
                  className="nd-layer flex items-center gap-2.5 px-3.5 py-2.5 transition-all"
                  style={{ borderRadius: '0.7rem' }}
                >
                  <KeyRound size={17} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Hesap şifrenizi girin..."
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-0"
                    style={{ color: 'var(--text)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="shrink-0 p-1 rounded-md opacity-75 hover:opacity-100 transition-opacity"
                    title={showPass ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded accent-emerald-600 w-4 h-4"
                />
                <span style={{ color: 'var(--text-muted)' }}>
                  Bu cihazda oturumumu açık tut ve verileri otomatik senkronize et
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="nd-btn-primary w-full py-3 text-sm font-extrabold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Cloud size={17} />
                <span>
                  {loading
                    ? 'Bulut Hesabı Doğrulanıyor & Eşitleniyor...'
                    : 'Hesaba Giriş Yap & Verileri Eşitle'}
                </span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('cloud_register');
                    setError(null);
                  }}
                  className="text-xs font-bold underline opacity-85 hover:opacity-100"
                  style={{ color: 'var(--champagne)' }}
                >
                  Henüz hesabınız yok mu? Yeni Kullanıcı Hesabı Oluşturun →
                </button>
              </div>
            </form>
          )}

          {/* 2. CLOUD ACCOUNT REGISTRATION FORM */}
          {mode === 'cloud_register' && (
            <form onSubmit={handleCloudRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  Kullanıcı Adı (Tüm cihazlardan giriş yapacağınız kimlik)
                </label>
                <div
                  className="nd-layer flex items-center gap-2.5 px-3.5 py-2 transition-all"
                  style={{ borderRadius: '0.7rem' }}
                >
                  <UserPlus size={16} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Örn: umutergil"
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-0"
                    style={{ color: 'var(--text)' }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Ad Soyad / Yönetici</label>
                  <div
                    className="nd-layer flex items-center gap-2 px-3 py-2"
                    style={{ borderRadius: '0.7rem' }}
                  >
                    <UserCheck size={15} className="shrink-0" style={{ color: 'var(--accent)' }} />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Umut Ergil"
                      className="flex-1 min-w-0 bg-transparent text-xs font-semibold outline-none border-0"
                      style={{ color: 'var(--text)' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Şirket / Filo Unvanı</label>
                  <div
                    className="nd-layer flex items-center gap-2 px-3 py-2"
                    style={{ borderRadius: '0.7rem' }}
                  >
                    <Building2 size={15} className="shrink-0" style={{ color: 'var(--accent)' }} />
                    <input
                      type="text"
                      value={companyTitle}
                      onChange={(e) => setCompanyTitle(e.target.value)}
                      placeholder="Akon Group"
                      className="flex-1 min-w-0 bg-transparent text-xs font-semibold outline-none border-0"
                      style={{ color: 'var(--text)' }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold mb-1">Şifre Belirleyin</label>
                  <div
                    className="nd-layer flex items-center gap-2 px-3 py-2"
                    style={{ borderRadius: '0.7rem' }}
                  >
                    <KeyRound size={15} className="shrink-0" style={{ color: 'var(--accent)' }} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="En az 4 karakter..."
                      className="flex-1 min-w-0 bg-transparent text-xs font-semibold outline-none border-0"
                      style={{ color: 'var(--text)' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Şifre Tekrar</label>
                  <div
                    className="nd-layer flex items-center gap-2 px-3 py-2"
                    style={{ borderRadius: '0.7rem' }}
                  >
                    <Lock size={15} className="shrink-0" style={{ color: 'var(--accent)' }} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      minLength={4}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Şifreyi tekrar girin..."
                      className="flex-1 min-w-0 bg-transparent text-xs font-semibold outline-none border-0"
                      style={{ color: 'var(--text)' }}
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-2.5 rounded-xl nd-layer text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepLocalData}
                  onChange={(e) => setKeepLocalData(e.target.checked)}
                  className="rounded accent-emerald-600 w-4 h-4 mt-0.5 shrink-0"
                />
                <span className="leading-snug">
                  <strong>Bu cihazdaki mevcut verilerimi bu yeni hesaba aktar:</strong> Bilgisayarda veya telefonda daha önce girdiğiniz araç, sefer ve cari verileri yeni hesabınıza bağlanarak buluta yüklenir. (Sıfır/boş bir defter açmak için işareti kaldırın.)
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="nd-btn-primary w-full py-3 text-sm font-extrabold shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--green)' }}
              >
                <UserPlus size={17} />
                <span>
                  {loading
                    ? 'Hesap Oluşturuluyor & Buluta Yükleniyor...'
                    : 'Hesabı Oluştur & Bulut Senkronizasyonunu Başlat'}
                </span>
              </button>
            </form>
          )}

          {/* 3. LOCAL VAULT OR BACKUP RESTORE */}
          {mode === 'restore' && (
            <form onSubmit={handleLocalOrBackupUnlock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Yerel Kasa veya Yedek Dosyası Parolası
                </label>
                <div
                  className="nd-layer flex items-center gap-2.5 px-3.5 py-2.5 transition-all"
                  style={{ borderRadius: '0.7rem' }}
                >
                  <KeyRound size={17} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Parolayı girin..."
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-0"
                    style={{ color: 'var(--text)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="shrink-0 p-1 rounded-md opacity-75 hover:opacity-100 transition-opacity"
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="nd-btn-primary py-2.5 px-3 text-xs font-extrabold shadow-md disabled:opacity-50"
                >
                  {loading ? 'Açılıyor...' : 'Yerel Çevrimdışı Kasayı Aç'}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleRestoreFromBackupFile}
                  className="nd-btn-secondary py-2.5 px-3 text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Upload size={14} />
                  <span>Yedek Dosyası (.json/.db) Seç</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Security Info */}
      <div className="relative z-10 text-center text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        Nakliye Defterim • Çoklu Cihaz Bulut Senkronizasyonu (PC, Android & iOS) • AES-256 Korumalı
      </div>
    </div>
  );
};
