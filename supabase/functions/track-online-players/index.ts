import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_URL = "https://api.tibiarelic.com/api/Community/Relic/who-is-online";
const CHARACTER_URL = "https://www.tibiarelic.com/characters";
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
  let errors: string[] = [];
  let totalScraped = 0;

  // Cache of recently scraped names this run to avoid re-scraping in same invocation
  const scrapedThisRun = new Set<string>();

  try {
    // Get current state from DB
    const { data: currentState } = await supabase
      .from("online_tracker_state")
      .select("player_name, last_seen_at");

    let knownOnline = new Set<string>(
      (currentState || []).map((p: { player_name: string }) => p.player_name)
    );

    // Load already-scraped characters (fresh ones) to avoid redundant scraping
    const cutoff = new Date(Date.now() - SCRAPE_TTL_MS).toISOString();
    const { data: freshScraped } = await supabase
      .from("character_accounts")
      .select("character_name")
      .gte("last_scraped_at", cutoff)
      .is("scrape_error", null);

    const alreadyFresh = new Set<string>(
      (freshScraped || []).map((r: { character_name: string }) => r.character_name)
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

          // Scrape NEW players that haven't been scraped yet (or had 429 errors)
          // Do this asynchronously within the same function, one at a time but non-blocking per poll
          for (const name of loggedIn) {
            if (!alreadyFresh.has(name) && !scrapedThisRun.has(name)) {
              scrapedThisRun.add(name);
              // Fire-and-forget scrape (don't await to avoid blocking poll)
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
  supabase: ReturnType<typeof createClient>,
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
  // Retry up to 3 times with exponential backoff on 429
  let attempt = 0;
  let lastError: string | undefined;

  while (attempt < 3) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 2s, 4s
        await sleep(2000 * attempt);
      }

      const url = `${CHARACTER_URL}/${encodeURIComponent(name)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 429) {
        lastError = "HTTP 429 - Rate limited";
        attempt++;
        // Wait longer on 429
        await sleep(5000 * attempt);
        continue;
      }

      if (!response.ok) {
        return { accountChars: [name], error: `HTTP ${response.status}` };
      }

      const html = await response.text();

      // Strategy 1: Try __NEXT_DATA__ JSON (most reliable for Next.js apps)
      const nextDataMatch = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
      );
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const accountChars = extractCharsFromNextData(nextData);
          if (accountChars.length > 0) {
            return { accountChars };
          }
        } catch (_e) {
          // fall through to HTML parsing
        }
      }

      // Strategy 2: Parse character links from the "Characters" section in HTML
      const accountChars = extractCharsFromHtml(html, name);
      return { accountChars };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      lastError = msg;
      attempt++;
    }
  }

  console.error(`[${name}] Failed after ${attempt} attempts: ${lastError}`);
  return { accountChars: [name], error: lastError };
}

function extractCharsFromNextData(data: unknown): string[] {
  const chars: string[] = [];

  function search(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        const first = obj[0] as Record<string, unknown>;
        if (
          first &&
          typeof first === "object" &&
          "name" in first &&
          "world" in first
        ) {
          for (const item of obj) {
            const char = item as Record<string, unknown>;
            if (char.name && typeof char.name === "string") {
              chars.push(char.name);
            }
          }
          return;
        }
      }
      obj.forEach((item) => search(item));
    } else {
      Object.values(obj as Record<string, unknown>).forEach((val) => search(val));
    }
  }

  search(data);
  return chars;
}

function extractCharsFromHtml(html: string, playerName: string): string[] {
  const chars: string[] = [];

  const charsIndex = html.search(/>\s*Characters\s*</i);
  if (charsIndex !== -1) {
    const section = html.slice(charsIndex, charsIndex + 5000);
    const linkRegex = /href="\/characters\/([^"?#]+)"/g;
    let match;
    while ((match = linkRegex.exec(section)) !== null) {
      const charName = decodeURIComponent(match[1].replace(/\+/g, " "));
      if (charName && charName !== "" && !chars.includes(charName)) {
        chars.push(charName);
      }
    }
  }

  if (chars.length <= 1) {
    chars.length = 0;
    const linkRegex = /href="\/characters\/([^"?#]+)"/g;
    let match;
    const seen = new Set<string>();
    while ((match = linkRegex.exec(html)) !== null) {
      const charName = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
      if (charName && !seen.has(charName)) {
        seen.add(charName);
        chars.push(charName);
      }
    }
  }

  if (!chars.includes(playerName)) {
    chars.push(playerName);
  }

  return chars;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
