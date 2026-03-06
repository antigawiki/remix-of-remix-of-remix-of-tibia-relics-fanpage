import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PROTOCOL_SPEC = `
# TibiaRelic 7.72 Protocol Specification (Custom Server)

## File Format (.cam)
- Header: 12 bytes (u32 version + f32 fps + 4 extras)
- Frames: u64 timestamp_ms + u16 payload_size + raw opcodes (no TCP length prefix)

## Key Opcodes (hex → name → payload format)

### Map/Position
- 0x64 MAP_DESC: u16 x, u16 y, u8 z, then multi-floor tile area (18x14 viewport)
- 0x65 SCROLL_N: multi-floor tile STRIP 18x1 (new top row, cam moves north, y--)
- 0x66 SCROLL_E: multi-floor tile STRIP 1x14 (new right column, cam moves east, x++)
- 0x67 SCROLL_S: multi-floor tile STRIP 18x1 (new bottom row, cam moves south, y++)
- 0x68 SCROLL_W: multi-floor tile STRIP 1x14 (new left column, cam moves west, x--)
- 0x69 TILE_UPD: u16 x, u16 y, u8 z, then single-floor tile read (1x1)
- 0x9a PLAYER_POS: u16 x, u16 y, u8 z

### Things on Map
- 0x6a ADD_THING: u16 x, u16 y, u8 z, then item OR creature marker
- 0x6b CHG_THING: u16 x, u16 y, u8 z, u8 stackpos, then item OR creature marker
- 0x6c DEL_THING: u16 x, u16 y, u8 z, u8 stackpos
- 0x6d MOVE_CR: u16 fromX, u16 fromY, u8 fromZ, u8 stackpos, u16 toX, u16 toY, u8 toZ

### Creature Markers (inside tile reads, ADD_THING, CHG_THING)
- 0x0061 CR_FULL: u32 removeId, u32 newId, str16 name, u8 health, u8 dir, outfit, u8 lightLvl, u8 lightColor, u16 speed, u8 skull, u8 shield
- 0x0062 CR_KNOWN: u32 id, u8 health, u8 dir, outfit, u8 lightLvl, u8 lightColor, u16 speed, u8 skull, u8 shield
- 0x0063 CR_OLD: u32 id, u8 dir

### Outfit Format (TibiaRelic uses u16 looktype)
- u16 looktype: if 0 → u16 itemId; if >0 → u8 head, u8 body, u8 legs, u8 feet

### Floor Change
- 0xBE FLOOR_UP: camZ--, then reads 1 floor area (z=camZ-2 when underground, z=5 when transitioning to surface z=7)
- 0xBF FLOOR_DOWN: camZ++, then reads floors

### Multi-Floor Tile Area
- Surface (z<=7): reads floors from z=7 down to z=0 (8 floors, step=-1)
- Underground (z>7): reads z-2 to min(z+2, 15) (5 floors, step=1)
- For each floor: reads 18x14 tiles with perspective offset = camZ - floorZ
- Tile format: sequence of u16 item IDs or creature markers, terminated by 0xFF00+ (skip count = word & 0xFF)
- Skip tiles: set tile to empty, decrement skip counter

### TibiaRelic Custom Opcodes
- 0xA0 STATS: 20 bytes (no stamina field, unlike standard 7.72)
- 0xA4 SPELL_COOLDOWN: 2 bytes (u16 spellId)
- 0xA7 SET_MODES: 3 bytes (u8 fight + u8 chase + u8 safe)
- 0xA8 CR_SQUARE: 5 bytes (u32 creatureId + u8 color)
- 0xAA TALK: u32 statementGuid, str16 name, u8 type, [position/channel based on type], str16 message
- 0xB6 WALK_CANCEL: 0 bytes (no payload)
- 0xC8 OUTFIT_WINDOW: outfit + u8 rangeStart + u8 rangeEnd

## Analysis Goal
Given byte-level traces from a .cam file, analyze the raw bytes against this protocol specification to:
1. Validate that each opcode consumes the correct number of bytes per the spec above
2. Detect byte drift: where cumulative over/under-consumption causes subsequent opcodes to be misinterpreted
3. Identify unknown or undocumented opcodes that may be TibiaRelic-specific extensions
4. Propose the correct byte consumption for any opcodes where the traces diverge from the spec
5. NOTE: Do NOT assume any parser (JS or C++) is correct. Both may have errors. The spec above is the ground truth.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { frameTraces, question, conversationHistory } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build the messages
    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: `You are an expert binary protocol analyst specializing in Tibia game protocol reverse engineering. 
You analyze byte-level traces from .cam replay files to identify parsing divergences between a working JavaScript parser and a broken C++ parser.

${PROTOCOL_SPEC}

IMPORTANT RULES:
- Be extremely precise about byte positions and opcode boundaries
- When you identify a divergence, show the EXACT bytes involved
- Focus on scroll opcodes (0x65-0x68), floor changes (0xBE/0xBF), and creature opcodes (0x6a-0x6d)
- Always explain HOW MANY bytes the C++ parser would consume vs how many the JS parser consumed
- If you see creature corruption patterns (ghosts, duplicates), trace them back to the byte drift origin
- Provide actionable C++ fix suggestions with exact sed patch patterns when possible
- Respond in Portuguese (BR) since the user speaks Portuguese`
      },
    ];

    // Add conversation history if provided
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push(msg);
      }
    }

    // Build the user message
    let userContent = '';
    if (frameTraces) {
      userContent += `## Frame Traces (byte-level data from JS parser)\n\n\`\`\`json\n${JSON.stringify(frameTraces, null, 1)}\n\`\`\`\n\n`;
    }
    if (question) {
      userContent += `## Question\n${question}`;
    } else {
      userContent += `## Task\nAnalyze these frame traces and identify:\n1. Which frames contain scroll/map/floor opcodes\n2. How many bytes each scroll opcode consumed\n3. Where the C++ parser (reading 1-row strip instead of 18x14) would diverge\n4. What creature corruption would result from the byte drift\n5. Specific fix recommendations for the C++ parser`;
    }

    messages.push({ role: "user", content: userContent });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 400) {
        const t = await response.text();
        console.error("AI gateway 400:", t);
        return new Response(JSON.stringify({ error: "Payload muito grande. Reduza a quantidade de frames ou limpe o histórico." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits to your workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: `AI gateway error: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-cam-protocol error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
