'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Ship, Sparkles } from 'lucide-react';

export default function BrandSplashScreen() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Simulate loading progress
    const duration = 1200; // 1.2 seconds loading
    const interval = 20; // update every 20ms
    const step = 100 / (duration / interval);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          // Trigger fade out
          setTimeout(() => setFadeOut(true), 100);
          // Remove from DOM after fade out transition (500ms)
          setTimeout(() => setVisible(false), 600);
          return 100;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#03045E] via-[#0077B6] to-[#0A57A4] transition-opacity duration-500 ease-in-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Animated Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-[#90E0EF]/10 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#00B4D8]/10 rounded-full blur-3xl animate-float-medium"></div>
      </div>

      <div className="flex flex-col items-center max-w-md w-full px-8 text-center relative z-10">
        {/* Logo container with glow */}
        <div className="mb-8 relative animate-pulse">
          <div className="absolute -inset-8 bg-[#90E0EF]/10 rounded-full blur-3xl"></div>
          <Image
            src="/logo-ptk.png"
            alt="Pertamina Trans Kontinental"
            width={350}
            height={90}
            className="drop-shadow-2xl relative z-10"
            priority
          />
          <Sparkles className="absolute -top-4 -right-4 w-6 h-6 text-[#90E0EF] animate-sparkle" />
        </div>

        {/* Text info */}
        <p className="text-sm font-medium tracking-widest text-[#90E0EF]/90 uppercase mb-2">
          GeoAttend Pro
        </p>
        <h2 className="text-xl font-semibold text-white tracking-wide mb-8">
          INTEGRATED MARITIME LOGISTICS PORTAL
        </h2>

        {/* Custom Progress Bar */}
        <div className="w-64 h-1.5 bg-white/20 rounded-full overflow-hidden relative mb-4">
          <div
            className="h-full bg-gradient-to-r from-[#00B4D8] to-[#90E0EF] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Dynamic status message */}
        <div className="h-6 flex items-center justify-center gap-2 text-xs text-white/60 font-mono">
          <Ship className="w-3.5 h-3.5 animate-bounce" />
          <span>
            {progress < 30
              ? 'Initializing secure handshake...'
              : progress < 70
              ? 'Synchronizing geofence profiles...'
              : progress < 100
              ? 'Establishing secure portal access...'
              : 'Welcome aboard!'}
          </span>
        </div>
      </div>

      {/* Decorative Wave at the Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-24 opacity-10 pointer-events-none">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <path d="M0 60L48 55C96 50 192 40 288 45C384 50 480 70 576 75C672 80 768 70 864 60C960 50 1056 40 1152 45C1248 50 1344 70 1392 80L1440 90V120H1392C1344 120 1248 120 1152 120C1056 120 960 120 864 120C768 120 672 120 576 120C480 120 384 120 288 120C192 120 96 120 48 120H0V60Z" fill="#90E0EF"/>
        </svg>
      </div>
    </div>
  );
}
