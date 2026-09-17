'use client';

import { useRef, useCallback } from 'react';
import { Download, AlertCircle } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onExport?: () => void;
}

export function ChartCard({
  title,
  subtitle,
  children,
  loading,
  error,
  onExport,
}: ChartCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(async () => {
    if (onExport) {
      onExport();
      return;
    }

    const svg = cardRef.current?.querySelector('svg.recharts-surface');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const rect = svg.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.scale(2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const link = document.createElement('a');
      link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = url;
  }, [title, onExport]);

  return (
    <div
      className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between"
      ref={cardRef}
    >
      <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <button
          onClick={handleExport}
          disabled={loading || !!error}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Export grafik ke format PNG"
          aria-label="Export grafik PNG"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center h-52 text-slate-400 gap-2">
          <div className="w-7 h-7 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin" />
          <span className="text-xs text-slate-400">Memuat visualisasi data...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center gap-2 h-52 text-rose-600 bg-rose-50/60 rounded-lg p-4 border border-rose-100">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-medium">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="w-full" style={{ minHeight: 220 }}>
          {children}
        </div>
      )}
    </div>
  );
}
