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
        { error: 'Forbidden: Hanya Admin yang dapat memproses pengajuan password' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { request_id, status, admin_notes } = body;

    if (!request_id || !status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'request_id dan status (approved/rejected) wajib diisi' },
        { status: 400 }
      );
    }

    // 3. Fetch request details
    const { data: request, error: fetchReqError } = await supabaseAdmin
      .from('password_change_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (fetchReqError || !request) {
      return NextResponse.json(
        { error: 'Pengajuan tidak ditemukan' },
        { status: 404 }
      );
    }

    if (request.status !== 'pending') {
      return NextResponse.json(
        { error: 'Pengajuan sudah diproses sebelumnya' },
        { status: 400 }
      );
    }

    const { user_id, new_password } = request;

    if (status === 'approved') {
      // 4. Update password in Supabase Auth using Admin API
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        {
          password: new_password,
          user_metadata: { registered_password: new_password }
        }
      );

      if (authError) {
        return NextResponse.json(
          { error: `Gagal memperbarui auth password: ${authError.message}` },
          { status: 500 }
        );
      }

      // 5. Update registered_password in profiles table
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ registered_password: new_password, updated_at: new Date().toISOString() })
        .eq('id', user_id);

      if (profileError) {
        // Log error but continue since auth succeeded
        console.error('Failed to sync profile password:', profileError.message);
      }

      // 6. Update request status to approved
      const { error: updateReqError } = await supabaseAdmin
        .from('password_change_requests')
        .update({
          status: 'approved',
          admin_notes: admin_notes || null,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id);

      if (updateReqError) {
        return NextResponse.json(
          { error: `Gagal memperbarui status pengajuan: ${updateReqError.message}` },
          { status: 500 }
        );
      }
    } else {
      // 7. Update request status to rejected
      const { error: updateReqError } = await supabaseAdmin
        .from('password_change_requests')
        .update({
          status: 'rejected',
          admin_notes: admin_notes || null,
          rejected_by: user.id,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', request_id);

      if (updateReqError) {
        return NextResponse.json(
          { error: `Gagal memperbarui status pengajuan: ${updateReqError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Gagal memproses pengajuan' },
      { status: 500 }
    );
  }
}
