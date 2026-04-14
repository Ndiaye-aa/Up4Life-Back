# ⚙️ Up4Life - API (Backend)

Esta é a API RESTful do ecossistema **Up4Life**, responsável pela inteligência de negócio, persistência de dados e segurança da plataforma. Construída com **NestJS**, a API garante uma arquitetura escalável e modular para a gestão de alunos, treinos e avaliações físicas.

## 🚀 Tecnologias Utilizadas

* **Framework:** [NestJS](https://nestjs.com/) (Node.js)
* **Linguagem:** TypeScript
* **Banco de Dados:** [PostgreSQL](https://www.postgresql.org/)
* **ORM:** [Prisma](https://www.prisma.io/) (ou TypeORM, conforme sua escolha)
* **Autenticação:** JWT (Integrado com NextAuth no Frontend)
* **Validação:** Class-validator & Zod
* **Documentação:** Swagger (Opcional)

---

## 🏗️ Arquitetura do Banco de Dados

A API gerencia as seguintes entidades principais e seus relacionamentos:

* **Users & Roles:** Diferenciação entre `PERSONAL` (Admin) e `ALUNO` (User).
* **Vínculos:** Relacionamento N:1 entre Alunos e um Personal específico.
* **Treinos:** Estrutura de planilhas contendo múltiplos exercícios, séries, repetições e cargas.
* **Avaliações:** Registros históricos de medidas corporais (Peso, % de Gordura, Perímetros).

---

## 🛣️ Endpoints Principais (API Reference)

### Autenticação & Usuários
* `POST /auth/login` - Validação de credenciais.
* `POST /users` - Cadastro de novos usuários.
* `GET /users/me` - Retorna os dados do perfil logado.

### Gestão de Alunos (Exclusivo Personal)
* `GET /alunos` - Lista todos os alunos vinculados ao Personal.
* `POST /alunos` - Vincula um novo aluno através de convite/email.

### Módulo de Treinos
* `GET /treinos/:alunoId` - Retorna o cronograma de treinos do aluno.
* `POST /treinos` - Cria um novo plano de treino (Personal).
* `PATCH /treinos/:id/concluir` - Marca exercício ou treino como finalizado (Aluno).

### Avaliações Físicas
* `GET /avaliacoes/:alunoId` - Histórico de evolução física.
* `POST /avaliacoes` - Registro de nova medição.

---

## ⚙️ Instalação e Execução

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/seu-usuario/up4life-backend.git](https://github.com/seu-usuario/up4life-backend.git)
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configuração do Banco (PostgreSQL):**
    Certifique-se de ter um banco Postgres rodando e configure o arquivo `.env`:
    ```env
    DATABASE_URL="postgresql://user:password@localhost:5432/up4life"
    JWT_SECRET="sua_chave_secreta_aqui"
    ```

4.  **Rodar Migrations:**
    ```bash
    npx prisma migrate dev # Caso use Prisma
    ```

5.  **Inicie a aplicação:**
    ```bash
    npm run start:dev
    ```

---

## 🛠️ Regras de Negócio Implementadas

1.  **Isolamento de Dados:** Um Personal nunca pode visualizar ou editar dados de alunos que não estão vinculados ao seu `Personal_ID`.
2.  **Hierarquia de Acesso:** Apenas usuários com role `PERSONAL` possuem permissão de escrita (`POST/PATCH/DELETE`) em treinos e avaliações.
3.  **Integridade:** O histórico de avaliações é imutável para garantir a precisão dos gráficos de evolução temporal.

---

## 📝 Padrão de Commits

Seguimos o padrão **Conventional Commits**:
* `feat`: Nova rota ou funcionalidade de banco.
* `fix`: Correção de bugs na lógica ou segurança.
* `chore`: Atualização de pacotes ou configurações de ambiente.
* `db`: Alterações em schemas ou migrations.

---
Desenvolvido por Adama Augusto Ndiaye | www.linkedin.com/in/adamaaugusto
