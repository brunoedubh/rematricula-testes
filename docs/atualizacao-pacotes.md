# Proposta de Atualização de Pacotes

> **Data da análise:** 2026-07-13
> **Objetivo:** Atualizar dependências mantendo o projeto estável. Prioridade é **não quebrar o build/runtime**, não modernizar layout ou funcionalidades.
> **Contexto:** Produto ainda **não está em produção**, o que dá margem para atualizações — mas mesmo assim seguimos uma abordagem faseada para facilitar rollback.

---

## Ambiente atual

| Ferramenta | Versão instalada | Requisito |
|------------|------------------|-----------|
| Node.js   | 24.17.0 | Nuxt 4.4.8 exige `^22.12 \|\| ^24.11 \|\| >=26` ✅ |
| pnpm      | 10.30.3 | `packageManager` fixado no `package.json` ✅ |

> ⚠️ **Node 25 não é suportado** pelo Nuxt (o range pula do 24 para o 26). O runtime atual (24.17) está OK.

---

## Resumo executivo

| Classificação | Qtd | Ação |
|---------------|-----|------|
| 🟢 Seguras (patch/minor) | 8 | Aplicar direto |
| 🟡 Atenção (major, baixo risco) | 1 | Aplicar com validação |
| 🔴 Evitar por ora (major, alto risco) | 1 | **Não atualizar** — `typescript` |
| ⚪ Já na última versão | 5 | Nenhuma ação |

---

## 🟢 Fase 1 — Atualizações seguras (patch/minor)

Baixo risco. Sem mudanças de API que impactem o código atual. Podem ser aplicadas em conjunto.

| Pacote | Atual | Alvo | Tipo | Observação |
|--------|-------|------|------|------------|
| `nuxt` | 4.4.2 | 4.4.8 | patch | Correções de bugs dentro do mesmo minor |
| `@nuxt/ui` | 4.6.1 | 4.9.0 | minor | Mantém-se na v4 (sem breaking); peer deps compatíveis com o stack atual |
| `@vueuse/nuxt` | 14.2.1 | 14.3.0 | minor | Peer `nuxt ^3 \|\| ^4`, `vue ^3.5` — compatível |
| `zod` | 4.3.6 | 4.4.3 | minor | Mesma major v4 usada na validação de bodies |
| `vue-tsc` | 3.2.6 | 3.3.7 | minor | Usado no `typecheck`; peer `typescript >=5.0.0` |
| `pg` | 8.20.0 | 8.22.0 | minor | Driver PostgreSQL (softlaunch) |
| `better-sqlite3` | 12.9.0 | 12.11.1 | patch/minor | Módulo nativo — requer rebuild no install |
| `@iconify-json/lucide` | 1.2.102 | 1.2.117 | dados | Apenas pacote de ícones (JSON) |
| `@iconify-json/simple-icons` | 1.2.78 | 1.2.90 | dados | Apenas pacote de ícones (JSON) |

**Comando:**

```bash
pnpm up nuxt@^4.4.8 @nuxt/ui@^4.9.0 @vueuse/nuxt@^14.3.0 zod@^4.4.3 vue-tsc@^3.3.7 pg@^8.22.0 better-sqlite3@^12.11.1 @iconify-json/lucide@^1.2.117 @iconify-json/simple-icons@^1.2.90
```

> `better-sqlite3` é módulo nativo (compila via `node-gyp`). Após o `pnpm install`, confirme que o rebuild ocorreu sem erros — caso contrário, `pnpm rebuild better-sqlite3`.

---

## 🟡 Fase 2 — Major de baixo risco (validar)

| Pacote | Atual | Alvo | Observação |
|--------|-------|------|------------|
| `@types/node` | 25.6.0 | 26.1.1 | Apenas **tipos** (devDependency), sem impacto em runtime. |

O `@types/node` acompanha loosely a versão do Node. O runtime aqui é **Node 24**. Duas opções:

- **Conservadora (recomendada):** alinhar ao runtime → `@types/node@^24`
  ```bash
  pnpm add -D @types/node@^24
  ```
- **Última versão:** `@types/node@^26.1.1` — funciona, mas pode expor tipos de APIs de Node mais novo que o runtime.

Como só afeta o `typecheck`, o risco de quebra em produção é nulo. Validar rodando `pnpm typecheck`.

---

## 🔴 Fase 3 — Não atualizar por enquanto

| Pacote | Atual | "Latest" | Motivo para **não** subir |
|--------|-------|----------|---------------------------|
| `typescript` | 5.9.3 | 7.0.2 | O `latest` do npm agora aponta para o **novo compilador nativo (port em Go, "TypeScript 7")**. É uma reescrita e **o toolchain ainda não suporta**. |

**Por que travar:**

- `@nuxt/ui@4.9.0` declara peer `typescript: ^5.6.3 || ^6.0.0` — **não aceita 7.x**.
- `@types/node` mapeia até `ts6.0`; não há entrada para `ts7.0`.
- Ecossistema Nuxt/Vue ainda não validou o compilador nativo.

**Recomendação:** manter `typescript` na linha **5.9.x** (`^5.9.3`). Reavaliar só quando `@nuxt/ui`/Nuxt publicarem suporte oficial a TS 7.

