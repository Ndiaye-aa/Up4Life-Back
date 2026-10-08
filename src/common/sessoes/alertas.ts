import { somarDias } from '../datas/fuso';

export type CodigoAlerta =
  | 'FALTAS_SEGUIDAS'
  | 'DOR_REPORTADA'
  | 'ESFORCO_ALTO'
  | 'AVALIACAO_ATRASADA'
  | 'TREINO_VENCIDO';

export interface EntradaAlertas {
  hoje: string;
  faltasConsecutivas: number;
  /** Há sessão com dor = true nos últimos 7 dias. */
  dorUltimos7d: boolean;
  /** Quantidade de sessões com rpe >= 9 nos últimos 14 dias. */
  sessoesEsforcoAlto14d: number;
  /** Data (YYYY-MM-DD) da última avaliação, se houver. */
  ultimaAvaliacao: string | null;
  /** Existe treino com validade vencida e nenhum treino vigente. */
  treinoVencido: boolean;
}

export const DIAS_AVALIACAO_ATRASADA = 60;

export function calcularAlertas(e: EntradaAlertas): CodigoAlerta[] {
  const alertas: CodigoAlerta[] = [];
  if (e.faltasConsecutivas >= 2) alertas.push('FALTAS_SEGUIDAS');
  if (e.dorUltimos7d) alertas.push('DOR_REPORTADA');
  if (e.sessoesEsforcoAlto14d >= 2) alertas.push('ESFORCO_ALTO');
  if (
    e.ultimaAvaliacao &&
    e.ultimaAvaliacao < somarDias(e.hoje, -DIAS_AVALIACAO_ATRASADA)
  ) {
    alertas.push('AVALIACAO_ATRASADA');
  }
  if (e.treinoVencido) alertas.push('TREINO_VENCIDO');
  return alertas;
}
