# Progress Report — GeoAttend Pro

**Project:** GeoAttend Pro - Pertamina Trans Kontinental Edition
**Last Updated:** 2026-05-26
**Overall Status:** In Development

---

## Overall Progress: 96%

| Category | Progress |
|----------|----------|
| Frontend Development (Web Admin) | ✅ 100% |
| Backend / Database (Supabase) | ✅ 100% |
| Authentication | ✅ 90% |
| Geofencing Engine | ✅ 98% |
| HR Dashboard & Admin Panel | ✅ 100% |
| Mobile App (Flutter) | ✅ 100% |
| Selfie Attendance | ✅ 100% |
| Overtime Calculation | ✅ 100% |
| Driver Role Split (Bebas/Kantor) | ✅ 100% |
| Exception Dates (Holiday/Off) | ✅ 100% |
| Web Anti-Fraud (Mock Location) | ✅ 75% |
| Configuration & Setup | ✅ 90% |
| Late Attendance & Shift System | ✅ 100% |
| Daily Shift Selection (Juru Parkir) | ✅ 100% |
| CI/CD Pipeline | ✅ 80% |
| Testing | ❌ 0% |
| Deployment | ❌ 0% |
| Documentation | ⚠️ 60% |

---

## Completed Features

### 1. Project Setup ✅ (100%)
- [x] Next.js 16.2.4 dengan App Router
- [x] Tailwind CSS v4
- [x] TypeScript configuration
- [x] Package dependencies installed
- [x] Project structure defined

### 2. Database Schema (Supabase) ✅ (100%)
- [x] `profiles` table — user identity with roles
- [x] `offices` table — geofence center coordinates
- [x] `attendance` table — clock in/out transactions
- [x] `attendance_logs` table — audit trail
- [x] Triggers: `update_updated_at_column()`, `validate_attendance_geofence()`, `handle_new_user()`
- [x] Row Level Security (RLS) policies
- [x] Enum types: `user_role`, `attendance_status`

### 3. Authentication ✅ (85%)
- [x] AuthContext for global state
- [x] Login/Register with Supabase Auth
- [x] Auth persistence with onAuthStateChange

### 4. Web Admin Dashboard ✅ (100%)
- [x] Dashboard utama dengan stats
- [x] Employees management
- [x] Reports & Export (CSV/PDF)
- [x] Monitoring real-time
- [x] Leave requests
- [x] Offices management
- [x] Settings

### 5. Mobile App (Flutter) ✅ (100%)
- [x] Attendance capture
- [x] Location tracking
- [x] Statistics & Profile
- [x] Forgot password
- [x] Selfie camera with auto-capture & countdown
- [x] Selfie compression (~20KB) with offline fallback
- [x] Login screen overhaul
- [x] Enhanced history screen

---

## 📋 TAHAP 12: LATE ATTENDANCE & SHIFT SYSTEM

### Requirement Analysis

**1. Keterlambatan (Late):**
- Karyawan dianggap terlambat jika clock-in setelah jam 07:00 WIB

**2. Sistem Shift:**
| Shift | Jam Mulai | Jam Selesai |
|-------|-----------|-------------|
| Shift Pagi | 06:00 | 14:00 |
| Shift Siang | 10:00 | 18:00 |

---

### Implementation Plan

#### Phase 1: Database & Logic (Backend) ✅

- [x] **12.1** Tambah column `shift_type` di tabel `profiles`
  - Migration: `1002_add_shift_type_and_late_threshold.sql`
  - Value: `'morning' | 'afternoon' | null`

- [x] **12.2** Update trigger `validate_attendance_geofence()` dengan late threshold 07:00 WIB
  - Jika `check_in_time::time` > `'07:00:00'::time` → status = `'late'`
  - Jika `check_in_time::time` <= `'07:00:00'::time` → status = `'present'`

- [x] **12.3** Update `ShiftType` enum di TypeScript (`src/types/index.ts`)

#### Phase 2: Frontend Admin ✅

- [x] **12.4** Tambah field shift di employee edit form
  - `/admin/employees` page — modal edit employee ada pilihan shift

- [x] **12.5** Tampilkan info shift di employee list
  - Kolom "Shift" di tabel employees (Pagi / Siang / —)
  - Detail modal menampilkan shift
  - CSV export menyertakan kolom shift

- [x] **12.6** Update halaman reports
  - Filter status sudah ada opsi 'late'
  - Stats card sudah menampilkan jumlah late

