import React, { useState, useEffect, useRef } from 'react';
import { Search, Users, Fuel, Truck, UserCheck, X, ArrowRight } from 'lucide-react';
import { GlobalSearchResult, NavTabId } from '../../shared/types';
import { api } from '../api';

interface CommandDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (tab: NavTabId, entityId: string, category: GlobalSearchResult['category']) => void;
}

export const CommandDialog: React.FC<CommandDialogProps> = ({
  isOpen,
  onClose,
  onSelectResult
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => {
    let active = true;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    api.globalSearch(query).then((res) => {
      if (active) {
        setResults(res || []);
        setSelectedIndex(0);
      }
    });
    return () => {
      active = false;
    };
  }, [query]);

  if (!isOpen) return null;

  const getIcon = (cat: GlobalSearchResult['category']) => {
    switch (cat) {
      case 'customer':
        return <Users size={15} style={{ color: 'var(--accent)' }} />;
      case 'vehicle':
        return <Fuel size={15} style={{ color: 'var(--amber)' }} />;
      case 'trip':
        return <Truck size={15} style={{ color: 'var(--green)' }} />;
      case 'driver':
        return <UserCheck size={15} style={{ color: 'var(--purple)' }} />;
    }
  };

  const getCategoryLabel = (cat: GlobalSearchResult['category']) => {
    switch (cat) {
      case 'customer':
        return 'Müşteri / İstasyon';
      case 'vehicle':
        return 'Araç / Tanker';
      case 'trip':
        return 'Sefer Kaydı';
      case 'driver':
        return 'Şoför';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % results.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      }
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      const item = results[selectedIndex];
      onSelectResult(item.targetTab, item.id, item.category);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4"
      style={{ backgroundColor: 'rgba(10, 18, 28, 0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="nd-modal w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Header */}
        <div className="p-3.5 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <Search size={18} style={{ color: 'var(--accent)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Müşteri adı, telefon, araç plakası (22 AB...), sefer kodu veya şoför ara..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text)' }}
          />
          <button onClick={onClose} className="p-1 rounded-lg nd-layer hover:opacity-80">
            <X size={15} />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-2">
          {!query.trim() ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              Eşzamanlı arama yapmak için plaka, müşteri unvanı, telefon veya sefer numarası yazın.
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              "{query}" ile eşleşen müşteri, plaka, sefer veya şoför bulunamadı.
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item.category}-${item.id}`}
                    onClick={() => {
                      onSelectResult(item.targetTab, item.id, item.category);
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className="w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all"
                    style={{
                      backgroundColor: isSelected ? 'var(--layer)' : 'transparent',
                      border: isSelected ? '1px solid var(--accent)' : '1px solid transparent'
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg nd-layer flex items-center justify-center shrink-0">
                        {getIcon(item.category)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold truncate">{item.title}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}
                          >
                            {getCategoryLabel(item.category)}
                          </span>
                        </div>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.badge && (
                        <span className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-lg nd-badge-blue">
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div
          className="px-4 py-2 border-t flex items-center justify-between text-[11px]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          <span>↑↓ Gezin • Enter Profili Aç • Esc Kapat</span>
          <span>Global Arama Motoru v4.5</span>
        </div>
      </div>
    </div>
  );
};
