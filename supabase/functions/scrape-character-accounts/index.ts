import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ~2 req/s to stay safely under rate limit
const REQUEST_DELAY_MS = 500;
// Stop processing after 120s to stay within 150s edge function timeout
const MAX_RUNTIME_MS = 120_000;

const JSON_API_BASE = "https://api.tibiarelic.com/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all distinct player names
    const allNames = await getAllPlayerNames(supabase);

    if (allNames.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No players", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get last_scraped_at for all known characters to prioritize oldest
    const { data: scraped } = await supabase
      .from("character_accounts")
      .select("character_name, last_scraped_at");

    const scrapedMap = new Map<string, string>();
    for (const r of scraped || []) {
      scrapedMap.set(r.character_name, r.last_scraped_at);
    }

    // Sort: never-scraped first, then oldest scraped first
    const sorted = allNames.sort((a, b) => {
      const aTime = scrapedMap.get(a);
      const bTime = scrapedMap.get(b);
      if (!aTime && !bTime) return 0;
      if (!aTime) return -1;
      if (!bTime) return 1;
      return aTime.localeCompare(bTime);
    });

    const startTime = Date.now();
    let processed = 0;
    let errors = 0;
    let deathsInserted = 0;
    let rateLimited = 0;

    console.log(`Total players: ${sorted.length}. Processing oldest-first until ${MAX_RUNTIME_MS / 1000}s elapsed...`);

    for (const name of sorted) {
      // Check time budget
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        console.log(`Time budget reached after ${processed} players`);
        break;
      }

      const result = await fetchCharacterWithRetry(name);

      if (result.rateLimited) {
        rateLimited++;
        // If we get rate limited even after retry, stop — API needs cooldown
        if (rateLimited >= 3) {
          console.warn(`Too many 429s (${rateLimited}), stopping early`);
          break;
        }
      }

      // Upsert character accounts
      await supabase.from("character_accounts").upsert(
        {
          character_name: name,
          account_chars: result.accountChars,
          last_scraped_at: new Date().toISOString(),
          scrape_error: result.error || null,
        },
        { onConflict: "character_name" }
      );

      // Upsert deaths
      if (result.deaths.length > 0) {
        const deathRows = result.deaths.map((d) => ({
          player_name: name,
          death_timestamp: d.timestamp,
          level: d.level ?? 0,
          killers: d.killers ?? [],
        }));

        const { error: deathError } = await supabase
          .from("player_deaths")
          .upsert(deathRows, { onConflict: "player_name,death_timestamp", ignoreDuplicates: true });

        if (deathError) {
          console.warn(`[${name}] Death upsert error: ${deathError.message}`);
        } else {
          deathsInserted += deathRows.length;
        }
      }

      if (result.error) {
        errors++;
      } else {
        processed++;
      }

      await sleep(REQUEST_DELAY_MS);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const remaining = sorted.length - processed - errors;
    console.log(`Done in ${elapsed}s. ${processed} OK, ${errors} errs, ${deathsInserted} deaths, ${remaining} remaining for next run`);

    return new Response(
      JSON.stringify({
        success: true,
        total: sorted.length,
        processed,
        errors,
        deaths_upserted: deathsInserted,
        remaining_for_next_run: remaining,
        elapsed_seconds: parseFloat(elapsed),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("scrape-character-accounts error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getAllPlayerNames(supabase: any): Promise<string[]> {
  const PAGE_SIZE = 1000;
  const allNames = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("online_tracker_sessions")
      .select("player_name")
      .range(from, from + PAGE_SIZE - 1);

    if (error) break;
    if (!data || data.length === 0) break;

    for (const row of data) {
      allNames.add(row.player_name);
    }

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return [...allNames];
}

interface FetchResult {
  accountChars: string[];
  deaths: Array<{ timestamp: string; level: number; killers: unknown[] }>;
  error?: string;
  rateLimited?: boolean;
}

async function fetchCharacterWithRetry(name: string, retries = 1): Promise<FetchResult> {
  try {
    const apiUrl = `${JSON_API_BASE}/Community/character/by-name?name=${encodeURIComponent(name)}`;
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; TibiaBot/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 429) {
      if (retries > 0) {
        console.warn(`[${name}] 429 — retrying in 3s...`);
        await sleep(3000);
        return fetchCharacterWithRetry(name, retries - 1);
      }
      return { accountChars: [name], deaths: [], error: "429 after retry", rateLimited: true };
    }

    if (!response.ok) {
      return { accountChars: [name], deaths: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as {
      characters?: { name: string }[];
      deaths?: Array<{ timestamp: string; level: number; killers: unknown[] }>;
    };

    const chars = (data.characters ?? []).map((c) => c.name).filter(Boolean);
    if (chars.length === 0) chars.push(name);

    const deaths = Array.isArray(data.deaths) ? data.deaths : [];

    return { accountChars: chars, deaths };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return { accountChars: [name], deaths: [], error: msg };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
