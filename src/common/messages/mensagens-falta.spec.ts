import {
  escolherMensagem,
  interpolar,
  MENSAGENS_FALTA,
} from './mensagens-falta';

describe('mensagens-falta', () => {
  it('não repete as chaves recentes', () => {
    const recentes = ['saudade', 'imprevisto', 'registro'];
    for (let i = 0; i < 20; i++) {
      const m = escolherMensagem('avulsa', recentes);
      expect(recentes).not.toContain(m.chave);
    }
  });

  it('cai no pool completo quando todas foram usadas', () => {
    const todas = MENSAGENS_FALTA.consecutiva.map((m) => m.chave);
    const m = escolherMensagem('consecutiva', todas, () => 0);
    expect(m.chave).toBe(MENSAGENS_FALTA.consecutiva[0].chave);
  });

  it('rand determinístico escolhe o índice esperado', () => {
    expect(escolherMensagem('avulsa', [], () => 0).chave).toBe('saudade');
    expect(escolherMensagem('avulsa', [], () => 0.999).chave).toBe('reposicao');
  });

  it('interpolar substitui variáveis e ignora as ausentes', () => {
    expect(interpolar('{nome}, {n} faltas {x}', { nome: 'Ana', n: 3 })).toBe(
      'Ana, 3 faltas ',
    );
  });

  it('corpos têm no máximo ~120 caracteres', () => {
    for (const m of [
      ...MENSAGENS_FALTA.avulsa,
      ...MENSAGENS_FALTA.consecutiva,
    ]) {
      expect(m.corpo.length).toBeLessThanOrEqual(120);
    }
  });
});
