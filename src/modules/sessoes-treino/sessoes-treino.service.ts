import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, StatusSessao } from '@prisma/client';
import {
  dataLocal,
  deDbDate,
  diaDaSemana,
  FUSO_PADRAO,
  horaLocal,
  paraDbDate,
  somarDias,
} from '../../common/datas/fuso';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  dentroDoPrazoAluno,
  ehDiaDaAgenda,
  horarioDoDia,
  JANELA_REPOSICAO_DIAS,
  parseCargaKg,
  podePreJustificar,
} from '../../common/sessoes/regras';
import { FaltasService } from '../faltas/faltas.service';
import {
  CreateSessaoDto,
  ListSessoesQueryDto,
  SessaoItemDto,
  UpdateSessaoDto,
} from './dto/create-sessao.dto';

export interface Ator {
  id: number;
  role: 'PERSONAL' | 'ALUNO';
}

type Tx = Prisma.TransactionClient;

const COMPOSTA_INCLUDE = {
  itens: { orderBy: { ordem: 'asc' as const } },
  repostaPor: { select: { id: true } },
} satisfies Prisma.SessaoTreinoInclude;

type SessaoComRelacoes = Prisma.SessaoTreinoGetPayload<{
  include: typeof COMPOSTA_INCLUDE;
}>;

const PRESENCA: StatusSessao[] = ['REALIZADA', 'PARCIAL'];
const CAMPOS_FEEDBACK_DTO = [
  'rpe',
  'disposicao',
  'dor',
  'dorLocal',
  'comentarioAluno',
] as const;

/** Limite do intervalo de `GET /sessoes-treino` (evita respostas gigantes). */
const MAX_DIAS_LISTAGEM = 400;

