import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AvaliacoesService } from './avaliacoes.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AvaliacoesService', () => {
  let service: AvaliacoesService;

  const mockPrismaService = {
    aluno: {
      findUnique: jest.fn(),
    },
    avaliacao: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const dtoBase = { alunoId: 10, peso: 80, altura: 1.8, idade: 30 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvaliacoesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AvaliacoesService>(AvaliacoesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should deny creating avaliacao for aluno of another personal', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 999,
      });

      await expect(service.create(dtoBase, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFound when aluno does not exist', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoBase, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAllByAluno', () => {
    it('should deny aluno reading avaliacoes of another aluno', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 1,
      });

      await expect(service.findAllByAluno(10, 77, 'ALUNO')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow the owning aluno', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 1,
      });
      mockPrismaService.avaliacao.findMany.mockResolvedValue([]);

      await expect(service.findAllByAluno(10, 10, 'ALUNO')).resolves.toEqual(
        [],
      );
    });
  });
});
