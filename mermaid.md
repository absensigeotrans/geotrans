# Activity Diagram & Database ERD — GeoAttend Pro

## 1. Activity Diagram — Alur Absensi Karyawan (dengan Database)

```mermaid
flowchart TD
    Start([Mulai]) --> BukaApp[Buka Aplikasi]
    BukaApp --> PilihShift{Pilih Shift}
    PilihShift -->|Shifting| ShiftScreen[Pilih: Pagi / Sore]
    PilihShift -->|Non-Shifting| Langsung
    ShiftScreen --> Login
    Langsung[Lanjut ke Login] --> Login

    Login{Login Method}
    Login -->|Email & Password| AuthEmail[Auth via Supabase]
    Login -->|Biometric| AuthBio[Auth via Fingerprint/FaceID]
    AuthEmail --> ReadAuthDB{Read:}
    AuthBio --> ReadAuthDB
    ReadAuthDB --> ReadAuthUsers[(auth\_users)]
    ReadAuthUsers --> LoadProfile

    LoadProfile[Load Profile] --> ReadProfiles{Read:}
    ReadProfiles --> ReadProfileDB[(profiles)]

    ReadProfileDB --> CekAktif{Akun Aktif?}
    CekAktif -->|Tidak| Blokir[Tampilkan Pesan Blokir]
    CekAktif -->|Ya| Dashboard

    Dashboard[Dashboard Load] --> GpsStart[Start GPS Tracking]
    GpsStart --> ReadOffices{Read:}
    ReadOffices --> ReadOfficeDB[(offices)]
    ReadOfficeDB --> ReadUserShifts{Read:}
    ReadUserShifts --> ReadUserShiftDB[(user\_shifts)]
    ReadUserShiftDB --> ReadShifts{Read:}
    ReadShifts --> ReadShiftDB[(shifts)]

    ReadShiftDB --> RenderMap[Render Map: User + Office + Geofence Circle]
    RenderMap --> HitungJarak[Hitung Jarak Haversine]
    HitungJarak --> CekGeofence{ Jarak <= Radius Geofence? }

    CekGeofence -->|Ya| EnableBtn[Enable Tombol Check-In]
    CekGeofence -->|Tidak| DisableBtn[Disable Tombol + Tampilkan Jarak]

    EnableBtn --> TapCheckIn{Tap Check-In?}
    TapCheckIn -->|Ya| BukaKamera[Buka Kamera Depan Auto-Capture]
    TapCheckIn -->|Tidak| EnableBtn
    BukaKamera --> Kompres[Kompres Gambar <50KB]
    Kompres --> UploadSelfie{Upload:}
    UploadSelfie --> UploadStorage[Storage Bucket: selfie\_absensi]

    UploadStorage --> InsertCheckIn{INSERT:}
    InsertCheckIn --> WriteAttendance[(attendance)]

    WriteAttendance --> TriggerGeofence[Trigger: validate\_attendance\_geofence]
    TriggerGeofence --> HitungServer[Hitung Jarak Server-side Haversine]
    HitungServer --> SetStatus{Tentukan Status}
    SetStatus -->|Tepat Waktu & Dalam Radius| Present[Status: present]
    SetStatus -->|Terlambat & Dalam Radius| Late[Status: late]
    SetStatus -->|Luar Radius| Outside[Status: outside\_radius]

    Present --> WriteLogA{INSERT:}
    Late --> WriteLogA
    Outside --> WriteLogA
    WriteLogA --> WriteLogDB[(attendance\_logs)]

    WriteLogDB --> Aktifitas[Masa Kerja]

    Aktifitas --> TapCheckOut{Tap Check-Out?}
    TapCheckOut -->|Ya| InsertCheckOut{UPDATE:}
    TapCheckOut -->|Tidak| Aktifitas
    InsertCheckOut --> UpdateAttendance[(attendance)]

    UpdateAttendance --> TriggerOvertime[Trigger: Hitung Overtime & Durasi]
    TriggerOvertime --> WriteLogB{INSERT:}
    WriteLogB --> WriteLogDB2[(attendance\_logs)]
    WriteLogDB2 --> End([Selesai])

    DisableBtn --> CekGeofence
    Blokir --> End
```

## 2. Activity Diagram — Alur Cuti/Izin (dengan Database)

