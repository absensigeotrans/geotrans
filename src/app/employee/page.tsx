'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOffices } from '@/hooks/useOffices';
import { supabase } from '@/lib/supabase';
import { calculateDistance, formatDistance } from '@/lib/utils';
import { getWIBDate, formatWIBDateHeader, getWIBStartOfDay } from '@/lib/timezone';
import { MapPin, Navigation, Camera, LogOut, CheckCircle, Clock, AlertTriangle, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import SelfieCaptureModal from '@/components/employee/SelfieCaptureModal';
import { toast } from '@/components/ui/Toast';

// Dynamically import map to avoid SSR issues
const EmployeeMap = dynamic(() => import('@/components/employee/EmployeeMap'), { ssr: false });

export default function EmployeeAttendancePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { offices, currentOffice, fetchOffices, loading: officesLoading } = useOffices();
  
  const [time, setTime] = useState<string>('--:--:--');
  const [dateStr, setDateStr] = useState<string>('');
  
  // GPS State
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [withinRange, setWithinRange] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  // Attendance State
  const [todayAttendance, setTodayAttendance] = useState<any | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Shift State (specifically for juru_parkir)
  const [todayShift, setTodayShift] = useState<string>('');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [selectingShift, setSelectingShift] = useState(false);

  // Selfie State
  const [showCamera, setShowCamera] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [workStatus, setWorkStatus] = useState<string>('WFO');

  // 1. Digital Clock WIB Timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setDateStr(formatWIBDateHeader());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Office & Today's Attendance
  const loadInitialData = useCallback(async () => {
    if (!user) return;
    setLoadingAttendance(true);
    
    try {
      await fetchOffices();

      // Fetch today's shift schedule
      const today = getWIBDate();
      const { data: schedule } = await supabase
        .from('user_shift_schedules')
        .select('shift_type')
        .eq('user_id', user.id)
        .eq('schedule_date', today)
        .maybeSingle();

      if (schedule?.shift_type) {
        setTodayShift(schedule.shift_type);
      } else if (profile?.shift_type && profile.shift_type !== 'non_shifting') {
        setTodayShift(profile.shift_type);
      }

      // Fetch today's attendance record
      const todayStart = getWIBStartOfDay();
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('check_in_time', todayStart)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attendanceError) throw attendanceError;
      setTodayAttendance(attendanceData);
    } catch (err) {
      console.error('Error loading employee page data:', err);
      toast.error('Gagal memuat data absensi');
    } finally {
      setLoadingAttendance(false);
    }
  }, [user, fetchOffices, profile]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 3. Geolocation Tracking
  const startGpsWatch = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Browser tidak mendukung penentuan lokasi GPS.');
      setGpsLoading(false);
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    // Watch position to update live distance
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGpsLocation({ lat: latitude, lng: longitude, accuracy });
        setGpsLoading(false);
        setGpsError(null);
      },
      (error) => {
        console.error('GPS error:', error);
        setGpsLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Izin lokasi ditolak. Harap aktifkan GPS Anda.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Sinyal GPS tidak tersedia.');
            break;
          case error.TIMEOUT:
            setGpsError('Waktu pencarian GPS habis.');
            break;
          default:
            setGpsError('Gagal mendapatkan lokasi GPS.');
        }
      },
      options
    );
  }, []);

  useEffect(() => {
    startGpsWatch();
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startGpsWatch]);

  // 4. Calculate Distance
  useEffect(() => {
    if (gpsLocation && currentOffice) {
      const dist = calculateDistance(
        gpsLocation.lat,
        gpsLocation.lng,
        currentOffice.latitude,
        currentOffice.longitude
      );
      setDistance(dist);
      
      const isWithin = dist <= currentOffice.geofence_radius;
      setWithinRange(isWithin);
    } else {
      setDistance(null);
      setWithinRange(false);
    }
  }, [gpsLocation, currentOffice]);

  // 5. Shift selection for Juru Parkir
  const handleSelectShift = async (selectedShift: string) => {
    if (!user) return;
    setSelectingShift(true);
    try {
      const today = getWIBDate();
      
      // Upsert user shift schedule
      const { error: upsertError } = await supabase
        .from('user_shift_schedules')
        .upsert({
          user_id: user.id,
          schedule_date: today,
          shift_type: selectedShift,
        }, { onConflict: 'user_id,schedule_date' });

      if (upsertError) throw upsertError;

      // Update profile permanent shift
      await supabase
        .from('profiles')
        .update({ shift_type: selectedShift as any })
        .eq('id', user.id);

      await refreshProfile();
      setTodayShift(selectedShift);
      setShowShiftModal(false);
      toast.success('Shift berhasil dipilih!');
      
      // Trigger camera capture right after shift selection
      setShowCamera(true);
    } catch (err) {
      console.error('Error selecting shift:', err);
      toast.error('Gagal memilih shift');
    } finally {
      setSelectingShift(false);
    }
  };

  // 6. Clock-in Action Trigger
  const triggerClockIn = () => {
    // Role check for driver_bebas: bypass geofence check
    const isDriverBebas = profile?.role === 'driver_bebas';
    
    if (!isDriverBebas && !withinRange) {
      toast.error('Anda berada di luar radius kantor!');
      return;
    }

    // If Juru Parkir has no shift today, prompt shift selection dialog first
    if (profile?.role === 'juru_parkir' && !todayShift) {
      setShowShiftModal(true);
    } else {
      setShowCamera(true);
    }
  };

  // 7. Selfie Captured Callback
  const handleSelfieCaptured = async (blob: Blob) => {
    if (!user || !currentOffice) return;
    setIsProcessing(true);

    try {
      // 1. Upload photo to Supabase storage
      const timestamp = Date.now();
      const fileName = `${user.id}_${timestamp}.jpg`;
      const storagePath = `selfies/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('selfie_absensi')
        .upload(storagePath, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('selfie_absensi')
        .getPublicUrl(storagePath);

      // 2. Perform clock-in insert
      const now = new Date();
      const locationData = {
        accuracy: gpsLocation?.accuracy || null,
        accuracy_threshold: currentOffice.geofence_radius,
        provider: 'browser_gps',
      };

      const { data: insertedRecord, error: insertError } = await supabase
        .from('attendance')
        .insert({
          user_id: user.id,
          check_in_time: now.toISOString(),
          check_in_latitude: gpsLocation?.lat || null,
          check_in_longitude: gpsLocation?.lng || null,
          check_in_accuracy: gpsLocation?.accuracy || null,
          check_in_location_data: locationData,
          is_mocked: false,
          distance_from_office: distance || 0,
          office_id: currentOffice.id,
          photo_url: publicUrl,
          work_status: workStatus,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setTodayAttendance(insertedRecord);
      
      // Trigger phone vibration if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }

      toast.success('Check-in berhasil!');
    } catch (err) {
      console.error('Error clocking in:', err);
      toast.error('Gagal melakukan check-in');
    } finally {
      setIsProcessing(false);
    }
  };

  // 8. Clock-out Action Trigger
  const handleClockOut = async () => {
    if (!user || !todayAttendance) return;
    setIsProcessing(true);

    try {
      const now = new Date();
      const { data: updatedRecord, error: updateError } = await supabase
        .from('attendance')
        .update({
          check_out_time: now.toISOString(),
          check_out_latitude: gpsLocation?.lat || null,
          check_out_longitude: gpsLocation?.lng || null,
          check_out_location_data: {
            accuracy: gpsLocation?.accuracy || null,
            provider: 'browser_gps',
          },
        })
        .eq('id', todayAttendance.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setTodayAttendance(updatedRecord);

      // Trigger phone vibration
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(200);
      }

      toast.success('Check-out berhasil!');
    } catch (err) {
      console.error('Error clocking out:', err);
      toast.error('Gagal melakukan check-out');
    } finally {
      setIsProcessing(false);
    }
  };

  const isDriverBebas = profile?.role === 'driver_bebas';
  const showAttendanceButton = todayAttendance === null;
  const showCheckoutButton = todayAttendance !== null && todayAttendance.check_out_time === null;
  const isAlreadyFinished = todayAttendance !== null && todayAttendance.check_out_time !== null;

  return (
    <div className="space-y-5">
      {/* Clock and Date */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 rounded-3xl p-5 text-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-xl -translate-y-6 translate-x-6" />
        <p className="text-gray-400 text-xs font-semibold tracking-wide uppercase">{dateStr || 'Hari ini'}</p>
        <h1 className="text-4xl font-extrabold font-mono text-white tracking-wider my-2.5">
          {time}
        </h1>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10.5px] font-semibold text-blue-400">WIB (GMT+7)</span>
        </div>
      </div>

      {/* Office & Proximity Warning */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-400">Lokasi Kantor Aktif</h3>
            <p className="text-base font-bold text-white">
              {officesLoading ? 'Memuat kantor...' : currentOffice?.name || 'Kantor Pusat'}
            </p>
            {currentOffice && (
              <p className="text-xs text-gray-500">{currentOffice.address}</p>
            )}
          </div>
          <div className="p-2.5 bg-gray-800 rounded-2xl border border-gray-700 text-blue-500">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        {/* GPS status and Geofence radius */}
        {gpsLoading ? (
          <div className="flex items-center justify-center py-2 gap-2 text-xs text-gray-400">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Mencari sinyal GPS...
          </div>
        ) : gpsError ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-3 flex gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{gpsError}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 pt-2">
            <div className="bg-gray-800/50 border border-gray-800 p-3 rounded-2xl">
              <span className="text-[10px] text-gray-500 block uppercase font-semibold">Jarak Anda</span>
              <span className="text-sm font-bold text-white">
                {isDriverBebas ? 'Bypass (Bebas)' : distance !== null ? formatDistance(distance) : '--'}
              </span>
            </div>
            <div className="bg-gray-800/50 border border-gray-800 p-3 rounded-2xl">
              <span className="text-[10px] text-gray-500 block uppercase font-semibold">Geofence Status</span>
              <span className={`text-sm font-bold flex items-center gap-1 ${
                isDriverBebas || withinRange ? 'text-green-400' : 'text-red-400'
              }`}>
                {isDriverBebas ? (
                  'Bebas Absen'
                ) : withinRange ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" /> Dalam Area
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> Di Luar Area
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Map (if GPS coordinate exists) */}
      {currentOffice && !gpsLoading && !gpsError && (
        <EmployeeMap
          officeLat={currentOffice.latitude}
          officeLng={currentOffice.longitude}
          userLat={gpsLocation?.lat}
          userLng={gpsLocation?.lng}
          radius={currentOffice.geofence_radius}
        />
      )}

      {/* Main Absen Actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 space-y-4">
        {loadingAttendance ? (
          <div className="h-14 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : showAttendanceButton ? (
          <div className="space-y-4">
            {/* Work status selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setWorkStatus('WFO')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  workStatus === 'WFO'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                    : 'bg-gray-800/40 border-gray-800 text-gray-500'
                }`}
              >
                Work From Office (WFO)
              </button>
              <button
                onClick={() => setWorkStatus('WFH')}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  workStatus === 'WFH'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                    : 'bg-gray-800/40 border-gray-800 text-gray-500'
                }`}
              >
                Work From Home (WFH)
              </button>
            </div>

            {/* Shift Badge Display */}
            {profile?.role === 'juru_parkir' && (
              <div className="bg-gray-800/40 p-3.5 rounded-2xl flex items-center justify-between border border-gray-800">
                <span className="text-xs text-gray-400 font-medium">Shift Hari Ini</span>
                <span className="text-xs font-bold text-white bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                  {todayShift ? todayShift.replace('_', ' ').toUpperCase() : 'BELUM PILIH'}
                </span>
              </div>
            )}

            <button
              onClick={triggerClockIn}
              disabled={isProcessing || (!isDriverBebas && !withinRange) || gpsLoading}
              className={`w-full py-4 rounded-2xl font-bold text-sm tracking-wide shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
                isProcessing || (!isDriverBebas && !withinRange) || gpsLoading
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed border border-gray-700/50 shadow-none'
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:brightness-110 active:brightness-95'
              }`}
            >
              <Camera className="w-4.5 h-4.5" />
              {isProcessing ? 'Memproses...' : 'Ambil Selfie & Clock In'}
            </button>
          </div>
        ) : showCheckoutButton ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex gap-3 text-xs text-green-400">
              <CheckCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Sudah Clock In</p>
                <p className="mt-0.5 text-green-500/80">
                  Pukul {new Date(todayAttendance.check_in_time).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })} WIB
                </p>
              </div>
            </div>

            <button
              onClick={handleClockOut}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide shadow-md active:scale-[0.98] bg-gradient-to-r from-red-600 to-red-500 text-white hover:brightness-110 active:brightness-95 transition-all flex items-center justify-center gap-2"
            >
              <Navigation className="w-4.5 h-4.5" />
              {isProcessing ? 'Memproses...' : 'Clock Out'}
            </button>
          </div>
        ) : isAlreadyFinished ? (
          <div className="bg-gray-800/40 border border-gray-800/50 rounded-2xl p-4 text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-white">Absensi Hari Ini Selesai</p>
            <p className="text-xs text-gray-500 mt-1">
              Anda telah melakukan check-in dan check-out untuk hari ini. Sampai jumpa besok!
            </p>
          </div>
        ) : null}
      </div>

      {/* Shift Selection Dialog Modal (Specifically for juru_parkir) */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-850 rounded-3xl w-full max-w-sm p-6 space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-white">Pilih Shift Hari Ini</h3>
              <p className="text-xs text-gray-400">
                Sebagai Juru Parkir, Anda harus memilih shift Anda terlebih dahulu untuk hari ini.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                { type: 'morning', label: 'Shift Pagi', time: '06:00 - 14:00', bg: 'from-blue-600 to-blue-500' },
                { type: 'afternoon', label: 'Shift Siang', time: '10:00 - 18:00', bg: 'from-blue-600 to-blue-500' },
                { type: 'full_time', label: 'Full Time', time: '07:00 - 16:00', bg: 'from-blue-600 to-blue-500' }
              ].map((shift) => (
                <button
                  key={shift.type}
                  onClick={() => handleSelectShift(shift.type)}
                  disabled={selectingShift}
                  className="w-full p-4 bg-gray-800 hover:bg-gray-750 active:scale-[0.98] border border-gray-700/50 rounded-2xl text-left flex items-center justify-between transition-all"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-white">{shift.label}</p>
                    <p className="text-xs text-gray-400">{shift.time}</p>
                  </div>
                  <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded bg-gradient-to-r ${shift.bg}`}>
                    Pilih
                  </span>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowShiftModal(false)}
              className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-400 font-semibold text-center border-t border-gray-800"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Camera Modal Popup */}
      <SelfieCaptureModal
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleSelfieCaptured}
      />
    </div>
  );
}
