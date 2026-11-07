import {
  LiveMgmWeather,
  MgmDailyForecastItem,
  HaremGoldItem,
  CommodityQuote,
  LiveMarketsBundle
} from '../../shared/types';

const MGM_HADISE_MAP: Record<string, string> = {
  A: 'Açık ve Güneşli',
  AB: 'Az Bulutlu',
  PB: 'Parçalı Bulutlu',
  CB: 'Çok Bulutlu',
  HY: 'Hafif Yağmurlu',
  Y: 'Yağmurlu',
  KY: 'Kuvvetli Yağmurlu',
  SY: 'Sağanak Yağışlı',
  KSY: 'Kuvvetli Sağanak Yağışlı',
  GSY: 'Gökgürültülü Sağanak',
  SIS: 'Sisli (Görüş Düşük)',
  PUS: 'Puslu',
  KKY: 'Karla Karışık Yağmurlu',
  K: 'Kar Yağışlı',
  R: 'Kuvvetli Rüzgârlı'
};

const HAREM_CODE_META: {
  code: string;
  name: string;
  category: 'gold' | 'currency' | 'silver';
}[] = [
  { code: 'ALTIN', name: 'Has Altın (24 Ayar Gram)', category: 'gold' },
  { code: 'KULCEALTIN', name: 'Gram Altın (Külçe 995)', category: 'gold' },
  { code: 'CEYREK_YENI', name: 'Çeyrek Altın (Yeni)', category: 'gold' },
  { code: 'CEYREK_ESKI', name: 'Çeyrek Altın (Eski)', category: 'gold' },
  { code: 'YARIM_YENI', name: 'Yarım Altın (Yeni)', category: 'gold' },
  { code: 'TEK_YENI', name: 'Tam / Tek Altın (Yeni)', category: 'gold' },
  { code: 'ATA_YENI', name: 'Ata Cumhuriyet Altını', category: 'gold' },
  { code: 'GREMESE_YENI', name: 'Gremse (2.5\'luk) Altın', category: 'gold' },
  { code: 'ATA5_YENI', name: 'Beşli Ata Altın', category: 'gold' },
  { code: 'AYAR22', name: '22 Ayar Bilezik (Gram)', category: 'gold' },
  { code: 'AYAR14', name: '14 Ayar Altın (Gram)', category: 'gold' },
  { code: 'ONS', name: 'Ons Altın (USD)', category: 'gold' },
  { code: 'USDKG', name: 'Kilogram Altın ($/Kg)', category: 'gold' },
  { code: 'EURKG', name: 'Kilogram Altın (€/Kg)', category: 'gold' },
  { code: 'GUMUSTRY', name: 'Gümüş (Gram / TL)', category: 'silver' },
  { code: 'XAGUSD', name: 'Gümüş Ons ($/Oz)', category: 'silver' },
  { code: 'USDTRY', name: 'ABD Doları (USD/TRY)', category: 'currency' },
  { code: 'EURTRY', name: 'Euro (EUR/TRY)', category: 'currency' },
  { code: 'GBPTRY', name: 'İngiliz Sterlini (GBP/TRY)', category: 'currency' },
  { code: 'CHFTRY', name: 'İsviçre Frangı (CHF/TRY)', category: 'currency' },
  { code: 'EURUSD', name: 'EUR / USD Paritesi', category: 'currency' },
  { code: 'SARTRY', name: 'Suudi Riyali (SAR/TRY)', category: 'currency' }
];