```mermaid
flowchart TD
    Mulai([Mulai]) --> BukaLeave[Buka Menu Leave Request]
    BukaLeave --> IsiForm[Isi Tanggal & Alasan]
    IsiForm --> Submit[Submit ke Supabase]

    Submit --> InsertLeave{INSERT:}
    InsertLeave --> WriteLeaveDB[(leave\_requests)]

    WriteLeaveDB --> BacaNotif{Read: profiles}
    BacaNotif --> ReadAdminProfiles[(profiles)]

    ReadAdminProfiles --> NotifAdmin[Notifikasi Admin via Dashboard]

    NotifAdmin --> AdminReview{Admin Review}
    AdminReview -->|Setuju| Approve{UPDATE:}
    AdminReview -->|Tolak| Reject{UPDATE:}

    Approve --> UpdateLeaveApprove[(leave\_requests)]
    Reject --> UpdateLeaveReject[(leave\_requests)]

    UpdateLeaveApprove --> NotifKaryawan[Notifikasi Karyawan]
    UpdateLeaveReject --> NotifKaryawan
    NotifKaryawan --> Selesai([Selesai])
```

## 3. Activity Diagram — Alur Admin Dashboard (dengan Database)

```mermaid
flowchart TD
    Mulai([Mulai]) --> Login[Login Web Admin]
    Login --> ReadAuth{Read:}
    ReadAuth --> ReadAuthDB[(auth\_users)]

    ReadAuthDB --> LoadProfile{Read:}
    LoadProfile --> ReadProfileDB[(profiles)]

    ReadProfileDB --> CekRole{Check Role}
    CekRole -->|Admin| AdminDash[Dashboard Admin]
    CekRole -->|Viewer| ViewerDash[Dashboard Viewer]
    CekRole -->|Inactive| Tolak[Tolak Akses]

    AdminDash --> PilihMenu{Pilih Menu}

    PilihMenu -->|Dashboard Utama| DashStats{Read:}
    DashStats --> ReadAttStat[(attendance)]
    DashStats --> ReadProfStat[(profiles)]
    ReadAttStat & ReadProfStat --> ShowDash[Lihat Statistik + Feed Aktivitas]
    ShowDash --> AutoRefresh[Auto-refresh tiap 30 detik]
    AutoRefresh --> DashStats

    PilihMenu -->|Karyawan| KelolaKaryawan{CRUD:}
    KelolaKaryawan --> CRUDProfile[(profiles)]

    PilihMenu -->|Kantor| KelolaKantor{CRUD:}
    KelolaKantor --> CRUDOffice[(offices)]

    PilihMenu -->|Shift| KelolaShift{CRUD:}
    KelolaShift --> CRUDShift[(shifts)]
    KelolaShift --> CRUDUserShift[(user\_shifts)]

    PilihMenu -->|Cuti| BacaCuti{Read:}
    BacaCuti --> ReadLeave[(leave\_requests)]
    ReadLeave --> ApproveCuti{UPDATE:}
    ApproveCuti --> UpdateLeave[(leave\_requests)]

    PilihMenu -->|Laporan| BacaLaporan{Read:}
    BacaLaporan --> ReadAttReport[(attendance)]
    BacaLaporan --> ReadProfReport[(profiles)]
    BacaLaporan --> ReadOffReport[(offices)]
    ReadAttReport & ReadProfReport & ReadOffReport --> ExportReport[Generate Laporan + Export CSV/PDF]

    PilihMenu -->|Monitoring| ReadMonitoring{Read:}
    ReadMonitoring --> ReadAttMon[(attendance)]
    ReadAttMon --> Monitor[Lihat Karyawan Aktif Real-time]
    Monitor --> AutoRefresh2[Auto-refresh tiap 30 detik]
    AutoRefresh2 --> ReadMonitoring

    PilihMenu -->|Settings| CRUDSettings{CRUD:}
    CRUDSettings --> ReadWriteSettings[(settings)]

    ViewerDash --> PilihViewer{Pilih Menu}
    PilihViewer -->|Dashboard| DashViewer{Read:}
    DashViewer --> ReadAttView[(attendance)]
    PilihViewer -->|Monitoring| MonitorViewer{Read:}
    MonitorViewer --> ReadAttMonView[(attendance)]

    CRUDProfile --> Selesai([Kembali])
    CRUDOffice --> Selesai
    CRUDShift --> Selesai
    CRUDUserShift --> Selesai
    UpdateLeave --> Selesai
    ExportReport --> Selesai
    ReadAttView --> Selesai
    ReadAttMonView --> Selesai
    Tolak --> End([Selesai])
```

