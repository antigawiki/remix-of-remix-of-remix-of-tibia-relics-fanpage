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
      case "highscores": {
        const category = url.searchParams.get("category") || "Experience";
        const vocation = url.searchParams.get("vocation") || "All";
        const pageNumber = url.searchParams.get("pageNumber") || "1";
        apiUrl = `${API_BASE}/Highscores?worldName=Relic&category=${category}&vocation=${vocation}&pageNumber=${pageNumber}`;
        break;
      }
      case "character-api":
      case "character-by-name": {
        // Fetch character data using the correct by-name API endpoint
        const charName = url.searchParams.get("name");
        if (!charName) {
          return new Response(
            JSON.stringify({ error: "Missing name parameter" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const charApiUrl = `${API_BASE}/Community/character/by-name?name=${encodeURIComponent(charName)}`;
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
      case "kill-statistics":
        apiUrl = `${API_BASE}/KillStatistics?worldName=Relic`;
        break;
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
