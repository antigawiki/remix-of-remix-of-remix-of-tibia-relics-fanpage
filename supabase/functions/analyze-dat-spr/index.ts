import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAT_SPEC = `
# TibiaRelic 7.72 DAT File Format Specification

## File Header
- u32 signature (e.g. 0x439852BE)
- u16 itemMaxId (items start at ID 100)
- u16 outfitMaxId
- u16 effectMaxId
- u16 missileMaxId

## Entry Format (per item/outfit/effect/missile)

### Phase 1: Attribute Flags (variable length, terminated by 0xFF)
Each attribute starts with a u8 flag byte, some followed by a payload:

| Flag | Name | Payload |
|------|------|---------|
| 0x00 | Ground | u16 speed |
| 0x01 | TopOrder1 | none |
| 0x02 | TopOrder2 | none |
| 0x03 | TopOrder3 | none |
| 0x04 | Container | none |
| 0x05 | Stackable | none |
| 0x06 | MultiUse | none |
| 0x07 | ForceUse | none (HYPOTHESIS: may have u16 payload) |
| 0x08 | WriteOnce | u16 maxTextLen |
| 0x09 | Writeable | u16 maxTextLen |
| 0x0A | FluidContainer | none |
| 0x0B | Splash | none |
| 0x0C | Blocking | none |
| 0x0D | NotMovable | none |
| 0x0E | BlockMissile | none |
| 0x0F | BlockPath | none |
| 0x10 | Pickupable | none |
| 0x11 | Hangable | none |
| 0x12 | HookSouth | none |
| 0x13 | HookEast | none |
| 0x14 | Rotateable | none |
| 0x15 | Light | u16 intensity + u16 color (4 bytes) |
| 0x16 | DontHide | none |
| 0x17 | Translucent | none |
| 0x18 | Displacement | u16 x + u16 y (4 bytes) |
| 0x19 | Elevation | u16 height |
| 0x1A | LyingCorpse | none |
| 0x1B | AnimateIdle | none |
| 0x1C | LensHelp | u16 value (HYPOTHESIS: may be u32) |
| 0x1D | FullGround | u16 value (HYPOTHESIS: may be u32) |
| 0x1E-0x4F | Boolean flags | none (HYPOTHESIS: some may have hidden payloads) |
| 0xFF | Terminator | end of attributes |

### Phase 2: Dimensions (after 0xFF terminator)
- u8 width
- u8 height
- if (width > 1 || height > 1): u8 exactSize (skip 1 byte)
- u8 layers
- u8 patternX
- u8 patternY
- u8 patternZ (TibiaRelic-specific, may NOT exist in all versions)
- u8 animationCount
- spriteCount = width * height * layers * patX * patY * patZ * animCount
- u16[spriteCount] spriteIds (each is u16 LE)

## Hypotheses to Test

### Hypothesis A: Flag 0x07 has u16 payload
Standard 7.72: 0x07 (ForceUse) is boolean (no payload).
If TibiaRelic adds a u16 payload, every item with flag 0x07 would cause +2 byte drift.

### Hypothesis B: Flags 0x08/0x09 have 4-byte payload instead of 2
Standard: u16 maxTextLen (2 bytes). If TibiaRelic uses u32 (4 bytes), +2 drift per occurrence.

### Hypothesis C: Flags 0x1C/0x1D have 4-byte payload instead of 2
Standard: u16 (2 bytes). If TibiaRelic uses u32 (4 bytes), +2 drift per occurrence.

### Hypothesis D: Unknown flag between 0x1E-0x1F with payload
Maybe 0x1E has a u16 payload instead of being boolean.

### Hypothesis E: Some flags in 0x1F-0x4F have hidden payloads
If certain flags in this range consume extra bytes, it would cause drift for items that have those flags.

### Hypothesis F: Sprite IDs are u32 instead of u16
This would double the bytes consumed in the sprite ID section, causing massive drift after the first item.

## Validation Criteria
A correct parse hypothesis should produce:
- width/height: 1-4 (rarely up to 8)
- layers: 1-3
- patX/patY: 1-4
- patZ: 1-2
- animCount: 1-8 (rarely up to 16)
- spriteIds: all within range [0, maxSpriteId] from .spr file
- No remaining bytes at end of file (or very few)
- Known items should match expected sprite IDs
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { itemDumps, datStats, question, conversationHistory } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: `You are an expert binary file format analyst specializing in Tibia .dat and .spr file parsing.
You analyze raw hex dumps of item entries from .dat files to validate parsing logic and test different hypotheses about flag payloads and data sizes.

${DAT_SPEC}

IMPORTANT RULES:
- You MUST manually parse the hex bytes step by step for each hypothesis
- Show the EXACT byte positions where each flag is read and how many bytes it consumes
- For each hypothesis, count how many items end up with valid vs invalid dimensions
- Compare sprite IDs against the max sprite count from the .spr file
- When a hypothesis produces better alignment, show WHY with concrete byte evidence
- If you find the correct hypothesis, provide the EXACT code fix for the extractMetadata function
- Do NOT assume the current parser is correct — it may have errors
- Respond in Portuguese (BR) since the user speaks Portuguese
- Be precise about byte offsets (use hex notation: 0x00, 0x01, etc.)
- When showing hex dumps, annotate each byte with what it represents`
      },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        messages.push({ role: msg.role, content: msg.content.slice(0, 3000) });
      }
    }

    let userContent = '';
    if (datStats) {
      userContent += `## DAT File Stats\n\`\`\`json\n${JSON.stringify(datStats, null, 1)}\n\`\`\`\n\n`;
    }
    if (itemDumps) {
      userContent += `## Item Hex Dumps (raw bytes from .dat)\n\`\`\`json\n${JSON.stringify(itemDumps, null, 1)}\n\`\`\`\n\n`;
    }
    if (question) {
      userContent += `## Question\n${question}`;
    } else {
      userContent += `## Task\nAnalyze these item hex dumps and test each hypothesis (A through F). For each:\n1. Parse the bytes manually following the hypothesis rules\n2. Check if the resulting dimensions (w,h,layers,pat,anim) are valid\n3. Check if sprite IDs fall within the valid range\n4. Score which hypothesis produces the most valid items\n5. Recommend the exact code changes needed in extractMetadata()`;
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
        return new Response(JSON.stringify({ error: "Payload muito grande. Reduza o range de items." }), {
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
  } catch (e: Error | unknown) {
    console.error("analyze-dat-spr error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
