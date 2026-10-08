import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  dataLocal,
  deDbDate,
  FUSO_PADRAO,
  paraDbDate,
  semanaIso,
  somarDias,
} from '../../common/datas/fuso';
import { OwnershipService } from '../../common/ownership/ownership.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { calcularAlertas } from '../../common/sessoes/alertas';
import {
  calcularFrequencia,
  contarFaltasConsecutivas,
  SessaoFrequencia,
} from '../../common/sessoes/frequencia';
import { parseRepsMin } from '../../common/sessoes/regras';

const PERIODOS: Record<string, number> = { '30d': 30, '90d': 90, '180d': 180 };

const arredondar = (n: number, casas = 2) =>
  Math.round(n * 10 ** casas) / 10 ** casas;

interface LinhaResumo {
  id_aluno: number;
  previstas30: bigint;
  cumpridas30: bigint;
  ultima_sessao: Date | null;
  faltas_consecutivas: bigint;
  dor_7d: boolean;
  esforco_alto_14d: bigint;
  ultima_avaliacao: Date | null;
  treino_vencido: boolean;
}

@Injectable()
export class ProgressoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: OwnershipService,
  ) {}

  private resolverPeriodo(periodo?: string): number {
    if (periodo === undefined) return PERIODOS['30d'];
    const dias = PERIODOS[periodo];
    if (!dias) {
      throw new BadRequestException('periodo deve ser 30d, 90d ou 180d.');
    }
    return dias;
  }

  async progressoDoAluno(
    alunoId: number,
    personalId: number,
    periodo?: string,
  ) {
    await this.ownership.assertAlunoPertenceAoPersonal(alunoId, personalId);
    return this.progresso(alunoId, periodo);
  }

  async progresso(alunoId: number, periodo?: string, agora = new Date()) {
    const dias = this.resolverPeriodo(periodo);

    const aluno = await this.prisma.aluno.findUnique({
      where: { id: alunoId },
      select: {
        personal: { select: { fusoHorario: true } },
        agendaTreino: { select: { acompanhamentoDesde: true } },
      },
    });
    if (!aluno) throw new NotFoundException('Aluno não encontrado.');

    const hoje = dataLocal(agora, aluno.personal?.fusoHorario ?? FUSO_PADRAO);
    const de = somarDias(hoje, -dias);

    const [sessoes, avaliacoes, treinos] = await Promise.all([
      this.prisma.sessaoTreino.findMany({
        where: {
          alunoId,
          data: { gte: paraDbDate(de), lte: paraDbDate(hoje) },
        },
        include: {
          itens: true,
          repostaPor: { select: { id: true } },
        },
        orderBy: { data: 'asc' },
      }),
      this.prisma.avaliacao.findMany({
        where: { alunoId },
        orderBy: { dataAvaliacao: 'asc' },
        select: {
          dataAvaliacao: true,
          peso: true,
          percentualGordura: true,
          imc: true,
        },
      }),
      this.prisma.treino.findMany({
        where: { alunoId },
        select: { dataValidade: true },
      }),
    ]);

    const freqInput: SessaoFrequencia[] = sessoes.map((s) => ({
      data: deDbDate(s.data),
      prevista: s.prevista,
      status: s.status,
      repostaPor: s.repostaPor,
      reposicaoDeId: s.reposicaoDeId,
    }));
    const previstasDesc = freqInput
      .filter((s) => s.prevista)
      .sort((a, b) => b.data.localeCompare(a.data));

    const faltasConsecutivas = contarFaltasConsecutivas(previstasDesc);

    // Sequência atual: previstas cumpridas seguidas; justificadas são neutras.
    let sequenciaAtual = 0;
    for (const s of previstasDesc) {
      if (s.status === 'FALTA_JUSTIFICADA') continue;
      const cumprida =
        s.status === 'REALIZADA' ||
        s.status === 'PARCIAL' ||
        (s.status === 'FALTA' && s.repostaPor);
      if (!cumprida) break;
      sequenciaAtual++;
    }

    const rpes = sessoes
      .filter((s) => s.rpe !== null)
      .map((s) => s.rpe as number);
    const corte7 = somarDias(hoje, -7);
    const corte14 = somarDias(hoje, -14);
    const dorUltimos7d = sessoes.some(
      (s) => s.dor && deDbDate(s.data) >= corte7,
    );
    const sessoesEsforcoAlto14d = sessoes.filter(
      (s) => (s.rpe ?? 0) >= 9 && deDbDate(s.data) >= corte14,
    ).length;

    // Semanal: previsto × cumprido
    const semanas = new Map<string, { previstas: number; cumpridas: number }>();
    for (const s of freqInput) {
      if (!s.prevista || s.status === 'FALTA_JUSTIFICADA') continue;
      const chave = semanaIso(s.data);
      const acc = semanas.get(chave) ?? { previstas: 0, cumpridas: 0 };
      acc.previstas++;
      if (
        s.status === 'REALIZADA' ||
        s.status === 'PARCIAL' ||
        (s.status === 'FALTA' && s.repostaPor)
      ) {
        acc.cumpridas++;
      }
      semanas.set(chave, acc);
    }

    // Volume por grupo/semana e carga por exercício
    const volume = new Map<string, number>();
    const cargas = new Map<string, Map<string, number>>();
    for (const s of sessoes) {
      const data = deDbDate(s.data);
      for (const item of s.itens) {
        if (item.cargaKg === null) continue;
        const kg = Number(item.cargaKg);

        const pontos = cargas.get(item.exercicio) ?? new Map<string, number>();
        pontos.set(data, Math.max(pontos.get(data) ?? 0, kg));
        cargas.set(item.exercicio, pontos);

        const reps = parseRepsMin(item.repsFeitas);
        if (reps === null || !item.seriesFeitas) continue;
        const chave = `${semanaIso(data)}|${item.grupoMuscular ?? 'Outros'}`;
        volume.set(
          chave,
          (volume.get(chave) ?? 0) + item.seriesFeitas * reps * kg,
        );
      }
    }

    const serie = avaliacoes.map((a) => {
      const peso = Number(a.peso);
      const gordura =
        a.percentualGordura === null ? null : Number(a.percentualGordura);
      return {
        data: dataLocal(a.dataAvaliacao, FUSO_PADRAO),
        peso,
        percentualGordura: gordura,
        imc: a.imc === null ? null : Number(a.imc),
        massaMagra:
          gordura === null ? null : arredondar(peso * (1 - gordura / 100)),
      };
    });
    const primeira = serie[0];
    const ultima = serie[serie.length - 1];
    const delta = (campo: 'peso' | 'percentualGordura') =>
      primeira &&
      ultima &&
      serie.length > 1 &&
      primeira[campo] !== null &&
      ultima[campo] !== null
        ? arredondar(ultima[campo] - primeira[campo])
        : null;

    const vigente = treinos.some(
      (t) => t.dataValidade === null || deDbDate(t.dataValidade) >= hoje,
    );

    return {
      periodo: { de, ate: hoje },
      acompanhamentoDesde: aluno.agendaTreino
        ? deDbDate(aluno.agendaTreino.acompanhamentoDesde)
        : null,
      frequencia: calcularFrequencia(freqInput),
      faltasConsecutivas,
      sequenciaAtual,
      feedback: {
        rpeMedio: rpes.length
          ? arredondar(rpes.reduce((a, b) => a + b, 0) / rpes.length, 1)
          : null,
        dorUltimos7d,
      },
      calendario: sessoes.map((s) => ({
        data: deDbDate(s.data),
        status: s.status,
        reposta: s.repostaPor !== null,
        modalidade: s.modalidade,
      })),
      semanal: [...semanas.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([semana, v]) => ({ semana, ...v })),
      volumePorGrupo: [...volume.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chave, volumeKg]) => {
          const [semana, grupo] = chave.split('|');
          return { semana, grupo, volumeKg: arredondar(volumeKg, 0) };
        }),
      cargaPorExercicio: [...cargas.entries()].map(([exercicio, pontos]) => ({
        exercicio,
        pontos: [...pontos.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([data, cargaKg]) => ({ data, cargaKg })),
      })),
      avaliacoes: {
        serie,
        deltaDesdePrimeira: {
          peso: delta('peso'),
          percentualGordura: delta('percentualGordura'),
        },
      },
      alertas: calcularAlertas({
        hoje,
        faltasConsecutivas,
        dorUltimos7d,
        sessoesEsforcoAlto14d,
        ultimaAvaliacao: ultima?.data ?? null,
        treinoVencido: treinos.length > 0 && !vigente,
      }),
    };
  }

  /** Uma única query agregada por personal (sem N+1). */
  async resumo(personalId: number, agora = new Date()) {
    const personal = await this.prisma.personal.findUnique({
      where: { id: personalId },
      select: { fusoHorario: true },
    });
    const hoje = dataLocal(agora, personal?.fusoHorario ?? FUSO_PADRAO);
    // Datas como string YYYY-MM-DD + ::date: comparar `date` com um timestamp
    // dependeria do fuso da sessão do banco e erraria o limite por um dia.
    const d30 = somarDias(hoje, -30);
    const d14 = somarDias(hoje, -14);
    const d7 = somarDias(hoje, -7);
    const d120 = somarDias(hoje, -120);

    const linhas = await this.prisma.$queryRaw<LinhaResumo[]>`
      WITH base AS (
        SELECT s.id_aluno, s.data, s.status, s.prevista, s.dor, s.rpe,
               (r.id IS NOT NULL) AS reposta
        FROM sessao_treino s
        JOIN aluno a ON a.id = s.id_aluno AND a.id_personal = ${personalId}
        LEFT JOIN sessao_treino r ON r.id_reposicao_de = s.id
      ),
      prev AS (
        SELECT *, row_number() OVER (PARTITION BY id_aluno ORDER BY data DESC) AS rn
        FROM base WHERE prevista AND data >= ${d120}::date
      ),
      quebra AS (
        SELECT id_aluno, MIN(rn) AS rn FROM prev
        WHERE NOT (status = 'FALTA' AND NOT reposta)
        GROUP BY id_aluno
      ),
      consec AS (
        SELECT p.id_aluno, COUNT(*) AS n FROM prev p
        LEFT JOIN quebra q ON q.id_aluno = p.id_aluno
        WHERE p.rn < COALESCE(q.rn, 2147483647)
        GROUP BY p.id_aluno
      ),
      agg AS (
        SELECT id_aluno,
          COUNT(*) FILTER (WHERE prevista AND data >= ${d30}::date AND status <> 'FALTA_JUSTIFICADA') AS previstas30,
          COUNT(*) FILTER (WHERE prevista AND data >= ${d30}::date AND (status IN ('REALIZADA','PARCIAL') OR (status = 'FALTA' AND reposta))) AS cumpridas30,
          MAX(data) FILTER (WHERE status IN ('REALIZADA','PARCIAL')) AS ultima_sessao,
          COALESCE(bool_or(dor AND data >= ${d7}::date), false) AS dor_7d,
          COUNT(*) FILTER (WHERE rpe >= 9 AND data >= ${d14}::date) AS esforco_alto_14d
        FROM base GROUP BY id_aluno
      )
      SELECT a.id AS id_aluno,
        COALESCE(g.previstas30, 0) AS previstas30,
        COALESCE(g.cumpridas30, 0) AS cumpridas30,
        g.ultima_sessao,
        COALESCE(c.n, 0) AS faltas_consecutivas,
        COALESCE(g.dor_7d, false) AS dor_7d,
        COALESCE(g.esforco_alto_14d, 0) AS esforco_alto_14d,
        (SELECT MAX(v.data_avaliacao) FROM avaliacao v WHERE v.id_aluno = a.id) AS ultima_avaliacao,
        (
          EXISTS (SELECT 1 FROM treino t WHERE t.id_aluno = a.id)
          AND NOT EXISTS (
            SELECT 1 FROM treino t
            WHERE t.id_aluno = a.id AND (t.data_validade IS NULL OR t.data_validade >= ${hoje}::date)
          )
        ) AS treino_vencido
      FROM aluno a
      LEFT JOIN agg g ON g.id_aluno = a.id
      LEFT JOIN consec c ON c.id_aluno = a.id
      WHERE a.id_personal = ${personalId}`;

    return linhas.map((l) => {
      const previstas = Number(l.previstas30);
      const faltasConsecutivas = Number(l.faltas_consecutivas);
      const ultimaAvaliacao = l.ultima_avaliacao
        ? dataLocal(l.ultima_avaliacao, FUSO_PADRAO)
        : null;
      return {
        alunoId: l.id_aluno,
        frequencia30d: previstas ? Number(l.cumpridas30) / previstas : null,
        ultimaSessao: l.ultima_sessao ? deDbDate(l.ultima_sessao) : null,
        faltasConsecutivas,
        alertas: calcularAlertas({
          hoje,
          faltasConsecutivas,
          dorUltimos7d: l.dor_7d,
          sessoesEsforcoAlto14d: Number(l.esforco_alto_14d),
          ultimaAvaliacao,
          treinoVencido: l.treino_vencido,
        }),
      };
    });
  }
}
