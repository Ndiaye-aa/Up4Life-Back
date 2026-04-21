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
| `POST` | `/auth/personal/login` | Login de Personal → retorna JWT |
| `POST` | `/auth/aluno/register` | Cadastro de Aluno (requer personalId) |
| `POST` | `/auth/aluno/login` | Login de Aluno → retorna JWT |

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

### Exercícios (role: PERSONAL)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/exercicios` | Adiciona exercício ao catálogo |
| `GET` | `/exercicios` | Lista catálogo (filtro: `?grupoMuscular=`) |

---

## Como Executar

### Pré-requisitos
- Node.js 22+
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

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=chave_secreta_longa_e_aleatoria
JWT_EXPIRES_IN=1d
FRONTEND_URL=http://localhost:3001
```

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
