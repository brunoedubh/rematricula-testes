# Design Review Results: Dashboard de Pendências

**Review Date**: 2026-03-03
**Route**: `/app` → `app/components/app/DashPendencias.vue`
**Focus Areas**: Visual Design, UX/Usability — foco em visão geral de impacto para o aluno
**Tipo**: Revisão do código + Wireframe de redesign

> **Nota**: Esta revisão foi conduzida via análise estática de código. A rota `/app` é protegida por autenticação, impedindo acesso direto via browser. A captura da tela em modo não-autenticado (estado de dados zerados) está disponível como referência visual.

---

## Summary

O dashboard de pendências tem uma base sólida — métricas corretas, loading states e estados vazios bem tratados. Porém, o foco visual é fraco para o objetivo principal: **entender rapidamente o impacto das pendências sobre os alunos**. O donut chart é pequeno demais para ser o elemento central, os tipos de pendência não permitem comparação visual entre si, e a divisão em abas esconde a informação mais crítica por padrão. O wireframe de redesign propõe uma hierarquia visual repensada com foco em impacto.

---

## Issues

| # | Issue | Criticidade | Categoria | Localização |
|---|-------|-------------|-----------|-------------|
| 1 | **Donut chart de 64×64px é pequeno demais** para ser o elemento central de progresso — não transmite senso de escala ou urgência a uma leitura rápida | 🟠 Alto | Visual Design | `DashPendencias.vue:273` |
| 2 | **Cards "Por Tipo" sem barras proporcionais** — exibem contagens brutas mas não permitem comparar visualmente qual tipo afeta mais alunos (ex: 1.842 vs 312 parece igual em layout) | 🟠 Alto | Visual Design / UX | `DashPendencias.vue:352-411` |
| 3 | **Tab "Por Aluno" é apenas uma tabela plana** — sem ranking de severidade, sem chips de tipo, sem indicação visual de urgência por aluno | 🟠 Alto | UX / Visual Design | `DashPendencias.vue:416-479` |
| 4 | **Informação crítica escondida atrás de abas** — a divisão em "Por Tipo" e "Por Aluno" faz com que o operador precise navegar para ver o quadro completo; ambas as visões deveriam ser simultâneas | 🟠 Alto | UX/Usabilidade | `DashPendencias.vue:322-483` |
| 5 | **Nenhuma seção de "Alunos mais críticos"** — não há forma de identificar rapidamente quais alunos têm o maior número de pendências sem rolar toda a tabela | 🟠 Alto | UX/Usabilidade | `DashPendencias.vue` (ausente) |
| 6 | **`getPendenciasColor` retorna `'warning'` tanto para 1 quanto para 2 pendências** — a escala de severidade é inconsistente; alunos com 1 pendência deveriam ter um visual diferente dos com 2 | 🟡 Médio | UX / Lógica | `DashPendencias.vue:104-109` |
| 7 | **Sem indicador de tendência (delta)** — não há comparação com o período anterior (ex: "+5% vs ontem"), impossibilitando avaliar se a situação está melhorando ou piorando | 🟡 Médio | UX / Contexto | `DashPendencias.vue` (ausente) |
| 8 | **Terminologia ambígua**: "Pendências Ativas" vs "Com Pendências" — a relação entre os dois contadores (nº de registros de pendência vs nº de alunos afetados) não é explicada na UI | 🟡 Médio | UX / Clareza | `DashPendencias.vue:219-235` |
| 9 | **Card de progresso `v-if="resumo.total_aptos > 0"` sem placeholder de empty state** — desaparece completamente quando dados estão zerados, criando um "buraco" visual no layout | 🟡 Médio | UX / Estados | `DashPendencias.vue:267` |
| 10 | **Cards de métrica visualmente uniformes** — as 4 cards têm a mesma hierarquia visual; o card "Com Pendências" deveria ter maior destaque por ser o indicador mais crítico para ação | 🟡 Médio | Visual Design | `DashPendencias.vue:166-263` |
| 11 | **Tabela "Por Aluno" não exibe quais tipos afetam cada aluno** — a coluna `total_pendencias` mostra apenas a contagem, sem nenhum detalhe sobre os tipos de bloqueio | 🟡 Médio | UX / Densidade de informação | `DashPendencias.vue:458-476` |
| 12 | **Sem filtro por severidade na tabela de alunos** — não é possível filtrar "mostrar apenas alunos com 3+ pendências" diretamente | ⚪ Baixo | UX | `DashPendencias.vue:420-432` |
| 13 | **Ícone decorativo de background com `opacity-[0.06]`** — uso de valor arbitrário não-token em todos os 4 cards; prefira uma variável CSS ou valor de token | ⚪ Baixo | Consistência / Código | `DashPendencias.vue:177,195,219,239` |
| 14 | **`shadow-sm` → em Tailwind v4 equivale a `shadow-xs`** — classe de sombra de v3; pode resultar em shadow incorreta dependendo da configuração Tailwind v4 | ⚪ Baixo | Código / Tailwind v4 | `DashPendencias.vue:176,194,218,238,266,323` |

