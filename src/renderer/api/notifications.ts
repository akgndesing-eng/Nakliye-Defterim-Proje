import { Capacitor } from '@capacitor/core';
import { AppNotification, Vehicle, VehicleDocumentRecord } from '../../shared/types';
import { api } from './index';

const DOC_CHANNEL_ID = 'nakliye-evrak-uyari';
const NOTIFIED_STORAGE_KEY = 'nd_doc_os_notified_v45';

function getTodayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function stableIntId(seed: string, min = 70000, range = 9999): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return min + (Math.abs(hash) % range);
}

function getNotifiedMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function markNotifiedToday(keys: string[], todayStr: string): void {
  try {
    const map = getNotifiedMap();
    for (const k of keys) {
      map[k] = todayStr;
    }
    // Prune stale days so storage stays compact
    for (const existingKey of Object.keys(map)) {
      if (map[existingKey] !== todayStr) {
        delete map[existingKey];
      }
    }
    localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

function extractScheduledTargets(
  doc: VehicleDocumentRecord,
  plate: string
): Array<{ key: string; label: string; dateStr: string; remindDays: number }> {
  const remindDays = Number(doc.reminder_days_before ?? 30) || 30;
  const targets: Array<{ key: string; label: string; dateStr: string; remindDays: number }> = [];

  const pushIf = (enabled: number | undefined, key: string, label: string, dateStr?: string) => {
    if ((enabled ?? 1) === 1 && dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      targets.push({ key, label, dateStr: dateStr.slice(0, 10), remindDays });
    }
  };

  pushIf(doc.traffic_insurance_remind, 'traffic', 'Trafik Sigortası Bitişi', doc.traffic_insurance_end);
  pushIf(doc.kasko_remind, 'kasko', 'Kasko Bitişi', doc.kasko_end);
  pushIf(doc.inspection_remind, 'inspection', 'Araç Muayene (TÜVTÜRK)', doc.inspection_end);
  pushIf(
    doc.adr_other_remind,
    'adr_other',
    (doc.adr_other_label || 'ADR - Diğer Belge').trim(),
    doc.adr_other_end
  );
  pushIf(
    doc.hazmat_policy_start_remind,
    'hazmat_start',
    'Tehlikeli Madde / Atık Poliçe Başlangıcı',
    doc.hazmat_policy_start
  );
  pushIf(
    doc.hazmat_policy_end_remind,
    'hazmat_end',
    'Tehlikeli Madde / Atık Poliçe Bitişi',
    doc.hazmat_policy_end
  );

  for (const extra of doc.extra_items || []) {
    if (extra?.remind !== false && extra?.date && /^\d{4}-\d{2}-\d{2}/.test(extra.date)) {
      targets.push({
        key: `extra_${extra.id}`,
        label: (extra.label || 'Ek Araç Evrağı').trim(),
        dateStr: extra.date.slice(0, 10),
        remindDays
      });
    }
  }

  return targets.map((t) => ({ ...t, label: `${plate} • ${t.label}` }));
}

async function scheduleCapacitorNotifications(
  docs: VehicleDocumentRecord[],
  vehicles: Vehicle[],
  immediateAlerts: AppNotification[]
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }

    if (Capacitor.getPlatform() === 'android') {
      await LocalNotifications.createChannel({
        id: DOC_CHANNEL_ID,
        name: 'Araç Evrak & Sigorta Hatırlatıcıları',
        description: 'Sigorta, kasko, muayene ve ADR bitişine 1 ay kala hatırlatma bildirimleri',
        importance: 4,
        visibility: 1,
        vibration: true
      }).catch(() => {});
    }

    // Cancel previously scheduled doc alerts in ID range [70000..79999]
    const pending = await LocalNotifications.getPending();
    const docPending = pending.notifications.filter((n) => n.id >= 70000 && n.id < 80000);
    if (docPending.length > 0) {
      await LocalNotifications.cancel({ notifications: docPending });
    }

    const plateMap = new Map<string, string>();
    for (const v of vehicles) plateMap.set(v.id, v.plate);

    const nowMs = Date.now();
    const toSchedule: Array<any> = [];
    const usedIds = new Set<number>();

    const nextUniqueId = (seed: string) => {
      let id = stableIntId(seed, 70000, 9999);
      while (usedIds.has(id)) {
        id = id >= 79998 ? 70000 : id + 1;
      }
      usedIds.add(id);
      return id;
    };

    for (const doc of docs) {
      const plate = doc.vehicle_plate || plateMap.get(doc.vehicle_id) || 'Araç';
      const targets = extractScheduledTargets(doc, plate);

      for (const target of targets) {
        const offsets = Array.from(new Set([target.remindDays, 15, 7, 1, 0]));
        for (const offsetDays of offsets) {
          const targetDate = new Date(`${target.dateStr}T09:00:00`);
          if (Number.isNaN(targetDate.getTime())) continue;
          targetDate.setDate(targetDate.getDate() - offsetDays);

          if (targetDate.getTime() > nowMs + 5000) {
            const remainingText =
              offsetDays === 0
                ? 'BUGÜN SON GÜN!'
                : offsetDays === 1
                ? 'Son 1 gün kaldı!'
                : `Bitimine ${offsetDays} gün (yaklaşık ${offsetDays >= 28 ? '1 ay' : `${offsetDays} gün`}) kaldı.`;

            toSchedule.push({
              id: nextUniqueId(`${doc.vehicle_id}:${target.key}:${target.dateStr}:${offsetDays}`),
              title: `Evrak Hatırlatıcısı: ${plate}`,
              body: `${target.label} (${target.dateStr}) — ${remainingText}`,
              channelId: DOC_CHANNEL_ID,
              schedule: { at: targetDate, allowWhileIdle: true },
              extra: { targetTab: 'vehicle_docs', vehicleId: doc.vehicle_id }
            });
          }
        }
      }
    }

    // Immediate alerts for documents already within 30 days / overdue today
    immediateAlerts.slice(0, 5).forEach((alert, idx) => {
      toSchedule.push({
        id: nextUniqueId(`immediate:${alert.id}:${idx}`),
        title: alert.title,
        body: `${alert.subtitle}${alert.dateStr ? ` (${alert.dateStr})` : ''}`,
        channelId: DOC_CHANNEL_ID,
        schedule: { at: new Date(nowMs + 1200 + idx * 500) },
        extra: { targetTab: 'vehicle_docs', vehicleId: alert.entityId }
      });
    });

    if (toSchedule.length > 0) {
      // Android caps alarm batches safely; keep earliest 50 upcoming events
      await LocalNotifications.schedule({ notifications: toSchedule.slice(0, 50) });
    }
  } catch (err) {
    console.warn('[Notifications] Capacitor local notification error:', err);
  }
}

