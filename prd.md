# Product Requirements Document (PRD): GeoAttend PTK

**Nama Project:** GeoAttend PTK (Pertamina Trans Kontinental Edition)
**Developer:** Muhamad Dava Rayhan
**Tech Stack:** Flutter + Supabase + Background Geolocation
**Tanggal:** Mei 2026

---

## 1. Gambaran Project

Aplikasi mobile berbasis **Geofencing** untuk absensi karyawan Pertamina Trans Kontinental (PTK). Sistem ini dirancang untuk memastikan akurasi lokasi, pencegahan manipulasi GPS (Fake GPS Detection), dan kemampuan pelacakan di latar belakang (Background Tracking) menggunakan persistent notification.

**Target Pengguna:**
- **Driver/Sopir:** Karyawan yang bekerja di lapangan
- **Juru Parkir:** Karyawan yang bertugas di area parkir
- **OB (Officer Boy):** Staff keamanan/fasilitas
- **Admin/HRD:** Manajemen dan monitoring karyawan
- **Owner:** Super admin dengan akses penuh

---

## 2. Peran & Kontrol Akses

### 2.1 Role-Based Access

| Role | Akses |
|------|-------|
| `driver` | Absensi, history, statistik, profile |
| `juru_parkir` | Absensi, history, statistik, profile |
| `ob` | Absensi, history, statistik, profile |
| `admin` | Semua akses employee + manajemen user, laporan, approve cuti |
| `owner` | Semua akses admin + manage admin, control panel |

### 2.2 Fitur Berdasarkan Role

**Employee (driver, juru_parkir, ob):**
- Check-in/check-out dengan validasi geofence
- Lihat jarak ke titik kantor secara real-time
- Riwayat absensi pribadi
- Statistik bulanan dengan grafik
- Pengajuan cuti/izin/sakit
- Profile management
- Biometric login (fingerprint/face ID)

**Admin:**
- Dashboard attendance real-time
- Manajemen user (approve, deactivate, reset password)
- Manajemen lokasi kantor (geofence)
- Approval cuti/izin
- Laporan attendance dengan export PDF
- Audit log attendance
- Monitoring background tracking
- Notifikasi push configuration

**Owner:**
- Promote/demote admin roles
- Owner control panel

---

## 3. Spesifikasi Teknis

### 3.1 Frontend (Flutter)

**Dependencies:**
```
flutter_background_geolocation: ^5.1.2     # Background tracking
geolocator: ^14.0.2                        # GPS akurasi tinggi
supabase_flutter: ^2.12.4                  # Database & Auth
latlong2: ^0.9.1                           # Komputasi koordinat
flutter_map: ^7.0.2                        # Map display (Leaflet)
provider: ^6.1.2                           # State management
local_auth: ^2.3.0                         # Biometric auth
flutter_local_notifications: ^18.0.1       # Local notifications
shared_preferences: ^2.3.4                # Local storage
sqflite: ^2.4.2                           # SQLite untuk offline
connectivity_plus: ^6.1.4                 # Network monitoring
pdf: ^3.10.8                               # PDF generation
printing: ^5.12.0                         # Print/share PDF
share_plus: ^12.0.2                        # Share functionality
path_provider: ^2.1.4                     # File system access
intl: ^0.20.2                             # Date/time formatting
```

### 3.2 Backend (Supabase)

**Project URL:** `https://yoykktgggvvoigrbtvhq.supabase.co`

**Fitur:**
- Email & Password authentication
- Google OAuth integration
- PostgreSQL database dengan RLS (Row Level Security)
- Edge Functions (Deno) configured

### 3.3 Arsitektur Aplikasi

