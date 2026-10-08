import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProgressoService } from './progresso.service';

const AGORA = new Date('2026-10-07T15:00:00Z');
const d = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

describe('ProgressoService', () => {
  let service: ProgressoService;
  const prisma = {
    aluno: { findUnique: jest.fn() },
    personal: { findUnique: jest.fn() },
    sessaoTreino: { findMany: jest.fn() },
    avaliacao: { findMany: jest.fn() },
    treino: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const ownership = { assertAlunoPertenceAoPersonal: jest.fn() };

  const sessao = (data: string, extra: Record<string, unknown> = {}) => ({
    data: d(data),
    prevista: true,
    status: 'REALIZADA',
    modalidade: 'PRESENCIAL',
    reposicaoDeId: null,
    repostaPor: null,
    rpe: null,
    dor: false,
    itens: [],
    ...extra,
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProgressoService,
        { provide: PrismaService, useValue: prisma },
        { provide: OwnershipService, useValue: ownership },
      ],
    }).compile();
    service = module.get(ProgressoService);

    prisma.aluno.findUnique.mockResolvedValue({
      personal: { fusoHorario: 'America/Sao_Paulo' },
      agendaTreino: { acompanhamentoDesde: d('2026-09-01') },
    });
    prisma.avaliacao.findMany.mockResolvedValue([]);
    prisma.treino.findMany.mockResolvedValue([]);
  });

  afterEach(() => jest.clearAllMocks());

  it('rejeita período inválido', async () => {
    await expect(service.progresso(10, '7d', AGORA)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('calcula frequência, sequência, faltas consecutivas e semanal', async () => {
    prisma.sessaoTreino.findMany.mockResolvedValue([
      sessao('2026-09-28'),
      sessao('2026-09-30'),
      sessao('2026-10-02', { status: 'FALTA' }),
      sessao('2026-10-05', { status: 'FALTA' }),
    ]);

    const r = await service.progresso(10, '30d', AGORA);

    expect(r.periodo).toEqual({ de: '2026-09-07', ate: '2026-10-07' });
    expect(r.acompanhamentoDesde).toBe('2026-09-01');
    expect(r.frequencia).toMatchObject({
      previstas: 4,
      cumpridas: 2,
      faltas: 2,
      percentual: 0.5,
    });
    expect(r.faltasConsecutivas).toBe(2);
    expect(r.sequenciaAtual).toBe(0);
    expect(r.alertas).toContain('FALTAS_SEGUIDAS');
    expect(r.semanal).toEqual([
      { semana: '2026-W40', previstas: 3, cumpridas: 2 },
      { semana: '2026-W41', previstas: 1, cumpridas: 0 },
    ]);
  });

  it('justificada não quebra a sequência atual', async () => {
    prisma.sessaoTreino.findMany.mockResolvedValue([
      sessao('2026-10-01'),
      sessao('2026-10-03', { status: 'FALTA_JUSTIFICADA' }),
      sessao('2026-10-05'),
    ]);
    const r = await service.progresso(10, '30d', AGORA);
    expect(r.sequenciaAtual).toBe(2);
  });

  it('calcula volume, carga, RPE e alertas de dor e esforço', async () => {
    prisma.sessaoTreino.findMany.mockResolvedValue([
      sessao('2026-10-03', {
        rpe: 9,
        dor: true,
        itens: [
          {
            exercicio: 'Supino reto',
            grupoMuscular: 'Peito',
            seriesFeitas: 3,
            repsFeitas: '8-12',
            cargaKg: '40',
          },
          {
            exercicio: 'Prancha',
            grupoMuscular: null,
            seriesFeitas: 3,
            repsFeitas: '30s',
            cargaKg: null,
          },
        ],
      }),
      sessao('2026-10-05', { rpe: 10 }),
    ]);

    const r = await service.progresso(10, '30d', AGORA);

    expect(r.feedback).toEqual({ rpeMedio: 9.5, dorUltimos7d: true });
    expect(r.volumePorGrupo).toEqual([
      { semana: '2026-W40', grupo: 'Peito', volumeKg: 960 }, // 3 × 8 × 40
    ]);
    expect(r.cargaPorExercicio).toEqual([
      {
        exercicio: 'Supino reto',
        pontos: [{ data: '2026-10-03', cargaKg: 40 }],
      },
    ]);
    expect(r.alertas).toEqual(
      expect.arrayContaining(['DOR_REPORTADA', 'ESFORCO_ALTO']),
    );
  });

  it('avaliações: série com massa magra e delta desde a primeira', async () => {
    prisma.sessaoTreino.findMany.mockResolvedValue([]);
    prisma.avaliacao.findMany.mockResolvedValue([
      {
        dataAvaliacao: new Date('2026-08-01T15:00:00Z'),
        peso: '82.1',
        percentualGordura: '25',
        imc: '26.1',
      },
      {
        dataAvaliacao: new Date('2026-10-01T15:00:00Z'),
        peso: '80',
        percentualGordura: '22.4',
        imc: '25.4',
      },
    ]);

    const r = await service.progresso(10, '30d', AGORA);

    expect(r.avaliacoes.serie[1]).toMatchObject({
      peso: 80,
      massaMagra: 62.08,
    });
    expect(r.avaliacoes.deltaDesdePrimeira).toEqual({
      peso: -2.1,
      percentualGordura: -2.6,
    });
    expect(r.frequencia.percentual).toBeNull();
  });

  it('treino vencido só quando não há treino vigente', async () => {
    prisma.sessaoTreino.findMany.mockResolvedValue([]);
    prisma.treino.findMany.mockResolvedValue([
      { dataValidade: d('2026-09-01') },
    ]);
    expect((await service.progresso(10, '30d', AGORA)).alertas).toContain(
      'TREINO_VENCIDO',
    );

    prisma.treino.findMany.mockResolvedValue([
      { dataValidade: d('2026-09-01') },
      { dataValidade: null },
    ]);
    expect((await service.progresso(10, '30d', AGORA)).alertas).not.toContain(
      'TREINO_VENCIDO',
    );
  });

  describe('resumo', () => {
    it('usa uma única query agregada e monta os alertas', async () => {
      prisma.personal.findUnique.mockResolvedValue({
        fusoHorario: 'America/Sao_Paulo',
      });
      prisma.$queryRaw.mockResolvedValue([
        {
          id_aluno: 10,
          previstas30: BigInt(8),
          cumpridas30: BigInt(6),
          ultima_sessao: d('2026-10-05'),
          faltas_consecutivas: BigInt(2),
          dor_7d: false,
          esforco_alto_14d: BigInt(0),
          ultima_avaliacao: new Date('2026-07-01T15:00:00Z'),
          treino_vencido: false,
        },
        {
          id_aluno: 11,
          previstas30: BigInt(0),
          cumpridas30: BigInt(0),
          ultima_sessao: null,
          faltas_consecutivas: BigInt(0),
          dor_7d: false,
          esforco_alto_14d: BigInt(0),
          ultima_avaliacao: null,
          treino_vencido: false,
        },
      ]);

      const r = await service.resumo(1, AGORA);

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(r[0]).toEqual({
        alunoId: 10,
        frequencia30d: 0.75,
        ultimaSessao: '2026-10-05',
        faltasConsecutivas: 2,
        alertas: ['FALTAS_SEGUIDAS', 'AVALIACAO_ATRASADA'],
      });
      expect(r[1]).toMatchObject({
        alunoId: 11,
        frequencia30d: null,
        ultimaSessao: null,
        alertas: [],
      });
    });
  });
});
