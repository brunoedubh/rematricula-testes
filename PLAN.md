# Token Generator Platform - Plan (Atualizado)

## 📋 Contexto

Atualmente, para simular usuários nos testes, é necessário:
1. Buscar manualmente o código do aluno
2. Fazer requisições no Postman para gerar tokens do Azure AD
3. Construir manualmente as URLs para cada ambiente (dev/hml/prod)

**Problema:** Processo manual, lento e suscetível a erros.

**Solução:** Aplicação web que automatiza todo esse fluxo com autenticação individual e cache inteligente de tokens.

---

## 🎯 Objetivos

### Objetivo Principal
Criar uma plataforma web para gerar tokens e links de autenticação do Azure AD de forma automatizada, com busca inteligente de alunos, autenticação individual por usuário e gerenciamento inteligente de cache de tokens.

### Objetivos Específicos
- ✅ Autenticação individual usando credenciais Microsoft corporativas
- ✅ Buscar alunos por múltiplos critérios (código, RA, CPF, nome, instituição, curso)
- ✅ Gerar tokens automaticamente via Azure AD OAuth2 sob demanda
- ✅ Sistema de cache inteligente (tokens válidos por 60min, reutilizados quando possível)
- ✅ Renovação automática de tokens expirados
- ✅ Criar links prontos para dev, hml e produção
- ✅ Interface moderna e responsiva
- ✅ Feedback visual de cache/novo token
- ✅ Confirmação especial para acesso à produção
- ✅ Auditoria individual (quem gerou qual token)

---

## 🛠 Stack Técnica

### Frontend & Backend
- **Framework:** Nuxt 4+ (full-stack)
- **UI Library:** Nuxt UI (componentes prontos e modernos) usando template saas
- **Linguagem:** TypeScript
- **Styling:** Tailwind CSS (integrado com Nuxt UI)

### Integrações
- **Autenticação:** Microsoft Azure AD OAuth2 (ROPC Flow) - credenciais individuais
- **Banco de Dados:** Databricks (via REST API)
- **Cache:** Node.js memory cache (Map nativo)
- **Criptografia:** Node.js crypto (AES-256-CBC)

### DevOps
- **Runtime:** Node.js 22+
- **Deploy:** servidor próprio

---

## 📁 Estrutura do Projeto

```
token-generator/
├── app/
│   ├── pages/
│   │   ├── login.vue                 # Página pública de login (sem auth)
│   │   │
│   │   └── app/                      # Páginas autenticadas (protegidas)
│   │       ├── index.vue             # Dashboard principal / busca de alunos
│   │       ├── alunos/
│   │       │   └── [id].vue          # Detalhes de um aluno específico
│   ├── components/
│   │   ├── auth/
│   │   │   └── LoginForm.vue         # Formulário de login
│   │   │
│   │   ├── app/
│   │   │   ├── SearchBar.vue         # Barra de busca de alunos
│   │   │   ├── StudentCard.vue       # Card com dados do aluno + botões de acesso
│   │   │   ├── StudentList.vue       # Lista de resultados de alunos
│   │   │   ├── ConfirmProd.vue       # Modal de confirmação para produção
│   │   │   └── Header.vue            # Header com nome usuário + logout
│   │   │
│   │   └── ui/
│   │       ├── LoadingSpinner.vue    # Spinner de loading customizado
│   │       └── EmptyState.vue        # Estado vazio (sem resultados)
│   └── layouts/
│       ├── default.vue               # Layout para páginas públicas (login)
│       └── app.vue                   # Layout para páginas autenticadas (com header/nav)
│
├── server/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.post.ts         # Login com validação de credenciais Microsoft
│   │   │   └── logout.post.ts        # Logout com limpeza de cache
│   │   ├── alunos/
│   │   │   ├── search.get.ts         # Busca alunos no Databricks
│   │   │   └── [id].get.ts           # Busca aluno específico
│   │   └── tokens/
│   │       └── generate-url.post.ts  # Gera/reutiliza token e retorna URL completa
│   ├── utils/
│   │   ├── databricks.ts             # Cliente Databricks (REST API)
│   │   ├── azure-token.ts            # Gerador de tokens com cache inteligente
│   │   ├── token-cache.ts            # Sistema de cache de tokens (Map)
│   │   ├── encryption.ts             # Funções de criptografia AES-256
│   │   └── url-builder.ts            # Construtor de URLs por ambiente
│   └── middleware/
│       └── session.ts                # Validação de sessão do usuário
│
├── middleware/
│   ├── auth.global.ts                # Middleware global para proteger /app/*
│   └── guest.ts                      # Middleware para páginas públicas
│
├── types/
│   ├── aluno.ts                      # Tipos do aluno
│   ├── token.ts                      # Tipos de token e cache
│   ├── session.ts                    # Tipos de sessão
│   └── environment.ts                # Tipos de ambiente
│
├── composables/
│   ├── useAuth.ts                    # Composable para autenticação
│   └── useTokens.ts                  # Composable para geração de tokens
│
├── .env.example
├── nuxt.config.ts
├── package.json
└── README.md
```