```
┌─────────────────────────────────────────────────────────┐
│                    Flutter App                          │
├─────────────────────────────────────────────────────────┤
│  Presentation Layer (Screens)                           │
│  ├── Auth: ShiftSelection, Login, Registration         │
│  ├── User: Dashboard, History, Stats, Profile, Leave   │
│  └── Admin: Management screens, Reports                 │
├─────────────────────────────────────────────────────────┤
│  Business Logic Layer (Services)                        │
│  ├── AuthService        - Authentication & Profile      │
│  ├── LocationService    - GPS & Background Tracking     │
│  ├── SyncService        - Offline Support & Sync        │
│  ├── BiometricService   - Fingerprint/Face ID Auth      │
│  ├── NotificationService - Push Notifications           │
│  ├── ReportService      - PDF Generation                │
│  └── HolidayService    - Indonesian Holidays            │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                             │
│  ├── Models: ProfileModel, AttendanceModel,             │
│  │          LeaveRequestModel                           │
│  ├── LocalDatabase (SQLite) - Offline Cache             │
│  └── Supabase Client - Remote Database                 │
├─────────────────────────────────────────────────────────┤
│  Infrastructure                                         │
│  ├── Provider (ThemeManager)                            │
│  ├── Supabase Backend (Auth + Database)                │
│  └── Geolocator + Background Geolocation                │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Schema Database

### 4.1 Tabel `profiles`

| Column | Type | Deskripsi |
|--------|------|-----------|
| `id` | UUID | PK, FK ke `auth.users` |
| `full_name` | TEXT | Nama lengkap |
| `employee_id` | TEXT | NIK Karyawan |
| `nik` | TEXT | - |
| `email` | TEXT | Dari auth.users |
| `role` | TEXT | `driver`, `juru_parkir`, `ob`, `admin`, `viewer` |
| `device_id` | TEXT | Device binding |
| `shift_type` | TEXT | `shifting`, `non_shifting` |
| `is_active` | BOOLEAN | Perlu approve admin |
| `is_owner` | BOOLEAN | Super admin flag |
| `is_viewer` | BOOLEAN | Read-only mode |
| `can_manage_accounts` | BOOLEAN | User management permission |
| `created_at` | TIMESTAMPTZ | - |
| `updated_at` | TIMESTAMPTZ | - |

### 4.2 Tabel `offices`

| Column | Type | Deskripsi |
|--------|------|-----------|
| `id` | UUID | PK |
| `name` | TEXT | Nama kantor |
| `latitude` | DOUBLE | Koordinat GPS |
| `longitude` | DOUBLE | Koordinat GPS |
| `geofence_radius` | INTEGER | Radius dalam meter (default: 100) |
| `address` | TEXT | Alamat lengkap |
| `is_active` | BOOLEAN | Status aktif |
| `created_at` | TIMESTAMPTZ | - |
| `updated_at` | TIMESTAMPTZ | - |

**Seed Data:**
- Kantor Pusat PTK: -6.2088, 106.8456, radius 100m

### 4.3 Tabel `shifts`

| Column | Type | Deskripsi |
|--------|------|-----------|
| `id` | UUID | PK |
| `name` | TEXT | Nama shift |
| `code` | TEXT | UNIQUE (e.g., `SHIFT_PAGI`) |
| `start_time` | TIME | Jam mulai |
| `end_time` | TIME | Jam selesai |
| `grace_period_minutes` | INTEGER | Toleransi telat (default: 15) |
| `description` | TEXT | Deskripsi |
| `is_active` | BOOLEAN | Status aktif |

### 4.4 Tabel `user_shifts`

| Column | Type | Deskripsi |
|--------|------|-----------|
| `id` | UUID | PK |
| `user_id` | UUID | FK ke `profiles` |
| `shift_id` | UUID | FK ke `shifts` |
| `office_id` | UUID | FK ke `offices` |
| `effective_date` | DATE | Tanggal mulai |
| `end_date` | DATE | NULL = indefinite |
| `is_active` | BOOLEAN | Status aktif |

### 4.5 Tabel `attendance`

| Column | Type | Deskripsi |
|--------|------|-----------|
| `id` | UUID | PK |
| `user_id` | UUID | FK ke `profiles` |
| `shift_id` | UUID | FK ke `shifts` |
| `office_id` | UUID | FK ke `offices` |
| `check_in_time` | TIMESTAMPTZ | Waktu check-in |
| `check_in_latitude` | DOUBLE | Koordinat check-in |
| `check_in_longitude` | DOUBLE | - |
| `check_in_accuracy` | DOUBLE | Akurasi GPS |
| `check_in_location_data` | JSONB | Raw GPS data |
| `check_out_time` | TIMESTAMPTZ | Waktu check-out (nullable) |
| `check_out_latitude` | DOUBLE | - |
| `check_out_longitude` | DOUBLE | - |
| `check_out_accuracy` | DOUBLE | - |
| `check_out_location_data` | JSONB | - |
| `is_valid` | BOOLEAN | Validitas absensi |
| `distance_from_office` | DOUBLE | Jarak dari kantor (meter) |
| `is_mocked` | BOOLEAN | Fake GPS terdeteksi |
| `created_at` | TIMESTAMPTZ | - |

### 4.6 Tabel `leave_requests`

| Column | Type | Deskripsi |
|--------|------|-----------|
| `id` | UUID | PK |
| `user_id` | UUID | FK ke `profiles` |
| `leave_type` | TEXT | `cuti`, `izin`, `sakit` |
| `start_date` | DATE | Tanggal mulai |
| `end_date` | DATE | Tanggal selesai |
| `reason` | TEXT | Alasan |
| `status` | TEXT | `pending`, `approved`, `rejected` |
| `approved_by` | UUID | FK ke `profiles` (nullable) |
| `approved_at` | TIMESTAMPTZ | (nullable) |
| `admin_notes` | TEXT | Catatan admin (nullable) |
| `created_at` | TIMESTAMPTZ | - |
| `updated_at` | TIMESTAMPTZ | - |

---

## 5. Functional Requirements

### 5.1 Background Service & Tracking

**Foreground Service:**
- Aplikasi menjalankan service di latar belakang
- Persistent notification yang tidak dapat dihapus user
- Auto-start on boot (configurable)

**Motion Detection:**
- Menggunakan sensor akselerometer untuk mendeteksi pergerakan fisik
- Memvalidasi perpindahan koordinat GPS sinkron dengan pergerakan perangkat

**Heartbeat System:**
- Ping lokasi ke server setiap 5 menit dalam mode aktif
- Log heartbeat di dashboard admin

### 5.2 Geofencing Logic

**Haversine Formula:**
- Perhitungan jarak antara User (lat1, lon1) dan Kantor (lat2, lon2)
- Dilakukan di client untuk feedback UI
- Divalidasi ulang di server (Supabase)

**Radius Check:**
- Tombol absensi hanya aktif jika `distance <= geofence_radius`
- Default radius: 100 meter (bisa diubah per office)

### 5.3 Anti-Fraud & Security

**Mock Location Detection:**
- Mendeteksi jika fitur "Allow Mock Locations" aktif
- Jika terdeteksi, akses absensi diblokir
- Notifikasi alert saat fake GPS terdeteksi

**Device ID Binding:**
- Satu akun hanya bisa absen di satu perangkat terdaftar
- Tracking device_id per user

**Biometric Authentication:**
- Fingerprint/Face ID untuk login
- Credential storage untuk quick login
- Toggle on/off di settings

**Email Validation:**
- Hanya menerima email `@gmail.com`
- Validasi format email saat registration

### 5.4 Offline Support

**Local Database (SQLite):**
- Menyimpan attendance record saat offline
- Cache profile untuk akses offline
- Pending queue untuk sync

**Sync Service:**
- Auto-sync setiap 5 menit ke Supabase
- Connectivity monitoring (online/offline)
- Queue management untuk unsynchronized records

---

## 6. UI/UX Flow

### 6.1 Authentication Flow

```
1. App Launch -> ShiftSelectionScreen (landing)
   ├── Shifting -> LoginScreen
   └── Non-Shifting -> LoginScreen

