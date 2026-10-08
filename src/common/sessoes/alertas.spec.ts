import { calcularAlertas, EntradaAlertas } from './alertas';

const base: EntradaAlertas = {
  hoje: '2026-10-07',
  faltasConsecutivas: 0,
  dorUltimos7d: false,
  sessoesEsforcoAlto14d: 0,
  ultimaAvaliacao: '2026-09-20',
  treinoVencido: false,
};

describe('calcularAlertas', () => {
  it('sem condições não gera alertas', () => {
    expect(calcularAlertas(base)).toEqual([]);
  });

  it('gera cada alerta na fronteira da condição', () => {
    expect(calcularAlertas({ ...base, faltasConsecutivas: 1 })).toEqual([]);
    expect(calcularAlertas({ ...base, faltasConsecutivas: 2 })).toEqual([
      'FALTAS_SEGUIDAS',
    ]);
    expect(calcularAlertas({ ...base, sessoesEsforcoAlto14d: 1 })).toEqual([]);
    expect(calcularAlertas({ ...base, sessoesEsforcoAlto14d: 2 })).toEqual([
      'ESFORCO_ALTO',
    ]);
    expect(calcularAlertas({ ...base, dorUltimos7d: true })).toEqual([
      'DOR_REPORTADA',
    ]);
    expect(calcularAlertas({ ...base, treinoVencido: true })).toEqual([
      'TREINO_VENCIDO',
    ]);
  });

  it('avaliação atrasada só após 60 dias e apenas se existir avaliação', () => {
    expect(calcularAlertas({ ...base, ultimaAvaliacao: '2026-08-08' })).toEqual(
      [],
    );
    expect(calcularAlertas({ ...base, ultimaAvaliacao: '2026-08-07' })).toEqual(
      ['AVALIACAO_ATRASADA'],
    );
    expect(calcularAlertas({ ...base, ultimaAvaliacao: null })).toEqual([]);
  });
});
