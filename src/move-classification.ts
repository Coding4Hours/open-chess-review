// src/move-classification.ts

const classifications = {
  brilliant: {
    name: "Brilliant",
    color: "#1B8552",
    description: "A brilliant move is a good sacrifice.",
  },
  great: {
    name: "Great",
    color: "#5B8B2F",
    description:
      "A great move is a move that turns a losing position into an equal one, or an equal position into a winning one.",
  },
  best: {
    name: "Best",
    color: "#99BC30",
    description: "The best move.",
  },
  inaccuracy: {
    name: "Inaccuracy",
    color: "#F4A42C",
    description: "An inaccuracy is a move that is not terrible, but not great.",
  },
  mistake: {
    name: "Mistake",
    color: "#E45E2A",
    description: "A mistake is a bad move.",
  },
  blunder: {
    name: "Blunder",
    color: "#B82C2C",
    description: "A blunder is a very bad move.",
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
