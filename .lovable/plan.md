

# Plano: Corrigir Quest Explorer Society Conforme Documento

## Problema Identificado

O arquivo `src/data/quests/explorerSocietyAnkrahmun.ts` foi criado com informações **inventadas** que não correspondem ao documento original:

**Erros no arquivo atual:**
- Menciona "barco de Darashia" como acesso a Ankrahmun (incorreto)
- Diálogos inventados que não correspondem ao documento
- Sequência de passos errada
- Não inclui as imagens do documento
- Layout separado em muitos cards (usuário quer mais fluido/junto)

## Correções a Implementar

### 1. Copiar Imagens do Documento

Imagens a copiar para `public/quests/explorer-society/`:

| Arquivo Original | Uso |
|-----------------|-----|
| img_p0_1.jpg | Localização do Mortimer |
| img_p2_1.jpg | Dragon Necklace quest - passo 1 |
| img_p3_1.jpg | Dragon Necklace quest - passo 2 |
| img_p4_1.jpg | Dragon Necklace quest - passo 3 |
| img_p4_2.jpg | Dragon Necklace quest - passo 4 |
| img_p5_1.jpg | Entrega ao Mortimer |
| img_p6_1.jpg | Localização do Caleb (Venore) |
| img_p6_2.jpg | Corpo do Caleb |
| img_p8_1.jpg | Passagem liberada para Ankrahmun |

### 2. Reescrever Dados da Quest (Conforme Documento)

**Requerimentos (do documento):**
- 1 Pick
- Itens/Suprimentos para matar alguns beholders

**Fluxo correto da quest:**

1. **Início**: Falar com Mortimer (mostrar imagem img_p0_1.jpg)
2. **Primeira conversa**: 
   - hi → priorities → help → yes
   - Mortimer pede um Dragon Necklace
3. **Dragon Necklace**: Fazer a quest em Thais (galeria: img_p2_1, img_p3_1, img_p4_1, img_p4_2)
4. **Entregar Dragon Necklace**: Voltar ao Mortimer (img_p5_1)
   - hi → mission → yes
   - Mortimer pede para encontrar Caleb
5. **Encontrar Caleb em Venore**: Usar shovel acima da árvore (img_p6_1, img_p6_2)
   - Clicar no corpo para pegar "sheet of tracing"
6. **Falar com Kazzan em Darashia** (não no barco!):
   - report
   - Kazzan libera passagem para o sul (Ankrahmun)
7. **Passagem liberada**: Clicar na porta e passar (img_p8_1)

**Recompensa correta:**
- Acesso a Ankrahmun (passagem pela porta ao sul de Darashia, NÃO via barco)

### 3. Novo Layout (Mais Fluido/Junto)

Ao invés de múltiplos Cards separados, usar um único container `news-box` com seções internas:

```text
┌─────────────────────────────────────────────────────────────────┐
│  🗺️ Explorer Society / Acesso a Ankrahmun           👑 Premium │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  REQUERIMENTOS                                                  │
│  • 1 Pick                                                       │
│  • Itens/Suprimentos para matar alguns beholders                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  INÍCIO DA QUEST                                                │
│  Tudo começa com o NPC Mortimer... [📍 Ver no Mapa]             │
│  [Imagem do Mortimer]                                           │
│                                                                 │
│  CONVERSA                                                       │
│  ┌────────────────────────────────────────────┐                 │
│  │ Jogador: hi                                 │                 │
│  │ Mortimer: Greetings, what can I do for you? │                 │
│  │ ...                                         │                 │
│  └────────────────────────────────────────────┘                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  DRAGON NECKLACE                                                │
│  Agora é hora de conseguir um dragon necklace...                │
│  [Galeria de 4 imagens clicáveis]                               │
│                                                                 │
│  ... continua com as próximas seções ...                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/data/quests/explorerSocietyAnkrahmun.ts` | **Reescrever completamente** com dados do documento |
| `src/pages/QuestDetailPage.tsx` | **Refatorar layout** para ser mais fluido (um único container) |
| `public/quests/explorer-society/` | **Criar pasta e copiar 9 imagens** |