---

## 🎨 Features Detalhadas

### 1. Autenticação Individual

**Fluxo:**
```
Usuário abre plataforma
  ↓
Login com usuario + senha Microsoft corporativa
  ↓
Sistema valida credenciais (gera token de teste (dev e hml))
  ↓
Se válido: cria sessão e armazena credenciais criptografadas
  ↓
Quando gerar token de aluno: usa MESMA senha do login
```

**Benefícios:**
- ✅ Cada pessoa usa suas próprias credenciais
- ✅ Auditoria individual (logs mostram quem gerou cada token)
- ✅ Sem necessidade de senha compartilhada do time
- ✅ Sem necessidade de admin do Azure
- ✅ Controle de acesso natural (se pessoa sair da empresa, perde acesso automaticamente)

**Interface de Login:**
```
┌─────────────────────────────────────────────────┐
│  Token Generator Platform                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  Entre com suas credenciais Microsoft          │
│                                                 │
│  Usuario Corporativo (completar com email):     │
│  [ seu.nome          ]  │
│                                                 │
│  Senha Microsoft:                               │
│  [ ••••••••••••                              ]  │
│                                                 │
│  [ Entrar ]                                     │
│                                                 │
│  ⓘ Suas credenciais são criptografadas e       │
│    usadas apenas para gerar tokens             │
└─────────────────────────────────────────────────┘
```

### 2. Busca de Alunos (Página Principal)

**Interface:**
```
┌─────────────────────────────────────────────────────┐
│  🔍 Token Generator Platform    Olá, Bruno! [Sair] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [ Buscar por código, RA, CPF, nome,...     ] 🔍    │
│                                                     │
│  Filtros rápidos:                                   │
│  [ Marca ▼ ]  [ Contrato ▼ ]  [ Oferta ▼ ]         │
│                                                     │
│  Resultados lista                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │ João Silva - RA: 12345 - Una                │   │
│  │ Engenharia de Software                      │   │
│  │ [Modal] [DEV] [HML] [PROD]                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Campos de busca do Databricks:**
- `cod_aluno` (Código do Aluno)
- `ra` (Registro Acadêmico)
- `cpf`
- `nome_aluno`
- `marca`
- `curso`
- `oferta` (informações da oferta)
- `assinou_contrato` (boolean)
- `Matriculado` (boolean)

**Funcionalidades:**
- Busca em tempo real (debounce 300ms)
- Resultados paginados (20 por página)
- Highlights nos resultados
- Filtros combinados

### 3. Card do Aluno com Acesso por Ambiente

**Card Expandido:**
```
┌─────────────────────────────────────────────────────┐
│  João Silva Santos                                    │
│  RA: 12345678  |  CPF: ***.456.789-**  
│  🎓 Marca: Una   -  🏛️   Una Contagem                                                  │
│  📚 Engenharia de Software                          │
│  
    Informações rematrícula  
