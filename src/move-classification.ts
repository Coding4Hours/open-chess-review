import { isPieceHanging } from "@/lib/board.ts";
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

function getExpectedPoints(
	evaluation: number,
) {
	const opts = {
		centipawnGradient: 0.0035,
	};

	return 1 / (1 + Math.exp(
		-opts.centipawnGradient * evaluation
	));
}

export function classifyMove(
	evalBefore: number,
	evalAfter: number,
	isWhite: boolean,
	lastFen: string, fen: string, square: Square
) {
	const adjustedBefore = getExpectedPoints(isWhite ? evalBefore : -evalBefore)
	const adjustedAfter = getExpectedPoints(isWhite ? evalAfter : -evalAfter);
	const evalLoss = adjustedBefore - adjustedAfter

	if (evalLoss <= 0.02) {
		return isPieceHanging(lastFen, fen, square) ? classifications.
			brilliant :
			(evalLoss <= 0 ? classifications.best : classifications.
				excellent);
	}


	if (evalLoss <= 0.05) return classifications.good;
	if (evalLoss <= 0.10) return classifications.inaccuracy;
	if (evalLoss <= 0.20) return classifications.mistake;
	return classifications.blunder;

}
