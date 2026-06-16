const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://yoykktgggvvoigrbtvhq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlveWtrdGdnZ3Z2b2lncmJ0dmhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU0NzkzNSwiZXhwIjoyMDk0MTIzOTM1fQ.p2aP2UhsAelZgJbaCioJUr4_fVZkLC0HPoc3mshH_yQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("=== REMOTE TRIGGER DEFINITION ===");
    const { data, error } = await supabase.rpc('pg_get_functiondef_wrapper', {}); // wait, RPC wrapper might not exist.
    // Instead of RPC, we can just execute sql if we have postgres access, but supabase client does not allow raw sql unless we have an RPC.
    // Let's check if there is a way to query via postgres. Oh, Supabase JS client doesn't support raw SQL by default unless there's an RPC.
    // Wait, is there an RPC like pg_get_functiondef or similar? No, by default not.
    // But we can check the status of Kahfi's check-in again.
    
    // Let's run a query to get the details of Kahfi's check-in log and print the logs for attendance.
    console.log("=== KAHFI ATTENDANCE LOG ===");
    const { data: logs, error: err } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', '7a050329-a5a5-49b9-a7a6-de7fffe2a2f2')
      .order('check_in_time', { ascending: false });
    if (err) throw err;
    console.log(JSON.stringify(logs, null, 2));

  } catch (err) {
    console.error("Error:", err);
  }
}

run();
