# Dokumentasi Database Supabase - PTK Attendance System

## Overview
Sistem database untuk aplikasi absensi PTK (PT Kerta Raharja) dengan fitur geofencing, shift management, dan leave management.

**Version:** 1.0  
**Last Updated:** 2026-05-16  
**Database:** Supabase (PostgreSQL)

---

## 1. Tabel Utama (Core Tables)

### 1.1 `profiles` - Profil Pengguna
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key, FK ke auth.users |
| `full_name` | TEXT | Nama lengkap |
| `employee_id` | TEXT | ID Karyawan (unique) |
| `nik` | TEXT | NIK Karyawan |
| `email` | TEXT | Email |
| `role` | TEXT | Role: `driver`, `juru_parkir`, `ob`, `admin`, `viewer` |
| `device_id` | TEXT | ID Device |
| `shift_type` | TEXT | `shifting` atau `non_shifting` |
| `is_active` | BOOLEAN | Status aktif |
| `is_owner` | BOOLEAN | Apakah owner account |
| `is_viewer` | BOOLEAN | Permission viewer |
| `can_manage_accounts` | BOOLEAN | Permission kelola akun |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

**Source:** `001_create_profiles.sql` (migration 001, actual file creates `user_shifts`)

---

### 1.2 `offices` - Kantor/Lokasi
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `name` | TEXT | Nama kantor |
| `latitude` | DOUBLE PRECISION | Latitude |
| `longitude` | DOUBLE PRECISION | Longitude |
| `geofence_radius` | INTEGER | Radius geofence (meter), default: 100 |
| `address` | TEXT | Alamat lengkap |
| `is_active` | BOOLEAN | Status aktif |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

**Source:** `101_create_offices.sql`

---

### 1.3 `shifts` - Shift Kerja
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `name` | TEXT | Nama shift |
| `code` | TEXT | Kode shift (unique) |
| `start_time` | TIME | Jam mulai |
| `end_time` | TIME | Jam selesai |
| `grace_period_minutes` | INTEGER | Durasi toleransi (menit), default: 15 |
| `description` | TEXT | Deskripsi |
| `is_active` | BOOLEAN | Status aktif |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

**Default Shifts:**
| Code | Name | Start | End | Grace Period |
|------|------|-------|-----|--------------|
| `SHIFT_PAGI` | Shift Pagi | 08:00 | 16:00 | 15 min |
| `SHIFT_SORE` | Shift Sore | 16:00 | 00:00 | 15 min |
| `SHIFT_MALAM` | Shift Malam | 00:00 | 08:00 | 15 min |
| `NON_SHIFTING` | Non-Shifting | 08:30 | 17:30 | 30 min |

**Source:** `003_create_shifts.sql`, `008_seed_data.sql`

---

### 1.4 `user_shifts` - Assignment Shift ke User
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK ke profiles |
| `shift_id` | UUID | FK ke shifts |
| `office_id` | UUID | FK ke offices |
| `effective_date` | DATE | Tanggal mulai efektif |
| `end_date` | DATE | Tanggal akhir (nullable) |
| `is_active` | BOOLEAN | Status aktif |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

**Source:** `004_create_user_shifts.sql`

---

### 1.5 `attendance` - Absensi
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK ke profiles |
| `shift_id` | UUID | FK ke shifts |
| `office_id` | UUID | FK ke offices |
| `check_in_time` | TIMESTAMPTZ | Waktu check-in |
| `check_in_latitude` | DOUBLE PRECISION | Latitude saat check-in |
| `check_in_longitude` | DOUBLE PRECISION | Longitude saat check-in |
| `check_in_accuracy` | DOUBLE PRECISION | Accuracy GPS |
| `check_in_location_data` | JSONB | Data lokasi lengkap |
| `check_out_time` | TIMESTAMPTZ | Waktu check-out (nullable) |
| `check_out_latitude` | DOUBLE PRECISION | Latitude saat check-out |
| `check_out_longitude` | DOUBLE PRECISION | Longitude saat check-out |
| `check_out_accuracy` | DOUBLE PRECISION | Accuracy GPS |
| `check_out_location_data` | JSONB | Data lokasi lengkap |
| `is_valid` | BOOLEAN | Apakah absensi valid |
| `distance_from_office` | DOUBLE PRECISION | Jarak dari kantor (meter) |
| `is_mocked` | BOOLEAN | Apakah lokasi dimock |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |

**Source:** `005_create_attendance.sql`

---

### 1.6 `leave_requests` - Request Cuti/Izin
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK ke profiles |
| `leave_type` | TEXT | Jenis: `cuti`, `izin`, `sakit`, dll |
| `start_date` | DATE | Tanggal mulai |
| `end_date` | DATE | Tanggal selesai |
| `reason` | TEXT | Alasan |
| `status` | TEXT | Status: `pending`, `approved`, `rejected`, `cancelled` |
| `approved_by` | UUID | FK ke profiles (approver) |
| `approved_at` | TIMESTAMPTZ | Timestamp persetujuan |
| `admin_notes` | TEXT | Catatan admin |
| `total_days` | INTEGER | Total hari |
| `admin_note` | TEXT | Catatan admin (alternatif) |
| `responded_at` | TIMESTAMPTZ | Timestamp response |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

