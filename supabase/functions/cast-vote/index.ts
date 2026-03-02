import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { poll_id, option_key } = await req.json();

    if (!poll_id || !option_key) {
      return new Response(
        JSON.stringify({ error: 'poll_id and option_key are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate poll is active and not expired
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('id, active, ends_at')
      .eq('id', poll_id)
      .single();

    if (pollError || !poll) {
      return new Response(
        JSON.stringify({ error: 'poll_not_found', message: 'Enquete não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!poll.active) {
      return new Response(
        JSON.stringify({ error: 'poll_closed', message: 'Esta enquete está encerrada' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (poll.ends_at && new Date(poll.ends_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'poll_expired', message: 'Esta enquete já expirou' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract IP and User-Agent for anonymous fingerprint
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Generate SHA-256 hash of IP + User-Agent
    const encoder = new TextEncoder();
    const data = encoder.encode(`${ip}::${userAgent}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const voterHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Insert vote with ON CONFLICT to reject duplicates
    const { error } = await supabase
      .from('poll_votes')
      .insert({ poll_id, option_key, voter_hash: voterHash });

    if (error) {
      if (error.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'already_voted', message: 'Você já votou nesta enquete!' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, voter_hash: voterHash }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
