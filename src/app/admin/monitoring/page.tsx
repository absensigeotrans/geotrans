'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDistance } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/ui/StatsCard';
import { format } from 'date-fns';
import { getWIBStartOfDay, formatWIBTime, formatWIBTimeWithSeconds, formatWIBDateShort } from '@/lib/timezone';
import { Radio, Clock, MapPin, Users, Activity, LogIn, LogOut, Wifi, WifiOff, Filter } from 'lucide-react';

interface LiveAttendance {
  id: string;
  user_id: string;
  check_in_time: string;
  check_out_time?: string;
  status: string;
  distance_from_office: number;
  check_in_latitude: number;
  check_in_longitude: number;
  user_name?: string;
  employee_id?: string;
  is_mocked?: boolean;
}

type StatusFilter = 'all' | 'present' | 'late' | 'outside_radius';
type EventType = 'check_in' | 'check_out' | 'all';

export default function MonitoringPage() {
  const [liveRecords, setLiveRecords] = useState<LiveAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalToday, setTotalToday] = useState(0);
  const [totalPresent, setTotalPresent] = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [eventFilter, setEventFilter] = useState<EventType>('all');

  // Filter records based on selected filters
  const filteredRecords = useMemo(() => {
    let records = liveRecords;

    // Status filter
    if (statusFilter !== 'all') {
      records = records.filter((r) => r.status === statusFilter);
    }

    // Event type filter
    if (eventFilter === 'check_in') {
      records = records.filter((r) => r.check_in_time);
    } else if (eventFilter === 'check_out') {
      records = records.filter((r) => r.check_out_time);
    }

    return records;
  }, [liveRecords, statusFilter, eventFilter]);

  // Fetch initial today's data
  useEffect(() => {
    const todayStart = getWIBStartOfDay();

    const fetchToday = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('attendance')
          .select('*, profiles:user_id(full_name, employee_id, nik)')
          .gte('check_in_time', todayStart)
          .order('check_in_time', { ascending: false })
          .limit(200);

        if (fetchError) {
          console.error('Monitoring fetchToday error details:', {
            code: fetchError.code,
            message: fetchError.message,
            details: fetchError.details,
            hint: fetchError.hint
          });
          setError(`Failed to load today's records: ${fetchError.message}`);
          return;
        }

        if (data) {
          const mapped: LiveAttendance[] = data.map((r: any) => ({
            id: r.id,
            user_id: r.user_id,
            check_in_time: r.check_in_time,
            check_out_time: r.check_out_time || undefined,
            status: r.status || 'present',
            distance_from_office: r.distance_from_office || 0,
            check_in_latitude: r.check_in_latitude || 0,
            check_in_longitude: r.check_in_longitude || 0,
            user_name: r.profiles?.full_name || 'Unknown',
            employee_id: r.profiles?.employee_id,
            is_mocked: r.is_mocked || false,
          }));
          setLiveRecords(mapped);
          setTotalToday(mapped.length);
          setTotalPresent(mapped.filter((r) => r.status === 'present').length);
        }
      } catch (err) {
        console.error('Monitoring fetchToday catch:', err);
        setError('An unexpected error occurred while loading today\'s data');
      } finally {
        setLoading(false);
      }
    };

    fetchToday();
  }, []);

  // Subscribe to real-time attendance inserts
  useEffect(() => {
    setIsConnected(false); // Set to false while connecting

    const channel = supabase
      .channel('attendance_realtime_monitoring')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance' },
        async (payload) => {
          const newRecord = payload.new as any;

          // Fetch user name
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, employee_id')
            .eq('id', newRecord.user_id)
            .single();

          const live: LiveAttendance = {
            id: newRecord.id,
            user_id: newRecord.user_id,
            check_in_time: newRecord.check_in_time,
            check_out_time: newRecord.check_out_time || undefined,
            status: newRecord.status,
            distance_from_office: newRecord.distance_from_office,
            check_in_latitude: newRecord.check_in_latitude,
            check_in_longitude: newRecord.check_in_longitude,
            user_name: profile?.full_name || 'Unknown',
            employee_id: profile?.employee_id,
            is_mocked: newRecord.is_mocked || false,
          };

          setLiveRecords((prev) => [live, ...prev]);
          setTotalToday((prev) => prev + 1);
          if (live.status === 'present') {
            setTotalPresent((prev) => prev + 1);
          }
        }
      )
      .on('system', { event: '*' }, (payload) => {
        if (payload.type === 'system' && payload.event === 'connected') {
          setIsConnected(true);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, []);

  // Update recent count every 10 seconds
  useEffect(() => {
    const updateRecentCount = () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const count = liveRecords.filter((r) => r.check_in_time >= fiveMinAgo).length;
      setRecentCount(count);
    };

    updateRecentCount();
    const interval = setInterval(updateRecentCount, 10000);

    return () => clearInterval(interval);
  }, [liveRecords]);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={<Activity className="w-5 h-5" />} value={totalToday} label="Clock-ins Today" color="blue" />
        <StatsCard icon={<Clock className="w-5 h-5" />} value={recentCount} label="Last 5 Minutes" color="purple" />
        <StatsCard icon={<Users className="w-5 h-5" />} value={totalPresent} label="Present" color="green" />
        <StatsCard
          icon={isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          value={isConnected ? 'CONNECTED' : isConnected === false ? 'DISCONNECTED' : 'CONNECTING...'}
          label="Real-time Status"
          color={isConnected ? 'green' : isConnected === false ? 'red' : 'yellow'}
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <WifiOff className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Filters:</span>
          </div>
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all" className="text-gray-900 bg-white">All Status</option>
            <option value="present" className="text-gray-900 bg-white">Present</option>
            <option value="late" className="text-gray-900 bg-white">Late</option>
            <option value="outside_radius" className="text-gray-900 bg-white">Outside Radius</option>
          </select>
          {/* Event Type Filter */}
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value as EventType)}
            className="px-3 py-2 border rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all" className="text-gray-900 bg-white">All Events</option>
            <option value="check_in" className="text-gray-900 bg-white">Check-in Only</option>
            <option value="check_out" className="text-gray-900 bg-white">Check-out Only</option>
          </select>
          <div className="ml-auto text-sm text-gray-500">
            Showing {filteredRecords.length} of {liveRecords.length} records
          </div>
        </div>
      </div>

      {/* Live Feed */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className={`relative flex h-3 w-3 ${isConnected ? '' : 'opacity-30'}`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
            </span>
            Live Clock-in Feed
          </h3>
          <span className="text-sm text-gray-500">{filteredRecords.length} records</span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Radio className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="font-medium">Waiting for clock-ins...</p>
            <p className="text-sm mt-1">Real-time feed will appear here when employees clock in</p>
          </div>
        ) : (
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {filteredRecords.map((record, idx) => (
              <div
                key={record.id}
                className={`px-5 py-3 hover:bg-gray-50 transition-colors ${idx === 0 ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar with event type indicator */}
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                        record.status === 'present' ? 'bg-green-100 text-green-700' :
                          record.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                      }`}>
                        {record.user_name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      {/* Event type badge */}
                      {record.check_in_time && !record.check_out_time && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                          <LogIn className="w-3 h-3 text-white" />
                        </div>
                      )}
                      {record.check_out_time && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                          <LogOut className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{record.user_name}</p>
                        {record.employee_id && (
                          <span className="text-xs text-gray-400">({record.employee_id})</span>
                        )}
                        <Badge variant={
                          record.status === 'present' ? 'success' :
                          record.status === 'late' ? 'warning' : 'danger'
                        }>
                          {record.status.replace('_', ' ')}
                        </Badge>
                        {record.is_mocked && (
                          <Badge variant="danger">Suspicious</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-0.5">
                        {/* Check-in time */}
                        <span className="flex items-center gap-1">
                          <LogIn className="w-3 h-3 text-blue-500" />
                          {formatWIBTimeWithSeconds(record.check_in_time)}
                        </span>
                        {/* Check-out time */}
                        {record.check_out_time ? (
                          <span className="flex items-center gap-1">
                            <LogOut className="w-3 h-3 text-purple-500" />
                            {formatWIBTimeWithSeconds(record.check_out_time)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-400">
                            <LogOut className="w-3 h-3" />
                            --
                          </span>
                        )}
                        {/* Distance */}
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {formatDistance(record.distance_from_office)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2">
                    {idx === 0 && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full shrink-0">
                        Just now
                      </span>
                    )}
                    {/* Time since check-in */}
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatWIBDateShort(record.check_in_time)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}