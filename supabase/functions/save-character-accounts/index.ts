import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { records } = body as {
      records: { character_name: string; account_chars: string[]; scrape_error: string | null }[];
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing records array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date().toISOString();
    const upserts = records.map((r) => ({
      character_name: r.character_name,
      account_chars: r.account_chars,
      last_scraped_at: now,
      scrape_error: r.scrape_error || null,
    }));

    const { error } = await supabase
      .from("character_accounts")
      .upsert(upserts, { onConflict: "character_name" });

    if (error) throw error;

    console.log(`Saved ${upserts.length} character account records`);

    return new Response(
      JSON.stringify({ success: true, saved: upserts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("save-character-accounts error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
