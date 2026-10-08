import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSessaoDto, ListSessoesQueryDto } from './create-sessao.dto';

const erros = async (cls: new () => object, plain: object) =>
  (await validate(plainToInstance(cls, plain))).map((e) => e.property);

describe('DTOs de sessão — datas', () => {
  it('create aceita data real e rejeita data inexistente', async () => {
    expect(
      await erros(CreateSessaoDto, { data: '2026-02-28', status: 'FALTA' }),
    ).toEqual([]);
    expect(
      await erros(CreateSessaoDto, { data: '2026-02-31', status: 'FALTA' }),
    ).toEqual(['data']);
  });

  it('listagem valida de/ate', async () => {
    expect(await erros(ListSessoesQueryDto, { de: '2026-13-01' })).toEqual([
      'de',
    ]);
    expect(
      await erros(ListSessoesQueryDto, { de: '2026-01-01', ate: '2026-01-31' }),
    ).toEqual([]);
  });
});
