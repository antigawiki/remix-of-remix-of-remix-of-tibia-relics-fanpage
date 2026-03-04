

# Research: TTM and Game::Tibia::Cam repositories

## Game::Tibia::Cam (athreef)

**Verdict: Not useful.**

This is a Perl library that converts TibiCam `.rec` files to `.pcap` (Wireshark captures). It handles only the old TibiCam format (XOR encrypted, Adler32 checksums). It has no protocol parsing logic and no rendering. The only output is pcap files for Wireshark analysis. Irrelevant to our TibiaRelic 7.72 WASM player.

---

## Tibia Time Machine (TTM) by tulio150

**Verdict: Highly valuable reference for protocol correctness.**

TTM is a complete Tibia recording proxy/player supporting protocols 7.0 to 10.20, written in C++. It acts as a local proxy that intercepts game packets, saves them as `.ttm` files, and replays them through the real Tibia client. Key findings:

### 1. File Formats Documentation (`File Formats.txt`)

TTM documents **every** recording format precisely:
- `.ttm` format: `u16 version + u8 hostLen + [host] + u32 totalTime + loop(u16 packetSize + payload + u8 nextType + delay)`
- `.rec` (TibiCAM) v1-v6 with encryption details
- `.tmv` (TibiaMovie) with gzip compression
- `.cam` (TibiaCam TV) with LZMA compression
- `.tcam`, `.byn`, `.recording` (TibiaCast) formats

This means TTM could **convert** any of these formats into `.ttm` which tibiarc already supports. If we ever want to support other recording formats, TTM's format spec is the definitive reference.

### 2. Video Light Control (`video.cpp` + `parser.cpp`)

TTM has a `SetLight` command and `ConstructPlayerLight` function:

```cpp
// video.cpp line ~2018
VOID SetLight(CONST BYTE Light) {
    Parser->ConstructPlayerLight(Current->Login->PlayerID, Light);
    if (!Proxy::SendConstructed()) return Logout();
}

// parser.cpp line ~2110
VOID Parser700::ConstructPlayerLight(CONST DWORD PlayerID, CONST BYTE Level) CONST {
    if (AllocPacket(Proxy::Extra, 7)) {
        GetByte() = 0x8D;        // creature light opcode
        GetDword() = PlayerID;
        GetByte() = Level;       // 0-255
        GetByte() = 0xD7;        // light color (white)
        FinishPacket(Proxy::Extra);
    }
}
```

TTM approaches lighting by **injecting a fake 0x8D (creature light) packet** into the stream, overriding the player's light radius. It doesn't modify the renderer; it modifies the protocol data. This is relevant because it confirms that tibiarc's C++ parser **already handles opcode 0x8D** — it reads `u32 creatureId + u8 level + u8 color`. The data just needs to flow through to the renderer (which currently ignores it).

### 3. Protocol Parser Structure (Parser Classes)

TTM uses an inheritance-based parser with versioned classes: `Parser700 → Parser710 → Parser713 → Parser720 → Parser722 → Parser735 → Parser761 → Parser771 → Parser820 → Parser830...`

For our version (7.72), the relevant class is **`Parser771`**. Key details from Parser771:
- Game login packet size is exactly **133 bytes** (`Misflow(133)`)
- Packet format: `u8(0x0A) + u16(2) + u16(version) + RSA(128 bytes containing XTEA key + GM flag + u32 account + string name + string password)`
- Outgoing game uses `ParseRSA()` + `ReadEncryptionKey()` for XTEA

### 4. GetPacketType — Opcodes the Proxy Needs to Parse

TTM's `GetPacketType()` only parses specific opcodes it needs for proxy functionality (0x0A login, 0x15 info, 0x6F close container, 0x7C/7D/7F trade, 0x9F basic data, 0xA3 cancel target). For all other opcodes, it returns `TRUE` (pass-through). This confirms that **TTM does NOT parse most game opcodes** — it relies on the Tibia client for rendering.

### 5. Key Protocol Insight: Player Data (0x0A)

For version 7.13+ (which includes 7.72):
```cpp
BOOL Parser713::ParsePlayerData() {
    if (Overflow(7)) return FALSE;
    PlayerID = GetDword();
    if (GetWord() != 0x32) return FALSE;  // beat duration = 50ms
    ReportBugs = GetByte();               // 1 byte for reportBugs
    return TRUE;
}
```

This is 7 bytes total: `u32 playerId + u16 beatDuration(0x32) + u8 reportBugs`. This matches our parser.

---

## Actionable Findings

### What can help our WASM player RIGHT NOW:

1. **Light injection approach**: Instead of modifying the tibiarc renderer, we could inject modified opcode 0x8D packets into the recording data before feeding it to the WASM player — the same approach TTM uses. However, this was already rejected as "feio" (ugly) by the user.

2. **TTM format conversion**: The `.ttm` format documentation is the most complete reference for Tibia recording formats ever published. If users have old TibiCAM or TibiaMovie recordings, we now know the exact binary format to convert them.

3. **Protocol confidence**: TTM confirms that for 7.72 (Parser771), the protocol structure is identical to standard 7.7x Tibia, not custom. This means our byte drift issues in the WASM player are specifically caused by **TibiaRelic's custom opcodes** (0xA4, 0xA7, 0xA8, 0xB6) that diverge from standard Tibia 7.72, not from a fundamental protocol misunderstanding.

### What CANNOT help:

- TTM has no rendering engine — it forwards packets to the real Tibia client
- TTM's parser is designed for proxy interception, not for visual playback
- The opcode parsing in TTM is minimal (only what's needed for proxy operations)
- Game::Tibia::Cam is completely irrelevant

### Bottom Line:

Neither repository provides a direct fix for the WASM player's current issues. The bugs stem from **TibiaRelic's custom protocol extensions** (non-standard opcodes with different payload sizes), which are unique to this server and not documented anywhere. The fix path remains: improve the `fix-scroll-floor-range.patch` and add additional `sed` patches to the build workflow for the divergent opcodes (0xA4, 0xA7, 0xA8, 0xB6).

