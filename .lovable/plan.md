
# Plano: Remover Referências ao Tibiara e Integrar Mapa Próprio

## Objetivo
1. Remover todas as menções ao "Tibiara" da interface do usuário
2. Integrar o visualizador de mapa do jogo diretamente no projeto
3. Usar as coordenadas já presentes nos links (ex: `#32270,32329,7:2`) para exibir o mapa internamente

---

## Etapa 1: Remover Referências ao Tibiara

**Arquivo:** `src/components/ItemDetailsModal.tsx`

Alterações:
- Remover o bloco "Fonte: Tibiara" (linhas 223-233)
- Remover o link "Buscar no Tibiara" do estado de erro (linhas 172-179)

---

## Etapa 2: Aguardar Upload dos Arquivos do Mapa

Você mencionou que vai me enviar:
- **Imagens dos tiles** do mapa (PNGs)
- **Código do visualizador** (HTML + JS)

Após receber os arquivos, irei:

1. **Analisar a estrutura do visualizador** para entender:
   - Como as coordenadas `X,Y,Z:ZOOM` funcionam
   - Como os tiles são carregados
   - Dependências necessárias (se houver)

2. **Converter para React**:
   - Criar componente `src/components/MapViewer.tsx`
   - Adaptar a lógica JavaScript para React/TypeScript
   - Manter a mesma funcionalidade de navegação

3. **Organizar os assets**:
   - Imagens do mapa em `public/map/` ou similar
   - Estrutura de pastas conforme o visualizador original

---

## Etapa 3: Integrar Mapa no Modal

**Nova funcionalidade:**

Quando o usuário clicar no ícone de mapa (MapPin) em um NPC:
- Em vez de abrir link externo, abre um modal/drawer com o mapa interno
- As coordenadas após o `#` (ex: `32270,32329,7:2`) serão parseadas:
  - `32270` = coordenada X
  - `32329` = coordenada Y  
  - `7` = andar/floor (Z)
  - `2` = zoom

```text
+-----------------------------------------+
|  Mapa - Localização do NPC              |
|-----------------------------------------|
|                                         |
|    [Visualizador de Mapa Interativo]    |
|    Mostrando coordenadas X,Y no floor Z |
|                                         |
|    [Marcador indicando posição do NPC]  |
|                                         |
+-----------------------------------------+
```

---

## Arquivos a Criar/Modificar

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Modificar | `src/components/ItemDetailsModal.tsx` | Remover refs ao Tibiara |
| Criar | `src/components/MapViewer.tsx` | Visualizador de mapa React |
| Criar | `src/components/MapModal.tsx` | Modal para exibir o mapa |
| Criar | `public/map/` | Pasta para tiles do mapa |
| Modificar | Edge Function | Extrair apenas coordenadas (sem URL completa) |

---

## Próximos Passos

1. **Imediato**: Remover referências ao Tibiara do código atual
2. **Aguardando você**: Envie os arquivos do mapa (imagens + código)
3. **Após receber**: Analisar e converter para React

Por favor, faça o upload dos arquivos do mapa para eu analisar a estrutura e implementar a integração completa.
