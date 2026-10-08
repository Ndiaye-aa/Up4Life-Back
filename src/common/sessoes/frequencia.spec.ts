import {
  calcularFrequencia,
  contarFaltasConsecutivas,
  SessaoFrequencia,
} from './frequencia';

const s = (
  data: string,
  status: SessaoFrequencia['status'],
  extra: Partial<SessaoFrequencia> = {},
): SessaoFrequencia => ({ data, prevista: true, status, ...extra });

describe('frequencia', () => {
  it('sem previstas retorna percentual null (sem divisão por zero)', () => {
    expect(calcularFrequencia([]).percentual).toBeNull();
  });

  it('conta realizadas, parciais, faltas repostas, justificadas e extras', () => {
    const r = calcularFrequencia([
      s('2026-10-01', 'REALIZADA'),
      s('2026-10-02', 'PARCIAL'),
      s('2026-10-03', 'FALTA', { repostaPor: { id: 9 } }),
      s('2026-10-04', 'FALTA'),
      s('2026-10-05', 'FALTA_JUSTIFICADA'),
      { data: '2026-10-06', prevista: false, status: 'REALIZADA' },
      {
        data: '2026-10-07',
        prevista: false,
        status: 'REALIZADA',
        reposicaoDeId: 3,
      },
    ]);

    expect(r).toEqual({
      previstas: 4,
      cumpridas: 3,
      faltas: 1,
      justificadas: 1,
      extras: 1,
      percentual: 0.75,
    });
  });

  describe('contarFaltasConsecutivas', () => {
    it('conta faltas seguidas e para na primeira presença', () => {
      expect(
        contarFaltasConsecutivas([
          s('2026-10-05', 'FALTA'),
          s('2026-10-03', 'FALTA'),
          s('2026-10-01', 'REALIZADA'),
          s('2026-09-29', 'FALTA'),
        ]),
      ).toBe(2);
    });

    it('falta reposta e falta justificada interrompem a sequência', () => {
      expect(
        contarFaltasConsecutivas([
          s('2026-10-05', 'FALTA'),
          s('2026-10-03', 'FALTA', { repostaPor: { id: 1 } }),
          s('2026-10-01', 'FALTA'),
        ]),
      ).toBe(1);
      expect(
        contarFaltasConsecutivas([
          s('2026-10-05', 'FALTA_JUSTIFICADA'),
          s('2026-10-03', 'FALTA'),
        ]),
      ).toBe(0);
    });
  });
});
