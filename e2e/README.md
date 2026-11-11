# rematricula-e2e

Testes de tela da jornada do aluno na rematrícula. Eles gravam cenários reais do HML e depois os reproduzem sem backend. O plano completo está em [PLANO.md](PLANO.md).

## Rodar os testes (sem credencial)
Pré-requisito: Node 24.

```powershell
cd e2e                         # a partir da raiz do rematricula-testes
npm ci                         # 3 pacotes, do npm público
npx playwright install chromium
npm test                       # todos os cenários gravados, desktop + mobile
npm run test:ui                # modo visual, passo a passo
npm run relatorio              # relatório HTML com capturas
```

Por padrão os testes rodam contra o Vue 2 publicado em HML. Para rodar contra outro endereço (por exemplo, o Vue 3 local), defina `ALVO` no `.env.local`:
```
ALVO=http://localhost:5173/rematricula/
```

Outras opções (também usadas pela aba **Execução** da tela "Cenários E2E"):
```powershell
$env:E2E_CENARIOS="fora-do-prazo,erro-api-aluno"; npx playwright test --project=desktop   # só esses cenários, só desktop
```

Cada execução grava um resumo em `resultados/<data>-<hora>-<alvo>.json` (por cenário × dispositivo: passou/falhou, tela esperada × obtida, chamadas sem gravação) e as capturas/traces em `resultados/<id>/artefatos/`. Ficam as 30 execuções mais recentes (`E2E_MANTER_EXECUCOES`). Para abrir um trace: `npx playwright show-trace <arquivo>.zip`.

> As gravações (`gravacoes/`) e os códigos de aluno (`cenarios/alunos.local.json`) ficam fora do git porque têm dados reais. Sem eles, os testes são pulados. Para gerá-los, siga a seção abaixo.

## Gravar um cenário (precisa de link)
1. Copie `.env.example` para `.env.local`.
2. No `rematricula-testes`, gere um link de HML e cole em `HML_LINK=`. **Não compartilhe esse arquivo**: o link contém o seu token.
3. Grave:
   ```powershell
   npm run gravar -- <id-do-cenario> <codigoAluno>
   ```
   O script só navega, sem clicar, e salva `gravacoes/<id>.har` e `gravacoes/<id>.png`.
4. Em `cenarios/catalogo.json`, marque o cenário como `"gravado"` e preencha o `esperado`: parte da URL (`rota`), `textos` e `botoes`. Olhe a captura para escolher.
5. Rode `npm test`. O cenário vira teste sozinho.

## Fluxos com escrita
Ações que gravam no backend (aceitar contrato, enviar e-mail, escolher turma…) ficam em `tests/fluxos/<tela>.spec.mjs`. Cada fluxo abre a gravação de um cenário, responde à ação com uma resposta montada no teste (`responder`, formato tirado do backend) e confere a tela seguinte e o que o front enviou. Nada sai para fora. O id do fluxo é `<cenario>--<fluxo>` e funciona no `E2E_CENARIOS` como o de um cenário. Detalhes no [PLANO.md](PLANO.md) (5.1 e 7.4).

## Status dos cenários
Veja `cenarios/catalogo.json`: `gravado`, `a-gravar`, `nao-encontrado` ou `divergente`.
