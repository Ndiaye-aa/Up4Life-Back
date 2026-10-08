import { BadRequestException } from '@nestjs/common';
import { calcularDiasDesde, normalizarHorarios } from './agenda.service';

describe('normalizarHorarios', () => {
  it('converte o formato legado em presencial', () => {
    expect(normalizarHorarios({ '1': '07:00' }, [1, 3])).toEqual({
      '1': { hora: '07:00', modalidade: 'PRESENCIAL' },
    });
  });

  it('mantém a modalidade informada', () => {
    expect(
      normalizarHorarios({ '3': { hora: '18:30', modalidade: 'ONLINE' } }, [3]),
    ).toEqual({ '3': { hora: '18:30', modalidade: 'ONLINE' } });
  });

  it('sem horários devolve objeto vazio', () => {
    expect(normalizarHorarios(undefined, [1])).toEqual({});
  });

  it.each([
    [{ '2': '07:00' }, 'dia fora da agenda'],
    [{ '1': '25:00' }, 'hora inválida'],
    [{ '1': { hora: '07:00', modalidade: 'HIBRIDO' } }, 'modalidade inválida'],
    [{ x: '07:00' }, 'chave inválida'],
  ])('rejeita %j (%s)', (horarios: unknown, _motivo: string) => {
    expect(() => normalizarHorarios(horarios as never, [1])).toThrow(
      BadRequestException,
    );
  });
});

describe('calcularDiasDesde', () => {
  const hoje = '2026-10-08';

  it('dia que permanece mantém a data; dia novo recebe hoje', () => {
    expect(
      calcularDiasDesde(
        [1, 3],
        { '1': '2026-09-01', '3': '2026-09-15' },
        [1, 3, 5],
        hoje,
      ),
    ).toEqual({ '1': '2026-09-01', '3': '2026-09-15', '5': hoje });
  });

  it('dia removido sai do mapa', () => {
    expect(
      calcularDiasDesde(
        [1, 3],
        { '1': '2026-09-01', '3': '2026-09-15' },
        [3],
        hoje,
      ),
    ).toEqual({ '3': '2026-09-15' });
  });

  it('agenda inexistente: todos os dias entram hoje', () => {
    expect(calcularDiasDesde([], undefined, [2, 4], hoje)).toEqual({
      '2': hoje,
      '4': hoje,
    });
  });

  it('dia legado sem registro continua sem data (vale acompanhamentoDesde)', () => {
    expect(calcularDiasDesde([1], {}, [1, 2], hoje)).toEqual({ '2': hoje });
  });

  it('re-adicionar um dia removido o trata como novo', () => {
    expect(calcularDiasDesde([1], { '1': '2026-09-01' }, [1, 3], hoje)).toEqual(
      {
        '1': '2026-09-01',
        '3': hoje,
      },
    );
  });
});