2. LoginScreen
   ├── Email/Password -> Supabase Auth
   ├── Google OAuth -> Supabase Auth
   ├── Biometric -> Stored credentials
   └── Register -> RegistrationScreen

3. RegistrationScreen
   ├── Isi form (email, password, name, employee_id, role, shift_type)
   ├── Submit -> Supabase creates user + auto-create profile
   ├── is_active = false (requires admin approval)

4. Admin activates -> User can login
```

### 6.2 Main User Flow

```
1. Login -> AuthWrapper checks role
   ├── Admin/Owner -> AdminScreen
   └── Driver/Juru Parkir/OB -> DashboardScreen

2. DashboardScreen
   ├── Map display (Leaflet) dengan lokasi user & kantor
   ├── Real-time distance indicator
   ├── Check-in button (enabled jika dalam radius)
   ├── Check-out button (jika sudah check-in)
   ├── Status: "Dalam area" / "Di luar area" / "Fake GPS terdeteksi"
   └── Background tracking aktif

3. Navigation
   ├── History -> Riwayat absensi pribadi
   ├── Statistics -> Statistik bulanan dengan grafik
   ├── Leave Request -> Pengajuan cuti/izin/sakit
   ├── Profile -> Settings, theme, biometric, password
   └── Logout
```

### 6.3 Admin Flow

```
1. AdminScreen -> Grid menu
   ├── Dashboard -> Real-time attendance overview
   ├── User Management -> Manage users (approve, deactivate, reset)
   ├── Office Management -> Tambah/edit lokasi kantor
   ├── Leave Requests -> Approve/reject cuti
   ├── Attendance Reports -> Report dengan PDF export
   ├── Audit Log -> Detail attendance audit trail
   ├── Background Tracking -> Monitor tracking service
   ├── Notification Settings -> Push notification config
   ├── Manage Admins -> Promote/demote admin (Owner only)
   └── Owner Control Panel -> Owner settings
