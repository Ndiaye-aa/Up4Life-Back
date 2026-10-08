export type ContextoFalta = 'avulsa' | 'consecutiva';
export type Mensagem = { chave: string; titulo: string; corpo: string };

// Tom de acolhimento, sem culpa; corpo com até ~120 caracteres.
// Dados de saúde nunca entram no payload (aparece na tela bloqueada).
export const MENSAGENS_FALTA: Record<ContextoFalta, Mensagem[]> = {
  avulsa: [
    {
      chave: 'saudade',
      titulo: 'Sentimos sua falta! 💪',
      corpo:
        '{nome}, o treino de {dia} ficou pra trás. Bora repor essa semana?',
    },
    {
      chave: 'imprevisto',
      titulo: 'Tudo certo por aí?',
      corpo:
        'Não vimos seu treino de {dia}. Se rolou um imprevisto, conta pra gente.',
    },
    {
      chave: 'registro',
      titulo: 'Treinou e esqueceu?',
      corpo:
        'Seu treino de {dia} não foi registrado. Você tem até 7 dias para registrar.',
    },
    {
      chave: 'constancia',
      titulo: 'Constância vence tudo',
      corpo:
        'Um dia fora acontece, {nome}. O importante é voltar. Seu próximo treino te espera!',
    },
    {
      chave: 'reposicao',
      titulo: 'Bora recuperar?',
      corpo:
        'Que tal repor o treino de {dia} num dia livre? Conta como presença!',
    },
  ],
  consecutiva: [
    {
      chave: 'cuidado',
      titulo: 'Está tudo bem, {nome}?',
      corpo:
        'Já são {n} treinos sem você. Seu personal pode ajustar o plano se precisar.',
    },
    {
      chave: 'leve',
      titulo: 'Volta no seu ritmo',
      corpo:
        'Faz alguns dias que não te vemos. Que tal voltar com um treino mais leve?',
    },
    {
      chave: 'parceria',
      titulo: 'A gente tá junto',
      corpo:
        '{n} faltas seguidas, {nome}. Fala com seu personal e bora retomar juntos.',
    },
  ],
};

export function escolherMensagem(
  ctx: ContextoFalta,
  recentes: string[],
  rand: () => number = Math.random,
): Mensagem {
  const pool = MENSAGENS_FALTA[ctx];
  const livres = pool.filter((m) => !recentes.includes(m.chave));
  const opcoes = livres.length ? livres : pool;
  return opcoes[Math.floor(rand() * opcoes.length)];
}

export const interpolar = (
  t: string,
  v: Record<string, string | number>,
): string => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