## 4. Database ERD

```mermaid
erDiagram
    profiles ||--o{ attendance : "has"
    profiles ||--o{ leave_requests : "submits"
    profiles ||--o{ user_shifts : "assigned"
    profiles }|--|| auth_users : "is"

    offices ||--o{ attendance : "at"
    offices ||--o{ user_shifts : "located_at"

    shifts ||--o{ attendance : "during"
    shifts ||--o{ user_shifts : "defined_by"

    attendance ||--o{ attendance_logs : "logs"

    profiles {
        uuid id PK "Primary Key (FK->auth.users)"
        text full_name "Nama Lengkap"
        text employee_id "NIP / ID Karyawan"
        text nik "NIK KTP"
        text email "Email"
        enum_role role "driver_bebas|driver_kantor|juru_parkir|ob|admin|viewer|inactive"
        enum_shift shift_type "shifting|non_shifting"
        boolean is_active "Status Aktif"
        boolean is_owner "Pemilik Sistem"
        text device_id "ID Perangkat Terdaftar"
        boolean can_manage_accounts "Izin Kelola Akun"
        timestamptz created_at "Dibuat"
        timestamptz updated_at "Diupdate"
    }

    offices {
        uuid id PK "Primary Key"
        text name "Nama Kantor"
        numeric latitude "Latitude"
        numeric longitude "Longitude"
        numeric geofence_radius "Radius Geofence (meter)"
        text address "Alamat"
        boolean is_active "Status Aktif"
        timestamptz created_at "Dibuat"
        timestamptz updated_at "Diupdate"
    }

    shifts {
        uuid id PK "Primary Key"
        text name "Nama Shift"
        text code UK "Kode Shift (unik)"
        time start_time "Jam Mulai"
        time end_time "Jam Selesai"
        integer grace_period_minutes "Toleransi Keterlambatan"
        boolean is_active "Status Aktif"
        timestamptz created_at "Dibuat"
        timestamptz updated_at "Diupdate"
    }

    attendance {
        uuid id PK "Primary Key"
        uuid user_id FK "FK -> profiles.id"
        uuid shift_id FK "FK -> shifts.id"
        uuid office_id FK "FK -> offices.id"
        timestamptz check_in_time "Waktu Check-in"
        timestamptz check_out_time "Waktu Check-out"
        numeric check_in_lat "Latitude Check-in"
        numeric check_in_lon "Longitude Check-in"
        numeric check_out_lat "Latitude Check-out"
        numeric check_out_lon "Longitude Check-out"
        jsonb check_in_location_data "Data Lokasi Check-in"
        jsonb check_out_location_data "Data Lokasi Check-out"
        boolean is_valid "Valid Hasil Geofence"
        boolean is_mocked "Terdeteksi Mock Location"
        numeric distance_from_office "Jarak dari Kantor (meter)"
        enum_status status "present|late|outside_radius"
        text photo_url "URL Selfie"
        integer overtime_minutes "Lembur (menit)"
        integer work_duration_minutes "Durasi Kerja (menit)"
        timestamptz created_at "Dibuat"
        timestamptz updated_at "Diupdate"
    }

    leave_requests {
        uuid id PK "Primary Key"
        uuid user_id FK "FK -> profiles.id"
        enum_leave leave_type "cuti_tahunan|sakit|izin|darurat|cuti_besar|cuti_melahirkan|cuti_alasan_penting"
        date start_date "Tanggal Mulai"
        date end_date "Tanggal Akhir"
        integer total_days "Total Hari"
        text reason "Alasan"
        enum_req status "pending|approved|rejected|cancelled"
        uuid approved_by FK "FK -> profiles.id (Admin)"
        text admin_notes "Catatan Admin"
        timestamptz responded_at "Waktu Respon"
        timestamptz created_at "Dibuat"
        timestamptz updated_at "Diupdate"
    }

    user_shifts {
        uuid id PK "Primary Key"
        uuid user_id FK "FK -> profiles.id"
        uuid shift_id FK "FK -> shifts.id"
        uuid office_id FK "FK -> offices.id"
        date effective_date "Tanggal Efektif"
        date end_date "Tanggal Berakhir"
        boolean is_active "Status Aktif"
        timestamptz created_at "Dibuat"
        timestamptz updated_at "Diupdate"
    }

    settings {
        text id PK "'app_settings' (Singleton)"
        integer late_threshold_hour "Jam Batas Terlambat"
        integer late_threshold_minute "Menit Batas Terlambat"
        integer default_geofence_radius "Radius Default (meter)"
        timestamptz updated_at "Diupdate"
    }

    attendance_logs {
        uuid id PK "Primary Key"
        uuid attendance_id FK "FK -> attendance.id"
        text action "Aksi (check_in/check_out/validated)"
        jsonb details "Detail Log"
        timestamptz created_at "Dibuat"
    }

    auth_users {
        uuid id PK "Primary Key (auth.users Supabase)"
        text email "Email"
        text encrypted_password "Password Hash"
        timestamptz created_at "Dibuat"
        timestamptz updated_at "Diupdate"
    }
```

