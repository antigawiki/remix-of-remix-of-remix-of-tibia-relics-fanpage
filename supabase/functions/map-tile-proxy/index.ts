const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TILE_SERVER = 'https://st54085.ispot.cc/mapper/tibiarelic';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const zoom = url.searchParams.get('zoom');
    const floor = url.searchParams.get('floor');
    const x = url.searchParams.get('x');
    const y = url.searchParams.get('y');

    if (!zoom || !floor || !x || !y) {
      return new Response(
        JSON.stringify({ error: 'Missing params: zoom, floor, x, y' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tileUrl = `${TILE_SERVER}/${zoom}/${floor}/${x}_${y}.png`;
    const response = await fetch(tileUrl);

    if (!response.ok) {
      // Return transparent 1x1 PNG for missing tiles
      const emptyPng = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
        0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
        0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
        0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
      return new Response(emptyPng, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const imageData = await response.arrayBuffer();
    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=604800', // Cache 7 days
      },
    });
  } catch (error) {
    console.error('Tile proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch tile' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
