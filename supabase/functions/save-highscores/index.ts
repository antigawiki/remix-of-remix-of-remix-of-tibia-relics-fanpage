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
    console.log("Starting save-highscores job...");

    // Fetch top 100 players from Tibia Relic API
    const apiUrl = `${API_BASE}/Highscores?worldName=Relic&category=Experience&vocation=All`;
    console.log(`Fetching: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    const highscores = data.highscores || [];

    if (highscores.length === 0) {
      console.log("No highscores data received");
      return new Response(
        JSON.stringify({ success: false, message: "No highscores data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Received ${highscores.length} players`);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in UTC
    const today = new Date().toISOString().split("T")[0];
    console.log(`Saving snapshot for date: ${today}`);

    // Prepare records for upsert (top 100)
    const records = highscores.slice(0, 100).map((player: {
      name: string;
      profession: string;
      level: number;
      skillLevel: number;
    }) => ({
      snapshot_date: today,
      player_name: player.name,
      profession: player.profession,
      level: player.level,
      // skillLevel is the experience value in the Experience category
      experience: player.skillLevel,
    }));

    // Upsert records (update on conflict)
    const { error } = await supabase
      .from("highscore_snapshots")
      .upsert(records, {
        onConflict: "snapshot_date,player_name",
      });

    if (error) {
      console.error("Database error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`Successfully saved ${records.length} records`);

    // Clean up old snapshots (keep last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split("T")[0];

    const { error: deleteError } = await supabase
      .from("highscore_snapshots")
      .delete()
      .lt("snapshot_date", cutoffDate);

    if (deleteError) {
      console.warn("Failed to clean old snapshots:", deleteError);
    } else {
      console.log(`Cleaned snapshots older than ${cutoffDate}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        date: today,
        playersCount: records.length 
      }),
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
