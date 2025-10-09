# Token Generator Platform - Rematrícula Testes

[![Nuxt UI](https://img.shields.io/badge/Made%20with-Nuxt%20UI-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)

Plataforma web para gerar tokens e links de autenticação do Azure AD de forma automatizada, com busca inteligente de alunos, autenticação individual por usuário e gerenciamento inteligente de cache de tokens.

## 📋 Visão Geral

Esta plataforma automatiza o processo de geração de tokens para testes de rematrícula, eliminando a necessidade de:
- Buscar manualmente o código do aluno
- Fazer requisições no Postman para gerar tokens do Azure AD
- Construir manualmente as URLs para cada ambiente (dev/hml/prod)

### Funcionalidades Principais

✅ **Fase 1-2: Autenticação e Segurança** (Concluída)
- Autenticação individual usando credenciais Microsoft corporativas
- Criptografia AES-256-CBC para proteção de dados sensíveis
- Sistema de sessões com validade de 8 horas

✅ **Fase 3: Integração Databricks** (Concluída)
- Busca de alunos por múltiplos critérios (código, nome, matrícula, marca, curso)
- Interface de busca com debounce (500ms)
- Filtros avançados por marca, curso e status
- Tratamento de erros robusto

🔄 **Fase 4: Sistema de Tokens** (Em desenvolvimento)
- Geração automática de tokens via Azure AD OAuth2
- Sistema de cache inteligente (tokens válidos por 60min)
- Renovação automática de tokens expirados
- Criação de links prontos para dev, hml e produção

## 🛠 Stack Técnica

- **Framework:** Nuxt 4 (full-stack)
- **UI Library:** Nuxt UI com template SaaS
- **Linguagem:** TypeScript
- **Styling:** Tailwind CSS
- **Autenticação:** Microsoft Azure AD OAuth2 (ROPC Flow)
- **Banco de Dados:** Databricks (via REST API)
- **Cache:** Node.js memory cache
- **Criptografia:** Node.js crypto (AES-256-CBC)

## 📦 Pré-requisitos

- Node.js 22+
- NPM ou PNPM
- Acesso ao Databricks com Personal Access Token
- Credenciais Microsoft corporativas (@animaeducacao.com.br)
- Client IDs do Azure AD (dev/hml e prod)

## ⚙️ Instalação

### 1. Clone o repositório

```bash
git clone <repository-url>
cd rematricula-testes
```

### 2. Instale as dependências

```bash
npm install
# ou
pnpm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

### 4. Gere as chaves de criptografia

```bash
# Gerar ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Gerar SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Preencha o arquivo `.env`

```env
# ============================================
# CRIPTOGRAFIA
# ============================================
ENCRYPTION_KEY=<sua_chave_gerada_aqui>
SESSION_SECRET=<seu_secret_gerado_aqui>

# ============================================
# AZURE AD - DEV/HML
# ============================================
AZURE_CLIENT_ID_DEV=b3fa09b1-e89b-480c-bca0-b33e5bb4e930
AZURE_SCOPE_DEV=openid profile email offline_access api://servico_ulifelms_devhml/Api.Read

# ============================================
# AZURE AD - PROD
# ============================================
AZURE_CLIENT_ID_PROD=1d6578ce-ed91-4a70-a452-70ae7a7ac431
AZURE_SCOPE_PROD=openid profile email offline_access api://servico_ulifelms/Api.Read

# ============================================
# DATABRICKS
# ============================================
DATABRICKS_HOST=https://seu-workspace.cloud.databricks.com
DATABRICKS_TOKEN=dapi_seu_token_aqui
DATABRICKS_WAREHOUSE_ID=seu_warehouse_id
DATABRICKS_CATALOG=hive_metastore
DATABRICKS_SCHEMA=default

# ============================================
# URLs BASE POR AMBIENTE
# ============================================
URL_BASE_DEV=https://cloudapp-dev.animaeducacao.com.br/rematricula
URL_BASE_HML=https://cloudapp-hml.animaeducacao.com.br/rematricula
URL_BASE_PROD=https://cloudapp.animaeducacao.com.br/rematricula
```

### 6. Configure o Databricks

Certifique-se de que você tem:
- ✅ Personal Access Token do Databricks
- ✅ Warehouse ID disponível
- ✅ Acesso à tabela `alunos_rematricula` no catálogo especificado

## 🚀 Desenvolvimento

### Iniciar o servidor de desenvolvimento

```bash
npm run dev
# ou
pnpm dev
```

O servidor estará disponível em [http://localhost:3000](http://localhost:3000)

### Build para produção

```bash
npm run build
# ou
pnpm build
```

### Visualizar build de produção

```bash
npm run preview
# ou
pnpm preview
```

## 📁 Estrutura do Projeto

```
rematricula-testes/
├── app/
│   ├── pages/
│   │   ├── login.vue              # Página de login
│   │   └── app/
│   │       └── index.vue          # Dashboard principal
│   ├── components/
│   │   └── app/
│   │       └── DashAlunos.vue     # Componente de busca de alunos
│   └── layouts/
│       ├── default.vue            # Layout padrão
│       └── auth.vue               # Layout autenticado
│
├── server/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.post.ts      # Endpoint de login
│   │   │   ├── logout.post.ts     # Endpoint de logout
│   │   │   └── me.get.ts          # Endpoint de verificação de sessão
│   │   └── students/
│   │       └── search.post.ts     # Endpoint de busca de alunos
│   └── utils/
│       ├── databricks.ts          # Cliente Databricks
│       ├── encryption.ts          # Funções de criptografia
│       └── session.ts             # Gerenciamento de sessões
│
├── types/
│   ├── aluno.ts                   # Tipos do aluno (baseado no PLAN.md)
│   ├── token.ts                   # Tipos de token e cache
│   ├── session.ts                 # Tipos de sessão
│   ├── environment.ts             # Tipos de ambiente
│   └── databricks.ts              # Tipos do Databricks
│
├── composables/
│   ├── useAuth.ts                 # Composable de autenticação
│   └── useTokens.ts               # Composable de tokens (Fase 4)
│
├── .env.example                   # Exemplo de variáveis de ambiente
├── nuxt.config.ts                 # Configuração do Nuxt
├── PLAN.md                        # Documentação completa do projeto
└── README.md                      # Este arquivo
```

## 🔐 Segurança

### Implementado

- ✅ Credenciais individuais por usuário
- ✅ Criptografia AES-256-CBC para senhas em sessão
- ✅ Cookies httpOnly para proteção contra XSS
- ✅ Validação de domínio permitido (@animaeducacao.com.br)
- ✅ Logs de auditoria individual
- ✅ Sessões com tempo de expiração (8 horas)

### Recomendações Adicionais

- ⚠️ ROPC Flow requer contas sem 2FA
- ⚠️ HTTPS obrigatório em produção
- ⚠️ Rate limiting (planejado para Fase 8)
- ⚠️ Rotação periódica de ENCRYPTION_KEY

## 🗄️ Databricks - Estrutura de Dados

A tabela `alunos_rematricula` deve conter os seguintes campos principais:

- `COD_ALUNO` - Código do aluno (chave primária)
- `NUM_MATRICULA` - Número de matrícula
- `NOM_ALUNO` - Nome completo
- `DSC_MARCA` - Marca (Una, Unibh, etc)
- `SGL_INSTITUICAO` - Sigla da instituição
- `NOM_CURSO` - Nome do curso
- `DSC_STA_MATRICULA` - Status da matrícula
- `IND_CONTRATO_LIBERADO` - Indicador de contrato liberado
- Veja [PLAN.md](./PLAN.md) linhas 379-426 para lista completa

## 📝 Como Usar

### 1. Fazer Login

1. Acesse [http://localhost:3000/login](http://localhost:3000/login)
2. Digite seu usuário corporativo (sem `@animaeducacao.com.br`)
3. Digite sua senha Microsoft
4. Clique em "Entrar"

### 2. Buscar Alunos

1. No dashboard, use a barra de busca
2. Digite código do aluno, nome ou matrícula
3. A busca é automática após 500ms (debounce)
4. Ou clique em "Buscar" para busca imediata
5. Use filtros opcionais (marca, curso, status)

### 3. Gerar Tokens (Fase 4 - Em desenvolvimento)

_Será implementado na próxima fase_

## 🐛 Troubleshooting

### Erro de autenticação no login

**Problema:** "Credenciais inválidas"

**Solução:**
- Verifique se suas credenciais Microsoft estão corretas
- Certifique-se de que sua conta não tem 2FA ativado
- Confirme que o `AZURE_CLIENT_ID_DEV` está correto no `.env`

### Erro ao buscar alunos

**Problema:** "Erro na consulta ao Databricks"

**Solução:**
- Verifique se o `DATABRICKS_TOKEN` está válido
- Confirme que o `DATABRICKS_WAREHOUSE_ID` está correto
- Verifique se você tem acesso à tabela `alunos_rematricula`
- Veja os logs do servidor para detalhes do erro

### Sessão expira muito rápido

**Problema:** Precisa fazer login constantemente

**Solução:**
- Ajuste `SESSION_DURATION` no `.env` (valor em milissegundos)
- Padrão: 28800000 (8 horas)

## 📊 Roadmap

- [x] **Fase 1** - Configuração Base
- [x] **Fase 2** - Autenticação e Segurança
- [x] **Fase 3** - Integração Databricks
- [ ] **Fase 4** - Sistema de Tokens (Em desenvolvimento)
- [ ] **Fase 5** - Interface Completa
- [ ] **Fase 6** - Testes e Validação
- [ ] **Fase 7** - Deploy e Documentação
- [ ] **Fase 8** - Melhorias Futuras

Veja [PLAN.md](./PLAN.md) para detalhes completos do roadmap.

## 📚 Documentação Adicional

- [PLAN.md](./PLAN.md) - Documentação completa do projeto, arquitetura e decisões técnicas
- [Nuxt 4 Documentation](https://nuxt.com)
- [Nuxt UI Documentation](https://ui.nuxt.com)
- [Databricks REST API](https://docs.databricks.com/api/workspace/introduction)
- [Microsoft Identity Platform - ROPC Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth-ropc)

## 👥 Contribuindo

1. Leia o [PLAN.md](./PLAN.md) para entender a arquitetura
2. Siga as convenções de código do projeto (TypeScript strict mode)
3. Commits pequenos e descritivos
4. Teste cada funcionalidade antes de commitar

## 📄 Licença

Projeto interno - Ânima Educação

---

**Versão:** 1.0
**Última atualização:** 2025-10-09
**Autor:** Bruno Lima
**Status:** Fase 3 concluída, Fase 4 em desenvolvimento
