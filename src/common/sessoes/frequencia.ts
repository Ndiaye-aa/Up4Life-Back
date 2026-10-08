export type StatusSessaoStr =
  | 'REALIZADA'
  | 'PARCIAL'
  | 'FALTA'
  | 'FALTA_JUSTIFICADA';

export interface SessaoFrequencia {
  data: string;
  prevista: boolean;
  status: StatusSessaoStr;
  /** Sessão que repôs esta falta, se houver. */
  repostaPor?: { id: number } | null;
  /** Falta que esta sessão repôs, se houver. */
  reposicaoDeId?: number | null;
}

export function calcularFrequencia(sessoes: SessaoFrequencia[]) {
  const previstas = sessoes.filter(
    (s) => s.prevista && s.status !== 'FALTA_JUSTIFICADA',
  );
  const cumpridas = previstas.filter(
    (s) =>
      s.status === 'REALIZADA' ||
      s.status === 'PARCIAL' ||
      (s.status === 'FALTA' && s.repostaPor),
  ).length;

  return {
    previstas: previstas.length,
    cumpridas,
    faltas: previstas.filter((s) => s.status === 'FALTA' && !s.repostaPor)
      .length,
    justificadas: sessoes.filter((s) => s.status === 'FALTA_JUSTIFICADA')
      .length,
    extras: sessoes.filter((s) => !s.prevista && !s.reposicaoDeId).length,
    percentual: previstas.length ? cumpridas / previstas.length : null,
  };
}

/** RN10 — recebe sessões previstas ordenadas por data DESC. */
export function contarFaltasConsecutivas(
  previstasDesc: SessaoFrequencia[],
): number {
  let n = 0;
  for (const s of previstasDesc) {
    if (s.status === 'FALTA' && !s.repostaPor) n++;
    else break;
  }
  return n;
}
