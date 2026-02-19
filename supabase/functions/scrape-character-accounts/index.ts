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
// With 5s delay + ~3s per page = ~8s per char → 6 chars = ~48s safely within timeout
const MAX_PER_RUN = 6;
// Base delay between requests (5s conservative to avoid 429)
const REQUEST_DELAY_MS = 5000;
// Extra pause after a 429 before stopping the run
const RATE_LIMIT_COOLDOWN_MS = 15000;

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
          console.warn(`Rate limited at ${name}, stopping run. Cooling down ${RATE_LIMIT_COOLDOWN_MS}ms.`);
          await sleep(RATE_LIMIT_COOLDOWN_MS);
          break;
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

      // Delay between requests to respect rate limits
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
  let attempt = 0;
  let lastError: string | undefined;

  while (attempt < 3) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 10s, 20s
        const backoff = 10000 * attempt;
        console.log(`[${name}] Retry attempt ${attempt}, waiting ${backoff}ms`);
        await sleep(backoff);
      }

      const url = `${BASE_URL}/${encodeURIComponent(name)}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": getNextUserAgent(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 429) {
        // Check for Retry-After header
        const retryAfter = response.headers.get("Retry-After");
        let waitMs = 15000 * (attempt + 1); // default backoff
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10);
          if (!isNaN(parsed)) waitMs = parsed * 1000;
        }
        lastError = "HTTP 429 - Rate limited";
        console.warn(`[${name}] 429 received, retry-after: ${retryAfter ?? "none"}, waiting ${waitMs}ms`);
        attempt++;
        await sleep(waitMs);
        continue;
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
