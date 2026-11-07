import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, Upload, ShieldCheck, Settings } from 'lucide-react';
import { MonthlyReportSummary, NavTabId } from '../../shared/types';
import { api, getCached } from '../api';
import { formatCurrency } from '../utils/format';

interface ReportsModuleProps {
  onExportBackup: () => void;
  onNavigate?: (tab: NavTabId) => void;
}

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  onExportBackup,
  onNavigate
}) => {
  const [reports, setReports] = useState<MonthlyReportSummary[]>(
    () => getCached<MonthlyReportSummary[]>('reports') || []
  );

  useEffect(() => {
    api.getMonthlyReports().then((res) => setReports(res || []));
  }, []);

  const grandTotalRevenue = reports.reduce((acc, r) => acc + r.totalRevenue, 0);
  const grandTotalExpenses = reports.reduce((acc, r) => acc + r.totalAllExpenses, 0);
  const grandNetProfit = grandTotalRevenue - grandTotalExpenses;

  return (
    <div className="p-6 space-y-6">
      {/* Top Backup & Export Banner */}
      <div className="nd-card p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-white"
            style={{ backgroundColor: 'var(--green)' }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold">
              Yedekleme & Dışa Aktarma (AES-256 Şifreli Tam Yedek)
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Tek tıkla tüm ilişkisel SQLite tablolarını şifreli JSON/DB olarak dışa aktarın veya mevcut yedeği geri yükleyin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigate && (
            <button
              onClick={() => onNavigate('settings')}
              className="nd-btn-secondary px-4 py-2.5 text-xs flex items-center gap-2"
            >
              <Settings size={15} />
              <span>Yedek Aç & Güvenlik Ayarları</span>
            </button>
          )}
          <button
            onClick={onExportBackup}
            className="nd-btn-primary px-4 py-2.5 text-xs flex items-center gap-2 shadow-md"
            style={{ backgroundColor: 'var(--green)' }}
          >
            <Download size={15} />
            <span>Tek Tıkla Şifreli Tam Yedek Al (Export)</span>
          </button>
        </div>
      </div>

      {/* Monthly Reports Table */}
      <div className="nd-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} style={{ color: 'var(--accent)' }} />
            <div>
              <h3 className="text-sm font-bold">Ay Bazında Operasyon ve Finansal Bilanço Tablosu</h3>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Sefer/tur sayısı, durak sayısı, toplam ciro, sefer giderleri, araç ek masrafları, tahsil edilen ve kalan bakiye
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Kümülatif Net Kâr: </span>
            <b
              className="text-sm font-black tabular-nums"
              style={{ color: grandNetProfit >= 0 ? 'var(--green)' : 'var(--red)' }}
            >
              {formatCurrency(grandNetProfit)}
            </b>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-[11px]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <th className="py-2.5 px-2">Dönem (Ay)</th>
                <th className="py-2.5 px-2 text-center">Sefer / Tur</th>
                <th className="py-2.5 px-2 text-center">Durak Sayısı</th>
                <th className="py-2.5 px-2 text-right">Toplam Ciro (Navlun)</th>
                <th className="py-2.5 px-2 text-right">Sefer Giderleri</th>
                <th className="py-2.5 px-2 text-right">Net Kâr</th>
                <th className="py-2.5 px-2 text-right">Tahsil Edilen</th>
                <th className="py-2.5 px-2 text-right">Kalan Bakiye</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {reports.map((r) => (
                <tr key={r.month} className="hover:opacity-95">
                  <td className="py-3 px-2 font-extrabold tabular-nums">{r.month}</td>
                  <td className="py-3 px-2 text-center font-bold tabular-nums">{r.tripCount} Tur</td>
                  <td className="py-3 px-2 text-center font-bold tabular-nums">{r.stopCount} Durak</td>
                  <td className="py-3 px-2 text-right font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                    {formatCurrency(r.totalRevenue)}
                  </td>
                  <td className="py-3 px-2 text-right tabular-nums" style={{ color: 'var(--red)' }}>
                    {formatCurrency(r.totalTripExpenses)}
                  </td>
                  <td
                    className="py-3 px-2 text-right font-extrabold tabular-nums"
                    style={{ color: r.netOperatingProfit >= 0 ? 'var(--green)' : 'var(--red)' }}
                  >
                    {formatCurrency(r.netOperatingProfit)}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold tabular-nums" style={{ color: 'var(--green)' }}>
                    {formatCurrency(r.collectedAmount)}
                  </td>
                  <td className="py-3 px-2 text-right font-extrabold tabular-nums" style={{ color: 'var(--amber)' }}>
                    {formatCurrency(r.remainingReceivables)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
