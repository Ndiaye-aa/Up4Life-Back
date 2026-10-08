/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- acesso a mock.calls (any) em testes */
import { Test } from '@nestjs/testing';
import * as webpush from 'web-push';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificacoesService } from './notificacoes.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('NotificacoesService.enviarParaUsuario', () => {
  let service: NotificacoesService;
  const prisma = {
    pushSubscription: { findMany: jest.fn(), delete: jest.fn() },
  };
  const send = webpush.sendNotification as jest.Mock;
  const sub = (id: number) => ({
    id,
    endpoint: `https://push/${id}`,
    p256dh: 'k',
    auth: 'a',
  });

  const montar = async (vapid: boolean) => {
    if (vapid) {
      process.env.VAPID_PUBLIC_KEY = 'pub';
      process.env.VAPID_PRIVATE_KEY = 'priv';
    } else {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
    }
    const module = await Test.createTestingModule({
      providers: [
        NotificacoesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(NotificacoesService);
  };

  afterEach(() => jest.clearAllMocks());

  it('conta enviados e repassa tag e url no payload', async () => {
    await montar(true);
    prisma.pushSubscription.findMany.mockResolvedValue([sub(1), sub(2)]);
    send.mockResolvedValue({});

    const r = await service.enviarParaUsuario(
      { alunoId: 10 },
      { title: 't', body: 'b', url: '/x', tag: 'falta-1' },
    );

    expect(r).toEqual({ inscricoes: 2, enviados: 2, falhasTransitorias: 0 });
    expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
      where: { alunoId: 10 },
    });
    expect(JSON.parse(send.mock.calls[0][1])).toMatchObject({
      tag: 'falta-1',
      url: '/x',
    });
  });

  it('remove inscrições mortas (410) sem contar como falha transitória', async () => {
    await montar(true);
    prisma.pushSubscription.findMany.mockResolvedValue([sub(1)]);
    prisma.pushSubscription.delete.mockResolvedValue({});
    send.mockRejectedValue({ statusCode: 410 });

    const r = await service.enviarParaUsuario(
      { personalId: 1 },
      { title: 't', body: 'b' },
    );

    expect(r).toEqual({ inscricoes: 1, enviados: 0, falhasTransitorias: 0 });
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('erros 5xx/rede contam como falhas transitórias', async () => {
    await montar(true);
    prisma.pushSubscription.findMany.mockResolvedValue([sub(1), sub(2)]);
    send.mockResolvedValueOnce({}).mockRejectedValueOnce({ statusCode: 503 });

    const r = await service.enviarParaUsuario(
      { alunoId: 10 },
      { title: 't', body: 'b' },
    );

    expect(r).toEqual({ inscricoes: 2, enviados: 1, falhasTransitorias: 1 });
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });

  it('sem chaves VAPID trata as inscrições como transitórias (nada é enviado)', async () => {
    await montar(false);
    prisma.pushSubscription.findMany.mockResolvedValue([sub(1)]);

    const r = await service.enviarParaUsuario(
      { alunoId: 10 },
      { title: 't', body: 'b' },
    );

    expect(r).toEqual({ inscricoes: 1, enviados: 0, falhasTransitorias: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  describe('enviarLembreteAvaliacao — idempotência', () => {
    const agendamento = {
      id: 7,
      alunoId: 10,
      personalId: 1,
      dataAgendada: new Date('2026-10-08T15:00:00Z'),
      aluno: { nome: 'Ana' },
    };
    const prismaLembrete = {
      ...prisma,
      agendamentoAvaliacao: { update: jest.fn() },
    };

    const montarComLembrete = async () => {
      process.env.VAPID_PUBLIC_KEY = 'pub';
      process.env.VAPID_PRIVATE_KEY = 'priv';
      const module = await Test.createTestingModule({
        providers: [
          NotificacoesService,
          { provide: PrismaService, useValue: prismaLembrete },
        ],
      }).compile();
      return module.get(NotificacoesService);
    };

    it('marca como enviado quando algum destino recebeu', async () => {
      const svc = await montarComLembrete();
      prisma.pushSubscription.findMany.mockResolvedValue([sub(1)]);
      send.mockResolvedValue({});
      await svc.enviarLembreteAvaliacao(agendamento, 'DIA');
      expect(prismaLembrete.agendamentoAvaliacao.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: { lembreteDiaEm: expect.any(Date) },
      });
    });

    it('NÃO marca quando todos os destinos falharam de forma transitória', async () => {
      const svc = await montarComLembrete();
      prisma.pushSubscription.findMany.mockResolvedValue([sub(1)]);
      send.mockRejectedValue({ statusCode: 503 });
      await svc.enviarLembreteAvaliacao(agendamento, 'VESPERA');
      expect(prismaLembrete.agendamentoAvaliacao.update).not.toHaveBeenCalled();
    });

    it('marca quando ninguém tem inscrição (nada a reenviar)', async () => {
      const svc = await montarComLembrete();
      prisma.pushSubscription.findMany.mockResolvedValue([]);
      await svc.enviarLembreteAvaliacao(agendamento, 'DIA');
      expect(prismaLembrete.agendamentoAvaliacao.update).toHaveBeenCalled();
    });
  });
});
