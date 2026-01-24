import { isPieceHanging } from "./lib/board.ts";
import type { Square } from "chess.js";

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
	brilliant: {
		name: "Brilliant",
		color: "#1B8552",
	},

	// TODO: not implemented yet
	great: {
		name: "Great",
		color: "#5B8B2F",
	},
	miss: {
		name: "Miss",
		color: "#9B7E3F",
	},
};

export function classifyMove(
	evalBefore: number,
	evalAfter: number,
	isWhite: boolean,
	lastFen: string, fen: string, square: Square
) {
	const adjustedBefore = isWhite ? evalBefore : -evalBefore;
	const adjustedAfter = isWhite ? evalAfter : -evalAfter;
	const evalLoss = adjustedBefore - adjustedAfter;

	if (evalLoss >= 500) return classifications.blunder;
	if (evalLoss >= 100) return classifications.mistake;
	if (evalLoss >= 50) return classifications.inaccuracy;
	if (evalLoss >= 25) return classifications.good;
	if (evalLoss > 0) if (isPieceHanging(lastFen, fen, square)) return classifications.brilliant; else return classifications.excellent;
	if (evalLoss == 0) if (isPieceHanging(lastFen, fen, square)) return classifications.brilliant; else return classifications.best;
	return classifications.best;
}
