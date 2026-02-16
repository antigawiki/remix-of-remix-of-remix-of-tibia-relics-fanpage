import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_URL = "https://api.tibiarelic.com/api/Community/Relic/who-is-online";
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_DURATION_MS = 55000; // 55 seconds (leave 5s buffer before timeout)

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const startTime = Date.now();
  let pollCount = 0;
  let errors: string[] = [];

  try {
    // Get current state from DB
    const { data: currentState } = await supabase
      .from("online_tracker_state")
      .select("player_name, last_seen_at");

    let knownOnline = new Set<string>(
      (currentState || []).map((p: { player_name: string }) => p.player_name)
    );

    while (Date.now() - startTime < MAX_DURATION_MS) {
      try {
        // Fetch who is online from API
        const response = await fetch(API_URL, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          errors.push(`API returned ${response.status} at poll ${pollCount}`);
          await sleep(POLL_INTERVAL_MS);
          pollCount++;
          continue;
        }

        const players: { name: string; profession: string; level: number }[] =
          await response.json();
        const nowOnline = new Set<string>(players.map((p) => p.name));
        const now = new Date().toISOString();

        // New players (logged in)
        const loggedIn = [...nowOnline].filter((name) => !knownOnline.has(name));
        // Players who left (logged out)
        const loggedOut = [...knownOnline].filter((name) => !nowOnline.has(name));

        // Process logins
        if (loggedIn.length > 0) {
          // Insert sessions
          const sessions = loggedIn.map((name) => ({
            player_name: name,
            login_at: now,
          }));
          await supabase.from("online_tracker_sessions").insert(sessions);

          // Upsert state
          const states = loggedIn.map((name) => ({
            player_name: name,
            last_seen_at: now,
          }));
          await supabase.from("online_tracker_state").upsert(states, {
            onConflict: "player_name",
          });
        }

        // Process logouts
        if (loggedOut.length > 0) {
          // Update sessions with logout time (find open sessions)
          for (const name of loggedOut) {
            await supabase
              .from("online_tracker_sessions")
              .update({ logout_at: now })
              .eq("player_name", name)
              .is("logout_at", null);
          }

          // Delete from state
          await supabase
            .from("online_tracker_state")
            .delete()
            .in("player_name", loggedOut);
        }

        // Update last_seen for still-online players
        if (nowOnline.size > 0) {
          const stillOnline = [...nowOnline].filter((name) => knownOnline.has(name));
          if (stillOnline.length > 0) {
            const updates = stillOnline.map((name) => ({
              player_name: name,
              last_seen_at: now,
            }));
            await supabase.from("online_tracker_state").upsert(updates, {
              onConflict: "player_name",
            });
          }
        }

        knownOnline = nowOnline;
        pollCount++;
      } catch (pollError) {
        const msg = pollError instanceof Error ? pollError.message : "Unknown poll error";
        errors.push(`Poll ${pollCount}: ${msg}`);
      }

      // Wait before next poll
      if (Date.now() - startTime + POLL_INTERVAL_MS < MAX_DURATION_MS) {
        await sleep(POLL_INTERVAL_MS);
      } else {
        break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        polls: pollCount,
        duration_ms: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Track online players error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
