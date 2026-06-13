# Push Migration ke Supabase

Step-by-step push migration lokal ke Supabase database.

## Prasyarat

- Supabase CLI sudah terinstall (`npx supabase --version`)
- Sudah login sekali (`npx supabase login`)
- Project sudah di-link (`npx supabase link`)

## Step (setiap kali ada migrasi baru)

```bash
# 1. Masuk ke project
cd "D:/new pertamna"

# 2. Push semua migrasi yang pending
npx supabase db push --include-all
```

## Setup Awal (cukup sekali)

Kalau clone repo baru atau first time:

```bash
# 1. Login dengan Personal Access Token
# Token: https://supabase.com/dashboard/account/tokens
npx supabase login --token "sbp_xxxxxxxxxxxxxxxx"

# 2. Link ke project
npx supabase link --project-ref yoykktgggvvoigrbtvhq

# 3. Push migrasi
npx supabase db push --include-all
```

## Notes

- **Database password** akan diminta saat `link` atau `push`.
  Cek/reset di: **Supabase Dashboard → Project Settings → Database → Database password**

- Token login tersimpan di `~/.supabase/`, jadi cukup generate sekali.

- Kalau error `Found local migration files to be inserted before the last migration`, jalankan dengan `--include-all`.

---

## Deploy & Setup Selfie Cleanup (Edge Function)

Edge Function `cleanup_old_selfies` otomatis menghapus foto selfie >30 hari dari storage.

### 1. Generate CRON_SECRET

```bash
# Generate random secret untuk keamanan endpoint
openssl rand -hex 32
# Atau pakai: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Deploy Edge Function

```bash
# Deploy function ke Supabase
npx supabase functions deploy cleanup_old_selfies --no-verify-jwt

# Set secret (ganti YOUR_CRON_SECRET dengan hasil generate di atas)
npx supabase secrets set CRON_SECRET=YOUR_CRON_SECRET
```

### 3. Setup Cron Job (cron-job.org — FREE)

1. Buka [cron-job.org](https://cron-job.org) → Register/Login
2. Buat cron job baru:
   - **URL:** `https://yoykktgggvvoigrbtvhq.supabase.co/functions/v1/cleanup_old_selfies`
   - **Method:** `POST`
   - **Headers:**
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
     ```
   - **Schedule:** Setiap hari (`Every day` atau `*/5 * * * *` untuk setiap 5 menit — cukup 1×/hari)
3. Save

### 4. Verifikasi

Cek logs di Supabase Dashboard → **Edge Functions** → `cleanup_old_selfies` → **Logs** untuk melihat hasil eksekusi.
