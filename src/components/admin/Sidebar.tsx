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
  Users,
  Building2,
  FileText,
  CalendarDays,
  CalendarX,
  Radio,
  Activity,
  BarChart3,
  Settings,
  Menu,
  ChevronLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
  LogOut,
  Image,
  UserCog,
  Lock,
} from 'lucide-react';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/admin/employees', icon: Users, label: 'Kelola Karyawan' },
  { href: '/admin/admins', icon: UserCog, label: 'Kelola Admin' },
  { href: '/admin/offices', icon: Building2, label: 'Kelola Kantor' },
  { href: '/admin/reports', icon: FileText, label: 'Laporan Harian' },
  { href: '/admin/monthly-recap', icon: CalendarDays, label: 'Rekap Bulanan' },
  { href: '/admin/attendance-rate', icon: BarChart3, label: 'Tingkat Kehadiran' },
  { href: '/admin/leave-requests', icon: CalendarX, label: 'Pengajuan Cuti', badgeKey: 'pendingLeaves' },
  { href: '/admin/driver-requests', icon: UserCog, label: 'Pengajuan Driver', badgeKey: 'pendingDriverRequests' },
  { href: '/admin/password-requests', icon: Lock, label: 'Pengajuan Password', badgeKey: 'pendingPasswordRequests' },
  { href: '/admin/monitoring', icon: Radio, label: 'Pemantauan Langsung' },
  { href: '/admin/anomalies', icon: ShieldAlert, label: 'Deteksi Anomali', badgeKey: 'anomalies' },
  { href: '/admin/photos', icon: Image, label: 'Foto Selfie' },
  { href: '/admin/activity-logs', icon: Activity, label: 'Log Aktivitas' },
  { href: '/admin/settings', icon: Settings, label: 'Pengaturan Sistem' },
];

interface SidebarStats {
  present: number;
  late: number;
  outside: number;
  suspicious: number;
  pendingLeaves: number;
  pendingDriverRequests: number;
  pendingPasswordRequests: number;
  anomalies: number;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [stats, setStats] = useState<SidebarStats>({ present: 0, late: 0, outside: 0, suspicious: 0, pendingLeaves: 0, pendingDriverRequests: 0, pendingPasswordRequests: 0, anomalies: 0 });
  const [loading, setLoading] = useState(true);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's quick stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = startOfDay(new Date()).toISOString();

        // Fetch today's attendance counts
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('status, is_mocked')
          .gte('check_in_time', today);

        // Fetch pending leave requests count
        const { count: pendingLeaves } = await supabase
          .from('leave_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Fetch pending driver role requests count
        const { count: pendingDriverRequests } = await supabase
          .from('driver_role_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Fetch pending password requests count
        const { count: pendingPasswordRequests } = await supabase
          .from('password_change_requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        // Fetch anomaly count
        const { count: anomalyCount } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .or('is_mocked.eq.true,anomaly_flags.neq.{}');

        if (attendanceData) {
          const present = attendanceData.filter((r) => r.status === 'present').length;
          const late = attendanceData.filter((r) => r.status === 'late').length;
          const outside = attendanceData.filter((r) => r.status === 'outside_radius').length;
          const suspicious = attendanceData.filter((r) => r.is_mocked).length;

          setStats({
            present,
            late,
            outside,
            suspicious,
            pendingLeaves: pendingLeaves || 0,
            pendingDriverRequests: pendingDriverRequests || 0,
            pendingPasswordRequests: pendingPasswordRequests || 0,
            anomalies: anomalyCount || 0,
          });
        } else {
          setStats((prev) => ({ 
            ...prev, 
            pendingLeaves: pendingLeaves || 0, 
            pendingDriverRequests: pendingDriverRequests || 0,
            pendingPasswordRequests: pendingPasswordRequests || 0,
            anomalies: anomalyCount || 0 
          }));
        }
      } catch (err) {
        console.error('Error fetching sidebar stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const isBadgeActive = (badgeKey?: string) => {
    if (!badgeKey) return false;
    return (stats as any)[badgeKey] > 0;
  };

  const getBadgeCount = (badgeKey?: string) => {
    if (!badgeKey) return 0;
    return (stats as any)[badgeKey] || 0;
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-gradient-red-blue border-r
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto lg:border-r lg:h-screen
          flex flex-col shadow-xl
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo with Clock */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-md p-1.5 shrink-0">
              <img src="/logo-ptk.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white/95">Admin Panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white lg:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Current Date/Time */}
        <div className="px-5 py-3 border-b border-white/20 bg-white/10 backdrop-blur-sm">
          <div className="text-xs text-white/70">
            {currentTime.toLocaleDateString('id-ID', { weekday: 'long' })}
          </div>
          <div className="text-sm font-medium text-white">
            {currentTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <div className="text-2xl font-bold text-white">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':')}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            const hasBadge = isBadgeActive(item.badgeKey);
            const badgeCount = getBadgeCount(item.badgeKey);

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
                {/* Badge */}
                {hasBadge && (
                  <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-white text-red-600 text-xs font-bold rounded-full shadow-md">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Stats Footer */}
        <div className="px-4 py-3 border-t border-white/20 bg-white/10 backdrop-blur-sm">
          <div className="text-xs font-medium text-white/70 mb-2">Ringkasan Hari Ini</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg py-1.5 px-1">
              <CheckCircle className="w-4 h-4 text-white mx-auto mb-0.5" />
              <div className="text-sm font-bold text-white">{loading ? '-' : stats.present}</div>
              <div className="text-[10px] text-white/80">Hadir</div>
            </div>
            <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg py-1.5 px-1">
              <Clock className="w-4 h-4 text-white mx-auto mb-0.5" />
              <div className="text-sm font-bold text-white">{loading ? '-' : stats.late}</div>
              <div className="text-[10px] text-white/80">Terlambat</div>
            </div>
            {stats.suspicious > 0 && (
              <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg py-1.5 px-1">
                <AlertTriangle className="w-4 h-4 text-white mx-auto mb-0.5" />
                <div className="text-sm font-bold text-white">{loading ? '-' : stats.suspicious}</div>
                <div className="text-[10px] text-white/80">Mencurigakan</div>
              </div>
            )}
            {stats.suspicious === 0 && (
              <div className="text-center bg-white/20 backdrop-blur-sm rounded-lg py-1.5 px-1">
                <Users className="w-4 h-4 text-white mx-auto mb-0.5" />
                <div className="text-sm font-bold text-white">{loading ? '-' : (stats.present + stats.late)}</div>
                <div className="text-[10px] text-white/80">Total</div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom user info + logout */}
        <div className="p-4 border-t border-white/20 bg-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-sm font-bold text-blue-600 shadow-md">
              A
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">Admin</p>
              <p className="text-xs text-white/70 truncate">Administrator</p>
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
            Keluar
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