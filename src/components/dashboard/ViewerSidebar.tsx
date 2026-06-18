'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { format, startOfDay } from 'date-fns';
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Radio,
  CheckCircle,
  Clock,
  AlertTriangle,
  LogOut,
  Menu,
  ChevronLeft,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/dashboard/reports', icon: FileText, label: 'Reports' },
  { href: '/dashboard/attendance-rate', icon: BarChart3, label: 'Attendance Rate' },
  { href: '/dashboard/monitoring', icon: Radio, label: 'Live Monitoring' },
];

interface SidebarStats {
  present: number;
  late: number;
  outside: number;
  suspicious: number;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function ViewerSidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState<SidebarStats>({ present: 0, late: 0, outside: 0, suspicious: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = startOfDay(new Date()).toISOString();

        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('status, is_mocked')
          .gte('check_in_time', today);

        if (attendanceData) {
          const present = attendanceData.filter((r) => r.status === 'present').length;
          const late = attendanceData.filter((r) => r.status === 'late').length;
          const outside = attendanceData.filter((r) => r.status === 'outside_radius').length;
          const suspicious = attendanceData.filter((r) => r.is_mocked).length;

          setStats({ present, late, outside, suspicious });
        }
      } catch (err) {
        console.error('Error fetching sidebar stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-gradient-red-blue border-r
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto lg:border-r lg:h-screen
          flex flex-col shadow-xl
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5 shrink-0">
              <img src="/logo-ptk.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/95">Viewer Panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white lg:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/20 bg-white/10 backdrop-blur-sm">
          <div className="text-xs text-white/70">
            {format(currentTime, 'EEEE')}
          </div>
          <div className="text-sm font-medium text-white">
            {format(currentTime, 'dd MMMM yyyy')}
          </div>
          <div className="text-2xl font-bold text-white">
            {format(currentTime, 'HH:mm')}
          </div>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200 group relative
                  ${active
                    ? 'bg-white/25 text-white shadow-md backdrop-blur-sm'
                    : 'text-white/80 hover:bg-white/15 hover:text-white'}
                `}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-white/20 bg-white/10 backdrop-blur-sm">
          <div className="text-xs font-medium text-white/70 mb-2">Today&apos;s Summary</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg py-1.5 px-1">
              <CheckCircle className="w-4 h-4 text-white mx-auto mb-0.5" />
              <div className="text-sm font-bold text-white">{loading ? '-' : stats.present}</div>
              <div className="text-[10px] text-white/80">Present</div>
            </div>
            <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg py-1.5 px-1">
              <Clock className="w-4 h-4 text-white mx-auto mb-0.5" />
              <div className="text-sm font-bold text-white">{loading ? '-' : stats.late}</div>
              <div className="text-[10px] text-white/80">Late</div>
            </div>
            {stats.suspicious > 0 ? (
              <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg py-1.5 px-1">
                <AlertTriangle className="w-4 h-4 text-white mx-auto mb-0.5" />
                <div className="text-sm font-bold text-white">{loading ? '-' : stats.suspicious}</div>
                <div className="text-[10px] text-white/80">Suspicious</div>
              </div>
            ) : (
              <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg py-1.5 px-1">
                <CheckCircle className="w-4 h-4 text-white mx-auto mb-0.5" />
                <div className="text-sm font-bold text-white">{loading ? '-' : (stats.present + stats.late)}</div>
                <div className="text-[10px] text-white/80">Total</div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/20 bg-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold text-blue-600 shadow-md">
              {profile?.full_name?.charAt(0).toUpperCase() || 'V'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.full_name || 'Viewer'}</p>
              <p className="text-xs text-white/70 truncate">{profile?.role || 'viewer'}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-white/20 hover:bg-white/30 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-2 text-gray-600 hover:text-white rounded-lg bg-gradient-red-blue hover:opacity-90 transition-all lg:hidden shadow-md"
    >
      <Menu className="w-6 h-6" />
    </button>
  );
}
