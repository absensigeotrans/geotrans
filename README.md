# GeoAttend Pro

**Geofencing-based Attendance System** for Pertamina Trans Kontinental (PTK)

Modern aplikasi absensi menggunakan teknologi GPS geofencing. Karyawan hanya bisa absen masuk/keluar saat berada dalam radius kantor yang telah dikonfigurasi.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [User Roles & Permissions](#user-roles--permissions)
6. [Getting Started](#getting-started)
7. [Migration Files](#migration-files)
8. [API Reference](#api-reference)
9. [Geofencing Logic](#geofencing-logic)
10. [Admin Accounts](#admin-accounts)
11. [Security](#security)
12. [Troubleshooting](#troubleshooting)
13. [Deployment](#deployment)
14. [AI Development Guide](#-ai-development-guide)
15. [License](#license)

---

## Features

### Fitur Karyawan
- **Jam Digital** - Tampilan jam/tanggal real-time
- **Absensi GPS** - Menggunakan browser geolocation API (web) / device GPS (mobile)
- **Peta Interaktif** - Visualisasi lokasi kantor dan radius geofence
- **Indikator Jarak** - Jarak real-time ke kantor dengan status (within/outside range)
- **Riwayat Absensi** - Lihat catatan absensi pribadi
- **Request Cuti/Izin** - Ajukan cuti, izin, atau sakit

### Fitur Admin/HR
- **Dashboard Statistik** - Overview karyawan hadir, telat, dan outside-radius
- **Manajemen Karyawan** - Lihat semua karyawan dan shift mereka
- **Manajemen Lokasi Kantor** - Konfigurasi multiple lokasi dengan custom radius
- **Log Aktivitas Real-time** - Monitor aktivitas absensi terbaru
- **Manajemen Shift** - Konfigurasi jam kerja dan grace period
- **Persetujuan Cuti** - Approval/rejection request cuti/izin
- **Settings Sistem** - Atur threshold telat dan radius default
- **Export Reports** - Export CSV/PDF laporan

### Fitur Teknis
- **Validasi Server-side** - Formula Haversine menghitung jarak di server untuk prevent manipulasi
- **Row Level Security (RLS)** - PostgreSQL RLS policies melindungi data user
- **Responsive Mobile** - Berfungsi di desktop dan mobile devices
- **Toast Notifications** - User feedback untuk semua actions
- **Offline Support** - SQLite local cache untuk mobile
- **Biometric Auth** - Fingerprint/Face ID support
- **One-Tap Selfie Attendance** - Auto-capture kamera depan saat check-in, kompresi <50KB, upload ke Supabase Storage

---

## Tech Stack

### Web (Next.js Admin Panel)
| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| Maps | Leaflet.js + OpenStreetMap |
| Icons | Lucide React |
| State | React Context + Custom Hooks |

### Mobile (Flutter App)
| Layer | Tech |
|-------|------|
| Framework | Flutter + Dart |
| Maps | flutter_map + OpenStreetMap |
| GPS | geolocator + flutter_background_geolocation |
| Local DB | SQLite (offline cache) |
| Biometric | local_auth |
| Camera | camera + flutter_image_compress |
| Notifications | flutter_local_notifications |

### Shared Backend
| Layer | Tech |
|-------|------|
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Email/Password) |
| Functions | PostgreSQL Functions & Triggers |
| RLS | Row Level Security Policies |
| Date Utils | date-fns (web) / intl (mobile) |

---

## Project Structure

```
geoattend-pro/                              # Root repository
│
├── 🌐 WEB (Next.js Admin)
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── admin/                      # Admin dashboard pages
│   │   │   │   ├── page.tsx                # Dashboard statistics
│   │   │   │   ├── employees/page.tsx      # Employee management
│   │   │   │   ├── offices/page.tsx        # Office CRUD
│   │   │   │   ├── shifts/page.tsx         # Shift management
│   │   │   │   ├── reports/page.tsx        # Reports + CSV/PDF export
│   │   │   │   ├── leave-requests/page.tsx # Leave approval
│   │   │   │   ├── settings/page.tsx       # System settings
│   │   │   │   ├── activity-logs/page.tsx  # Audit trail
│   │   │   │   └── monitoring/page.tsx     # Real-time monitoring
│   │   │   ├── history/page.tsx            # Personal attendance history
│   │   │   ├── leave/page.tsx              # Personal leave requests
│   │   │   ├── layout.tsx                  # Root layout
│   │   │   └── page.tsx                    # Main attendance page
│   │   ├── components/
│   │   │   ├── admin/                      # Admin-specific components
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── StatsCard.tsx
│   │   │   │   └── ...
│   │   │   ├── ui/                         # Reusable UI components
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── DateRangePicker.tsx
│   │   │   │   ├── FormInput.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Pagination.tsx
│   │   │   │   ├── SearchInput.tsx
│   │   │   │   ├── Table.tsx
│   │   │   │   ├── Tabs.tsx
│   │   │   │   └── Toast.tsx
│   │   │   ├── AttendanceButton.tsx
│   │   │   ├── AttendancePage.tsx
│   │   │   ├── DigitalClock.tsx
│   │   │   ├── DistanceIndicator.tsx
│   │   │   ├── Map.tsx
│   │   │   └── ...
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ToastContext.tsx
│   │   ├── hooks/
│   │   │   ├── useActivityLogs.ts
│   │   │   ├── useAdminSettings.ts
│   │   │   ├── useAttendance.ts
│   │   │   ├── useEmployees.ts
│   │   │   ├── useGeolocation.ts
│   │   │   ├── useLeaveRequests.ts
│   │   │   ├── useOffices.ts
│   │   │   └── useReports.ts
│   │   ├── lib/
│   │   │   ├── supabase.ts                 # Supabase client
│   │   │   ├── utils.ts                    # Haversine + formatters
│   │   │   └── database.types.ts           # TypeScript types
│   │   └── types/
│   │       └── index.ts                    # TypeScript interfaces
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── .env.local
│
├── 📱 MOBILE (Flutter App)
│   ├── lib/
│   │   ├── main.dart
│   │   ├── app.dart
│   │   ├── models/
│   │   │   ├── attendance_model.dart
│   │   │   ├── leave_request_model.dart
│   │   │   └── user_model.dart
│   │   ├── screens/
│   │   │   ├── auth/
│   │   │   │   ├── login_screen.dart
│   │   │   │   └── register_screen.dart
│   │   │   ├── dashboard_screen.dart
│   │   │   ├── history_screen.dart
│   │   │   ├── leave_request_screen.dart
│   │   │   ├── shift_selection_screen.dart
│   │   │   ├── profile_screen.dart
│   │   │   └── admin/
│   │   │       ├── admin_screen.dart
│   │   │       ├── admin_employees_screen.dart
│   │   │       ├── admin_offices_screen.dart
│   │   │       └── admin_reports_screen.dart
│   │   ├── services/
│   │   │   ├── auth_service.dart
│   │   │   ├── attendance_service.dart
│   │   │   ├── office_service.dart
│   │   │   ├── shift_service.dart
│   │   │   ├── leave_service.dart
│   │   │   ├── location_service.dart
│   │   │   ├── sync_service.dart
│   │   │   ├── notification_service.dart
│   │   │   ├── report_service.dart
│   │   │   ├── biometric_service.dart
│   │   │   └── selfie_service.dart
│   │   └── widgets/
│   │       └── selfie_camera_overlay.dart
│   ├── android/
│   ├── ios/
│   ├── pubspec.yaml
│   └── .env
│
├── 🗄️ SHARED
│   ├── supabase/
│   │   ├── migrations/                     # All migration files
│   │   │   ├── 001_create_profiles.sql
│   │   │   │   └── ...
│   │   │   ├── RND.md                       # Database reference
│   │   │   └── config.toml
│   │   └── functions/                       # Edge functions (future)
│   └── docs/
│       ├── ARCHITECTURE.md
│       ├── PRD.md
│       └── AGENTS.md
│
└── README.md
```

---

## Database Schema

### Entity Relationship Diagram

```
┌──────────────┐       ┌─────────────────┐       ┌─────────────┐
│   auth.users │───────│    profiles     │◄──────│   shifts    │
│  (Supabase)  │ 1:1  │                │  M:N  │             │
└──────────────┘       │  - id (PK,FK)  │───────│ - id (PK)   │
                        │  - employee_id │       │ - name      │
                        │  - full_name   │       │ - code      │
                        │  - nik         │       │ - start_time│
                        │  - email       │       │ - end_time  │
                        │  - role        │       │ - grace_per │
                        │  - shift_type  │       │ - is_active │
                        │  - is_active   │       └─────────────┘
                        │  - is_owner    │
                        │  - ...         │       ┌─────────────────┐
                        └───────┬────────┘       │   user_shifts   │
                                │ M:N            │                 │
                                │                │ - user_id (FK)  │
                                │                │ - shift_id (FK) │
                                ▼                │ - office_id (FK)│
                        ┌──────────────┐        │ - effective_date│
                        │  attendance  │        │ - end_date      │
                        │              │        │ - is_active     │
                        │ - id (PK)    │        └─────────────────┘
                        │ - user_id(FK)│
                        │ - shift_id   │        ┌─────────────────┐
                        │ - office_id  │        │    offices      │
                        │ - check_in   │        │                 │
                        │ - check_out  │        │ - id (PK)       │
                        │ - is_valid   │        │ - name          │
                        │ - distance   │        │ - latitude      │
                        │ - status     │◄──────│ - longitude     │
                        │ - location   │        │ - geofence_rad  │
                        └──────────────┘        │ - address       │
                                                │ - is_active     │
                        ┌──────────────┐        └─────────────────┘
                        │leave_requests│
                        │              │
                        │ - id (PK)    │
                        │ - user_id(FK)│
                        │ - leave_type │
                        │ - start_date │
                        │ - end_date   │
                        │ - total_days │
                        │ - reason     │
                        │ - status     │
                        │ - approved_by│
                        │ - approved_at│
                        │ - admin_note │
                        └──────────────┘

┌─────────────────┐
│    settings     │
│                 │
│ - id (PK)       │
│ - late_threshold│
│ - default_radius│
│ - updated_at    │
└─────────────────┘
```

### Tables Detail

#### 1. `profiles` - Profil Pengguna
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key, FK ke auth.users |
| `full_name` | TEXT | Nama lengkap |
| `employee_id` | TEXT | ID Karyawan (unique) |
| `nik` | TEXT | NIK Karyawan |
| `email` | TEXT | Email |
| `role` | TEXT | Role user |
| `device_id` | TEXT | ID Device |
| `shift_type` | TEXT | `shifting` atau `non_shifting` |
| `is_active` | BOOLEAN | Status aktif |
| `is_owner` | BOOLEAN | Apakah owner account |
| `is_viewer` | BOOLEAN | Permission viewer |
| `can_manage_accounts` | BOOLEAN | Permission kelola akun |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

#### 2. `offices` - Lokasi Kantor
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `name` | TEXT | Nama kantor |
| `latitude` | DOUBLE PRECISION | Latitude |
| `longitude` | DOUBLE PRECISION | Longitude |
| `geofence_radius` | INTEGER | Radius geofence (meter) |
| `address` | TEXT | Alamat lengkap |
| `is_active` | BOOLEAN | Status aktif |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

#### 3. `shifts` - Shift Kerja
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `name` | TEXT | Nama shift |
| `code` | TEXT | Kode shift (unique) |
| `start_time` | TIME | Jam mulai |
| `end_time` | TIME | Jam selesai |
| `grace_period_minutes` | INTEGER | Toleransi迟到 (menit) |
| `description` | TEXT | Deskripsi |
| `is_active` | BOOLEAN | Status aktif |

**Default Shifts:**
| Code | Name | Start | End | Grace Period |
|------|------|-------|-----|--------------|
| `SHIFT_PAGI` | Shift Pagi | 08:00 | 16:00 | 15 min |
| `SHIFT_SORE` | Shift Sore | 16:00 | 00:00 | 15 min |
| `SHIFT_MALAM` | Shift Malam | 00:00 | 08:00 | 15 min |
| `NON_SHIFTING` | Non-Shifting | 08:30 | 17:30 | 30 min |

#### 4. `user_shifts` - Assignment Shift ke User
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK ke profiles |
| `shift_id` | UUID | FK ke shifts |
| `office_id` | UUID | FK ke offices |
| `effective_date` | DATE | Tanggal mulai efektif |
| `end_date` | DATE | Tanggal akhir |
| `is_active` | BOOLEAN | Status aktif |

#### 5. `attendance` - Absensi
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK ke profiles |
| `shift_id` | UUID | FK ke shifts |
| `office_id` | UUID | FK ke offices |
| `check_in_time` | TIMESTAMPTZ | Waktu check-in |
| `check_in_latitude` | DOUBLE PRECISION | Latitude check-in |
| `check_in_longitude` | DOUBLE PRECISION | Longitude check-in |
| `check_in_location_data` | JSONB | Data lokasi lengkap |
| `check_out_time` | TIMESTAMPTZ | Waktu check-out |
| `check_out_latitude` | DOUBLE PRECISION | Latitude check-out |
| `check_out_longitude` | DOUBLE PRECISION | Longitude check-out |
| `check_out_location_data` | JSONB | Data lokasi check-out |
| `is_valid` | BOOLEAN | Apakah absensi valid |
| `distance_from_office` | DOUBLE PRECISION | Jarak dari kantor |
| `is_mocked` | BOOLEAN | Apakah lokasi dimanipulasi |
| `photo_url` | TEXT | URL foto selfie saat check-in |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |

**Attendance Status:**
- `present` - Hadir tepat waktu
- `late` - Telat (melewati threshold)
- `outside_radius` - Di luar radius geofence

#### 6. `leave_requests` - Request Cuti/Izin
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK ke profiles |
| `leave_type` | TEXT | Jenis cuti/izin |
| `start_date` | DATE | Tanggal mulai |
| `end_date` | DATE | Tanggal selesai |
| `total_days` | INTEGER | Total hari |
| `reason` | TEXT | Alasan |
| `status` | TEXT | Status request |
| `approved_by` | UUID | FK approver |
| `approved_at` | TIMESTAMPTZ | Timestamp persetujuan |
| `admin_notes` | TEXT | Catatan admin |
| `admin_note` | TEXT | Catatan alternatif |
| `responded_at` | TIMESTAMPTZ | Timestamp response |
| `created_at` | TIMESTAMPTZ | Timestamp dibuat |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

**Leave Types:**
`cuti_tahunan`, `cuti_sakit`, `cuti_darurat`, `izin_tidak_hadir`, `cuti`, `izin`, `sakit`, `annual`, `sick`, `emergency`, `unpaid`

**Leave Status:**
`pending`, `approved`, `rejected`, `cancelled`

#### 7. `settings` - Pengaturan Aplikasi
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `id` | TEXT | Primary Key (default: `app_settings`) |
| `late_threshold_hour` | INTEGER | Batas jam telat (default: 9) |
| `late_threshold_minute` | INTEGER | Batas menit telat (default: 0) |
| `default_geofence_radius` | INTEGER | Radius default (default: 100m) |
| `updated_at` | TIMESTAMPTZ | Timestamp update |

---

## User Roles & Permissions

| Role | Description | Attendance | View All | Manage Users | Manage Offices | Manage Shifts | Approve Leave | Settings |
|------|-------------|:----------:|:--------:|:------------:|:-------------:|:-------------:|:-------------:|:--------:|
| `juru_parkir` | Juru Parkir (default) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `driver` | Driver | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `ob` | Office Boy | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `viewer` | Viewer Only | ✅ (own) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `admin` | Administrator | ✅ (all) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Flutter 3.0+
- Supabase account
- Git

### 1. Clone Repository
```bash
git clone <repo-url>
cd geoattend-pro
```

### 2. Setup Supabase
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Start local Supabase
supabase start
```

### 3. Run Migrations
```bash
# Apply all migrations
supabase db push

# Or apply locally
supabase db reset
```

### 4. Setup Environment Variables

**Web (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Mobile (.env):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 5. Start Development

**Web:**
```bash
cd web  # or cd into web directory
npm install
npm run dev
```

**Mobile:**
```bash
cd mobile  # or cd into mobile directory
flutter pub get
flutter run
```

---

## Migration Files

### Complete Migration Order

| File | Description | Dependencies |
|------|-------------|-------------|
| `001_create_profiles.sql` | Create profiles table & handle_new_user trigger | - |
| `002_admin_settings.sql` | Create settings table & validate_attendance_geofence | - |
| `003_create_shifts.sql` | Create shifts table | - |
| `004_create_user_shifts.sql` | Create user_shifts table | 003, 101 |
| `005_create_attendance.sql` | Create attendance table | - |
| `006_create_leave_requests.sql` | Create leave_requests table | - |
| `007_create_rls_policies.sql` | Initial RLS policies | 001, 005 |
| `008_seed_data.sql` | Seed offices & shifts data | 003, 101 |
| `009_create_functions.sql` | Geolocation functions | 101 |
| `010_create_admin_account.sql` | Create first admin account | 001 |
| `011_fix_schema_mismatches.sql` | Fix schema for Flutter compatibility | 001, 006 |
| `012_fix_auth_trigger.sql` | Fix handle_new_user trigger | 001 |
| `013_create_admin_accounts.sql` | Create 2 more admin accounts | 001 |
| `014_fix_rls_recursion.sql` | Fix RLS infinite recursion | 001, 007 |
| `015_fix_rls_policies.sql` | Recreate RLS policies | 007, 014 |
| `100_initial_schema.sql` | Initial schema (legacy) | - |
| `101_create_offices.sql` | Create offices table | - |
| `102_leave_requests.sql` | Leave requests alt version | - |
| `1005_add_selfie_attendance.sql` | Add photo_url to attendance + storage bucket selfie_absensi + RLS | 005 |
| `999_test_connection.sql` | Test connection | - |

### Key Fixes Applied

1. **RLS Infinite Recursion** (Migration 014, 015)
   - `is_admin()` query `public.profiles` causing recursion
   - Fixed by querying `auth.users.raw_user_meta_data` directly

2. **Schema Mismatches** (Migration 011)
   - Added: `total_days`, `admin_note`, `responded_at`
   - Fixed: `leave_type` values untuk compatibility dengan Flutter

3. **Trigger Conflicts** (Migration 012)
   - Default role conflict dengan CHECK constraint
   - Fixed dengan `COALESCE` untuk fallback dari metadata

---

## API Reference

### Supabase Tables

#### Attendance

```typescript
// Insert attendance
const { data, error } = await supabase
  .from('attendance')
  .insert({
    user_id: userId,
    shift_id: shiftId,
    office_id: officeId,
    check_in_time: new Date().toISOString(),
    check_in_latitude: latitude,
    check_in_longitude: longitude,
    check_in_location_data: { accuracy, altitude, speed }
  })
  .select()
  .single();

// Get user attendance history
const { data, error } = await supabase
  .from('attendance')
  .select('*')
  .eq('user_id', userId)
  .order('check_in_time', { ascending: false })
  .limit(30);

// Get all attendance (admin only)
const { data, error } = await supabase
  .from('attendance')
  .select(`
    *,
    profiles (full_name, employee_id),
    shifts (name),
    offices (name)
  `)
  .gte('check_in_time', startDate)
  .lte('check_in_time', endDate)
  .order('check_in_time', { ascending: false });
```

#### Leave Requests

```typescript
// Create leave request
const { data, error } = await supabase
  .from('leave_requests')
  .insert({
    user_id: userId,
    leave_type: 'cuti_tahunan',
    start_date: '2026-06-01',
    end_date: '2026-06-03',
    total_days: 3,
    reason: 'Liburan keluarga'
  })
  .select()
  .single();

// Get pending requests (admin)
const { data, error } = await supabase
  .from('leave_requests')
  .select(`
    *,
    profiles!user_id (full_name, employee_id)
  `)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });

// Approve/reject (admin)
const { data, error } = await supabase
  .from('leave_requests')
  .update({
    status: 'approved',
    approved_by: adminId,
    approved_at: new Date().toISOString(),
    admin_notes: 'Disetujui'
  })
  .eq('id', requestId);
```

#### Profiles

```typescript
// Get all employees (admin)
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('is_active', true)
  .order('full_name');

// Update employee role (admin)
const { data, error } = await supabase
  .from('profiles')
  .update({
    role: 'admin',
    can_manage_accounts: true
  })
  .eq('id', userId);

// Get user profile
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();
```

#### Offices & Shifts

```typescript
// Get all offices
const { data, error } = await supabase
  .from('offices')
  .select('*')
  .eq('is_active', true);

// Get all shifts
const { data, error } = await supabase
  .from('shifts')
  .select('*')
  .eq('is_active', true);

// Assign shift to user
const { data, error } = await supabase
  .from('user_shifts')
  .insert({
    user_id: userId,
    shift_id: shiftId,
    office_id: officeId,
    effective_date: new Date().toISOString().split('T')[0],
    is_active: true
  });
```

#### Settings

```typescript
// Get settings
const { data, error } = await supabase
  .from('settings')
  .select('*')
  .eq('id', 'app_settings')
  .single();

// Update settings (admin)
const { data, error } = await supabase
  .from('settings')
  .update({
    late_threshold_hour: 9,
    late_threshold_minute: 30,
    default_geofence_radius: 150
  })
  .eq('id', 'app_settings');
```

---

## Geofencing Logic

### Haversine Formula
Menghitung jarak great-circle antara 2 koordinat:

```typescript
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

### Validation Flow

```
User Location (GPS)
        │
        ▼
┌───────────────────┐
│ Calculate Distance│
│ to Office         │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ distance <= radius│
│ geofence?         │
└────────┬──────────┘
         │
    ┌────┴────┐
    │ YES     │ NO
    ▼         ▼
┌────────┐ ┌────────────────┐
│ Valid  │ │ Invalid        │
│ Check  │ │ outside_radius │
│ Time   │ │ (Cannot Clock) │
└───┬────┘ └────────────────┘
    │
    ▼
┌───────────────────┐
│ Hour > Threshold? │
│ (e.g., 9:00 AM)   │
└────────┬──────────┘
         │
    ┌────┴────┐
    │ YES     │ NO
    ▼         ▼
┌────────┐ ┌────────┐
│ Status │ │ Status │
│ "late" │ │"present"│
└────────┘ └────────┘
```

### Server-Side Validation (PostgreSQL Trigger)

```sql
CREATE OR REPLACE FUNCTION validate_attendance_geofence()
RETURNS TRIGGER AS $$
DECLARE
  office_record RECORD;
  calculated_distance DOUBLE PRECISION;
BEGIN
  -- Get office location
  SELECT * INTO office_record FROM offices LIMIT 1;
  
  -- Calculate distance using Haversine
  -- (same formula as client-side)
  
  -- Validate
  IF calculated_distance <= office_record.geofence_radius THEN
    NEW.is_valid := TRUE;
    -- Check if late
  ELSE
    NEW.is_valid := FALSE;
    NEW.status := 'outside_radius';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Admin Accounts

### Default Accounts
| Email | Password | Employee ID | Role | Full Name |
|-------|----------|-------------|------|-----------|
| `admin.ptk@gmail.com` | `AdminPTK123!` | `ADM-001` | admin | Super Admin PTK |
| `admin1@ptk.com` | `AdminPTK123!` | `ADM-002` | admin | Admin Satu |
| `admin2@ptk.com` | `AdminPTK123!` | `ADM-003` | admin | Admin Dua |

> ⚠️ **SECURITY WARNING:** Ganti password semua admin setelah login pertama kali!

---

## Security

### Row Level Security (RLS)
Semua tabel sensitif memiliki RLS enable:

| Table | User Access | Admin Access |
|-------|------------|--------------|
| `profiles` | Own profile | All profiles |
| `attendance` | Own records | All records |
| `leave_requests` | Own requests | All requests |
| `offices` | View | Full CRUD |
| `shifts` | View | Full CRUD |
| `user_shifts` | Own | All |
| `settings` | View | Full CRUD |

### Security Measures
1. **Server-side Distance Calculation** - Mencegah GPS spoofing
2. **RLS Policies** - Batasi akses data sesuai role
3. **Supabase Auth** - Email/password dengan secure session
4. **ENV Variables** - Credential tidak di-commit
5. **HTTPS Required** - Geolocation API requires secure context

### Best Practices
1. Regularly rotate Supabase API keys
2. Enable 2FA untuk admin accounts
3. Monitor `activity_logs` untuk suspicious activity
4. Set `geofence_radius` sesuai kebutuhan
5. Review RLS policies secara berkala

---

## Troubleshooting

### RLS Permission Denied
```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check current user's permissions
SELECT current_user;

-- Test is_admin() function
SELECT public.is_admin();
```

### Profile Not Created on Signup
```sql
-- Check if trigger exists
SELECT * FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Manual fix
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT id, email, raw_user_meta_data 
        FROM auth.users 
        LOOP
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

### Geofence Validation Not Working
```sql
-- Check trigger
SELECT * FROM information_schema.triggers 
WHERE event_object_table = 'attendance';

-- Check function
SELECT prosrc FROM pg_proc 
WHERE proname = 'validate_attendance_geofence';

-- Test calculation
SELECT public.calculate_distance(-6.2088, 106.8456, -6.2090, 106.8458);
```

### Attendance Status Issues
```sql
-- Check settings
SELECT * FROM settings WHERE id = 'app_settings';

-- Update threshold
UPDATE settings 
SET late_threshold_hour = 9, late_threshold_minute = 0 
WHERE id = 'app_settings';
```

### Reset All Admin Passwords
```sql
-- Generate new password hash
SELECT crypt('NewPassword123!', gen_salt('bf'));

-- Update user
UPDATE auth.users 
SET encrypted_password = '$2b$10$...' 
WHERE email = 'admin.ptk@gmail.com';
```

---

## Deployment

### Web - Vercel (Recommended)

```bash
# Build
npm run build

# Deploy via Vercel CLI
npm i -g vercel
vercel

# Or connect GitHub repository
# Push to main branch triggers auto-deploy
```

### Web - Manual Deploy

```bash
# Export static files
npm run build
# Deploy .next folder to hosting
```

### Mobile - Build APK

```bash
# Debug APK
flutter build apk

# Release APK
flutter build apk --release

# Build AAB (Play Store)
flutter build appbundle
```

### Mobile - Build iOS

```bash
# Build for simulator
flutter build ios

# Build for release
flutter build ios --release
```

### Database Migration

```bash
# Push to production
supabase db push --project-id <project-id>

# Or run via SQL Editor in Supabase Dashboard
```

---

## 🤖 AI Development Guide

### Two Apps, One Repository

Repository ini berisi **dua aplikasi** dalam satu root directory yang sharing Supabase backend:

| Application | Source Path | Framework | Config File |
|---|---|---|---|
| **Web (Next.js Admin)** | `src/` | Next.js 16 + TypeScript | `package.json` |
| **Mobile (Flutter App)** | `lib/` | Flutter + Dart | `pubspec.yaml` |

### Where to Update

| Task | Update Location |
|---|---|
| Web UI, pages, components | `src/app/`, `src/components/` |
| Web hooks, context, utils | `src/hooks/`, `src/context/`, `src/lib/` |
| Web dependencies | `package.json` (root) |
| Mobile screens, UI | `lib/screens/` |
| Mobile models, logic | `lib/models/`, `lib/services/` |
| Mobile dependencies | `pubspec.yaml` (root) |
| Database migrations | `supabase/migrations/` (shared) |
| Web environment | `.env.local` (root) |
| Mobile environment | `.env` (root) |

### Framework Path Reference

| Framework | Source Code | Config | Env File | Dev Command |
|---|---|---|---|---|
| **Next.js (Web)** | `src/` | `package.json`, `next.config.ts` | `.env.local` | `npm run dev` |
| **Flutter (Mobile)** | `lib/` | `pubspec.yaml` | `.env` | `flutter run` |

### Common AI Mistakes to Avoid

| ❌ Wrong | ✅ Correct |
|--------|----------|
| Buat file Next.js di `lib/` | Web components → `src/components/` |
| Buat file Flutter di `src/` | Mobile screens → `lib/screens/` |
| Install npm packages ke `pubspec.yaml` | Install flutter packages ke `pubspec.yaml` |
| Install flutter packages ke `package.json` | Install npm packages ke `package.json` |
| Query `public.profiles` untuk is_admin() | Query `auth.users.raw_user_meta_data` |
| Hardcode coordinates | Ambil dari `offices` table |
| Hardcode geofence radius | Ambil dari `settings` table |

### Linting & Type Checking

```bash
# Web (Next.js)
npx tsc --noEmit
npm run lint

# Mobile (Flutter)
flutter analyze
```

### Important Notes for AI

1. **Jangan campur** kode Flutter (`lib/`) dan Next.js (`src/`) — keduanya terpisah
2. **Kedua app** connect ke Supabase project yang sama
3. **Database migrations** ada di `supabase/migrations/` (shared, bukan terpisah)
4. Saat nambah kolom database baru, pastikan kedua app bisa mengaksesnya
5. Web menggunakan `src/lib/supabase.ts`, mobile menggunakan `lib/services/supabase_service.dart`
6. RLS `is_admin()` function harus query `auth.users`, bukan `public.profiles` (avoid recursion)

---

## License

© Pertamina Trans Kontinental. All rights reserved.

---

## Support

Untuk pertanyaan atau issue, hubungi:
- Email: support@ptk.co.id
- Documentation: `supabase/RND.md`
- Architecture: `docs/ARCHITECTURE.md`