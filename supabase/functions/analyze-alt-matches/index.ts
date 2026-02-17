import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Alt Detection Algorithm - Inspired by TibiaStalker & kik-tibia/online-tracker
 * 
 * 1. If two characters overlap online for >1min → NOT alts (disqualified)
 * 2. "Adjacencies" = one logs out, the other logs in within 5 min
 * 3. Probability weighted by adjacency ratio, time proximity, bidirectionality, data confidence
 * 4. Cap at 95% - never 100% sure
 */

interface Session { login_at: number; logout_at: number; }

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from("online_tracker_sessions")
      .select("player_name, login_at, logout_at")
      .not("logout_at", "is", null)
      .order("login_at", { ascending: true });

    if (sessionsError) throw sessionsError;
    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No sessions to analyze", matches: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group sessions by player, pre-parse dates to numbers
    const playerSessions: Record<string, Session[]> = {};
    for (const s of sessions) {
      if (!playerSessions[s.player_name]) playerSessions[s.player_name] = [];
      playerSessions[s.player_name].push({
        login_at: new Date(s.login_at).getTime(),
        logout_at: new Date(s.logout_at!).getTime(),
      });
    }

    const players = Object.keys(playerSessions);
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const OVERLAP_TOLERANCE_MS = 60 * 1000; // 1 min tolerance for x-logging
    const MIN_SESSIONS = 2;
    const MIN_ADJACENCIES = 1;

    const results: any[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < players.length; i++) {
      const a = players[i];
      const sessA = playerSessions[a];
      if (sessA.length < MIN_SESSIONS) continue;

      for (let j = i + 1; j < players.length; j++) {
        const b = players[j];
        const sessB = playerSessions[b];
        if (sessB.length < MIN_SESSIONS) continue;

        // 1. Check overlap (ever online together for real)
        let everTogether = false;
        for (const sa of sessA) {
          for (const sb of sessB) {
            const overlapStart = Math.max(sa.login_at, sb.login_at);
            const overlapEnd = Math.min(sa.logout_at, sb.logout_at);
            if (overlapEnd - overlapStart > OVERLAP_TOLERANCE_MS) {
              everTogether = true;
              break;
            }
          }
          if (everTogether) break;
        }

        if (everTogether) continue; // NOT alts

        // 2. Find adjacencies
        let adjCount = 0;
        let totalTimeDiff = 0;
        let hasAtoB = false;
        let hasBtoA = false;

        for (const sa of sessA) {
          for (const sb of sessB) {
            const diffAB = sb.login_at - sa.logout_at;
            if (diffAB >= 0 && diffAB <= FIVE_MIN_MS) {
              adjCount++;
              totalTimeDiff += diffAB;
              hasAtoB = true;
            }
            const diffBA = sa.login_at - sb.logout_at;
            if (diffBA >= 0 && diffBA <= FIVE_MIN_MS) {
              adjCount++;
              totalTimeDiff += diffBA;
              hasBtoA = true;
            }
          }
        }

        if (adjCount < MIN_ADJACENCIES) continue;

        // 3. Calculate probability
        const maxPossible = sessA.length + sessB.length;
        const adjacencyRatio = adjCount / maxPossible;
        const avgTimeDiff = totalTimeDiff / adjCount;
        const proximityScore = 1 - (avgTimeDiff / FIVE_MIN_MS) * 0.8;
        const bidirectionalBonus = (hasAtoB && hasBtoA) ? 1.3 : 1.0;
        const totalMin = Math.min(sessA.length, sessB.length);
        const dataConfidence = Math.min(1.0, totalMin / 10);

        let probability = adjacencyRatio * proximityScore * bidirectionalBonus * dataConfidence * 100;
        probability = Math.min(95, Math.round(probability * 100) / 100);

        if (probability > 3) {
          results.push({
            player_a: a,
            player_b: b,
            match_count: adjCount,
            total_sessions_a: sessA.length,
            total_sessions_b: sessB.length,
            ever_online_together: false,
            probability,
            last_updated: now,
          });
        }
      }
    }

    // Batch: delete all old matches then insert new ones
    await supabase.from("alt_detector_matches").delete().gte("id", "00000000-0000-0000-0000-000000000000");

    if (results.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < results.length; i += 50) {
        const batch = results.slice(i, i + 50);
        await supabase.from("alt_detector_matches").insert(batch);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        players_analyzed: players.length,
        matches_saved: results.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Analyze alt matches error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
