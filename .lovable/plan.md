

# Melhoria na Detecao de Looktype e Auto-Correcao de Outfits

## Problema
1. A deteccao u8/u16 e feita apenas uma vez no inicio da cam, mas algumas cams podem ter frames onde o modo escolhido gera outfits invalidos
2. Criaturas com outfits que nao existem no .dat sao renderizadas com sprites errados em vez de serem corrigidas

## Solucao

### 1. Validacao per-frame com auto-correcao no PacketParser (`src/lib/tibiaRelic/packetParser.ts`)

Adicionar logica de auto-correcao diretamente no `readOutfit`:
- Apos ler um outfit, verificar se o looktype existe no `dat.outfits`
- Se nao existir e o valor for plausivel no modo alternativo, fazer rollback do buffer e re-ler com o outro modo (u8 em vez de u16 ou vice-versa)
- Manter contadores de acertos/erros por modo para ajustar dinamicamente

Mudancas:
- Adicionar metodo `tryReadOutfitWithFallback(r: Buf)` que tenta ler no modo atual, e se o outfit nao existir no .dat, faz rollback e tenta no modo alternativo
- Adicionar contadores `u8Hits`, `u16Hits` para rastrear qual modo acerta mais
- A cada N criaturas (ex: 20), se o modo alternativo tiver mais acertos, trocar o modo padrao (`this.looktypeU16`) automaticamente

### 2. Deteccao inicial mais robusta (`src/components/TibiarcPlayer.tsx`)

Melhorar `evaluateParseMode`:
- Aumentar o peso de outfits validos vs invalidos no scoring
- Adicionar verificacao de sanidade nos valores de head/body/legs/feet (devem ser 0-132 para cores validas do Tibia 7.x)
- Penalizar mais fortemente outfits com valores de cor fora do range

### Detalhes Tecnicos

**`packetParser.ts` - Novo metodo `tryReadOutfitWithFallback`:**
```text
readOutfit(r) {
  savedPos = r.pos - (looktypeU16 ? 2 : 1)  // antes do looktype
  oid = readLooktype(r)  // modo atual
  if oid == 0: r.u16(); return zero outfit
  h,b,l,f = r.u8() x4

  // Validacao: outfit existe no .dat e cores sao validas?
  if oid > 0 && (!dat.outfits.has(oid) || h > 132 || b > 132 || l > 132 || f > 132):
    // Tentar modo alternativo
    r.pos = savedPos
    altOid = ler com modo inverso (u8 se era u16, u16 se era u8)
    if altOid > 0 && dat.outfits.has(altOid):
      altH,altB,altL,altF = r.u8() x4
      if cores validas: usar este resultado, incrementar altHits
    else:
      restaurar pos original apos leitura normal, incrementar currentHits

  // A cada 20 criaturas, avaliar se deve trocar modo
  if totalChecks % 20 == 0 && altHits > currentHits * 1.5:
    trocar this.looktypeU16
```

**Arquivos modificados:**
- `src/lib/tibiaRelic/packetParser.ts` - Adicionar fallback com re-parse e contadores adaptativos
- `src/components/TibiarcPlayer.tsx` - Melhorar scoring da deteccao inicial com validacao de cores

