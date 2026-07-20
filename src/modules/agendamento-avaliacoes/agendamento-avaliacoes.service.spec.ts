import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { StatusAgendamento } from '@prisma/client';
import { AgendamentoAvaliacoesService } from './agendamento-avaliacoes.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';

describe('AgendamentoAvaliacoesService', () => {
  let service: AgendamentoAvaliacoesService;

  const mockPrismaService = {
    aluno: {
      findUnique: jest.fn(),
    },
    avaliacao: {
      findUnique: jest.fn(),
    },
    agendamentoAvaliacao: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockNotificacoesService = {
    enviarLembreteAvaliacao: jest.fn().mockResolvedValue(undefined),
  };

  const agendamentoDoPersonal1 = {
    id: 5,
    alunoId: 10,
    personalId: 1,
    dataAgendada: new Date('2030-01-10T10:00:00Z'),
    status: 'PENDENTE',
    lembreteDiaEm: null,
    lembreteVesperaEm: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgendamentoAvaliacoesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificacoesService, useValue: mockNotificacoesService },
      ],
    }).compile();

    service = module.get<AgendamentoAvaliacoesService>(
      AgendamentoAvaliacoesService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should deny scheduling for aluno of another personal', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 999,
      });

      await expect(
        service.create({ alunoId: 10, dataAgendada: new Date() }, 1),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should deny updating agendamento of another personal', async () => {
      mockPrismaService.agendamentoAvaliacao.findUnique.mockResolvedValue({
        ...agendamentoDoPersonal1,
        personalId: 999,
      });

      await expect(
        service.update(5, { status: StatusAgendamento.REALIZADA }, 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should deny linking avaliacao of another personal (IDOR)', async () => {
      mockPrismaService.agendamentoAvaliacao.findUnique.mockResolvedValue(
        agendamentoDoPersonal1,
      );
      mockPrismaService.avaliacao.findUnique.mockResolvedValue({
        id: 42,
        personalId: 999,
        alunoId: null,
        aluno: null,
      });

      await expect(service.update(5, { avaliacaoId: 42 }, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFound when linked avaliacao does not exist', async () => {
      mockPrismaService.agendamentoAvaliacao.findUnique.mockResolvedValue(
        agendamentoDoPersonal1,
      );
      mockPrismaService.avaliacao.findUnique.mockResolvedValue(null);

      await expect(service.update(5, { avaliacaoId: 42 }, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow linking avaliacao of own aluno', async () => {
      mockPrismaService.agendamentoAvaliacao.findUnique.mockResolvedValue(
        agendamentoDoPersonal1,
      );
      mockPrismaService.avaliacao.findUnique.mockResolvedValue({
        id: 42,
        personalId: null,
        alunoId: 10,
        aluno: { personalId: 1 },
      });
      mockPrismaService.agendamentoAvaliacao.update.mockResolvedValue({
        ...agendamentoDoPersonal1,
        avaliacaoId: 42,
      });

      await expect(
        service.update(5, { avaliacaoId: 42 }, 1),
      ).resolves.toMatchObject({
        avaliacaoId: 42,
      });
    });
  });

  describe('remove', () => {
    it('should deny removing agendamento of another personal', async () => {
      mockPrismaService.agendamentoAvaliacao.findUnique.mockResolvedValue({
        ...agendamentoDoPersonal1,
        personalId: 999,
      });

      await expect(service.remove(5, 1)).rejects.toThrow(ForbiddenException);
    });
  });
});