## 5. Class Diagram — Domain Models & Database Entities

```mermaid
classDiagram
    class Profile {
        +UUID id
        +String full_name
        +String employee_id
        +String nik
        +String email
        +Enum role
        +Enum shift_type
        +Boolean is_active
        +Boolean is_owner
        +String device_id
        +Boolean can_manage_accounts
        +DateTime created_at
        +DateTime updated_at
        +fromJson() Profile
        +toJson() Map
    }

    class Office {
        +UUID id
        +String name
        +Float latitude
        +Float longitude
        +Float geofence_radius
        +String address
        +Boolean is_active
        +DateTime created_at
        +DateTime updated_at
        +fromJson() Office
        +toJson() Map
    }

    class Shift {
        +UUID id
        +String name
        +String code
        +Time start_time
        +Time end_time
        +Integer grace_period_minutes
        +Boolean is_active
        +DateTime created_at
        +DateTime updated_at
    }

    class Attendance {
        +UUID id
        +UUID user_id
        +UUID shift_id
        +UUID office_id
        +DateTime check_in_time
        +DateTime check_out_time
        +Float check_in_lat
        +Float check_in_lon
        +Float check_out_lat
        +Float check_out_lon
        +JSON check_in_location_data
        +JSON check_out_location_data
        +Boolean is_valid
        +Boolean is_mocked
        +Float distance_from_office
        +Enum status
        +String photo_url
        +Integer overtime_minutes
        +Integer work_duration_minutes
        +DateTime created_at
        +DateTime updated_at
        +fromJson() Attendance
        +toJson() Map
    }

    class LeaveRequest {
        +UUID id
        +UUID user_id
        +Enum leave_type
        +Date start_date
        +Date end_date
        +Integer total_days
        +String reason
        +Enum status
        +UUID approved_by
        +String admin_notes
        +DateTime responded_at
        +DateTime created_at
        +DateTime updated_at
        +fromMap() LeaveRequest
        +toMap() Map
    }

    class UserShift {
        +UUID id
        +UUID user_id
        +UUID shift_id
        +UUID office_id
        +Date effective_date
        +Date end_date
        +Boolean is_active
        +DateTime created_at
        +DateTime updated_at
    }

    class Settings {
        +String id
        +Integer late_threshold_hour
        +Integer late_threshold_minute
        +Integer default_geofence_radius
        +DateTime updated_at
    }

    class AttendanceLog {
        +UUID id
        +UUID attendance_id
        +String action
        +JSON details
        +DateTime created_at
    }

    class SelfieResult {
        +String photo_url
        +String local_file_path
        +Boolean is_online
    }

    Profile "1" --> "*" Attendance : has
    Profile "1" --> "*" LeaveRequest : submits
    Profile "1" --> "*" UserShift : assigned
    Office "1" --> "*" Attendance : at
    Office "1" --> "*" UserShift : located_at
    Shift "1" --> "*" Attendance : during
    Shift "1" --> "*" UserShift : defined_by
    Attendance "1" --> "*" AttendanceLog : logs
```

