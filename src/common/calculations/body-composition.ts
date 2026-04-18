export const calculatePollock7Folds = (
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
    peitoral + axilarMedia + triceps + subescapular + abdominal + supraIliaca + coxa;

  if (sumFolds <= 0) return null;

  // Fórmula de Densidade Corporal (DC) - Pollock 7 Dobras (Homens)
  const dc =
    1.112 -
    0.00043499 * sumFolds +
    0.00000055 * Math.pow(sumFolds, 2) -
    0.00028826 * idade;

  // Equação de Siri para converter densidade em % de gordura
  const fatPercentage = (4.95 / dc - 4.5) * 100;

  return {
    densidade: parseFloat(dc.toFixed(4)),
    percentualGordura: parseFloat(fatPercentage.toFixed(2)),
  };
};