│  ✅ Contrato                                        │
│  ✅ Rodou promoção automática                       │
│  ✅ Ofertas (Core curriculo, ucdp, Dependencia)     │
│                    
│  Acesso do aluno
│  [ Ver Detalhes ] [ DEV ] [ HML ] [ PROD ]          │
│                                                     │
│  ✅ Token reutilizado (válido por mais 45min)       │
└─────────────────────────────────────────────────────┘
```

### 4. Sistema de Cache Inteligente de Tokens

**Estratégia:**

```
1. Login → NÃO gera tokens de produção (só gera e valida em dev e hml se um funcionar valida)
2. Clique em ambiente → Verifica cache primeiro
3. Se token em cache e válido (>5min) → Reutiliza
4. Se token expirado/inexistente → Gera novo
5. Token salvo com TTL de 60min
6. Renovação automática quando <5min de validade
```

**Feedback Visual:**
- 🔄 "Novo token gerado (válido por 60min)"
- ✅ "Token reutilizado (válido por mais 45min)"
- ⚠️ "Token renovado (próximo da expiração)"

**Benefícios:**
- ⚡ Performance: não bate no Azure AD desnecessariamente
- 🎯 Confiabilidade: zero erros de token expirado
- 📊 Transparência: usuário vê status do token
- 🔐 Segurança: margem de 5min para expiração

### 5. Geração de URL e Redirecionamento

**Fluxo ao clicar em ambiente:**

```
1. Usuário clica em "DEV"
   ↓
2. Sistema verifica cache de tokens
   ↓
3a. Token válido em cache → Reutiliza
3b. Token expirado/inexistente → Gera novo
   ↓
4. Constrói URL completa
   ↓
5. Mostra notificação (cache/novo)
   ↓
6. Abre URL em nova aba

```

**Confirmação para Produção:**


```
1. Usuário clica em "PROD"
   ↓
2. Sistema abre modal de confirmação e pede senha novamente para geraçaõ do token de produção
(no caso de produção não deve guardar o token no login e a geraçaõ é diferente pois o email não é @homolog e sim @animaeducacao.com.br)
   ↓
3a. Token válido em cache → Reutiliza
3b. Token expirado/inexistente → Gera novo
   ↓
4. Constrói URL completa
   ↓
5. Mostra notificação (cache/novo)
   ↓
6. Abre URL em nova aba


┌─────────────────────────────────────┐
│  ⚠️ Atenção AMBIENTE PRODUTIVO      │
├─────────────────────────────────────┤
│  Você está prestes a acessar o      │
│  ambiente de PRODUÇÃO não altere    │
|    ou execute ações                 │
│                                     │
│  Aluno: João Silva (12345678)       │
│  Ambiente: PRODUÇÃO   
|                                     |
│  Digite sua senha novamente 
|     [xxx             ]              |           
│                                     │
│                        │
│                                     │
│  [ Cancelar ]  [ Sim, acessar ]    │
└─────────────────────────────────────┘
```

---

## 🔐 Integração Azure AD

### Autenticação da Plataforma + Geração de Tokens

**Conceito Unificado:**
- Login do usuário → Valida credenciais Microsoft
- Geração de tokens → Usa MESMAS credenciais do login
- Uma única senha → Múltiplos propósitos
- Cache inteligente → Minimiza chamadas ao Azure AD

### Endpoints por Ambiente

**DEV/HML/LOCAL:**
- Client ID: `b3fa09b1-e89b-***-***`
- Scope: `openid profile email offline_access api://servico_ulifelms_devhml/Api.Read`

**PROD:**
- Client ID: `1d6578ce-ed91-***-***`
- Scope: `openid profile email offline_access api://servico_ulifelms/Api.Read`

**Endpoint OAuth2:**
```
POST https://login.microsoftonline.com/organizations/oauth2/v2.0/token
```

### Payload de Requisição (ROPC Flow)
```typescript
{
  grant_type: "password",
  username: user.email,      // ← Email do usuário logado
  password: user.password,   // ← Senha dele (descriptografada da sessão)
  client_id: env.AZURE_CLIENT_ID,
  scope: env.AZURE_SCOPE
}
```

### Construção de URLs Finais

**DEV:**
```
https://cloudapp-dev.animaeducacao.com.br/rematricula/autorizacao-idp/token/{access_token}/{refresh_token}/{cod_aluno}
```

**HML:**
```
https://cloudapp-hml.animaeducacao.com.br/rematricula/autorizacao-idp/token/{access_token}/{refresh_token}/{cod_aluno}
```

