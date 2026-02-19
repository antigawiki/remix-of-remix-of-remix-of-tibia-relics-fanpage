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
const MAX_PER_RUN = 30;
// Delay between requests to avoid rate limiting (ms)
const REQUEST_DELAY_MS = 800;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all distinct player names from sessions
    const { data: sessionPlayers } = await supabase
      .from("online_tracker_sessions")
      .select("player_name");

    const allNames = [
      ...new Set(
        (sessionPlayers || []).map((s: { player_name: string }) => s.player_name)
      ),
    ];

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
      .is("scrape_error", null); // Only consider successfully scraped as "fresh"

    const freshNames = new Set(
      (freshScraped || []).map((r: { character_name: string }) => r.character_name)
    );

    // Only scrape names that are stale or never scraped
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

    // Process up to MAX_PER_RUN sequentially to avoid rate limiting
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
          // On rate limit, stop the run early
          console.warn(`Rate limited at ${name}, stopping run.`);
          break;
        }
        errors++;
      } else {
        scraped++;
        console.log(
          `[${name}] OK — ${result.accountChars.length} chars on account`
        );
      }

      // Delay between requests
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

interface ScrapeResult {
  name: string;
  accountChars: string[];
  error?: string;
}

async function scrapeCharacter(name: string): Promise<ScrapeResult> {
  try {
    const url = `${BASE_URL}/${encodeURIComponent(name)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 429) {
      return { name, accountChars: [name], error: "HTTP 429 - Rate limited" };
    }

    if (!response.ok) {
      return { name, accountChars: [name], error: `HTTP ${response.status}` };
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
          return { name, accountChars };
        }
      } catch (_e) {
        // fall through to HTML parsing
      }
    }

    // Strategy 2: Parse character links from the "Characters" section in HTML
    const accountChars = extractCharsFromHtml(html, name);
    return { name, accountChars };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    console.error(`[${name}] Scrape error:`, msg);
    return { name, accountChars: [name], error: msg };
  }
}

function extractCharsFromNextData(data: unknown): string[] {
  const chars: string[] = [];

  function search(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      // Check if this array looks like a character list (has items with "name" and "world")
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

  // The character page has a "Characters" section with a table.
  // Links are in format: href="/characters/NAME"
  // We look for the section after "Characters" heading and extract links.

  // Find the characters section by looking for the heading and table
  const charsIndex = html.search(/>\s*Characters\s*</i);
  if (charsIndex !== -1) {
    const section = html.slice(charsIndex, charsIndex + 5000);
    const linkRegex = /href="\/characters\/([^"?#]+)"/g;
    let match;
    while ((match = linkRegex.exec(section)) !== null) {
      const charName = decodeURIComponent(match[1].replace(/\+/g, " "));
      // Filter out generic /characters page
      if (charName && charName !== "" && !chars.includes(charName)) {
        chars.push(charName);
      }
    }
  }

  // Fallback: search entire page for character links (but filter more carefully)
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

  // Always ensure the searched player is included
  if (!chars.includes(playerName)) {
    chars.push(playerName);
  }

  return chars;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
