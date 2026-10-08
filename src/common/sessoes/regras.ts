import { diaDaSemana, somarDias } from '../datas/fuso';

export const PRAZO_EDICAO_ALUNO_DIAS = 7;
export const JANELA_REPOSICAO_DIAS = 7;
export const MAX_PRE_JUSTIFICATIVA_DIAS = 30;

/** Aluno edita sessões de hoje−7 até hoje (RN: prazo de edição). */
export const dentroDoPrazoAluno = (dataSessao: string, hoje: string): boolean =>
  dataSessao >= somarDias(hoje, -PRAZO_EDICAO_ALUNO_DIAS) && dataSessao <= hoje;

export const ehDiaDaAgenda = (ymd: string, dias: number[]): boolean =>
  dias.includes(diaDaSemana(ymd));

/** RN05: "40", "40kg", "40,5 kg" → número; qualquer outro texto → null. */
export function parseCargaKg(texto?: string | null): number | null {
  if (!texto) return null;
  const m = texto
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:[.,]\d+)?)\s*(kg)?$/);
  return m ? Number(m[1].replace(',', '.')) : null;
}

/** Repetições numéricas; numa faixa como "8-12" usa o menor valor. */
export function parseRepsMin(texto?: string | null): number | null {
  if (!texto) return null;
  const m = texto.trim().match(/^(\d+)(?:\s*[-–a]\s*\d+)?$/);
  return m ? Number(m[1]) : null;
}

/** Pré-justificativa: data futura da agenda, até 30 dias, e antes do horário se for hoje. */
export function podePreJustificar(
  alvo: string,
  hoje: string,
  horaAgora: string,
  horaTreino?: string,
): boolean {
  if (alvo < hoje || alvo > somarDias(hoje, MAX_PRE_JUSTIFICATIVA_DIAS)) {
    return false;
  }
  if (alvo === hoje) return !!horaTreino && horaAgora < horaTreino;
  return true;
}

export const CAMPOS_FEEDBACK = [
  'rpe',
  'disposicao',
  'dor',
  'dorLocal',
  'comentarioAluno',
] as const;
export const CAMPOS_SO_PERSONAL = ['respostaPersonal', 'validar'] as const;

export type HorarioDia = { hora: string; modalidade: 'PRESENCIAL' | 'ONLINE' };

/**
 * Lê o horário de um dia da agenda aceitando o formato novo
 * ({hora, modalidade}) e o legado ("07:00").
 */
export function horarioDoDia(
  horarios: unknown,
  dia: number,
): HorarioDia | undefined {
  if (!horarios || typeof horarios !== 'object') return undefined;
  const bruto = (horarios as Record<string, unknown>)[String(dia)];
  if (typeof bruto === 'string') {
    return { hora: bruto, modalidade: 'PRESENCIAL' };
  }
  if (bruto && typeof bruto === 'object' && 'hora' in bruto) {
    const h = bruto as { hora: string; modalidade?: string };
    return {
      hora: h.hora,
      modalidade: h.modalidade === 'ONLINE' ? 'ONLINE' : 'PRESENCIAL',
    };
  }
  return undefined;
}