**PROD:**
```
https://cloudapp.animaeducacao.com.br/rematricula/autorizacao-idp/token/{access_token}/{refresh_token}/{cod_aluno}
```

### Gerenciamento de Cache

**Estrutura do Cache:**
```typescript
interface CachedToken {
  access_token: string
  refresh_token: string
  expires_at: number      // Timestamp de expiração
  environment: 'dev' | 'hml' | 'prod'
}

// Key pattern: "email:environment"
// Example: "bruno@animaeducacao.com.br:dev"
```

**Regras de Cache:**
- TTL: 60 minutos (padrão Azure AD)
- Margem de segurança: 5 minutos antes da expiração
- Limpeza: automática no logout
- Isolamento: por usuário + ambiente

---

## 🗄 Integração Databricks

### Tabela: `alunos_rematricula`

**Colunas necessárias:**
```sql
COD_ALUNO int
NUM_MATRICULA string
DSC_MARCA string
COD_MARCA int
SGL_INSTITUICAO string
SGL_PERIODO_LETIVO string
NOM_ALUNO string
NOM_CURSO string
NOM_TPO_PERSONA string
DSC_TPO_GRD_CURRICULAR string
DSC_CATEGORIA_GRADE string
IND_REG_FINANCEIRO string
IND_EXECUTOU_LIBERACAO string
IND_EXECUTOU_PROMOCAO string
IND_CALOURO string
IND_MEDICINA string
COD_CURSO int
COD_TPO_PERSONA int
COD_CATEGORIA_GRADE int
IND_CONFIRMADO_OFERTA_PRINC string
IND_OFERTA_UCDP string
IND_OFERTA_CORE string
QTDE_DP_NA_MAT bigint
IND_POSSUI_HORARIO string
IND_NAO_POSSUI_HORARIO string
IND_CONTRATO_LIBERADO string
```

### Query de Busca
```sql
SELECT *
FROM alunos_rematricula
WHERE 
  LOWER(cod_aluno) LIKE LOWER('%${searchTerm}%')
  OR LOWER(ra) LIKE LOWER('%${searchTerm}%')
  OR LOWER(cpf) LIKE LOWER('%${searchTerm}%')
  OR LOWER(nome_aluno) LIKE LOWER('%${searchTerm}%')
  OR LOWER(instituicao) LIKE LOWER('%${searchTerm}%')
  OR LOWER(curso) LIKE LOWER('%${searchTerm}%')
LIMIT 20
OFFSET ${offset}
```

### Conexão
- **Método:** REST API do Databricks
- **Autenticação:** Bearer Token
- **Vantagem:** Simplifica deployment (serverless-friendly)

---

## 🎯 Roadmap de Implementação

### 📦 Fase 1 - Configuração Base
- [x] Setup do Nuxt 4 + Nuxt UI (instalação nuxt basica feita)
- [x] Configuração do ambiente (.env)
- [x] Estrutura de pastas completa
- [x] Types TypeScript definidos

### 🔐 Fase 2 - Autenticação e Segurança
- [x] Sistema de criptografia (AES-256-CBC)
- [x] Página de login com validação Microsoft
- [x] Middleware de sessão
- [x] API de login/logout

### 🗄️ Fase 3 - Integração Databricks
- [x] Cliente REST API Databricks
- [x] Interface de busca de alunos
- [x] Busca avançada com filtros
- [x] Paginação e debounce
- [x] Tratamento de erros

### 🎫 Fase 4 - Sistema de Tokens
- [x] Estrutura de cache (token-cache.ts)
- [x] Gerador de tokens com cache (azure-token.ts)
- [x] API de geração de URLs
- [x] Guarda tokens de dev e hml gerados no login assincronamente
- [x] Lógica de renovação automática
- [x] Lógica de geração e renovação para produção sempre com senha quando expira ou não existir
- [x] Mostrar um indicador de tokens gerados no dash

### 🎨 Fase 5 - Interface Completa
- [ ] Componente StudentCard com feedback visual
- [ ] Botões de acesso por ambiente
- [ ] Modal de confirmação para produção com senha
- [ ] Notificações toast (cache/novo token)
- [ ] Loading states
- [ ] Tratamento de erros no frontend

