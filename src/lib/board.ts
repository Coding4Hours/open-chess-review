// credit to wintrcat: https://github.com/WintrCat/freechess/blob/master/src/lib/board.ts
import { Chess } from "chess.js";
import type { Square, Color, PieceSymbol } from "chess.js";

export interface InfluencingPiece {
	square: Square;
	color: Color;
	type: PieceSymbol;
}

export const pieceValues: Record<string, number> = {
	p: 1,
	n: 3,
	b: 3,
	r: 5,
	q: 9,
	k: Infinity,
};

function getPieceInfo(board: Chess, squares: Square[]): InfluencingPiece[] {
	return squares.map((sq) => {
		const piece = board.get(sq);
		if (piece != null)
			return {
				square: sq,
				color: piece.color,
				type: piece.type,
			};
		return null;
	}).filter((p): p is InfluencingPiece => p !== null);
}

export function getAttackers(fen: string, square: Square): InfluencingPiece[] {
	const board = new Chess(fen);
	const piece = board.get(square);
	if (!piece) return [];

	const enemyColor = piece.color === "w" ? "b" : "w";

	const attackerSquares = board.attackers(square, enemyColor);

	return getPieceInfo(board, attackerSquares);
}

export function getDefenders(fen: string, square: Square): InfluencingPiece[] {
	const board = new Chess(fen);
	const piece = board.get(square);
	if (!piece) return [];

	const defenderSquares = board.attackers(square, piece.color);

	return getPieceInfo(board, defenderSquares);
}

export function isPieceHanging(
	lastFen: string,
	fen: string,
	square: Square,
): boolean {
	const lastBoard = new Chess(lastFen);
	const board = new Chess(fen);

	const lastPiece = lastBoard.get(square);
	const piece = board.get(square);

	if (!piece) return false;
	if (board.isCheck()) return false;

	const attackers = getAttackers(fen, square);
	const defenders = getDefenders(fen, square);

	if (
		lastPiece &&
		pieceValues[lastPiece.type] >= pieceValues[piece.type] &&
		lastPiece.color !== piece.color
	) {
		return false;
	}

	if (
		piece.type === "r" &&
		lastPiece &&
		pieceValues[lastPiece.type] === 3 &&
		attackers.every((atk) => pieceValues[atk.type] === 3) &&
		attackers.length === 1
	) {
		return false;
	}

	if (
		attackers.some((atk) => pieceValues[atk.type] < pieceValues[piece.type])
	) {
		return true;
	}

	if (attackers.length > defenders.length) {
		const minAttackerValue = Math.min(
			...attackers.map((atk) => pieceValues[atk.type]),
		);

		if (
			pieceValues[piece.type] < minAttackerValue &&
			defenders.some((dfn) => pieceValues[dfn.type] < minAttackerValue)
		) {
			return false;
		}

		if (defenders.some((dfn) => pieceValues[dfn.type] === 1)) {
			return false;
		}

		return true;
	}

	return false;
}