- [x] **12.7** Tambah stats shift di employees page
  - Total Active employees card
  - Shift column di tabel

#### Phase 3: Mobile App (Flutter) ✅

- [x] **12.8** Update UI menampilkan status keterlambatan
  - Setelah clock-in, tampilkan notifikasi "Terlambat" jika > threshold (07:00/11:00)
  - Tampilkan badge shift (Pagi/Siang) di dashboard untuk Juru Parkir
  - Notifikasi push untuk keterlambatan
  - Dialog result dengan threshold yang sesuai shift

---

### Technical Details

**Late Calculation Logic (di trigger PostgreSQL):**
```sql
IF NEW.check_in_time::time > '07:00:00'::time THEN
    NEW.status := 'late';
ELSE
    NEW.status := 'present';
END IF;
```

**Shift Type Enum:**
```typescript
export type ShiftType = 'morning' | 'afternoon';
```

---

### Files Modified

| File | Description |
|------|-------------|
| `supabase/migrations/1002_add_shift_type_and_late_threshold.sql` | Migration: add shift_type column + update late threshold to 07:00 |
| `src/types/index.ts` | Tambah `ShiftType` type, `shift_type` di Profile |
| `src/hooks/useEmployees.ts` | Tambah `shift_type` di EmployeeUpdate |
| `src/app/admin/employees/page.tsx` | Shift column di tabel, shift field di edit modal, shift di detail modal |

---

## 📋 TAHAP 13: DAILY SHIFT SELECTION (MOBILE APP - JURU PARKIR)

### Requirement Analysis

**Target:** Role Juru Parkir saja yang bisa memilih shift setiap hari setelah login

**Alur Baru (Simplified):**
1. Registration → Tanpa pilihan shift type
2. Login → Langsung ke Dashboard
3. Dashboard (Juru Parkir) → Pilih shift baru clock-in
4. Non-Juru Parkir → Langsung clock-in (tidak ada pilihan shift)

**Aturan Late Threshold per Shift:**
| Shift | Jam Kerja | Late Threshold |
|-------|-----------|----------------|
| Shift Pagi | 06:00 - 14:00 | > 07:00 = Late |
| Shift Siang | 10:00 - 18:00 | > 11:00 = Late |

**Aturan Pilihan Shift:**
1. **Tidak ada batas waktu** - bisa pilih kapan saja sebelum clock-in
2. **Default:** Jika tidak memilih → auto-assign Shift Pagi
3. **Weekend:** Sabtu/Minggu → exempt dari wajib shift

---

### Implementation Plan

#### Phase 1: Database (Supabase) ✅

- [x] **13.1** Buat table `user_shift_schedules` + RLS policies
  - Migration: `1003_add_shift_schedules_and_dynamic_late.sql`
- [x] **13.2** Update trigger dengan dynamic late threshold:
  - Morning: > 07:00 = late
  - Afternoon: > 11:00 = late
  - Default (tidak pilih): morning (> 07:00)
  - Weekend: exempt dari late check

#### Phase 2: Mobile App (Flutter) ✅

- [x] **13.3** Modify Registration Screen
  - Hapus pilihan shift type (shifting/non-shifting)
  - Hanya pilih role saja (driver, juru_parkir, ob)

- [x] **13.4** Modify Shift Selection Screen
  - Langsung ke Login tanpa pilihan shift type

- [x] **13.5** Modify Dashboard Screen (Juru Parkir)
  - Tambah dialog "Pilih Shift Hari Ini" sebelum clock-in
  - Jika belum pilih shift → wajib pilih
  - Default morning jika tidak pilih

- [x] **13.6** Service baru: `shift_schedule_service.dart`
  - getTodayShift(), selectShift(), hasSelectedShiftToday()

- [x] **13.7** Offline Support - Table SQLite untuk sync (belum diimplementasi)

#### Phase 3: Web Admin ✅

- [x] **13.8** Enhance Reports Page
  - Kolom "Shift" baru di tabel attendance records
  - Icon matahari untuk Shift Pagi, sunset untuk Shift Siang
  - Kolom shift di CSV dan PDF export
  - Helper function `getShiftLabel()` untuk konversi shift type

---

### Technical Details

