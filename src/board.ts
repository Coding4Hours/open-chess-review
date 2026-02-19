import { Chessboard } from "cm-chessboard/src/Chessboard.js";
import { RightClickAnnotator } from "cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";
import { ARROW_TYPE } from "cm-chessboard/src/extensions/arrows/Arrows.js";

import "cm-chessboard/assets/chessboard.css";
import "cm-chessboard/assets/extensions/markers/markers.css";
import "cm-chessboard/assets/extensions/arrows/arrows.css";

import { Chess } from "chess.js";
import { StateTree, type StateTreeNode } from "@/lib/StateTree";
import { getScore } from "@/move-classification";


import { AudioManager } from "@/lib/AudioManager";
import { Engine } from "@/lib/Engine";
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
	engine: localStorage.getItem("engine") || "stockfish18",
	stateTree: new StateTree(),
	engineState: "off" as "on" | "off",
	analysisIndex: 0,
};


const $ = (query: string) => document.querySelector(query);

const UI = {
	board: $("#board") as HTMLDivElement,
	movesTree: $("#move-tree") as HTMLElement,
	movesContainer: $("#moves") as HTMLDivElement,
	evaluationBar: $("#evaluation-bar") as SVGElement,
	progress: $("#progress") as HTMLSpanElement,
	opening: $("#opening") as HTMLSpanElement,
	classification: $("#classification") as HTMLSpanElement,
	whiteRect: $("#white-rect") as SVGRectElement,
	blackRect: $("#black-rect") as SVGRectElement,
	whiteEvalText: $("#white-eval-text") as SVGTextElement,
	blackEvalText: $("#black-eval-text") as SVGTextElement,
	topUser: $("#top-user"),
	bottomUser: $("#bottom-user"),
	controls: {
		goBack: $("#go-back") as HTMLButtonElement,
		goForward: $("#go-forward") as HTMLButtonElement,
		flipBoard: $("#flip-board") as HTMLButtonElement,
		firstMove: $("#first-move") as HTMLButtonElement,
		lastMove: $("#last-move") as HTMLButtonElement,
		importGame: $("#import-game") as HTMLButtonElement
	},
	settings: {
		engine: $("#setting-engine") as HTMLSelectElement,
		depth: $("#setting-depth") as HTMLInputElement,
		movetime: $("#setting-movetime") as HTMLInputElement,
		threads: $("#setting-threads") as HTMLInputElement,
		multipv: $("#setting-multipv") as HTMLInputElement
	}
};

const setupSettings = () => {
	const { settings } = UI;
	settings.engine.value = data.engine as string;
	settings.depth.value = data.depth as string;
	settings.movetime.value = data.movetime as string;
	settings.threads.value = data.threads as string;
	settings.multipv.value = data.multipv as string;

	Object.entries(settings).forEach(([key, el]) => {
		el.addEventListener("change", (e) => {
			const value = (e.target as HTMLInputElement | HTMLSelectElement).value;
			(data as any)[key] = value;
			localStorage.setItem(key, value);

			if (key === "engine") {
				window.location.reload();
			}
		});
	});
};

setupSettings();

const board = new Chessboard(UI.board, {
	position: game.fen(),
	assetsUrl: "https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/",
	extensions: [{ class: RightClickAnnotator }],
});

function renderMoveTree() {
	UI.movesTree.setAttribute("class", "mt-4 p-4 rounded-md bg-white/30 max-h-100 overflow-y-auto text-left font-mono text-sm")


	const history = data.stateTree.getHistory().slice(1);
	const futureNodes: StateTreeNode[] = [];
	for (let w = data.stateTree.currentNode; w.children[0]; w = w.children[0]) {
		futureNodes.push(w.children[0]);
	}
	const allNodes = [...history, ...futureNodes];

	UI.movesContainer.innerHTML = "";
	const list = document.createElement("div");
	list.className = "grid grid-cols-[3rem_1fr_1fr] gap-y-1 text-sm";
	UI.movesContainer.appendChild(list);

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

	UI.movesContainer.querySelector(".current-move-highlight")?.scrollIntoView({ block: "center", behavior: "smooth" });
}




const totalHeight = UI.evaluationBar.clientHeight;


function navigateToNode(node: StateTreeNode) {
	data.stateTree.currentNode = node;
	game.load(node.fen);
	board.setPosition(node.fen, true);

	const historyNodes = data.stateTree.getHistory();
	data.moveHistory = historyNodes.map(n => n.move).filter(Boolean);
	data.currentIndex = data.moveHistory.length - 1;

	if (node.move) {
		AudioManager.playSound(node.move, game);
	}

	classify();
	renderMoveTree();
}

function init(pgn: string) {

	data.stateTree = new StateTree(pgn);

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

	renderUsers()
	renderMoveTree();
	updateEngine();
}


const chessEngine = new Engine(data.engine);
(window as any).engine = chessEngine;

