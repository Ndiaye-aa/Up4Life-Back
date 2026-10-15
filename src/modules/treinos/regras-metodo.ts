import { TipoSerie } from '@prisma/client';

export interface ItemMetodo {
  ordem: number;
  tipoSerie?: TipoSerie;
  grupoCombinado?: number;
  etapas?: unknown[];
  pausaSegundos?: number;
}

/** Tamanho exato (número) ou mínimo (objeto) do bloco de cada método combinado. */
const TAMANHO_BLOCO: Partial<
  Record<TipoSerie, { exato?: number; minimo?: number; nome: string }>
> = {
  BI_SET: { exato: 2, nome: 'Bi-set' },
  SUPER_SET: { exato: 2, nome: 'Super-set' },
  TRI_SET: { exato: 3, nome: 'Tri-set' },
  CIRCUITO: { minimo: 2, nome: 'Circuito' },
};

const MIN_ETAPAS: Partial<Record<TipoSerie, number>> = {
  DROP_SET: 1,
  PIRAMIDE_CRESCENTE: 2,
  PIRAMIDE_DECRESCENTE: 2,
};

export const PAUSA_REST_PAUSE_PADRAO = 15;

/**
 * Valida a coerência método × campos (bloco, etapas, pausa). Retorna a mensagem
 * do primeiro problema, ou null se os itens estão consistentes.
 */
export function validarMetodos(itens: ItemMetodo[]): string | null {
  const grupos = new Map<number, ItemMetodo[]>();

  for (const item of itens) {
    const tipo = item.tipoSerie ?? 'NORMAL';
    const bloco = TAMANHO_BLOCO[tipo];
    const minEtapas = MIN_ETAPAS[tipo] ?? 0;
    const qtdEtapas = item.etapas?.length ?? 0;

    if (bloco && item.grupoCombinado == null) {
      return `O exercício ${item.ordem} usa ${bloco.nome} e precisa ser combinado com outro(s).`;
    }
    if (!bloco && item.grupoCombinado != null) {
      return `O exercício ${item.ordem} não pode ter bloco combinado com o método escolhido.`;
    }
    if (qtdEtapas < minEtapas) {
      return `O exercício ${item.ordem} precisa de pelo menos ${minEtapas} etapa(s) de carga.`;
    }
    if (minEtapas === 0 && qtdEtapas > 0) {
      return `O exercício ${item.ordem} não usa etapas de carga no método escolhido.`;
    }
    if (tipo !== 'REST_PAUSE' && item.pausaSegundos != null) {
      return `O exercício ${item.ordem} só pode ter pausa no rest-pause.`;
    }

    if (item.grupoCombinado != null) {
      const lista = grupos.get(item.grupoCombinado) ?? [];
      lista.push(item);
      grupos.set(item.grupoCombinado, lista);
    }
  }

  for (const membros of grupos.values()) {
    const tipo = membros[0].tipoSerie ?? 'NORMAL';
    const bloco = TAMANHO_BLOCO[tipo];
    if (!bloco) continue;

    if (membros.some((m) => (m.tipoSerie ?? 'NORMAL') !== tipo)) {
      return `Um bloco combinado não pode misturar métodos diferentes (${bloco.nome}).`;
    }
    const total = membros.length;
    if (bloco.exato != null && total !== bloco.exato) {
      return `${bloco.nome} precisa de exatamente ${bloco.exato} exercícios no bloco.`;
    }
    if (bloco.minimo != null && total < bloco.minimo) {
      return `${bloco.nome} precisa de pelo menos ${bloco.minimo} exercícios no bloco.`;
    }
  }

  return null;
}
