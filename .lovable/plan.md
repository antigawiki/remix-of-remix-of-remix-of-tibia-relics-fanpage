

## Correcao Definitiva do Parser: Analise OTClient 7.72

### Metodologia

Comparei handler por handler nosso `packetParser.ts` com o codigo fonte do **OTClient 7.72** (`github.com/peonso/otclient772/src/client/protocolgameparse.cpp`), a referencia definitiva para o protocolo 7.72. Encontrei **multiplos bugs de contagem de bytes** que causam drift progressivo dentro dos frames, resultando nos "Unknown opcode" e tiles fora de posicao.

### Bugs Encontrados

#### BUG 1 - CRITICO: talk (0xAA) le 4 bytes extras
Nosso handler le `r.u32()` no inicio (statement guid). Na referencia OTClient 7.72, esse u32 so existe com a feature `GameMessageStatements`, que nao faz parte do protocolo 7.72 vanilla. Cada mensagem de chat causa **4 bytes de drift** em todos os opcodes seguintes do frame.

Referencia: `if(g_game.getFeature(Otc::GameMessageStatements)) msg->getU32();`
Nosso codigo: `r.u32();` (sempre le, sem condicao)

#### BUG 2 - ALTO: readStats (0xA0) faltam 2 bytes
Nosso handler: `r.skip(20)`. Na referencia, 7.72 com `GamePlayerStamina` le 22 bytes (HP u16 + MaxHP u16 + Cap u16 + Exp u32 + Level u16 + LvlPct u8 + Mana u16 + MaxMana u16 + MLvl u8 + MLvlPct u8 + Soul u8 + **Stamina u16**). Servidores 7.72 OT (OTHire/OTX) enviam stamina. Drift de 2 bytes.

#### BUG 3 - ALTO: WalkWait (0xB6) nao le payload
Nosso handler: `/* walk cancel - no payload */` (le 0 bytes). Referencia: `msg->getU16()` (2 bytes - milissegundos de espera). Cada WalkWait causa 2 bytes de drift.

#### BUG 4 - MEDIO: CreatureUnpass (0x92) handler inexistente
Opcode valido no 7.72. Referencia: `msg->getU32(); msg->getU8()` (5 bytes). Nosso parser nao tem handler, causando erro "Unknown opcode" e perda do resto do frame.

#### BUG 5 - MEDIO: SpellDelay (0xA4) contagem errada
Nosso handler: `r.skip(2)`. Referencia: `msg->getU8(); msg->getU32()` (5 bytes). 3 bytes de diferenca. Nota: opcode marcado como "870+" mas TibiaRelic pode enviar.

#### BUG 6 - MEDIO: MultiUseDelay (0xA6) handler inexistente
Referencia: `msg->getU32()` (4 bytes). Nosso parser nao tem handler. Marcado como "870+".

#### BUG 7 - BAIXO: GMActions (0x0B) nao le payload
Referencia para versoes < 840: le 32 bytes (32x u8). Nosso handler: le 0 bytes. Se o servidor envia, 32 bytes de drift.

#### BUG 8 - BAIXO: RuleViolation handlers (0xAE/0xAF/0xB0) errados
- 0xAE: referencia le u16, nosso le 0
- 0xAF: referencia le string, nosso le 0
- 0xB0: referencia le string, nosso le `r.skip(2)` (fixo 2 bytes em vez de string variavel)

#### BUG 9 - BAIXO: Death (0x28) handler inexistente
Para 7.72 sem features, nao le dados. Mas o opcode precisa existir no dispatch para nao causar "Unknown opcode".

---

### Plano de Implementacao

Todas as mudancas sao no arquivo `src/lib/tibiaRelic/packetParser.ts`.

#### 1. Corrigir talk (0xAA) - Remover u32 statement guid
Remover o `r.u32()` no inicio do handler `talk()`. O protocolo 7.72 vanilla nao envia statement guid.

#### 2. Corrigir readStats (0xA0) - Adicionar stamina
Mudar de `r.skip(20)` para `r.skip(22)` (inclui u16 stamina).

#### 3. Corrigir WalkWait (0xB6) - Adicionar u16
Mudar de `/* walk cancel */` para `r.u16()`.

#### 4. Adicionar handler CreatureUnpass (0x92)
Novo handler: `r.u32(); r.u8()` (5 bytes).

#### 5. Corrigir SpellDelay (0xA4) - Ajustar para 5 bytes
Mudar de `r.skip(2)` para `r.skip(5)` (u8 spellId + u32 delay).

#### 6. Adicionar handler MultiUseDelay (0xA6)
Novo handler: `r.u32()` (4 bytes).

#### 7. Corrigir GMActions (0x0B)
Mudar para `r.skip(32)` (32 violation reason bytes para versoes < 840).

#### 8. Corrigir RuleViolation handlers
- 0xAE: `r.u16()`
- 0xAF: `r.skip16()` (string)
- 0xB0: `r.skip16()` (string)

#### 9. Adicionar handler Death (0x28)
Novo handler sem payload: `/* death, no data for 7.72 */`

### Resultado Esperado

- Eliminacao dos "Unknown opcode 0x0/0x1/0x8" (causados por drift do talk handler)
- Tiles renderizados nas posicoes corretas (sem desalinhamento de dados do mapa)
- Criaturas posicionadas corretamente (movimentos nao perdidos por frames quebrados)
- Estabilidade durante playback longo e seek

