import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://api.tibiarelic.com/api";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let apiUrl: string;
    
    switch (endpoint) {
      case "stats":
        apiUrl = `${API_BASE}/Community/Relic/stats`;
        break;
      case "who-is-online":
        apiUrl = `${API_BASE}/Community/Relic/who-is-online`;
        break;
      case "bans":
        apiUrl = `${API_BASE}/Community/Relic/bans`;
        break;
      case "highscores":
        const category = url.searchParams.get("category") || "Experience";
        const vocation = url.searchParams.get("vocation") || "All";
        apiUrl = `${API_BASE}/Highscores?worldName=Relic&category=${category}&vocation=${vocation}`;
        break;
      case "character-api": {
        // Fetch character data from JSON API (not HTML)
        const charName = url.searchParams.get("name");
        if (!charName) {
          return new Response(
            JSON.stringify({ error: "Missing name parameter" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const charApiUrl = `${API_BASE}/Community/Character/${encodeURIComponent(charName)}`;
        console.log(`Fetching character API: ${charApiUrl}`);
        const charApiResp = await fetch(charApiUrl, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        console.log(`Character API status: ${charApiResp.status}`);
        if (!charApiResp.ok) {
          return new Response(JSON.stringify({ error: `HTTP ${charApiResp.status}` }), { status: charApiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const charData = await charApiResp.json();
        return new Response(JSON.stringify(charData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "character-page": {
        // Fetch the HTML character page and return it as text
        const charName = url.searchParams.get("name");
        if (!charName) {
          return new Response(
            JSON.stringify({ error: "Missing name parameter" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const charUrl = `https://www.tibiarelic.com/characters/${encodeURIComponent(charName)}`;
        console.log(`Fetching character page: ${charUrl}`);
        const charResp = await fetch(charUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Cache-Control": "no-cache",
            "Referer": "https://www.tibiarelic.com/",
          },
          signal: AbortSignal.timeout(10000),
        });
        console.log(`Character page status: ${charResp.status}`);
        if (charResp.status === 429) {
          return new Response(JSON.stringify({ error: "429" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (!charResp.ok) {
          return new Response(JSON.stringify({ error: `HTTP ${charResp.status}` }), { status: charResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const html = await charResp.text();
        return new Response(JSON.stringify({ html }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default:
        return new Response(
          JSON.stringify({ error: "Invalid endpoint" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    console.log(`Fetching: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