### ✅ Fase 6 - Testes e Validação
- [ ] Testes de fluxo completo
- [ ] Validação de expiração de tokens
- [ ] Testes de cache hit/miss
- [ ] Validação de auditoria
- [ ] Testes de segurança

### 🚀 Fase 7 - Deploy e Documentação
- [ ] Preparação para deploy
- [ ] Documentação completa no README.md
- [ ] Guia de instalação
- [ ] Guia de uso
- [ ] Troubleshooting

### 📊 Fase 8 - Pendências de Alunos
- [ ] Nova página inicial para Dashboard de Pendências (`/app`)
- [ ] Refatoração do Menu Principal para possibilitar navegação
- [ ] Deslocamento da tela atual do gerador de tokens/alunos para `/app/alunos`
- [ ] Implementação da visão "Por Aluno" detalhando pendências (Nuxt UI)
- [ ] Implementação da visão "Por Pendência" e alunos atrelados (Nuxt UI)
- [ ] Dados mockados para demonstração inicial

### 💎 Fase 9 - Melhorias Futuras (Backlog)
- [ ] Migrar cache para Redis (multi-instância)
- [ ] Dashboard com métricas de uso
- [ ] Geração em batch (múltiplos alunos)
- [ ] Export de histórico (CSV/Excel)
- [ ] Rate limiting por usuário
- [ ] Logs centralizados
- [ ] Testes automatizados (E2E)
- [ ] CI/CD pipeline

---

## ⚙️ Variáveis de Ambiente

```env
# ============================================
# NODE ENVIRONMENT
# ============================================
NODE_ENV=development  # development | production

# ============================================
# CRIPTOGRAFIA
# ============================================
# Gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=seu_hash_de_64_caracteres_hexadecimais_aqui

# ============================================
# SESSÃO
# ============================================
SESSION_DURATION=28800000  # 8 horas em ms
SESSION_SECRET=outro_hash_secreto_aqui

# ============================================
# AZURE AD - DEV/HML
# ============================================
# NOTA: Não precisa mais de username/password hardcoded!
# Cada usuário usa suas próprias credenciais Microsoft

AZURE_CLIENT_ID_DEV=b3fa09b1-e89b-***-***
AZURE_SCOPE_DEV=openid profile email offline_access api://servico_ulifelms_devhml/Api.Read

# ============================================
# AZURE AD - PROD
# ============================================
AZURE_CLIENT_ID_PROD=1d6578ce-ed91-***-***
AZURE_SCOPE_PROD=openid profile email offline_access api://servico_ulifelms/Api.Read

# ============================================
# DATABRICKS
# ============================================
DATABRICKS_HOST=https://seu-workspace.cloud.databricks.com
DATABRICKS_TOKEN=dapi_seu_token_aqui
DATABRICKS_HTTP_PATH=/sql/1.0/warehouses/seu_warehouse_id

# ============================================
# URLs BASE POR AMBIENTE
# ============================================
URL_BASE_DEV=https://cloudapp-dev.animaeducacao.com.br/rematricula
URL_BASE_HML=https://cloudapp-hml.animaeducacao.com.br/rematricula
URL_BASE_PROD=https://cloudapp.animaeducacao.com.br/rematricula

# ============================================
# DOMÍNIO PERMITIDO
# ============================================
ALLOWED_DOMAIN=animaeducacao.com.br

# ============================================
# CACHE (OPCIONAL - FUTURO)
# ============================================
# REDIS_URL=redis://localhost:6379
# CACHE_ENABLED=true
```

---

## 🚨 Considerações de Segurança

### Crítico - Implementado

1. ✅ **Credenciais individuais** - Cada usuário usa suas próprias
2. ✅ **Criptografia forte** - AES-256-CBC para senhas em sessão
3. ✅ **Cookies httpOnly** - Sessões protegidas contra XSS
5. ✅ **Confirmação para produção** - Modal de confirmação explícita
6. ✅ **Logs de auditoria** - Registro de quem gerou cada token
7. ✅ **Margem de expiração** - Renovação 5min antes de expirar
8. ✅ **Limpeza no logout** - Cache limpo ao desconectar