## 6. Class Diagram — Flutter App (Services & Screens)

```mermaid
classDiagram
    class AuthService {
        -SupabaseClient _supabase
        -User _user
        -Map _profile
        -bool _isLoading
        +get user
        +get profile
        +get isLoading
        +signUp() String?
        +signIn() String?
        +resetPassword() String?
        +updateProfile() String?
        +changePassword() String?
        +signOut() void
        +refreshProfile() void
    }

    class LocationService {
        -bool _isTracking
        -double _currentDistance
        -bool _isInRadius
        -bool _isMocked
        -bool _permissionDenied
        -bg.Location _currentLocation
        +calculateDistance() double
        +updateDistance() void
        +startTracking() void
        +stopTracking() void
        +requestPermission() bool
        +_detectMockLocation() bool
    }

    class OfficeService {
        -SupabaseClient _supabase
        -double _latitude
        -double _longitude
        -double _radius
        -String _name
        -bool _isLoading
        +get isReady
        +fetchOffice() void
    }

    class SyncService {
        -SupabaseClient _supabase
        -DatabaseHelper _db
        -StreamSubscription _connectivitySubscription
        -Timer _syncTimer
        -bool _isOnline
        -bool _isSyncing
        -int _pendingCount
        +saveAttendanceOffline() bool
        +updateAttendanceOffline() bool
        +forceSync() bool
        +toggleAutoSync() void
        +get formattedLastSync
        +getTodayAttendance() List
    }

    class LeaveService {
        -SupabaseClient _supabase
        -List~LeaveRequest~ _leaveList
        -bool _isLoading
        +fetchLeaveRequests() void
        +submitLeaveRequest() bool
        +cancelLeaveRequest() bool
        +approveLeave() bool
        +rejectLeave() bool
        +get pendingCount
        +get approvedCount
    }

    class AdminService {
        -SupabaseClient _supabase
        -List~Map~ pendingUsers
        -List~Map~ activeUsers
        -bool _isLoading
        +fetchAllUsers() void
        +toggleUserActive() bool
        +approveUser() bool
        +deactivateUser() bool
        +get pendingCount
        +get activeCount
    }

    class BiometricService {
        +isBiometricAvailable() bool
        +hasEnrolledBiometrics() bool
        +authenticate() bool
        +saveCredentials() void
        +clearCredentials() void
        +getSavedCredentials() Map
    }

    class ShiftScheduleService {
        +getTodayShift() String?
        +hasSelectedShiftToday() bool
        +selectShift() bool
        +getShiftForDate() String?
        +getShiftHistory() List
    }

    class SelfieService {
        +getFrontCamera() CameraDescription
        +compressImage() String
        +uploadPhoto() String
        +captureAndUpload() SelfieResult
        +uploadLocalPhoto() String
    }

    class NotificationService {
        +initialize() bool
        +requestPermissions() bool
        +showCheckInSuccess() void
        +showCheckOutSuccess() void
        +showAttendanceSavedOffline() void
        +showLateNotification() void
        +showMockLocationAlert() void
        +scheduleCheckInReminder() void
        +scheduleCheckOutReminder() void
    }

    class ReportService {
        +generateAttendancePdf() void$
    }

    class DatabaseHelper {
        -static DatabaseHelper instance$
        -static Database _database$
        +get database
        +insertPendingAttendance() int
        +getPendingAttendances() List
        +updatePendingAttendance() int
        +getPendingCount() int
        +insertSyncLog() int
        +setState() void
        +getState() String?
        +clearAllData() void
    }

    class DashboardScreen {
        -MapController _mapController
        -double _officeLat
        -double _officeLon
        -double _radius
        -bool _isProcessing
        -Map _todayAttendance
        -String _todayShift
        -Timer _distanceUpdateTimer
        +_loadOffice() void
        +_loadUserData() void
        +_handleAttendance() void
        +_fetchTodayAttendance() void
    }

    class LoginScreen {
        +_handleLogin() void
        +_handleBiometric() void
    }

    class LeaveRequestScreen {
        +_submitLeave() void
    }

    class AdminScreen {
        +_approveUser() void
        +_deactivateUser() void
    }

    class SelfieCameraOverlay {
        -CameraController _controller
        -bool _isProcessing
        -int _countdown
        -AnimationController _animController
        +_initCamera() void
        +_startCountdown() void
        +_captureAndProcess() void
    }

    class AuthWrapper {
        +build() Widget
    }

    AuthService <|-- ChangeNotifier : extends
    LocationService <|-- ChangeNotifier : extends
    OfficeService <|-- ChangeNotifier : extends
    SyncService <|-- ChangeNotifier : extends
    LeaveService <|-- ChangeNotifier : extends
    AdminService <|-- ChangeNotifier : extends

    SyncService --> DatabaseHelper : uses
    SyncService --> SelfieService : uses
    SyncService --> NotificationService : uses
    LeaveService --> NotificationService : uses

    DashboardScreen --> AuthService : uses
    DashboardScreen --> LocationService : uses
    DashboardScreen --> OfficeService : uses
    DashboardScreen --> SyncService : uses
    DashboardScreen --> ShiftScheduleService : uses
    DashboardScreen --> SelfieService : uses
    DashboardScreen --> NotificationService : uses

    LoginScreen --> AuthService : uses
    LoginScreen --> BiometricService : uses

    LeaveRequestScreen --> LeaveService : uses

    AdminScreen --> AdminService : uses
    AdminScreen --> AuthService : uses

    AuthWrapper --> DashboardScreen : routes to
    AuthWrapper --> AdminScreen : routes to
    AuthWrapper --> LoginScreen : routes to
    LoginScreen --> RegistrationScreen : navigates to
    DashboardScreen --> HistoryScreen : navigates to
    DashboardScreen --> StatisticsScreen : navigates to
    DashboardScreen --> ProfileScreen : navigates to
    DashboardScreen --> LeaveRequestScreen : navigates to
```