const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class SessoesTreinoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
    private readonly faltas: FaltasService,
  ) {}

  // ───────────────────────── contexto ─────────────────────────

  private async resolverAlunoId(
    ator: Ator,
    alunoIdDto?: number,
  ): Promise<number> {
    if (ator.role === 'ALUNO') return ator.id;
    if (alunoIdDto === undefined) {
      throw new BadRequestException('Informe o alunoId.');
    }
    await this.ownership.assertAlunoPertenceAoPersonal(alunoIdDto, ator.id);
    return alunoIdDto;
  }

  private async carregarContexto(alunoId: number, agora = new Date()) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
      select: {
        id: true,
        consentimentoSaudeEm: true,
        personal: { select: { fusoHorario: true } },
        agendaTreino: {
          select: { dias: true, horarios: true, acompanhamentoDesde: true },
        },
      },
    });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    const tz = aluno.personal?.fusoHorario ?? FUSO_PADRAO;
    return {
      aluno,
      agenda: aluno.agendaTreino,
      tz,
      hoje: dataLocal(agora, tz),
      horaAgora: horaLocal(agora, tz),
    };
  }

  private desdeAcompanhamento(
    agenda: { acompanhamentoDesde: Date } | null,
  ): string | null {
    return agenda ? deDbDate(agenda.acompanhamentoDesde) : null;
  }

  private async carregarSessao(id: number, ator: Ator) {
    const sessao = await this.prisma.sessaoTreino.findUnique({
      where: { id },
      include: { ...COMPOSTA_INCLUDE, aluno: { select: { personalId: true } } },
    });
    if (!sessao) throw new NotFoundException('Sessão não encontrada.');

    const permitido =
      ator.role === 'ALUNO'
        ? sessao.alunoId === ator.id
        : sessao.aluno.personalId === ator.id;
    if (!permitido) throw new NotFoundException('Sessão não encontrada.');

    return sessao;
  }

  // ───────────────────────── regras ─────────────────────────

  private exigirConsentimentoSeDor(
    consentimentoSaudeEm: Date | null,
    dor?: boolean,
    dorLocal?: string,
  ) {
    if ((dor || dorLocal) && !consentimentoSaudeEm) {
      throw new UnprocessableEntityException(
        'É preciso aceitar o termo de consentimento de saúde para registrar dor.',
      );
    }
  }

  private exigirFeedbackSoDoAluno(ator: Ator, dto: Partial<CreateSessaoDto>) {
    if (
      ator.role === 'PERSONAL' &&
      CAMPOS_FEEDBACK_DTO.some((campo) => dto[campo] !== undefined)
    ) {
      throw new ForbiddenException(
        'O feedback da sessão só pode ser preenchido pelo aluno.',
      );
    }
  }

  /** Dados de feedback normalizados respeitando o CHECK (dor OR dor_local IS NULL). */
  private montarFeedback(dto: Partial<CreateSessaoDto>) {
    const dados: {
      rpe?: number;
      disposicao?: number;
      comentarioAluno?: string;
      dor?: boolean;
      dorLocal?: string | null;
    } = {};
    if (dto.rpe !== undefined) dados.rpe = dto.rpe;
    if (dto.disposicao !== undefined) dados.disposicao = dto.disposicao;
    if (dto.comentarioAluno !== undefined) {
      dados.comentarioAluno = dto.comentarioAluno;
    }
    if (dto.dor !== undefined) {
      dados.dor = dto.dor;
      dados.dorLocal = dto.dor ? (dto.dorLocal ?? null) : null;
    } else if (dto.dorLocal !== undefined) {
      throw new BadRequestException(
        'Informe dor = true para registrar o local.',
      );
    }
    return dados;
  }

  private async montarItens(tx: Tx | PrismaService, itens: SessaoItemDto[]) {
    const ordens = new Set(itens.map((i) => i.ordem));
    if (ordens.size !== itens.length) {
      throw new BadRequestException('A ordem dos itens deve ser única.');
    }

    const catalogo = await tx.exercicio.findMany({
      where: { nome: { in: itens.map((i) => i.exercicio) } },
      select: { nome: true, grupoMuscular: true },
    });
    const grupos = new Map(catalogo.map((e) => [e.nome, e.grupoMuscular]));

    return itens.map((i) => ({
      ordem: i.ordem,
      exercicio: i.exercicio,
      grupoMuscular: grupos.get(i.exercicio) ?? null,
      seriesFeitas: i.seriesFeitas ?? null,
      repsFeitas: i.repsFeitas ?? null,
      cargaTexto: i.cargaTexto ?? null,
      cargaKg: parseCargaKg(i.cargaTexto),
      concluido: i.concluido,
    }));
  }

  private validarCriacao(
    dto: CreateSessaoDto,
    ator: Ator,
    ctx: Awaited<ReturnType<SessoesTreinoService['carregarContexto']>>,
    prevista: boolean,
    modalidade: string | null,
  ) {
    const { hoje, horaAgora, agenda } = ctx;
    const desde = this.desdeAcompanhamento(agenda);
    const horaTreino = horarioDoDia(
      agenda?.horarios,
      diaDaSemana(dto.data),
    )?.hora;

    if (PRESENCA.includes(dto.status)) {
      if (dto.data > hoje) {
        throw new BadRequestException(
          'Uma sessão realizada não pode ter data futura.',
        );
      }
      if (ator.role === 'ALUNO' && !dentroDoPrazoAluno(dto.data, hoje)) {
        throw new ForbiddenException(
          'O prazo para registrar este treino (7 dias) já passou. Fale com seu personal.',
        );
      }
      if (ator.role === 'PERSONAL' && desde && dto.data < desde) {
        throw new BadRequestException(
          `O acompanhamento deste aluno começa em ${desde}.`,
        );
      }
      return;
    }

    if (dto.status === 'FALTA') {
      if (ator.role !== 'PERSONAL') {
        throw new ForbiddenException(
          'Somente o personal pode registrar falta.',
        );
      }
      if (dto.data > hoje) {
        throw new BadRequestException('Uma falta não pode ter data futura.');
      }
      if (modalidade === 'ONLINE') {
        throw new BadRequestException(
          'Faltas manuais valem apenas para treinos presenciais.',
        );
      }
      if (desde && dto.data < desde) {
        throw new BadRequestException(
          `O acompanhamento deste aluno começa em ${desde}.`,
        );
      }
      return;
    }

    // FALTA_JUSTIFICADA
    const futura = dto.data > hoje || dto.data === hoje;
    if (futura && podePreJustificar(dto.data, hoje, horaAgora, horaTreino)) {
      if (!prevista) {
        throw new BadRequestException(
          'Só é possível pré-justificar um dia da agenda.',
        );
      }
      return;
    }
    if (dto.data >= hoje && dto.data > hoje) {
      throw new BadRequestException(
        'Pré-justificativa permitida apenas para dias da agenda nos próximos 30 dias.',
      );
    }
    if (dto.data === hoje) {
      throw new BadRequestException(
        horaTreino
          ? 'O horário do treino de hoje já passou: registre a falta ou o treino.'
          : 'Não há horário definido para hoje na agenda, então não é possível avisar com antecedência. Fale com seu personal.',
      );
    }
    if (ator.role === 'ALUNO' && !dentroDoPrazoAluno(dto.data, hoje)) {
      throw new ForbiddenException(
        'O prazo para justificar esta falta (7 dias) já passou. Fale com seu personal.',
      );
    }
    if (ator.role === 'PERSONAL' && desde && dto.data < desde) {
      throw new BadRequestException(
        `O acompanhamento deste aluno começa em ${desde}.`,
      );
    }
  }

  // ───────────────────────── reposição (RN07) ─────────────────────────

  /**
   * Vincula a sessão à falta não reposta mais antiga dos últimos 7 dias.
   * Usa SAVEPOINT porque, no Postgres, uma violação de unique dentro da
   * transação a aborta; com o savepoint dá para tentar a próxima falta.
   */
  async vincularReposicao(
    tx: Tx,
    sessao: { id: number; alunoId: number; data: string },
  ) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const falta = await tx.sessaoTreino.findFirst({
        where: {
          alunoId: sessao.alunoId,
          status: 'FALTA',
          prevista: true,
          repostaPor: null,
          data: {
            gte: paraDbDate(somarDias(sessao.data, -JANELA_REPOSICAO_DIAS)),
            lt: paraDbDate(sessao.data),
          },
        },
        orderBy: { data: 'asc' },
        select: { id: true },
      });
      if (!falta) return; // vira "extra"

      await tx.$executeRaw`SAVEPOINT reposicao`;
      try {
        await tx.sessaoTreino.update({
          where: { id: sessao.id },
          data: { reposicaoDeId: falta.id },
        });
        await tx.$executeRaw`RELEASE SAVEPOINT reposicao`;
        return;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT reposicao`; // corrida: tenta a próxima
      }
    }
  }

  // ───────────────────────── create ─────────────────────────

  async create(dto: CreateSessaoDto, ator: Ator) {
    const alunoId = await this.resolverAlunoId(ator, dto.alunoId);
    const ctx = await this.carregarContexto(alunoId);
    this.exigirFeedbackSoDoAluno(ator, dto);

    const dia = diaDaSemana(dto.data);
    const prevista = ctx.agenda
      ? ehDiaDaAgenda(dto.data, ctx.agenda.dias)
      : false;
    const modalidade =
      horarioDoDia(ctx.agenda?.horarios, dia)?.modalidade ?? null;

    this.validarCriacao(dto, ator, ctx, prevista, modalidade);
    this.exigirConsentimentoSeDor(
      ctx.aluno.consentimentoSaudeEm,
      dto.dor,
      dto.dorLocal,
    );

    let treinoObjetivo: string | null = null;
    if (dto.treinoId !== undefined) {
      const treino = await this.prisma.treino.findUnique({
        where: { id: dto.treinoId },
        select: { alunoId: true, objetivo: true },
      });
      if (!treino || treino.alunoId !== alunoId) {
        throw new BadRequestException('O treino não pertence a este aluno.');
      }
      treinoObjetivo = treino.objetivo;
    }

    try {
      const sessaoId = await this.prisma.$transaction(async (tx) => {
        const itens = dto.itens ? await this.montarItens(tx, dto.itens) : [];

        const criada = await tx.sessaoTreino.create({
          data: {
            alunoId,
            treinoId: dto.treinoId ?? null,
            treinoObjetivo,
            data: paraDbDate(dto.data),
            prevista,
            status: dto.status,
            origem: ator.role,
            modalidade,
            iniciadaEm: dto.iniciadaEm ? new Date(dto.iniciadaEm) : null,
            concluidaEm: dto.concluidaEm ? new Date(dto.concluidaEm) : null,
            motivoFalta: dto.motivoFalta ?? null,
            atualizadoPorRole: ator.role,
            ...this.montarFeedback(dto),
            itens: { create: itens },
          },
        });

        if (PRESENCA.includes(criada.status) && !criada.prevista) {
          await this.vincularReposicao(tx, {
            id: criada.id,
            alunoId,
            data: dto.data,
          });
        }
        return criada.id;
      });

      // Pós-commit: o personal marcou a falta, então só o aluno é avisado.
      if (dto.status === 'FALTA' && ator.role === 'PERSONAL') {
        void this.faltas.notificarAluno(sessaoId).catch(() => undefined);
      }

      return this.findOne(sessaoId, ator);
    } catch (e) {
      if (isUniqueViolation(e)) {
        const existente = await this.prisma.sessaoTreino.findUnique({
          where: { alunoId_data: { alunoId, data: paraDbDate(dto.data) } },
          select: { id: true, status: true },
        });
        throw new ConflictException({
          message:
            existente?.status === 'FALTA'
              ? 'Já existe uma falta registrada nesta data. Edite a sessão existente (ex.: informe que treinou ou justifique) em vez de criar outra.'
              : 'Já existe sessão nesta data.',
          sessaoId: existente?.id ?? null,
        });
      }
      throw e;
    }
  }

  // ───────────────────────── update ─────────────────────────

  async update(id: number, dto: UpdateSessaoDto, ator: Ator) {
    const atual = await this.carregarSessao(id, ator);
    const ctx = await this.carregarContexto(atual.alunoId);
    const dataSessao = deDbDate(atual.data);
    const { version, respostaPersonal, validar, itens, ...campos } = dto;

    if (ator.role === 'ALUNO') {
      if (respostaPersonal !== undefined || validar !== undefined) {
        throw new ForbiddenException(
          'Somente o personal pode responder ou validar a sessão.',
        );
      }
      if (atual.validadaEm) {
        throw new ForbiddenException(
          'Esta sessão já foi validada pelo personal e não pode mais ser editada.',
        );
      }
      if (!dentroDoPrazoAluno(dataSessao, ctx.hoje)) {
        // Pré-justificativa futura também pode ser desfeita/ajustada pelo aluno.
        const futuraPreJustificada =
          dataSessao > ctx.hoje && atual.status === 'FALTA_JUSTIFICADA';
        if (!futuraPreJustificada) {
          throw new ForbiddenException(
            'O prazo de edição (7 dias) desta sessão já passou.',
          );
        }
      }
      if (campos.status === 'FALTA') {
        throw new ForbiddenException(
          'Somente o personal pode registrar falta.',
        );
      }
    } else {
      this.exigirFeedbackSoDoAluno(ator, dto);
      if (campos.status === 'FALTA') {
        if (dataSessao > ctx.hoje) {
          throw new BadRequestException('Uma falta não pode ter data futura.');
        }
        if (atual.modalidade === 'ONLINE') {
          throw new BadRequestException(
            'Faltas manuais valem apenas para treinos presenciais.',
          );
        }
      }
    }

    const novoStatus = campos.status ?? atual.status;
    if (PRESENCA.includes(novoStatus) && dataSessao > ctx.hoje) {
      throw new BadRequestException(
        'Uma sessão realizada não pode ter data futura.',
      );
    }

    this.exigirConsentimentoSeDor(
      ctx.aluno.consentimentoSaudeEm,
      dto.dor,
      dto.dorLocal,
    );

    const dados: Prisma.SessaoTreinoUncheckedUpdateManyInput = {
      ...this.montarFeedback(dto),
      version: { increment: 1 },
      atualizadoPorRole: ator.role,
    };
    if (campos.status !== undefined) dados.status = campos.status;
    if (campos.motivoFalta !== undefined)
      dados.motivoFalta = campos.motivoFalta;
    if (campos.iniciadaEm !== undefined) {
      dados.iniciadaEm = new Date(campos.iniciadaEm);
    }
    if (campos.concluidaEm !== undefined) {
      dados.concluidaEm = new Date(campos.concluidaEm);
    }
    if (respostaPersonal !== undefined)
      dados.respostaPersonal = respostaPersonal;
    if (validar !== undefined) dados.validadaEm = validar ? new Date() : null;

    if (campos.treinoId !== undefined) {
      const treino = await this.prisma.treino.findUnique({
        where: { id: campos.treinoId },
        select: { alunoId: true, objetivo: true },
      });
      if (!treino || treino.alunoId !== atual.alunoId) {
        throw new BadRequestException('O treino não pertence a este aluno.');
      }
      dados.treinoId = campos.treinoId;
      dados.treinoObjetivo = treino.objetivo;
    }

    // Quando deixa de ser presença, a sessão não repõe mais nenhuma falta.
    if (!PRESENCA.includes(novoStatus)) dados.reposicaoDeId = null;

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.sessaoTreino.updateMany({
        where: { id, version },
        data: dados,
      });
      if (count === 0) {
        throw new ConflictException(
          'A sessão foi alterada por outra pessoa. Recarregue.',
        );
      }

      // Uma falta que deixou de ser falta (abonada ou convertida em treino)
      // não pode mais ter reposição apontando para ela.
      if (atual.status === 'FALTA' && novoStatus !== 'FALTA') {
        await tx.sessaoTreino.updateMany({
          where: { reposicaoDeId: id },
          data: { reposicaoDeId: null },
        });
      }

      if (itens !== undefined) {
        await tx.sessaoItem.deleteMany({ where: { sessaoId: id } });
        const snapshot = await this.montarItens(tx, itens);
        await tx.sessaoItem.createMany({
          data: snapshot.map((i) => ({ ...i, sessaoId: id })),
        });
      }

      if (
        PRESENCA.includes(novoStatus) &&
        !atual.prevista &&
        atual.reposicaoDeId === null
      ) {
        await this.vincularReposicao(tx, {
          id,
          alunoId: atual.alunoId,
          data: dataSessao,
        });
      }
    });

    return this.findOne(id, ator);
  }

  // ───────────────────────── leitura ─────────────────────────

  async findAll(query: ListSessoesQueryDto, ator: Ator) {
    const alunoId = await this.resolverAlunoId(ator, query.alunoId);
    const { hoje } = await this.carregarContexto(alunoId);
    const ate = query.ate ?? hoje;
    const de = query.de ?? somarDias(ate, -30);

    if (de > ate) {
      throw new BadRequestException('O início do período é posterior ao fim.');
    }
    if (somarDias(de, MAX_DIAS_LISTAGEM) < ate) {
      throw new BadRequestException(
        `O período máximo é de ${MAX_DIAS_LISTAGEM} dias.`,
      );
    }

    const sessoes = await this.prisma.sessaoTreino.findMany({
      where: {
        alunoId,
        data: { gte: paraDbDate(de), lte: paraDbDate(ate) },
      },
      include: COMPOSTA_INCLUDE,
      orderBy: { data: 'desc' },
    });
    return sessoes.map((s) => this.serializar(s));
  }

  async findOne(id: number, ator: Ator) {
    const sessao = await this.carregarSessao(id, ator);
    return this.serializar(sessao);
  }

  // ───────────────────────── exclusão ─────────────────────────

  async remove(id: number, ator: Ator) {
    const sessao = await this.carregarSessao(id, ator);
    if (sessao.origem === 'AUTOMATICA') {
      throw new ForbiddenException(
        'Faltas automáticas não podem ser excluídas: use abonar ou justificar.',
      );
    }
    // reposicaoDeId das sessões que apontam para esta volta a null (SetNull).
    await this.prisma.sessaoTreino.delete({ where: { id } });
    return { message: 'Sessão removida com sucesso.' };
  }

  // ───────────────────────── serialização ─────────────────────────

  private serializar(s: SessaoComRelacoes) {
    const { repostaPor, itens, data, ...resto } = s;
    // Campos internos de idempotência das notificações não vão para a API.
    const {
      notificadoAlunoEm: _a,
      notificadoPersonalEm: _p,
      mensagemChave: _m,
      ...publico
    } = resto;
    void _a;
    void _p;
    void _m;
    return {
      ...publico,
      data: deDbDate(data),
      reposta: repostaPor !== null,
      repostaPorId: repostaPor?.id ?? null,
      itens: itens.map((i) => ({
        ...i,
        cargaKg: i.cargaKg === null ? null : Number(i.cargaKg),
      })),
    };
  }
}
