import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TreinosService } from './treinos.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OwnershipService } from '../../common/ownership/ownership.service';

describe('TreinosService', () => {
  let service: TreinosService;

  const mockPrismaService = {
    aluno: {
      findUnique: jest.fn(),
    },
    treino: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    exercicio: {
      count: jest.fn(),
    },
    alongamento: {
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
        OwnershipService,
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

  describe('duplicate', () => {
    const origem = {
      id: 5,
      objetivo: 'Hipertrofia',
      observacoes: 'obs',
      diaSemana: 2,
      dataValidade: new Date(),
      itens: [
        {
          id: 1,
          treinoId: 5,
          exercicio: 'Supino',
          series: 3,
          repeticoes: '12/10/8',
          carga: null,
          ordem: 1,
          descanso: 60,
          obs: null,
          tipoSerie: 'DROP_SET',
          grupoCombinado: null,
          etapas: [{ carga: '30kg', repeticoes: '10' }],
          pausaSegundos: null,
        },
      ],
    };

    it('should deny duplicating a treino of another personal', async () => {
      mockPrismaService.treino.findUnique.mockResolvedValue({
        id: 5,
        personalId: 999,
        alunoId: null,
        aluno: null,
      });

      await expect(service.duplicate(5, { alunoId: 10 }, 1)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.treino.create).not.toHaveBeenCalled();
    });

    it('should deny duplicating to aluno of another personal', async () => {
      mockPrismaService.treino.findUnique.mockResolvedValue({
        id: 5,
        personalId: 1,
        alunoId: null,
        aluno: null,
      });
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 999,
      });

      await expect(service.duplicate(5, { alunoId: 10 }, 1)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPrismaService.treino.create).not.toHaveBeenCalled();
    });

    it('should copy itens, tipoSerie and diaSemana but not dataValidade', async () => {
      mockPrismaService.treino.findUnique.mockResolvedValue({
        id: 5,
        personalId: 1,
        alunoId: null,
        aluno: null,
      });
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 1,
      });
      mockPrismaService.treino.findUniqueOrThrow.mockResolvedValue(origem);
      mockPrismaService.treino.create.mockResolvedValue({
        ...origem,
        id: 6,
        itens: [],
      });

      await service.duplicate(5, { alunoId: 10 }, 1);

      const [[args]] = mockPrismaService.treino.create.mock.calls as [
        [{ data: { [k: string]: unknown; itens: { create: unknown[] } } }],
      ];
      const { data } = args;
      expect(data).toMatchObject({
        alunoId: 10,
        personalId: null,
        objetivo: 'Hipertrofia',
        diaSemana: 2,
      });
      expect(data.dataValidade).toBeUndefined();
      expect(data.itens.create[0]).toMatchObject({
        exercicio: 'Supino',
        repeticoes: '12/10/8',
        tipoSerie: 'DROP_SET',
        etapas: [{ carga: '30kg', repeticoes: '10' }],
      });
    });
  });

  describe('rotina de alongamento', () => {
    const alongamento = {
      ...dtoBase,
      tipo: 'ALONGAMENTO' as const,
      itens: [
        {
          exercicio: 'Alongamento de Quadríceps',
          series: 1,
          repeticoes: '30s',
          ordem: 1,
        },
      ],
    };

    it('rejeita dia da semana e métodos de série', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 1,
      });

      await expect(
        service.create({ ...alongamento, diaSemana: 2 }, 1),
      ).rejects.toThrow(/dia da semana/);
      await expect(
        service.create(
          {
            ...alongamento,
            itens: [{ ...alongamento.itens[0], tipoSerie: 'DROP_SET' }],
          },
          1,
        ),
      ).rejects.toThrow(/métodos de série/);
    });

    it('valida os itens contra o catálogo de alongamentos', async () => {
      mockPrismaService.aluno.findUnique.mockResolvedValue({
        id: 10,
        personalId: 1,
      });
      mockPrismaService.alongamento.count.mockResolvedValue(0);

      await expect(service.create(alongamento, 1)).rejects.toThrow(
        /alongamentos não foram encontrados/,
      );
      expect(mockPrismaService.alongamento.count).toHaveBeenCalled();
      expect(mockPrismaService.exercicio.count).not.toHaveBeenCalled();
    });
  });
});
