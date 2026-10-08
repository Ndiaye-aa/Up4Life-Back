# Up4Life - API Engine

O **Up4Life Backend** é uma API RESTful desenvolvida em NestJS para a gestão de dados antropométricos, prescrição de treinos e controle de acesso do ecossistema Up4Life. O sistema calcula automaticamente índices de saúde (IMC, IAC, % Gordura via Pollock 7 dobras) e garante isolamento de dados entre personais e alunos via JWT + RBAC.

## Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| Framework | [NestJS](https://nestjs.com/) 11 + TypeScript 5.7 |
| ORM | [Prisma](https://www.prisma.io/) 7 com driver `@prisma/adapter-pg` |
| Banco de Dados | [PostgreSQL](https://www.postgresql.org/) (Supabase) |
| Autenticação | JWT + Passport + BCrypt |
| Validação | class-validator + class-transformer |
| Testes | Jest (unitários) + Jest E2E |
| Node.js | 22.x |

---

## Modelagem de Dados

```
Personal (1) ──── (N) Aluno (1) ──── (N) Avaliacao
                             (1) ──── (N) Treino (1) ──── (N) ItemTreino
Exercicio (catálogo global, sem relações)
```

- **Personal:** Gestor do sistema. Cria alunos, prescreve treinos e realiza avaliações.
- **Aluno:** Cliente vinculado obrigatoriamente a um Personal. Possui histórico de saúde e dados demográficos.
- **Avaliacao:** Registro de medidas corporais com cálculo automático de IMC, IAC e % Gordura.
- **Treino & ItemTreino:** Plano de treino com lista ordenada de exercícios (séries, repetições, carga, descanso).
- **Exercicio:** Catálogo global de exercícios por grupo muscular.

---

## Endpoints

### Autenticação (público)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/auth/personal/register` | Cadastro de Personal |
| `POST` | `/auth/personal/login` | Login de Personal → cookies httpOnly + `access_token` no corpo |
| `POST` | `/auth/aluno/login` | Login de Aluno → cookies httpOnly + `access_token` no corpo |
| `POST` | `/auth/refresh` | Renova o `access_token` usando o `refresh_token` (cookie) |
| `POST` | `/auth/logout` | Revoga o refresh token e limpa os cookies de sessão |
| `GET` | `/auth/me` | Retorna o usuário autenticado (via cookie ou header) |

Não existe cadastro público de Aluno: o cadastro é feito exclusivamente pelo Personal autenticado via `POST /alunos`, para impedir vincular um aluno a um `personalId` arbitrário.

### Alunos (role: PERSONAL)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/alunos` | Cria aluno vinculado ao personal logado |
| `GET` | `/alunos` | Lista alunos do personal logado |
| `GET` | `/alunos/:id` | Detalhe de um aluno |
| `PATCH` | `/alunos/:id` | Atualiza dados do aluno |
| `DELETE` | `/alunos/:id` | Remove aluno |

### Avaliações (PERSONAL cria, ALUNO visualiza)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/avaliacoes` | Registra medidas e retorna índices calculados |
| `GET` | `/avaliacoes/aluno/:alunoId` | Histórico evolutivo de avaliações |

### Treinos (PERSONAL cria, ALUNO visualiza)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/treinos` | Prescreve treino com lista de exercícios |
| `GET` | `/treinos/aluno/:alunoId` | Lista treinos do aluno |
| `GET` | `/treinos/:id` | Detalhe de um treino com itens ordenados |

### Acompanhamento de sessões

| Método | Endpoint | Roles | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/sessoes-treino` | PERSONAL, ALUNO | Cria sessão (treino, falta ou pré-justificativa) |
| `PATCH` | `/sessoes-treino/:id` | PERSONAL, ALUNO | Edita conforme a matriz de permissões; exige `version` (409 se desatualizada) |
| `GET` | `/sessoes-treino?alunoId&de&ate` | PERSONAL, ALUNO | Lista por período (para o aluno, `alunoId` é ignorado) |
| `GET` | `/sessoes-treino/:id` | PERSONAL, ALUNO | Detalhe com itens |
| `DELETE` | `/sessoes-treino/:id` | PERSONAL | Exclui (bloqueado para faltas automáticas) |
| `POST` | `/alunos/me/consentimento-saude` | ALUNO | Registra o consentimento para dados de saúde |
| `GET` | `/alunos/:id/progresso?periodo=30d\|90d\|180d` | PERSONAL | Frequência, calendário, carga, avaliações e alertas |
| `GET` | `/alunos/me/progresso` | ALUNO | Idem, do próprio aluno |
| `GET` | `/alunos/progresso-resumo` | PERSONAL | Resumo de todos os alunos em uma query |
| `GET` | `/agenda/me` | ALUNO | Agenda do próprio aluno |

### Jobs internos (header `X-Job-Secret`)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/internal/jobs/fechamento-faltas` | Cria as faltas do dia e envia os pushes (202) |
| `POST` | `/internal/jobs/lembretes-avaliacao` | Lembretes de avaliação (202) |
| `GET` | `/health` | Healthcheck público (acorda a instância) |

Gatilhos: cron-job.org (`GET /health` às 08:25 e `POST` às 08:30, fuso America/Sao_Paulo; lembretes às 07:55/08:00), `@Cron` interno e backup no GitHub Actions às 09:15 (`.github/workflows/jobs-agendados.yml`, secrets `API_URL` e `JOB_SECRET`). Após o deploy, rode `npx ts-node scripts/migrar-horarios-agenda.ts` (idempotente).

### Exercícios (role: PERSONAL)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/exercicios` | Adiciona exercício ao catálogo |
| `GET` | `/exercicios` | Lista catálogo (filtro: `?grupoMuscular=`) |

---

## Como Executar

### Pré-requisitos
- Node.js 22+ (há um `.nvmrc`; o `package.json` exige `>=22`)
- PostgreSQL (ou acesso ao Supabase)

### Setup

```bash
# 1. Instalar dependências (gera o Prisma Client automaticamente)
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com as suas credenciais

# 3. Executar migrations
npx prisma migrate deploy

# 4. Popular catálogo de exercícios (seed)
npx prisma db seed

# 5. Iniciar em modo desenvolvimento
npm run start:dev
```

### Variáveis de Ambiente

Veja `.env.example` para a lista completa e comentada. Resumo:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=chave_secreta_longa_e_aleatoria
JWT_EXPIRES_IN=1d
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
COOKIE_DOMAIN=
FRONTEND_URL=http://localhost:5173,http://localhost:5174
JOB_SECRET=             # obrigatório, ≥ 32 caracteres (gatilhos dos jobs)
FALTAS_AUTOMATICAS_ENABLED=false
FALTAS_NOTIFICACAO_ENABLED=false
```

Em produção (`NODE_ENV=production`), os cookies de sessão saem com `Secure` e `SameSite=None`, e a proteção CSRF (double-submit cookie) é sempre aplicada — não depende de nenhuma flag adicional. `FRONTEND_URL` deve listar exatamente os domínios de produção do front (sem barra final), pois é a whitelist usada tanto pelo CORS quanto implicitamente pela política de cookies cross-site.

### Comandos úteis

```bash
npm run build          # Build de produção
npm run start:prod     # Iniciar em produção
npm test               # Testes unitários
npm run test:e2e       # Testes E2E
npm run test:cov       # Cobertura de testes
npm run lint           # Lint com auto-fix
npx prisma studio      # Interface visual do banco
```

---

## Backlog de Implementação

### Épico 1: Fundação & Segurança
- [x] Setup NestJS + PostgreSQL + Prisma com driver adapter
- [x] Migrations com entidades `Personal` e `Aluno`
- [x] Auth Service: Cadastro e Login com BCrypt e JWT
- [x] Guards de autenticação (JwtAuthGuard) e autorização (RolesGuard)
- [x] Decorators: `@Public`, `@Roles`, `@User`, `@GetPersonalId`

### Épico 2: Gestão de Alunos
- [x] CRUD completo de Alunos (vinculação obrigatória ao `personalId`)
- [x] Filtro de segurança: Personal só acessa seus próprios alunos
- [x] Campos demográficos: `sexo`, `nascimento`, `historicoSaude`

### Épico 3: Módulo de Treinos
- [x] Catálogo de exercícios com grupo muscular (seed com 23 exercícios)
- [x] Engine de prescrição: relação `Treino` → `ItemTreino`
- [x] Validação de exercícios existentes no catálogo
- [x] Ordenação por `ordem` e unicidade por treino
- [x] Operação atômica via transação Prisma

### Épico 4: Engine de Avaliação Física
- [x] Endpoint de medidas (perímetros e dobras cutâneas)
- [x] Cálculo automático: IMC, IAC
- [x] Composição corporal: Protocolo Pollock 7 dobras + equação de Siri (% gordura)
- [x] Histórico evolutivo para gráficos no Frontend

---

## Padrão de Commits

Seguimos o padrão **Conventional Commits**:

| Prefixo | Uso |
| :--- | :--- |
| `feat` | Nova rota ou funcionalidade |
| `fix` | Correção de bug na lógica ou segurança |
| `chore` | Atualização de pacotes ou configurações |
| `db` | Alterações em schema ou migrations |

---

Desenvolvido por Adama Augusto Ndiaye | [linkedin.com/in/adamaaugusto](https://www.linkedin.com/in/adamaaugusto)
