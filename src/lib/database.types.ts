import { UserRole } from '@/types';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          shift_type: 'morning' | 'afternoon' | null;
          employee_id?: string;
          nik?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: UserRole;
          shift_type?: 'morning' | 'afternoon' | null;
          employee_id?: string;
          nik?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: UserRole;
          shift_type?: 'morning' | 'afternoon' | null;
          employee_id?: string;
          nik?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      offices: {
        Row: {
          id: string;
          name: string;
          latitude: number;
          longitude: number;
          geofence_radius: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          latitude: number;
          longitude: number;
          geofence_radius?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          latitude?: number;
          longitude?: number;
          geofence_radius?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      attendance: {
        Row: {
          id: string;
          user_id: string;
          shift_id: string | null;
          office_id: string | null;
          check_in_time: string;
          check_in_latitude: number | null;
          check_in_longitude: number | null;
          check_in_accuracy: number | null;
          check_in_location_data: Json | null;
          check_out_time: string | null;
          check_out_latitude: number | null;
          check_out_longitude: number | null;
          check_out_accuracy: number | null;
          check_out_location_data: Json | null;
          is_valid: boolean;
          is_mocked: boolean;
          distance_from_office: number;
          status: 'present' | 'late' | 'outside_radius';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          shift_id?: string | null;
          office_id?: string | null;
          check_in_time?: string;
          check_in_latitude?: number | null;
          check_in_longitude?: number | null;
          check_in_accuracy?: number | null;
          check_in_location_data?: Json | null;
          check_out_time?: string | null;
          check_out_latitude?: number | null;
          check_out_longitude?: number | null;
          check_out_accuracy?: number | null;
          check_out_location_data?: Json | null;
          is_valid?: boolean;
          is_mocked?: boolean;
          distance_from_office: number;
          status?: 'present' | 'late' | 'outside_radius';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          shift_id?: string | null;
          office_id?: string | null;
          check_in_time?: string;
          check_in_latitude?: number | null;
          check_in_longitude?: number | null;
          check_in_accuracy?: number | null;
          check_in_location_data?: Json | null;
          check_out_time?: string | null;
          check_out_latitude?: number | null;
          check_out_longitude?: number | null;
          check_out_accuracy?: number | null;
          check_out_location_data?: Json | null;
          is_valid?: boolean;
          is_mocked?: boolean;
          distance_from_office?: number;
          status?: 'present' | 'late' | 'outside_radius';
          created_at?: string;
        };
      };
      attendance_logs: {
        Row: {
          id: string;
          attendance_id: string;
          action: string;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          attendance_id: string;
          action: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          attendance_id?: string;
          action?: string;
          details?: Json;
          created_at?: string;
        };
      };
    };
  };
}