---

## Criticality Legend
- 🔴 **Crítico**: Quebra funcionalidade ou viola padrões de acessibilidade
- 🟠 **Alto**: Impacto significativo na experiência ou na legibilidade dos dados
- 🟡 **Médio**: Problema perceptível que deve ser corrigido
- ⚪ **Baixo**: Melhoria desejável / refinamento

---

## Wireframe de Redesign

O arquivo `.kombai/resources/lofi-wireframe-pendencias-redesign.html` contém a proposta visual completa, incluindo:

```
┌─────────────────────────────────────────────────────────────────┐
│  HERO SECTION (NOVO)                                            │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐  │
│  │  Donut      │  │  Título + Descrição de impacto          │  │
│  │  grande     │  │  [============================  ] 72%   │  │
│  │  140×140px  │  │  Stacked bar (verde | vermelho)         │  │
│  │   72%       │  │  ┌──────┐  ┌──────┐  ┌──────┐          │  │
│  │  Aptos sem  │  │  │7.219 │  │ 641  │  │ 2,1  │          │  │
│  │  bloqueio   │  │  │pend. │  │crít. │  │média │          │  │
│  └─────────────┘  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
┌──────────────────────────────┐  ┌───────────────────────────────┐
│  PENDÊNCIAS POR TIPO (NOVO)  │  │  TOP ALUNOS CRÍTICOS (NOVO)   │
│                              │  │                                │
│  Financeiro        ████████  │  │  1. João C.F. ●●●●● 5         │
│  Contrato          █████     │  │  2. Maria S.  ████○ 4         │
│  Sem oferta        ████      │  │  3. Pedro O.  ████○ 4         │
│  DP não conf.      ██        │  │  4. Ana C.L.  ███○○ 3         │
│  Pend. E2A2        █         │  │  5. Ricardo L ███○○ 3         │
└──────────────────────────────┘  └───────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  TABELA UNIFICADA (Expand de UTabs existente)                   │
│  [Todos (3.486)] [Críticos 3+] [Alerta 2] [1 pendência]        │
│  Nome | Matrícula | Instituição | Pendências | Tipos | Ação     │
└─────────────────────────────────────────────────────────────────┘
```

### Componentes novos a criar

| Componente | Descrição | Local sugerido |
|------------|-----------|----------------|
| `ImpactHeroCard.vue` | Seção hero com donut grande + stacked bar + mini KPIs | `app/components/app/` |
| `DonutProgressChart.vue` | SVG donut reutilizável, tamanho configurável | `app/components/app/` |
| `StackedImpactBar.vue` | Barra horizontal proporcional verde/vermelho | `app/components/app/` |
| `TipoPendenciaBarList.vue` | Lista de tipos com barra proporcional ao % afetado | `app/components/app/` |
| `TopAlunosCriticosPanel.vue` | Painel dos 10 alunos com mais pendências | `app/components/app/` |

### Componentes existentes a reutilizar

| Componente | Reutilização |
|------------|-------------|
| `UCard`, `UBadge`, `UButton` | Containers, badges de tipo, botão de atualizar |
| `UTable`, `UInput` | Tabela detalhada e busca |
| `UTabs` | Filtros de severidade na tabela (tabs: Todos / Críticos / Alerta / 1 pend.) |
| `USkeleton`, `UAlert`, `UIcon` | Loading states e banner de erro |
| `AppHeader.vue` | Sem alteração |

---

## Next Steps (Priorização)

1. **🟠 Alta prioridade** — Implementar `ImpactHeroCard` com donut maior e `StackedImpactBar` para substituir o card de progresso atual
2. **🟠 Alta prioridade** — Criar `TipoPendenciaBarList` com barras proporcionais no lugar dos cards planos de tipo
3. **🟠 Alta prioridade** — Adicionar `TopAlunosCriticosPanel` como visão rápida de alunos mais afetados
4. **🟡 Média prioridade** — Converter tabs em layout side-by-side (split) para exibir Tipos e Alunos simultaneamente
5. **🟡 Média prioridade** — Adicionar colunas de tipos de bloqueio e filtros de severidade na tabela de alunos
6. **🟡 Média prioridade** — Corrigir `getPendenciasColor` para 3 níveis distintos (1 = info, 2 = warning, 3+ = error)
7. **⚪ Baixa prioridade** — Adicionar deltas de tendência e corrigir classes Tailwind v4