chessEngine.setMessageHandler((message) => {
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
			UI.progress.textContent = `Analyzing: ${data.analysisIndex}/${data.stateTree.mainLineFens.length - 1}`;
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
				UI.progress.classList.add("hidden")
				alert("Analysis complete!")
				classify();
				renderMoveTree();
			}
			return;
		}
	}
});

function updateEngine() {
	if (data.stateTree.mainLineFens.length === 0) return;
	const fen = data.stateTree.mainLineFens[data.analysisIndex];
	chessEngine.analyze(fen, {
		depth: Number(data.depth),
		movetime: Number(data.movetime),
		threads: Number(data.threads),
		multipv: Number(data.multipv)
	});
}

function classify() {
	board.removeArrows();
	board.removeMarkers();

	const currentNode = data.stateTree.currentNode;

	const currentFen = game.fen();
	const evalData = data.stateTree.getEvaluation(currentFen);

	const score = evalData ? getScore(evalData) : undefined;


	UI.opening.textContent = currentNode.opening || "Starting Position";



	if (score !== undefined && evalData) {
		let evalText = "";
		if (evalData.type === "mate") {
			evalText = `M${Math.round(Math.abs(evalData.value))}`;
		} else {
			evalText = (Math.abs(evalData.value) / 100).toFixed(1);
		}

		if (data.engineState === "off") {
			const blackBarHeight = Math.max(Math.min(totalHeight / 2 - score / 3, totalHeight), 0);
			const whiteBarHeight = Math.max(Math.min(totalHeight / 2 + score / 3, totalHeight), 0);




			const orientation = board.getOrientation();


			if (orientation === "w") {
				UI.blackRect.setAttribute("y", "0");
				UI.blackRect.setAttribute("height", blackBarHeight.toString());

				UI.whiteRect.setAttribute("y", blackBarHeight.toString());
				UI.whiteRect.setAttribute("height", whiteBarHeight.toString());



				if (UI.whiteEvalText && UI.blackEvalText) {
					UI.blackEvalText.setAttribute("y", "20");
					UI.whiteEvalText.setAttribute("y", "720");

				}
			} else {
				UI.whiteRect.setAttribute("y", "0");
				UI.whiteRect.setAttribute("height", whiteBarHeight.toString());

				UI.blackRect.setAttribute("y", whiteBarHeight.toString());
				UI.blackRect.setAttribute("height", blackBarHeight.toString());
				if (UI.whiteEvalText && UI.blackEvalText) {
					UI.whiteEvalText.setAttribute("y", "20");
					UI.blackEvalText.setAttribute("y", "720");



				}
			}
			if (score > 0) {
				UI.whiteEvalText.textContent = evalText;
				UI.blackEvalText.textContent = "";
			} else if (score < 0) {
				UI.whiteEvalText.textContent = "";
				UI.blackEvalText.textContent = evalText;
			} else {
				UI.whiteEvalText.textContent = "";
				UI.blackEvalText.textContent = "";
			}

		}

		if (evalData?.bestMove && evalData.bestMove !== "(none)") {
			const from = evalData.bestMove.substring(0, 2);
			const to = evalData.bestMove.substring(2, 4);

			board.addArrow(ARROW_TYPE.info, from, to);
		}

		if (currentNode.classification && UI.classification) {


			UI.classification.textContent = `${currentNode.classification.name}`;
			UI.classification.style.color = `${currentNode.classification.color}`;
		} else if (UI.classification) {
			UI.classification.textContent = "";
		}
	} else if (data.engineState === "off") {
		if (UI.classification) UI.classification.textContent = "";
		board.removeArrows();
	}
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

function renderUsers() {
	const metadata = data.stateTree.metadata as any;
	const whitePlayer = `${metadata?.tags?.["White"]} (${metadata?.tags?.["WhiteElo"]})` || "White (?)";
	const blackPlayer = `${metadata?.tags?.["Black"]} (${metadata?.tags?.["BlackElo"]})` || "Black (?)";
	const orientation = board.getOrientation();



	if (UI.topUser && UI.bottomUser) {
		if (orientation === "w") {
			UI.topUser.textContent = blackPlayer;
			UI.bottomUser.textContent = whitePlayer;
		} else {
			UI.topUser.textContent = whitePlayer;
			UI.bottomUser.textContent = blackPlayer;
		}
	}
}

async function flipBoard() {
	await board.setOrientation(board.getOrientation() === "w" ? "b" : "w");
	renderUsers();
	classify();
}

UI.controls.goBack.addEventListener("click", goBack);
UI.controls.goForward.addEventListener("click", goForward);
UI.controls.flipBoard.addEventListener("click", flipBoard);
UI.controls.firstMove.addEventListener("click", () => {
	navigateToNode(data.stateTree.root)
})
UI.controls.lastMove.addEventListener("click", () => {
	navigateToNode(data.stateTree.lastNode)
})



UI.controls.importGame.addEventListener("click", async () => {
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
