import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.tibiarelic.com/characters";
// Re-scrape a character at most once every 4 hours
const SCRAPE_TTL_MS = 4 * 60 * 60 * 1000;
// Max characters to scrape per run
// ~8s per char (fetch 8s timeout + 1s delay) → 3 chars = ~27s safely within 60s edge limit
const MAX_PER_RUN = 3;
// Short delay between requests
const REQUEST_DELAY_MS = 1000;

// Rotate User-Agents to reduce fingerprinting
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
];

let uaIndex = 0;
function getNextUserAgent(): string {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex++;
  return ua;
}

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
        // Fresh = recently scraped + has actual account data (not empty array)
        freshNames.add(r.character_name);
      }
    }

    // Sort: non-errored (never scraped or stale) first, then 429-errored (retry at end)
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

    for (const name of batch) {
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

      if (result.error) {
        if (result.error.includes("429")) {
          rateLimited++;
          console.warn(`Rate limited at ${name}, stopping run early.`);
          break; // Stop the run immediately on 429, no waiting
        }
        errors++;
        console.warn(`[${name}] Error: ${result.error}`);
      } else {
        scraped++;
        const alts = result.accountChars.filter((c) => c !== name);
        console.log(
          `[${name}] OK — ${result.accountChars.length} chars${alts.length > 0 ? ` (alts: ${alts.join(", ")})` : ""}`
        );
      }

      // Short delay between requests
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

interface ScrapeResult {
  accountChars: string[];
  error?: string;
}

async function scrapeCharacter(name: string): Promise<ScrapeResult> {
  try {
    const url = `${BASE_URL}/${encodeURIComponent(name)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": getNextUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Cache-Control": "no-cache",
        "Referer": "https://www.tibiarelic.com/",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 429) {
      console.warn(`[${name}] 429 - Rate limited (no retry to avoid timeout)`);
      return { accountChars: [name], error: "HTTP 429 - Rate limited" };
    }

    if (!response.ok) {
      return { accountChars: [name], error: `HTTP ${response.status}` };
    }

    const html = await response.text();

    // Strategy 1: __NEXT_DATA__ JSON (most reliable for Next.js apps)
    const nextDataMatch = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const accountChars = extractCharsFromNextData(nextData);
        if (accountChars.length > 0) {
          console.log(`[${name}] __NEXT_DATA__ found ${accountChars.length} chars: ${accountChars.join(", ")}`);
          return { accountChars };
        }
      } catch (_e) {
        // fall through to HTML parsing
      }
    }

    // Strategy 2: Parse character links from HTML
    const accountChars = extractCharsFromHtml(html, name);
    return { accountChars };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    console.error(`[${name}] Fetch error: ${msg}`);
    return { accountChars: [name], error: msg };
  }
}

function extractCharsFromNextData(data: unknown): string[] {
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

function extractCharsFromHtml(html: string, playerName: string): string[] {
  // Strategy: find the "Characters" section table and extract all char links from it
  // The page has a table like: | Name | Level | World | Status |
  // with rows containing links like /characters/CharName

  // Find the account "Characters" section (after "Account Information")
  const accountInfoIdx = html.search(/Account\s+Information/i);
  const searchFrom = accountInfoIdx !== -1 ? accountInfoIdx : 0;
  const relevantHtml = html.slice(searchFrom);

  const chars: string[] = [];
  const seen = new Set<string>();

  // Extract all /characters/ links in the relevant section
  const linkRegex = /href="\/characters\/([^"?#]+)"/g;
  let match;
  while ((match = linkRegex.exec(relevantHtml)) !== null) {
    const raw = match[1];
    const charName = decodeURIComponent(raw.replace(/\+/g, " ")).trim();
    if (charName && !seen.has(charName.toLowerCase())) {
      seen.add(charName.toLowerCase());
      chars.push(charName);
    }
  }

  // Fallback: if nothing found, use the entire HTML
  if (chars.length === 0) {
    const linkRegex2 = /href="\/characters\/([^"?#]+)"/g;
    while ((match = linkRegex2.exec(html)) !== null) {
      const charName = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
      if (charName && !seen.has(charName.toLowerCase())) {
        seen.add(charName.toLowerCase());
        chars.push(charName);
      }
    }
  }

  // Always include the player themselves
  if (!seen.has(playerName.toLowerCase())) {
    chars.push(playerName);
  }

  console.log(`[${playerName}] HTML extraction found: ${chars.join(", ") || "none"}`);
  return chars;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
