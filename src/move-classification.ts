import { isPieceHanging } from "@/lib/board.ts";
import type { Square } from "chess.js";
import type { Evaluation } from "@/types/Evaluation";
import { classifications } from "@/constants/classifications"


export function getScore(e: Evaluation) {
	if (e.type === "mate") {
		return e.value > 0 ? 10000 - e.value : -10000 - e.value;
	}
	return e.value;
}

function getExpectedPoints(evaluation: Evaluation) {
	const opts = {
		centipawnGradient: 0.0035,
	};


	if (evaluation.type == "mate") {
		return Number(evaluation.value > 0);
	} else {
		return 1 / (1 + Math.exp(
			-opts.centipawnGradient * evaluation.value
		));
	}
}

export function classifyMove(
	evalBefore: Evaluation,
	evalAfter: Evaluation,
	isWhite: boolean,
	lastFen: string,
	fen: string,
	square: Square,
) {
	const whiteBefore = isWhite ? evalBefore : { ...evalBefore, value: -evalBefore.value };
	const whiteAfter = isWhite ? evalAfter : { ...evalAfter, value: -evalAfter.value };

	const adjustedBefore = getExpectedPoints(whiteBefore);
	const adjustedAfter = getExpectedPoints(whiteAfter);
	const evalLoss = adjustedBefore - adjustedAfter;

	if (evalLoss <= 0.02) {
		return isPieceHanging(lastFen, fen, square)
			? classifications.brilliant
			: evalLoss <= 0
				? classifications.best
				: classifications.excellent;
	}

	if (evalLoss <= 0.05) return classifications.good;
	if (evalLoss <= 0.1) return classifications.inaccuracy;
	if (evalLoss <= 0.2) return classifications.mistake;
	return classifications.blunder;
}