```

---

## 7. Screens Reference

### 7.1 Auth Screens

| Screen | File | Deskripsi |
|--------|------|-----------|
| ShiftSelectionScreen | `lib/screens/shift_selection_screen.dart` | Landing - pilih shifting/non-shifting |
| LoginScreen | `lib/screens/login_screen.dart` | Login dengan email, Google, biometric |
| RegistrationScreen | `lib/screens/registration_screen.dart` | Registrasi dengan role selection |

### 7.2 User Screens

| Screen | File | Deskripsi |
|--------|------|-----------|
| DashboardScreen | `lib/screens/dashboard_screen.dart` | Main attendance dengan map, check-in/out |
| HistoryScreen | `lib/screens/history_screen.dart` | Riwayat absensi pribadi |
| StatisticsScreen | `lib/screens/statistics_screen.dart` | Statistik bulanan dengan grafik |
| ProfileScreen | `lib/screens/profile_screen.dart` | Profile, theme, biometric, password |
| LeaveRequestScreen | `lib/screens/leave_request_screen.dart` | Pengajuan cuti/izin/sakit |
| LeaveHistoryScreen | `lib/screens/leave_history_screen.dart` | History status pengajuan |

### 7.3 Admin Screens

| Screen | File | Deskripsi |
|--------|------|-----------|
| AdminScreen | `lib/screens/admin_screen.dart` | Main admin dashboard - grid menu |
| AdminDashboard | `lib/screens/admin_dashboard.dart` | Real-time attendance overview |
| AdminUserList | `lib/screens/admin_user_list.dart` | Manage users |
| AdminAttendanceReport | `lib/screens/admin_attendance_report.dart` | Report dengan PDF export |
| AdminLeaveScreen | `lib/screens/admin_leave_screen.dart` | Approve/reject leave requests |
| OfficeManagement | `lib/screens/office_management.dart` | Manage office locations |
| AttendanceAuditLog | `lib/screens/attendance_audit_log.dart` | Audit trail |
| BackgroundTrackingScreen | `lib/screens/background_tracking_screen.dart` | Monitor tracking |
| NotificationSettingsScreen | `lib/screens/notification_settings_screen.dart` | Push notification config |
| ManageAdminsScreen | `lib/screens/manage_admins_screen.dart` | Promote/demote admin |
| OwnerControlPanel | `lib/screens/owner_control_panel.dart` | Owner-level controls |

---

## 8. Services Reference

| Service | File | Fungsi |
|---------|------|--------|
| AuthService | `lib/services/auth_service.dart` | Login, register, profile, role management |
| LocationService | `lib/services/location_service.dart` | Background tracking, mock detection, heartbeat |
| SyncService | `lib/services/sync_service.dart` | Offline support, auto-sync, connectivity |
| BiometricService | `lib/services/biometric_service.dart` | Fingerprint/Face ID |
| NotificationService | `lib/services/notification_service.dart` | Local notifications |
| ReportService | `lib/services/report_service.dart` | PDF generation, share |
| HolidayService | `lib/services/holiday_service.dart` | Indonesian holidays 2024-2026 |
| PushNotificationService | `lib/services/push_notification_service.dart` | Push notifications |

---

## 9. Database Functions

### 9.1 Auto-create Profile on Signup

```sql
Trigger: on_auth_user_created
Event: AFTER INSERT ON auth.users
Action: Insert into public.profiles dengan role default 'juru_parkir', is_active = false
```

### 9.2 Auto-update Timestamp

```sql
Trigger: {table}_updated_at
Event: BEFORE UPDATE
Action: NEW.updated_at = NOW()
```

### 9.3 Helper Functions

```sql
public.calculate_distance(lat1, lon1, lat2, lon2)  -- Haversine, returns meters
public.is_within_geofence(user_lat, user_lon, office_id)  -- Returns boolean
public.is_admin()  -- admin role + is_active OR is_owner
public.is_owner_user()  -- is_owner = true
public.is_viewer()  -- viewer role OR admin OR owner
```

---

## 10. Row Level Security (RLS)

Semua tabel memiliki RLS aktif. Policies utama:

### 10.1 Profiles

| Operation | Access |
|-----------|--------|
| SELECT (own) | `auth.uid() = id` |
| SELECT (all) | `is_admin() OR is_viewer()` |
| UPDATE (own) | Limited fields only |
| UPDATE (admin) | `is_admin()` |
| INSERT | `is_admin()` |
| DELETE | `is_owner_user() AND is_active = false` |

### 10.2 Attendance

| Operation | Access |
|-----------|--------|
| SELECT (own) | `auth.uid() = user_id` |
| INSERT (own) | Mobile check-in only |
| UPDATE (own) | `auth.uid() = user_id AND check_out_time IS NULL` |
| SELECT (admin) | `is_admin() OR is_viewer()` |
| UPDATE (admin) | `is_admin()` (corrections) |

### 10.3 Leave Requests

| Operation | Access |
|-----------|--------|
| SELECT (own) | `auth.uid() = user_id` |
| INSERT (own) | Any authenticated user |
| UPDATE (own) | `auth.uid() = user_id AND status = 'pending'` |
| SELECT (admin) | `is_admin() OR is_viewer()` |
| UPDATE (admin) | `is_admin()` (approve/reject) |

---

## 11. Indonesian Holidays (2024-2026)

HolidayService menyediakan data libur nasional Indonesia untuk kalkulasi hari kerja:

**2024:**
- Tahun Baru Masehi (1 Jan)
- Isra Mikraj Nabi (8 Feb)
- Nyepi (11 Mar)
- Wafat Isa Al-Masih (29 Mar)
- Hari Raya Idulfitri (8-9 Apr)
- Hari Buruh (1 Mei)
- Kenaikan Isa Al-Masih (9 Mei)
- Hari Raya Waisak (23 Mei)
- Maulid Nabi (12 Sep)
- Hari Proklamasi Kemerdekaan (17 Agt)
- Hari Raya Natal (25 Des)

**2025-2026:** Pre-loaded dalam HolidayService

**Fungsi:**
- `isHoliday(DateTime date)` -> bool
- `getWorkingDays(startDate, endDate)` -> int
- Exclude weekends dan holidays dari kalkulasi

---

## 12. Acceptance Criteria

### 12.1 Core Functionality

- [ ] User bisa login dengan email/password
- [ ] User bisa login dengan Google OAuth
- [ ] User bisa login dengan biometric (fingerprint/face ID)
- [ ] Admin bisa approve/deactivate user
- [ ] Check-in hanya aktif dalam radius geofence
- [ ] Check-out hanya aktif jika sudah check-in
- [ ] Fake GPS detection memblokir absensi

### 12.2 Background Tracking

- [ ] Service berjalan di background
- [ ] Persistent notification tampil
- [ ] Heartbeat ping setiap 5 menit
- [ ] Auto-start on boot berfungsi

### 12.3 Geofencing

- [ ] Jarak real-time tampil di dashboard
- [ ] Haversine calculation akurat
- [ ] Radius check berfungsi
- [ ] Admin bisa atur radius per office

### 12.4 Offline Support

- [ ] Absensi tersimpan saat offline
- [ ] Auto-sync saat online
- [ ] Pending queue dikelola dengan benar

### 12.5 Admin Features

- [ ] Dashboard menampilkan attendance real-time
- [ ] Report bisa export PDF
- [ ] Leave request bisa approve/reject
- [ ] Audit log lengkap

### 12.6 Security

- [ ] Mock location detection aktif
- [ ] Device ID binding berfungsi
- [ ] RLS policies applied
- [ ] Email validation (@gmail.com only)

---

## 13. File Structure

```
D:\Web-Client\Pertamina\
├── prd.md                          # Dokumentasi ini
├── pubspec.yaml                    # Flutter dependencies
├── lib/
│   ├── main.dart                   # App entry point, Supabase init
│   ├── screens/                   # All screens
│   │   ├── shift_selection_screen.dart
│   │   ├── login_screen.dart
│   │   ├── registration_screen.dart
│   │   ├── dashboard_screen.dart
│   │   ├── history_screen.dart
│   │   ├── statistics_screen.dart
│   │   ├── profile_screen.dart
│   │   ├── leave_request_screen.dart
│   │   ├── leave_history_screen.dart
│   │   ├── admin_screen.dart
│   │   ├── admin_dashboard.dart
│   │   ├── admin_user_list.dart
│   │   ├── admin_attendance_report.dart
│   │   ├── admin_leave_screen.dart
│   │   ├── office_management.dart
│   │   ├── attendance_audit_log.dart
│   │   ├── background_tracking_screen.dart
│   │   ├── notification_settings_screen.dart
│   │   ├── manage_admins_screen.dart
│   │   └── owner_control_panel.dart
│   ├── services/                   # All services
│   │   ├── auth_service.dart
│   │   ├── location_service.dart
│   │   ├── sync_service.dart
│   │   ├── biometric_service.dart
│   │   ├── notification_service.dart
│   │   ├── report_service.dart
│   │   ├── holiday_service.dart
│   │   └── push_notification_service.dart
│   ├── models/                     # Data models
│   │   ├── profile_model.dart
│   │   ├── attendance_model.dart
│   │   └── leave_request_model.dart
│   ├── db/
│   │   └── local_database.dart    # SQLite schema
│   └── theme/
│       ├── app_theme.dart
│       └── theme_manager.dart
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 001_create_profiles.sql
│       ├── 002_create_offices.sql
│       ├── 003_create_shifts.sql
│       ├── 004_create_user_shifts.sql
│       ├── 005_create_attendance.sql
│       ├── 006_create_leave_requests.sql
│       ├── 007_create_rls_policies.sql
│       ├── 008_seed_data.sql
│       └── 009_create_functions.sql
├── android/                       # Android native config
├── ios/                            # iOS native config
└── README.md
```

---

## 14. Migration Order

| # | File | Purpose |
|---|------|---------|
| 1 | 001_create_profiles.sql | User profiles |
| 2 | 002_create_offices.sql | Office locations |
| 3 | 003_create_shifts.sql | Shift definitions |
| 4 | 004_create_user_shifts.sql | User-shift assignments |
| 5 | 005_create_attendance.sql | Attendance records |
| 6 | 006_create_leave_requests.sql | Leave requests |
| 7 | 007_create_rls_policies.sql | Security policies |
| 8 | 008_seed_data.sql | Initial data (offices, shifts) |
| 9 | 009_create_functions.sql | Helper functions & triggers |