import { converterHorarios } from './horarios-legado';

describe('converterHorarios', () => {
  it('converte strings e marca como alterado', () => {
    expect(converterHorarios({ '1': '07:00' })).toEqual({
      convertido: { '1': { hora: '07:00', modalidade: 'PRESENCIAL' } },
      alterado: true,
    });
  });

  it('é idempotente: formato novo não é marcado como alterado', () => {
    const novo = { '1': { hora: '07:00', modalidade: 'ONLINE' } };
    const r = converterHorarios(novo);
    expect(r.alterado).toBe(false);
    expect(r.convertido).toEqual(novo);
    expect(converterHorarios(r.convertido).alterado).toBe(false);
  });

  it('trata null como vazio', () => {
    expect(converterHorarios(null)).toEqual({
      convertido: {},
      alterado: false,
    });
  });
});
