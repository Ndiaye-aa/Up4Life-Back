import { BadRequestException, Injectable } from '@nestjs/common';
import { dataLocal, FUSO_PADRAO, paraDbDate } from '../../common/datas/fuso';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { horarioDoDia } from '../../common/sessoes/regras';
import { SaveAgendaDto } from './dto/save-agenda.dto';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Atualiza `diasDesde` ao salvar a agenda: dia que permanece mantém a data;
 * dia que entra recebe `hoje`; dia que sai é removido. Evita que o job de
 * faltas crie faltas retroativas para um dia da semana recém-adicionado.
 */
export function calcularDiasDesde(
  diasAntigos: number[],
  diasDesdeAntigo: unknown,
  diasNovos: number[],
  hoje: string,
): Record<string, string> {
  const antigo =
    diasDesdeAntigo && typeof diasDesdeAntigo === 'object'
      ? (diasDesdeAntigo as Record<string, string>)
      : {};
  const resultado: Record<string, string> = {};

  for (const dia of diasNovos) {
    const chave = String(dia);
    if (diasAntigos.includes(dia) && antigo[chave]) {
      resultado[chave] = antigo[chave];
    } else if (!diasAntigos.includes(dia)) {
      resultado[chave] = hoje;
    }
    // Dia antigo sem registro (legado) fica sem data: vale desde acompanhamentoDesde.
  }
  return resultado;
}

/** Normaliza para { [dia]: { hora, modalidade } } e valida chaves, horas e modalidade. */
export function normalizarHorarios(
  horarios: SaveAgendaDto['horarios'],
  dias: number[],
): Record<string, { hora: string; modalidade: 'PRESENCIAL' | 'ONLINE' }> {
  const resultado: Record<
    string,
    { hora: string; modalidade: 'PRESENCIAL' | 'ONLINE' }
  > = {};

  for (const [chave, bruto] of Object.entries(horarios ?? {})) {
    const dia = Number(chave);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6 || !dias.includes(dia)) {
      throw new BadRequestException(
        `Horário informado para um dia fora da agenda: ${chave}.`,
      );
    }
    const h = horarioDoDia({ [chave]: bruto }, dia);
    const modalidade =
      typeof bruto === 'object' && bruto?.modalidade !== undefined
        ? bruto.modalidade
        : 'PRESENCIAL';
    if (!h || !HORA_REGEX.test(h.hora)) {
      throw new BadRequestException(`Horário inválido para o dia ${chave}.`);
    }
    if (modalidade !== 'PRESENCIAL' && modalidade !== 'ONLINE') {
      throw new BadRequestException(`Modalidade inválida para o dia ${chave}.`);
    }
    resultado[chave] = { hora: h.hora, modalidade };
  }
  return resultado;
}

@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  async findAllByPersonal(personalId: number) {
    const agendas = await this.prisma.agendaTreino.findMany({
      where: { personalId },
      orderBy: { alunoId: 'asc' },
    });

    return agendas.map((agenda) => this.serializar(agenda));
  }

  async findByAluno(alunoId: number) {
    const agenda = await this.prisma.agendaTreino.findUnique({
      where: { alunoId },
    });
    // Sempre um objeto: o Nest responde corpo vazio para `null` e o front falha no `json()`.
    return agenda
      ? this.serializar(agenda)
      : { alunoId, dias: [], horarios: {}, acompanhamentoDesde: null };
  }

  private serializar(agenda: {
    alunoId: number;
    dias: number[];
    horarios: unknown;
    acompanhamentoDesde: Date;
  }) {
    return {
      alunoId: agenda.alunoId,
      dias: agenda.dias,
      horarios: Object.fromEntries(
        agenda.dias.flatMap((dia) => {
          const h = horarioDoDia(agenda.horarios, dia);
          return h ? [[String(dia), h]] : [];
        }),
      ),
      acompanhamentoDesde: agenda.acompanhamentoDesde
        .toISOString()
        .slice(0, 10),
    };
  }

  async save(personalId: number, alunoId: number, dto: SaveAgendaDto) {
    await this.ownership.assertAlunoPertenceAoPersonal(alunoId, personalId);
    const horarios = normalizarHorarios(dto.horarios, dto.dias);

    const [personal, atual] = await Promise.all([
      this.prisma.personal.findUnique({
        where: { id: personalId },
        select: { fusoHorario: true },
      }),
      this.prisma.agendaTreino.findUnique({
        where: { alunoId },
        select: { dias: true, diasDesde: true },
      }),
    ]);
    // A data de início usa o fuso do personal, não o `CURRENT_DATE` (UTC) do banco.
    const hoje = dataLocal(new Date(), personal?.fusoHorario ?? FUSO_PADRAO);
    const diasDesde = calcularDiasDesde(
      atual?.dias ?? [],
      atual?.diasDesde,
      dto.dias,
      hoje,
    );

    await this.prisma.agendaTreino.upsert({
      where: { alunoId },
      create: {
        personalId,
        alunoId,
        dias: dto.dias,
        horarios,
        diasDesde,
        acompanhamentoDesde: paraDbDate(hoje),
      },
      update: {
        personalId,
        dias: dto.dias,
        horarios,
        diasDesde,
      },
    });

    return this.findAllByPersonal(personalId);
  }

  async remove(personalId: number, alunoId: number) {
    await this.ownership.assertAlunoPertenceAoPersonal(alunoId, personalId);

    await this.prisma.agendaTreino.deleteMany({
      where: { alunoId, personalId },
    });

    return this.findAllByPersonal(personalId);
  }
}
