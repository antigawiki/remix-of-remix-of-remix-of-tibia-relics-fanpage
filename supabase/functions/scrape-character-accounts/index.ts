import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Re-scrape a character at most once every 4 hours
const SCRAPE_TTL_MS = 4 * 60 * 60 * 1000;
// Max characters per run — JSON API is fast, process 50 per cron run
const MAX_PER_RUN = 50;
// Short delay between API requests (be polite)
const REQUEST_DELAY_MS = 200;

// Correct JSON API endpoint
const JSON_API_BASE = "https://api.tibiarelic.com/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all distinct player names from sessions (paginate to avoid 1000 row limit)
    const allNames = await getAllPlayerNames(supabase);

    if (allNames.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No players to scrape", scraped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get already-scraped characters — only treat as fresh if recently scraped AND has real data
    const cutoff = new Date(Date.now() - SCRAPE_TTL_MS).toISOString();
    const { data: allScraped } = await supabase
      .from("character_accounts")
      .select("character_name, account_chars, scrape_error, last_scraped_at");

    const freshNames = new Set<string>();

    for (const r of (allScraped || []) as { character_name: string; account_chars: string[]; scrape_error: string | null; last_scraped_at: string }[]) {
      const isRecent = r.last_scraped_at >= cutoff;
      const hasData = r.account_chars && r.account_chars.length > 0;
      const hasError = r.scrape_error !== null;

      if (isRecent && hasData && !hasError) {
        freshNames.add(r.character_name);
      }
    }

    const toScrape = allNames.filter((name) => !freshNames.has(name));

    console.log(
      `Total: ${allNames.length}, fresh: ${freshNames.size}, to scrape: ${toScrape.length}, this run: ${Math.min(toScrape.length, MAX_PER_RUN)}`
    );

    if (toScrape.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "All players are fresh", scraped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const batch = toScrape.slice(0, MAX_PER_RUN);
    let scraped = 0;
    let errors = 0;

    for (const name of batch) {
      const result = await fetchCharacterByName(name);

      await supabase.from("character_accounts").upsert(
        {
          character_name: name,
          account_chars: result.accountChars,
          last_scraped_at: new Date().toISOString(),
          scrape_error: result.error || null,
        },
        { onConflict: "character_name" }
      );

      if (result.error) {
        errors++;
        console.warn(`[${name}] Error: ${result.error}`);
      } else {
        scraped++;
        const alts = result.accountChars.filter((c) => c !== name);
        console.log(
          `[${name}] OK — ${result.accountChars.length} chars${alts.length > 0 ? ` (alts: ${alts.join(", ")})` : ""}`
        );
      }

      await sleep(REQUEST_DELAY_MS);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_known: allNames.length,
        still_pending: Math.max(0, toScrape.length - batch.length),
        scraped,
        errors,
        skipped_fresh: freshNames.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("scrape-character-accounts error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function getAllPlayerNames(supabase: ReturnType<typeof createClient>): Promise<string[]> {
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
  error?: string;
}

/**
 * Fetch character data using the correct tibiarelic API endpoint:
 *   GET https://api.tibiarelic.com/api/Community/character/by-name?name={name}
 * Returns { characters: [{name, level, worldName, online}] } — all chars on the account.
 */
async function fetchCharacterByName(name: string): Promise<FetchResult> {
  try {
    const apiUrl = `${JSON_API_BASE}/Community/character/by-name?name=${encodeURIComponent(name)}`;
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; TibiaBot/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return { accountChars: [name], error: `HTTP ${response.status}` };
    }

    const data = await response.json() as { characters?: { name: string }[] };
    const chars = (data.characters ?? []).map((c) => c.name).filter(Boolean);

    if (chars.length === 0) chars.push(name);

    return { accountChars: chars };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return { accountChars: [name], error: msg };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
