type Novo = { hora: string; modalidade: 'PRESENCIAL' | 'ONLINE' };

export function converterHorarios(horarios: unknown): {
  convertido: Record<string, Novo>;
  alterado: boolean;
} {
  const convertido: Record<string, Novo> = {};
  let alterado = false;

  if (horarios && typeof horarios === 'object') {
    for (const [dia, valor] of Object.entries(horarios)) {
      if (typeof valor === 'string') {
        convertido[dia] = { hora: valor, modalidade: 'PRESENCIAL' };
        alterado = true;
      } else if (valor && typeof valor === 'object' && 'hora' in valor) {
        const v = valor as { hora: string; modalidade?: string };
        convertido[dia] = {
          hora: v.hora,
          modalidade: v.modalidade === 'ONLINE' ? 'ONLINE' : 'PRESENCIAL',
        };
      }
    }
  }
  return { convertido, alterado };
}
