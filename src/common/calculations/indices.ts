export const calculateIMC = (peso: number, altura: number): number => {
  if (altura <= 0) return 0;
  return parseFloat((peso / (altura * altura)).toFixed(2));
};

export const calculateIAC = (quadril: number, altura: number): number => {
  if (altura <= 0) return 0;
  return parseFloat((quadril / (altura * Math.sqrt(altura)) - 18).toFixed(2));
};

export const calculateRCQ = (cintura: number, quadril: number): number => {
  if (quadril <= 0) return 0;
  return parseFloat((cintura / quadril).toFixed(2));
};
