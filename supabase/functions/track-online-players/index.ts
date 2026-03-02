import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_ONLINE_URL = "https://api.tibiarelic.com/api/Community/Relic/who-is-online";
const API_CHARACTER_URL = "https://api.tibiarelic.com/api/Community/character/by-name";
const POLL_INTERVAL_MS = 5000; // 5 seconds
const MAX_DURATION_MS = 55000; // 55 seconds (leave 5s buffer before timeout)
const SCRAPE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const startTime = Date.now();
  let pollCount = 0;
  const errors: string[] = [];
  let totalScraped = 0;

  // Cache of recently scraped names this run to avoid re-scraping in same invocation
  const scrapedThisRun = new Set<string>();

  try {
    // ─── STARTUP: Reconcile stale open sessions ──────────────────────────────
    // Fetch who is actually online RIGHT NOW
    let nowOnlineAtStart = new Set<string>();
    try {
      const startResp = await fetch(API_ONLINE_URL, { headers: { Accept: "application/json" } });
      if (startResp.ok) {
        const players: { name: string }[] = await startResp.json();
        nowOnlineAtStart = new Set(players.map((p) => p.name));
      }
    } catch (_e) {
      console.warn("Could not fetch online list at startup for reconciliation");
    }

    // Get current state from DB
    const { data: currentState } = await supabase
      .from("online_tracker_state")
      .select("player_name, last_seen_at");

    const stateNames = new Set<string>(
      (currentState || []).map((p: { player_name: string }) => p.player_name)
    );

    // Players in DB state but NOT online now — their sessions were never closed (ghost sessions)
    const ghostPlayers = [...stateNames].filter((name) => !nowOnlineAtStart.has(name));

    if (ghostPlayers.length > 0) {
      const ghostLogoutTime = new Date().toISOString();
      console.log(`[reconcile] Closing ${ghostPlayers.length} ghost sessions: ${ghostPlayers.slice(0, 10).join(", ")}${ghostPlayers.length > 10 ? "..." : ""}`);

      // Close open sessions for ghost players
      for (const name of ghostPlayers) {
        await supabase
          .from("online_tracker_sessions")
          .update({ logout_at: ghostLogoutTime })
          .eq("player_name", name)
          .is("logout_at", null);
      }

      // Remove from state
      await supabase
        .from("online_tracker_state")
        .delete()
        .in("player_name", ghostPlayers);
    }

    // ─── Load fresh scraped chars to avoid redundant scraping ────────────────
    const cutoff = new Date(Date.now() - SCRAPE_TTL_MS).toISOString();
    const { data: freshScraped } = await supabase
      .from("character_accounts")
      .select("character_name")
      .gte("last_scraped_at", cutoff)
      .is("scrape_error", null);

    const alreadyFresh = new Set<string>(
      (freshScraped || []).map((r: { character_name: string }) => r.character_name)
    );

    // ─── Rebuild known online state after reconciliation ─────────────────────
    let knownOnline = new Set<string>(nowOnlineAtStart);

    // ─── Poll loop ────────────────────────────────────────────────────────────
    while (Date.now() - startTime < MAX_DURATION_MS) {
      try {
        const response = await fetch(API_ONLINE_URL, {
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
          const sessions = loggedIn.map((name) => ({ player_name: name, login_at: now }));
          await supabase.from("online_tracker_sessions").insert(sessions);

          const states = loggedIn.map((name) => ({ player_name: name, last_seen_at: now }));
          await supabase.from("online_tracker_state").upsert(states, { onConflict: "player_name" });

          // Scrape new players via API (non-blocking)
          for (const name of loggedIn) {
            if (!alreadyFresh.has(name) && !scrapedThisRun.has(name)) {
              scrapedThisRun.add(name);
              scrapeCharacterAndSave(supabase, name).then((result) => {
                if (!result.error) {
                  alreadyFresh.add(name);
                  totalScraped++;
                }
              }).catch(() => {/* ignore scrape errors in tracker */});
            }
          }
        }

        // Process logouts
        if (loggedOut.length > 0) {
          for (const name of loggedOut) {
            await supabase
              .from("online_tracker_sessions")
              .update({ logout_at: now })
              .eq("player_name", name)
              .is("logout_at", null);
          }

          await supabase
            .from("online_tracker_state")
            .delete()
            .in("player_name", loggedOut);
        }

        // Update last_seen for still-online players
        const stillOnline = [...nowOnline].filter((name) => knownOnline.has(name));
        if (stillOnline.length > 0) {
          const updates = stillOnline.map((name) => ({ player_name: name, last_seen_at: now }));
          await supabase.from("online_tracker_state").upsert(updates, { onConflict: "player_name" });
        }

        knownOnline = nowOnline;
        pollCount++;
      } catch (pollError) {
        const msg = pollError instanceof Error ? pollError.message : "Unknown poll error";
        errors.push(`Poll ${pollCount}: ${msg}`);
      }

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
        ghost_sessions_closed: ghostPlayers.length,
        scraped_this_run: totalScraped,
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

interface ScrapeResult {
  accountChars: string[];
  error?: string;
}

async function scrapeCharacterAndSave(
  supabase: any,
  name: string
): Promise<ScrapeResult> {
  const result = await scrapeCharacter(name);
  await supabase.from("character_accounts").upsert(
    {
      character_name: name,
      account_chars: result.accountChars,
      last_scraped_at: new Date().toISOString(),
      scrape_error: result.error || null,
    },
    { onConflict: "character_name" }
  );
  if (!result.error) {
    console.log(`[scrape] ${name} — ${result.accountChars.length} chars on account`);
  }
  return result;
}

async function scrapeCharacter(name: string): Promise<ScrapeResult> {
  let attempt = 0;
  let lastError: string | undefined;

  while (attempt < 3) {
    try {
      if (attempt > 0) {
        await sleep(2000 * attempt);
      }

      const url = `${API_CHARACTER_URL}?name=${encodeURIComponent(name)}`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (response.status === 429) {
        lastError = "HTTP 429 - Rate limited";
        attempt++;
        await sleep(5000 * attempt);
        continue;
      }

      if (!response.ok) {
        return { accountChars: [name], error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      // API returns { characters: [{name, level, worldName, online}] }
      const chars: string[] = (data.characters as { name: string }[] | undefined)
        ?.map((c) => c.name)
        .filter(Boolean) ?? [];

      if (chars.length === 0) chars.push(name);
      return { accountChars: chars };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      lastError = msg;
      attempt++;
    }
  }

  console.error(`[${name}] Failed after ${attempt} attempts: ${lastError}`);
  return { accountChars: [name], error: lastError };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
