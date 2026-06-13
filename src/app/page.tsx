import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'edge';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch role from profiles table (source of truth)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const userRole = profile?.role || user.user_metadata?.role;

  if (userRole === 'admin') {
    redirect('/admin');
  } else if (userRole === 'viewer') {
    redirect('/dashboard');
  } else {
    redirect('/employee');
  }
}

