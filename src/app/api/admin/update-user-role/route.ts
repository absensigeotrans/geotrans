import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';
import { sendFcmPushNotification } from '@/lib/firebase-admin';

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
        { error: 'Forbidden: Hanya Admin yang dapat mengubah data karyawan' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { user_id, role, full_name, shift_type, password } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id wajib diisi' },
        { status: 400 }
      );
    }

    // 3. Update profiles table
    const profileUpdates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (role !== undefined) profileUpdates.role = role;
    if (full_name !== undefined) profileUpdates.full_name = full_name;
    if (shift_type !== undefined) profileUpdates.shift_type = shift_type;
    if (password !== undefined && password !== '') {
      profileUpdates.registered_password = password;
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', user_id);

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 }
      );
    }

    // 3.5. Update user_shift_schedules for today to match the new shift type
    if (shift_type !== undefined) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      if (shift_type === 'non_shifting' || shift_type === null || shift_type === '') {
        // Delete today's schedule if shifting is disabled
        const { error: deleteShiftError } = await supabaseAdmin
          .from('user_shift_schedules')
          .delete()
          .eq('user_id', user_id)
          .eq('schedule_date', today);

        if (deleteShiftError) {
          console.error('Failed to delete today schedule:', deleteShiftError);
        }
      } else if (shift_type === 'morning' || shift_type === 'afternoon' || shift_type === 'full_time') {
        // Upsert today's schedule with the new shift type
        const { error: upsertShiftError } = await supabaseAdmin
          .from('user_shift_schedules')
          .upsert({
            user_id: user_id,
            schedule_date: today,
            shift_type: shift_type,
          }, { onConflict: 'user_id,schedule_date' });

        if (upsertShiftError) {
          console.error('Failed to upsert today schedule:', upsertShiftError);
        }
      }
    }

    // 4. Update auth.users if role or password changed
    const authUpdates: any = {};
    const userMetadata: any = {};
    if (role) userMetadata.role = role;
    if (password !== undefined && password !== '') {
      authUpdates.password = password;
      userMetadata.registered_password = password;
    }
    if (Object.keys(userMetadata).length > 0) {
      authUpdates.user_metadata = userMetadata;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        authUpdates
      );

      if (authError) {
        return NextResponse.json(
          { error: authError.message },
          { status: 500 }
        );
      }
    }

    // Send Push Notification if role was updated
    if (role) {
      const roleLabel = role === 'driver_bebas' ? 'Driver Bebas' : role === 'juru_parkir' ? 'Juru Parkir' : 'Karyawan';
      await sendFcmPushNotification({
        userIds: [user_id],
        title: 'ℹ️ Perubahan Peran/Role Akun',
        body: `Peran akun Anda telah diperbarui menjadi ${roleLabel} oleh Admin.`,
        data: { type: 'role_update', role },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Gagal update data karyawan' },
      { status: 500 }
    );
  }
}


