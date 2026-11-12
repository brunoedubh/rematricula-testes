# Plano: rematricula-e2e (cenários e testes de tela da rematrícula)

| | |
|---|---|
| **O que é** | Projeto de testes de tela da jornada do aluno: gera cenários a partir do Databricks, grava cenários reais do HML, reproduz sem backend e mostra o resultado numa tela |
| **Por que separado** | Serve à migração Vue 3 (card #483734), mas também a qualquer card futuro do front e à regressão de cada publicação |
| **Onde fica** | Subpasta `e2e/` do `rematricula-testes`, com `package.json` próprio. A tela "Cenários E2E" (geração, alunos não encontrados, execução) fica no Nuxt do mesmo repositório |
| **Hoje** | **5 cenários + 10 combinações de regras + 2 fluxos com escrita × 2 dispositivos = 34 testes verdes** contra o Vue 2 de HML, conferidos contra as regras de tela do front (3.5). Etapas 1, 2, 4 e 5 com código pronto (2, 4 e 5 ainda precisam ser usadas com login/HML); etapa 6 iniciada (aceite do contrato) |
| **Plano principal** | `refatoracao-rematricula/refatoracao-frontend/PLANO.md` |

---

## 1. Como funciona (validado em 11/11/2026)

```
        GRAVAR (precisa de link)                              REPRODUZIR (sem credencial)
rematricula-testes ─link─▶ gravador ─▶ HML real             teste ─▶ front (ALVO: HML Vue 2 | local Vue 3 | DEV)
                              │                                │
                              └─▶ gravacoes/<cenario>.har ─────┘  API servida da gravação; nada sai para fora
```

- **Gravar:** `npm run gravar -- <cenario> <codigoAluno>` abre o link de impersonate e **só navega, sem clicar**. As respostas da API vão para um HAR. GTM, chat e Cloudflare ficam bloqueados.
- **Reproduzir:** o teste grava uma sessão falsa no `localStorage`, serve a API a partir do HAR e confere tela, textos e botões. Não precisa de token, backend nem Vault.
- **Catálogo:** `cenarios/catalogo.json` define cada cenário (perfil, status, tela e textos esperados). Cada cenário com status `gravado` vira um teste automaticamente.
- **Antes × depois da migração:** a mesma suíte, trocando só o `ALVO`.

Lições da prova de conceito:
- As fixtures do Cypress (2020) não servem: a API mudou.
- O app aceita a sessão falsa e decide a tela pelos dados da API, como em produção.
- Seletores pelo texto visível (`getByRole`/`getByText`) funcionam e não dependem do Vuetify.

---

## 2. Visão: três partes

```
┌──────────────────────── Tela "Cenários E2E" (rematricula-testes) ────────────────────────┐
│                                                                                          │
│  ① GERAÇÃO AUTOMÁTICA          ② ALUNOS NÃO ENCONTRADOS        ③ EXECUÇÃO                 │
│  catálogo de perfis            lista dos `nao-encontrado`      ALVO + dispositivo         │
│  → busca aluno no Databricks   → alguém informa o código       → roda a suíte             │
│  → libera, grava, classifica   → mesma esteira do ①            → passou/falhou, trace,    │
│  → devolve o período             (libera, grava, classifica)     captura, Vue 2 × Vue 3   │
│        │                               │                               ▲                  │
│        └──────────────┬────────────────┘                               │                  │
│                       ▼                                                │                  │
│              catalogo.json + gravacoes/ (anonimizadas) ────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

| Parte | Precisa de credencial/HML? | Quem roda |
|---|---|---|
| ① Geração | Sim (Databricks, liberar, generate-url) | Pessoa do time, na própria máquina, com a própria sessão |
| ② Não encontrados | Sim (mesma esteira do ①) | Qualquer pessoa do time que conhece um aluno do caso |
| ③ Execução | **Não** (só gravações) | Qualquer máquina e o pipeline do front |

**Por que tudo no `rematricula-testes`:** ele já tem Nuxt, login, auditoria (`[AUDIT]`), conexão com o Databricks e o que a esteira usa (busca de alunos, liberar/unlock do soft launch, geração de token). A pasta `e2e/` é o **motor sem credencial** (gravar, classificar, anonimizar, reproduzir, relatório) e a **fonte da verdade** (`catalogo.json` + gravações).

**Quem orquestra a esteira é o servidor Nuxt**, não um script solto: `liberar` e `generate-url` dependem da sessão do Nuxt (em memória, com a senha criptografada), que um script fora dele não tem. A esteira fica em `server/utils/e2e/` e chama os **repositórios** direto (`databricksRepository`, `softLaunchRepository`, `getOrGenerateToken` + `buildAccessUrl`), sem passar pelas rotas HTTP. Para gravar, roda `node e2e/scripts/gravar.mjs --link <url>` como processo filho e lê o resultado (rota final, caminho do HAR). Os scripts de `e2e/` nunca recebem credencial além do link já gerado.

**Separação importante:** a execução (③) nunca depende do Nuxt nem de credencial. `e2e/` tem dependências próprias (Playwright fica fora do Nuxt) e roda sozinho: `cd e2e && npm test`. O pipeline do front faz checkout do `rematricula-testes` e roda só a pasta `e2e/`; a tela só lê os resultados. Se um dia precisar virar repositório próprio, basta tirar a pasta.

---

## 3. Parte ① — Geração automática a partir do Databricks

### 3.1 Partir do catálogo, não de todas as combinações
O `catalogo.json` lista os **perfis que precisamos cobrir** (vindos das regras do front). Para cada perfil sem gravação, o gerador procura um aluno que o satisfaça. Isso evita a explosão de combinações dos 12 indicadores e deixa claro o que falta.

Indicadores da `sb_jira.wv_alunos_rem` × regras do front (`GerenciadorRotasPrioritarias.ts`):

| Indicador | Regra no front | Cenário |
|---|---|---|
| `IND_CONTRATO_LIBERADO = 'N'` | `!contratoEstaLiberado` (e `possuiPendenciasFinanceiras`) | pendência financeira |
| `IND_CONTRATO_LIBERADO` / `IND_CONTRATO_ASSINADO` | `contratoEstaLiberado` / `contratoEstaAceito` | contrato |

> **Pendência financeira = contrato não liberado.** A API calcula `possuiPendenciasFinanceiras = !contratoEstaLiberado && !IND_REG_FINANCEIRO` (`servico-rematricula`, `ObterInformacoesAlunoService.ComporInformacoesFinanceiras`): com contrato liberado ela é sempre falsa, e quem libera o contrato é o financeiro. `IND_REG_FINANCEIRO` sozinho (débito) não leva à tela. Por isso combinação com pendência financeira e contrato liberado é dado impossível: o oráculo avisa (`inconsistencias`) e `regras.test.mjs` recusa a combinação.
| `IND_MEDICINA` | grupo de curso Medicina | telas de Medicina |
| `IND_OFERTA_UCDP` / `IND_CONFIRMADO_UCDP` | `possuiEscolhaUcPersonalizavel` | UC personalizável |
| `IND_OFERTA_CORE` / `IND_CONFIRMADO_CORE` | `possuiEscolhaCoreCurriculum` | core curriculum |
| `IND_*_PEND_ACAD_E2A2` | `possuiEscolhaPendenciaAcademica` | pendência acadêmica E2A |
| `IND_CONFIRMADO_OFERTA_PRINC` | grade confirmada | resumo |
| `QTDE_DP_NA_MAT` | DP | alteração com DP |
| `COD_TPO_PERSONA` nulo | sem persona | mudança acadêmica / ajustando grade |
| `DSC_TPO_GRD_CURRICULAR`, `IND_CALOURO` | modular, E2A, calouro | variações |

Perfis que a visão não enxerga (certificado pendente, telas bloqueadas, remanejamento, erro de API) ficam no catálogo com `fonte: "manual"` e vão direto para a parte ②.

**Sem persona também é `fonte: "manual"`:** `liberar` exige `identificadorpersona`, então aluno com `COD_TPO_PERSONA` nulo não passa pela esteira automática.

### 3.1.1 Formato do `perfil` no catálogo
Cada cenário ganha `fonte: "databricks" | "manual"`. Regra para montar a consulta:
- Chave que é **coluna da view** (`IND_*`, `COD_*`, `QTDE_*`, `DSC_*`) entra no `WHERE`. Chave que não é coluna (`softLaunch`, `api`, `rota`, `tiposBloqueioAcesso`, `indicadorE2a2`…) é descrição para humanos e torna o cenário `fonte: "manual"`.
- Valores:

| No catálogo | No `WHERE` |
|---|---|
| `"S"` / `"N"` | `= 'S'` / `= 'N'` |
| `null` | `IS NULL` |
| `">0"`, `">=2"`, `"<1"` | operador + número (`sanitizeNumber`) |
| `"~modular"` | `LOWER(col) LIKE '%modular%'` |

- O gerador valida os nomes das colunas contra uma lista fixa (a mesma do SELECT); coluna desconhecida = erro, não SQL montado.
- **Pré-requisito da etapa 2:** confirmar na view que existem `IND_CONFIRMADO_UCDP`, `IND_CONFIRMADO_CORE` e `IND_*_PEND_ACAD_E2A2` (hoje não estão no SELECT de `databricks.ts`). `COD_CAMPUS` e `COD_PERIODO_LETIVO`, que o `liberar` precisa, já estão no SELECT.

### 3.2 Consultas
- **Por perfil (principal):** `WHERE` montado a partir do `perfil` do cenário, `ORDER BY rand() LIMIT 5` (candidatos de reserva), mais o `COUNT(*)` de alunos com aquele perfil (prioridade).
- **A view não é o HML:** é a foto de produção de D-1, e o HML é copiado na segunda-feira. Então o aluno pode não existir no HML ou estar em outra situação. Isso é esperado: o indicador só serve para **escolher candidatos**, e a esteira passa para o próximo quando o aluno não abre ou cai em outra tela.
- **Descoberta (opcional, mensal):** a consulta por janela abaixo, para achar combinações reais que o catálogo ainda não tem. Combinação nova com muitos alunos vira sugestão de cenário na tela.

```sql
SELECT * FROM (
  SELECT COD_ALUNO, COD_CURSO, COD_CAMPUS, COD_TPO_PERSONA, COD_PERIODO_LETIVO,
         IND_REG_FINANCEIRO, IND_CONTRATO_LIBERADO, IND_CONTRATO_ASSINADO, IND_MEDICINA,
         IND_OFERTA_UCDP, IND_CONFIRMADO_UCDP, IND_OFERTA_CORE, IND_CONFIRMADO_CORE,
         IND_CONFIRMADO_OFERTA_PRINC, DSC_TPO_GRD_CURRICULAR,
         QTDE_DP_NA_MAT > 0            AS tem_dp,
         COD_TPO_PERSONA IS NULL       AS sem_persona,
         COUNT(*)     OVER w           AS alunos_na_combinacao,
         ROW_NUMBER() OVER (w ORDER BY rand()) AS rn
  FROM sb_jira.wv_alunos_rem
  WHERE COD_PERIODO_LETIVO = :periodo
  WINDOW w AS (PARTITION BY IND_REG_FINANCEIRO, IND_CONTRATO_LIBERADO, IND_CONTRATO_ASSINADO,
                            IND_MEDICINA, IND_OFERTA_UCDP, IND_CONFIRMADO_UCDP, IND_OFERTA_CORE,
                            IND_CONFIRMADO_CORE, IND_CONFIRMADO_OFERTA_PRINC, DSC_TPO_GRD_CURRICULAR,
                            QTDE_DP_NA_MAT > 0, COD_TPO_PERSONA IS NULL)
) WHERE rn <= 2
ORDER BY alunos_na_combinacao DESC
```
> Rascunho, ainda não executado: confirmar nomes e valores dos indicadores (`'S'`/`'N'` ou booleano) rodando uma vez.

### 3.3 Esteira (a mesma para ① e ②)
Roda no servidor Nuxt (`server/utils/e2e/esteira.ts`), um cenário por vez, com trava simples em memória. Para cada cenário pendente:
1. Escolhe o aluno (candidatos do Databricks no ①, código informado no ②).
2. **Anota o estado do `escopo_regra`** da combinação (curso, persona, campus, período): linha existe? qual `datafim`?
3. `releaseStudent` (repositório; chama `liberarAluno` do `db_soft.ts`) da combinação (`datafim` = agora + 23h59). Combinação já liberada por esta mesma execução não é liberada de novo.
4. Token de HML (`getOrGenerateToken`) + `buildAccessUrl` → link de impersonate.
5. `gravar.mjs --link <url>` → HAR + captura + rota final (saída em JSON no stdout).
6. **Classifica pela tela real** (`classificar.mjs`). Quem define o cenário é a rota onde o app parou, não o indicador.
   - rota = `esperado.rota` → `gravado`;
   - não saiu da autorização / erro de aluno inexistente / rota diferente → próximo candidato (que pode ser outra combinação e exigir outro `liberar`);
   - **fora do período** (`erro/rematriculaNaoIniciada`, `erro/rematriculaSoftlaunch`, `ForadePrazo`, a não ser que seja a tela esperada) → resultado `fora-do-periodo`, nunca aprovado como `a-confirmar` (ver 3.3.2);
   - candidatos esgotados com alguma rota diferente → `divergente` (com as rotas observadas);
   - nenhum candidato chegou numa tela da jornada (não abriu ou fora do período) → `nao-encontrado`, com `observado.motivo` (vai para a parte ②);
   - cenário **sem `esperado.rota`** e o aluno abriu → `a-confirmar`: a gravação é guardada e alguém confere a tela (`observado.rota`) e preenche o `esperado`.
   - Cenário já `gravado` (ou `a-confirmar`) não perde a gravação quando uma nova tentativa não confirma.
   - Os candidatos gravam em `gravacoes/candidatos/<id>--<aluno>.*`; só o aprovado vai para `gravacoes/<id>.har`.
7. **Restaura o soft launch no `finally`** (melhor esforço): se a linha não existia, apaga a que foi criada; se existia, volta o `datafim` anotado no passo 2. Se a restauração falhar, só registra no log: HML é ambiente de testes e uma liberação esquecida não causa problema, apenas expira em 23h59. O `blockStudent`/`unlockStudent` atual **não serve para isso**, porque só move o `datafim` para hoje às 23:59. São duas funções novas no `softLaunchRepository`: `lerEscopo` e `restaurarEscopo`.
8. Pós-processa a gravação (hoje: nada; no futuro: anonimiza, ver 3.4) e atualiza o `catalogo.json` (status, `gravadoEm`, `fonte`, quem gerou). Grava em `alunos.local.json` qual aluno foi usado.

### 3.3.1 Avanços: telas que travam antes da tela do cenário (11/11/2026)
**Problema:** pela ordem do `GerenciadorRotasPrioritarias.ts`, o **envio do certificado** (`tiposBloqueioAcesso` com `2`) e o **aceite do contrato** (`liberado && !aceito`, fora Medicina) vêm antes de quase todas as telas. O aluno parava ali, a gravação ficava só com `ObterInformacoesAluno` e o cenário virava `divergente` ou `a-confirmar` na tela errada (ex.: `escolha-disciplinas` observado em `envioCertificado`).

**Por que não clicar:** sair dessas telas exige gravar no HML (enviar o documento, aceitar o contrato). O front não tem "pular" só leitura: o `EnvioCertificado.vue` só tira o bloqueio da store **depois** do envio (`onDocumentoEnviado`).

**Solução (`e2e/scripts/avancos.mjs`):** durante a gravação, a resposta de `ObterInformacoesAluno` é ajustada como ficaria depois da ação: o certificado sai de `tiposBloqueioAcesso` e o contrato fica `contratoEstaAceito = true` (só quando ele travaria, com a mesma condição do front). O front segue para a próxima tela e chama as APIs **reais** dela. Nada é gravado no HML por causa disso.
- `--avancar auto` (padrão): avança tudo **menos a própria tela do cenário** (o `esperado.rota` casa com a rota do avanço). O cenário do contrato pula o certificado, mas não o contrato; o do certificado pula o contrato, mas não o certificado. Sem `esperado`, avança os dois. Também aceita `nao` ou `certificado,contrato`.
- O HAR guarda a resposta já ajustada (conferido), então a reprodução vê o mesmo que a gravação viu. O gravador também anota `log._avancos` no HAR.
- A esteira grava `avancos` no cenário do catálogo; a tela mostra "avançou: …" na Cobertura e nas tentativas. "Criar a partir desta gravação" lê o `_avancos` do HAR.
- **Validado em HML (11/11/2026):** o aluno do `escolha-disciplinas` (antes parado em `envioCertificado`) chegou em `alteracaoresumo` com 10 chamadas reais; a reprodução sem backend chegou na mesma tela sem nenhuma chamada `sem-gravacao`.
- **Atenção:** nessa tela, o próprio front faz um `POST compraonline/.../Matricula/{aluno}/Carregamento` ao abrir (sem clique). Isso já acontecia com qualquer aluno que chega lá, mas não é "só leitura" no sentido estrito. Se for problema, bloquear esse POST no gravador e servir a resposta gravada uma vez.
- Pendência financeira **não** é avançada: é tela de cenário e tem filtro próprio no perfil (`IND_REG_FINANCEIRO`). Novo avanço = um item em `AVANCOS`.

### 3.3.2 Fora do período e massa de teste (11/11/2026)
**Problema visto na tela:** `escolha-disciplinas` virou `a-confirmar` e os 5 candidatos de `medicina-contrato` tinham a mesma captura. Todos pararam em `erro/rematriculaNaoIniciada` ("Estamos fora do período de rematrícula"), com `estaNoSoftLaunch: false` no `ObterInformacoesAluno`. O classificador aceitava essa tela como "abriu, sem esperado".

**Causa:** a liberação usa curso/persona/campus/período **da view** (foto de produção D-1), mas o HML devolve outro período para esses alunos (ex.: Medicina em 13168–13170, `escolha-disciplinas` em 13085). A combinação liberada não é a do aluno no HML.

**O que mudou:**
- `classificar.mjs`: resultado `fora-do-periodo` (testes em `classificar.test.mjs`).
- `gravar.mjs` + `scripts/aluno.mjs`: resumo do aluno **sem dados pessoais** (período, curso, persona, instituição, campus, soft launch, pendência financeira, contrato, bloqueios) no JSON de saída e anotado no HAR em `log._e2e` (com rota e resultado). A tela lê isso, então rota e resultado dos candidatos sobrevivem ao reinício do servidor (antes: 7.2, limitação 3).
- Esteira: candidato `fora-do-periodo` com `estaNoSoftLaunch: false` e combinação do HML diferente da view → libera a combinação do HML (campus da view, o HML não devolve o código) e grava de novo uma vez. Restaurada no `finally` como as outras. `observado.motivo` resume por que nenhum candidato serviu.
- Tela: aba **Massa de teste** (`GET /api/e2e/massa`, `MassaTab.vue`): aluno usado em cada cenário + candidatos tentados, com resultado, tela, período/curso/persona/soft launch do HML, captura, copiar código e CSV. Rótulos dos status mais claros ("Conferir tela", "Sem aluno", "Outra tela") e ajuda em cada resultado.
- Dados corrigidos: a gravação de `escolha-disciplinas` voltou para `candidatos/` e o cenário ficou `nao-encontrado`; `medicina-contrato` passou de `divergente` para `nao-encontrado`. HARs antigos receberam `_e2e` retroativo (`retroativo: true`; rota só onde dava para saber).

**Achados para revisar o catálogo:** os 5 candidatos de `pendencia-financeira` vinham com `possuiPendenciasFinanceiras: false` no HML porque o perfil filtrava `IND_REG_FINANCEIRO = 'N'` com contrato liberado (resolvido: o perfil agora é `IND_CONTRATO_LIBERADO = 'N'`); em `uc-personalizavel` (6346398, 6606555) e `core-curriculum` (6926550) o HML diz que a escolha está pendente, mas o app parou em `alteracaoresumo`/`preVisualizacaoGrade`: conferir se `UcPersonalizavel`/`CoreCurriculum` só aparece depois de um clique (aí a gravação só leitura nunca chega lá e o `esperado.rota` precisa mudar).

### 3.3.3 Descartar aluno e editar o filtro SQL (11/11/2026)
A view é de produção e o HML é copiado na segunda: o filtro às vezes acerta, às vezes não, e quem decide é a captura.
- **Descartar:** na captura (botão "Descartar este aluno"), na aba Massa de teste e na aba Não encontrados. `POST /api/e2e/cenarios/:id/descartar` apaga a gravação do aluno (aprovado: `gravacoes/<id>.*`, sai do `alunos.local.json` e o cenário volta a `a-gravar`; candidato: `gravacoes/candidatos/<id>--<aluno>.*`) e grava o código em `cenarios/descartados.local.json` (fora do git), com quem, quando e o motivo. A esteira inclui `COD_ALUNO NOT IN (…)` no SQL do cenário. O modal oferece "procurar outro aluno agora" (roda a esteira para o cenário). "Permitir" na Massa de teste tira o código da lista.
- **Filtro SQL (WHERE puro):** botão de banco de dados na Cobertura e "Ver / editar filtro SQL" em Não encontrados abrem o WHERE do cenário (o campo `where` do catálogo, ou o montado a partir das colunas do perfil antigo), o SQL exato que a esteira roda com prévia a cada alteração, a lista de colunas da view com o significado (clique insere um exemplo) e "Contar alunos" (`POST /api/e2e/filtro`, só leitura: total + amostra). "Salvar e gerar" grava (`PATCH { where }`) e roda a esteira.
- **Por que o WHERE é validado:** o projeto monta o SQL concatenando texto. `server/utils/e2e/where.ts` aceita só colunas de `COLUNAS_VIEW_E2E` (`types/e2e.ts`, a mesma lista da tela), números, textos entre aspas simples, `= <> != < > <= >=`, `AND OR NOT IN IS NULL LIKE BETWEEN`, `LOWER UPPER TRIM` e parênteses. `;`, comentários, `SELECT`, outra tabela ou barra invertida são recusados com a posição.
- **Manual → Databricks:** cenário manual que ganha um WHERE vira `fonte: databricks`; as chaves de coluna do perfil saem e ficam só as descritivas (ex.: `softLaunch`). "Remover WHERE" volta ao perfil (manual se não houver colunas). Cenário com `softLaunch: "fora"` é gravado sem liberar também na geração automática.
- O perfil antigo (JSON com colunas) continua funcionando enquanto o cenário não ganha um WHERE; aceita listas (`[13064, 13082]` → `IN`, `["!", 13064]` → `NOT IN`).

### 3.5 Regras de tela: o teste confere a regra, não só a gravação (11/11/2026)
**Problema:** o teste conferia se o front parava na mesma tela da gravação, e o "confirmar" de um `a-confirmar` só aceitava a rota que a gravação viu. "Passou" queria dizer "o front repetiu o que fez", não "o front seguiu a regra". Também não se conferia se o aluno gravado era mesmo do cenário (a view é de produção D-1; o HML é outro).

**Oráculo (`e2e/regras/regras.mjs`):** as regras do `GerenciadorRotasPrioritarias.ts` (+ desvio de endereço do contrato e redirects do `router.ts`) em ordem de prioridade, escritas de novo e separadas do front. Dado o `ObterInformacoesAluno` gravado (e as disciplinas, para a pré-visualização da grade), diz a tela final, a regra que decidiu, as que também valiam e os campos lidos. Tabela de decisão em `regras/regras.test.mjs` (`npm run test:unidade`). **Se o front mudar a ordem ou uma condição, este arquivo muda junto** (é a especificação).

**Catálogo:** cada cenário declara `regra` (id, ou lista). `esperado` ganhou `desabilitados` e `naoDeve { textos, botoes }`; `rota` passa a ser conferida no caminho relativo ao app (`^/contrato$`), não na URL inteira.

**Teste (`tests/verificacao.mjs`):** cada conferência vira um item em `verificacoes` no resultado:
1. **massa:** o dado gravado cai na regra do cenário? Se não, o resultado é **massa inválida** (problema do aluno, não do front);
2. **catalogo:** o esperado do catálogo concorda com a regra?
3. **regra:** o front parou na tela que a regra manda?
4. **rota, textos, botões, desabilitados, não deve:** o que o catálogo pede;
5. **api:** chamadas sem resposta gravada (ressalva, não reprova).

**Combinações (`cenarios/combinacoes.json`, `tests/combinacoes.spec.mjs`):** o aluno com duas ou mais condições (certificado + contrato, contrato + financeiro, fora do prazo + contrato, Medicina…). Reaproveita a gravação de um cenário (`base`) e ajusta campos do `ObterInformacoesAluno` (`ajuste`): testa a prioridade entre regras com dado montado, sem precisar achar esse aluno no HML.

**Esteira:** `gravar.mjs --regra` avalia o aluno gravado; se ele abriu mas cai em outra regra, o resultado é `outra-regra` e a esteira passa ao próximo candidato. O HAR guarda a regra em `log._e2e.regra`. Confirmar um `a-confirmar` exige regra, e o aluno gravado precisa cair nela.

**Tela:** aba **Regras** (`GET /api/e2e/regras`): tabela de decisão, cobertura por regra (aluno real / só dado montado / sem gravação / sem teste) e o resultado da última execução. Aba **Execução**: placar de verificações, tela da regra × obtida e o detalhe "por que passou" (regra, campos do aluno, regras que perderam pela prioridade, cada verificação). Cobertura, Massa e Não encontrados mostram a regra que o aluno gravado aciona.

**Achados da primeira execução (11/11/2026):**
- `/erro/rematriculaSoftlaunch` é redirecionada pelo router para `/erro/rematriculaNaoIniciada`: o esperado de `rematricula-nao-iniciada` estava errado (corrigido).
- `uc-personalizavel` e `core-curriculum` "divergentes": pela regra, escolha pendente **com disciplina confirmada** vai para `/preVisualizacaoGrade`, que vem antes. O front está certo; falta um aluno **sem** disciplina confirmada.
- Medicina, assinatura digital: o front chama `contratos/alunos/<codigo>%20%20%20%20/periodos-letivos` (código com 4 espaços na URL). Investigar no front.
- Contrato: a área do PDF aparece vazia na captura da gravação, e o teste antigo passava assim mesmo. Hoje o teste confere textos, botão e "Aceitar contrato" desabilitado antes do aceite; o PDF ainda não é conferido.
- `beforeEach.ts` compara `to.path.toLowerCase() === '/pendenciasAcademica'` (com maiúsculas): nunca é verdadeiro.

### 3.4 Anonimizador (adiado)
> **Adiado (11/11/2026):** hoje só 2 ou 3 pessoas do time usam a ferramenta, e as gravações ficam fora do git (`gravacoes/` está no `.gitignore`). Fazer **antes** de versionar gravações, levar o repositório ao Azure Repos ou ligar ao pipeline do front (etapa 8). Até lá, a esteira grava direto em `gravacoes/` e o passo 8 da 3.3 não anonimiza. Para não fechar a porta: a gravação aprovada passa por um ponto único (`promoverGravacao` em `server/utils/e2e/esteira.ts`), que hoje só move o arquivo; o anonimizador entra ali depois.

Troca nome, CPF, e-mail, telefone, matrícula e tokens por valores fictícios **estáveis** (o mesmo valor real sempre vira o mesmo fictício). Os códigos que amarram as chamadas (aluno, curso, oferta) são trocados de forma consistente em URLs e corpos, para o reprodutor continuar casando as requisições. Ao final, roda um grep de CPF, e-mail, JWT e nomes da lista original. Só gravação anonimizada vai para o git.

**O HAR também guarda segredos, não só dados pessoais:**
- a navegação inicial `autorizacao-idp/token/{access}/{refresh}/{aluno}` (o reprodutor não precisa dela: remover a entrada);
- headers `Authorization`, `Cookie` e `Set-Cookie` de todas as entradas;
- qualquer JWT (`eyJ…`) que apareça em corpo ou query.

O anonimizador pode ser feito e testado já com os HAR que existem em `gravacoes/`.

---

## 4. Parte ② — Alunos não encontrados

Na tela, aba **"Não encontrados"**:
- Lista os cenários `nao-encontrado`, `divergente` e `fonte: manual` sem gravação, com o perfil esperado em linguagem simples ("aluno com contrato liberado e não assinado, sem pendência financeira").
- Campo para informar o **código do aluno** (e, opcionalmente, observação de onde veio).
- Botão **"Gravar"** → roda a esteira 3.3 com esse aluno. O resultado aparece na hora: `gravado`, ou `divergente` mostrando a tela onde o app parou e a captura.
- Se caiu numa tela que não é de nenhum cenário, oferece **"Criar cenário a partir desta gravação"** (título + rota + textos sugeridos pela captura).
- Botão **"Novo cenário"** para casos que alguém conhece e o catálogo não tem.

O código real do aluno fica só no `alunos.local.json` (fora do git) de quem gravou; o catálogo guarda apenas o perfil e o status.

---

## 5. Parte ③ — Execução

Na tela, aba **"Execução"**:
- Escolhe `ALVO` (HML Vue 2, local Vue 3, DEV), dispositivos e cenários (todos, falhados, escolhidos).
- **Rodar** → chama `playwright test` em `./e2e` e acompanha o progresso.
- Resultado por cenário × dispositivo: passou/falhou, tela esperada × tela obtida, link para trace e captura.
- Histórico das últimas execuções (`resultados/<data>-<hora>-<alvo>.json`).
- **Antes × depois** (etapa 7, não entra na 5): capturas Vue 2 × Vue 3 lado a lado (3.5 do antigo plano: `toHaveScreenshot` com referência do Vue 2; diferença no Vue 3 não reprova, vira aprovação do PO).
- **Cobertura:** já atendida pela aba Cobertura da etapa 4 (status, fonte, alunos por perfil, gravações velhas destacadas).

### 5.0 Como ficou (etapa 5, 11/11/2026)
- **Quem escreve o resultado é o motor, não o Nuxt.** O reporter `e2e/scripts/resumo.mjs` grava `resultados/<id>.json` a cada teste (progresso) e no fim. Assim, `npm test` no terminal ou no pipeline gera o mesmo histórico que a tela lê, e a tela nunca guarda cópia.
- **Histórico com capturas e traces:** o `outputDir` do Playwright passou a ser `resultados/<id>/artefatos` (antes, `test-results/` era sobrescrito a cada execução e o histórico perderia as capturas). Ficam as 30 execuções mais recentes. `resultados/` continua fora do git (as capturas mostram dados reais).
- **Tela obtida:** o teste anota `rota-esperada` e `rota-obtida` (rota onde o app parou, relativa ao ALVO); chamadas `sem-gravacao` continuam anotadas.
- **Filtro de cenários:** `E2E_CENARIOS=id1,id2` (o spec filtra o catálogo); dispositivos por `--project`. "Só os que falharam" usa a execução selecionada na tela.
- **Alvos:** HML = `URL_BASE_HML`, DEV = `URL_BASE_DEV`, local = `E2E_ALVO_LOCAL` (padrão `http://localhost:5173/rematricula/`, confirmar porta e base do Vue 3). Sem URL livre na tela.
- **Servidor:** `server/utils/e2e/execucao.ts` roda `node e2e/node_modules/@playwright/test/cli.js test` como processo filho **sem os segredos do Nuxt no ambiente** (Databricks, soft launch, Azure, sessão). Trava própria; não roda junto com a esteira (ela move arquivos em `gravacoes/`), e a esteira também recusa rodar durante uma execução. Cancelar usa `taskkill /T` no Windows para levar junto workers e navegadores.
- **Trace:** baixado pela tela; abre com `npx playwright show-trace` ou em trace.playwright.dev (processa no próprio navegador).
- **GIF do teste realizado:** além da captura final, cada teste gera `artefatos/<teste>/execucao.gif` (fixture automática em `tests/gif.mjs`). O ffmpeg do Playwright não gera GIF, então os quadros vêm do screencast do Chromium (CDP) e o GIF é montado em JS (`jpeg-js` + `gifenc`): até 120 quadros, 800px no máximo, última tela segura 2s. Só em Chromium (os dois dispositivos são); desliga com `E2E_GIF=0`; se falhar, o teste segue sem GIF. Na aba Execução, botão de filme ao lado da captura.

A mesma suíte roda sem a tela: `cd e2e && npm test` local e no pipeline do front (`resources.repositories` com o `rematricula-testes` + `vite preview` + `ALVO` local). O pipeline publica o `resultados/*.json` e o relatório do Playwright como artefato; a tela pode ler de lá.

### 5.1 Fluxos com escrita
A esteira nunca clica em ação que grava. Para escolha de turma, aceite de contrato, protocolo e envio de e-mail:
- o que vem antes da ação sai da gravação;
- a resposta da ação (POST/PUT/PATCH/DELETE) é montada no teste, no formato real. **Fonte do formato:** o controller do backend (os repositórios estão em `refatoracao-rematricula/repos/`) e o uso no front. O **aluno de teste dedicado** (decisão 2) só é necessário para respostas grandes ou montadas pelo backend (seleção de turma, confirmação da alteração), não para começar;
- o **estado depois da ação** também é montado: as chamadas de leitura feitas depois da ação (ex.: `ObterInformacoesAluno`) saem da gravação com o ajuste que a ação causaria (`reprodutor.ajustar`, reaproveitando as regras de `scripts/avancos.mjs`). Só com resposta de sucesso: com erro, o backend não mudou e a leitura volta como gravada;
- o teste confere o que o front faz com a resposta (próxima tela, mensagem, diálogo) **e o que ele enviou** (caminho e corpo);
- cada fluxo testa sucesso e erro da API. Quando o Vue 2 trata o erro de um jeito ruim, o teste registra o **comportamento atual** e diz isso no título; a mudança no Vue 3 é decisão do PO.

Como fica no código: `tests/fluxos.mjs` (`fluxo`, `responder`, `respostaGravada`) e um arquivo por tela em `tests/fluxos/<tela>.spec.mjs`. O fluxo usa a gravação de um cenário e tem id `<cenario>--<fluxo>`; o resumo, a aba Execução e o `E2E_CENARIOS` tratam esse id como um cenário (filtrar pelo cenário de origem roda também os fluxos dele). Os fluxos não ficam no `catalogo.json`: a ação e as respostas são código, não perfil.

**Escrita ao abrir a tela (sem clique):** além do `POST .../Matricula/{aluno}/Carregamento` (3.3.1), a tela do contrato faz `POST contrato/.../log-acesso` ao abrir. Os dois já acontecem com qualquer aluno que chega nessas telas, e a gravação guarda a resposta deles. Na reprodução, nada sai para fora.

---

## 6. Estrutura

```
rematricula-testes/
├─ app/pages/app/cenarios/   ← tela: abas Cobertura | Não encontrados | Execução
├─ app/components/app/e2e/   ← abas (ExecucaoTab.vue), painel da esteira, modais (cenário, captura, senha)
├─ app/composables/useCenariosE2e.ts, useExecucoesE2e.ts, app/utils/cenariosE2e.ts
├─ server/api/e2e/           ← rotas finas, delegam para server/utils/e2e
│  ├─ cenarios/index.get.ts  ← catálogo + arquivos de cada cenário + estado da esteira
│  ├─ cenarios/index.post.ts ← novo cenário (ou a partir da gravação de um candidato)
│  ├─ cenarios/[id].patch.ts ← título/esperado; confirmar a-confirmar → gravado
│  ├─ captura.get.ts         ← PNG de e2e/gravacoes
│  ├─ gerar.post.ts          ← ① roda a esteira para os pendentes
│  ├─ gravar.post.ts         ← ② roda a esteira para um aluno informado
│  ├─ execucoes/index.get.ts ← ③ alvos, estado e histórico
│  ├─ execucoes/index.post.ts← ③ dispara a suíte (segundo plano, 202)
│  ├─ execucoes/[id].get.ts  ← ③ resultado de uma execução (progresso enquanto roda)
│  ├─ execucoes/cancelar.post.ts
│  └─ artefato.get.ts        ← captura/trace de e2e/resultados/<id>/artefatos
├─ server/utils/e2e/
│  ├─ esteira.ts             ← orquestra 3.3 (trava, liberar, token, gravar, classificar, restaurar)
│  ├─ catalogo.ts            ← lê/grava catalogo.json; perfil → WHERE (3.1.1)
│  ├─ cadastro.ts            ← regras de novo/editar/confirmar cenário
│  ├─ arquivos.ts            ← gravações e capturas em e2e/gravacoes
│  ├─ execucao.ts            ← ③ roda a suíte (processo filho sem segredos), trava, histórico
│  └─ processo.ts            ← chama os scripts de e2e/ como processo filho
├─ server/repositories/softLaunchRepository.ts  ← + lerEscopo / restaurarEscopo
└─ e2e/                      ← motor + fonte da verdade (package.json próprio)
   ├─ cenarios/
   │  ├─ catalogo.json       ← versionado: perfis, status, fonte, o que cada tela deve mostrar
   │  └─ alunos.local.json   ← FORA do git: código real do aluno de cada cenário
   ├─ gravacoes/             ← só anonimizadas no git; HAR bruto fica fora
   ├─ scripts/
   │  ├─ gravar.mjs          ← grava um cenário (só leitura); aceita --link
   │  ├─ classificar.mjs     ← rota observada × esperada → status
   │  ├─ resumo.mjs          ← reporter: resultados/<id>.json (progresso + histórico)
   │  ├─ execucao.mjs        ← id da execução (<data>-<hora>-<alvo>)
   │  ├─ anonimizar.mjs
   │  └─ env.mjs
   ├─ tests/
   │  ├─ apoio.mjs           ← sessão falsa + reprodutor por método + caminho (+ ajustar: estado depois da ação)
   │  ├─ cenarios.spec.mjs   ← um teste por cenário gravado
   │  ├─ fluxos.mjs          ← fluxos com escrita: fluxo(), responder(), respostaGravada() (5.1)
   │  └─ fluxos/<tela>.spec.mjs ← ex.: contrato.spec.mjs (aceite, aceite com erro)
   ├─ resultados/            ← <id>.json + <id>/artefatos (capturas, traces) de cada execução; fora do git
   ├─ playwright.config.mjs  ← ALVO + desktop/mobile
   ├─ .env.example / .env.local
   └─ package.json           ← npm próprio, fora do workspace pnpm do Nuxt
```

### 6.1 Migração da pasta (de `refatoracao-rematricula/rematricula-e2e`)
- [x] Copiar para `rematricula-testes/e2e/` com `.env.local`, `cenarios/alunos.local.json` e `gravacoes/`.
- [x] Dados reais fora do git: o `e2e/.gitignore` já ignora `.env.local`, `gravacoes/`, `cenarios/alunos.local.json`, `node_modules/`, `test-results/`, `playwright-report/` e `resultados/` (conferido com `git check-ignore`). As linhas `e2e/*` redundantes saíram do `.gitignore` da raiz. Quando o anonimizador existir, separar `gravacoes/brutas/` (ignorada) de `gravacoes/` (anonimizadas, versionadas).
- [ ] Commit separado para a mudança de `packageManager` (pnpm 11 → 12) em `package.json`/`pnpm-lock.yaml`, que não tem relação com o e2e.
- [x] `ignores: ['e2e/**']` no `eslint.config.mjs`. O `pnpm-workspace.yaml` não declara pacotes, então `e2e/` já fica fora do workspace.
- [x] `cd e2e && npm install && npx playwright install chromium && npm test` → **8/8 verdes** a partir da pasta nova (11/11/2026).
- [x] Nuxt com `e2e/` presente: `pnpm lint` ok, `pnpm build` ok. `pnpm typecheck` falha com 30 erros **anteriores e sem relação com o e2e** (Zod v4 `required_error`, `FormSubmitEvent.event` do Nuxt UI v4, `@types/pg` ausente, `Aluno | undefined` no `databricksRepository`). Nenhum erro aponta para `e2e/`. Corrigir à parte, antes da etapa 2, que mexe em `server/`.
- [x] README do `rematricula-testes` com a seção do e2e; links do plano principal apontando para `rematricula-testes/e2e/PLANO.md`.
- [ ] Commitar `e2e/`.
- [ ] Apagar `refatoracao-rematricula/rematricula-e2e` (Bruno, depois de tudo acima).

---

## 7. Etapas

| # | Etapa | Esforço (com IA) | Necessária para a migração? |
|---|---|---|---|
| 0 | Concluir a migração (6.1) | 0,5 dia | **Sim**, agora |
| 1 | ~~Reprodutor por método + caminho (ignora o host)~~ **Feito (11/11/2026):** `tests/apoio.mjs` casa por método + caminho após `/services/` + query ordenada; repetidas saem em ordem; responde CORS/preflight; chamada sem gravação vira anotação `sem-gravacao`; código do aluno sai do próprio HAR (não precisa de `alunos.local.json`). 8/8 verdes, também com HAR reescrito para outro host/prefixo | 0,5 dia | **Sim**, antes da Fase 1 |
| 2 | Esteira no servidor Nuxt (3.3) + endpoint `gerar`/`gravar`: perfil → WHERE, liberar, token, `gravar.mjs --link`, classificar, restaurar soft launch. **Código pronto (11/11/2026), falta o 1º teste real em HML** (ver 7.1) | 2,5 dias | **Sim**, Fase 0 |
| 3 | Anonimizador (dados pessoais + tokens) — **adiado** (3.4): poucos usuários e gravações fora do git | 1 dia | Só antes de versionar gravações ou da etapa 8 |
| 4 | Tela v1 no `rematricula-testes`: Cobertura + **Não encontrados** (②). **Código pronto (11/11/2026), falta usar com HML** (ver 7.2) | 1,5 dia | **Sim**, Fase 0 (é o que fecha os buracos da geração) |
| 5 | Tela: aba **Execução** (③) + histórico. **Código pronto (11/11/2026), falta usar pela tela com login** (ver 7.3) | 1 dia | Sim, Fase 1 |
| 6 | Fluxos com escrita. **Iniciada (11/11/2026):** base (`tests/fluxos.mjs`) + aceite do contrato (sucesso e erro). Faltam as outras ações (ver 7.4) | 1–2 dias | Sim, Fase 2 |
| 7 | Comparação visual Vue 2 × Vue 3 na aba Execução | 0,5 dia | Sim, Fase 3 (aprovação do PO) |
| 8 | `rematricula-testes` no Azure Repos + pipeline do front consumindo `e2e/` | 1 dia | Fase 3 |
| 9 | Descoberta de combinações novas (consulta por janela) | 0,5 dia | Depois da migração |

Mudança em relação à versão anterior: a inclusão manual de alunos deixou de ser "depois da migração". Ela entra junto com a geração, porque sem ela os cenários que o Databricks não enxerga ficam sem cobertura.

**Ordem sugerida:** 0 → 1 → conferir as colunas da view (3.1.1) → 2 → 4. A etapa 3 fica para antes da 8.

### 7.1 Etapa 2: o que foi feito e o que falta
Feito (sem credencial, verificado: `pnpm lint` ok; `pnpm typecheck` com os mesmos 30 erros anteriores e nenhum novo; `npm run test:unidade` 7/7; suíte e2e 8/8):
- `e2e/scripts/classificar.mjs` (+ testes `node --test`): rota final × esperada → `confere | nao-abriu | outra-tela | sem-esperado`.
- `e2e/scripts/gravar.mjs --link/E2E_LINK --saida --esperado --json`: grava, classifica e devolve JSON (o link mascarado). O modo manual `npm run gravar -- <id> <aluno>` continua igual.
- `catalogo.json`: um cenário por linha; `esperado.rota` preenchido a partir de `GerenciadorRotasPrioritarias.ts`/`Rotas.ts` onde é certo; filtros extras (`IND_REG_FINANCEIRO`/`IND_CONTRATO_LIBERADO = 'S'`) nos cenários que, pela ordem de prioridade do front, cairiam antes em pendência financeira; `"~modular"`; status `a-confirmar`.
- Servidor: `server/utils/e2e/{catalogo,esteira,processo,credenciais}.ts`, `lerEscopo`/`restaurarEscopo` no `softLaunchRepository` (+ `db_soft.ts`), `findE2eCandidates` no `databricksRepository`, rotas `GET /api/e2e/cenarios`, `POST /api/e2e/gerar` (segundo plano, 202) e `POST /api/e2e/gravar` (síncrona; `liberar: false` para cenários fora do prazo). Trava de HML por `E2E_DB_SOFT_HOST_HML`.

Falta (precisa de credencial/HML, fazer junto com quem tem acesso):
1. ~~Pôr `E2E_DB_SOFT_HOST_HML` no `.env`.~~ **Feito (11/11/2026)**, igual ao `DB_SOFT_HOST` (`…devhml2…`). Atenção: o banco do soft launch é **compartilhado entre DEV e HML**, então liberar uma combinação vale para os dois.
2. ~~Conferir as colunas da view.~~ **Feito (11/11/2026, `DESCRIBE`):** `IND_CONFIRMADO_UCDP`, `IND_CONFIRMADO_CORE` e `IND_*_PEND_ACAD_E2A2` **não existem**. Os `IND_*` são texto `'S'`/`'N'`; `QTDE_DP_NA_MAT` é `bigint`. Ajustes: UC personalizável e core curriculum filtram só pela oferta (a tela decide se ainda está pendente); pendência acadêmica E2A virou `fonte: manual`. Outros achados: a view tem uma linha por aluno, em ~70 períodos letivos (o maior é `13064`, com 27,7 mil alunos); só 14 alunos estão sem persona; `DSC_TPO_GRD_CURRICULAR` é `Modular` (181 mil), `Seriado` (11 mil) ou `Por Disciplina` (1,3 mil), então o cenário "modular" é o caso comum e a variação que interessa é `Seriado`/`Por Disciplina`. Alunos por perfil: escolha-disciplinas 6,5 mil; pendência financeira 26,8 mil; contrato a aceitar 6,2 mil; medicina 11,4 mil; UC personalizável 8,3 mil; core 15 mil; DP 34 mil.
3. Primeiro teste real: `POST /api/e2e/gravar` com um aluno conhecido (ex.: `pendencia-financeira`), conferindo no banco que o `escopo_regra` voltou ao estado anterior. Depois, `POST /api/e2e/gerar` com `ids: ["pendencia-financeira"]`.
4. Confirmar as rotas dos cenários sem `esperado` (`escolha-disciplinas`, `alteracao-com-dp`, `modular`) a partir dos `a-confirmar` que a esteira gerar.

### 7.2 Etapa 4: o que foi feito e o que falta
Feito (verificado: `pnpm lint` ok; `pnpm typecheck` com os mesmos 30 erros anteriores e nenhum novo; `pnpm build` ok; regras de cadastro exercitadas contra uma cópia de `e2e/`):
- Tela `/app/cenarios` (menu "Cenários E2E"), com o painel da esteira (andamento, tentativas, capturas, log; consulta a cada 3 s enquanto roda) e o botão "Gerar pendentes".
  - **Cobertura:** todos os cenários com status, fonte, perfil em linguagem simples, alunos no perfil, data e autor da gravação (destaca gravação com mais de 60 dias), captura, editar e gerar/regravar um cenário.
  - **Não encontrados:** os `a-confirmar` (captura + "Conferir e confirmar") e os que precisam de aluno (`nao-encontrado`, `divergente`, manuais `a-gravar`): código do aluno + "Liberar no soft launch" (desligado por padrão em `softLaunch: fora`) + "Gravar"; gravações dos candidatos com "Criar cenário a partir desta gravação"; botão "Novo cenário".
  - Senha pedida num modal quando a sessão não a tem (mesma regra do `generate-url`).
- Servidor: `GET /api/e2e/cenarios` passou a devolver também os arquivos de cada cenário (gravação, captura, candidatos); `POST /api/e2e/cenarios` (novo, ou `aPartirDe` um candidato, que passa por `promoverGravacao`); `PATCH /api/e2e/cenarios/:id` (título, `esperado`, `confirmar`: `a-confirmar` → `gravado` só se a rota casar com a tela gravada); `GET /api/e2e/captura` (só PNG de `e2e/gravacoes`, exige sessão). Regras em `server/utils/e2e/{cadastro,arquivos}.ts`.
- `promoverGravacao` agora devolve o caminho novo da captura (a tentativa aprovada apontava para o arquivo já movido).

Falta / limitações:
1. Ver a tela com login (não foi aberta no navegador nesta sessão) e usar junto com o 1º teste real da etapa 2 (7.1).
2. "Textos sugeridos pela captura" (seção 4) não foi feito: ao criar a partir da gravação, só a rota é sugerida. Os textos e botões são preenchidos à mão.
3. A rota onde cada candidato parou só aparece enquanto o servidor não reinicia (vem do estado da esteira em memória). Depois de reiniciar, a captura continua disponível, mas a rota não, e a conferência de rota ao criar a partir da gravação é pulada.

### 7.3 Etapa 5: o que foi feito e o que falta
Feito (verificado: `pnpm lint` ok; `pnpm typecheck` ok; `pnpm build` ok; suíte 8/8 pela linha de comando gerando `resultados/<id>.json`; filtro `E2E_CENARIOS` + `--project`; falha proposital com alvo inválido gerou `test-failed-1.png` + `trace.zip` no resumo; `npm run test:unidade` 7/7):
- Motor: reporter `scripts/resumo.mjs`, id por execução (`scripts/execucao.mjs`), `outputDir` por execução, anotações `rota-esperada`/`rota-obtida`, filtro `E2E_CENARIOS`. O reporter `json` (`resultados/ultimo.json`) saiu, substituído pelo resumo.
- Servidor: `server/utils/e2e/execucao.ts` + rotas `execucoes/*` e `artefato` (ver 6); `E2E_ALVO_LOCAL` no `nuxt.config.ts`/`.env.example`; trava cruzada com a esteira.
- Tela: aba **Execução** (`ExecucaoTab.vue` + `useExecucoesE2e.ts`): alvo, dispositivos, cenários (todos / só os que falharam na execução selecionada / escolher), Rodar/Cancelar, progresso, histórico, tabela cenário × dispositivo (falhas primeiro) com tela esperada × obtida, erro, chamadas sem gravação, captura e trace.

Falta / limitações:
1. Abrir a aba com login e rodar uma execução pela tela (as rotas não foram chamadas nesta sessão, por falta de login).
2. Confirmar a URL do Vue 3 local (`E2E_ALVO_LOCAL`) quando o projeto Vue 3 existir.
3. O relatório HTML do Playwright (`playwright-report/`) continua sendo só o da última execução; a tela não o serve.
4. Resultado do pipeline (decisão em aberto 5): o `resultados/*.json` tem o mesmo formato, então basta baixar o artefato do pipeline para `e2e/resultados/` e a tela mostra.

### 7.4 Etapa 6: o que foi feito e o que falta
**Avaliação do item (11/11/2026):** coerente com o que existe. A gravação já leva o front até as telas das ações, o reprodutor aborta tudo o que não está gravado (nenhuma escrita escapa) e o Playwright dá prioridade à rota registrada por último, então a resposta da ação entra por cima da gravação. Ajustes feitos no 5.1: (a) o formato das respostas sai do backend, então a decisão 2 (aluno de teste) não bloqueia o início; (b) faltava o "estado depois da ação"; (c) faltava o `log-acesso` do contrato na lista de escritas ao abrir.

Feito (verificado: suíte 14/14 verde, desktop e mobile; `npm run test:unidade` 13/13; resumo com `rota-obtida` = `/contrato/aceito` nos fluxos):
- Reprodutor (`tests/apoio.mjs`): `ajustar(fn)` para o estado depois da ação; `corsDe` e `rotaRelativa` exportados. Os cenários continuam iguais.
- `tests/fluxos.mjs`: `fluxo(cenario, id, titulo, { rota }, corpo)` (pula sem gravação, anota rota esperada/obtida e `sem-gravacao`, filtra por `E2E_CENARIOS`), `responder(page, metodo, caminho, resposta)` (devolve as chamadas com corpo e headers), `respostaGravada`.
- `tests/fluxos/contrato.spec.mjs`, sobre `contrato-a-aceitar`:
  - **Aceite do contrato:** marca "Li e concordo", clica "Aceitar contrato", confere o `POST contrato/api/v1/contratos/alunos/{aluno}/periodos-letivos/{periodo}` com `{ numeroMatricula }` e a tela "Seu contrato foi aceito". Resposta: 201 com o texto do `ContratoController.cs`.
  - **Aceite com erro (comportamento atual):** com 500, o Vue 2 vai para `/contrato/aceito` do mesmo jeito (`AssinarContrato.vue` engole o erro em `tentarAssinarContrato`). **Achado para o PO/Vue 3:** o aluno vê "Seu contrato foi aceito" sem o aceite ter sido gravado.
  - **Diferença no celular:** marcar a caixa sem ter aberto o PDF abre o aviso "Você precisa visualizar o contrato"; "Visualizar contrato" baixa o PDF e **desmarca** a caixa, que precisa ser marcada de novo. O teste segue esse caminho no `mobile`.

Falta (ordem sugerida; cada uma precisa de uma gravação que chegue na tela da ação):
1. **Envio de e-mail do resumo** (`POST compraonline/api/v1/ComprovanteMatricula?codigoAluno=…` → `EnviarComprovanteService`, botão "Enviar grade para o e-mail"), sobre `resumo-grade-confirmada`. Resposta simples, sem aluno de teste.
2. **Protocolo** (`POST .../api/v1/Protocolos`, `ProtocoloService`): falta gravação que chegue na tela de ajuda/protocolo.
3. **Envio do certificado** (`EnvioDocumentoService`), sobre `certificado-pendente`.
4. **Escolha/remoção de turma e confirmação da alteração** (`SelecaoDeTurmaService` PUT, `RemocaoDeTurmaService` DELETE, `ConfirmacaoAlteracaoMatriculaService` PUT, `PedidoCompraService` PUT): respostas grandes e o estado depois (carrinho, resumo) muda muito. Aqui o aluno de teste dedicado (decisão 2) ajuda a capturar o formato uma vez.
5. Aceite de contrato de **Medicina** (assinatura digital) quando `medicina-contrato` for gravado.

---

## 8. Cuidados
- **Liberar afeta um grupo:** vale para todos os alunos da combinação de curso, persona, campus e período em HML. HML é ambiente de testes, então deixar liberado não causa problema. Mesmo assim, a esteira restaura o estado anterior no `finally` por melhor esforço (3.3, passo 7) e registra a auditoria de quem liberou. A esteira não roda em paralelo (trava simples no servidor).
- **Só HML:** o banco do soft launch é um só (`DB_SOFT_HOST`) e o código não tem trava de ambiente. A esteira confere, na inicialização, que está apontando para o HML (por exemplo, pelo host contra uma variável `E2E_DB_SOFT_HOST_HML`) e recusa rodar caso contrário.
- **Credenciais:** a esteira roda no `rematricula-testes` da máquina de quem executa, com a sessão dessa pessoa. Nada de token em arquivo versionado.
- **Dados pessoais:** HAR bruto e `alunos.local.json` ficam fora do git. Só a versão anonimizada é versionada.
- **Repositório pessoal:** hoje o `rematricula-testes` está no GitHub pessoal. Antes de versionar gravações (mesmo anonimizadas) ou ligar ao pipeline do front, levar para o Azure Repos da Anima.
- **Só leitura** na gravação (5.1).
- **Catálogo único:** o estado dos cenários vive só no `catalogo.json` do motor; a tela não guarda cópia em banco, para não divergir.

---

## 9. Decisões em aberto
1. ~~Pode liberar soft launch por 1 dia em HML?~~ **Decidido (11/11/2026):** sim, HML é ambiente de testes; restaurar depois é melhor esforço.
2. Existe aluno de teste dedicado para os fluxos com escrita? (Não bloqueia mais o início da etapa 6: o formato vem do backend. Continua útil para seleção de turma e confirmação da alteração, 7.4.)
3. ~~Onde fica o painel?~~ **Decidido (11/11/2026):** tudo no `rematricula-testes`, motor em `e2e/`.
4. Quando e para onde levar o `rematricula-testes` no Azure Repos (projeto e squad: Renovar?).
5. A aba Execução roda a suíte na máquina local ou só mostra o resultado do pipeline? (Proposta: as duas; local para quem está migrando, pipeline para regressão.)
