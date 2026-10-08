import {
  dataLocal,
  ehDataValida,
  diaDaSemana,
  horaLocal,
  nomeDoDia,
  paraDbDate,
  semanaIso,
  somarDias,
} from './fuso';

describe('fuso', () => {
  describe('dataLocal', () => {
    // 02:30 UTC de 07/10: já é dia 7 em UTC, mas ainda dia 6 em SP e em Cuiabá.
    const instante = new Date('2026-10-07T02:30:00Z');

    it('respeita a virada de dia em São Paulo (UTC-3)', () => {
      expect(dataLocal(instante, 'America/Sao_Paulo')).toBe('2026-10-06');
    });

    it('respeita a virada de dia em Cuiabá (UTC-4)', () => {
      expect(dataLocal(instante, 'America/Cuiaba')).toBe('2026-10-06');
      // 03:30 UTC: SP já virou (00:30), Cuiabá ainda não (23:30).
      const depois = new Date('2026-10-07T03:30:00Z');
      expect(dataLocal(depois, 'America/Sao_Paulo')).toBe('2026-10-07');
      expect(dataLocal(depois, 'America/Cuiaba')).toBe('2026-10-06');
    });
  });

  it('horaLocal formata HH:mm no fuso', () => {
    expect(
      horaLocal(new Date('2026-10-07T11:05:00Z'), 'America/Sao_Paulo'),
    ).toBe('08:05');
  });

  it('somarDias cruza mês e ano', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('diaDaSemana usa 0 = domingo', () => {
    expect(diaDaSemana('2026-10-04')).toBe(0); // domingo
    expect(diaDaSemana('2026-10-05')).toBe(1); // segunda
    expect(diaDaSemana('2026-10-10')).toBe(6); // sábado
    expect(nomeDoDia('2026-10-05')).toBe('segunda');
  });

  it('paraDbDate gera meia-noite UTC', () => {
    expect(paraDbDate('2026-10-07').toISOString()).toBe(
      '2026-10-07T00:00:00.000Z',
    );
  });

  it('semanaIso segue a numeração ISO', () => {
    expect(semanaIso('2026-10-05')).toBe('2026-W41');
    expect(semanaIso('2026-10-11')).toBe('2026-W41');
    expect(semanaIso('2026-12-31')).toBe('2026-W53');
    expect(semanaIso('2027-01-01')).toBe('2026-W53');
  });
});

describe('ehDataValida / paraDbDate', () => {
  it.each([
    ['2026-02-28', true],
    ['2024-02-29', true], // bissexto
    ['2026-02-29', false],
    ['2026-02-31', false],
    ['2026-13-01', false],
    ['2026-00-10', false],
    ['2026-04-31', false],
    ['2026-1-1', false],
    ['', false],
  ])('%s → %s', (entrada, esperado) => {
    expect(ehDataValida(entrada)).toBe(esperado);
  });

  it('não-string é inválida', () => {
    expect(ehDataValida(20260101)).toBe(false);
    expect(ehDataValida(null)).toBe(false);
  });

  it('paraDbDate lança para data que rolaria para outro dia', () => {
    expect(() => paraDbDate('2026-02-31')).toThrow(RangeError);
    expect(paraDbDate('2026-02-28').toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });
});
