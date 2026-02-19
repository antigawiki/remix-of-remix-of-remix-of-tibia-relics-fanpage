import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://www.tibiarelic.com/characters";
// Re-scrape a character at most once every 2 hours
const SCRAPE_TTL_MS = 2 * 60 * 60 * 1000;
// Max concurrent fetches to avoid hammering the server
const CONCURRENCY = 5;
// Delay between batches (ms)
const BATCH_DELAY_MS = 500;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Determine which players to scrape:
    // 1. Get all distinct player names from sessions (unique players ever seen)
    const { data: sessionPlayers } = await supabase
      .from("online_tracker_sessions")
      .select("player_name");

    const allNames = [...new Set((sessionPlayers || []).map((s: { player_name: string }) => s.player_name))];

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
      .select("character_name, last_scraped_at")
      .gte("last_scraped_at", cutoff);

    const freshNames = new Set((freshScraped || []).map((r: { character_name: string }) => r.character_name));

    // Only scrape names that are stale or never scraped
    const toScrape = allNames.filter((name) => !freshNames.has(name));

    console.log(`Total players: ${allNames.length}, fresh: ${freshNames.size}, to scrape: ${toScrape.length}`);

    if (toScrape.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "All players are fresh", scraped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let scraped = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < toScrape.length; i += CONCURRENCY) {
      const batch = toScrape.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((name) => scrapeCharacter(name)));

      // Upsert results to DB
      const upserts = results.map((r) => ({
        character_name: r.name,
        account_chars: r.accountChars,
        last_scraped_at: new Date().toISOString(),
        scrape_error: r.error || null,
      }));

      await supabase.from("character_accounts").upsert(upserts, {
        onConflict: "character_name",
      });

      scraped += results.filter((r) => !r.error).length;
      errors += results.filter((r) => !!r.error).length;

      // Add delay between batches (except last)
      if (i + CONCURRENCY < toScrape.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_known: allNames.length,
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        "User-Agent": "Mozilla/5.0 (compatible; RelicBot/1.0)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { name, accountChars: [name], error: `HTTP ${response.status}` };
    }

    const html = await response.text();

    // Strategy 1: Try to extract from __NEXT_DATA__ JSON (most reliable)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const accountChars = extractCharsFromNextData(nextData);
        if (accountChars.length > 0) {
          console.log(`[${name}] Found ${accountChars.length} chars via __NEXT_DATA__`);
          return { name, accountChars };
        }
      } catch (e) {
        console.warn(`[${name}] Failed to parse __NEXT_DATA__:`, e);
      }
    }

    // Strategy 2: Parse HTML table for characters section
    const accountChars = extractCharsFromHtml(html, name);
    console.log(`[${name}] Found ${accountChars.length} chars via HTML parsing`);
    return { name, accountChars };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown";
    console.error(`[${name}] Scrape error:`, msg);
    return { name, accountChars: [name], error: msg };
  }
}

function extractCharsFromNextData(data: unknown): string[] {
  // Recursively search for an array containing character objects with "name" and "world" fields
  const chars: string[] = [];

  function search(obj: unknown): void {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      // Check if this array looks like a character list
      if (obj.length > 0 && obj[0] && typeof obj[0] === "object") {
        const first = obj[0] as Record<string, unknown>;
        if ("name" in first && "world" in first) {
          for (const item of obj) {
            if (item && typeof item === "object") {
              const char = item as Record<string, unknown>;
              if (char.name && typeof char.name === "string") {
                chars.push(char.name);
              }
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
  // Look for the characters table section
  // Pattern: find "CHARACTERS" section and extract names from links
  const chars: string[] = [];

  // Find the characters section - tibiarelic uses a table with character links
  // Links are in format: /characters/NAME
  const charSectionMatch = html.match(/CHARACTERS[\s\S]*?(<table[\s\S]*?<\/table>)/i);
  if (charSectionMatch) {
    const tableHtml = charSectionMatch[1];
    const linkRegex = /href="\/characters\/([^"]+)"/g;
    let match;
    while ((match = linkRegex.exec(tableHtml)) !== null) {
      const charName = decodeURIComponent(match[1]);
      if (!chars.includes(charName)) {
        chars.push(charName);
      }
    }
  }

  // Fallback: search all character links in the page
  if (chars.length === 0) {
    const linkRegex = /href="\/characters\/([^"]+)"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const charName = decodeURIComponent(match[1]);
      if (!chars.includes(charName)) {
        chars.push(charName);
      }
    }
  }

  // Always include the player themselves
  if (!chars.includes(playerName)) {
    chars.push(playerName);
  }

  return chars;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
