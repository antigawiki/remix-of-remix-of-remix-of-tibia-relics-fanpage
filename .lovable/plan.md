
# Plano: Adicionar Quest de Acesso a Sawsank

## Resumo

Adicionar a quest completa de Acesso a Sawsank seguindo o mesmo modelo da quest de Ankrahmun, com suporte a todos os 4 idiomas (PT, EN, ES, PL) e incluindo todas as imagens do documento.

---

## Estrutura da Quest

### Informações Gerais
- **Título**: Acesso a Sawsank
- **Level**: 0 (sem requerimento de level)
- **Premium**: Não especificado (deixar como false)
- **Disponível**: Sim

### Requerimentos
- 20 gold para comprar 1 beer
- Itens/Suprimentos para matar alguns skeletons, ghouls e 1 Demon Skeleton

### Recompensas
- Acesso à ilha de Sawsank
- Autorização para viajar para Sawsank via pescador Bruno (100 gold)

---

## Seções da Quest

| # | Tipo | Título | Descrição |
|---|------|--------|-----------|
| 1 | text | Início da Quest | Explicação sobre a Lei Seca em Carlin |
| 2 | dialogue | Conversa com Bonecrusher | Diálogo sobre Sawsank e troublemakers |
| 3 | text | Comprando a Beer | Ir à taverna do Karl e comprar beer |
| 4 | dialogue | Provocando a Guarda | Diálogo de crime + usar beer |
| 5 | text | Em Sawsank | Conversar com Lana Bonecrusher |
| 6 | dialogue | Conversa com Lana | Sobre undead na ilha |
| 7 | text | Explorando a Montanha | Ir à montanha noroeste |
| 8 | text | Descendo na Caverna | Cuidados ao descer |
| 9 | text | Enfrentando o Demon Skeleton | Combate com criaturas |
| 10 | text | Pegando a Pilha de Ossos | Clicar no caixão |
| 11 | parchment | Mensagem | "You have found a pile of bones." |
| 12 | dialogue | Entregando a Prova | Diálogo de liberdade com Lana |
| 13 | text | Reportando à General | Ir até Bunny Bonecrusher |
| 14 | dialogue | Conversa com Bunny | Liberação do acesso |
| 15 | text | Acesso Liberado | Instruções finais sobre Bruno |
| 16 | credits | Créditos | Spoiler cedido por Ondeth Waters |

---

## Arquivos a Criar/Modificar

### Novos Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/data/quests/sawsankAccess.ts` | Dados completos da quest |
| `public/quests/sawsank/` | Pasta com todas as imagens |

### Arquivos a Modificar
| Arquivo | Alteração |
|---------|-----------|
| `src/data/quests/index.ts` | Importar e adicionar a nova quest no array |

---

## Imagens a Copiar

| Origem | Destino |
|--------|---------|
| `img_p0_1.jpg` | `public/quests/sawsank/bonecrusher-sawsank.jpg` |
| `img_p1_1.jpg` | `public/quests/sawsank/karl-tavern.jpg` |
| `img_p3_1.png` | `public/quests/sawsank/cave-entrance.png` |
| `img_p4_1.png` | `public/quests/sawsank/demon-skeleton.png` |
| `img_p5_1.jpg` | `public/quests/sawsank/coffin-bones.jpg` |
| `img_p6_1.jpg` | `public/quests/sawsank/lana-freedom.jpg` |
| `img_p7_1.jpg` | `public/quests/sawsank/bunny-general.jpg` |
| `img_p8_1.jpg` | `public/quests/sawsank/credits-celebration.jpg` |

---

## Traduções

Todas as seções terão tradução para os 4 idiomas:

### Exemplo - Título
```typescript
title: {
  pt: "Acesso a Sawsank",
  en: "Access to Sawsank",
  es: "Acceso a Sawsank",
  pl: "Dostęp do Sawsank",
}
```

### Exemplo - Descrição
```typescript
description: {
  pt: "Descubra a prisão secreta de Carlin quebrando a Lei Seca.",
  en: "Discover Carlin's secret prison by breaking the Dry Law.",
  es: "Descubre la prisión secreta de Carlin rompiendo la Ley Seca.",
  pl: "Odkryj sekretne więzienie Carlin, łamiąc Prawo Suchej.",
}
```

---

## Detalhes Técnicos

### Estrutura do Arquivo sawsankAccess.ts

```typescript
import { Quest } from "./index";

export const sawsankAccess: Quest = {
  id: "sawsank-access",
  slug: "sawsank-access",
  title: { ... },
  description: { ... },
  level: 0,
  premium: false,
  available: true,
  requirements: {
    items: [
      { pt: "20 gold para comprar 1 beer", en: "20 gold to buy 1 beer", ... },
      { pt: "Itens/Suprimentos para...", en: "Items/Supplies to...", ... },
    ],
  },
  rewards: [
    { pt: "Acesso à ilha de Sawsank", en: "Access to Sawsank island", ... },
  ],
  sections: [
    // 16 seções conforme tabela acima
  ],
};
```

### Atualização do index.ts

```typescript
import { sawsankAccess } from "./sawsankAccess";

export const quests: Quest[] = [
  explorerSocietyAnkrahmun,
  sawsankAccess,
];
```

---

## Resumo da Implementação

| Item | Quantidade |
|------|------------|
| Arquivos novos | 1 (sawsankAccess.ts) |
| Arquivos modificados | 1 (index.ts) |
| Imagens a copiar | 8 |
| Seções da quest | 16 |
| Idiomas suportados | 4 (PT, EN, ES, PL) |
