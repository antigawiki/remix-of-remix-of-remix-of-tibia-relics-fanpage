import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.tibiarelic.com/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Starting snapshot-xp job...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all vocations to get full player list (API returns 100 per call)
    const vocations = ["All", "Knights", "Paladins", "Sorcerers", "Druids"];
    const playerMap = new Map<string, { name: string; profession: string; level: number; experience: number }>();

    for (const vocation of vocations) {
      try {
        const apiUrl = `${API_BASE}/Highscores?worldName=Relic&category=Experience&vocation=${vocation}`;
        const response = await fetch(apiUrl, {
          headers: { "Accept": "application/json" },
        });

        if (!response.ok) {
          console.warn(`API returned ${response.status} for vocation ${vocation}`);
          continue;
        }

        const data = await response.json();
        const highscores = data.highscores || [];

        for (const player of highscores) {
          if (!playerMap.has(player.name)) {
            playerMap.set(player.name, {
              name: player.name,
              profession: player.profession,
              level: player.level,
              experience: player.skillLevel,
            });
          }
        }

        // Small delay between vocation requests
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.warn(`Error fetching vocation ${vocation}:`, err);
      }
    }

    if (playerMap.size === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No data received from API" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const capturedAt = new Date().toISOString();
    const records = Array.from(playerMap.values()).map((p) => ({
      player_name: p.name,
      profession: p.profession,
      level: p.level,
      experience: p.experience,
      captured_at: capturedAt,
    }));

    console.log(`Saving ${records.length} player snapshots at ${capturedAt}`);

    // Insert in batches of 100
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("xp_snapshots").insert(batch);
      if (error) {
        console.error(`Batch insert error:`, error);
      } else {
        totalInserted += batch.length;
      }
    }

    // Cleanup: keep only last 24 hours of intraday snapshots
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("xp_snapshots").delete().lt("captured_at", oneDayAgo);

    console.log(`Done. Inserted ${totalInserted} records.`);

    return new Response(
      JSON.stringify({ success: true, players: totalInserted, capturedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
