/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { configureApp } from '../../src/app/configure-app';
import * as dotenv from 'dotenv';
import { AppModule } from '../../src/app/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import {
  dataLocal,
  diaDaSemana,
  paraDbDate,
  somarDias,
} from '../../src/common/datas/fuso';

dotenv.config();

const TZ = 'America/Sao_Paulo';
const SENHA = 'password123';
// Celulares BR válidos (@IsPhoneNumber('BR')): DDD 99 + 9 + 8 dígitos.
const PREFIXO = '9999990';
const JOB_SECRET = 'e2e-job-secret-com-mais-de-trinta-e-dois-caracteres';

describe('Acompanhamento de sessões (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const hoje = dataLocal(new Date(), TZ);
  const d = (n: number) => somarDias(hoje, -n);

  const tel = (n: number) => `${PREFIXO}${String(n).padStart(4, '0')}`;
  let tokenA: string; // personal A
  let tokenB: string; // personal B
  let alunoA1: { id: number; token: string };
  let alunoA2: { id: number; token: string };
  let alunoB1: { id: number };

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const limpar = async () => {
    await prisma.aluno.deleteMany({
      where: { telefone: { startsWith: PREFIXO } },
    });
    await prisma.personal.deleteMany({
      where: { telefone: { startsWith: PREFIXO } },
    });
  };

  const registrarPersonal = async (n: number) => {
    await http()
      .post('/auth/personal/register')
      .send({ nome: `E2E Personal ${n}`, telefone: tel(n), senha: SENHA })
      .expect(201);
    const res = await http()
      .post('/auth/personal/login')
      .send({ telefone: tel(n), senha: SENHA })
      .expect(201);
    return res.body.access_token as string;
  };

  const criarAluno = async (personalToken: string, n: number) => {
    const res = await http()
      .post('/alunos')
      .set(auth(personalToken))
      .send({ nome: `E2E Aluno ${n}`, telefone: tel(n), senha: SENHA })
      .expect(201);
    const login = await http()
      .post('/auth/aluno/login')
      .send({ telefone: tel(n), senha: SENHA })
      .expect(201);
    return {
      id: res.body.id as number,
      token: login.body.access_token as string,
    };
  };

  const salvarAgenda = async (
    personalToken: string,
    alunoId: number,
    dias: number[],
    desde: string,
  ) => {
    await http()
      .put(`/agenda/${alunoId}`)
      .set(auth(personalToken))
      .send({ dias, horarios: {} })
      .expect(200);
    // Simula uma agenda antiga: o save() marca os dias como "novos" (hoje).
    await prisma.agendaTreino.update({
      where: { alunoId },
      data: {
        acompanhamentoDesde: paraDbDate(desde),
        diasDesde: Object.fromEntries(dias.map((dia) => [String(dia), desde])),
      },
    });
  };

  beforeAll(async () => {
    process.env.JOB_SECRET = JOB_SECRET;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = moduleFixture.get(PrismaService);
    await limpar();

    tokenA = await registrarPersonal(1);
    tokenB = await registrarPersonal(2);
    alunoA1 = await criarAluno(tokenA, 11);
    alunoA2 = await criarAluno(tokenA, 12);
    const b1 = await criarAluno(tokenB, 21);
    alunoB1 = { id: b1.id };

    // A1: agenda com todos os dias, exceto o dia da semana de ontem (ontem é "fora da agenda").
    const foraDaAgenda = diaDaSemana(d(1));
    await salvarAgenda(
      tokenA,
      alunoA1.id,
      [0, 1, 2, 3, 4, 5, 6].filter((x) => x !== foraDaAgenda),
      d(20),
    );
    // A2: agenda completa, usada para o job de faltas.
    await salvarAgenda(tokenA, alunoA2.id, [0, 1, 2, 3, 4, 5, 6], d(20));
  });

  afterAll(async () => {
    if (prisma) await limpar();
    if (app) await app.close();
  });

  describe('permissões e isolamento', () => {
    let sessaoA1: number;

    it('aluno cria o próprio treino e recebe a sessão', async () => {
      const res = await http()
        .post('/sessoes-treino')
        .set(auth(alunoA1.token))
        .send({
          data: d(3),
          status: 'REALIZADA',
          itens: [
            {
              ordem: 1,
              exercicio: 'Supino',
              cargaTexto: '40kg',
              concluido: true,
            },
          ],
        })
        .expect(201);
      sessaoA1 = res.body.id;
      expect(res.body.prevista).toBe(true);
      expect(res.body.itens[0].cargaKg).toBe(40);
      expect(res.body).not.toHaveProperty('notificadoAlunoEm');
    });

    it('data inexistente (31/02) recebe 400 e não vira outro dia', () =>
      http()
        .post('/sessoes-treino')
        .set(auth(alunoA1.token))
        .send({ data: '2026-02-31', status: 'REALIZADA' })
        .expect(400));

    it('listagem com período acima de 400 dias recebe 400', () =>
      http()
        .get(`/sessoes-treino?alunoId=${alunoA1.id}&de=2024-01-01&ate=${hoje}`)
        .set(auth(tokenA))
        .expect(400));

    it('segunda sessão no mesmo dia recebe 409', () =>
      http()
        .post('/sessoes-treino')
        .set(auth(alunoA1.token))
        .send({ data: d(3), status: 'PARCIAL' })
        .expect(409));

    it('aluno não lê nem edita sessão de outro aluno', async () => {
      await http()
        .get(`/sessoes-treino/${sessaoA1}`)
        .set(auth(alunoA2.token))
        .expect(404);
      await http()
        .patch(`/sessoes-treino/${sessaoA1}`)
        .set(auth(alunoA2.token))
        .send({ version: 0, status: 'PARCIAL' })
        .expect(404);
    });

    it('personal não acessa sessão de aluno de outro personal', async () => {
      await http()
        .get(`/sessoes-treino/${sessaoA1}`)
        .set(auth(tokenB))
        .expect(404);
      await http()
        .get(`/sessoes-treino?alunoId=${alunoA1.id}`)
        .set(auth(tokenB))
        .expect(403);
      await http()
        .post('/sessoes-treino')
        .set(auth(tokenB))
        .send({ alunoId: alunoA1.id, data: d(2), status: 'FALTA' })
        .expect(403);
    });

    it('aluno não registra falta', () =>
      http()
        .post('/sessoes-treino')
        .set(auth(alunoA1.token))
        .send({ data: d(2), status: 'FALTA' })
        .expect(403));

    it('aluno fora do prazo (D−8) recebe 403 ao editar', async () => {
      const antiga = await prisma.sessaoTreino.create({
        data: {
          alunoId: alunoA1.id,
          data: paraDbDate(d(9)),
          prevista: true,
          status: 'REALIZADA',
          origem: 'ALUNO',
        },
      });
      await http()
        .patch(`/sessoes-treino/${antiga.id}`)
        .set(auth(alunoA1.token))
        .send({ version: 0, status: 'PARCIAL' })
        .expect(403);
    });

    it('versão desatualizada recebe 409', async () => {
      await http()
        .patch(`/sessoes-treino/${sessaoA1}`)
        .set(auth(alunoA1.token))
        .send({ version: 0, rpe: 8 })
        .expect(200);
      await http()
        .patch(`/sessoes-treino/${sessaoA1}`)
        .set(auth(alunoA1.token))
        .send({ version: 0, rpe: 9 })
        .expect(409);
    });

    it('sessão validada pelo personal trava a edição do aluno', async () => {
      const atual = await http()
        .get(`/sessoes-treino/${sessaoA1}`)
        .set(auth(tokenA))
        .expect(200);
      await http()
        .patch(`/sessoes-treino/${sessaoA1}`)
        .set(auth(tokenA))
        .send({
          version: atual.body.version,
          validar: true,
          respostaPersonal: 'Boa!',
        })
        .expect(200);
      await http()
        .patch(`/sessoes-treino/${sessaoA1}`)
        .set(auth(alunoA1.token))
        .send({ version: atual.body.version + 1, rpe: 5 })
        .expect(403);
    });

    it('dor sem consentimento recebe 422 e passa após o aceite', async () => {
      const dados = {
        data: d(4),
        status: 'REALIZADA',
        dor: true,
        dorLocal: 'joelho',
      };
      await http()
        .post('/sessoes-treino')
        .set(auth(alunoA1.token))
        .send(dados)
        .expect(422);
      await http()
        .post('/alunos/me/consentimento-saude')
        .set(auth(alunoA1.token))
        .expect(201);
      await http()
        .post('/sessoes-treino')
        .set(auth(alunoA1.token))
        .send(dados)
        .expect(201);
    });
  });

  describe('reposição e frequência', () => {
    it('sessão fora da agenda após uma falta gera reposição vinculada e a frequência sobe', async () => {
      const falta = await http()
        .post('/sessoes-treino')
        .set(auth(tokenA))
        .send({ alunoId: alunoA1.id, data: d(6), status: 'FALTA' })
        .expect(201);

      const antes = await http()
        .get(`/alunos/${alunoA1.id}/progresso?periodo=30d`)
        .set(auth(tokenA))
        .expect(200);

      // ontem está fora da agenda: prevista = false → reposição
      const reposicao = await http()
        .post('/sessoes-treino')
        .set(auth(alunoA1.token))
        .send({ data: d(1), status: 'REALIZADA' })
        .expect(201);
      expect(reposicao.body.prevista).toBe(false);
      expect(reposicao.body.reposicaoDeId).toBe(falta.body.id);

      const depois = await http()
        .get(`/alunos/${alunoA1.id}/progresso?periodo=30d`)
        .set(auth(tokenA))
        .expect(200);
      expect(depois.body.frequencia.cumpridas).toBe(
        antes.body.frequencia.cumpridas + 1,
      );
      expect(depois.body.frequencia.faltas).toBe(
        antes.body.frequencia.faltas - 1,
      );
    });

    it('resumo responde para todos os alunos do personal', async () => {
      const res = await http()
        .get('/alunos/progresso-resumo')
        .set(auth(tokenA))
        .expect(200);
      const ids = res.body.map((r: { alunoId: number }) => r.alunoId);
      expect(ids).toEqual(expect.arrayContaining([alunoA1.id, alunoA2.id]));
      expect(ids).not.toContain(alunoB1.id);
    });

    it('aluno lê o próprio progresso e não o de outro', async () => {
      await http()
        .get('/alunos/me/progresso')
        .set(auth(alunoA1.token))
        .expect(200);
      await http()
        .get(`/alunos/${alunoA1.id}/progresso`)
        .set(auth(alunoA1.token))
        .expect(403);
    });
  });

  describe('CSRF (modo enforcing)', () => {
    const original = process.env.CSRF_ENFORCE;
    let jar: string[];

    beforeAll(async () => {
      process.env.CSRF_ENFORCE = 'true';
      const login = await http()
        .post('/auth/aluno/login')
        .send({ telefone: tel(12), senha: SENHA })
        .expect(201);
      jar = (login.headers['set-cookie'] as unknown as string[]).map(
        (c) => c.split(';')[0],
      );
    });
    afterAll(() => {
      process.env.CSRF_ENFORCE = original;
    });

    it('escrita do aluno sem X-CSRF-Token é bloqueada', () =>
      http()
        .post('/sessoes-treino')
        .set('Cookie', jar)
        .send({ data: d(2), status: 'REALIZADA' })
        .expect(403));

    it('escrita do aluno com o token correto passa', () => {
      const token = jar
        .find((c) => c.startsWith('csrf_token='))!
        .substring('csrf_token='.length);
      return http()
        .post('/sessoes-treino')
        .set('Cookie', jar)
        .set('X-CSRF-Token', token)
        .send({ data: d(2), status: 'REALIZADA' })
        .expect(201);
    });
  });

  describe('jobs internos', () => {
    const esperarJob = async (nome: string, desde: Date) => {
      for (let i = 0; i < 50; i++) {
        const lock = await prisma.jobLock.findUnique({ where: { nome } });
        if (lock?.ultimaExecucaoEm && lock.ultimaExecucaoEm >= desde) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`job ${nome} não terminou a tempo`);
    };
    const contarFaltas = () =>
      prisma.sessaoTreino.count({
        where: { alunoId: alunoA2.id, origem: 'AUTOMATICA' },
      });

    it('roda mesmo sem a linha do lock (auto-semeia o job_lock)', async () => {
      await prisma.jobLock.deleteMany({ where: { nome: 'fechamento-faltas' } });
      process.env.FALTAS_AUTOMATICAS_ENABLED = 'true';
      process.env.FALTAS_NOTIFICACAO_ENABLED = 'false';
      const inicio = new Date();
      await http()
        .post('/internal/jobs/fechamento-faltas')
        .set('X-Job-Secret', JOB_SECRET)
        .expect(202);
      await esperarJob('fechamento-faltas', inicio);
      expect(
        await prisma.jobLock.findUnique({
          where: { nome: 'fechamento-faltas' },
        }),
      ).not.toBeNull();
    });

    it('dia da semana adicionado hoje não gera falta retroativa', async () => {
      // Agenda nova (A3) com todos os dias: acompanhamentoDesde = hoje e
      // dias_desde = hoje para cada dia → nenhuma falta nos 3 dias anteriores.
      const a3 = await criarAluno(tokenA, 13);
      await http()
        .put(`/agenda/${a3.id}`)
        .set(auth(tokenA))
        .send({ dias: [0, 1, 2, 3, 4, 5, 6], horarios: {} })
        .expect(200);
      const inicio = new Date();
      await http()
        .post('/internal/jobs/fechamento-faltas')
        .set('X-Job-Secret', JOB_SECRET)
        .expect(202);
      await esperarJob('fechamento-faltas', inicio);
      expect(
        await prisma.sessaoTreino.count({ where: { alunoId: a3.id } }),
      ).toBe(0);
    });

    it('sem secret retorna 403', async () => {
      await http().post('/internal/jobs/fechamento-faltas').expect(403);
      await http()
        .post('/internal/jobs/fechamento-faltas')
        .set('X-Job-Secret', 'errado')
        .expect(403);
    });

    it('com secret aceita (202) e duas chamadas seguidas são idempotentes', async () => {
      process.env.FALTAS_AUTOMATICAS_ENABLED = 'true';
      process.env.FALTAS_NOTIFICACAO_ENABLED = 'false';

      const t1 = new Date();
      await http()
        .post('/internal/jobs/fechamento-faltas')
        .set('X-Job-Secret', JOB_SECRET)
        .expect(202);
      await esperarJob('fechamento-faltas', t1);
      const primeira = await contarFaltas();
      expect(primeira).toBeGreaterThanOrEqual(1);

      const t2 = new Date();
      await http()
        .post('/internal/jobs/fechamento-faltas')
        .set('X-Job-Secret', JOB_SECRET)
        .expect(202);
      await esperarJob('fechamento-faltas', t2);
      expect(await contarFaltas()).toBe(primeira);
    });

    it('DELETE de falta AUTOMATICA é bloqueado', async () => {
      const falta = await prisma.sessaoTreino.findFirst({
        where: { alunoId: alunoA2.id, origem: 'AUTOMATICA' },
      });
      await http()
        .delete(`/sessoes-treino/${falta!.id}`)
        .set(auth(tokenA))
        .expect(403);
    });

    it('health é público', () => http().get('/health').expect(200));
  });
});
