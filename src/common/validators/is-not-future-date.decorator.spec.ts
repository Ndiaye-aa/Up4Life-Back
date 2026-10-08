import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import { IsDate, validate } from 'class-validator';
import { IsNotFutureDate } from './is-not-future-date.decorator';

class Amostra {
  @Type(() => Date)
  @IsDate()
  @IsNotFutureDate()
  nascimento: Date;
}

const valida = async (nascimento: string) =>
  (await validate(plainToInstance(Amostra, { nascimento }))).length === 0;

describe('IsNotFutureDate', () => {
  afterEach(() => jest.useRealTimers());

  it('aceita passado e rejeita futuro', async () => {
    expect(await valida('1990-05-10')).toBe(true);
    expect(await valida('2999-01-01')).toBe(false);
  });

  it('avalia o "agora" a cada chamada, não no carregamento do módulo', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-01T00:00:00Z'));
    expect(await valida('2029-12-31')).toBe(true);
    jest.setSystemTime(new Date('2020-01-01T00:00:00Z'));
    expect(await valida('2029-12-31')).toBe(false);
  });
});
