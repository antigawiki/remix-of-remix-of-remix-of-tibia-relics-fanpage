

## Spy Floor - Ver Através do Chão no Player .cam

### O que faz

Adiciona um botão "Spy Floor" no player de .cam que, ao ser ativado:
1. Desativa a detecção de teto (`calcFirstVisibleFloor`) -- isso faz o renderer mostrar TODOS os andares, incluindo os de baixo
2. Torna os tiles de chão (ground, `isGround === true`) semi-transparentes (25% opacidade) no andar atual
3. Paredes, escadas, itens e criaturas permanecem 100% opacos
4. O resultado: você consegue ver cavernas, túneis e salas escondidas por baixo do chão em tempo real durante a gravação

O servidor do jogo já envia dados de 2-3 andares ao redor do jogador. O renderer já renderiza múltiplos andares de baixo para cima (z+2 primeiro, depois z+1, depois z). Então o andar de baixo JÁ está sendo desenhado -- só está escondido pelo chão opaco do andar de cima.

### Como funciona visualmente

```text
Renderização normal:          Com Spy Floor:
  Floor z (opaco)               Floor z (chão transparente 25%)
  esconde tudo abaixo           paredes/itens opacos
                                Floor z+1 visível por baixo!
                                Floor z+2 visível por baixo!
```

### Mudanças técnicas

**Arquivo 1: `src/lib/tibiaRelic/renderer.ts`**

- Adicionar propriedade pública `spyFloor: boolean = false`
- No `getVisibleFloors()`: quando `spyFloor` ativo, ignorar `calcFirstVisibleFloor` e forçar todos os andares visíveis (de z+2 até z-2, ou 0 até 7 na superfície)
- No Pass 1 (ground rendering, linhas 214-236): quando `spyFloor` ativo e o floor sendo desenhado é o floor atual do jogador (`fz === z`), aplicar `globalAlpha = 0.2` apenas para items com `isGround === true` e `stackPrio === 0`. Restaurar `globalAlpha = 1.0` logo após. Bordas (`stackPrio 1, 2`) e paredes (`stackPrio 3`) permanecem opacas.

Mudança no Pass 1 (dentro do loop de items):
```typescript
// Antes de desenhar o item ground:
const useXray = this.spyFloor && fz === z && it.isGround && it.stackPrio === 0;
if (useXray) oc.globalAlpha = 0.2;

this.drawItemNative(it, bx, by, elevationOffset, ph, wx, wy);

if (useXray) oc.globalAlpha = 1.0;
```

Mudança no `getVisibleFloors`:
```typescript
if (this.spyFloor) {
  if (z <= 7) {
    // Superfície: mostrar do 7 até 0 (todos)
    const floors: number[] = [];
    for (let fz = 7; fz >= 0; fz--) floors.push(fz);
    return floors;
  } else {
    // Subsolo: expandir range para z+2 até z-2
    const floors: number[] = [];
    for (let fz = Math.min(z + 2, 15); fz >= Math.max(z - 2, 0); fz--) floors.push(fz);
    return floors;
  }
}
```

**Arquivo 2: `src/components/TibiarcPlayer.tsx`**

- Adicionar estado `spyFloor` (boolean, default false)
- Adicionar ref `spyFloorRef` sincronizado com o estado (mesmo padrão do `floorOffsetRef`)
- No loop de animação, sincronizar: `engine.renderer.spyFloor = spyFloorRef.current`
- Adicionar botão de toggle na barra de controles (ao lado do controle de andar), usando ícone `Eye` do lucide-react
- Quando ativo, botão fica destacado (cor gold/accent)
- Tooltip: "Spy Floor - ver através do chão"