## 7. Class Diagram — Next.js Web App (Hooks, Components & Pages)

```mermaid
classDiagram
    class AuthProvider {
        +User user
        +Profile profile
        +Boolean loading
        +signIn() Promise
        +signUp() Promise
        +signOut() Promise
        +refreshProfile() Promise
    }

    class useAuth {
        <<hook>>
        +user
        +profile
        +loading
        +signIn()
        +signUp()
        +signOut()
        +refreshProfile()
    }

    class useAttendance {
        <<hook>>
        +Attendance todayAttendance
        +List~Attendance~ history
        +Boolean loading
        +String error
        +clockIn() Promise
        +clockOut() Promise
        +fetchTodayAttendance() Promise
        +fetchHistory() Promise
    }

    class useAttendanceRate {
        <<hook>>
        +List~EmployeeStat~ stats
        +Boolean loading
        +Period period
        +Float avgRate
        +EmployeeStat mostLate
        +EmployeeStat bestAttendee
        +Int totalAbsent
    }

    class useDashboardAnalytics {
        <<hook>>
        +DashboardAnalytics data
        +Boolean loading
        +Period period
        +refresh() Promise
    }

    class useEmployees {
        <<hook>>
        +List~Profile~ employees
        +Boolean loading
        +fetchEmployees() Promise
        +updateEmployee() Promise
        +toggleRole() Promise
        +createEmployee() Promise
        +deactivateEmployee() Promise
    }

    class useReports {
        <<hook>>
        +List~AttendanceWithProfile~ records
        +Boolean loading
        +fetchReport() Promise
        +fetchDashboardData() Promise
        +getStats() Object
        +getEmployeeSummary() Object
        +deleteByDate() Promise
    }

    class useOffices {
        <<hook>>
        +List~Office~ offices
        +Office currentOffice
        +Boolean loading
        +fetchOffices() Promise
        +createOffice() Promise
        +updateOffice() Promise
        +deleteOffice() Promise
    }

    class useLeaveRequests {
        <<hook>>
        +List~LeaveRequest~ requests
        +Boolean loading
        +fetchRequests() Promise
        +approveLeave() Promise
        +rejectLeave() Promise
        +createLeave() Promise
        +cancelLeave() Promise
    }

    class useActivityLogs {
        <<hook>>
        +List~AttendanceLog~ logs
        +Boolean loading
        +fetchLogs() Promise
    }

    class useAdminSettings {
        <<hook>>
        +AdminSettings settings
        +Boolean synced
        +Boolean loading
        +List~ShiftConfig~ shifts
        +syncFromDB() Promise
        +updateSettings() Promise
        +resetSettings() Promise
        +fetchShifts() Promise
        +updateShift() Promise
    }

    class Button {
        +String variant
        +String size
        +Boolean loading
        +onClick() void
    }

    class StatsCard {
        +Icon icon
        +String value
        +String label
        +Float trend
        +String color
    }

    class Badge {
        +String variant
        +String text
    }

    class Modal {
        +Boolean isOpen
        +Function onClose
        +String title
        +String size
    }

    class Table {
        +List~Column~ columns
        +List~Object~ data
        +Boolean loading
        +String sortKey
        +String sortDir
        +onSort() void
        +onRowClick() void
    }

    class Sidebar {
        +Boolean open
        +onClose() void
    }

    class AdminLayout {
        +children ReactNode
    }

    class AdminDashboard {
        +useAttendance()
        +useOffices()
        +useEmployees()
        +useReports()
        +useDashboardAnalytics()
    }

    class EmployeesPage {
        +useEmployees()
    }

    class OfficesPage {
        +useOffices()
    }

    class ReportsPage {
        +useReports()
    }

    class LeaveRequestsPage {
        +useLeaveRequests()
    }

    class MonitoringPage {
        +supabase realtime
    }

    class SettingsPage {
        +useAdminSettings()
    }

    useAuth <|-- AuthProvider : implements
    AuthProvider --> supabase : uses
    AuthProvider --> supabaseAdmin : uses

    AdminDashboard --> useAttendance : uses
    AdminDashboard --> useOffices : uses
    AdminDashboard --> useEmployees : uses
    AdminDashboard --> useReports : uses
    AdminDashboard --> useDashboardAnalytics : uses

    EmployeesPage --> useEmployees : uses
    OfficesPage --> useOffices : uses
    ReportsPage --> useReports : uses
    LeaveRequestsPage --> useLeaveRequests : uses
    SettingsPage --> useAdminSettings : uses

    AdminLayout --> Sidebar : contains
    AdminLayout --> AdminDashboard : renders
    AdminLayout --> EmployeesPage : routes
    AdminLayout --> OfficesPage : routes
    AdminLayout --> ReportsPage : routes
    AdminLayout --> LeaveRequestsPage : routes
    AdminLayout --> MonitoringPage : routes
    AdminLayout --> SettingsPage : routes

    Button <-- AdminDashboard : uses
    StatsCard <-- AdminDashboard : uses
    Badge <-- AdminDashboard : uses
    Modal <-- EmployeesPage : uses
    Modal <-- OfficesPage : uses
    Table <-- ReportsPage : uses
    Table <-- EmployeesPage : uses
```