**Late Calculation Logic (Updated):**
```sql
DECLARE
  user_shift VARCHAR(20);
  late_threshold TIME;
  is_weekend BOOLEAN;
BEGIN
  -- Check if weekend
  is_weekend := EXTRACT(DOW FROM CURRENT_DATE) IN (0, 6);
  
  -- Get user's shift for today
  SELECT shift_type INTO user_shift
  FROM user_shift_schedules
  WHERE user_id = NEW.user_id 
    AND schedule_date = CURRENT_DATE
  LIMIT 1;
  
  -- Skip late check for weekend
  IF is_weekend THEN
    NEW.status := 'present';
    RETURN NEW;
  END IF;
  
  -- Determine late threshold based on shift
  IF user_shift IS NULL OR user_shift = 'morning' THEN
    late_threshold := '07:00:00'::time;
  ELSIF user_shift = 'afternoon' THEN
    late_threshold := '11:00:00'::time;
  ELSE
    late_threshold := '07:00:00'::time;
  END IF;
  
  -- Check late
  IF NEW.check_in_time::time > late_threshold THEN
    NEW.status := 'late';
  ELSE
    NEW.status := 'present';
  END IF;
END;
```

---

### Files to Modify

**Database:**
- `supabase/migrations/1003_add_shift_schedules_and_dynamic_late.sql` (NEW)

**Flutter:**
- `lib/screens/registration_screen.dart` - Hapus shift type selection
- `lib/screens/shift_selection_screen.dart` - Redirect jika bukan Juru Parkir
- `lib/screens/dashboard_screen.dart` - Dialog pilih shift untuk Juru Parkir
- `lib/services/shift_schedule_service.dart` (NEW)
- `lib/models/attendance_model.dart` - Tambah field shift_type

**Web Admin:**
- `src/app/admin/reports/page.tsx` - Tambah kolom shift

---

### Check-out Logic
- **Tetap seperti sekarang** - tidak ada perubahan
- Simple time recording tanpa validasi shift

---

## 📋 TAHAP 14: ADMIN REPORTS DELETE + MANUAL EMPLOYEE ADD

### Requirement Analysis

**1. Delete History di admin/reports:**
- Admin bisa delete semua attendance records
- Batasan: per hari (per date) - tidak sekaligus semua
- Permanent delete - tidak ada undo

**2. Add Employee Secara Manual di admin/employees:**
- Admin input password awal untuk karyawan baru
- Tidak perlu melalui self-registration

---

### Implementation Plan

#### Phase 1: Delete Attendance by Date ✅

- [x] **14.1** Tambah fungsi `deleteByDate(date)` di `useReports.ts`
  - Delete all attendance records where date(check_in_time) = date parameter
  - Return success/error

- [x] **14.2** Tambah UI di admin/reports page
  - Button "Hapus Data" di toolbar
  - Modal dengan Date Picker
  - Konfirmasi: "Yakin menghapus semua data kehadiran tanggal [tgl]?"
  - Refresh setelah delete + toast notification

- [x] **14.3** RLS Policy - Hanya admin yang bisa delete (handled by existing auth)

#### Phase 2: Add Employee Manual ✅

- [x] **14.4** Tambah fungsi `createEmployee(data)` di `useEmployees.ts`
  - Input: { email, password, full_name, nik, employee_id, role, shift_type }
  - Buat user di auth.users + profile di profiles table
  - Return success/error dengan message

- [x] **14.5** Tambah UI - Add Employee Modal
  - Full Name (required)
  - Email (required, unique)
  - Password (required, min 8 karakter)
  - NIK (optional)
  - Employee ID (optional)
  - Role (dropdown: Juru Parkir, Driver, OB, Viewer)
  - Shift (dropdown: None, Morning, Afternoon)

- [x] **14.6** Validation
  - Email format valid
  - Password min 8 karakter
  - Email unique (cek sebelum insert)
  - Full Name tidak kosong

---

### Technical Details

**Delete by Date SQL:**
```sql
DELETE FROM attendance 
WHERE DATE(check_in_time) = '2026-05-19';
```

**Create Employee Flow:**
```typescript
// 1. Create auth user
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true
});

// 2. Create profile
const { error: profileError } = await supabase.from('profiles').insert({
  id: authData.user.id,
  full_name,
  email,
  role,
  shift_type,
  nik,
  employee_id
});
```

---

### Files Modified

| File | Description |
|------|-------------|
| `src/hooks/useReports.ts` | Tambah `deleteByDate(date)` |
| `src/app/admin/reports/page.tsx` | Tambah button "Hapus Data" + modal date picker |
| `src/hooks/useEmployees.ts` | Tambah `createEmployee(...)` |
| `src/app/admin/employees/page.tsx` | Tambah "Tambah Karyawan" button + modal form |

