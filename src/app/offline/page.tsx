'use client';

import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="bg-red-50 p-4 rounded-full text-red-500 mb-6">
        <WifiOff className="w-12 h-12" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Koneksi Internet Terputus</h1>
      <p className="text-gray-600 max-w-md mb-8">
        Aplikasi absensi memerlukan koneksi internet aktif untuk memverifikasi lokasi GPS Anda ke server. Harap periksa koneksi data atau Wi-Fi Anda dan coba lagi.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-2.5 bg-[#0A57A4] hover:bg-[#09488a] text-white font-medium rounded-xl shadow-md transition-all"
      >
        Coba Lagi
      </button>
    </div>
  );
}