## 8. Diagram Alur Validasi Geofence (Server-side Trigger)

```mermaid
flowchart TD
    Start([INSERT / UPDATE attendance]) --> Trigger[Trigger: validate\_attendance\_geofence]
    Trigger --> CekRole{Check Role Karyawan}

    CekRole -->|driver\_bebas| BypassGeofence[Skip Validasi Geofence]
    CekRole -->|driver\_kantor / juru\_parkir / ob| HitungJarak[Hitung Haversine Distance]

    BypassGeofence --> CekTelatBebas{Cek Waktu vs Shift}
    CekTelatBebas -->|Tepat Waktu| SetPresentBebas[SET status = present]
    CekTelatBebas -->|Terlambat| SetLateBebas[SET status = late]

    HitungJarak --> CekRadius{ distance <= geofence\_radius? }

    CekRadius -->|Ya, Dalam Radius| CekTelat{Cek Waktu vs Shift + Grace Period}
    CekRadius -->|Tidak, Luar Radius| SetOutside[SET status = outside\_radius, is\_valid = false]

    CekTelat -->|Tepat Waktu| SetPresent[SET status = present, is\_valid = true]
    CekTelat -->|Terlambat| SetLate[SET status = late, is\_valid = true]

    SetPresent --> WriteLog{INSERT:}
    SetLate --> WriteLog
    SetOutside --> WriteLog
    SetPresentBebas --> WriteLog
    SetLateBebas --> WriteLog

    WriteLog --> WriteLogDB[(attendance\_logs)]

    WriteLogDB --> Selesai([Selesai])
```