**Leave Types Valid:** `cuti_tahunan`, `cuti_sakit`, `cuti_darurat`, `izin_tidak_hadir`, `cuti`, `izin`, `sakit`, `annual`, `sick`, `emergency`, `unpaid`

**Source:** `006_create_leave_requests.sql`, `011_fix_schema_mismatches.sql`

---

### 1.7 `settings` - Pengaturan Aplikasi
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | TEXT | Primary Key, default: `app_settings` |
| `late_threshold_hour` | INTEGER | Batas jam telat (default: 9) |
| `late_threshold_minute` | INTEGER | Batas menit telat (default: 0) |
| `default_geofence_radius` | INTEGER | Radius default (default: 100m) |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

**Source:** `002_admin_settings.sql`

---

## 2. Fungsi (Functions)

### 2.1 Helper Functions

#### `is_admin()` - Cek Role Admin
```sql
-- Cek apakah user adalah admin via auth.users metadata
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid()
        AND raw_user_meta_data->>'role' = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
**Fix:** Migration 014 - fix infinite recursion dengan query ke `auth.users` langsung

---

### 2.2 Geolocation Functions

#### `calculate_distance()` - Hitung Jarak Haversine
```sql
-- Menghitung jarak antara 2 koordinat dalam meter
-- Menggunakan formula Haversine
CREATE OR REPLACE FUNCTION public.calculate_distance(
    lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
```
**Parameter:**
- `lat1, lon1`: Koordinat point 1
- `lat2, lon2`: Koordinat point 2
**Return:** Jarak dalam meter

---

#### `is_within_geofence()` - Cek Dalam Radius
```sql
-- Cek apakah user dalam radius kantor
CREATE OR REPLACE FUNCTION public.is_within_geofence(
    user_lat DOUBLE PRECISION,
    user_lon DOUBLE PRECISION,
    office_id UUID
)
RETURNS BOOLEAN
```

---

### 2.3 Attendance Validation

#### `validate_attendance_geofence()` - Trigger Validasi Geofence
```sql
CREATE OR REPLACE FUNCTION validate_attendance_geofence()
RETURNS TRIGGER AS $$
-- Validasi:
-- 1. Hitung jarak dari kantor
-- 2. Jika dalam radius -> is_valid = true
-- 3. Cek apakah telat (setelah late_threshold)
-- 4. Set status: 'present', 'late', atau 'outside_radius'
```
**Trigger:** `validate_geofence_before_insert` - BEFORE INSERT on attendance

**Source:** `002_admin_settings.sql` (versi updated), `100_initial_schema.sql` (versi awal)

---

### 2.4 Timestamp Updates

#### `update_updated_at_column()` - Auto Update Timestamp
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Triggers:**
- `update_profiles_updated_at`
- `update_offices_updated_at`
- `update_attendance_updated_at`
- `update_leave_requests_updated_at`

---

## 3. Trigger

### 3.1 `on_auth_user_created` - Auto Create Profile
```sql
-- Otomatis membuat profile saat user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (
        id, email, full_name, role, is_active
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'admin'),
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Latest Version:** Migration 012 (fix untuk web admin)

---

## 4. Row Level Security (RLS)

### 4.1 Tables dengan RLS Enable
- `profiles`
- `offices`
- `shifts`
- `user_shifts`
- `attendance`
- `leave_requests`
- `settings`

### 4.2 Policies Summary

#### Profiles
| Policy | Operation | Using |
|--------|-----------|-------|
| Users view own profile | SELECT | `auth.uid() = id` |
| Admins view all profiles | SELECT | `is_admin()` |
| Admins update all profiles | ALL | `is_admin()` |

#### Offices
| Policy | Operation | Using |
|--------|-----------|-------|
| Anyone can view | SELECT | `true` (authenticated) |
| Only admins can modify | ALL | `is_admin()` |

#### Attendance
| Policy | Operation | Using |
|--------|-----------|-------|
| Users view own attendance | SELECT | `auth.uid() = user_id` |
| Users insert own attendance | INSERT | `auth.uid() = user_id` |
| Users update own attendance | UPDATE | `auth.uid() = user_id` |
| Admins view all attendance | SELECT | `is_admin()` |

#### Leave Requests
| Policy | Operation | Using |
|--------|-----------|-------|
| Users view own | SELECT | `user_id = auth.uid()` |
| Users insert own | INSERT | `user_id = auth.uid()` |
| Users cancel own pending | UPDATE | `user_id = auth.uid() AND status = 'pending'` |
| Admins view all | SELECT | `is_admin()` |
| Admins manage all | ALL | `is_admin()` |

---

## 5. Default Admin Accounts

### 5.1 Admin Accounts
| Email | Password | Employee ID | Full Name |
|-------|----------|-------------|-----------|
| `admin.ptk@gmail.com` | `AdminPTK123!` | `ADM-001` | Super Admin PTK |
| `admin1@ptk.com` | `AdminPTK123!` | `ADM-002` | Admin Satu |
| `admin2@ptk.com` | `AdminPTK123!` | `ADM-003` | Admin Dua |

**⚠️ SECURITY NOTE:** Ganti password setelah login pertama kali!

**Source:** Migration 010, 013

---

## 6. Seed Data

### 6.1 Offices
| Name | Latitude | Longitude | Radius | Address |
|------|----------|-----------|--------|---------|
| Kantor Pusat PTK | -6.2088 | 106.8456 | 100m | Jl. Medan Merdeka Timur No.1A, Jakarta Pusat |

### 6.2 Shifts
| Code | Name | Start | End | Grace |
|------|------|-------|-----|-------|
| SHIFT_PAGI | Shift Pagi | 08:00 | 16:00 | 15 min |
| SHIFT_SORE | Shift Sore | 16:00 | 00:00 | 15 min |
| SHIFT_MALAM | Shift Malam | 00:00 | 08:00 | 15 min |
| NON_SHIFTING | Non-Shifting | 08:30 | 17:30 | 30 min |

**Source:** `008_seed_data.sql`

---

## 7. Migration History

### 7.1 Migration Order
| File | Description | Status |
|------|-------------|--------|
| `001_create_profiles.sql` | Create user_shifts table | ✅ |
| `002_admin_settings.sql` | Settings table & geofence validation | ✅ |
| `003_create_shifts.sql` | Seed offices & shifts | ✅ |
| `004_create_user_shifts.sql` | User shifts table | ✅ |
| `005_create_attendance.sql` | Attendance table | ✅ |
| `006_create_leave_requests.sql` | Leave requests table | ✅ |
| `007_create_rls_policies.sql` | Initial RLS policies | ✅ |
| `008_seed_data.sql` | Seed data | ✅ |
| `009_create_functions.sql` | Geolocation functions | ✅ |
| `010_create_admin_account.sql` | Create admin account | ✅ |
| `011_fix_schema_mismatches.sql` | Fix schema Flutter compatibility | ✅ |
| `012_fix_auth_trigger.sql` | Fix handle_new_user trigger | ✅ |
| `013_create_admin_accounts.sql` | Create 2 more admin accounts | ✅ |
| `014_fix_rls_recursion.sql` | Fix RLS infinite recursion | ✅ |
| `015_fix_rls_policies.sql` | Recreate RLS policies | ✅ |
| `100_initial_schema.sql` | Initial schema (legacy) | ⚠️ |
| `101_create_offices.sql` | Create offices table | ✅ |
| `102_leave_requests.sql` | Leave requests alt version | ⚠️ |
| `999_test_connection.sql` | Test connection | ✅ |

### 7.2 Known Issues Fixed
1. **RLS Infinite Recursion** (Migration 014, 015)
   - `is_admin()` query `public.profiles` causing recursion
   - Fixed by querying `auth.users.raw_user_meta_data` directly

2. **Schema Mismatches** (Migration 011)
   - Missing columns: `total_days`, `admin_note`, `responded_at`
   - Wrong column names: `admin_notes` vs `admin_note`
   - Incompatible `leave_type` values

3. **Trigger Conflicts** (Migration 012)
   - `handle_new_user()` default role vs CHECK constraint
   - Fixed by using `COALESCE` with metadata fallback

---

## 8. User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `driver` | Driver | Basic attendance |
| `juru_parkir` | Juru Parkir (default) | Basic attendance |
| `ob` | Office Boy | Basic attendance |
| `admin` | Administrator | Full access |
| `viewer` | Viewer Only | View only |

---

## 9. API Endpoints Notes

### 9.1 Attendance Flow
1. User check-in → mobile sends location
2. `validate_attendance_geofence` trigger calculates distance
3. Sets `is_valid`, `status`, `distance_from_office`
4. RLS policy allows insert if `auth.uid() = user_id`

### 9.2 Leave Request Flow
1. User creates request → status: `pending`
2. Admin reviews → updates to `approved`/`rejected`
3. `approved_by`, `approved_at` set
4. User can cancel if still `pending`

---

## 10. Troubleshooting

### 10.1 RLS Permission Denied
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check is_admin() function
SELECT public.is_admin();
```

### 10.2 Trigger Not Firing
```sql
-- Check triggers
SELECT * FROM information_schema.triggers WHERE event_object_table = 'attendance';

-- Check function
SELECT prosrc FROM pg_proc WHERE proname = 'validate_attendance_geofence';
```

### 10.3 Profile Not Created on Signup
```sql
-- Check trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Manual fix: run trigger function manually
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = user_record.id) THEN
            INSERT INTO profiles (id, email, full_name, role, is_active)
            VALUES (
                user_record.id,
                user_record.email,
                COALESCE(user_record.raw_user_meta_data->>'full_name', user_record.email),
                'admin',
                true
            );
        END IF;
    END LOOP;
END $$;
```

---

## 11. Future Considerations

- [ ] Add `attendance_logs` table untuk audit trail
- [ ] Add `departments` table untuk struktur organisasi
- [ ] Add `notifications` table untuk push notifications
- [ ] Implement soft delete dengan `deleted_at` column
- [ ] Add `leave_balances` table untuk tracking sisa cuti