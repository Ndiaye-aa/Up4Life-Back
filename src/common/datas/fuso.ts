export const FUSO_PADRAO = 'America/Sao_Paulo';

/** Data local (YYYY-MM-DD) de um instante no fuso informado. */
export const dataLocal = (instante: Date, tz: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);

/** Hora local (HH:mm) de um instante no fuso informado. */
export const horaLocal = (instante: Date, tz: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instante);

export const somarDias = (ymd: string, n: number): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 0 = domingo (convenção de `agenda_treino.dias`, igual a Date#getDay). */
export const diaDaSemana = (ymd: string): number =>
  new Date(`${ymd}T12:00:00Z`).getUTCDay();

/**
 * `true` apenas para datas reais no formato YYYY-MM-DD. `new Date('2026-02-31')`
 * não falha — rola para 02/03 —, então o round-trip é a única checagem confiável.
 */
export const ehDataValida = (ymd: unknown): ymd is string => {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
};

export const paraDbDate = (ymd: string): Date => {
  if (!ehDataValida(ymd)) {
    throw new RangeError(`Data inválida: ${String(ymd)}`);
  }
  return new Date(`${ymd}T00:00:00Z`);
};

/** Converte um campo `@db.Date` do Prisma de volta para YYYY-MM-DD. */
export const deDbDate = (data: Date): string => data.toISOString().slice(0, 10);

const DIAS_POR_EXTENSO = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
];

export const nomeDoDia = (ymd: string): string =>
  DIAS_POR_EXTENSO[diaDaSemana(ymd)];

/** Fusos aceitos no perfil do personal (Brasil). */
export const FUSOS_BRASILEIROS = [
  'America/Noronha',
  'America/Belem',
  'America/Fortaleza',
  'America/Recife',
  'America/Bahia',
  'America/Sao_Paulo',
  'America/Campo_Grande',
  'America/Cuiaba',
  'America/Manaus',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
] as const;

/** Segunda-feira da semana ISO (YYYY-MM-DD) e rótulo "YYYY-Www". */
export const semanaIso = (ymd: string): string => {
  const d = new Date(`${ymd}T12:00:00Z`);
  const diaSemana = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - diaSemana + 3); // quinta da semana
  const ano = d.getUTCFullYear();
  const primeiraQuinta = new Date(Date.UTC(ano, 0, 4, 12));
  const semana =
    1 +
    Math.round(
      ((d.getTime() - primeiraQuinta.getTime()) / 86_400_000 -
        3 +
        ((primeiraQuinta.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${ano}-W${String(semana).padStart(2, '0')}`;
};
