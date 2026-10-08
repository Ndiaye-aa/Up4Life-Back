import {
  dentroDoPrazoAluno,
  ehDiaDaAgenda,
  horarioDoDia,
  parseCargaKg,
  parseRepsMin,
  podePreJustificar,
} from './regras';

describe('regras de sessão', () => {
  describe('dentroDoPrazoAluno', () => {
    const hoje = '2026-10-10';

    it('aceita hoje e D−7', () => {
      expect(dentroDoPrazoAluno('2026-10-10', hoje)).toBe(true);
      expect(dentroDoPrazoAluno('2026-10-03', hoje)).toBe(true);
    });

    it('recusa D−8 e datas futuras', () => {
      expect(dentroDoPrazoAluno('2026-10-02', hoje)).toBe(false);
      expect(dentroDoPrazoAluno('2026-10-11', hoje)).toBe(false);
    });
  });

  it('ehDiaDaAgenda compara o dia da semana', () => {
    expect(ehDiaDaAgenda('2026-10-05', [1, 3])).toBe(true); // segunda
    expect(ehDiaDaAgenda('2026-10-06', [1, 3])).toBe(false);
  });

  describe('parseCargaKg', () => {
    it.each([
      ['40', 40],
      ['40kg', 40],
      ['40,5 kg', 40.5],
      ['12.5KG', 12.5],
      ['Corporal', null],
      ['8-12', null],
      ['', null],
      [null, null],
    ])('%p → %p', (entrada, esperado) => {
      expect(parseCargaKg(entrada)).toBe(esperado);
    });
  });

  it('parseRepsMin usa o menor valor da faixa', () => {
    expect(parseRepsMin('12')).toBe(12);
    expect(parseRepsMin('8-12')).toBe(8);
    expect(parseRepsMin('até a falha')).toBeNull();
  });

  describe('podePreJustificar', () => {
    const hoje = '2026-10-10';

    it('hoje só antes do horário do treino', () => {
      expect(podePreJustificar(hoje, hoje, '06:00', '07:00')).toBe(true);
      expect(podePreJustificar(hoje, hoje, '07:00', '07:00')).toBe(false);
      expect(podePreJustificar(hoje, hoje, '08:00', '07:00')).toBe(false);
      expect(podePreJustificar(hoje, hoje, '06:00', undefined)).toBe(false);
    });

    it('aceita até D+30 e recusa D+31 e passado', () => {
      expect(podePreJustificar('2026-11-09', hoje, '06:00')).toBe(true);
      expect(podePreJustificar('2026-11-10', hoje, '06:00')).toBe(false);
      expect(podePreJustificar('2026-10-09', hoje, '06:00')).toBe(false);
    });
  });

  describe('horarioDoDia', () => {
    it('lê o formato novo', () => {
      expect(
        horarioDoDia({ '1': { hora: '07:00', modalidade: 'ONLINE' } }, 1),
      ).toEqual({ hora: '07:00', modalidade: 'ONLINE' });
    });

    it('lê o formato legado como presencial', () => {
      expect(horarioDoDia({ '1': '07:00' }, 1)).toEqual({
        hora: '07:00',
        modalidade: 'PRESENCIAL',
      });
    });

    it('retorna undefined quando não há horário', () => {
      expect(horarioDoDia({}, 1)).toBeUndefined();
      expect(horarioDoDia(null, 1)).toBeUndefined();
    });
  });
});
