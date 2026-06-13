'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, AlertCircle } from 'lucide-react';

interface SelfieCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageBlob: Blob) => void;
}

export default function SelfieCaptureModal({ isOpen, onClose, onCapture }: SelfieCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setLoading(true);
    setError(null);
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user', // Request front-facing camera
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setLoading(false);
        };
      }
      setCameraPermission(true);
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraPermission(false);
      setLoading(false);
      setError(
        err.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Harap izinkan akses kamera di pengaturan browser Anda.'
          : 'Gagal mengakses kamera depan. Pastikan kamera tidak digunakan oleh aplikasi lain.'
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    
    // Use the video dimensions
    const width = video.videoWidth || 480;
    const height = video.videoHeight || 640;
    
    // We want a portrait 3:4 ratio for selfies
    const targetWidth = 360;
    const targetHeight = 480;
    
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally for a mirror effect matching the camera preview
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);

    // Calculate source rect to crop center square/rectangle
    const videoRatio = width / height;
    const targetRatio = targetWidth / targetHeight;
    
    let sx = 0, sy = 0, sWidth = width, sHeight = height;
    
    if (videoRatio > targetRatio) {
      sWidth = height * targetRatio;
      sx = (width - sWidth) / 2;
    } else {
      sHeight = width / targetRatio;
      sy = (height - sHeight) / 2;
    }

    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Compress to Jpeg with quality = 0.6 to guarantee size < 50KB
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log(`Captured selfie: ${Math.round(blob.size / 1024)} KB`);
          onCapture(blob);
          stopCamera();
          onClose();
        }
      },
      'image/jpeg',
      0.6
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-between p-4 safe-bottom">
      {/* Header */}
      <div className="w-full flex items-center justify-between max-w-md">
        <h3 className="text-lg font-bold text-white tracking-wide">Ambil Foto Selfie</h3>
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="p-2 bg-gray-900 rounded-full text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Camera Viewport Container */}
      <div className="relative w-full max-w-xs aspect-[3/4] rounded-full overflow-hidden border-4 border-blue-500 bg-gray-900 flex items-center justify-center my-auto shadow-2xl">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="text-sm text-gray-400">Menyiapkan kamera...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center gap-3 bg-gray-950">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-sm text-red-400 leading-relaxed">{error}</p>
            <button
              onClick={startCamera}
              className="mt-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
            </button>
          </div>
        )}

        {/* Video stream */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover scale-x-[-1] ${loading || error ? 'hidden' : 'block'}`}
        />
        
        {/* Mirror indicator Overlay */}
        {!loading && !error && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/55 backdrop-blur-md px-3 py-1 rounded-full text-[10px] text-gray-300 font-medium">
            Kamera Depan
          </div>
        )}
      </div>

      {/* Instruction & Trigger */}
      <div className="w-full max-w-md flex flex-col items-center gap-4 mb-6">
        <p className="text-xs text-gray-400 text-center max-w-xs leading-relaxed">
          Posisikan wajah Anda tepat di dalam lingkaran kamera dan pastikan cahaya cukup.
        </p>

        <button
          onClick={capturePhoto}
          disabled={loading || !!error}
          className="w-18 h-18 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-40 disabled:scale-100 transition-all border-4 border-gray-800 hover:border-gray-700"
        >
          <div className="w-12 h-12 rounded-full bg-[#0A57A4] flex items-center justify-center text-white">
            <Camera className="w-6 h-6" />
          </div>
        </button>
      </div>
    </div>
  );
}
