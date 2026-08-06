import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';
import { sendFcmPushNotification } from '@/lib/firebase-admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: announcementId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 1. Fetch announcement details
    const { data: announcement, error: fetchErr } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .eq('id', announcementId)
      .single();

    if (fetchErr || !announcement) {
      return NextResponse.json({ error: 'Pengumuman tidak ditemukan' }, { status: 404 });
    }

    // 2. Resolve target user IDs for FCM Push Notification
    let targetUserIds: string[] | undefined = undefined;

    if (announcement.target_type === 'USERS' && Array.isArray(announcement.target_values) && announcement.target_values.length > 0) {
      targetUserIds = announcement.target_values;
    } else if (announcement.target_type === 'DEPARTMENT' && Array.isArray(announcement.target_values) && announcement.target_values.length > 0) {
      const normalizedTargets = announcement.target_values.map((v: string) => String(v).trim().toLowerCase());
      const { data: targetUserProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, department');
      
      targetUserIds = (targetUserProfiles || [])
        .filter((p) => p.department && normalizedTargets.includes(String(p.department).trim().toLowerCase()))
        .map((p) => p.id);
    }

    // 3. Trigger Realtime FCM Push Notification (HTTP v1)
    const pushResult = await sendFcmPushNotification({
      userIds: targetUserIds,
      title: `📢 ${announcement.title}`,
      body: announcement.body,
      data: {
        announcement_id: announcement.id,
        priority: announcement.priority || 'normal',
        type: 'announcement',
      },
    });

    if (!pushResult.success) {
      return NextResponse.json({ error: pushResult.error || 'Gagal mengirim push notification' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: pushResult.count,
      message: `Push notification berhasil dikirim manual ke ${pushResult.count} perangkat.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
