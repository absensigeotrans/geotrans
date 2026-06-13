export type UserRole = 'admin' | 'viewer' | 'driver_bebas' | 'driver_kantor' | 'juru_parkir' | 'ob' | 'inactive';

export type ShiftType = 'morning' | 'afternoon' | 'full_time' | 'non_shifting';

export type AttendanceStatus = 'present' | 'late' | 'outside_radius';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  shift_type?: ShiftType | null;
  today_shift_type?: ShiftType | null;
  employee_id?: string;
  nik?: string;
  registered_password?: string;
  created_at: string;
  updated_at: string;
}

export interface Office {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  shift_id?: string;
  office_id?: string;
  check_in_time: string;
  check_in_latitude: number;
  check_in_longitude: number;
  check_in_location_data?: Record<string, unknown>;
  check_out_time?: string | null;
  check_out_latitude?: number | null;
  check_out_longitude?: number | null;
  check_out_location_data?: Record<string, unknown>;
  is_valid: boolean;
  is_mocked: boolean;
  distance_from_office: number;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
  // Relations (from Supabase join)
  profiles?: Profile;
  offices?: Office;
  // Computed fields
  shift_type?: ShiftType | null;
  overtime_minutes?: number | null;
  work_duration_minutes?: number | null;
}

export interface AttendanceLog {
  id: string;
  attendance_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AttendanceWithUser extends Attendance {
  user: {
    full_name: string;
    email: string;
  };
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
}
