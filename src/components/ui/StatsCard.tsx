'use client';

interface StatsCardProps {
  icon: React.ReactNode;
  value: number | string | React.ReactNode;
  label: string;
  trend?: string | React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange';
}

const colorMap = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', accent: 'border-blue-500' },
  green: { bg: 'bg-green-100', text: 'text-green-600', accent: 'border-green-500' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', accent: 'border-yellow-500' },
  red: { bg: 'bg-red-100', text: 'text-red-600', accent: 'border-red-500' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', accent: 'border-purple-500' },
  gray: { bg: 'bg-slate-100', text: 'text-slate-600', accent: 'border-slate-500' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', accent: 'border-orange-500' },
};

export function StatsCard({ icon, value, label, trend, color = 'blue' }: StatsCardProps) {
  const { bg, text } = colorMap[color];

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 p-5 flex items-center gap-4 hover:shadow-lg transition-shadow duration-200 relative overflow-hidden group">
      {/* Gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-red-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className={`p-3 rounded-xl ${bg} relative z-10`}>
        <span className={`block ${text}`}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0 relative z-10">
        <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {trend && (
          <p className="text-xs text-gray-400 mt-0.5">{trend}</p>
        )}
      </div>
    </div>
  );
}