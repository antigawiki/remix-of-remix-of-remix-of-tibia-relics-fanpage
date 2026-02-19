import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.tibiarelic.com/characters";
// Re-scrape a character at most once every 4 hours
const SCRAPE_TTL_MS = 4 * 60 * 60 * 1000;
// Max characters to scrape per run (to stay within function timeout)
const MAX_PER_RUN = 20;
// Base delay between requests to avoid rate limiting (ms)
const REQUEST_DELAY_MS = 1500;

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

    // Get already-scraped characters that are still fresh
    const cutoff = new Date(Date.now() - SCRAPE_TTL_MS).toISOString();
    const { data: freshScraped } = await supabase
      .from("character_accounts")
      .select("character_name")
      .gte("last_scraped_at", cutoff)
      .is("scrape_error", null);

    const freshNames = new Set(
      (freshScraped || []).map((r: { character_name: string }) => r.character_name)
    );

    // Prioritize: 429-errored first, then never scraped, then stale
    const { data: erroredChars } = await supabase
      .from("character_accounts")
      .select("character_name, scrape_error")
      .not("scrape_error", "is", null);

    const erroredNames = new Set(
      (erroredChars || [])
        .filter((r: { scrape_error: string }) => r.scrape_error?.includes("429"))
        .map((r: { character_name: string }) => r.character_name)
    );

    // Sort: never scraped first, then 429-errored (retry), then stale
    const toScrape = allNames.filter((name) => !freshNames.has(name)).sort((a, b) => {
      const aErrored = erroredNames.has(a) ? 1 : 0;
      const bErrored = erroredNames.has(b) ? 1 : 0;
      return aErrored - bErrored; // non-errored first
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
          console.warn(`Rate limited at ${name}, stopping run.`);
          break;
        }
        errors++;
      } else {
        scraped++;
        console.log(`[${name}] OK — ${result.accountChars.length} chars on account`);
      }

      await sleep(REQUEST_DELAY_MS);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_known: allNames.length,
        still_pending: toScrape.length - batch.length,
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
        await sleep(3000 * attempt);
      }

      const url = `${BASE_URL}/${encodeURIComponent(name)}`;
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
        await sleep(5000 * attempt);
        continue;
      }

      if (!response.ok) {
        return { accountChars: [name], error: `HTTP ${response.status}` };
      }

      const html = await response.text();

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
          // fall through
        }
      }

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
