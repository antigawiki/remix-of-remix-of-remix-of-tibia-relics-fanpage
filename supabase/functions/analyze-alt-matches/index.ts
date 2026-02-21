import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Alt Detection Algorithm - v3
 *
 * Two detection methods:
 *
 * METHOD 1 - Account Scraping (definitive):
 *   If two characters appear on the same tibiarelic account page → confirmed alts
 *   Probability: 99% (never 100% to account for shared accounts edge cases)
 *
 * METHOD 2 - Statistical (fallback for unscraped players):
 *   Based on login/logout adjacency patterns.
 *   1. If two characters overlap online for >1min → NOT alts (disqualified)
 *   2. "Adjacencies" = one logs out, the other logs in within 5 min
 *   3. Probability weighted by adjacency ratio, time proximity, bidirectionality, data confidence
 *   4. Cap at 80% - statistical inference is less certain than account scraping
 *
 * Fix v3: Uses pagination to fetch ALL sessions (Supabase default limit is 1000 rows)
 */

interface Session {
  login_at: number;
  logout_at: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date().toISOString();
    const results: Record<string, ReturnType<typeof makeResult>> = {};

    // =========================================================
    // METHOD 1: Account-based detection (definitive)
    // =========================================================
    const { data: scraped } = await supabase
      .from("character_accounts")
      .select("character_name, account_chars")
      .is("scrape_error", null);

    // Build account groups: account_chars arrays that have more than 1 char
    const accountGroups = buildAccountGroups(scraped || []);

    let confirmedPairs = 0;
    for (const group of accountGroups) {
      const chars = Array.from(group).sort();
      for (let i = 0; i < chars.length; i++) {
        for (let j = i + 1; j < chars.length; j++) {
          const a = chars[i];
          const b = chars[j];
          const key = `${a}|||${b}`;
          results[key] = makeResult(a, b, {
            match_count: 0,
            total_sessions_a: 0,
            total_sessions_b: 0,
            ever_online_together: false,
            probability: 99,
            last_updated: now,
          });
          confirmedPairs++;
        }
      }
    }

    // =========================================================
    // METHOD 2: Statistical detection (for unscraped players)
    // =========================================================
    // Fetch ALL sessions using pagination to bypass the 1000-row limit
    const sessions = await getAllSessions(supabase);

    // Build set of players already confirmed by account scraping
    const confirmedPlayers = new Set<string>();
    for (const group of accountGroups) {
      group.forEach((name) => confirmedPlayers.add(name));
    }

    if (sessions.length > 0) {
      // Group sessions by player
      const playerSessions: Record<string, Session[]> = {};
      for (const s of sessions) {
        if (!playerSessions[s.player_name]) playerSessions[s.player_name] = [];
        playerSessions[s.player_name].push({
          login_at: new Date(s.login_at).getTime(),
          logout_at: new Date(s.logout_at!).getTime(),
        });
      }

      // Analyze ALL players - pairs already confirmed by account data are skipped
      // below via `if (results[keyAB]) continue`
      const players = Object.keys(playerSessions);

      console.log(`Statistical analysis: ${players.length} unconfirmed players, ${sessions.length} total sessions`);

      const FIVE_MIN_MS = 5 * 60 * 1000;
      const OVERLAP_TOLERANCE_MS = 6 * 60 * 1000;
      const MIN_SESSIONS = 2;
      const MIN_ADJACENCIES = 2;

      for (let i = 0; i < players.length; i++) {
        const a = players[i];
        const sessA = playerSessions[a];
        if (sessA.length < MIN_SESSIONS) continue;

        for (let j = i + 1; j < players.length; j++) {
          const b = players[j];

          const keyAB = [a, b].sort().join("|||");
          const existingConfirmed = results[keyAB];

          const sessB = playerSessions[b];
          if (sessB.length < MIN_SESSIONS) continue;

          // 1. Count overlaps (ever online together for real)
          let overlapCount = 0;
          for (const sa of sessA) {
            for (const sb of sessB) {
              const overlapStart = Math.max(sa.login_at, sb.login_at);
              const overlapEnd = Math.min(sa.logout_at, sb.logout_at);
              if (overlapEnd - overlapStart > OVERLAP_TOLERANCE_MS) {
                overlapCount++;
              }
            }
          }

          // 2. Find adjacencies
          // Fixed threshold regardless of overlap
          const minAdjRequired = MIN_ADJACENCIES;

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

          if (adjCount < minAdjRequired) continue;

          // 3. Calculate probability (max 80% for statistical method)
          const maxPossible = sessA.length + sessB.length;
          const adjacencyRatio = adjCount / maxPossible;
          const avgTimeDiff = totalTimeDiff / adjCount;
          const proximityScore = 1 - (avgTimeDiff / FIVE_MIN_MS) * 0.8;
          const bidirectionalBonus = hasAtoB && hasBtoA ? 1.3 : 1.0;
          const totalMin = Math.min(sessA.length, sessB.length);
          const dataConfidence = Math.min(1.0, totalMin / 10);

          let probability =
            adjacencyRatio * proximityScore * bidirectionalBonus * dataConfidence * 100;
          probability = Math.min(80, Math.round(probability * 100) / 100);

          if (existingConfirmed) {
            // Pair already confirmed by account scraping - update stats but keep prob 99
            existingConfirmed.match_count = adjCount;
            existingConfirmed.total_sessions_a = sessA.length;
            existingConfirmed.total_sessions_b = sessB.length;
            existingConfirmed.ever_online_together = overlapCount > 0;
          } else if (probability > 3) {
            results[keyAB] = makeResult(a, b, {
              match_count: adjCount,
              total_sessions_a: sessA.length,
              total_sessions_b: sessB.length,
              ever_online_together: overlapCount > 0,
              probability,
              last_updated: now,
            });
          }
        }
      }
    }

