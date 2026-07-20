const SP_TIMEZONE = 'America/Sao_Paulo';
// O Brasil aboliu o horário de verão em 2019; São Paulo é UTC-3 fixo.
const SP_OFFSET_HORAS = 3;

export function inicioDoDiaSp(diasAdiante = 0): Date {
  const hojeSp = new Intl.DateTimeFormat('en-CA', {
    timeZone: SP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const [ano, mes, dia] = hojeSp.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + diasAdiante, SP_OFFSET_HORAS));
}

export function ehHojeSp(data: Date): boolean {
  return data >= inicioDoDiaSp(0) && data < inicioDoDiaSp(1);
}

export function formatarHoraSp(data: Date): string {
  return data.toLocaleTimeString('pt-BR', {
    timeZone: SP_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
}
