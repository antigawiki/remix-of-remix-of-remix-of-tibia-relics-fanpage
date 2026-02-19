import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Re-scrape a character at most once every 4 hours
const SCRAPE_TTL_MS = 4 * 60 * 60 * 1000;
// Max characters per run — JSON API is much faster so we can do more
const MAX_PER_RUN = 15;
// Short delay between API requests (JSON API is less strict, but still be polite)
const REQUEST_DELAY_MS = 500;

// JSON API base (same as used by track-online-players — not blocked)
const JSON_API_BASE = "https://api.tibiarelic.com/api";
// HTML scrape fallback
const HTML_BASE = "https://www.tibiarelic.com/characters";

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
    const erroredNames = new Set<string>();

    for (const r of (allScraped || []) as { character_name: string; account_chars: string[]; scrape_error: string | null; last_scraped_at: string }[]) {
      const isRecent = r.last_scraped_at >= cutoff;
      const hasData = r.account_chars && r.account_chars.length > 0;
      const hasError = r.scrape_error !== null;

      if (hasError && r.scrape_error?.includes("429")) {
        erroredNames.add(r.character_name);
      } else if (isRecent && hasData && !hasError) {
        freshNames.add(r.character_name);
      }
    }

    // Sort: non-errored first, then 429-errored (retry at end)
    const toScrape = allNames.filter((name) => !freshNames.has(name)).sort((a, b) => {
      const aErrored = erroredNames.has(a) ? 1 : 0;
      const bErrored = erroredNames.has(b) ? 1 : 0;
      return aErrored - bErrored;
    });

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
    let rateLimited = 0;
    let apiSuccesses = 0;
    let htmlFallbacks = 0;

    for (const name of batch) {
      const result = await fetchCharacterData(name);

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
        if (result.error.includes("429")) {
          rateLimited++;
          console.warn(`Rate limited at ${name}, stopping run early.`);
          break;
        }
        errors++;
        console.warn(`[${name}] Error: ${result.error}`);
      } else {
        scraped++;
        if (result.source === "api") apiSuccesses++;
        else htmlFallbacks++;
        const alts = result.accountChars.filter((c) => c !== name);
        console.log(
          `[${name}] OK via ${result.source} — ${result.accountChars.length} chars${alts.length > 0 ? ` (alts: ${alts.join(", ")})` : ""}`
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
        rate_limited: rateLimited,
        skipped_fresh: freshNames.size,
        api_successes: apiSuccesses,
        html_fallbacks: htmlFallbacks,
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
  source: "api" | "html";
  error?: string;
}

/**
 * Try JSON API first (fast, less blocked), fall back to HTML scraping.
 * The tibiarelic JSON API endpoint for a character:
 *   GET https://api.tibiarelic.com/api/Community/Character/{name}
 * Returns character info including account characters list.
 */
async function fetchCharacterData(name: string): Promise<FetchResult> {
  // --- Attempt 1: JSON API ---
  try {
    const apiUrl = `${JSON_API_BASE}/Community/Character/${encodeURIComponent(name)}`;
    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; TibiaBot/1.0)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const data = await response.json();
      const chars = extractCharsFromApiResponse(data, name);
      if (chars.length > 0) {
        return { accountChars: chars, source: "api" };
      }
    } else if (response.status === 429) {
      console.warn(`[${name}] JSON API 429 - trying HTML fallback`);
      // Don't return yet, try HTML
    } else {
      console.log(`[${name}] JSON API returned ${response.status}, trying HTML fallback`);
    }
  } catch (e) {
    console.log(`[${name}] JSON API error: ${e instanceof Error ? e.message : e}, trying HTML`);
  }

  // --- Attempt 2: HTML scraping ---
  return await scrapeCharacterHtml(name);
}

/**
 * Extract character list from the tibiarelic JSON API response.
 * The API returns various formats depending on the endpoint.
 */
function extractCharsFromApiResponse(data: unknown, playerName: string): string[] {
  if (!data || typeof data !== "object") return [];
  
  const obj = data as Record<string, unknown>;
  
  // Try common patterns in the API response
  // Pattern 1: { accountCharacters: [{name: "..."}] }
  if (Array.isArray(obj.accountCharacters)) {
    const chars = (obj.accountCharacters as {name?: string}[])
      .filter(c => c.name)
      .map(c => c.name!);
    if (chars.length > 0) return chars;
  }
  
  // Pattern 2: { characters: [{name: "..."}] }
  if (Array.isArray(obj.characters)) {
    const chars = (obj.characters as {name?: string}[])
      .filter(c => c.name)
      .map(c => c.name!);
    if (chars.length > 0) return chars;
  }
  
  // Pattern 3: { character: { accountCharacters: [...] } }
  if (obj.character && typeof obj.character === "object") {
    const char = obj.character as Record<string, unknown>;
    if (Array.isArray(char.accountCharacters)) {
      const chars = (char.accountCharacters as {name?: string}[])
        .filter(c => c.name)
        .map(c => c.name!);
      if (chars.length > 0) return chars;
    }
  }

  // Pattern 4: Deep search for arrays with name+world properties (same as __NEXT_DATA__ parser)
  const chars = deepSearchCharArray(data);
  if (chars.length > 0) return chars;

  return [];
}

function deepSearchCharArray(data: unknown): string[] {
  const chars: string[] = [];

  function search(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      if (obj.length > 0) {
        const first = obj[0] as Record<string, unknown>;
        if (first && typeof first === "object" && "name" in first && "world" in first) {
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

async function scrapeCharacterHtml(name: string): Promise<FetchResult> {
  try {
    const url = `${HTML_BASE}/${encodeURIComponent(name)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
        "Referer": "https://www.tibiarelic.com/",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 429) {
      console.warn(`[${name}] HTML 429 - Rate limited`);
      return { accountChars: [name], source: "html", error: "HTTP 429 - Rate limited" };
    }

    if (!response.ok) {
      return { accountChars: [name], source: "html", error: `HTTP ${response.status}` };
    }

    const html = await response.text();

    // Strategy 1: __NEXT_DATA__ JSON
    const nextDataMatch = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const accountChars = deepSearchCharArray(nextData);
        if (accountChars.length > 0) {
          console.log(`[${name}] __NEXT_DATA__ found ${accountChars.length} chars`);
          return { accountChars, source: "html" };
        }
      } catch (_e) {
        // fall through
      }
    }

    // Strategy 2: HTML link extraction
    const accountInfoIdx = html.search(/Account\s+Information/i);
    const searchFrom = accountInfoIdx !== -1 ? accountInfoIdx : 0;
    const relevantHtml = html.slice(searchFrom);

    const chars: string[] = [];
    const seen = new Set<string>();
    const linkRegex = /href="\/characters\/([^"?#]+)"/g;
    let match;
    while ((match = linkRegex.exec(relevantHtml)) !== null) {
      const charName = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
      if (charName && !seen.has(charName.toLowerCase())) {
        seen.add(charName.toLowerCase());
        chars.push(charName);
      }
    }

    if (!seen.has(name.toLowerCase())) chars.push(name);

    return { accountChars: chars, source: "html" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    return { accountChars: [name], source: "html", error: msg };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
