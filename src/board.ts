import { Chessboard } from "cm-chessboard/src/Chessboard.js";
import { RightClickAnnotator } from "cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";
import { ARROW_TYPE } from "cm-chessboard/src/extensions/arrows/Arrows.js";

import "cm-chessboard/assets/chessboard.css";
import "cm-chessboard/assets/extensions/markers/markers.css";
import "cm-chessboard/assets/extensions/arrows/arrows.css";

import { Chess } from "chess.js";
import { StateTree } from "@/lib/StateTree";

import openingsData from "@/data/openings.json";

import moveMove from "@/data/audio/move.mp3";
import moveCheck from "@/data/audio/check.mp3";
import moveCapture from "@/data/audio/capture.mp3";
import moveCastle from "@/data/audio/castle.mp3";
import movePromote from "@/data/audio/promote.mp3";
import moveGameend from "@/data/audio/gameend.mp3";



const game = new Chess();

let pgn: string | null = localStorage.getItem("pgn");

while (!pgn) pgn = prompt("give pgn pwease");

localStorage.setItem("pgn", pgn);
game.loadPgn(pgn);
const history = game.history();
game.reset();




let data = {
	lastEval: "Calculating...",
	totalMoves: history.length,
	moveHistory: history,
	currentIndex: -1,
	depth: localStorage.getItem("depth") || 16,
	movetime: localStorage.getItem("movetime") || 1000,
	threads: localStorage.getItem("threads") || 11,
	multipv: localStorage.getItem("multipv") || 2,
	stateTree: new StateTree(),
	engineState: "on" as "on" | "off",
	analysisIndex: 0,
	openings: openingsData as Record<string, string>,
	lastOpening: "Starting Position",
};

const pgnMoves = data.moveHistory as string[];
const tempGame = new Chess();
for (const move of pgnMoves) {
	const moveDetails = tempGame.move(move);
	data.stateTree.addMove(tempGame.fen(), move, moveDetails);
}
data.stateTree.setLine();
data.stateTree.navigateToRoot();

const board = new Chessboard(document.getElementById("board"), {
	position: game.fen(),
	assetsUrl: "https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/",
	extensions: [{ class: RightClickAnnotator }],
});

const $ = (query: string) => document.querySelector(query);

window.engine = new Worker("/stockfish/stockfish.js");

engine.onmessage = (event) => {
	const message = event.data;
	if (typeof message !== "string") return;

	const currentFen = data.stateTree.mainLineFens[data.analysisIndex];

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
			if (evalDisplay)
				evalDisplay.innerText = `Analyzing: ${data.analysisIndex}/${data.stateTree.mainLineFens.length - 1}`;
		}

		const evalData = data.stateTree.getEvaluation(currentFen) || { score: 0 };
		evalData.score = whiteScore;
		data.stateTree.updateEvaluation(currentFen, evalData);
	}

	if (message.startsWith("bestmove")) {
		const bestMove = message.split(" ")[1];
		const evalData = data.stateTree.getEvaluation(currentFen) || { score: 0 };
		evalData.bestMove = bestMove;
		data.stateTree.updateEvaluation(currentFen, evalData);

		if (data.engineState === "on") {
			data.analysisIndex++;
			if (data.analysisIndex < data.stateTree.mainLineFens.length) {
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
	const fen = data.stateTree.mainLineFens[data.analysisIndex];
	engine.postMessage("ucinewgame");
	engine.postMessage(`position fen ${fen}`);
	engine.postMessage(
		`go depth ${data.depth} movetime ${data.movetime} Threads ${data.threads} MultiPV ${data.multipv}`,
	);
}

function classify() {
	board.removeArrows();
	board.removeMarkers();

	const currentNode = data.stateTree.currentNode;
	data.stateTree.classifyNode(currentNode);

	const currentFen = game.fen();
	const evalData = data.stateTree.getEvaluation(currentFen);
	const evalAfter = evalData?.score;

	const openingEl = $("#opening") as HTMLElement;

	const fenKey = currentFen.split(" ")[0];
	const openingName = data.openings[fenKey];

	openingEl.textContent = openingName || data.lastOpening;
	if (openingName != null) data.lastOpening = openingName;

	const classificationEl = $("#classification") as HTMLElement;

	const evalDisplay = document.getElementById("eval");

	if (evalAfter !== undefined) {
		const evalText = (Math.abs(evalAfter) / 100).toFixed(2);
		const sign = evalAfter >= 0 ? "+" : "-";
		const evaluation = `${sign}${evalText}`;
		if (evalDisplay && data.engineState === "off")
			evalDisplay.innerText = `Eval: ${evaluation}`;

		if (evalData?.bestMove && evalData.bestMove !== "(none)") {
			const from = evalData.bestMove.substring(0, 2);
			const to = evalData.bestMove.substring(2, 4);

			board.addArrow(ARROW_TYPE.info, from, to);
		}

		if (currentNode.classification && classificationEl) {
			classificationEl.textContent = `${currentNode.classification.name}`;
			classificationEl.style.color = `${currentNode.classification.color}`;
		} else if (classificationEl) {
			classificationEl.textContent = "";
		}
	} else if (data.engineState === "off") {
		if (evalDisplay) evalDisplay.innerText = "No Eval";
		if (classificationEl) classificationEl.textContent = "";
		board.removeArrows();
	}
}

const moveSounds = {
	move: moveMove,
	check: moveCheck,
	capture: moveCapture,
	castle: moveCastle,
	promote: movePromote,
	gameEnd: moveGameend
};


function playSound(latestMove: string) {
	if (game.isGameOver()) {
		new Audio(moveSounds.gameEnd).play();
	}
	if (latestMove == "O-O" || latestMove == "O-O-O")
		new Audio(moveSounds.castle).play();
	else if (latestMove.endsWith("+") || latestMove.endsWith("#"))
		new Audio(moveSounds.check).play();
	else if (latestMove.includes("="))
		new Audio(moveSounds.promote).play();
	else if (latestMove.includes("x"))
		new Audio(moveSounds.capture).play();
	else
		new Audio(moveSounds.move).play();
}

function goBack() {
	if (data.currentIndex >= 0) {
		game.undo();
		data.currentIndex--;
		data.stateTree.navigateBack();
		board.setPosition(game.fen(), true);
		if (data.currentIndex >= 0) {
			playSound(data.moveHistory[data.currentIndex]);
		}
		classify();
	}
}

function goForward() {
	if (data.currentIndex == data.moveHistory.length - 2)
		console.log("winner")
	if (data.currentIndex < data.moveHistory.length - 1) {
		data.currentIndex++;
		const move = data.moveHistory[data.currentIndex];
		game.move(move);
		data.stateTree.navigateForward(move);
		board.setPosition(game.fen(), true);
		playSound(move);
		classify();
	}
}

function toggleOrientation() {
	board.setOrientation(board.getOrientation() === "w" ? "b" : "w");
}

$("#go-back")?.addEventListener("click", goBack);
$("#go-forward")?.addEventListener("click", goForward);
$("#flip-board")?.addEventListener("click", toggleOrientation);

engine.postMessage("uci");
engine.postMessage("isready");
updateEngine();
