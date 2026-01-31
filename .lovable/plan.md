
# Plano: Melhorias no Sistema de Idioma e Dark Mode

## Resumo das Mudanças

O usuário identificou 3 problemas:
1. Os controles de idioma/tema estão no footer e ninguém vai ver
2. O dark mode só muda o fundo, precisa ser mais completo
3. A tradução precisa funcionar em TUDO (incluindo notícias e ServerInfo)

---

## Parte 1: Mover Controles para o Header

### Localização Proposta
Os seletores de idioma e tema serão adicionados na barra de navegação principal, após o link "Informações":

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Início │ Equipamentos │ Magias │ Criaturas │ Quests │ Calc │ Info │ 🌐 🌙 │
└────────────────────────────────────────────────────────────────────────────┘
```

### Arquivos Afetados
| Arquivo | Mudança |
|---------|---------|
| `src/components/Header.tsx` | Adicionar LanguageSelector e ThemeToggle na nav bar |
| `src/components/Footer.tsx` | Remover os seletores de lá |

---

## Parte 2: Dark Mode Completo

### Problema Atual
O `.dark` no CSS só altera variáveis básicas. Os componentes estilizados com gradientes hardcoded (parchment, wood-panel, news-box) não respondem ao tema.

### Solução
Criar variantes `.dark` para cada classe personalizada:

| Componente | Tema Claro | Tema Escuro |
|------------|------------|-------------|
| `.parchment` | Bege claro (pergaminho) | Marrom escuro |
| `.news-box` | Pergaminho claro | Fundo escuro com bordas |
| `.news-box-content` | Texto escuro | Texto claro |
| `.wood-panel` | Madeira média | Madeira muito escura |
| `.retro-btn` | Maroon | Maroon mais escuro |
| `.text-text-dark` | Texto escuro | Texto claro |

### Cores do Dark Mode
- Parchment escuro: `hsl(24 25% 18%)` ao invés de `hsl(35 45% 92%)`
- Texto: claro `hsl(35 30% 85%)` ao invés de escuro
- Bordas: mais visíveis com dourado sutil

---

## Parte 3: Traduções Completas

### Componentes que Faltam Traduzir

| Componente | Textos Hardcoded |
|------------|------------------|
| `ServerInfo.tsx` | "Informações do Servidor", "Rates", "Experiência", "Magic", "Skills", "Loot", "Sistema de Skull", etc. |
| `NewsBox.tsx` | Textos dinâmicos (vêm do banco de dados) |
| `Index.tsx` | Notícias estáticas hardcoded |

### Novas Chaves de Tradução

```typescript
serverInfo: {
  title: 'Informações do Servidor',
  rates: 'Rates',
  experience: 'Experiência',
  magic: 'Magic',
  skills: 'Skills',
  loot: 'Loot',
  skullSystem: 'Sistema de Skull',
  pzTime: 'Tempo PZ',
  pzTimeValue: '1 min sem Kill / 15 min com Kill',
  whiteSkull: 'White Skull',
  redSkull: 'Red Skull',
  fragsBan: 'Frags/Ban',
  kills: 'Kills',
  hours: 'horas',
  days: 'dias',
  inHours: 'em {n} horas',
  inDays: 'em {n} dias',
  upTo: 'Até',
  from: 'A partir de',
  banDescription: 'Quando exceder 2x o necessário para Red Skull',
  general: 'Geral',
  updatesComingSoon: 'Informações serão atualizadas em breve',
  visitOfficialSite: 'Visite o site oficial para mais detalhes',
  accessOfficialSite: 'Acessar Site Oficial',
},
news: {
  wikiConstruction: 'Wiki em Construção',
  tibiaRelicServer: 'Tibia Relic - O Servidor',
  // conteúdos das notícias...
}
```

### Notícias do Banco de Dados
As notícias vindas do banco (via `useNews`) precisarão ter campos de idioma ou usar um sistema de tradução no admin. Por enquanto, as notícias estáticas do Index.tsx serão traduzidas.

---

## Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `src/components/Header.tsx` | Adicionar controles de idioma/tema |
| `src/components/Footer.tsx` | Remover controles |
| `src/index.css` | Adicionar estilos dark para parchment, news-box, etc. |
| `src/components/ServerInfo.tsx` | Usar hook de tradução |
| `src/pages/Index.tsx` | Traduzir notícias estáticas |
| `src/i18n/translations/pt.ts` | Adicionar chaves serverInfo e news |
| `src/i18n/translations/en.ts` | Adicionar chaves serverInfo e news |
| `src/i18n/translations/es.ts` | Adicionar chaves serverInfo e news |
| `src/i18n/translations/pl.ts` | Adicionar chaves serverInfo e news |
| `src/i18n/types.ts` | Atualizar tipagem com novas chaves |

---

## Seção Técnica

### Estilos Dark Mode (CSS)

```css
/* Dark mode para parchment */
.dark .parchment {
  background: linear-gradient(
    135deg,
    hsl(24 25% 16%) 0%,
    hsl(24 30% 12%) 50%,
    hsl(24 25% 16%) 100%
  );
  box-shadow: 
    inset 0 1px 0 hsl(35 20% 25% / 0.3),
    inset 0 -1px 0 hsl(24 30% 8% / 0.5),
    0 4px 12px hsl(0 0% 0% / 0.5);
}

/* Dark mode para news-box-content */
.dark .news-box-content {
  @apply text-foreground;
}

.dark .text-text-dark {
  color: hsl(35 30% 85%);
}

/* Dark mode wood-panel mais escuro */
.dark .wood-panel {
  background: linear-gradient(
    180deg,
    hsl(24 35% 12%) 0%,
    hsl(24 40% 6%) 100%
  );
}
```

### Header com Controles

```tsx
{/* Navigation Bar */}
<nav className="hidden md:block wood-panel rounded-sm">
  <ul className="flex items-center justify-center divide-x divide-border/30">
    {/* ... links existentes ... */}
    <li>
      <Link to="/info" className="sidebar-menu-item px-6">{t('navigation.info')}</Link>
    </li>
    {/* Novos controles */}
    <li className="flex items-center gap-1 px-4">
      <LanguageSelector />
      <ThemeToggle />
    </li>
  </ul>
</nav>
```

---

## Ordem de Implementação

1. Atualizar CSS com estilos dark mode completos
2. Mover controles do Footer para Header
3. Adicionar novas chaves de tradução nos 4 arquivos de idioma
4. Atualizar tipos de tradução
5. Aplicar traduções no ServerInfo
6. Aplicar traduções nas notícias do Index
7. Testar tema dark e troca de idiomas

---

## Resultado Esperado

- Controles visíveis e acessíveis no topo da página
- Dark mode que transforma visualmente TODO o site (não só o fundo)
- Todas as seções traduzidas ao mudar o idioma
