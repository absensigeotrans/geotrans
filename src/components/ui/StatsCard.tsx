'use client';

interface StatsCardProps {
  icon: React.ReactNode;
  value: number | string | React.ReactNode;
  label: string;
  trend?: string | React.ReactNode;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange';
}

const colorStyles: Record<string, { iconBg: string; iconColor: string; badgeBorder: string }> = {
  blue: {
    iconBg: 'bg-blue-50/80 text-blue-700 border-blue-100',
    iconColor: 'text-blue-700',
    badgeBorder: 'border-blue-200',
  },
  green: {
    iconBg: 'bg-emerald-50/80 text-emerald-700 border-emerald-100',
    iconColor: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
  },
  yellow: {
    iconBg: 'bg-amber-50/80 text-amber-700 border-amber-100',
    iconColor: 'text-amber-700',
    badgeBorder: 'border-amber-200',
  },
  red: {
    iconBg: 'bg-rose-50/80 text-rose-700 border-rose-100',
    iconColor: 'text-rose-700',
    badgeBorder: 'border-rose-200',
  },
  purple: {
    iconBg: 'bg-indigo-50/80 text-indigo-700 border-indigo-100',
    iconColor: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
  },
  gray: {
    iconBg: 'bg-slate-50 text-slate-700 border-slate-200',
    iconColor: 'text-slate-700',
    badgeBorder: 'border-slate-200',
  },
  orange: {
    iconBg: 'bg-orange-50/80 text-orange-700 border-orange-100',
    iconColor: 'text-orange-700',
    badgeBorder: 'border-orange-200',
  },
};

export function StatsCard({
  icon,
  value,
  label,
  trend,
  subtitle,
  color = 'blue',
}: StatsCardProps) {
  const currentStyle = colorStyles[color] || colorStyles.blue;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
            {label}
          </p>
        </div>
        <div className={`p-2.5 rounded-lg border ${currentStyle.iconBg} shrink-0 flex items-center justify-center`}>
          <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
        </div>
      </div>

      <div className="mt-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {value}
          </span>
          {trend && (
            <div className="inline-flex items-center">
              {trend}
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</p>
        )}
      </div>
    </div>
  );
}