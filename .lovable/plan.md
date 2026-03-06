

## Plano: Validador Local de DAT/SPR (sem IA)

### Problema

A IA estourou a cota e não pode mais ajudar. Precisamos de uma ferramenta determinística, 100% local, que teste múltiplas hipóteses de leitura do `.dat` e reporte qual produz os melhores resultados — sem depender de nenhuma API externa.

### O que será construído

**1. Novo módulo: `src/lib/tibiaRelic/datValidator.ts`**

Uma classe `DatValidator` que relê o `.dat` bruto com diferentes configurações de flag payload e pontua cada uma:

```text
Hipóteses testadas:
  baseline  — parser atual (0x07=bool, 0x08/09=u16, 0x1C/1D=u16)
  hyp_A     — 0x07 tem payload u16
  hyp_B     — 0x08/0x09 têm payload u32 (4 bytes)
  hyp_C     — 0x1C/0x1D têm payload u32 (4 bytes)
  hyp_D     — 0x1E tem payload u16
  hyp_E     — scan byte-a-byte de 0x1F-0x4F procurando flags com payload oculto
  hyp_F     — sprite IDs são u32 em vez de u16
```

Para cada hipótese, o validador:
- Parseia TODOS os items do .dat
- Conta items com dimensões válidas (w/h 1-4, layers 1-3, anim 1-8)
- Conta items com sprite IDs dentro do range do .spr
- Mede bytes restantes no final do arquivo (deve ser ~0)
- Verifica os 3 items de referência (102→42, 408→39, 870→559)
- Gera um **score** comparativo

Saída: tabela comparativa no console + objeto JSON para exibição na UI.

**2. Atualizar `DatSprTester.tsx` — modo local**

Substituir a dependência da IA por um botão "Validar Localmente" que:
- Roda o `DatValidator` direto no browser (não precisa de edge function)
- Exibe tabela comparativa das hipóteses com scores
- Destaca a hipótese vencedora
- Mostra os primeiros N items que divergem entre hipóteses (para inspeção manual)
- Opcional: hex dump dos bytes brutos ao redor de items problemáticos

**3. Extração de hex dumps brutos**

O `DatLoader` atual descarta os bytes brutos após o parse. Vamos adicionar um modo de extração que salva os bytes crus de cada entry (do início dos flags até o final dos sprite IDs), permitindo inspeção visual na UI sem depender da IA.

Para isso, o `DatValidator` receberá o `ArrayBuffer` original e fará seus próprios passes independentes — não usa a instância do DatLoader existente.

### Arquivos

- **Criar**: `src/lib/tibiaRelic/datValidator.ts` — validador multi-hipótese
- **Editar**: `src/components/cam-analyzer/DatSprTester.tsx` — UI local sem IA

### Resultado esperado

O usuário carrega o .dat, clica "Validar Localmente", e em segundos vê qual hipótese de flag payload produz o melhor alinhamento — tudo no browser, sem consumir cota de IA.

