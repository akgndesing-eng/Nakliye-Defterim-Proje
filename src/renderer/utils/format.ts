export function formatCurrency(amountTL: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(amountTL || 0));
}

export function formatCompactCurrency(amountTL: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number(amountTL || 0));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('tr-TR').format(Number(value || 0));
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

export function getDaysRemaining(targetDateStr?: string | null): number | null {
  if (!targetDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr.slice(0, 10) + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getCurrentMonth(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function getCurrentDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
