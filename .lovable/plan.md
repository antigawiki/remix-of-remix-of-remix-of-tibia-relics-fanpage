

## Diagnóstico: O crash no cave provavelmente é causado por protocol flags erradas no C++ 7.72

Analisei o código-fonte completo do tibiarc (`parser.cpp`, `versions.cpp`) para entender exatamente quais flags de protocolo estão ativas na versão 7.72 e onde há risco de byte drift.

### Flags de protocolo para 7.72

O tibiarc configura as seguintes flags como **TRUE** para 7.72:
- SkullIcon (7.20+), ShieldIcon (7.24+), OutfitsU16 (7.70+), ReportMessages (7.70+)

E **FALSE** (o que pode ser o problema):
- **OutfitAddons** (7.80+) — se TibiaRelic envia addons, falta 1 byte por creature
- **SpeakerLevel** (7.80+) — se TibiaRelic envia speaker level, faltam 2 bytes por talk
- **Stamina** (7.80+) — se TibiaRelic envia stamina, faltam 2 bytes no player data
- **PassableCreatures** (8.53+) — se TibiaRelic envia passable flag, falta 1 byte por creature

### Bug crítico encontrado: Opcode 0x92 (CreatureImpassable)

O `ParseCreatureImpassable` tem um `ParseAssert(Version_.Protocol.PassableCreatures)` que é **FALSE para 7.72**. Se TibiaRelic envia o opcode 0x92, o parser **LANÇA EXCEÇÃO e perde o frame inteiro**. Este opcode é typicamente enviado quando criaturas se movem em áreas densas — exatamente caves!

Da mesma forma, outros opcodes podem causar problemas se TibiaRelic os enviar com dados diferentes do esperado pelo 7.72 padrão.

### Plano: Patches no C++ + diagnóstico + rebuild

**Passo 1: Adicionar patches preventivos ao workflow de build**

Editar `.github/workflows/build-player.yml` para adicionar novos sed commands:

```bash
# 5. CreatureImpassable (0x92): remove assert que crasha em 7.72
sed -i 's/ParseAssert(Version_.Protocol.PassableCreatures);//' lib/parser.cpp

# 6. OutfitAddons: forçar true para 7.72 (TibiaRelic pode enviar addons)
sed -i '/Protocol.OutfitAddons = true;/d' lib/versions.cpp
sed -i '/Protocol.OutfitsU16 = true;/a\        Protocol.OutfitAddons = true;' lib/versions.cpp

# 7. Passable creature in CR_OLD (0x63): remove assert se existir
sed -i '/PassableCreatureUpdate/d' lib/parser.cpp
```

**Passo 2: Adicionar printf diagnóstico para validar**

Adicionar printf ao redor do dispatch de opcodes no `ParseNext` para logar cada opcode processado e bytes restantes. Isso permitirá ver no console do browser exatamente onde o parsing falha:

```bash
# Diagnóstico: logar cada opcode
sed -i 's/switch (reader.ReadU8()) {/auto _op = reader.ReadU8(); printf("[DIAG] opcode=0x%02X rem=%zu\\n", _op, reader.Remaining()); switch (_op) {/' lib/parser.cpp
```

**Passo 3: Rebuild via GitHub Actions**

Disparar o workflow `build-player.yml` para recompilar o WASM com os patches.

**Passo 4: Testar e iterar**

Com os logs de diagnóstico, o user carrega o arquivo da cave problemática e verifica o console. Os printf mostrarão exatamente qual opcode falha e quantos bytes sobram.

### Mudanças

| Arquivo | Mudança |
|---------|---------|
| `.github/workflows/build-player.yml` | Adicionar sed patches para 0x92, OutfitAddons, e printf diagnóstico |

### Nota importante

Se OutfitAddons for a causa, cada creature seen (0x61), creature updated (0x62), creature outfit (0x8E), e outfit dialog (0xC8) passarão a ler o byte extra de addons. Em caves com muitas criaturas, isto resolve dezenas de bytes de drift por frame.

Após confirmar quais patches funcionam via diagnóstico, removeremos os printf e faremos um build final limpo.

