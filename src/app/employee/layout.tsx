'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ToastContainer } from '@/components/ui/Toast';
import { Clock, History, Calendar, User, ShieldAlert, ArrowLeftRight, Lock } from 'lucide-react';
import Link from 'next/link';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!user) return null;

  // Verify that the user is actually an employee, not an admin/viewer.
  // Wait, if an admin wants to test it, let them. So we just show a warning if role is not expected, or let them in.
  const isEmployee = profile && ['juru_parkir', 'driver', 'ob', 'driver_bebas', 'driver_kantor'].includes(profile.role);
  const isDriver = profile && (profile.role === 'driver_bebas' || profile.role === 'driver_kantor');

  const navItems = [
    { label: 'Absen', href: '/employee', icon: Clock },
    { label: 'Riwayat', href: '/employee/history', icon: History },
    { label: 'Cuti / Izin', href: '/employee/leave', icon: Calendar },
    ...(isDriver ? [{ label: 'Ganti Role', href: '/employee/role-request', icon: ArrowLeftRight }] : []),
    { label: 'Profil', href: '/employee/profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col max-w-md mx-auto shadow-2xl relative border-x border-gray-800">
      {/* Top Header */}
      <header className="bg-gray-900/80 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-red-500 flex items-center justify-center font-bold text-white shadow-md">
            G
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-wide bg-gradient-to-r from-blue-400 to-red-400 bg-clip-text text-transparent">
              GeoAttend Mobile
            </span>
          </div>
        </div>
        {profile && (
          <span className="text-xs font-semibold px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full border border-gray-700">
            {profile.role.replace('_', ' ').toUpperCase()}
          </span>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-24 overflow-y-auto px-4 py-4">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-gray-900/90 backdrop-blur-lg border-t border-gray-800 py-2.5 px-4 flex justify-around items-center z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 transition-all ${
                isActive ? 'text-blue-500 scale-105' : 'text-gray-500 hover:text-gray-400'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-blue-500/10' : ''}`}>
                <Icon className="w-5.5 h-5.5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <ToastContainer />
    </div>
  );
}
