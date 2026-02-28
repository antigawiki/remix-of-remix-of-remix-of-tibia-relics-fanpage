

## Adicionar botao "Gerar Mapa" na pagina de extracao

### Problema
Os tiles estao sendo salvos no banco (`cam_map_tiles`) mas a compactacao em chunks 8x8 (`cam_map_chunks`) nao esta acontecendo de forma confiavel apos o upload. O viewer do mapa depende dos chunks para renderizar, entao sem eles o mapa fica vazio.

### Solucao
Adicionar um botao "Gerar Mapa" na barra superior, ao lado do botao "Limpar DB", que executa `compact_tiles_to_chunks` para todos os 16 andares (0-15) sob demanda. Isso permite ao usuario gerar/regenerar o mapa a qualquer momento, independente do fluxo de extracao.

### Mudancas

**Arquivo: `src/pages/CamBatchExtractPage.tsx`**

1. Adicionar icone `Map` do lucide-react nos imports
2. Criar estado `generating` (boolean) para controlar o loading do botao
3. Criar funcao `generateMap` que:
   - Itera de z=0 ate z=15 chamando `compact_tiles_to_chunks(p_floor: z)`
   - Atualiza `compactStatus` com o progresso ("Gerando mapa... andar X/16")
   - Exibe toast de sucesso/erro ao final
4. Adicionar o botao na barra superior com confirmacao (AlertDialog), estilizado em gold, mostrando spinner durante a geracao
5. Remover a compactacao automatica do final do `processAll` (linhas 166-181) para separar as responsabilidades -- o usuario decide quando gerar o mapa

### Layout do botao
O botao ficara na barra superior entre o titulo e os botoes existentes:
```
[<- ] [Upload icon] Batch Extract .cam    [Gerar Mapa] [Limpar DB] [Lang] [Theme]
```

