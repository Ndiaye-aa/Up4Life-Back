import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Prisma, TipoTreino } from '@prisma/client';
import { LIMITE_LISTAGEM } from '../../common/config/limites';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { CreateTreinoDto } from './dto/create-treino.dto';
import { UpdateTreinoDto } from './dto/update-treino.dto';
import { CreateItemTreinoDto } from './dto/create-item-treino.dto';
import { DuplicarTreinoDto } from './dto/duplicar-treino.dto';
import { PAUSA_REST_PAUSE_PADRAO, validarMetodos } from './regras-metodo';

type GrupoPorNome = { nome: string; grupoMuscular: string };

@Injectable()
export class TreinosService {
  private readonly logger = new Logger(TreinosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  /** Mapeia o DTO para o formato de criação do Prisma (Json? exige JsonNull). */
  private toItemData(
    item: CreateItemTreinoDto,
  ): Prisma.ItemTreinoCreateWithoutTreinoInput {
    const tipoSerie = item.tipoSerie ?? 'NORMAL';
    const etapas = item.etapas?.length
      ? item.etapas.map((e) => ({ carga: e.carga, repeticoes: e.repeticoes }))
      : null;

    return {
      exercicio: item.exercicio,
      series: item.series,
      repeticoes: item.repeticoes,
      carga: item.carga,
      ordem: item.ordem,
      descanso: item.descanso,
      obs: item.obs,
      tipoSerie,
      grupoCombinado: item.grupoCombinado ?? null,
      etapas: etapas ?? Prisma.JsonNull,
      pausaSegundos:
        tipoSerie === 'REST_PAUSE'
          ? (item.pausaSegundos ?? PAUSA_REST_PAUSE_PADRAO)
          : null,
    };
  }

  /** Rotina de alongamento não tem dia fixo nem métodos especiais de série. */
  private validateTipo(dto: CreateTreinoDto) {
    if (dto.tipo !== 'ALONGAMENTO') return;

    if (dto.diaSemana != null) {
      throw new BadRequestException(
        'A rotina de alongamento não pode ter dia da semana.',
      );
    }
    if (dto.itens.some((i) => (i.tipoSerie ?? 'NORMAL') !== 'NORMAL')) {
      throw new BadRequestException(
        'A rotina de alongamento não aceita métodos de série.',
      );
    }
  }

  private async validateItens(
    itens: CreateItemTreinoDto[],
    tipo: TipoTreino = 'EXERCICIOS',
  ) {
    // 1. Validar duplicidade de ordem nos itens
    const ordens = itens.map((i) => i.ordem);
    const hasDuplicateOrdem = ordens.some(
      (ordem, index) => ordens.indexOf(ordem) !== index,
    );

    if (hasDuplicateOrdem) {
      throw new BadRequestException(
        'Um treino não pode ter dois exercícios com a mesma ordem.',
      );
    }

    // 2. Validar coerência dos métodos (blocos, etapas, pausa)
    const erroMetodo = validarMetodos(itens);
    if (erroMetodo) {
      throw new BadRequestException(erroMetodo);
    }

    // 3. Validar se os exercícios existem no catálogo
    const nomesExercicios = itens.map((i) => i.exercicio);
    const where = { nome: { in: nomesExercicios } };
    const catalogCount =
      tipo === 'ALONGAMENTO'
        ? await this.prisma.alongamento.count({ where })
        : await this.prisma.exercicio.count({ where });

    if (catalogCount < [...new Set(nomesExercicios)].length) {
      throw new BadRequestException(
        tipo === 'ALONGAMENTO'
          ? 'Um ou mais alongamentos não foram encontrados no catálogo.'
          : 'Um ou mais exercícios não foram encontrados no catálogo.',
      );
    }
  }

  private async attachGrupoMuscular<
    T extends { tipo: TipoTreino; itens: { exercicio: string }[] },
  >(treino: T): Promise<T> {
    const [enriched] = await this.attachGrupoMuscularMany([treino]);
    return enriched;
  }

  private async attachGrupoMuscularMany<
    T extends { tipo: TipoTreino; itens: { exercicio: string }[] },
  >(treinos: T[]): Promise<T[]> {
    const nomesDe = (tipo: TipoTreino) => [
      ...new Set(
        treinos
          .filter((t) => t.tipo === tipo)
          .flatMap((t) => t.itens.map((i) => i.exercicio)),
      ),
    ];
    const nomesExercicios = nomesDe('EXERCICIOS');
    const nomesAlongamentos = nomesDe('ALONGAMENTO');

    if (nomesExercicios.length === 0 && nomesAlongamentos.length === 0) {
      return treinos;
    }

    const [exercicios, alongamentos] = await Promise.all([
      nomesExercicios.length
        ? this.prisma.exercicio.findMany({
            where: { nome: { in: nomesExercicios } },
            select: { nome: true, grupoMuscular: true },
          })
        : ([] as GrupoPorNome[]),
      nomesAlongamentos.length
        ? this.prisma.alongamento.findMany({
            where: { nome: { in: nomesAlongamentos } },
            select: { nome: true, grupoMuscular: true },
          })
        : ([] as GrupoPorNome[]),
    ]);
    const grupoExercicio = new Map(
      exercicios.map((e) => [e.nome, e.grupoMuscular]),
    );
    const grupoAlongamento = new Map(
      alongamentos.map((e) => [e.nome, e.grupoMuscular]),
    );

    return treinos.map((treino) => ({
      ...treino,
      itens: treino.itens.map((item) => ({
        ...item,
        grupoMuscular:
          (treino.tipo === 'ALONGAMENTO'
            ? grupoAlongamento
            : grupoExercicio
          ).get(item.exercicio) ?? null,
      })),
    }));
  }

  private async resolveOwner(
    dto: { paraMim?: boolean; alunoId?: number },
    personalId: number,
  ) {
    if (dto.paraMim && dto.alunoId != null) {
      throw new BadRequestException(
        'Informe alunoId ou paraMim, nunca os dois.',
      );
    }

    // paraMim: o vínculo é sempre com o personal autenticado (JWT) — nunca com outro personal
    if (dto.paraMim) {
      return { alunoId: null, personalId };
    }

    await this.ownership.assertAlunoPertenceAoPersonal(
      dto.alunoId!,
      personalId,
    );
    return { alunoId: dto.alunoId!, personalId: null };
  }

  async create(dto: CreateTreinoDto, personalId: number) {
    const owner = await this.resolveOwner(dto, personalId);
    this.validateTipo(dto);
    await this.validateItens(dto.itens, dto.tipo);

    // Persistir treino e itens em uma transação explícita
    const treino = await this.prisma.$transaction(async (tx) => {
      return tx.treino.create({
        data: {
          alunoId: owner.alunoId,
          personalId: owner.personalId,
          objetivo: dto.objetivo,
          observacoes: dto.observacoes,
          dataValidade: dto.dataValidade,
          diaSemana: dto.diaSemana ?? null,
          tipo: dto.tipo ?? 'EXERCICIOS',
          itens: {
            create: dto.itens.map((item) => this.toItemData(item)),
          },
        },
        include: {
          itens: {
            orderBy: {
              ordem: 'asc',
            },
          },
        },
      });
    });

    return this.attachGrupoMuscular(treino);
  }

  async findAllByAluno(alunoId: number, userId: number, role: string) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
    });
    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado.');
    }

    const hasAccess =
      role === 'PERSONAL' ? aluno.personalId === userId : aluno.id === userId;
    if (!hasAccess) {
      throw new ForbiddenException('Acesso negado.');
    }

    const treinos = await this.prisma.treino.findMany({
      where: { alunoId },
      include: {
        itens: {
          orderBy: { ordem: 'asc' },
        },
      },
      orderBy: [{ tipo: 'desc' }, { criadoEm: 'desc' }],
    });

    return this.attachGrupoMuscularMany(treinos);
  }

  async findOne(id: number, userId: number, role: string) {
    const treino = await this.prisma.treino.findUnique({
      where: { id },
      include: {
        aluno: true,
        itens: {
          orderBy: { ordem: 'asc' },
        },
      },
    });

    if (!treino) {
      throw new NotFoundException('Treino não encontrado.');
    }

    const hasAccess =
      role === 'PERSONAL'
        ? treino.personalId === userId || treino.aluno?.personalId === userId
        : treino.alunoId === userId;
    if (!hasAccess) {
      throw new ForbiddenException('Acesso negado.');
    }

    return this.attachGrupoMuscular(treino);
  }

  async findAllByPersonal(personalId: number) {
    const treinos = await this.prisma.treino.findMany({
      where: { OR: [{ aluno: { personalId } }, { personalId }] },
      include: {
        aluno: { select: { nome: true, personalId: true, academia: true } },
        personal: { select: { nome: true } },
        itens: { orderBy: { ordem: 'asc' } },
      },
      orderBy: [{ tipo: 'desc' }, { criadoEm: 'desc' }],
      take: LIMITE_LISTAGEM,
    });
    if (treinos.length === LIMITE_LISTAGEM) {
      this.logger.warn(
        `Listagem de treinos do personal ${personalId} atingiu o teto de ${LIMITE_LISTAGEM}; implemente paginação.`,
      );
    }

    return this.attachGrupoMuscularMany(treinos);
  }

  async findMeuTreino(alunoId: number) {
    const treinos = await this.prisma.treino.findMany({
      where: { alunoId },
      include: {
        itens: { orderBy: { ordem: 'asc' } },
      },
      orderBy: [{ tipo: 'desc' }, { criadoEm: 'desc' }],
    });

    return this.attachGrupoMuscularMany(treinos);
  }

  async update(id: number, dto: UpdateTreinoDto, personalId: number) {
    // 1. Garante que o treino existe e pertence a este personal (direto ou via aluno)
    await this.ownership.assertTreinoPertenceAoPersonal(id, personalId);

    // 2. Resolve o dono de destino (aluno do personal ou o próprio personal)
    const owner = await this.resolveOwner(dto, personalId);

    this.validateTipo(dto);
    await this.validateItens(dto.itens, dto.tipo);

    // 3. Substitui os itens por completo (payload sempre vem com a lista inteira)
    const treino = await this.prisma.$transaction(async (tx) => {
      await tx.itemTreino.deleteMany({ where: { treinoId: id } });

      return tx.treino.update({
        where: { id },
        data: {
          alunoId: owner.alunoId,
          personalId: owner.personalId,
          objetivo: dto.objetivo,
          observacoes: dto.observacoes,
          dataValidade: dto.dataValidade,
          diaSemana: dto.diaSemana ?? null,
          tipo: dto.tipo ?? 'EXERCICIOS',
          itens: {
            create: dto.itens.map((item) => this.toItemData(item)),
          },
        },
        include: {
          itens: {
            orderBy: {
              ordem: 'asc',
            },
          },
        },
      });
    });

    return this.attachGrupoMuscular(treino);
  }

  async duplicate(id: number, dto: DuplicarTreinoDto, personalId: number) {
    await this.ownership.assertTreinoPertenceAoPersonal(id, personalId);
    const owner = await this.resolveOwner(dto, personalId);

    const origem = await this.prisma.treino.findUniqueOrThrow({
      where: { id },
      include: { itens: { orderBy: { ordem: 'asc' } } },
    });

    // dataValidade não é copiada: o novo aluno começa um ciclo próprio
    const treino = await this.prisma.treino.create({
      data: {
        alunoId: owner.alunoId,
        personalId: owner.personalId,
        objetivo: dto.objetivo ?? origem.objetivo,
        observacoes: origem.observacoes,
        diaSemana: origem.diaSemana,
        tipo: origem.tipo,
        itens: {
          create: origem.itens.map((item) => ({
            exercicio: item.exercicio,
            series: item.series,
            repeticoes: item.repeticoes,
            carga: item.carga,
            ordem: item.ordem,
            descanso: item.descanso,
            obs: item.obs,
            tipoSerie: item.tipoSerie,
            grupoCombinado: item.grupoCombinado,
            etapas: item.etapas ?? Prisma.JsonNull,
            pausaSegundos: item.pausaSegundos,
          })),
        },
      },
      include: { itens: { orderBy: { ordem: 'asc' } } },
    });

    return this.attachGrupoMuscular(treino);
  }

  async remove(id: number, personalId: number) {
    await this.ownership.assertTreinoPertenceAoPersonal(id, personalId);
    return this.prisma.treino.delete({ where: { id } });
  }
}
