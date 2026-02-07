import { Chessboard } from "cm-chessboard/src/Chessboard.js";
import { RightClickAnnotator } from "cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";
import { ARROW_TYPE } from "cm-chessboard/src/extensions/arrows/Arrows.js";

import "cm-chessboard/assets/chessboard.css";
import "cm-chessboard/assets/extensions/markers/markers.css";
import "cm-chessboard/assets/extensions/arrows/arrows.css";

import { Chess } from "chess.js";
import { StateTree, type StateTreeNode } from "@/lib/StateTree";
import { getScore } from "@/move-classification";


import moveMove from "@/data/audio/move.mp3";
import moveCheck from "@/data/audio/check.mp3";
import moveCapture from "@/data/audio/capture.mp3";
import moveCastle from "@/data/audio/castle.mp3";
import movePromote from "@/data/audio/promote.mp3";
import moveGameend from "@/data/audio/gameend.mp3";


import Swal from 'sweetalert2'

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

function renderMoveTree() {
	const bigercontainer = document.getElementById("move-tree");
	if (!bigercontainer) return;
	bigercontainer.setAttribute("class", "mt-4 p-4 rounded-md bg-white/30 max-h-100 overflow-y-auto text-left font-mono text-sm")

	const container = document.getElementById("moves");
	if (!container) return;

	const history = data.stateTree.getHistory().slice(1);
	const futureNodes: StateTreeNode[] = [];
	for (let w = data.stateTree.currentNode; w.children[0]; w = w.children[0]) {
		futureNodes.push(w.children[0]);
	}
	const allNodes = [...history, ...futureNodes];

	container.innerHTML = "";
	const list = document.createElement("div");
	list.className = "grid grid-cols-[3rem_1fr_1fr] gap-y-1 text-sm";
	container.appendChild(list);

	const getParts = (fen: string) => {
		const parts = fen.split(" ");
		return { turn: parts[1], num: parseInt(parts[5] || "1") };
	};

	const createCell = (content: string | StateTreeNode, isNum = false) => {
		const div = document.createElement("div");
		div.className = "py-1 pl-2 border-b border-slate-400/10 flex items-center gap-2";

		if (typeof content === "string") {
			div.textContent = content;
			div.className += isNum ? " text-slate-500" : " text-slate-400";
		} else {
			const isCurrent = content === data.stateTree.currentNode;
			div.className += ` cursor-pointer hover:bg-slate-400/20 ${isCurrent ? "bg-blue-500/40 font-bold text-slate-800 current-move-highlight" : ""}`;
			div.innerHTML = `<span>${content.move}</span>`;
			if (content.classification) {
				const { color, name } = content.classification;
				div.innerHTML += `<span class="text-xs" style="color:${color}" title="${name}"></span>`;
			}
			div.onclick = () => navigateToNode(content);
		}
		return div;
	};

	if (allNodes.length > 0) {
		const first = allNodes[0];
		const { turn, num } = getParts(first.parent?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

		if (turn === 'b') {
			list.append(createCell(`${num}.`, true), createCell("..."));
		}

		allNodes.forEach((node) => {
			const { turn, num } = getParts(node.parent?.fen || "");
			if (turn === 'w') list.append(createCell(`${num}.`, true));
			list.append(createCell(node));
		});
	}

	container.querySelector(".current-move-highlight")?.scrollIntoView({ block: "center", behavior: "smooth" });
}


const $ = (query: string) => document.querySelector(query);

const evaluationBar = document.querySelector("#evaluation-bar") as SVGElement;

const totalHeight = evaluationBar.clientHeight;


function navigateToNode(node: StateTreeNode) {
	data.stateTree.currentNode = node;
	game.load(node.fen);
	board.setPosition(node.fen, true);

	const historyNodes = data.stateTree.getHistory();
	data.moveHistory = historyNodes.map(n => n.move).filter(Boolean);
	data.currentIndex = data.moveHistory.length - 1;

	if (node.move) {
		playSound(node.move);
	}

	classify();
	renderMoveTree();
}

function init(pgn: string) {

	data.stateTree = new StateTree(undefined, { pgn });

	const historyNodes = data.stateTree.getHistory();
	data.moveHistory = historyNodes.map(node => node.move).filter(Boolean);
	data.totalMoves = data.moveHistory.length;
	data.currentIndex = -1;
	data.engineState = "on";
	data.analysisIndex = 0;

	data.stateTree.setLine();
	data.stateTree.navigateToRoot();

	game.loadPgn(pgn);
	game.reset();

	board.setPosition(game.fen(), false);

	renderMoveTree();
	updateEngine();
}


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

		const evalData = data.stateTree.getEvaluation(currentFen) || { type: "centipawn" as const, value: 0 };

		if (cpMatch) {
			evalData.type = "centipawn";
			evalData.value = parseInt(cpMatch[1]);
		} else if (mateMatch) {
			evalData.type = "mate";
			const mateValue = parseInt(mateMatch[1]);
			evalData.value = mateValue === 0 ? -0.01 : mateValue;
		}

		const sideToMove = currentFen.split(" ")[1];
		if (sideToMove === "b") {
			evalData.value = -evalData.value;
		}

		if (data.engineState === "on") {
			const evalDisplay = document.getElementById("eval");
			if (evalDisplay)
				evalDisplay.innerText = `Analyzing: ${data.analysisIndex}/${data.stateTree.mainLineFens.length - 1}`;
		}

		data.stateTree.updateEvaluation(currentFen, evalData);
	}

	if (message.startsWith("bestmove")) {
		const bestMove = message.split(" ")[1];
		const evalData = data.stateTree.getEvaluation(currentFen) || { type: "centipawn" as const, value: 0 };
		evalData.bestMove = bestMove;
		data.stateTree.updateEvaluation(currentFen, evalData);

		if (data.engineState === "on") {
			data.analysisIndex++;
			if (data.analysisIndex < data.stateTree.mainLineFens.length) {
				updateEngine();
			} else {
				data.engineState = "off";
				const evalDisplay = document.getElementById("eval");
				if (evalDisplay) evalDisplay.classList.add("hidden")
				alert("Analysis complete!")
				classify();
				renderMoveTree();
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

	const score = evalData ? getScore(evalData) : undefined;

	const openingEl = $("#opening") as HTMLElement;

	openingEl.textContent = currentNode.opening || "Starting Position";

	const classificationEl = $("#classification") as HTMLElement;

	const evalDisplay = document.getElementById("eval");

	if (score !== undefined && evalData) {
		let evalText = "";
		if (evalData.type === "mate") {
			evalText = `M${Math.round(Math.abs(evalData.value))}`;
		} else {
			evalText = (Math.abs(evalData.value) / 100).toFixed(1);
		}

		if (evalDisplay && data.engineState === "off") {
			const blackBarHeight = Math.max(Math.min(totalHeight / 2 - score / 3, totalHeight), 0);
			const whiteBarHeight = Math.max(Math.min(totalHeight / 2 + score / 3, totalHeight), 0);


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
			if (score > 0) {
				whiteText.textContent = evalText;
				blackText.textContent = "";
			} else if (score < 0) {
				whiteText.textContent = "";
				blackText.textContent = evalText;
			} else {
				whiteText.textContent = "";
				blackText.textContent = "";
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
	const parent = data.stateTree.currentNode.parent;
	if (parent) {
		navigateToNode(parent);
	}
}

function goForward() {
	if (data.stateTree.currentNode.children.length > 0) {
		navigateToNode(data.stateTree.currentNode.children[0]);
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


$("#import-game")?.addEventListener("click", async () => {
	const { value: input, isConfirmed, isDenied, dismiss } = await Swal.fire({
		title: "Import Game",
		input: "text",
		inputLabel: "Username or PGN",
		inputPlaceholder: "Enter username or paste PGN here...",
		showDenyButton: true,
		showCancelButton: true,
		confirmButtonText: "Chess.com",
		denyButtonText: "Lichess.org",
		cancelButtonText: "Raw PGN",
		preConfirm: (value) => {
			if (!value) return Swal.showValidationMessage("Please enter something");
			return value;
		}
	});



	if (isConfirmed) {
		const date = new Date();
		const currYear = date.getFullYear();
		const currMonth = (date.getMonth() + 1).toString().padStart(2, '0');

		const res = await fetch(`https://api.chess.com/pub/player/${input}/games/${currYear}/${currMonth}`);
		const data = await res.json();

		if (data.games?.length) {
			init(data.games[data.games.length - 1].pgn);
		} else {
			Swal.fire("Error", "No games found for this month", "error");
		}

	} else if (isDenied) {
		const res = await fetch(`https://lichess.org/api/games/user/${input}?max=1`);
		const pgn = await res.text();

		if (pgn) init(pgn);
		else Swal.fire("Error", "No games found on Lichess", "error");

	} else if (dismiss === Swal.DismissReason.cancel) {
		init(input);
	}
});