---

## Seção Técnica

### Nova Estrutura de Dados

```typescript
// explorerSocietyAnkrahmun.ts - Corrigido conforme documento
export const explorerSocietyAnkrahmun: Quest = {
  id: "explorer-society-ankrahmun",
  slug: "explorer-society-ankrahmun",
  title: { pt: "Explorer Society / Acesso a Ankrahmun", ... },
  description: { 
    pt: "Ajude a Explorer Society e ganhe acesso à cidade de Ankrahmun", 
    ... // SEM mencionar barco
  },
  premium: true,
  available: true,
  requirements: {
    items: [
      { pt: "1 Pick", ... },
      { pt: "Itens/Suprimentos para matar alguns beholders", ... },
    ],
  },
  rewards: [
    { pt: "Acesso a Ankrahmun", ... }, // SEM mencionar barco
  ],
  sections: [
    // Seção 1: Início com Mortimer + imagem
    // Seção 2: Primeira conversa (priorities → help → yes)
    // Seção 3: Dragon Necklace quest + galeria 4 imagens
    // Seção 4: Entrega Dragon Necklace + imagem
    // Seção 5: Missão Caleb (Venore) + 2 imagens
    // Seção 6: Falar com Kazzan em Darashia
    // Seção 7: Passagem liberada + imagem final
  ],
};
```

### Novo Layout QuestDetailPage

```tsx
// Layout fluido com seções separadas por dividers
return (
  <MainLayout>
    <div className="news-box">
      <header className="news-box-header">
        <h2>Explorer Society / Acesso a Ankrahmun</h2>
      </header>
      <div className="news-box-content space-y-6">
        {/* Requerimentos */}
        <section>
          <h3 className="font-semibold mb-2">Requerimentos</h3>
          <ul>...</ul>
        </section>
        
        <Separator />
        
        {/* Cada seção da quest sem cards separados */}
        {quest.sections.map((section) => (
          <section key={...}>
            <h3>{section.title}</h3>
            {/* conteúdo inline */}
          </section>
        ))}
      </div>
    </div>
  </MainLayout>
);
```

### Diálogos Corretos (do documento)

**Primeira conversa com Mortimer:**
```
Jogador: hi
Mortimer: Greetings, what can I do for you?
Jogador: priorities
Mortimer: Our members are constantly exposed to many dangers...
Jogador: help
Mortimer: Do you want to help the explorer society on acquiring some essential equipment?
Jogador: yes
Mortimer: Your help is much appreciated...
Mortimer: Since our explorers are constantly venturing inside deep and dangerous caves...
Mortimer: It is said that there is some kind of amulet called 'dragon necklace'...
Mortimer: For your first mission, I want you to bring me one of these necklaces...
Mortimer: Simple enough? Are you interested in this task?
Jogador: yes
Mortimer: Good! Find a dragon necklace and bring it to me.
Jogador: bye
Mortimer: Good bye.
```

**Conversa com Kazzan:**
```
Jogador: report
Kazzan: By Daraman's tear! The Explorer Society should have shared this information sooner!...
Kazzan: Those people might be still alive, struggling in the wild. They need our support...
Kazzan: I will make it known to the guards that you have my permission to head south...
... (texto completo do documento)
Jogador: bye
Kazzan: May your soul flourish.
```

---

## Resultado Esperado

1. **Dados corretos**: Quest seguindo exatamente o fluxo do documento
2. **Layout fluido**: Uma única caixa com seções internas separadas por dividers
3. **Imagens incluídas**: Todas as 9 imagens do documento em galerias clicáveis
4. **Sem informações inventadas**: Nenhuma menção a "barco de Darashia"
5. **Multi-idioma**: Todas as traduções mantidas

