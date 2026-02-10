

# Adicionar Link do GitHub ao XP Tracker

## Alteração

Adicionar um link para o repositório GitHub do RelicHelper na seção de download do aplicativo desktop, permitindo que usuários acessem o código-fonte.

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/XpTrackerPage.tsx` | Adicionar link do GitHub abaixo do botão de download |

## Detalhes

Na seção "Desktop App" do XP Tracker, logo após o botão de download, será adicionado um link secundário para o repositório:

- URL: `https://github.com/Josubah/RelicHelper`
- Estilo: link discreto com ícone do GitHub (usando lucide `Github` icon)
- Texto: "Código-fonte no GitHub" (com traduções nos 4 idiomas)

Também serão adicionadas as traduções correspondentes nos arquivos `pt.ts`, `en.ts`, `es.ts` e `pl.ts`, e o tipo em `types.ts`.