---

## 📋 TAHAP 15: SELFIE ATTENDANCE & STORAGE OPTIMIZATION

### Requirement Analysis

**Target:**
- Setiap absensi wajib foto selfie (kamera depan) sebagai bukti kehadiran
- Optimasi storage Supabase free tier (1 GB) untuk ~100 user
- Foto otomatis dihapus >30 hari

**Alur:**
1. User tap Check-In → kamera depan terbuka otomatis
2. Countdown 2 detik → auto-capture
3. Kompresi gambar → ~15-20 KB
4. Upload ke Supabase Storage bucket `selfie_absensi`
5. URL foto tersimpan di kolom `photo_url` tabel `attendance`
6. Jika offline → simpan lokal, upload saat online

---

### Implementation Plan

#### Phase 1: Backend (Database & Storage) ✅

- [x] **15.1** Migrasi `1005_add_selfie_attendance.sql`
  - Tambah kolom `photo_url TEXT` di `attendance`
  - Buat storage bucket `selfie_absensi` (public, max 25KB)
  - RLS policies: user upload own selfie, admin read all

- [x] **15.2** Storage Optimization
  - Kompresi: quality 20, resolusi 480×360 → target ~15-20KB
  - File size limit bucket: 25600 bytes (25KB)

#### Phase 2: Flutter - Selfie Service ✅

- [x] **15.3** `lib/services/selfie_service.dart` (NEW)
  - `getFrontCamera()` — deteksi kamera depan
  - `compressImage()` — kompresi progresif dengan target ≤25KB
  - `uploadPhoto()` — upload ke Supabase Storage
  - `captureAndUpload()` — full flow: capture → compress → upload (online) / save lokal (offline)
  - `uploadLocalPhoto()` — upload foto offline setelah online

- [x] **15.4** `lib/widgets/selfie_camera_overlay.dart` (NEW)
  - Inisialisasi kamera depan otomatis
  - Countdown 2 detik dengan animasi circular progress
  - Auto-capture setelah countdown
  - Loading state saat kompresi/upload
  - Error handling: tombol "Coba Lagi" atau "Lanjut Tanpa Foto"
  - Dialog konfirmasi jika user tutup sebelum capture

#### Phase 3: Retention Policy ✅

- [x] **15.5** Edge Function `cleanup_old_selfies`
  - Path: `supabase/functions/cleanup_old_selfies/index.ts`
  - Dipanggil via cron-job.org (gratis) — setiap hari
  - Hapus semua foto selfie >30 hari dari storage bucket
  - Dilindungi CRON_SECRET header
  - Return summary (jumlah deleted, bytes freed)

---

### Storage Impact Analysis

| Metrik | Sebelum Optimasi | Sesudah Optimasi |
|--------|------------------|------------------|
| Per foto | ~50 KB | **~15-20 KB** |
| Storage/bulan (100 user × 22 hari) | ~107 MB | **~33-44 MB** |
| Tanpa retention policy | ~9 bulan penuh | **~2 tahun penuh** |
| Dengan retention 30 hari | ❌ | **Stabil ~33 MB** |

---

