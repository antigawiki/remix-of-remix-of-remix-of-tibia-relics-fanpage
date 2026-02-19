import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { table, rows } = await req.json();

  try {
    let result;

    if (table === "sessions") {
      result = await supabase.from("online_tracker_sessions").upsert(
        rows.map((r: Record<string, string>) => ({
          id: r.id,
          player_name: r.player_name,
          login_at: r.login_at,
          logout_at: r.logout_at || null,
          created_at: r.created_at,
        })),
        { onConflict: "id" }
      );
    } else if (table === "highscores") {
      result = await supabase.from("highscore_snapshots").upsert(
        rows.map((r: Record<string, string>) => ({
          id: r.id,
          snapshot_date: r.snapshot_date,
          player_name: r.player_name,
          profession: (!r.profession || r.profession === "None") ? null : r.profession,
          level: r.level ? parseInt(r.level) : null,
          experience: r.experience ? parseInt(r.experience) : null,
          created_at: r.created_at,
        })),
        { onConflict: "id" }
      );
    } else {
      return new Response(JSON.stringify({ error: "Invalid table" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (result.error) {
      console.error("Upsert error:", result.error);
      return new Response(JSON.stringify({ error: result.error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ success: true, inserted: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
