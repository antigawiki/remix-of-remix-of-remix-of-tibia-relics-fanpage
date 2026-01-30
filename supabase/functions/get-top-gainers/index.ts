import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "10");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the two most recent snapshot dates
    const { data: dates, error: datesError } = await supabase
      .from("highscore_snapshots")
      .select("snapshot_date")
      .order("snapshot_date", { ascending: false })
      .limit(200);

    if (datesError) {
      throw new Error(`Failed to get dates: ${datesError.message}`);
    }

    // Get unique dates
    const uniqueDates = [...new Set(dates?.map(d => d.snapshot_date) || [])];
    
    if (uniqueDates.length < 2) {
      return new Response(
        JSON.stringify({ 
          gainers: [],
          periodStart: null,
          periodEnd: uniqueDates[0] || null,
          message: "Dados insuficientes. O sistema precisa de pelo menos 2 dias de snapshots para calcular os ganhos."
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const todayDate = uniqueDates[0];
    const yesterdayDate = uniqueDates[1];

    console.log(`Comparing ${yesterdayDate} -> ${todayDate}`);

    // Get today's snapshot
    const { data: todayData, error: todayError } = await supabase
      .from("highscore_snapshots")
      .select("*")
      .eq("snapshot_date", todayDate);

    if (todayError) {
      throw new Error(`Failed to get today's data: ${todayError.message}`);
    }

    // Get yesterday's snapshot
    const { data: yesterdayData, error: yesterdayError } = await supabase
      .from("highscore_snapshots")
      .select("*")
      .eq("snapshot_date", yesterdayDate);

    if (yesterdayError) {
      throw new Error(`Failed to get yesterday's data: ${yesterdayError.message}`);
    }

    // Create map of yesterday's data
    const yesterdayMap = new Map(
      (yesterdayData || []).map(p => [p.player_name, p])
    );

    // Calculate experience gains
    const gainers = (todayData || [])
      .map(player => {
        const yesterday = yesterdayMap.get(player.player_name);
        const yesterdayExp = yesterday?.experience || 0;
        const experienceGained = player.experience - yesterdayExp;

        return {
          name: player.player_name,
          profession: player.profession,
          level: player.level,
          experienceGained,
          currentExperience: player.experience,
          isNewPlayer: !yesterday,
        };
      })
      .filter(p => p.experienceGained > 0)
      .sort((a, b) => b.experienceGained - a.experienceGained)
      .slice(0, limit)
      .map((p, index) => ({
        rank: index + 1,
        ...p,
      }));

    return new Response(
      JSON.stringify({
        gainers,
        periodStart: yesterdayDate,
        periodEnd: todayDate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