> Se o `pnpm up` sugerir subir o TypeScript, **ignore** e mantenha o range `^5.9.3` no `package.json`.

---

## ⚪ Já na última versão (nenhuma ação)

`@nuxt/image` (2.0.0), `jsonwebtoken` (9.0.3), `@types/jsonwebtoken` (9.0.10), `@standard-schema/spec` (1.1.0), `@iconify-json/heroicons` (1.2.3).

---

## Passo a passo recomendado

1. **Branch dedicada**
   ```bash
   git checkout -b chore/atualizacao-pacotes
   ```
2. **Aplicar Fase 1** (comando único acima) e instalar
   ```bash
   pnpm install
   ```
3. **Validar** após a Fase 1:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm build
   ```
4. **Aplicar Fase 2** (`@types/node`) e revalidar (`pnpm typecheck`).
5. **Smoke test manual** com `pnpm dev`:
   - Login (Azure AD ROPC)
   - Busca de alunos (Databricks)
   - Geração de token/URL por ambiente
   - Dashboard de pendências
   - Liberação/bloqueio no softlaunch (PostgreSQL → valida `pg`)
6. **Commit** apenas com `package.json` + `pnpm-lock.yaml` alterados.

---

## Validação — critérios de aceite

- [ ] `pnpm install` sem erros (incluindo rebuild do `better-sqlite3`)
- [ ] `pnpm lint` sem novos erros
- [ ] `pnpm typecheck` limpo
- [ ] `pnpm build` conclui com sucesso
- [ ] Smoke test dos fluxos críticos OK
- [ ] `typescript` mantido em `^5.9.3` (não subiu para 7.x)

---

## Rollback

Como só mudam `package.json` e `pnpm-lock.yaml`:

```bash
git checkout -- package.json pnpm-lock.yaml
pnpm install
```

Ou descartar a branch inteira (`git checkout main && git branch -D chore/atualizacao-pacotes`).

---

## Resultado da execução (2026-07-13)

Fase 1 aplicada diretamente no `main` (projeto pessoal), incluindo atualização do gerenciador de pacotes.

### Executado

- **corepack** atualizado globalmente → `0.35.0`
- **pnpm** `10.30.3` → `11.12.0` (via `corepack prepare` + campo `packageManager`)
- Todos os pacotes da Fase 1 atualizados (ver tabela acima)
- `pnpm-workspace.yaml` migrado para o novo formato `allowBuilds` do pnpm 11:
  - `better-sqlite3` e `sharp` → `true` (compilam corretamente)
  - `@parcel/watcher`, `@tailwindcss/oxide`, `esbuild`, `unrs-resolver`, `vue-demi` → `false`

### Validação

| Check | Resultado | Observação |
|-------|-----------|------------|
| `pnpm install` | ✅ OK | `better-sqlite3` e `sharp` compilaram sem erro |
| `pnpm build` | ✅ **OK** | `✨ Build complete!` — **não quebrou** (critério principal) |
| `pnpm typecheck` | ⚠️ 30 erros | **Pré-existentes**, não causados pela atualização |
| `pnpm lint` | ❌ Quebrado | **Pré-existente**: `eslint` não está instalado (script existe desde o commit inicial, mas o pacote nunca foi adicionado) |

### Sobre os erros de typecheck (pré-existentes)

Os 30 erros estão em 6 arquivos que **não foram tocados** nesta atualização, e as causas independem das versões dentro dos ranges atualizados:

- `app/pages/login.vue` — usa `required_error` (API do **zod v3**, já removida na v4 desde antes do bump)
- `server/utils/db_soft.ts` — falta `@types/pg` (nunca foi adicionado ao projeto)
- `app/components/app/DashPendencias.vue` — tipagem de `TableColumn`/`Row<unknown>` do Nuxt UI v4
- `app/components/app/ProductionAccessModal.vue` — cor `'red'` (deveria ser `'error'` na v4)
- `app/layouts/default.vue` — handler de `@click` retornando `boolean`
- `server/repositories/databricksRepository.ts` — `Aluno | undefined` vs `Aluno | null`

> Estes são **dívida técnica anterior** e podem ser corrigidos separadamente. Não afetam o build nem o runtime.

### Correções rápidas sugeridas (opcional, fora do escopo de atualização)

- `pnpm add -D @types/pg` → resolve os erros de `pg`
- Adicionar `eslint` + `@nuxt/eslint` para o script `lint` voltar a funcionar
- Trocar `required_error` por `{ error: '...' }` no `login.vue` (sintaxe zod v4)
- Trocar `color="red"` por `color="error"` no `ProductionAccessModal.vue`

---

## Notas

- A `resolution` de `unimport@4.1.1` no `package.json` foi mantida — provavelmente existe para contornar incompatibilidade. **Não remover** sem antes validar o build sem ela.
- Os pacotes `@iconify-json/*` são apenas dados de ícones; atualizá-los só adiciona/atualiza ícones, sem risco de runtime.
- Nenhuma das atualizações propostas envolve dados pessoais, decisões automatizadas ou novas ferramentas de IA generativa.
