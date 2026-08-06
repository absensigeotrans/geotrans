import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';
import { sendFcmPushNotification } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch announcements
    const { data: announcements, error } = await supabaseAdmin
      .from('announcements')
      .select(`
        *,
        profiles:author_id (full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 2. Fetch all read records to calculate exact read count per announcement
    const { data: allReads } = await supabaseAdmin
      .from('announcement_reads')
      .select('announcement_id');

    const readCountMap = new Map<string, number>();
    allReads?.forEach((r) => {
      readCountMap.set(r.announcement_id, (readCountMap.get(r.announcement_id) || 0) + 1);
    });

    // 3. Fetch active profiles to compute exact target count per announcement
    const { data: allProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, department')
      .neq('role', 'inactive');

    const totalActiveProfiles = allProfiles?.length || 0;

    const formatted = (announcements || []).map((item: any) => {

      let targetCount = totalActiveProfiles;

      if (item.target_type === 'DEPARTMENT' && Array.isArray(item.target_values) && item.target_values.length > 0) {
        targetCount = allProfiles?.filter((p) => item.target_values.includes(p.department)).length || 0;
      } else if (item.target_type === 'USERS' && Array.isArray(item.target_values)) {
        targetCount = item.target_values.length;
      }

      return {
        ...item,
        author_name: item.profiles?.full_name || 'Admin',
        read_count: readCountMap.get(item.id) || 0,
        total_targets: targetCount,
      };
    });

    return NextResponse.json({ data: formatted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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

    const body = await req.json();
    const { title, message, priority, target_type, target_values, expires_at } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Judul dan isi pesan wajib diisi' }, { status: 400 });
    }

    // 1. Insert announcement into Supabase DB
    const { data: announcement, error: insertError } = await supabaseAdmin
      .from('announcements')
      .insert({
        title,
        body: message,
        priority: priority || 'normal',
        target_type: target_type || 'ALL',
        target_values: target_values || [],
        author_id: user.id,
        expires_at: expires_at || null,
      })
      .select()
      .single();

    if (insertError || !announcement) {
      return NextResponse.json({ error: `Gagal menyimpan pengumuman: ${insertError?.message}` }, { status: 500 });
    }

    // 2. Resolve target user IDs for FCM Push Notification
    let targetUserIds: string[] | undefined = undefined;

    if (target_type === 'USERS' && Array.isArray(target_values) && target_values.length > 0) {
      targetUserIds = target_values;
    } else if (target_type === 'DEPARTMENT' && Array.isArray(target_values) && target_values.length > 0) {
      const normalizedTargets = target_values.map((v: string) => String(v).trim().toLowerCase());
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
      title: `📢 ${title}`,
      body: message,
      data: {
        announcement_id: announcement.id,
        priority: priority || 'normal',
        type: 'announcement',
      },
    });

    return NextResponse.json({
      success: true,
      announcement,
      pushSent: pushResult.success,
      pushCount: pushResult.count,
      pushNotice: pushResult.success
        ? `Pengumuman terbuat & push notification terkirim ke ${pushResult.count} perangkat.`
        : `Pengumuman terbuat, namun gagal push: ${pushResult.error}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Gagal memproses' }, { status: 500 });
  }
}