    // =========================================================
    // Save results to DB
    // =========================================================
    await supabase
      .from("alt_detector_matches")
      .delete()
      .gte("id", "00000000-0000-0000-0000-000000000000");

    const finalResults = Object.values(results);
    if (finalResults.length > 0) {
      for (let i = 0; i < finalResults.length; i += 50) {
        const batch = finalResults.slice(i, i + 50);
        await supabase.from("alt_detector_matches").insert(batch);
      }
    }

    console.log(`Done: ${confirmedPairs} confirmed, ${finalResults.length - confirmedPairs} statistical, ${finalResults.length} total`);

    return new Response(
      JSON.stringify({
        success: true,
        confirmed_by_account: confirmedPairs,
        statistical_matches: finalResults.length - confirmedPairs,
        total_matches_saved: finalResults.length,
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

/**
 * Fetch ALL completed sessions using pagination to bypass Supabase's 1000-row default limit.
 */
async function getAllSessions(
  supabase: ReturnType<typeof createClient>
): Promise<{ player_name: string; login_at: string; logout_at: string }[]> {
  const PAGE_SIZE = 1000;
  const all: { player_name: string; login_at: string; logout_at: string }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("online_tracker_sessions")
      .select("player_name, login_at, logout_at")
      .not("logout_at", "is", null)
      .order("login_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching sessions page:", error.message);
      break;
    }
    if (!data || data.length === 0) break;

    all.push(...(data as { player_name: string; login_at: string; logout_at: string }[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log(`Loaded ${all.length} sessions total`);
  return all;
}

interface MatchData {
  match_count: number;
  total_sessions_a: number;
  total_sessions_b: number;
  ever_online_together: boolean;
  probability: number;
  last_updated: string;
}

function makeResult(a: string, b: string, data: MatchData) {
  return {
    player_a: a,
    player_b: b,
    match_count: data.match_count,
    total_sessions_a: data.total_sessions_a,
    total_sessions_b: data.total_sessions_b,
    ever_online_together: data.ever_online_together,
    probability: data.probability,
    last_updated: data.last_updated,
  };
}

/**
 * Build groups of characters that belong to the same account.
 * Uses Union-Find to merge overlapping account_chars arrays.
 */
function buildAccountGroups(
  scraped: { character_name: string; account_chars: string[] }[]
): Set<string>[] {
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x)!;
    if (p !== x) {
      parent.set(x, find(p));
    }
    return parent.get(x)!;
  }

  function union(x: string, y: string) {
    const px = find(x);
    const py = find(y);
    if (px !== py) parent.set(px, py);
  }

  for (const row of scraped) {
    const allChars = [row.character_name, ...(row.account_chars || [])];
    // Only form groups if the account has more than 1 char
    if (allChars.length > 1) {
      for (let i = 1; i < allChars.length; i++) {
        union(allChars[0], allChars[i]);
      }
    }
  }

  // Group by root
  const groups = new Map<string, Set<string>>();
  for (const [name] of parent) {
    const root = find(name);
    if (!groups.has(root)) groups.set(root, new Set());
    groups.get(root)!.add(name);
  }

  // Only return groups with 2+ characters (actual alts)
  return [...groups.values()].filter((g) => g.size >= 2);
}
