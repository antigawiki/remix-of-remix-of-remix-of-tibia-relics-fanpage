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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the 2 most recent distinct snapshot timestamps
    const { data: timestamps, error: tsError } = await supabase
      .from("xp_snapshots")
      .select("captured_at")
      .order("captured_at", { ascending: false })
      .limit(500);

    if (tsError) throw new Error(tsError.message);

    // Get unique timestamps
    const uniqueTs = [...new Set((timestamps || []).map((r) => r.captured_at))];

    if (uniqueTs.length < 2) {
      return new Response(
        JSON.stringify({
          players: [],
          latestAt: uniqueTs[0] || null,
          previousAt: null,
          message: "Aguardando 2 snapshots para calcular atividade. O sistema coleta dados a cada 5 minutos.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const latestAt = uniqueTs[0];
    const previousAt = uniqueTs[1];

    // Get both snapshots
    const [latestRes, previousRes] = await Promise.all([
      supabase.from("xp_snapshots").select("*").eq("captured_at", latestAt),
      supabase.from("xp_snapshots").select("*").eq("captured_at", previousAt),
    ]);

    if (latestRes.error) throw new Error(latestRes.error.message);
    if (previousRes.error) throw new Error(previousRes.error.message);

    const latestMap = new Map(
      (latestRes.data || []).map((p) => [p.player_name, p])
    );
    const previousMap = new Map(
      (previousRes.data || []).map((p) => [p.player_name, p])
    );

    // Calculate time diff in hours
    const diffMs = new Date(latestAt).getTime() - new Date(previousAt).getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // Calculate XP gained and infer hunt status
    const players = Array.from(latestMap.values())
      .map((latest) => {
        const previous = previousMap.get(latest.player_name);
        const xpGained = previous
          ? (latest.experience || 0) - (previous.experience || 0)
          : 0;
        const xpPerHour = diffHours > 0 ? Math.round(xpGained / diffHours) : 0;
        const isHunting = xpGained > 0;

        return {
          name: latest.player_name,
          profession: latest.profession,
          level: latest.level,
          experience: latest.experience,
          xpGained,
          xpPerHour,
          isHunting,
          isNewPlayer: !previous,
        };
      })
      .filter((p) => p.isHunting) // Only show players actively gaining XP
      .sort((a, b) => b.xpPerHour - a.xpPerHour);

    return new Response(
      JSON.stringify({
        players,
        latestAt,
        previousAt,
        diffMinutes: Math.round(diffMs / 60000),
        totalTracked: latestMap.size,
        activeNow: players.length,
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