export async function syncVehicleDocumentReminderNotifications(
  notificationsInput?: AppNotification[],
  options?: { forceImmediate?: boolean }
): Promise<AppNotification[]> {
  try {
    const [rawNotifs, rawDocs, rawVehicles] = await Promise.all([
      notificationsInput ? Promise.resolve(notificationsInput) : api.getNotifications(),
      api.getVehicleDocuments().catch(() => [] as VehicleDocumentRecord[]),
      api.getVehicles().catch(() => [] as Vehicle[])
    ]);

    const notifications: AppNotification[] = Array.isArray(rawNotifs) ? rawNotifs : [];
    const docs: VehicleDocumentRecord[] = Array.isArray(rawDocs) ? rawDocs : [];
    const vehicles: Vehicle[] = Array.isArray(rawVehicles) ? rawVehicles : [];

    const docAlerts = notifications.filter(
      (n: AppNotification) =>
        n.category === 'vehicle_document_expiry' ||
        n.category === 'vehicle_inspection' ||
        n.category === 'vehicle_insurance'
    );
    const todayStr = getTodayStr();
    const notifiedMap = getNotifiedMap();

    const newlyDueAlerts = options?.forceImmediate
      ? docAlerts
      : docAlerts.filter((a: AppNotification) => notifiedMap[`${a.id}::${a.subtitle}`] !== todayStr);

    // 1. Schedule / trigger Android & iOS native local notifications
    await scheduleCapacitorNotifications(docs, vehicles, newlyDueAlerts);

    // 2. Trigger Windows Desktop / Web OS notification & in-app toast banner
    if (newlyDueAlerts.length > 0) {
      markNotifiedToday(
        newlyDueAlerts.map((a: AppNotification) => `${a.id}::${a.subtitle}`),
        todayStr
      );

      if (!Capacitor.isNativePlatform()) {
        if (newlyDueAlerts.length === 1) {
          const single = newlyDueAlerts[0];
          api
            .showOsNotification(
              single.title,
              `${single.subtitle}${single.dateStr ? ` • ${single.dateStr}` : ''}`
            )
            .catch(() => {});
        } else {
          const preview = newlyDueAlerts
            .slice(0, 3)
            .map((a: AppNotification) => `${a.title}: ${a.subtitle}`)
            .join(' | ');
          api
            .showOsNotification(
              `${newlyDueAlerts.length} Araç Evrak Hatırlatması (1 Ay / Yaklaşan)`,
              preview
            )
            .catch(() => {});
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('nd-doc-reminder-toast', {
            detail: { alerts: newlyDueAlerts }
          })
        );
      }
    }

    return docAlerts;
  } catch {
    return [];
  }
}

export async function sendTestVehicleDocNotification(plate: string, bodyText?: string): Promise<void> {
  const title = `Araç Evrak Bildirimi: ${plate}`;
  const body =
    bodyText ||
    `${plate} plakalı aracın evrak bitiş hatırlatıcısı aktif (Masaüstü, Android ve iOS bağlı).`;

  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({
          id: DOC_CHANNEL_ID,
          name: 'Araç Evrak & Sigorta Hatırlatıcıları',
          importance: 4,
          vibration: true
        }).catch(() => {});
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 79995,
            title,
            body,
            channelId: DOC_CHANNEL_ID,
            schedule: { at: new Date(Date.now() + 500) }
          }
        ]
      });
    } catch {}
  } else {
    await api.showOsNotification(title, body).catch(() => {});
  }

  if (typeof window !== 'undefined') {
    const testAlert: AppNotification = {
      id: `test_${Date.now()}`,
      category: 'vehicle_document_expiry',
      severity: 'warning',
      title,
      subtitle: body,
      dateStr: getTodayStr(),
      targetTab: 'vehicle_docs'
    };
    window.dispatchEvent(
      new CustomEvent('nd-doc-reminder-toast', {
        detail: {
          alerts: [testAlert]
        }
      })
    );
  }
}