### Recomendações Adicionais

- ⚠️ **ROPC Flow requer contas sem 2FA** - Confirmar com TI
- ⚠️ **HTTPS obrigatório em produção** - Configurar SSL
- ⚠️ **Rate limiting** - Implementar na Fase 8 (Redis)
- ⚠️ **CORS apropriado** - Configurar domínios permitidos
- ⚠️ **Rotação de ENCRYPTION_KEY** - Planejar processo de rotação
- ⚠️ **Backup de logs** - Implementar sistema de logs centralizados

### Limitações Conhecidas

1. **ROPC Flow é legacy** - Microsoft pode depreciar no futuro
2. **2FA não funciona** - Contas com MFA não podem usar ROPC
3. **Cache em memória** - Perdido em restart (migrar para Redis depois)
4. **Single instance** - Cache não compartilhado (OK para MVP)

---

## 🎨 UI/UX com Nuxt UI

### Componentes a Utilizar

- `UInput` - Campos de busca e formulários
- `UButton` - Botões de ação com loading states
- `UCard` - Cards de alunos e containers
- `UModal` - Modal de confirmação de produção
- `UBadge` - Status e tags (contrato assinado, etc)
- `UAlert` - Mensagens de erro na validação
- `UNotification` - Toast notifications (cache/novo token)
- `USelectMenu` - Seletores de filtros
- `UIcon` - Ícones (Heroicons)
- `UAvatar` - Avatar do usuário logado

### Tema e Cores

#### Paleta de Cores Ânima Educação

**Cores Principais:**
```css
/* Roxo Ânima - Cor primária da marca */
--anima-purple-primary: #6B2C91;
--anima-purple-dark: #5B1E7D;
--anima-purple-light: #8B4BAD;

/* Cores de Status */
--anima-success: #10B981;     /* Verde - Aprovado */
--anima-warning: #F59E0B;     /* Laranja/Âmbar - Em Análise */
--anima-info: #3B82F6;        /* Azul - Aguardando */
--anima-error: #EF4444;       /* Vermelho - Reprovado */

/* Cores Neutras */
--anima-background: #F3F4F6;  /* Cinza claro - Fundo geral */
--anima-card: #FFFFFF;        /* Branco - Cards */
--anima-text-primary: #1F2937;    /* Cinza escuro - Texto principal */
--anima-text-secondary: #6B7280;  /* Cinza médio - Texto secundário */
--anima-border: #E5E7EB;      /* Cinza - Bordas */
```

#### Aplicação das Cores no Nuxt UI

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  ui: {
    primary: 'violet',  // Usa a paleta violet do Tailwind (próxima do roxo Ânima)
    gray: 'slate'
  }
})
```

#### Mapeamento de Cores por Contexto

| Elemento | Cor | Uso |
|----------|-----|-----|
| **Botões primários** | `--anima-purple-primary` | Ações principais (Entrar, Buscar) |
| **Headers/Títulos** | `--anima-purple-dark` | Cabeçalhos de seções |
| **Progress bars** | `--anima-purple-primary` | Barras de progresso |
| **Links** | `--anima-purple-primary` | Links clicáveis |
| **Aprovado/Sucesso** | `--anima-success` | Contrato assinado, documento aprovado |
| **Em análise** | `--anima-warning` | Documento em análise |
| **Aguardando** | `--anima-info` | Aguardando envio, pendente |
| **Reprovado/Erro** | `--anima-error` | Erro de validação, documento reprovado |
| **Backgrounds** | `--anima-background` | Fundo geral da aplicação |
| **Cards** | `--anima-card` | Cards de alunos, modais |

#### Exemplos de Uso

```vue
<!-- Botão primário -->
<UButton color="violet">Entrar</UButton>

<!-- Badge de status -->
<UBadge color="green">Contrato Assinado</UBadge>
<UBadge color="yellow">Em Análise</UBadge>
<UBadge color="blue">Aguardando</UBadge>
<UBadge color="red">Reprovado</UBadge>

<!-- Progress bar -->
<div class="w-full bg-gray-200 rounded-full h-2">
  <div class="bg-violet-600 h-2 rounded-full" style="width: 35%"></div>
