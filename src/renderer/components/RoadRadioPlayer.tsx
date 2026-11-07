import React, { useState, useRef, useEffect } from 'react';
import {
  Radio,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  SkipForward,
  SkipBack,
  Search,
  Signal
} from 'lucide-react';
import { RadioStationItem } from '../../shared/types';

export const TURKISH_RADIO_STATIONS: RadioStationItem[] = [
  // 1. ULUSAL & HABER
  {
    id: 'trt-fm',
    name: 'TRT FM Türkiye',
    category: 'Ulusal & Haber',
    frequency: '91.4 FM',
    streamUrl: 'https://trt.radyotvonline.net/trtfm',
    backupUrl: 'http://46.20.3.250/;stream',
    codec: 'AAC+'
  },
  {
    id: 'trt-haber',
    name: 'TRT Haber Radyo',
    category: 'Ulusal & Haber',
    frequency: '95.0 FM',
    streamUrl: 'https://trt.radyotvonline.net/trthaber',
    backupUrl: 'https://trt.radyotvonline.net/trtfm',
    codec: 'AAC+'
  },
  {
    id: 'radyo-7',
    name: 'Radyo 7 Ulusal',
    category: 'Ulusal & Haber',
    frequency: '104.6 FM',
    streamUrl: 'http://46.20.3.250/;stream',
    backupUrl: 'https://trt.radyotvonline.net/trtfm',
    codec: 'MP3'
  },
  {
    id: 'alem-fm',
    name: 'Alem FM',
    category: 'Ulusal & Haber',
    frequency: '89.2 FM',
    streamUrl: 'https://turkmedya.radyotvonline.net/alemfmaac',
    backupUrl: 'http://46.20.3.250/;stream',
    codec: 'AAC'
  },
  {
    id: 'show-radyo',
    name: 'Show Radyo',
    category: 'Ulusal & Haber',
    frequency: '89.8 FM',
    streamUrl: 'http://showradyo.radyotvonline.net/showradyoaac/',
    backupUrl: 'https://turkmedya.radyotvonline.net/alemfmaac',
    codec: 'AAC'
  },

  // 2. POP & HİT
  {
    id: 'super-fm',
    name: 'Süper FM',
    category: 'Pop & Hit',
    frequency: '90.8 FM',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FM_SC',
    backupUrl: 'http://27913.live.streamtheworld.com/SUPER_FMAAC_SC',
    codec: 'MP3'
  },
  {
    id: 'kral-turk',
    name: 'Kral Türk FM',
    category: 'Pop & Hit',
    frequency: '92.0 FM',
    streamUrl: 'https://live.radyositesihazir.com/8032/stream',
    backupUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FM_SC',
    codec: 'MP3'
  },
  {
    id: 'radyo-fenomen',
    name: 'Radyo Fenomen',
    category: 'Pop & Hit',
    frequency: '100.4 FM',
    streamUrl: 'https://live.radyofenomen.com/fenomen/128/icecast.audio',
    backupUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FM_SC?',
    codec: 'AAC+'
  },
  {
    id: 'metro-fm',
    name: 'Metro FM',
    category: 'Pop & Hit',
    frequency: '97.2 FM',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FM_SC?',
    backupUrl: 'http://25553.live.streamtheworld.com/METRO_FMAAC_SC',
    codec: 'MP3'
  },
  {
    id: 'virgin-radio',
    name: 'Virgin Radio Türkiye',
    category: 'Pop & Hit',
    frequency: '106.2 FM',
    streamUrl: 'http://29344.live.streamtheworld.com:3690/VIRGIN_RADIO_SC',
    backupUrl: 'https://live.radyofenomen.com/fenomen/128/icecast.audio',
    codec: 'MP3'
  },
  {
    id: 'pop-90',
    name: 'Pop 90 Türkiye',
    category: 'Pop & Hit',
    frequency: '90\'lar Hit',
    streamUrl: 'http://28573.live.streamtheworld.com:3690/POP90AAC_SC',
    backupUrl: 'http://37.247.98.8/stream/166/',
    codec: 'AAC+'
  },

  // 3. ARABESK & DAMAR (UZUN YOL)
  {
    id: 'baba-radyo',
    name: 'Baba Radyo',
    category: 'Arabesk & Damar',
    frequency: '105.6 FM',
    streamUrl: 'http://officialbabaradyo.radyotvonline.net/babaofficial',
    backupUrl: 'http://46.20.7.116/',
    codec: 'MP3'
  },
  {
    id: 'damar-turk',
    name: 'Damar Türk FM',
    category: 'Arabesk & Damar',
    frequency: 'Damar 7/24',
    streamUrl: 'https://live.radyositesihazir.com:10997/stream?type=http&nocache=99881',
    backupUrl: 'https://live.radyositesihazir.com:10997/',
    codec: 'MP3'
  },
  {
    id: 'arabesk-fm',
    name: 'Arabesk FM Türkiye',
    category: 'Arabesk & Damar',
    frequency: 'Arabesk',
    streamUrl: 'http://yayin.arabeskfm.biz:8042/',
    backupUrl: 'http://officialbabaradyo.radyotvonline.net/babaofficial',
    codec: 'AAC+'
  },
  {
    id: 'genc-kral',
    name: 'Genç Kral FM',
    category: 'Arabesk & Damar',
    frequency: 'Yol Arabesk',
    streamUrl: 'https://anadolu.liderhost.com.tr:10853/;',
    backupUrl: 'https://live.radyositesihazir.com:10997/',
    codec: 'MP3'
  },

  // 4. TÜRKÜ & HALK MÜZİĞİ
  {
    id: 'radyo-seymen',
    name: 'Radyo Seymen',
    category: 'Türkü & Halk',
    frequency: '107.0 FM',
    streamUrl: 'https://yayin.radyoseymen.com.tr:1070/stream',
    backupUrl: 'http://37.247.98.8/stream/22/;',
    codec: 'AAC+'
  },
  {
    id: 'turkulerle-turkiye',
    name: 'Türkülerle Türkiye FM',
    category: 'Türkü & Halk',
    frequency: 'Anadolu Türkü',
    streamUrl: 'http://37.247.98.8/stream/22/;',
    backupUrl: 'https://yayin.radyoseymen.com.tr:1070/stream',
    codec: 'MP3'
  },
  {
    id: 'ankara-havalari',
    name: 'Ankara Havaları FM',
    category: 'Türkü & Halk',
    frequency: 'Oyun Havası',
    streamUrl: 'http://37.247.98.8/stream/30/;',
    backupUrl: 'https://yayin.radyoseymen.com.tr:1070/stream',
    codec: 'MP3'
  },
  {
    id: 'radyo-siran',
    name: 'Karadeniz & Anadolu Türkü',
    category: 'Türkü & Halk',
    frequency: 'Yöresel',
    streamUrl: 'https://live.radyositesihazir.com/8078/stream',
    backupUrl: 'http://37.247.98.8/stream/22/;',
    codec: 'MP3'
  },

  // 5. SLOW & NOSTALJİ
  {
    id: 'slow-turk',
    name: 'Slow Türk',
    category: 'Slow & Nostalji',
    frequency: '95.3 FM',
    streamUrl: 'https://radyo.duhnet.tv/ak_dtvh_slowturk',
    backupUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURK_SC?/',
    codec: 'AAC'
  },
  {
    id: 'joy-turk',
    name: 'JoyTürk Akustik & Slow',
    category: 'Slow & Nostalji',
    frequency: '89.0 FM',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURK_SC?/',
    backupUrl: 'https://radyo.duhnet.tv/ak_dtvh_slowturk',
    codec: 'MP3'
  },
  {
    id: 'radyo-45lik',
    name: 'Radyo 45\'lik Nostalji',
    category: 'Slow & Nostalji',
    frequency: '70\'ler 80\'ler',
    streamUrl: 'https://stream.radyo45lik.com:4545/',
    backupUrl: 'http://37.247.98.8/stream/25/;',
    codec: 'AAC'
  },
  {
    id: 'altin-sarkilar',
    name: 'Altın Şarkılar (TSM & Nostalji)',
    category: 'Slow & Nostalji',
    frequency: 'Klasikler',
    streamUrl: 'http://37.247.98.8/stream/25/;',
    backupUrl: 'http://37.247.98.8/stream/166/',
    codec: 'MP3'
  },
  {
    id: 'doksanlar-fm',
    name: '90\'lar Türkçe Pop',
    category: 'Slow & Nostalji',
    frequency: '90\'lar',
    streamUrl: 'http://37.247.98.8/stream/166/',
    backupUrl: 'https://stream.radyo45lik.com:4545/',
    codec: 'MP3'
  }
];