const TURKISH_WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export class LiveFeedService {
  private cachedWeather: LiveMgmWeather | null = null;
  private cachedMarkets: LiveMarketsBundle | null = null;
  private lastWeatherAt = 0;
  private lastMarketsAt = 0;
  private inflightWeather: Promise<LiveMgmWeather> | null = null;
  private inflightMarkets: Promise<LiveMarketsBundle> | null = null;

  constructor() {
    // Warm up live caches in background on startup so UI transitions are 0ms
    setTimeout(() => {
      this.fetchMgmEdirneWeather(true).catch(() => {});
      this.fetchLiveMarketsBundle(true).catch(() => {});
    }, 300);
  }

  // ==========================================================
  // 1. RESMİ METEOROLOJİ GENEL MÜDÜRLÜĞÜ (MGM) EDİRNE SERVİSİ
  // ==========================================================
  async fetchMgmEdirneWeather(force = false): Promise<LiveMgmWeather> {
    const now = Date.now();
    if (!force && this.cachedWeather) {
      if (now - this.lastWeatherAt > 120_000 && !this.inflightWeather) {
        // Stale-while-revalidate in background
        void this.performWeatherFetch();
      }
      return this.cachedWeather;
    }
    return this.performWeatherFetch();
  }

  private async performWeatherFetch(): Promise<LiveMgmWeather> {
    if (this.inflightWeather) return this.inflightWeather;
    this.inflightWeather = this._doWeatherFetch().finally(() => {
      this.inflightWeather = null;
    });
    return this.inflightWeather;
  }

  private async _doWeatherFetch(): Promise<LiveMgmWeather> {
    const mgmHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Origin: 'https://www.mgm.gov.tr',
      Referer: 'https://www.mgm.gov.tr/'
    };

    try {
      const [sonRes, gunlukRes] = await Promise.all([
        fetch('https://servis.mgm.gov.tr/web/sondurumlar?merkezid=92201', { headers: mgmHeaders }),
        fetch('https://servis.mgm.gov.tr/web/tahminler/gunluk?istno=92201', { headers: mgmHeaders })
      ]);

      const sonArr = (await sonRes.json()) as any[];
      const gunlukArr = (await gunlukRes.json()) as any[];

      const cur = sonArr && sonArr[0] ? sonArr[0] : {};
      const fObj = gunlukArr && gunlukArr[0] ? gunlukArr[0] : {};

      const code = String(cur.hadiseKodu || 'PB');
      const forecast5Days: MgmDailyForecastItem[] = [];

      for (let i = 1; i <= 5; i++) {
        const rawDate = fObj[`tarihGun${i}`] || '';
        const dObj = rawDate ? new Date(rawDate) : new Date(Date.now() + i * 86400000);
        const fCode = String(fObj[`hadiseGun${i}`] || 'PB');

        forecast5Days.push({
          date: rawDate ? rawDate.slice(0, 10) : dObj.toISOString().slice(0, 10),
          dayLabel: TURKISH_WEEKDAYS[dObj.getDay()] || `Gün ${i}`,
          minTemp: Number(fObj[`enDusukGun${i}`] ?? 6),
          maxTemp: Number(fObj[`enYuksekGun${i}`] ?? 15),
          minHumidity: Number(fObj[`enDusukNemGun${i}`] ?? 45),
          maxHumidity: Number(fObj[`enYuksekNemGun${i}`] ?? 80),
          conditionCode: fCode,
          conditionText: MGM_HADISE_MAP[fCode] || 'Parçalı Bulutlu',
          windSpeed: Number(fObj[`ruzgarHizGun${i}`] ?? 12)
        });
      }

      const result: LiveMgmWeather = {
        city: 'Edirne / Merkez',
        stationId: Number(cur.istNo || 17050),
        temperature: Number(cur.sicaklik ?? 12.5),
        feelsLike: Number(cur.hissedilenSicaklik ?? cur.sicaklik ?? 12.5),
        humidity: Number(cur.nem ?? 58),
        windSpeed: Math.round(Number(cur.ruzgarHiz ?? 6) * 10) / 10,
        windDirection: Number(cur.ruzgarYon ?? 0),
        pressure: Number(cur.aktuelBasinc ?? 1018),
        visibilityMeters: Number(cur.gorus ?? 20000),
        conditionCode: code,
        conditionText: MGM_HADISE_MAP[code] || 'Parçalı Bulutlu',
        updatedAt: cur.veriZamani
          ? new Date(cur.veriZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        forecast5Days,
        isLive: true
      };

      this.cachedWeather = result;
      this.lastWeatherAt = Date.now();
      return result;
    } catch {
      if (this.cachedWeather) return this.cachedWeather;
      return {
        city: 'Edirne / Merkez',
        stationId: 17050,
        temperature: 12.3,
        feelsLike: 12.3,
        humidity: 53,
        windSpeed: 6.1,
        windDirection: 19,
        pressure: 1021.9,
        visibilityMeters: 20000,
        conditionCode: 'PB',
        conditionText: 'Parçalı Bulutlu',
        updatedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        forecast5Days: [],
        isLive: false
      };
    }
  }

  // ==========================================================
  // 2. HAREM ALTIN CANLI WEBSOCKET STREAM + YAHOO EMTİA SERVİSİ
  // ==========================================================
  private fetchHaremSocketSnapshot(timeoutMs = 3800): Promise<Record<string, any> | null> {
    return new Promise((resolve) => {
      let settled = false;
      const done = (val: Record<string, any> | null) => {
        if (!settled) {
          settled = true;
          resolve(val);
        }
      };

      let ws: WebSocket | null = null;
      const timer = setTimeout(() => {
        try {
          ws?.close();
        } catch {}
        done(null);
      }, timeoutMs);

      try {
        // Node 22+ / Electron native WebSocket
        const WSClass = (globalThis as any).WebSocket;
        if (!WSClass) {
          clearTimeout(timer);
          done(null);
          return;
        }

        ws = new WSClass('wss://hrmsocketonly.haremaltin.com/socket.io/?EIO=4&transport=websocket', {
          headers: {
            Origin: 'https://canlipiyasalar.haremaltin.com',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
          }
        });

        ws!.onmessage = (ev: any) => {
          const msg = String(ev.data || '');
          if (msg.startsWith('0')) {
            ws?.send('40');
          } else if (msg.startsWith('42')) {
            try {
              const arr = JSON.parse(msg.slice(2));
              if (arr && arr[0] === 'price_changed' && arr[1]?.data) {
                clearTimeout(timer);
                try {
                  ws?.close();
                } catch {}
                done(arr[1].data);
              }
            } catch {}
          }
        };

        ws!.onerror = () => {
          clearTimeout(timer);
          try {
            ws?.close();
          } catch {}
          done(null);
        };
      } catch {
        clearTimeout(timer);
        done(null);
      }
    });
  }

  private async fetchYahooCommodity(symbol: string, name: string, unit: string): Promise<CommodityQuote | null> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?interval=15m&range=5d`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) return null;
      const json = (await res.json()) as any;
      const result = json?.chart?.result?.[0];
      if (!result) return null;

      const meta = result.meta || {};
      const closes: number[] = (result.indicators?.quote?.[0]?.close || []).filter(
        (x: any) => typeof x === 'number' && !isNaN(x)
      );

      const price = Number(meta.regularMarketPrice || closes[closes.length - 1] || 0);
      const prevClose = Number(meta.chartPreviousClose || meta.previousClose || closes[0] || price);
      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const recentPoints = closes.slice(-32);
      const high = Number(meta.regularMarketDayHigh || Math.max(...recentPoints, price));
      const low = Number(meta.regularMarketDayLow || Math.min(...recentPoints, price));

      return {
        symbol,
        name,
        unit,
        price,
        prevClose,
        change,
        changePercent,
        high,
        low,
        history: recentPoints.length > 2 ? recentPoints : [prevClose, price],
        updatedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    } catch {
      return null;
    }
  }

  async fetchLiveMarketsBundle(force = false): Promise<LiveMarketsBundle> {
    const now = Date.now();
    if (!force && this.cachedMarkets) {
      if (now - this.lastMarketsAt > 20_000 && !this.inflightMarkets) {
        // Stale-while-revalidate in background
        void this.performMarketsFetch();
      }
      return this.cachedMarkets;
    }
    return this.performMarketsFetch();
  }

  private async performMarketsFetch(): Promise<LiveMarketsBundle> {
    if (this.inflightMarkets) return this.inflightMarkets;
    this.inflightMarkets = this._doMarketsFetch().finally(() => {
      this.inflightMarkets = null;
    });
    return this.inflightMarkets;
  }

  private async _doMarketsFetch(): Promise<LiveMarketsBundle> {
    try {
      const [haremRaw, brentQuote, wtiQuote, gasOilQuote, goldFuturesQuote] = await Promise.all([
        this.fetchHaremSocketSnapshot(),
        this.fetchYahooCommodity('BZ=F', 'Brent Petrol (ICE Vadeli)', 'USD / Varil'),
        this.fetchYahooCommodity('CL=F', 'WTI Ham Petrol (NYMEX)', 'USD / Varil'),
        this.fetchYahooCommodity('HO=F', 'Londra Gaz Yağı / ULSD Motorin', 'USD / Galon'),
        this.fetchYahooCommodity('GC=F', 'Küresel Altın Vadeli (COMEX)', 'USD / Ons')
      ]);

      const haremGold: HaremGoldItem[] = [];
      const haremCurrencies: HaremGoldItem[] = [];

      if (haremRaw) {
        for (const meta of HAREM_CODE_META) {
          const item = haremRaw[meta.code];
          if (!item) continue;
          const buying = parseFloat(String(item.alis || 0));
          const selling = parseFloat(String(item.satis || 0));
          const close = parseFloat(String(item.kapanis || selling || 1));
          const low = parseFloat(String(item.dusuk || buying));
          const high = parseFloat(String(item.yuksek || selling));
          const changePercent = close > 0 ? ((selling - close) / close) * 100 : 0;

          const parsedItem: HaremGoldItem = {
            code: meta.code,
            name: meta.name,
            category: meta.category,
            buying,
            selling,
            low,
            high,
            close,
            changePercent,
            direction:
              item.dir?.satis_dir === 'up' || changePercent > 0
                ? 'up'
                : item.dir?.satis_dir === 'down' || changePercent < 0
                ? 'down'
                : 'flat',
            updatedAt: item.tarih || new Date().toLocaleTimeString('tr-TR')
          };

          if (meta.category === 'currency') {
            haremCurrencies.push(parsedItem);
          } else {
            haremGold.push(parsedItem);
          }
        }
      } else {
        // Fallback to Truncgil JSON if Harem WebSocket port 443 is blocked on network
        const trRes = await fetch('https://finans.truncgil.com/v4/today.json');
        const trData = (await trRes.json()) as any;
        const mapTr = (key: string, code: string, name: string, cat: 'gold' | 'currency' | 'silver') => {
          const d = trData[key];
          if (!d) return;
          const buying = Number(d.Buying || 0);
          const selling = Number(d.Selling || 0);
          const chg = Number(d.Change || 0);
          const obj: HaremGoldItem = {
            code,
            name,
            category: cat,
            buying,
            selling,
            low: buying * 0.995,
            high: selling * 1.005,
            close: selling / (1 + chg / 100),
            changePercent: chg,
            direction: chg >= 0 ? 'up' : 'down',
            updatedAt: trData.Update_Date || new Date().toLocaleTimeString('tr-TR')
          };
          if (cat === 'currency') haremCurrencies.push(obj);
          else haremGold.push(obj);
        };
        mapTr('GRA', 'KULCEALTIN', 'Gram Altın (24 Ayar)', 'gold');
        mapTr('HAS', 'ALTIN', 'Has Altın (Gram)', 'gold');
        mapTr('CEYREKALTIN', 'CEYREK_YENI', 'Çeyrek Altın', 'gold');
        mapTr('YARIMALTIN', 'YARIM_YENI', 'Yarım Altın', 'gold');
        mapTr('TAMALTIN', 'TEK_YENI', 'Tam Altın', 'gold');
        mapTr('ATAALTIN', 'ATA_YENI', 'Ata Cumhuriyet Altını', 'gold');
        mapTr('GREMSEALTIN', 'GREMESE_YENI', 'Gremse Altın', 'gold');
        mapTr('YIA', 'AYAR22', '22 Ayar Bilezik', 'gold');
        mapTr('GUMUS', 'GUMUSTRY', 'Gümüş (Gram / TL)', 'silver');
        mapTr('USD', 'USDTRY', 'ABD Doları (USD/TRY)', 'currency');
        mapTr('EUR', 'EURTRY', 'Euro (EUR/TRY)', 'currency');
        mapTr('GBP', 'GBPTRY', 'İngiliz Sterlini (GBP/TRY)', 'currency');
        mapTr('CHF', 'CHFTRY', 'İsviçre Frangı (CHF/TRY)', 'currency');
      }

      const commodities: CommodityQuote[] = [];
      if (brentQuote) commodities.push(brentQuote);
      if (gasOilQuote) {
        // Also compute London Gas Oil $/Ton equivalent (~315 gallons per metric ton)
        const tonPrice = Math.round(gasOilQuote.price * 315 * 100) / 100;
        const tonPrev = Math.round(gasOilQuote.prevClose * 315 * 100) / 100;
        commodities.push({
          symbol: 'LGO-TON',
          name: 'Londra Gaz Yağı (ICE Gas Oil)',
          unit: 'USD / Ton',
          price: tonPrice,
          prevClose: tonPrev,
          change: tonPrice - tonPrev,
          changePercent: gasOilQuote.changePercent,
          high: Math.round(gasOilQuote.high * 315 * 100) / 100,
          low: Math.round(gasOilQuote.low * 315 * 100) / 100,
          history: gasOilQuote.history.map((v) => Math.round(v * 315 * 100) / 100),
          updatedAt: gasOilQuote.updatedAt
        });
        commodities.push(gasOilQuote);
      }
      if (wtiQuote) commodities.push(wtiQuote);
      if (goldFuturesQuote) commodities.push(goldFuturesQuote);

      const bundle: LiveMarketsBundle = {
        source: haremRaw ? 'Harem Altın Canlı WebSocket (hrmsocketonly.haremaltin.com) & ICE/NYMEX' : 'Serbest Piyasa Canlı Veri',
        fetchedAt: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isLive: true,
        haremGold,
        haremCurrencies,
        commodities
      };

      this.cachedMarkets = bundle;
      this.lastMarketsAt = Date.now();
      return bundle;
    } catch {
      if (this.cachedMarkets) return this.cachedMarkets;
      return {
        source: 'Çevrimdışı Önbellek',
        fetchedAt: new Date().toLocaleTimeString('tr-TR'),
        isLive: false,
        haremGold: [],
        haremCurrencies: [],
        commodities: []
      };
    }
  }
}
