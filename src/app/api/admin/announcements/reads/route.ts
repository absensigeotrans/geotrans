import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const announcementId = searchParams.get('id');

    if (!announcementId) {
      return NextResponse.json({ error: 'ID Pengumuman wajib diberikan' }, { status: 400 });
    }

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
      return NextResponse.json({ error: 'Forbidden: Akses admin diperlukan' }, { status: 403 });
    }

    // 1. Fetch announcement info
    const { data: announcement, error: annError } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .eq('id', announcementId)
      .single();

    if (annError || !announcement) {
      return NextResponse.json({ error: 'Pengumuman tidak ditemukan' }, { status: 404 });
    }

    // 2. Fetch all active employees
    const { data: allProfiles, error: empError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, department, nik')
      .neq('role', 'inactive')
      .order('full_name', { ascending: true });

    if (empError) {
      return NextResponse.json({ error: empError.message }, { status: 500 });
    }

    // Filter employees based on target_type
    let targetEmployees = allProfiles || [];
    if (announcement.target_type === 'DEPARTMENT' && Array.isArray(announcement.target_values) && announcement.target_values.length > 0) {
      targetEmployees = targetEmployees.filter((p) =>
        announcement.target_values.includes(p.department) || announcement.target_values.includes(p.role)
      );
    } else if (announcement.target_type === 'USERS' && Array.isArray(announcement.target_values) && announcement.target_values.length > 0) {
      targetEmployees = targetEmployees.filter((p) => announcement.target_values.includes(p.id));
    }

    // 3. Fetch read records for this announcement
    const { data: reads } = await supabaseAdmin
      .from('announcement_reads')
      .select('user_id, read_at')
      .eq('announcement_id', announcementId);

    const readMap = new Map<string, string>();
    reads?.forEach((r) => {
      readMap.set(r.user_id, r.read_at);
    });

    // 4. Combine employee list with read status
    const employeeStatus = targetEmployees.map((emp) => {
      const readAt = readMap.get(emp.id);
      return {
        ...emp,
        department: emp.department || emp.role || '-',
        is_read: !!readAt,
        read_at: readAt || null,
      };
    });

    const totalCount = targetEmployees.length;
    const readCount = employeeStatus.filter((e) => e.is_read).length;
    const readPercentage = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

    return NextResponse.json({
      announcement,
      stats: {
        total_employees: totalCount,
        read_count: readCount,
        unread_count: totalCount - readCount,
        read_percentage: readPercentage,
      },
      employees: employeeStatus,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