</div>

<!-- Card com cor de header Ânima -->
<UCard>
  <template #header>
    <div class="bg-violet-700 text-white p-4">
      Título do Card
    </div>
  </template>
</UCard>
```

#### Classes Tailwind Customizadas

```css
/* app.css - Cores customizadas Ânima */
.bg-anima-purple {
  background-color: #6B2C91;
}

.text-anima-purple {
  color: #6B2C91;
}

.border-anima-purple {
  border-color: #6B2C91;
}

.hover\:bg-anima-purple-dark:hover {
  background-color: #5B1E7D;
}
```

- **Dark mode:** Suporte completo (ajustar cores para contraste adequado)
- **Responsivo:** Mobile-first design
- **Espaçamento:** Consistente (Tailwind scale)
- **Acessibilidade:** Contraste WCAG AA mínimo para todos os textos

### Estados de Feedback

```typescript
// Tipos de notificação
toast.add({
  title: 'Token reutilizado',
  description: 'Token em cache válido por mais 45min',
  color: 'green',
  icon: 'i-heroicons-check-circle'
})

toast.add({
  title: 'Novo token gerado',
  description: 'Token válido por 60 minutos',
  color: 'blue',
  icon: 'i-heroicons-arrow-path'
})

toast.add({
  title: 'Erro ao gerar token',
  description: 'Sessão expirada. Faça login novamente.',
  color: 'red',
  icon: 'i-heroicons-exclamation-circle'
})
```

---

## 📈 Métricas de Sucesso

### MVP (Fases 1-6)
- ✅ Reduzir tempo de geração de token de ~2min para ~10seg
- ✅ 100% dos alunos encontráveis por qualquer campo
- ✅ Zero erros manuais na construção de URLs
- ✅ Autenticação individual funcionando
- ✅ Cache reduzindo >70% das chamadas ao Azure AD
- ✅ Auditoria completa (quem/quando/qual aluno)

### Longo Prazo (Pós-MVP)
- 📊 Tempo médio de busca < 2s
- 📊 Taxa de sucesso na geração > 99%
- 📊 Cache hit rate > 80%
- 📊 Adoção por 100% da equipe de QA
- 📊 Redução de tickets relacionados a tokens
- 📊 Zero incidentes de segurança

---

## 🔄 Fluxo Completo Documentado

### 1. Primeiro Acesso
```
Usuário abre plataforma (localhost:3000 ou URL prod)
  ↓
Sistema verifica cookie de sessão
  ↓
Não encontrado → Redireciona para /login
  ↓
Usuário digita usuario + senha
  ↓
Sistema valida credenciais no Azure AD
  ↓
Se válido:
  - Criptografa senha
  - Cria sessão (8h de validade)
  - Redireciona para página principal
Se inválido:
  - Mostra erro "Credenciais inválidas"
```

### 2. Busca de Aluno
```
Usuário digita "joão silva" na busca
  ↓
Debounce de 300ms
  ↓
Query no Databricks (REST API)
  ↓
Retorna lista de alunos
  ↓
Renderiza cards com botões [DEV] [HML] [PROD]
```

### 3. Geração de URL (Exemplo: DEV)
```
Usuário clica em botão "DEV"
  ↓
Frontend: Loading state no botão
  ↓
Backend: Verifica cache de tokens
  ↓
CASO 1 - Token em cache e válido (>5min):
  - Reutiliza token
  - Log: "CACHE HIT"
  - Toast: "Token reutilizado (Xmin)"
  
CASO 2 - Token inexistente ou expirado:
  - Gera novo token no Azure AD
  - Salva em cache (60min TTL)
  - Log: "CACHE MISS - Novo token"
  - Toast: "Novo token gerado (60min)"
  ↓
Constrói URL completa
  ↓
Frontend: Abre URL em nova aba
  ↓
Backend: Log de auditoria
  "[AUDIT] bruno@animaeducacao.com.br gerou token 
   para aluno 12345 em DEV (cache: true)"
```

### 4. Acesso à Produção (Fluxo Especial)
```
Usuário clica em botão "PROD"
  ↓
