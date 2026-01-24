import { Chessboard } from "cm-chessboard/src/Chessboard.js";
import { RightClickAnnotator } from "cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";

import "cm-chessboard/assets/chessboard.css";
import "cm-chessboard/assets/extensions/markers/markers.css";
import "cm-chessboard/assets/extensions/arrows/arrows.css";

import { Chess } from "chess.js";
import { classifyMove } from "./move-classification.ts";

const game = new Chess();

let pgn: string | null = localStorage.getItem("pgn");

while (!pgn) pgn = prompt("give pgn pwease");

localStorage.setItem("pgn", pgn);
game.loadPgn(pgn);

let data = {
	lastEval: "Calculating...",
	totalMoves: game.history().length,
	moveHistory: game.history(),
	currentIndex: game.history().length - 1,
	depth: localStorage.getItem("depth") || 16,
	movetime: localStorage.getItem("movetime") || 1000,
	threads: localStorage.getItem("threads") || 11,
	fenHistory: [] as string[],
	positionEvaluations: new Map(), // FEN -> white-relative score (centipawns)
	engineState: "on" as "on" | "off",
	analysisIndex: 0,
};

// fen history has stuff now
const pgnMoves = game.history({ verbose: false }) as string[];
const tempGame = new Chess();
data.fenHistory.push(tempGame.fen());
for (const move of pgnMoves) {
	tempGame.move(move);
	data.fenHistory.push(tempGame.fen());
}

const board = new Chessboard(document.getElementById("board"), {
	position: game.fen(),
	assetsUrl: "https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/",
	extensions: [{ class: RightClickAnnotator },
	],
});

const $ = (query: string) => document.querySelector(query);

const engine = new Worker("/stockfish/stockfish.js");

engine.onmessage = (event) => {
	const message = event.data;
	if (typeof message !== "string") return;

	const currentFen = data.fenHistory[data.analysisIndex];

	if (message.startsWith("info") && message.includes("score")) {
		const cpMatch = message.match(/score cp (-?\d+)/);
		const mateMatch = message.match(/score mate (-?\d+)/);
		const depthMatch = message.match(/depth (\d+)/);
		const evalDepth = document.getElementById("eval-depth");

		if (depthMatch && evalDepth && data.engineState === "on")
			evalDepth.innerText = depthMatch[1];

		let score = 0;
		if (cpMatch) {
			score = parseInt(cpMatch[1]);
		} else if (mateMatch) {
			const mateIn = parseInt(mateMatch[1]);
			score = mateIn > 0 ? 10000 - mateIn : -10000 - mateIn;
		}

		const sideToMove = currentFen.split(" ")[1];
		const whiteScore = sideToMove === "w" ? score : -score;

		if (data.engineState === "on") {
			const evalDisplay = document.getElementById("eval");
			if (evalDisplay) evalDisplay.innerText = `Analyzing: ${data.analysisIndex}/${data.fenHistory.length - 1}`;
		}

		data.positionEvaluations.set(currentFen, whiteScore);
	}

	if (message.startsWith("bestmove")) {
		if (data.engineState === "on") {
			data.analysisIndex++;
			if (data.analysisIndex < data.fenHistory.length) {
				updateEngine();
			} else {
				data.engineState = "off";
				const evalDisplay = document.getElementById("eval");
				if (evalDisplay) evalDisplay.innerText = "Analysis Complete";
				classify();
			}
			return;
		}
	}
};

function updateEngine() {
	const fen = data.fenHistory[data.analysisIndex];
	engine.postMessage("ucinewgame");
	engine.postMessage(`position fen ${fen}`);
	engine.postMessage(
		`go depth ${data.depth} movetime ${data.movetime} Threads ${data.threads}`,
	);
}

function classify() {
	const currentFen = game.fen();
	const evalAfter = data.positionEvaluations.get(currentFen);

	const classificationEl = $("#classification") as HTMLElement;
	const evalDisplay = document.getElementById("eval");

	if (evalAfter !== undefined) {
		const evalText = (Math.abs(evalAfter) / 100).toFixed(2);
		const sign = evalAfter >= 0 ? "+" : "-";
		const evaluation = `${sign}${evalText}`;
		if (evalDisplay && data.engineState === "off") evalDisplay.innerText = `Eval: ${evaluation}`;

		const ply = data.currentIndex + 1;
		if (ply > 0) {
			const fenBefore = data.fenHistory[ply - 1];
			const evalBefore = data.positionEvaluations.get(fenBefore);

			if (evalBefore !== undefined) {
				const isWhiteMove = game.turn() === "b";
				if (classificationEl) {
					const history = game.history({ verbose: true })
					const latestMove = history[data.currentIndex];

					const classification = classifyMove(
						evalBefore,
						evalAfter,
						isWhiteMove,
						latestMove.before,
						latestMove.after,
						latestMove.to
					);
					classificationEl.textContent = `${classification.name}`;
					classificationEl.style.color = `${classification.color}`;
				}
			}
		} else if (classificationEl) {
			classificationEl.textContent = "";
		}
	} else if (data.engineState === "off") {
		if (evalDisplay) evalDisplay.innerText = "No Eval";
		if (classificationEl) classificationEl.textContent = "";
	}
}

function goBack() {
	if (data.currentIndex >= 0) {
		game.undo();
		data.currentIndex--;
		board.setPosition(game.fen(), true);
		classify();
	}
}

function goForward() {
	if (data.currentIndex < data.moveHistory.length - 1) {
		data.currentIndex++;
		game.move(data.moveHistory[data.currentIndex]);
		board.setPosition(game.fen(), true);
		classify();
	}
}


function toggleOrientation() {
	board.setOrientation(board.getOrientation() === "w" ? "b" : "w");
};


$("#go-back")?.addEventListener("click", goBack);
$("#go-forward")?.addEventListener("click", goForward);
$("#flip-board")?.addEventListener("click", toggleOrientation);




engine.postMessage("uci");
engine.postMessage("isready");
updateEngine();

const BRILLIANT = { class: "marker-brilliant", slice: "markerSquare" };

board.addMarker(BRILLIANT, "e4")
