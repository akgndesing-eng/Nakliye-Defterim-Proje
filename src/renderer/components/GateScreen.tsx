import React, { useState } from 'react';
import { Lock, ShieldCheck, Upload, Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { GateStatus } from '../../shared/types';
import { BrandLogo } from './BrandLogo';
import { api } from '../api';

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
  const [mode, setMode] = useState<'login' | 'setup' | 'restore'>(
    gateStatus.isInitialized ? 'login' : 'setup'
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (password.length < 10) {
      setError('Güvenlik şartnamesi gereği ana parola en az 10 karakter olmalıdır.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Girdiğiniz parolalar birbiriyle eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      const nextStatus = await api.setupVault(password);
      onUnlocked(nextStatus);
    } catch (err: any) {
      setError(err?.message || 'Kurulum sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!password) {
      setError('Lütfen ana parolanızı girin.');
      return;
    }

    setLoading(true);
    try {
      const nextStatus = await api.unlockVault(password);
      onUnlocked(nextStatus);
    } catch (err: any) {
      setError(err?.message || 'Ana parola hatalı veya kilit açılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFromBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (password.length < 10) {
      setError('Yedek dosyasının şifresini çözmek için en az 10 karakterli ana parolanızı girin.');
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
      {/* Subtle, low-fatigue architectural ambient backdrop */}
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 18% 15%, rgba(45, 110, 85, 0.12), transparent 50%), radial-gradient(circle at 82% 85%, rgba(197, 168, 114, 0.1), transparent 50%)'
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
                Kurumsal Lojistik Yönetimi
              </span>
            </div>
            <p className="text-[11px] sm:text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>
              AES-256 Şifreli Yerel Veritabanı
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
      <div className="relative z-10 my-4 sm:my-auto mx-auto w-full max-w-[460px] nd-page-transition">
        <div className="nd-modal p-5 sm:p-8">
          {/* Icon & Header */}
          <div className="text-center mb-6">
            <div className="mx-auto mb-3.5 flex items-center justify-center">
              <BrandLogo size={64} />
            </div>

            <h1 className="text-xl font-extrabold tracking-tight">
              {mode === 'setup'
                ? 'İlk Kurulum — Ana Parola Belirleyin'
                : mode === 'restore'
                ? 'Şifreli Yedekten Defter Aç'
                : 'Defter Kilitli — Giriş Yapın'}
            </h1>
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              {mode === 'setup'
                ? 'Veritabanınız AES-256 ile şifrelenir. Lütfen en az 10 karakterli güçlü bir ana parola oluşturun.'
                : mode === 'restore'
                ? 'Dışarıdan alınan şifreli .json veya .db yedek dosyasını ana parolası ile içe aktarın.'
                : 'Nakliye Defterim v4.5 veritabanı şifresini çözmek için ana parolanızı girin.'}
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1.5 mb-5 nd-layer">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'login' ? 'nd-btn-primary shadow-sm' : 'opacity-75 hover:opacity-100'
              }`}
            >
              Kilit Aç
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('setup');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'setup' ? 'nd-btn-primary shadow-sm' : 'opacity-75 hover:opacity-100'
              }`}
            >
              İlk Kurulum
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('restore');
                setError(null);
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                mode === 'restore' ? 'nd-btn-primary shadow-sm' : 'opacity-75 hover:opacity-100'
              }`}
            >
              Yedekten Aç
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

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">Ana Parola</label>
                <div
                  className="nd-layer flex items-center gap-2.5 px-3.5 py-2.5 transition-all"
                  style={{ borderRadius: '0.7rem' }}
                >
                  <KeyRound size={17} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    autoFocus
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ana parolanızı girin..."
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-0"
                    style={{ color: 'var(--text)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="shrink-0 p-1 rounded-md opacity-75 hover:opacity-100 transition-opacity"
                    title={showPass ? 'Parolayı Gizle' : 'Parolayı Göster'}
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="nd-btn-primary w-full py-3 text-sm shadow-md disabled:opacity-50"
              >
                {loading ? 'Şifre Çözülüyor...' : 'Defter Kilidini Aç (Unlock)'}
              </button>

              {!gateStatus.isInitialized && (
                <div className="p-3 rounded-xl nd-badge-amber text-xs text-center">
                  Henüz ana parola belirlenmemiş. Lütfen <b>İlk Kurulum</b> sekmesinden en az 10 karakterli parolanızı oluşturun.
                </div>
              )}
            </form>
          )}

          {/* INITIAL SETUP FORM */}
          {mode === 'setup' && (
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold">Yeni Ana Parola (En az 10 karakter)</label>
                  <span
                    className={`text-xs font-extrabold tabular-nums ${
                      password.length >= 10 ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                  >
                    {password.length} / 10+
                  </span>
                </div>
                <div
                  className="nd-layer flex items-center gap-2.5 px-3.5 py-2.5 transition-all"
                  style={{ borderRadius: '0.7rem' }}
                >
                  <KeyRound size={17} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="En az 10 karakterli ana parola..."
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-0"
                    style={{ color: 'var(--text)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="shrink-0 p-1 rounded-md opacity-75 hover:opacity-100 transition-opacity"
                    title={showPass ? 'Parolayı Gizle' : 'Parolayı Göster'}
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5">Ana Parola Tekrarı</label>
                <div
                  className="nd-layer flex items-center gap-2.5 px-3.5 py-2.5 transition-all"
                  style={{ borderRadius: '0.7rem' }}
                >
                  <Lock size={17} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={10}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Parolayı tekrar girin..."
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-0"
                    style={{ color: 'var(--text)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="shrink-0 p-1 rounded-md opacity-75 hover:opacity-100 transition-opacity"
                    title={showPass ? 'Parolayı Gizle' : 'Parolayı Göster'}
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="nd-btn-primary w-full py-3 text-sm shadow-md disabled:opacity-50"
                style={{ backgroundColor: 'var(--green)' }}
              >
                {loading ? 'Şifreli Veritabanı Kuruluyor...' : 'Şifreli Veritabanını Oluştur ve Başlat'}
              </button>
            </form>
          )}

          {/* RESTORE BACKUP FORM */}
          {mode === 'restore' && (
            <form onSubmit={handleRestoreFromBackup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Yedek Dosyasının Ana Parolası (En az 10 karakter)
                </label>
                <div
                  className="nd-layer flex items-center gap-2.5 px-3.5 py-2.5 transition-all"
                  style={{ borderRadius: '0.7rem' }}
                >
                  <KeyRound size={17} className="shrink-0" style={{ color: 'var(--accent)' }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Yedeğe ait ana parolayı girin..."
                    className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-0"
                    style={{ color: 'var(--text)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="shrink-0 p-1 rounded-md opacity-75 hover:opacity-100 transition-opacity"
                    title={showPass ? 'Parolayı Gizle' : 'Parolayı Göster'}
                  >
                    {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="nd-btn-primary w-full py-3 text-sm flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                <Upload size={16} />
                <span>{loading ? 'Yedek Çözülüyor...' : 'Şifreli .json / .db Dosyası Seç ve Aç'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Security Info */}
      <div className="relative z-10 text-center text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        Nakliye Defterim • Kurumsal Filo & Lojistik Yönetim Sistemi • AES-256 Korumalı
      </div>
    </div>
  );
};
