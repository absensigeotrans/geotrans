# ✅ Schema Mismatch Fix — Selesai

**Proyek:** Flutter `geo_attend_ptk` ↔ Supabase (`supabase/migrations/`)  
**Status:** ✅ SEMUA FIX SELESAI

---

## 🔍 Analisis Awal

Flutter app punya **proyek Supabase sendiri** dengan schema yang sudah benar:

| Migration | Status | Cocok dengan Flutter? |
|---|---|---|
| `001_create_profiles.sql` | ✅ | `employee_id`, `shift_type`, `is_active` ✅ |
| `005_create_attendance.sql` | ✅ | `check_in_latitude`, `is_mocked` dll ✅ |
| `006_create_leave_requests.sql` | ⚠️ | 5 mismatch (lihat bawah) |

---

## ✅ Perbaikan di Migration 011

### 1. `handle_new_user()` trigger — ✅ FIXED
- **Before:** Hanya baca `full_name`, set role hardcoded `'juru_parkir'`
- **After:** Baca `employee_id`, `role`, `shift_type` dari `raw_user_meta_data`

### 2. `leave_requests` — tambah `total_days` ✅
- Kolom `total_days INTEGER DEFAULT 1` ditambahkan

### 3. `leave_requests` — tambah `admin_note` (singular) ✅
- Kolom `admin_note TEXT` ditambahkan (disamping `admin_notes` yang sudah ada)

### 4. `leave_requests` — tambah `responded_at` ✅
- Kolom `responded_at TIMESTAMPTZ` ditambahkan (disamping `approved_at`)

### 5. `leave_requests` — status check constraint ✅
- **Before:** `CHECK (status IN ('pending', 'approved', 'rejected'))`
- **After:** `CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))`

### 6. `leave_requests` — leave_type check constraint ✅
- **Before:** `CHECK (leave_type IN ('cuti', 'izin', 'sakit'))`
- **After:** Menerima semua nilai dari Flutter (`cuti_tahunan`, `cuti_sakit`, `cuti_darurat`, `izin_tidak_hadir`) + nilai lama

---

## 📋 File yang Dibuat/Diubah

| File | Action |
|---|---|
| `supabase/migrations/011_fix_schema_mismatches.sql` | ✅ **BARU** — Migration fix |

**Tidak ada perubahan di Flutter code** — semua error di sisi database, bukan di kode Flutter.

---

## 🧪 Verifikasi

```bash
npx tsc --noEmit          # Next.js — ✅ 0 error
flutter analyze lib/      # Flutter — jalankan setelah setup
```
