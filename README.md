# ⚙️ Up4Life - API Engine

O **Up4Life Backend** é uma API RESTful robusta desenvolvida em NestJS, responsável pela gestão de dados antropométricos, prescrição de treinamentos e controle de acesso para o ecossistema Up4Life. A aplicação utiliza uma arquitetura baseada em serviços para garantir cálculos precisos de índices de saúde e integridade referencial entre personal e aluno.

## 🛠️ Stack Tecnológica

* **Framework:** [NestJS](https://nestjs.com/)
* **Linguagem:** TypeScript
* **ORM:** [Prisma](https://www.prisma.io/) (Recomendado para PostgreSQL)
* **Banco de Dados:** [PostgreSQL](https://www.postgresql.org/)
* **Segurança:** BCrypt (Hash de senhas) e JWT (Autenticação)
* **Cálculos:** Lógica customizada para IMC, RCQ e Composição Corporal.

---

## 🗄️ Modelagem de Dados (Entity-Relationship)

O banco de dados foi projetado para suportar o acompanhamento histórico e a evolução do aluno:

* **Personal:** Gestor do sistema (Admin).
* **Aluno:** Cliente vinculado a um Personal, contendo histórico de saúde e dados demográficos.
* **Avaliação:** Registro de medidas corporais (perímetros e dobras cutâneas) e cálculos automáticos de índices (IMC, IAC, % Gordura).
* **Treino & Itens:** Cabeçalho do plano de treino e a lista técnica de exercícios (séries, repetições, carga, descanso e ordem).
* **Exercícios:** Catálogo global de exercícios e grupos musculares.

---

## 🚀 Backlog de Implementação

### Épico 1: Fundação & Segurança
- [ ] Setup do ambiente NestJS + PostgreSQL.
- [ ] Implementação de Migrations com as entidades `Personal` e `Aluno`.
- [ ] Auth Service: Cadastro e Login com BCrypt e JWT.
- [ ] Middleware de validação de Roles (Personal vs Aluno).

### Épico 2: Gestão de Alunos
- [ ] CRUD de Alunos (Vinculação obrigatória ao `idpersonal`).
- [ ] Implementação do campo `nascimento` (DATE) e `criadoEm`.
- [ ] Filtro de segurança: Personal só acessa seus próprios alunos.

### Épico 3: Módulo de Treinos (The Core)
- [ ] Cadastro de Catálogo de Exercícios.
- [ ] Engine de Montagem de Treino: Relação entre `Treino` e `Treino_Item`.
- [ ] Lógica de ordenação de exercícios na prescrição.

### Épico 4: Engine de Avaliação Física
- [ ] Endpoint de recebimento de medidas (Dobras e Perímetros).
- [ ] **Service de Inteligência:**
    - Cálculo automático de **IMC**, **IAC** e **RCQ**.
    - Cálculo de Composição Corporal (% Gordura, Massa Magra/Óssea/Residual).
- [ ] Histórico evolutivo para consumo de gráficos no Frontend.

---

## 🔌 Endpoints de Exemplo (Destaques)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Cadastro de Personal/Aluno. |
| `GET` | `/alunos` | Lista alunos vinculados ao Personal logado. |
| `POST` | `/avaliacoes` | Registra medidas e retorna índices calculados. |
| `GET` | `/treinos/:alunoId` | Retorna a planilha de treino completa do aluno. |

---

## ⚙️ Como Executar

1. **Clone o repositório:**
   ```bash
   git clone [https://github.com/seu-usuario/up4life-backend.git](https://github.com/seu-usuario/up4life-backend.git)

## 📝 Padrão de Commits

Seguimos o padrão **Conventional Commits**:
* `feat`: Nova rota ou funcionalidade de banco.
* `fix`: Correção de bugs na lógica ou segurança.
* `chore`: Atualização de pacotes ou configurações de ambiente.
* `db`: Alterações em schemas ou migrations.

---
Desenvolvido por Adama Augusto Ndiaye | www.linkedin.com/in/adamaaugusto
