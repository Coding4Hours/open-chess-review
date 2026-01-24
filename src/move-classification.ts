const classifications = {
  excellent: {
    name: "Excellent",
    color: "#6B9B3F",
  },
  good: {
    name: "Good",
    color: "#8FB84F",
  },
  best: {
    name: "Best",
    color: "#99BC30",
  },
  inaccuracy: {
    name: "Inaccuracy",
    color: "#F4A42C",
  },
  mistake: {
    name: "Mistake",
    color: "#E45E2A",
  },
  blunder: {
    name: "Blunder",
    color: "#B82C2C",
  },
  // TODO: not implemented yet
  brilliant: {
    name: "Brilliant",
    color: "#1B8552",
  },
  great: {
    name: "Great",
    color: "#5B8B2F",
  },
  miss: {
    name: "Miss",
    color: "#9B7E3F",
  },
};

function evalToExpectedPoints(evaluation: number): number {
  if (evaluation >= 400) return 0.99;
  if (evaluation >= 300) return 0.97;
  if (evaluation >= 200) return 0.93;
  if (evaluation >= 150) return 0.9;
  if (evaluation >= 100) return 0.85;
  if (evaluation >= 75) return 0.8;
  if (evaluation >= 50) return 0.75;
  if (evaluation >= 25) return 0.65;
  if (evaluation >= 10) return 0.58;
  if (evaluation >= 5) return 0.53;
  if (evaluation >= 2) return 0.51;
  if (evaluation >= -2) return 0.5;
  if (evaluation >= -5) return 0.47;
  if (evaluation >= -10) return 0.42;
  if (evaluation >= -25) return 0.35;
  if (evaluation >= -50) return 0.25;
  if (evaluation >= -75) return 0.2;
  if (evaluation >= -100) return 0.15;
  if (evaluation >= -150) return 0.1;
  if (evaluation >= -200) return 0.07;
  if (evaluation >= -300) return 0.03;
  return 0.01;
}

export function classifyMove(
  evalBefore: number,
  evalAfter: number,
  isWhite: boolean,
) {
  const expectedBefore = evalToExpectedPoints(
    isWhite ? evalBefore : -evalBefore,
  );
  const expectedAfter = evalToExpectedPoints(isWhite ? evalAfter : -evalAfter);
  const pointsLost = expectedBefore - expectedAfter;

  if (pointsLost >= 0.2) return classifications.blunder;
  if (pointsLost >= 0.1) return classifications.mistake;
  if (pointsLost >= 0.05) return classifications.inaccuracy;
  if (pointsLost >= 0.02) return classifications.good;
  if (pointsLost > 0.0) return classifications.excellent;
  return classifications.best;
}
