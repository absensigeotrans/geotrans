import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: userFetchError } = await supabase.auth.getUser();

    if (userFetchError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Harap login terlebih dahulu' },
        { status: 401 }
      );
    }

    // 2. Check if user is admin
    const { data: profile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileFetchError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Hanya Admin yang dapat membuat akun karyawan baru' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, password, full_name, nik, employee_id, role, shift_type } = body;

    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'Email, password, full_name, dan role wajib diisi' },
        { status: 400 }
      );
    }

    // 1. Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah digunakan oleh pengguna lain' },
        { status: 409 }
      );
    }

    // Check if employee_id (NIK) already exists
    if (employee_id) {
      const { data: existingNik } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('employee_id', employee_id)
        .maybeSingle();

      if (existingNik) {
        return NextResponse.json(
          { error: 'NIK/ID Karyawan sudah terdaftar' },
          { status: 409 }
        );
      }
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        employee_id: employee_id || null,
        nik: nik || null,
        shift_type: shift_type || null,
        registered_password: password,
      },
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Gagal membuat user' },
        { status: 500 }
      );
    }

    // 3. Create profile (trigger handle_new_user should auto-create, but ensure it's there)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: email.toLowerCase(),
        full_name,
        role,
        shift_type: shift_type || null,
        nik: nik || null,
        employee_id: employee_id || null,
        registered_password: password,
        is_active: true,
      }, { onConflict: 'id' });

    if (profileError) {
      // Try to clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Karyawan ${full_name} berhasil dibuat`,
      userId: authData.user.id,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Gagal membuat karyawan' },
      { status: 500 }
    );
  }
}