Modal de confirmação:
  "⚠️ Você está acessando PRODUÇÃO. Tem certeza?"
  ↓
Usuário confirma
  ↓
Mesmo fluxo do DEV, mas com:
  - Client ID de produção
  - Scope de produção
  - URL base de produção
  - Log destacado: "[AUDIT][PROD]"
```

### 5. Logout
```
Usuário clica em "Sair"
  ↓
Backend:
  - Limpa todos os tokens em cache do usuário
  - Remove cookie de sessão
  - Log: "bruno@animaeducacao.com.br desconectado"
  ↓
Frontend: Redireciona para /login
```

---

## 🤝 Próximos Passos Imediatos

1. ✅ **Plano aprovado e documentado**
2. [ ] **Criar repositório Git**
3. [ ] **Configurar .env com credenciais de DEV/HML**
4. [ ] **Gerar ENCRYPTION_KEY** (`openssl rand -hex 32`)
5. [ ] **Iniciar Fase 1** com Claude Code
6. [ ] **Testar login** com suas credenciais Microsoft
7. [ ] **Validar busca** no Databricks
8. [ ] **Testar geração de token** em DEV primeiro

---

## 📝 Notas Técnicas Importantes

### Por que Nuxt 4?
- Server routes nativos (API + Frontend no mesmo projeto)
- TypeScript e auto-imports
- Developer experience excelente
- Deploy simplificado em Vercel/Netlify
- SSR/SSG quando necessário

### Por que Nuxt UI?
- Componentes prontos e acessíveis
- Integração perfeita com Nuxt
- Tema configurável (cores Ânima)
- Reduz tempo de desenvolvimento em 50%
- Suporte a dark mode nativo

### Por que Cache em Memória (Map)?
- **MVP:** Simplicidade e zero dependências
- **Performance:** Acesso instantâneo
- **Deployment:** Funciona em serverless
- **Limitação:** Perdido em restart (OK para MVP)
- **Futuro:** Migrar para Redis quando escalar

### Por que ROPC Flow?
- **Vantagem:** Funciona sem interação do usuário
- **Vantagem:** Credenciais individuais
- **Limitação:** Não funciona com 2FA
- **Limitação:** Microsoft pode depreciar
- **Alternativa futura:** Considerar OAuth2 Code Flow

### Regras de Desenvolvimento

1. **Não crie nada sem ter certeza** - Se tiver dúvidas, PARE e pergunte
2. **Documente TUDO no README.md**:
   - Como instalar
   - Como configurar .env
   - Como rodar localmente
   - Como fazer deploy
   - Arquitetura e fluxos
   - Troubleshooting
3. **Teste cada fase** antes de avançar para a próxima
4. **Commits pequenos e descritivos**
5. **TypeScript strict mode** sempre ativo
6. **Tratamento de erros** em todas as APIs
7. **Logs de auditoria** para ações críticas

---

## 📚 Referências

- [Nuxt 4 Documentation](https://nuxt.com)
- [Nuxt UI Documentation](https://ui.nuxt.com)
- [Microsoft Identity Platform - ROPC Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth-ropc)
- [Databricks REST API](https://docs.databricks.com/api/workspace/introduction)
- [Node.js Crypto](https://nodejs.org/api/crypto.html)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)

---

## 📊 Checklist de Segurança

Antes de fazer deploy em produção, verificar:

- [ ] ENCRYPTION_KEY gerada com 32 bytes aleatórios
- [ ] Todas as credenciais no .env (nunca no código)
- [ ] HTTPS habilitado e forçado
- [ ] Cookies com flags httpOnly e secure
- [ ] Confirmação de produção implementada
- [ ] Logs de auditoria funcionando
- [ ] Tratamento de erros em todas as APIs
- [ ] Timeout nas requisições ao Azure AD
- [ ] Rate limiting considerado (ou documentado para futuro)
- [ ] README.md com instruções de segurança
- [ ] Revisão de código feita
- [ ] Testes de penetração básicos (injection, XSS)

---

**Versão:** 2.0  
**Última atualização:** 2025-10-08  
**Autor:** Bruno Lima  
**Status:** Pronto para desenvolvimento com Claude Code  

---