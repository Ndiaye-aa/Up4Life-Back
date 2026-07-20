const siriFatPercentage = (dc: number): number => (4.95 / dc - 4.5) * 100;

export const calculatePollock7FoldsMale = (
  idade: number,
  peitoral: number,
  axilarMedia: number,
  triceps: number,
  subescapular: number,
  abdominal: number,
  supraIliaca: number,
  coxa: number,
): { densidade: number; percentualGordura: number } | null => {
  const sumFolds =
    peitoral +
    axilarMedia +
    triceps +
    subescapular +
    abdominal +
    supraIliaca +
    coxa;

  if (sumFolds <= 0) return null;

  // Fórmula de Densidade Corporal (DC) - Pollock 7 Dobras (Homens)
  const dc =
    1.112 -
    0.00043499 * sumFolds +
    0.00000055 * Math.pow(sumFolds, 2) -
    0.00028826 * idade;

  return {
    densidade: parseFloat(dc.toFixed(4)),
    percentualGordura: parseFloat(siriFatPercentage(dc).toFixed(2)),
  };
};

export const calculatePollock7FoldsFemale = (
  idade: number,
  peitoral: number,
  axilarMedia: number,
  triceps: number,
  subescapular: number,
  abdominal: number,
  supraIliaca: number,
  coxa: number,
): { densidade: number; percentualGordura: number } | null => {
  const sumFolds =
    peitoral +
    axilarMedia +
    triceps +
    subescapular +
    abdominal +
    supraIliaca +
    coxa;

  if (sumFolds <= 0) return null;

  // Fórmula de Densidade Corporal (DC) - Pollock 7 Dobras (Mulheres)
  const dc =
    1.097 -
    0.00046971 * sumFolds +
    0.00000056 * Math.pow(sumFolds, 2) -
    0.00012828 * idade;

  return {
    densidade: parseFloat(dc.toFixed(4)),
    percentualGordura: parseFloat(siriFatPercentage(dc).toFixed(2)),
  };
};
