// src/move-classification.ts

const classifications = {
  brilliant: {
    name: "Brilliant",
    color: "#1B8552",
  },
  great: {
    name: "Great",
    color: "#5B8B2F",
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
};

export function classifyMove(
  evalBefore: number,
  evalAfter: number,
  isWhite: boolean,
) {
  const diff = isWhite ? evalAfter - evalBefore : evalBefore - evalAfter;

  if (diff < -300) return classifications.blunder;
  if (diff < -100) return classifications.mistake;
  if (diff < -50) return classifications.inaccuracy;
  if (diff > 50) return classifications.great;
  return classifications.best;
}