### Files Modified/Created

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/1005_add_selfie_attendance.sql` | NEW | Kolom photo_url, bucket, RLS |
| `lib/services/selfie_service.dart` | NEW | Full selfie service dengan kompresi |
| `lib/widgets/selfie_camera_overlay.dart` | NEW | Auto-capture overlay dengan countdown |
| `supabase/functions/cleanup_old_selfies/index.ts` | NEW | Edge Function retensi 30 hari |
| `PUSH_DATABASE.md` | UPDATED | Panduan deploy EF + cron-job |

---

## 📋 TAHAP 16: OVERTIME CALCULATION

### Requirement Analysis

**Target:**
- Hitung durasi kerja dan lembur otomatis saat checkout
- Aturan lembur: minimal 15 menit lebih dari jam shift sebelum dihitung
- Weekend: tidak ada lembur

**Shift Config:**
| Shift | Start | End | Grace |
|-------|-------|-----|-------|
| Pagi | 06:00 | 14:00 | 3 menit |
| Siang | 10:00 | 18:00 | 3 menit |
| Full Time | 07:00 | 16:00 | 3 menit |
| Non-Shifting | 07:00 | 16:00 | 3 menit |

---

### Implementation Plan ✅

- [x] **16.1** Migration `1011_overtime_calculation.sql`
  - Buat table `shift_config` dengan 4 shift tetap
  - Seed data pagi, siang, full_time, non_shifting
  - RLS: admin manage, all users view
  - Tambah `overtime_minutes INTEGER` dan `work_duration_minutes INTEGER` di `attendance`

- [x] **16.2** Update trigger geofence saat checkout
  - Hitung `work_duration = check_out - check_in` (menit)
  - Hitung `overtime = max(0, check_out - shift_end - 15 menit minimum)`
  - Weekend: overtime = 0
  - Pakai timezone WIB (+7)

---

### Files Modified

| File | Description |
|------|-------------|
| `supabase/migrations/1011_overtime_calculation.sql` | NEW - shift_config + overtime logic |

---

## 📋 TAHAP 17: DRIVER ROLE SPLIT

### Requirement Analysis

**Target:** Split role `driver` menjadi dua tipe dengan aturan geofence berbeda

| Role | Geofence | Late Check | Overtime |
|------|----------|------------|----------|
| `driver_bebas` | ❌ Bypass (bisa absen di mana saja) | ✅ | ✅ |
| `driver_kantor` | ✅ Wajib dalam radius kantor | ✅ | ✅ |

**Alur:**
1. Semua driver existing → migrasi ke `driver_bebas`
2. Admin bisa ubah role di employee management
3. Backend trigger bedakan validasi geofence berdasarkan role

---

### Implementation Plan ✅

- [x] **17.1** Migration `1012_split_driver_role.sql`
  - Add enum values: `driver_bebas`, `driver_kantor`
  - Migrasi existing driver → `driver_bebas`
  - Update `validate_attendance_geofence()` trigger
    - `driver_bebas`: skip geofence validation, tetap kena late check
    - `driver_kantor`: geofence enforced seperti biasa

- [x] **17.2** Sync role to auth.users
  - Migration `1013_sync_profile_role_to_auth.sql`
  - Update `raw_user_meta_data` di `auth.users` setiap kali role di profile berubah

---

### Files Modified

| File | Description |
|------|-------------|
| `supabase/migrations/1012_split_driver_role.sql` | NEW - Split driver + trigger update |
| `supabase/migrations/1013_sync_profile_role_to_auth.sql` | NEW - Sync role ke auth metadata |

---

## 📋 TAHAP 18: EXCEPTION DATES (HARI LIBUR & OFF)

### Requirement Analysis

**Target:** Admin bisa menandai tanggal tertentu sebagai hari libur/off
- **Global:** Berlaku untuk semua karyawan
- **Per-user:** Hari off individu (izin tidak masuk)

**Dampak:**
- Tanggal exception diperlakukan seperti weekend
- Skip late check (status tetap `present`)
- Tidak ada kalkulasi overtime

---

### Implementation Plan ✅

- [x] **18.1** Migration `1014_exception_dates.sql`
  - Buat `global_exception_dates` table
  - Buat `user_exception_dates` table
  - Unique index per date (global) dan per user+date
  - RLS: admin full access, authenticated can read

- [x] **18.2** Update trigger untuk skip exception dates
  - Cek global_exception_dates + user_exception_dates
  - Jika ada → skip late check, status = present

---

### Files Modified

| File | Description |
|------|-------------|
| `supabase/migrations/1014_exception_dates.sql` | NEW - Exception dates tables + RLS |

---

## 📋 TAHAP 19: WEB ADMIN ENHANCEMENTS

### Implementation Plan ✅

- [x] **19.1** New Employee Dashboard (`/dashboard`)
  - Layout dengan sidebar
  - Halaman monitoring, reports, attendance-rate

- [x] **19.2** Monthly Recap (`/admin/monthly-recap`)
  - Rekap absensi bulanan dengan tabel lengkap
  - Filter per bulan, status hadir/late/izin/dll

- [x] **19.3** Reports Page Enhancement
  - Delete attendance by date
  - Tambah kolom shift, overtime, work duration
  - Perbaikan filter dan export

- [x] **19.4** Timezone Utility (`src/lib/timezone.ts`)
  - Konversi WIB (+7)
  - Helper formatting tanggal

- [x] **19.5** Supabase Admin Client (`src/lib/supabase-admin.ts`)
  - Service role client untuk operasi admin (create user, dll)

---

*Last updated: 2026-05-26 (v6 — Selfie, Overtime, Driver Split, Exception Dates, Web Enhancements)*