import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TreinosService } from './treinos.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('TreinosService', () => {
  let service: TreinosService;

  const mockPrismaService = {
    aluno: {
      findUnique: jest.fn(),
    },
    treino: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    exercicio: {
      count: jest.fn(),
    },
  };

  const dtoBase = {
    alunoId: 10,
    objetivo: 'Hipertrofia',
    itens: [{ exercicio: 'Supino', series: 3, repeticoes: '10', ordem: 1 }],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreinosService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TreinosService>(TreinosService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should deny prescribing to aluno of another personal', async () => {
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

  describe('findOne', () => {
    it('should deny access to treino of another personal', async () => {
      mockPrismaService.treino.findUnique.mockResolvedValue({
        id: 5,
        alunoId: 10,
        personalId: null,
        aluno: { id: 10, personalId: 999 },
        itens: [],
      });

      await expect(service.findOne(5, 1, 'PERSONAL')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deny aluno reading treino of another aluno', async () => {
      mockPrismaService.treino.findUnique.mockResolvedValue({
        id: 5,
        alunoId: 10,
        personalId: null,
        aluno: { id: 10, personalId: 1 },
        itens: [],
      });

      await expect(service.findOne(5, 77, 'ALUNO')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow the owning aluno', async () => {
      const treino = {
        id: 5,
        alunoId: 10,
        personalId: null,
        aluno: { id: 10, personalId: 1 },
        itens: [],
      };
      mockPrismaService.treino.findUnique.mockResolvedValue(treino);

      await expect(service.findOne(5, 10, 'ALUNO')).resolves.toEqual(treino);
    });
  });

  describe('findAllByAluno', () => {
    it('should deny aluno listing treinos of another aluno', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 1,
      });

      await expect(service.findAllByAluno(10, 77, 'ALUNO')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deny personal listing treinos of aluno de outro personal', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 999,
      });

      await expect(service.findAllByAluno(10, 1, 'PERSONAL')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