const CATEGORIES: ('Tümü' | RadioStationItem['category'])[] = [
  'Tümü',
  'Ulusal & Haber',
  'Pop & Hit',
  'Arabesk & Damar',
  'Türkü & Halk',
  'Slow & Nostalji'
];

export const RoadRadioPlayer: React.FC = () => {
  const [minimized, setMinimized] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<'Tümü' | RadioStationItem['category']>('Tümü');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusNote, setStatusNote] = useState<string>('Yayına Hazır (24 Kanal)');
  const [triedBackup, setTriedBackup] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentStation = TURKISH_RADIO_STATIONS[currentIdx];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const startStream = (station: RadioStationItem, useBackup = false) => {
    const audio = audioRef.current;
    if (!audio) return;

    const targetUrl = useBackup && station.backupUrl ? station.backupUrl : station.streamUrl;
    audio.pause();
    audio.src = targetUrl;
    audio.load();
    setStatusNote(useBackup ? 'Yedek frekansa bağlanıyor...' : 'Canlı yayına bağlanıyor...');

    audio
      .play()
      .then(() => {
        setPlaying(true);
        setStatusNote(`Canlı Yayında • ${station.frequency || station.codec}`);
      })
      .catch(() => {
        if (!useBackup && station.backupUrl) {
          setTriedBackup(true);
          startStream(station, true);
        } else {
          setPlaying(false);
          setStatusNote('Bağlantı yenileniyor, tekrar deneyin');
        }
      });
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      setStatusNote('Duraklatıldı');
    } else {
      setTriedBackup(false);
      startStream(currentStation, false);
    }
  };

  const selectStationByIndex = (idx: number) => {
    setCurrentIdx(idx);
    setTriedBackup(false);
    startStream(TURKISH_RADIO_STATIONS[idx], false);
  };

  const handleNextStation = () => {
    const nextIdx = (currentIdx + 1) % TURKISH_RADIO_STATIONS.length;
    selectStationByIndex(nextIdx);
  };

  const handlePrevStation = () => {
    const prevIdx = (currentIdx - 1 + TURKISH_RADIO_STATIONS.length) % TURKISH_RADIO_STATIONS.length;
    selectStationByIndex(prevIdx);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !muted;
    setMuted(!muted);
  };

  const filteredStations = TURKISH_RADIO_STATIONS.map((st, originalIdx) => ({
    st,
    originalIdx
  })).filter(({ st }) => {
    const matchesCat = selectedCategory === 'Tümü' || st.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed bottom-16 md:bottom-4 right-2.5 md:right-4 z-30 select-none">
      <audio
        ref={audioRef}
        preload="none"
        onError={() => {
          if (playing && !triedBackup && currentStation.backupUrl) {
            setTriedBackup(true);
            startStream(currentStation, true);
          }
        }}
      />

      {minimized ? (
        <div className="nd-modal px-2.5 sm:px-3.5 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3 border shadow-xl max-w-[calc(100vw-1.25rem)]">
          <button
            onClick={togglePlay}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-white transition-transform active:scale-95 shadow-sm shrink-0"
            style={{ backgroundColor: playing ? 'var(--green)' : 'var(--accent)' }}
            title={playing ? 'Radyoyu Durdur' : 'Yol Radyosunu Başlat'}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>

          <div className="min-w-0 sm:min-w-[140px]">
            <div className="flex items-center gap-1.5">
              <Radio
                size={12}
                className={playing ? 'animate-pulse shrink-0' : 'shrink-0'}
                style={{ color: playing ? 'var(--green)' : 'var(--accent)' }}
              />
              <span className="text-[11px] sm:text-xs font-extrabold truncate max-w-[105px] sm:max-w-[130px]">
                {currentStation.name}
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] truncate hidden sm:block" style={{ color: 'var(--text-muted)' }}>
              {statusNote}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handlePrevStation}
              className="p-1.5 rounded-lg nd-layer hover:opacity-80"
              title="Önceki İstasyon"
            >
              <SkipBack size={12} />
            </button>
            <button
              onClick={handleNextStation}
              className="p-1.5 rounded-lg nd-layer hover:opacity-80"
              title="Sonraki İstasyon"
            >
              <SkipForward size={12} />
            </button>
            <button
              onClick={() => setMinimized(false)}
              className="p-1.5 rounded-lg nd-btn-primary"
              title="Tüm İstasyonları Aç (24 Kanal)"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div className="nd-modal w-[calc(100vw-1.25rem)] sm:w-[380px] p-3.5 sm:p-4 shadow-2xl">
          {/* Header */}
          <div
            className="flex items-center justify-between pb-3 mb-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: playing ? 'var(--green)' : 'var(--accent)' }}
              >
                <Radio size={16} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-extrabold">Yol Radyosu — Canlı Yayın</h4>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded nd-badge-blue">
                    {TURKISH_RADIO_STATIONS.length} Kanal
                  </span>
                </div>
                <p className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Signal size={10} style={{ color: playing ? 'var(--green)' : 'var(--text-muted)' }} />
                  <span>{statusNote}</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setMinimized(true)}
              className="p-1.5 rounded-lg nd-layer hover:opacity-80"
              title="Küçült"
            >
              <Minimize2 size={14} />
            </button>
          </div>

          {/* Active Station Deck */}
          <div className="nd-layer p-3 mb-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ color: 'var(--accent)' }}
                >
                  {currentStation.category} • {currentStation.frequency}
                </span>
                <p className="text-sm font-black truncate">{currentStation.name}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handlePrevStation}
                  className="p-2 rounded-lg nd-card hover:opacity-80"
                  title="Önceki Radyo"
                >
                  <SkipBack size={13} />
                </button>
                <button
                  onClick={togglePlay}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-sm"
                  style={{ backgroundColor: playing ? 'var(--green)' : 'var(--accent)' }}
                >
                  {playing ? <Pause size={14} /> : <Play size={14} />}
                  <span>{playing ? 'Durdur' : 'Canlı Çal'}</span>
                </button>
                <button
                  onClick={handleNextStation}
                  className="p-2 rounded-lg nd-card hover:opacity-80"
                  title="Sonraki Radyo"
                >
                  <SkipForward size={13} />
                </button>
              </div>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={toggleMute} className="opacity-80 hover:opacity-100">
                {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  setMuted(false);
                  setVolume(Number(e.target.value));
                }}
                className="flex-1 h-1.5 cursor-pointer"
              />
              <span className="text-[10px] font-bold tabular-nums w-8 text-right" style={{ color: 'var(--text-muted)' }}>
                %{Math.round((muted ? 0 : volume) * 100)}
              </span>
            </div>
          </div>

          {/* Search & Category Pills */}
          <div className="space-y-2 mb-2.5">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Radyo kanalı ara (TRT, Kral, Baba, Seymen, Slow...)"
                className="nd-input w-full pl-8 py-1.5 text-xs"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat ? 'nd-btn-primary' : 'nd-layer'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Station List */}
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {filteredStations.map(({ st, originalIdx }) => {
              const isSelected = originalIdx === currentIdx;
              return (
                <button
                  key={st.id}
                  onClick={() => selectStationByIndex(originalIdx)}
                  className="w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition-all border"
                  style={{
                    backgroundColor: isSelected ? 'var(--layer)' : 'transparent',
                    borderColor: isSelected ? 'var(--accent)' : 'transparent',
                    fontWeight: isSelected ? 700 : 500
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          isSelected && playing
                            ? 'var(--green)'
                            : isSelected
                            ? 'var(--accent)'
                            : 'var(--border)'
                      }}
                    />
                    <span className="truncate">{st.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                      {st.frequency}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded nd-layer">
                      {st.codec}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
