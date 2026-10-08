/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return -- acesso a mock.calls (any) em testes */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FaltasService } from '../faltas/faltas.service';
import { SessoesTreinoService, Ator } from './sessoes-treino.service';

// 2026-10-07 é quarta-feira (dia 3). Em São Paulo são 12:00.
const AGORA = new Date('2026-10-07T15:00:00Z');
const ALUNO: Ator = { id: 10, role: 'ALUNO' };
const PERSONAL: Ator = { id: 1, role: 'PERSONAL' };

const unique = () =>
  new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: 'test',
  });

describe('SessoesTreinoService', () => {
  let service: SessoesTreinoService;

  const prisma = {
    aluno: { findUnique: jest.fn() },
    treino: { findUnique: jest.fn() },
    exercicio: { findMany: jest.fn() },
    sessaoTreino: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    sessaoItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const ownership = { assertAlunoPertenceAoPersonal: jest.fn() };
  const faltas = { notificarAluno: jest.fn() };

  const alunoCtx = (extra: Record<string, unknown> = {}) => ({
    id: 10,
    consentimentoSaudeEm: null,
    personal: { fusoHorario: 'America/Sao_Paulo' },
    agendaTreino: {
      dias: [1, 3],
      horarios: { '3': { hora: '18:00', modalidade: 'PRESENCIAL' } },
      acompanhamentoDesde: new Date('2026-09-01T00:00:00Z'),
    },
    ...extra,
  });

  const sessaoBanco = (extra: Record<string, unknown> = {}) => ({
    id: 5,
    alunoId: 10,
    data: new Date('2026-10-05T00:00:00Z'),
    prevista: true,
    status: 'FALTA',
    origem: 'AUTOMATICA',
    modalidade: 'PRESENCIAL',
    validadaEm: null,
    reposicaoDeId: null,
    version: 0,
    itens: [],
    repostaPor: null,
    aluno: { personalId: 1 },
    ...extra,
  });

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(AGORA);
    const module = await Test.createTestingModule({
      providers: [
        SessoesTreinoService,
        { provide: PrismaService, useValue: prisma },
        { provide: OwnershipService, useValue: ownership },
        { provide: FaltasService, useValue: faltas },
      ],
    }).compile();
    service = module.get(SessoesTreinoService);

    ownership.assertAlunoPertenceAoPersonal.mockResolvedValue(undefined);
    prisma.aluno.findUnique.mockResolvedValue(alunoCtx());
    prisma.$transaction.mockImplementation((cb) => cb(prisma));
    prisma.exercicio.findMany.mockResolvedValue([]);
    prisma.sessaoTreino.findUnique.mockResolvedValue(sessaoBanco());
    prisma.sessaoTreino.findFirst.mockResolvedValue(null);
    faltas.notificarAluno.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('create — matriz de permissões', () => {
    it('aluno não pode criar FALTA', async () => {
      await expect(
        service.create({ data: '2026-10-06', status: 'FALTA' }, ALUNO),
      ).rejects.toThrow(ForbiddenException);
    });

    it('aluno só registra treino entre hoje−7 e hoje', async () => {
      await expect(
        service.create({ data: '2026-09-29', status: 'REALIZADA' }, ALUNO),
      ).rejects.toThrow(ForbiddenException); // D−8

      prisma.sessaoTreino.create.mockResolvedValue({
        id: 5,
        status: 'REALIZADA',
        prevista: true,
      });
      await expect(
        service.create({ data: '2026-09-30', status: 'REALIZADA' }, ALUNO),
      ).resolves.toBeDefined(); // D−7
    });

    it('RN03: sessão realizada não pode ter data futura', async () => {
      await expect(
        service.create({ data: '2026-10-08', status: 'REALIZADA' }, ALUNO),
      ).rejects.toThrow(BadRequestException);
    });

    it('personal não preenche o feedback do aluno', async () => {
      await expect(
        service.create(
          { alunoId: 10, data: '2026-10-06', status: 'REALIZADA', rpe: 8 },
          PERSONAL,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('personal confere a posse do aluno', async () => {
      ownership.assertAlunoPertenceAoPersonal.mockRejectedValue(
        new ForbiddenException(),
      );
      await expect(
        service.create(
          { alunoId: 99, data: '2026-10-06', status: 'FALTA' },
          PERSONAL,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('personal não marca falta manual em treino online', async () => {
      prisma.aluno.findUnique.mockResolvedValue(
        alunoCtx({
          agendaTreino: {
            dias: [1, 3],
            horarios: { '1': { hora: '07:00', modalidade: 'ONLINE' } },
            acompanhamentoDesde: new Date('2026-09-01T00:00:00Z'),
          },
        }),
      );
      await expect(
        service.create(
          { alunoId: 10, data: '2026-10-05', status: 'FALTA' },
          PERSONAL,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('personal não cria antes de acompanhamentoDesde', async () => {
      await expect(
        service.create(
          { alunoId: 10, data: '2026-08-31', status: 'FALTA' },
          PERSONAL,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create — pré-justificativa', () => {
    it('aceita dia futuro da agenda', async () => {
      prisma.sessaoTreino.create.mockResolvedValue({
        id: 7,
        status: 'FALTA_JUSTIFICADA',
        prevista: true,
      });
      await expect(
        service.create(
          { data: '2026-10-12', status: 'FALTA_JUSTIFICADA' },
          ALUNO,
        ),
      ).resolves.toBeDefined(); // segunda
    });

    it('recusa dia fora da agenda e mais de 30 dias à frente', async () => {
      await expect(
        service.create(
          { data: '2026-10-13', status: 'FALTA_JUSTIFICADA' },
          ALUNO,
        ),
      ).rejects.toThrow(BadRequestException); // terça
      await expect(
        service.create(
          { data: '2026-11-09', status: 'FALTA_JUSTIFICADA' },
          ALUNO,
        ),
      ).rejects.toThrow(BadRequestException); // D+33 (segunda)
    });

    it('hoje só antes do horário do treino', async () => {
      prisma.sessaoTreino.create.mockResolvedValue({
        id: 7,
        status: 'FALTA_JUSTIFICADA',
        prevista: true,
      });
      // 12:00 < 18:00
      await expect(
        service.create(
          { data: '2026-10-07', status: 'FALTA_JUSTIFICADA' },
          ALUNO,
        ),
      ).resolves.toBeDefined();

      jest.setSystemTime(new Date('2026-10-07T22:00:00Z')); // 19:00 em SP
      await expect(
        service.create(
          { data: '2026-10-07', status: 'FALTA_JUSTIFICADA' },
          ALUNO,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('create — consentimento e conflitos', () => {
    it('RN12: dor sem consentimento responde 422', async () => {
      await expect(
        service.create(
          {
            data: '2026-10-06',
            status: 'REALIZADA',
            dor: true,
            dorLocal: 'joelho',
          },
          ALUNO,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('dor com consentimento é aceita', async () => {
      prisma.aluno.findUnique.mockResolvedValue(
        alunoCtx({ consentimentoSaudeEm: new Date() }),
      );
      prisma.sessaoTreino.create.mockResolvedValue({
        id: 5,
        status: 'REALIZADA',
        prevista: false,
      });
      await expect(
        service.create(
          {
            data: '2026-10-06',
            status: 'REALIZADA',
            dor: true,
            dorLocal: 'joelho',
          },
          ALUNO,
        ),
      ).resolves.toBeDefined();
    });

    it('segunda sessão no mesmo dia responde 409', async () => {
      prisma.sessaoTreino.create.mockRejectedValue(unique());
      prisma.sessaoTreino.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ data: '2026-10-06', status: 'REALIZADA' }, ALUNO),
      ).rejects.toThrow(ConflictException);
    });

    it('409 por falta existente orienta a editar e devolve o id', async () => {
      prisma.sessaoTreino.create.mockRejectedValue(unique());
      prisma.sessaoTreino.findUnique.mockResolvedValue({
        id: 42,
        status: 'FALTA',
      });
      await expect(
        service.create({ data: '2026-10-06', status: 'REALIZADA' }, ALUNO),
      ).rejects.toMatchObject({
        response: {
          message: expect.stringContaining('falta registrada'),
          sessaoId: 42,
        },
      });
    });

    it('pré-justificar hoje sem horário na agenda explica o motivo', async () => {
      prisma.aluno.findUnique.mockResolvedValue(
        alunoCtx({
          agendaTreino: {
            dias: [3],
            horarios: {},
            acompanhamentoDesde: new Date('2026-09-01T00:00:00Z'),
          },
        }),
      );
      await expect(
        service.create(
          { data: '2026-10-07', status: 'FALTA_JUSTIFICADA' },
          ALUNO,
        ),
      ).rejects.toThrow(/Não há horário definido/);
    });

    it('falta marcada pelo personal notifica o aluno após o commit', async () => {
      prisma.sessaoTreino.create.mockResolvedValue({
        id: 5,
        status: 'FALTA',
        prevista: true,
      });
      await service.create(
        { alunoId: 10, data: '2026-10-05', status: 'FALTA' },
        PERSONAL,
      );
      expect(faltas.notificarAluno).toHaveBeenCalledWith(5);
    });

    it('snapshot de itens calcula cargaKg e grupo muscular', async () => {
      prisma.exercicio.findMany.mockResolvedValue([
        { nome: 'Supino reto', grupoMuscular: 'Peito' },
      ]);
      prisma.sessaoTreino.create.mockResolvedValue({
        id: 5,
        status: 'REALIZADA',
        prevista: true,
      });

      await service.create(
        {
          data: '2026-10-05',
          status: 'REALIZADA',
          itens: [
            {
              ordem: 1,
              exercicio: 'Supino reto',
              cargaTexto: '40,5 kg',
              concluido: true,
            },
            {
              ordem: 2,
              exercicio: 'Prancha',
              cargaTexto: 'Corporal',
              concluido: true,
            },
          ],
        },
        ALUNO,
      );

      const data = prisma.sessaoTreino.create.mock.calls[0][0].data;
      expect(data.itens.create).toEqual([
        expect.objectContaining({ grupoMuscular: 'Peito', cargaKg: 40.5 }),
        expect.objectContaining({ grupoMuscular: null, cargaKg: null }),
      ]);
    });
  });

  describe('reposição (RN07)', () => {
    it('sessão fora da agenda é vinculada à falta mais antiga da janela', async () => {
      prisma.sessaoTreino.findFirst.mockResolvedValue({ id: 3 });
      prisma.sessaoTreino.create.mockResolvedValue({
        id: 8,
        status: 'REALIZADA',
        prevista: false,
      });

      // terça: fora da agenda [1,3]
      await service.create({ data: '2026-10-06', status: 'REALIZADA' }, ALUNO);

      expect(prisma.sessaoTreino.update).toHaveBeenCalledWith({
        where: { id: 8 },
        data: { reposicaoDeId: 3 },
      });
    });

    it('na corrida (P2002) desfaz o savepoint e tenta a próxima falta', async () => {
      prisma.sessaoTreino.findFirst
        .mockResolvedValueOnce({ id: 3 })
        .mockResolvedValueOnce({ id: 4 });
      prisma.sessaoTreino.update
        .mockRejectedValueOnce(unique())
        .mockResolvedValueOnce({});
      prisma.sessaoTreino.create.mockResolvedValue({
        id: 8,
        status: 'REALIZADA',
        prevista: false,
      });

      await service.create({ data: '2026-10-06', status: 'REALIZADA' }, ALUNO);

      expect(prisma.sessaoTreino.update).toHaveBeenLastCalledWith({
        where: { id: 8 },
        data: { reposicaoDeId: 4 },
      });
    });

    it('sem falta a repor vira extra (nenhum vínculo)', async () => {
      prisma.sessaoTreino.create.mockResolvedValue({
        id: 8,
        status: 'REALIZADA',
        prevista: false,
      });
      await service.create({ data: '2026-10-06', status: 'REALIZADA' }, ALUNO);
      expect(prisma.sessaoTreino.update).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('RN11: versão desatualizada responde 409', async () => {
      prisma.sessaoTreino.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.update(5, { version: 0, status: 'REALIZADA' }, ALUNO),
      ).rejects.toThrow(ConflictException);
    });

    it('aluno edita dentro do prazo (RN09: FALTA → REALIZADA)', async () => {
      prisma.sessaoTreino.updateMany.mockResolvedValue({ count: 1 });
      await service.update(5, { version: 0, status: 'REALIZADA' }, ALUNO);
      expect(prisma.sessaoTreino.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5, version: 0 },
          data: expect.objectContaining({
            status: 'REALIZADA',
            version: { increment: 1 },
            atualizadoPorRole: 'ALUNO',
          }),
        }),
      );
      // a falta deixou de ser falta: reposições apontando para ela são desvinculadas
      expect(prisma.sessaoTreino.updateMany).toHaveBeenCalledWith({
        where: { reposicaoDeId: 5 },
        data: { reposicaoDeId: null },
      });
    });

    it('aluno fora do prazo recebe 403', async () => {
      prisma.sessaoTreino.findUnique.mockResolvedValue(
        sessaoBanco({ data: new Date('2026-09-29T00:00:00Z') }),
      );
      await expect(
        service.update(5, { version: 0, status: 'REALIZADA' }, ALUNO),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sessão validada trava a edição do aluno', async () => {
      prisma.sessaoTreino.findUnique.mockResolvedValue(
        sessaoBanco({ validadaEm: new Date() }),
      );
      await expect(
        service.update(5, { version: 0, status: 'REALIZADA' }, ALUNO),
      ).rejects.toThrow(ForbiddenException);
    });

    it('aluno não responde nem valida', async () => {
      await expect(
        service.update(5, { version: 0, validar: true }, ALUNO),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.update(5, { version: 0, respostaPersonal: 'ok' }, ALUNO),
      ).rejects.toThrow(ForbiddenException);
    });

    it('aluno não converte sessão em FALTA', async () => {
      await expect(
        service.update(5, { version: 0, status: 'FALTA' }, ALUNO),
      ).rejects.toThrow(ForbiddenException);
    });

    it('personal valida e responde, e não edita o feedback', async () => {
      prisma.sessaoTreino.updateMany.mockResolvedValue({ count: 1 });
      await service.update(
        5,
        { version: 0, validar: true, respostaPersonal: 'Boa!' },
        PERSONAL,
      );
      expect(prisma.sessaoTreino.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            respostaPersonal: 'Boa!',
            validadaEm: expect.any(Date),
          }),
        }),
      );
      await expect(
        service.update(5, { version: 0, rpe: 9 }, PERSONAL),
      ).rejects.toThrow(ForbiddenException);
    });

    it('personal edita sessão antiga sem limite de prazo', async () => {
      prisma.sessaoTreino.findUnique.mockResolvedValue(
        sessaoBanco({ data: new Date('2026-09-10T00:00:00Z') }),
      );
      prisma.sessaoTreino.updateMany.mockResolvedValue({ count: 1 });
      await expect(
        service.update(
          5,
          { version: 0, status: 'FALTA_JUSTIFICADA' },
          PERSONAL,
        ),
      ).resolves.toBeDefined(); // abonar
    });

    it('substitui os itens por inteiro', async () => {
      prisma.sessaoTreino.updateMany.mockResolvedValue({ count: 1 });
      await service.update(
        5,
        {
          version: 0,
          itens: [{ ordem: 1, exercicio: 'Agachamento', concluido: true }],
        },
        ALUNO,
      );
      expect(prisma.sessaoItem.deleteMany).toHaveBeenCalledWith({
        where: { sessaoId: 5 },
      });
      expect(prisma.sessaoItem.createMany).toHaveBeenCalled();
    });

    it('sessão de outro aluno parece inexistente', async () => {
      prisma.sessaoTreino.findUnique.mockResolvedValue(
        sessaoBanco({ alunoId: 77 }),
      );
      await expect(service.update(5, { version: 0 }, ALUNO)).rejects.toThrow(
        'Sessão não encontrada.',
      );
    });
  });

  describe('listagem — limites', () => {
    it('rejeita períodos maiores que 400 dias e intervalos invertidos', async () => {
      await expect(
        service.findAll({ de: '2024-01-01', ate: '2026-10-01' }, ALUNO),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.findAll({ de: '2026-10-05', ate: '2026-10-01' }, ALUNO),
      ).rejects.toThrow(BadRequestException);
    });

    it('aceita até 400 dias', async () => {
      prisma.sessaoTreino.findMany.mockResolvedValue([]);
      await expect(
        service.findAll({ de: '2025-09-02', ate: '2026-10-07' }, ALUNO),
      ).resolves.toEqual([]);
    });
  });

  describe('leitura e exclusão', () => {
    it('personal de outro personal não acessa a sessão', async () => {
      prisma.sessaoTreino.findUnique.mockResolvedValue(
        sessaoBanco({ aluno: { personalId: 999 } }),
      );
      await expect(service.findOne(5, PERSONAL)).rejects.toThrow(
        'Sessão não encontrada.',
      );
    });

    it('exclusão de falta AUTOMATICA é bloqueada (RN08)', async () => {
      await expect(service.remove(5, PERSONAL)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.sessaoTreino.delete).not.toHaveBeenCalled();
    });

    it('exclui sessão registrada manualmente', async () => {
      prisma.sessaoTreino.findUnique.mockResolvedValue(
        sessaoBanco({ origem: 'ALUNO', status: 'REALIZADA' }),
      );
      await service.remove(5, PERSONAL);
      expect(prisma.sessaoTreino.delete).toHaveBeenCalledWith({
        where: { id: 5 },
      });
    });

    it('a resposta omite os campos internos de notificação', async () => {
      const r = await service.findOne(5, PERSONAL);
      expect(r).not.toHaveProperty('notificadoAlunoEm');
      expect(r).toHaveProperty('data', '2026-10-05');
    });
  });
});
