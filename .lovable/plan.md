

## AI-Powered Protocol Byte Analyzer

### The Idea

Build a new tool ("AI Byte Lab") that extracts raw frame data from the .cam file starting at a user-specified time (e.g., minute 59), processes each frame through the JS parser with full byte-level tracing, and sends the data to an AI model (Gemini 2.5 Pro via Lovable AI) to analyze the byte patterns and identify where the C++ parser diverges.

### How It Works

```text
┌─────────────────────────────────────────────────┐
│  User loads .cam → selects time range (e.g. 59m)│
│  → "Analyze with AI" button                     │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│  JS Parser processes frames with DEEP tracing:  │
│  - Every opcode: position before/after, bytes   │
│  - Every tile read: items, creatures, skips     │
│  - Every creature event: add/move/delete/known  │
│  - Bytes consumed per operation                 │
│  - Full hex dump of problematic sections        │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│  Edge Function sends to Gemini 2.5 Pro:         │
│  - Protocol spec (opcode definitions)           │
│  - Sequence of frames with byte traces          │
│  - Known C++ parser behavior for each opcode    │
│  - Creature state before/after each frame       │
│  AI returns: where bytes diverge, what the C++  │
│  parser would read differently, suggested fix   │
└─────────────┬───────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│  Results displayed in UI:                       │
│  - Frame-by-frame AI analysis                   │
│  - Identified byte drift points                 │
│  - Suggested opcode size corrections            │
│  - Iterative: user can re-run on specific frames│
└─────────────────────────────────────────────────┘
```

### What the Deep Tracer Captures (per frame)

For each frame in the selected range (~20-50 frames at a time to fit context):
- Raw hex dump of entire payload
- Opcode-by-opcode trace: `{opcode, posStart, posEnd, bytesConsumed, description}`
- For scroll/mapDesc: per-floor bytes consumed, tiles read, skip counts
- For creature opcodes (0x6a, 0x6b, 0x6c, 0x6d): creature ID, type (FULL/KNOWN/OLD), position, name
- Creature state snapshot: list of all creatures with positions before and after the frame
- Any anomalies detected (WALK_FAIL, unknown words, buffer stuck)

### What the AI Prompt Contains

A structured prompt with:
1. Protocol specification (all opcodes and their byte formats for TibiaRelic 7.72)
2. Known C++ parser divergences (scroll dimensions, floor ranges, creature read format)
3. The trace data for the batch of frames
4. Question: "Where does the byte stream stop being parsed correctly? What opcode reads the wrong number of bytes? How should the C++ parser read this data?"

### Files to Create/Change

1. **`supabase/functions/analyze-cam-protocol/index.ts`** — Edge function that receives frame traces and sends to Gemini 2.5 Pro with protocol context. Returns AI analysis.

2. **`src/lib/tibiaRelic/deepTracer.ts`** — New module that wraps PacketParser with instrumented byte-level tracing. Captures every read operation, not just opcodes. Records creature state snapshots.

3. **`src/components/cam-analyzer/AiByteLabTab.tsx`** — New tab in the Cam Analyzer page with:
   - Time range selector (start minute, number of frames to analyze)
   - "Analyze with AI" button
   - Results panel showing AI's analysis per frame batch
   - Ability to drill into specific frames and re-analyze
   - Chat-like interface for iterative analysis (send follow-up questions about specific frames)

4. **`src/pages/CamAnalyzerPage.tsx`** — Add the new "AI Byte Lab" tab

### Technical Details

- **AI Model**: `google/gemini-2.5-pro` (best for large context + complex reasoning)
- **Batch size**: ~20-30 frames per AI call (to stay within context limits while providing enough sequence data)
- **Trace format**: Compact JSON with hex strings (not arrays) to minimize token usage
- **Iterative flow**: User can select specific frames from the results and ask the AI to analyze them more deeply
- **Protocol spec**: Embedded in the edge function as a structured reference document

### Why This Can Work

The JS parser already works correctly for all frames. By capturing exactly what the JS parser reads byte-by-byte, and comparing that against how the C++ parser would interpret the same bytes, an AI model with the full protocol spec can identify the exact divergence point. The key insight is that we have a **working reference** (the JS parser) and need to find where the **C++ parser differs**.

