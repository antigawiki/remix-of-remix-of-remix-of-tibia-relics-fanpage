import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.tibiarelic.com/api";
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get distinct players from last 7 days
    const { data: players, error: playersError } = await supabase
      .from("online_tracker_sessions")
      .select("player_name")
      .gte("login_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (playersError) throw playersError;

    // Deduplicate
    const uniqueNames = [...new Set(players?.map((p) => p.player_name) ?? [])];
    console.log(`Found ${uniqueNames.length} unique players to check`);

    let totalInserted = 0;
    let totalErrors = 0;

    // Process in batches
    for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
      const batch = uniqueNames.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (name) => {
          try {
            const charUrl = `${API_BASE}/Community/character/by-name?name=${encodeURIComponent(name)}`;
            const resp = await fetch(charUrl, {
              headers: { Accept: "application/json" },
              signal: AbortSignal.timeout(8000),
            });

            if (!resp.ok) {
              console.warn(`Failed to fetch ${name}: HTTP ${resp.status}`);
              return 0;
            }

            const charData = await resp.json();
            const deaths = charData?.deaths;

            if (!deaths || !Array.isArray(deaths) || deaths.length === 0) {
              return 0;
            }

            // Prepare rows for upsert
            const rows = deaths.map((d: any) => ({
              player_name: name,
              death_timestamp: d.timestamp,
              level: d.level ?? 0,
              killers: d.killers ?? [],
            }));

            const { data, error } = await supabase
              .from("player_deaths")
              .upsert(rows, { onConflict: "player_name,death_timestamp", ignoreDuplicates: true });

            if (error) {
              console.warn(`Upsert error for ${name}:`, error.message);
              return 0;
            }

            return rows.length;
          } catch (e) {
            console.warn(`Error processing ${name}:`, e);
            return 0;
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") totalInserted += r.value;
        else totalErrors++;
      }

      // Delay between batches
      if (i + BATCH_SIZE < uniqueNames.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    console.log(`Done. Processed ${uniqueNames.length} players. Inserted/updated: ${totalInserted}, errors: ${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        playersChecked: uniqueNames.length,
        deathsProcessed: totalInserted,
        errors: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
