import { INPUT_EVENT_TYPE, Chessboard } from "cm-chessboard/src/Chessboard.js";
import { RightClickAnnotator } from "cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";
import { ARROW_TYPE } from "cm-chessboard/src/extensions/arrows/Arrows.js";

import "cm-chessboard/assets/chessboard.css";
import "cm-chessboard/assets/extensions/markers/markers.css";
import "cm-chessboard/assets/extensions/arrows/arrows.css";

import { Chess } from "chess.js";

const game = new Chess();

const pgn = prompt("give pgn pwease") || localStorage.getItem("pgn");
localStorage.setItem("pgn", pgn);
game.loadPgn(pgn);

// will be used for move categorization
let data = {
  lastEval: "Calculating...",
  totalMoves: game.history().length,
  gameHistory: game.history(),
  currentIndex: game.history().length - 1,
  depth: localStorage.getItem("depth") || 20,
  movetime: localStorage.getItem("movetime") || 1000,
  threads: localStorage.getItem("threads") || 11,
};

const board = new Chessboard(document.getElementById("board"), {
  position: game.fen(),
  assetsUrl: "https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/",
  extensions: [{ class: RightClickAnnotator }],
});
const positionEvaluations = new Map(); // FEN -> white-relative score (centipawns)
const $ = (query: string) => document.querySelector(query);

const engine = new Worker("/stockfish/stockfish.js");

engine.onmessage = (event) => {
  const message = event.data;
  if (typeof message !== "string") return;

  if (message.startsWith("info") && message.includes("score")) {
    const cpMatch = message.match(/score cp (-?\d+)/);
    const mateMatch = message.match(/score mate (-?\d+)/);
    const depthMatch = message.match(/depth (\d+)/);
    const evalDepth = document.getElementById("eval-depth");

    if (depthMatch && evalDepth) evalDepth.innerText = depthMatch[1];

    let score = 0;
    if (cpMatch) {
      score = parseInt(cpMatch[1]);
    } else if (mateMatch) {
      const mateIn = parseInt(mateMatch[1]);
      score = mateIn > 0 ? 10000 - mateIn : -10000 - mateIn;
    }

    const fen = game.fen();
    const sideToMove = fen.split(" ")[1];
    const whiteScore = sideToMove === "w" ? score : -score;

    const evalText = (Math.abs(whiteScore) / 100).toFixed(2);
    const evalDisplay = document.getElementById("eval-display");
    const sign = whiteScore >= 0 ? "+" : "-";
    const evaluation = `${sign}${evalText}`;
    data.lastEval = evaluation;
    if (evalDisplay) evalDisplay.innerText = `Eval: ${evaluation}`;

    positionEvaluations.set(fen, whiteScore);
  }

  if (message.startsWith("bestmove")) {
    const bestMove = message.split(" ")[1];
    if (bestMove && bestMove.length >= 4) {
      const from = bestMove.substring(0, 2);
      const to = bestMove.substring(2, 4);

      board.removeArrows();

      board.addArrow(ARROW_TYPE.info, from, to);
    }
  }
};

function updateEngine() {
  engine.postMessage("ucinewgame");
  engine.postMessage(
    `position fen ${game.fen()} moves ${data.gameHistory.join(" ")}`,
  );
  engine.postMessage(
    `go depth ${data.depth} movetime ${data.movetime} Threads ${data.threads}`,
  );
}

function goBack() {
  if (data.currentIndex >= 0) {
    game.undo();
    data.currentIndex--;
    board.setPosition(game.fen());
    updateEngine();
  }
}

function goForward() {
  if (data.currentIndex < data.gameHistory.length - 1) {
    data.currentIndex++;
    game.move(data.gameHistory[data.currentIndex]);
    board.setPosition(game.fen());
    updateEngine();
  } else {
    console.log("No more moves to redo.");
  }
}

$("#go-back")?.addEventListener("click", goBack);
$("#go-forward")?.addEventListener("click", goForward);

engine.postMessage("uci");
engine.postMessage("isready");
updateEngine();
