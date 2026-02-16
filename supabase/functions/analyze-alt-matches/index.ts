import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all completed sessions (with logout)
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

    // Group sessions by player
    const playerSessions: Record<string, { login_at: string; logout_at: string }[]> = {};
    for (const s of sessions) {
      if (!playerSessions[s.player_name]) playerSessions[s.player_name] = [];
      playerSessions[s.player_name].push({ login_at: s.login_at, logout_at: s.logout_at! });
    }

    const players = Object.keys(playerSessions);
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const matches: Record<string, {
      player_a: string;
      player_b: string;
      match_count: number;
      total_sessions_a: number;
      total_sessions_b: number;
      ever_online_together: boolean;
    }> = {};

    // Compare all pairs
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i];
        const b = players[j];
        const sessA = playerSessions[a];
        const sessB = playerSessions[b];

        // Check if ever online together (session overlap)
        let everTogether = false;
        for (const sa of sessA) {
          for (const sb of sessB) {
            const aLogin = new Date(sa.login_at).getTime();
            const aLogout = new Date(sa.logout_at).getTime();
            const bLogin = new Date(sb.login_at).getTime();
            const bLogout = new Date(sb.logout_at).getTime();
            // Overlap: A started before B ended AND B started before A ended
            if (aLogin < bLogout && bLogin < aLogout) {
              everTogether = true;
              break;
            }
          }
          if (everTogether) break;
        }

        // Count logout->login matches within 5 minutes
        let matchCount = 0;

        // A logout -> B login
        for (const sa of sessA) {
          const aLogout = new Date(sa.logout_at).getTime();
          for (const sb of sessB) {
            const bLogin = new Date(sb.login_at).getTime();
            const diff = bLogin - aLogout;
            if (diff >= 0 && diff <= FIVE_MIN_MS) {
              matchCount++;
            }
          }
        }

        // B logout -> A login
        for (const sb of sessB) {
          const bLogout = new Date(sb.logout_at).getTime();
          for (const sa of sessA) {
            const aLogin = new Date(sa.login_at).getTime();
            const diff = aLogin - bLogout;
            if (diff >= 0 && diff <= FIVE_MIN_MS) {
              matchCount++;
            }
          }
        }

        if (matchCount > 0 || everTogether) {
          const key = `${a}|${b}`;
          const minSessions = Math.min(sessA.length, sessB.length);
          matches[key] = {
            player_a: a,
            player_b: b,
            match_count: matchCount,
            total_sessions_a: sessA.length,
            total_sessions_b: sessB.length,
            ever_online_together: everTogether,
          };
        }
      }
    }

    // Upsert matches
    let upsertCount = 0;
    const now = new Date().toISOString();

    for (const m of Object.values(matches)) {
      const minSessions = Math.min(m.total_sessions_a, m.total_sessions_b);
      const probability = minSessions > 0
        ? Math.min(100, Math.round((m.match_count / minSessions) * 100 * 100) / 100)
        : 0;

      // Only save if there's meaningful data (not online together + has matches)
      if (!m.ever_online_together && m.match_count > 0) {
        await supabase.from("alt_detector_matches").upsert(
          {
            player_a: m.player_a,
            player_b: m.player_b,
            match_count: m.match_count,
            total_sessions_a: m.total_sessions_a,
            total_sessions_b: m.total_sessions_b,
            ever_online_together: m.ever_online_together,
            probability,
            last_updated: now,
          },
          { onConflict: "player_a,player_b" }
        );
        upsertCount++;
      }

      // If they were seen online together, remove any previous match
      if (m.ever_online_together) {
        await supabase
          .from("alt_detector_matches")
          .delete()
          .eq("player_a", m.player_a)
          .eq("player_b", m.player_b);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        players_analyzed: players.length,
        pairs_checked: Object.keys(matches).length,
        matches_saved: upsertCount,
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
