import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const RETENTION_DAYS = 30;
const BUCKET_NAME = "selfie_absensi";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    let totalDeleted = 0;
    let totalBytes = 0;
    let cursor: string | undefined;

    do {
      const { data: files, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list("selfies", {
          limit: 100,
          offset: 0,
          sortBy: { column: "created_at", order: "asc" },
          ...(cursor ? { startAfter: cursor } : {}),
        });

      if (error) throw error;
      if (!files || files.length === 0) break;

      const oldFiles = files.filter(
        (f) => f.created_at && new Date(f.created_at) < cutoff
      );

      if (oldFiles.length === 0) break;

      const pathsToDelete = oldFiles.map((f) => `selfies/${f.name}`);

      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(pathsToDelete);

      if (deleteError) throw deleteError;

      totalDeleted += oldFiles.length;
      totalBytes += oldFiles.reduce((sum, f) => sum + (f.metadata?.size ?? 0), 0);

      cursor = files[files.length - 1].name;
    } while (true);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: totalDeleted,
        bytes_freed: totalBytes,
        retention_days: RETENTION_DAYS,
        bucket: BUCKET_NAME,
        message: `Deleted ${totalDeleted} selfie(s) older than ${RETENTION_DAYS} days (${(totalBytes / 1024).toFixed(1)} KB freed)`,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cleanup failed:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
