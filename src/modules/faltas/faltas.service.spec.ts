/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- acesso a mock.calls (any) em testes */
import { Test } from '@nestjs/testing';
import { JobLockService } from '../../common/jobs/job-lock.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { FaltasService } from './faltas.service';

// 2026-10-08 11:30Z = 08:30 em São Paulo (quinta). "Ontem" = quarta 2026-10-07.
const AGORA = new Date('2026-10-08T11:30:00Z');

describe('FaltasService', () => {
  let service: FaltasService;

  const prisma = {
    agendaTreino: { findMany: jest.fn() },
    sessaoTreino: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const notificacoes = { enviarParaUsuario: jest.fn() };
  const lock = { adquirir: jest.fn(), liberar: jest.fn() };

  const agenda = (extra: Record<string, unknown> = {}) => ({
    alunoId: 10,
    dias: [1, 3], // segunda e quarta
    horarios: { '3': { hora: '18:00', modalidade: 'ONLINE' } },
    acompanhamentoDesde: new Date('2026-09-01T00:00:00Z'),
    aluno: { personal: { fusoHorario: 'America/Sao_Paulo' } },
    ...extra,
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FaltasService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificacoesService, useValue: notificacoes },
        { provide: JobLockService, useValue: lock },
      ],
    }).compile();
    service = module.get(FaltasService);
    prisma.sessaoTreino.createMany.mockImplementation(({ data }) => ({
      count: data.length,
    }));
    lock.adquirir.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.FALTAS_AUTOMATICAS_ENABLED;
    delete process.env.FALTAS_NOTIFICACAO_ENABLED;
  });

  describe('executar', () => {
    it('com a flag desligada não faz nada', async () => {
      await expect(service.executar(AGORA)).resolves.toEqual({
        ignorado: 'flag-desligada',
      });
      expect(lock.adquirir).not.toHaveBeenCalled();
    });

    it('ignora quando outra execução detém o lock', async () => {
      process.env.FALTAS_AUTOMATICAS_ENABLED = 'true';
      lock.adquirir.mockResolvedValue(false);
      await expect(service.executar(AGORA)).resolves.toEqual({
        ignorado: 'em-execucao',
      });
    });

    it('materializa, não notifica sem a flag de notificação e libera o lock', async () => {
      process.env.FALTAS_AUTOMATICAS_ENABLED = 'true';
      prisma.agendaTreino.findMany.mockResolvedValue([agenda()]);

      const r = await service.executar(AGORA);

      expect(r).toMatchObject({ criadas: 2, notificadasAluno: 0 });
      expect(prisma.sessaoTreino.findMany).not.toHaveBeenCalled();
      expect(lock.liberar).toHaveBeenCalledWith('fechamento-faltas', r);
    });
  });

  describe('materializarFaltas', () => {
    it('cria faltas AUTOMATICA nos 3 últimos dias de agenda, com a modalidade do dia', async () => {
      prisma.agendaTreino.findMany.mockResolvedValue([agenda()]);

      await service.materializarFaltas(AGORA);

      const { data, skipDuplicates } =
        prisma.sessaoTreino.createMany.mock.calls[0][0];
      expect(skipDuplicates).toBe(true);
      // 05/10 (segunda) e 07/10 (quarta); 06 e 08 não estão na agenda
      expect(
        data.map((l: { data: Date }) => l.data.toISOString().slice(0, 10)),
      ).toEqual(['2026-10-07', '2026-10-05']);
      expect(data[0]).toMatchObject({
        origem: 'AUTOMATICA',
        status: 'FALTA',
        prevista: true,
        modalidade: 'ONLINE',
      });
      expect(data[1].modalidade).toBeNull();
    });

    it('dia da semana adicionado depois não gera falta retroativa', async () => {
      // Agenda de segunda e quarta; a quarta (07/10) só entrou hoje (08/10).
      prisma.agendaTreino.findMany.mockResolvedValue([
        agenda({ diasDesde: { '1': '2026-09-01', '3': '2026-10-08' } }),
      ]);
      await service.materializarFaltas(AGORA);
      const { data } = prisma.sessaoTreino.createMany.mock.calls[0][0];
      expect(
        data.map((l: { data: Date }) => l.data.toISOString().slice(0, 10)),
      ).toEqual(['2026-10-05']);
    });

    it('respeita acompanhamentoDesde', async () => {
      prisma.agendaTreino.findMany.mockResolvedValue([
        agenda({ acompanhamentoDesde: new Date('2026-10-06T00:00:00Z') }),
      ]);
      await service.materializarFaltas(AGORA);
      const { data } = prisma.sessaoTreino.createMany.mock.calls[0][0];
      expect(data).toHaveLength(1);
      expect(data[0].data.toISOString().slice(0, 10)).toBe('2026-10-07');
    });

    it('usa o fuso do personal para calcular "hoje"', async () => {
      // 02:00Z de 08/10: em Cuiabá (UTC-4) ainda é 07/10 22:00 → "ontem" = 06/10.
      prisma.agendaTreino.findMany.mockResolvedValue([
        agenda({
          dias: [2], // terça, 06/10
          aluno: { personal: { fusoHorario: 'America/Cuiaba' } },
        }),
      ]);
      await service.materializarFaltas(new Date('2026-10-08T02:00:00Z'));
      const { data } = prisma.sessaoTreino.createMany.mock.calls[0][0];
      expect(data[0].data.toISOString().slice(0, 10)).toBe('2026-10-06');
    });

    it('sem agendas elegíveis não chama o banco de escrita', async () => {
      prisma.agendaTreino.findMany.mockResolvedValue([]);
      await expect(service.materializarFaltas(AGORA)).resolves.toBe(0);
      expect(prisma.sessaoTreino.createMany).not.toHaveBeenCalled();
    });
  });

  describe('notificarAluno', () => {
    const preparar = () => {
      prisma.sessaoTreino.updateMany.mockResolvedValue({ count: 1 });
      prisma.sessaoTreino.findUnique.mockResolvedValue({
        alunoId: 10,
        data: new Date('2026-10-07T00:00:00Z'),
        aluno: { nome: 'Ana Souza' },
      });
      prisma.sessaoTreino.findMany
        .mockResolvedValueOnce([
          {
            id: 1,
            data: new Date('2026-10-07T00:00:00Z'),
            prevista: true,
            status: 'FALTA',
            repostaPor: null,
          },
        ])
        .mockResolvedValueOnce([]);
    };

    it('não reenvia quando a reserva já foi feita por outra execução', async () => {
      prisma.sessaoTreino.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.notificarAluno(1)).resolves.toBe(false);
      expect(notificacoes.enviarParaUsuario).not.toHaveBeenCalled();
    });

    it('envia push com tag, deep link e sem dados de saúde', async () => {
      preparar();
      notificacoes.enviarParaUsuario.mockResolvedValue({
        inscricoes: 1,
        enviados: 1,
        falhasTransitorias: 0,
      });

      await expect(service.notificarAluno(1)).resolves.toBe(true);

      const [destino, payload] = notificacoes.enviarParaUsuario.mock.calls[0];
      expect(destino).toEqual({ alunoId: 10 });
      expect(payload.tag).toBe('falta-1');
      expect(payload.url).toBe(
        '/dashboard/aluno/progresso?sessao=1&acao=justificar',
      );
      expect(JSON.stringify(payload)).not.toMatch(/dor|rpe|motivo/i);
    });

    it('desfaz a reserva em falha transitória para o backup reenviar', async () => {
      preparar();
      notificacoes.enviarParaUsuario.mockResolvedValue({
        inscricoes: 2,
        enviados: 0,
        falhasTransitorias: 2,
      });

      await expect(service.notificarAluno(1)).resolves.toBe(false);

      expect(prisma.sessaoTreino.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { notificadoAlunoEm: null },
      });
    });

    it('sem inscrições mantém a reserva (nada a reenviar)', async () => {
      preparar();
      notificacoes.enviarParaUsuario.mockResolvedValue({
        inscricoes: 0,
        enviados: 0,
        falhasTransitorias: 0,
      });

      await service.notificarAluno(1);

      expect(prisma.sessaoTreino.update).not.toHaveBeenCalledWith({
        where: { id: 1 },
        data: { notificadoAlunoEm: null },
      });
    });
  });

  describe('notificarPendentes — personal', () => {
    const falta = (id: number, alunoId: number, nome: string) => ({
      id,
      alunoId,
      data: new Date('2026-10-07T00:00:00Z'),
      aluno: { nome, personalId: 1 },
    });

    beforeEach(() => {
      prisma.sessaoTreino.updateMany.mockImplementation(({ where }) => ({
        count: where.id?.in?.length ?? 1,
      }));
      notificacoes.enviarParaUsuario.mockResolvedValue({
        inscricoes: 1,
        enviados: 1,
        falhasTransitorias: 0,
      });
    });

    it('1 falta no dia gera mensagem individual', async () => {
      prisma.sessaoTreino.findMany
        .mockResolvedValueOnce([]) // alunos
        .mockResolvedValueOnce([falta(1, 10, 'Ana Souza')]) // personal
        .mockResolvedValueOnce([]); // consecutivas

      await service.notificarPendentes(AGORA);

      const [destino, payload] = notificacoes.enviarParaUsuario.mock.calls[0];
      expect(destino).toEqual({ personalId: 1 });
      expect(payload.title).toBe('Ausência registrada');
      expect(payload.body).toBe(
        'Ana Souza faltou ao treino de quarta (07/10).',
      );
      expect(payload.tag).toBe('ausencias-2026-10-07');
    });

    it('2+ faltas no dia geram uma única mensagem consolidada', async () => {
      prisma.sessaoTreino.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          falta(1, 10, 'Ana Souza'),
          falta(2, 11, 'Bruno Lima'),
          falta(3, 12, 'Carla Dias'),
        ]);

      await service.notificarPendentes(AGORA);

      expect(notificacoes.enviarParaUsuario).toHaveBeenCalledTimes(1);
      const [, payload] = notificacoes.enviarParaUsuario.mock.calls[0];
      expect(payload.title).toBe('Ausências de ontem');
      expect(payload.body).toBe(
        '3 alunos faltaram ontem: Ana, Bruno e mais 1.',
      );
      expect(payload.url).toBe('/dashboard/admin/alunos?filtro=alertas');
    });

    it('desfaz as reservas do personal em falha transitória', async () => {
      notificacoes.enviarParaUsuario.mockResolvedValue({
        inscricoes: 1,
        enviados: 0,
        falhasTransitorias: 1,
      });
      prisma.sessaoTreino.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([falta(1, 10, 'Ana Souza')])
        .mockResolvedValueOnce([]);

      await service.notificarPendentes(AGORA);

      expect(prisma.sessaoTreino.updateMany).toHaveBeenLastCalledWith({
        where: { id: { in: [1] } },
        data: { notificadoPersonalEm: null },
      });
    });

    it('erro num item é contado e o processamento continua', async () => {
      prisma.sessaoTreino.findMany
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
        .mockResolvedValue([]);
      prisma.sessaoTreino.updateMany
        .mockRejectedValueOnce(new Error('db'))
        .mockResolvedValue({ count: 0 });

      const r = await service.notificarPendentes(AGORA);

      expect(r.erros).toBe(1);
    });
  });
});
