

## Diagnostico: Bug fundamental no DatLoader (Phase 1 scan)

### Causa raiz

O `datLoader.ts` usa uma abordagem de 2 fases que esta fundamentalmente quebrada:

```text
Phase 1: Escaneia byte a byte ate encontrar 0xFF
Phase 2: Re-le os bytes de atributo para extrair metadata
```

**O problema**: A Phase 1 trata QUALQUER byte 0xFF como o terminador. Mas campos de dados (u16) podem conter 0xFF como um dos seus bytes. Exemplo:

```text
Item com flag 0x00 (Ground) + speed = 0x00FF (255):
Bytes: [0x00] [0xFF] [0x00] ... [0xFF terminador real]
                ^
                Phase 1 para AQUI — acha que é o terminador
```

Isso causa:
1. **Dimensoes erradas** — apos o "falso 0xFF", le bytes de atributos como width/height
2. **Sprite IDs errados** — le lixo como IDs de sprites
3. **Desalinhamento cascata** — todos os items subsequentes ficam corrompidos
4. **isStackable/isFluid errados** — o extractionParser consome bytes errados no protocolo → byte drift → tiles perdidos

O projeto de referencia (Cam Mapper) usa um **parser sequencial de passagem unica** que le cada flag e consome exatamente os bytes corretos de dados. Nunca faz scan cego por 0xFF — so para quando le a flag 0xFF como uma flag.

### Plano de correcao

**Arquivo: `src/lib/tibiaRelic/datLoader.ts`**

Substituir o sistema de 2 fases (`readEntry` + `extractMetadata`) por um parser sequencial de passagem unica, copiando a logica exata do `DatReader.ts` do projeto de referencia:

1. Ler flags em loop `do { flag = readByte() } while (flag !== 0xFF)`
2. Para cada flag conhecida (0x00-0x1F), consumir exatamente os bytes corretos
3. Para flags desconhecidas, fazer scan de recuperacao ate 0xFF (como o ref faz)
4. Depois das flags, ler dimensoes e sprites normalmente
5. Manter o suporte a `patZ` (TibiaRelic-especifico) na leitura de sprites

Isso corrige: items com sprites errados, flags isStackable/isFluid erradas, e por consequencia a extracao de tiles.

**Apos a correcao**: Re-extracao obrigatoria (limpar DB + re-upload dos .cam).

