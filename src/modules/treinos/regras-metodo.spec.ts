import { validarMetodos } from './regras-metodo';

describe('validarMetodos', () => {
  it('aceita itens tradicionais sem campos extras', () => {
    expect(
      validarMetodos([{ ordem: 1 }, { ordem: 2, tipoSerie: 'NORMAL' }]),
    ).toBeNull();
  });

  it('aceita bi-set com exatamente 2 itens no bloco', () => {
    expect(
      validarMetodos([
        { ordem: 1, tipoSerie: 'BI_SET', grupoCombinado: 1 },
        { ordem: 2, tipoSerie: 'BI_SET', grupoCombinado: 1 },
      ]),
    ).toBeNull();
  });

  it('rejeita bi-set com 1 ou 3 itens no bloco', () => {
    const bi = (ordem: number) => ({
      ordem,
      tipoSerie: 'BI_SET' as const,
      grupoCombinado: 1,
    });
    expect(validarMetodos([bi(1)])).toMatch(/exatamente 2/);
    expect(validarMetodos([bi(1), bi(2), bi(3)])).toMatch(/exatamente 2/);
  });

  it('exige 3 itens no tri-set e 2 ou mais no circuito', () => {
    const item = (ordem: number, tipoSerie: 'TRI_SET' | 'CIRCUITO') => ({
      ordem,
      tipoSerie,
      grupoCombinado: 1,
    });
    expect(validarMetodos([item(1, 'TRI_SET'), item(2, 'TRI_SET')])).toMatch(
      /exatamente 3/,
    );
    expect(
      validarMetodos([
        item(1, 'TRI_SET'),
        item(2, 'TRI_SET'),
        item(3, 'TRI_SET'),
      ]),
    ).toBeNull();
    expect(validarMetodos([item(1, 'CIRCUITO')])).toMatch(/pelo menos 2/);
    expect(
      validarMetodos([
        item(1, 'CIRCUITO'),
        item(2, 'CIRCUITO'),
        item(3, 'CIRCUITO'),
      ]),
    ).toBeNull();
  });

  it('rejeita método combinado sem grupo e grupo em método não combinado', () => {
    expect(validarMetodos([{ ordem: 1, tipoSerie: 'SUPER_SET' }])).toMatch(
      /combinado/,
    );
    expect(validarMetodos([{ ordem: 1, grupoCombinado: 1 }])).toMatch(
      /não pode ter bloco/,
    );
  });

  it('rejeita bloco misturando métodos', () => {
    expect(
      validarMetodos([
        { ordem: 1, tipoSerie: 'BI_SET', grupoCombinado: 1 },
        { ordem: 2, tipoSerie: 'SUPER_SET', grupoCombinado: 1 },
      ]),
    ).toMatch(/misturar/);
  });

  it('exige etapas no drop-set e pelo menos 2 na pirâmide', () => {
    const etapa = { carga: '30kg', repeticoes: '10' };
    expect(validarMetodos([{ ordem: 1, tipoSerie: 'DROP_SET' }])).toMatch(
      /etapa/,
    );
    expect(
      validarMetodos([{ ordem: 1, tipoSerie: 'DROP_SET', etapas: [etapa] }]),
    ).toBeNull();
    expect(
      validarMetodos([
        { ordem: 1, tipoSerie: 'PIRAMIDE_CRESCENTE', etapas: [etapa] },
      ]),
    ).toMatch(/2 etapa/);
    expect(
      validarMetodos([
        { ordem: 1, tipoSerie: 'PIRAMIDE_DECRESCENTE', etapas: [etapa, etapa] },
      ]),
    ).toBeNull();
  });

  it('rejeita etapas fora de drop/pirâmide e pausa fora do rest-pause', () => {
    expect(validarMetodos([{ ordem: 1, etapas: [{}] }])).toMatch(
      /não usa etapas/,
    );
    expect(validarMetodos([{ ordem: 1, pausaSegundos: 15 }])).toMatch(
      /rest-pause/,
    );
    expect(
      validarMetodos([
        { ordem: 1, tipoSerie: 'REST_PAUSE', pausaSegundos: 15 },
      ]),
    ).toBeNull();
  });
});
