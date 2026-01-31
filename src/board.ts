import { Chessboard } from "cm-chessboard/src/Chessboard.js";
import { RightClickAnnotator } from "cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";
import { ARROW_TYPE } from "cm-chessboard/src/extensions/arrows/Arrows.js";

import "cm-chessboard/assets/chessboard.css";
import "cm-chessboard/assets/extensions/markers/markers.css";
import "cm-chessboard/assets/extensions/arrows/arrows.css";

import { Chess } from "chess.js";
import { StateTree } from "@/lib/StateTree";


import moveMove from "@/data/audio/move.mp3";
import moveCheck from "@/data/audio/check.mp3";
import moveCapture from "@/data/audio/capture.mp3";
import moveCastle from "@/data/audio/castle.mp3";
import movePromote from "@/data/audio/promote.mp3";
import moveGameend from "@/data/audio/gameend.mp3";



const game = new Chess();

let data = {
	lastEval: "Calculating...",
	totalMoves: 0,
	moveHistory: [] as any[],
	currentIndex: -1,
	depth: localStorage.getItem("depth") || 16,
	movetime: localStorage.getItem("movetime") || 1000,
	threads: localStorage.getItem("threads") || 11,
	multipv: localStorage.getItem("multipv") || 2,
	stateTree: new StateTree(),
	engineState: "off" as "on" | "off",
	analysisIndex: 0,
};

const board = new Chessboard(document.getElementById("board"), {
	position: game.fen(),
	assetsUrl: "https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/",
	extensions: [{ class: RightClickAnnotator }],
});

const $ = (query: string) => document.querySelector(query);

const evaluationBar = document.querySelector("#evaluation-bar") as SVGElement;

const totalHeight = evaluationBar.clientHeight;

function init(pgn: string) {
	game.loadPgn(pgn);
	const history = game.history();
	game.reset();

	data.totalMoves = history.length;
	data.moveHistory = history;
	data.currentIndex = -1;
	data.stateTree = new StateTree();
	data.engineState = "on";
	data.analysisIndex = 0;

	const pgnMoves = data.moveHistory as string[];
	const tempGame = new Chess();
	for (const move of pgnMoves) {
		const moveDetails = tempGame.move(move);
		data.stateTree.addMove(tempGame.fen(), move, moveDetails);
	}
	data.stateTree.setLine();
	data.stateTree.navigateToRoot();

	board.setPosition(game.fen(), false);
	updateEngine();
}

const pgnTextarea = $("#pgn-textarea") as HTMLTextAreaElement;
const analyzeBtn = $("#analyze-pgn");


analyzeBtn?.addEventListener("click", () => {
	if (pgnTextarea?.value) {
		init(pgnTextarea.value);
	}
});

const engine = new Worker("/stockfish/stockfish.js");
(window as any).engine = engine;

engine.onmessage = (event) => {
	const message = event.data;
	if (typeof message !== "string") return;

	if (data.stateTree.mainLineFens.length === 0) return;
	const currentFen = data.stateTree.mainLineFens[data.analysisIndex];

	if (message.startsWith("info") && message.includes("score")) {
		const cpMatch = message.match(/score cp (-?\d+)/);
		const mateMatch = message.match(/score mate (-?\d+)/);


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
	if (data.stateTree.mainLineFens.length === 0) return;
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

	openingEl.textContent = currentNode.opening || "Starting Position";

	const classificationEl = $("#classification") as HTMLElement;

	const evalDisplay = document.getElementById("eval");

	if (evalAfter !== undefined) {

		if (evalDisplay && data.engineState === "off") {
			const winChance = 1 / (1 + Math.exp(-0.004 * evalAfter));
			const whiteBarHeight = winChance * totalHeight;
			const blackBarHeight = totalHeight - whiteBarHeight;

			const whiteRect = document.querySelector("#white-rect") as SVGRectElement;
			const blackRect = document.querySelector("#black-rect") as SVGRectElement;
			const whiteText = document.querySelector("#white-eval-text") as SVGTextElement;
			const blackText = document.querySelector("#black-eval-text") as SVGTextElement;

			const orientation = board.getOrientation();

			if (orientation === "w") {
				blackRect.setAttribute("y", "0");
				blackRect.setAttribute("height", blackBarHeight.toString());

				whiteRect.setAttribute("y", blackBarHeight.toString());
				whiteRect.setAttribute("height", whiteBarHeight.toString());

				if (whiteText && blackText) {
					blackText.setAttribute("y", "20");
					whiteText.setAttribute("y", "720");
				}
			} else {
				whiteRect.setAttribute("y", "0");
				whiteRect.setAttribute("height", whiteBarHeight.toString());

				blackRect.setAttribute("y", whiteBarHeight.toString());
				blackRect.setAttribute("height", blackBarHeight.toString());

				if (whiteText && blackText) {
					whiteText.setAttribute("y", "20");
					blackText.setAttribute("y", "720");
				}
			}

		}

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

async function toggleOrientation() {
	await board.setOrientation(board.getOrientation() === "w" ? "b" : "w");
	classify();
}

$("#go-back")?.addEventListener("click", goBack);
$("#go-forward")?.addEventListener("click", goForward);
$("#flip-board")?.addEventListener("click", toggleOrientation);

engine.postMessage("uci");
engine.postMessage("isready");

if (pgnTextarea?.value) {
	init(pgnTextarea.value);
}
