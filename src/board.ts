import { INPUT_EVENT_TYPE, Chessboard } from "cm-chessboard/src/Chessboard.js";
import { RightClickAnnotator } from "cm-chessboard/src/extensions/right-click-annotator/RightClickAnnotator.js";
import { ARROW_TYPE } from "cm-chessboard/src/extensions/arrows/Arrows.js";

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
  depth: localStorage.getItem("depth") || 20,
  movetime: localStorage.getItem("movetime") || 100,
  threads: localStorage.getItem("threads") || 11,
  fenHistory: [] as string[],
  positionEvaluations: new Map(), // FEN -> white-relative score (centipawns)
  engineState: "analyzing" as "analyzing" | "going_back",
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
  extensions: [{ class: RightClickAnnotator }],
});
const $ = (query: string) => document.querySelector(query);

const engine = new Worker("/stockfish/stockfish.js");

engine.onmessage = (event) => {
  const message = event.data;
  if (typeof message !== "string") return;

  const currentFen =
    data.engineState === "going_back"
      ? data.fenHistory[data.currentIndex]
      : game.fen();

  if (message.startsWith("info") && message.includes("score")) {
    const cpMatch = message.match(/score cp (-?\d+)/);
    const mateMatch = message.match(/score mate (-?\d+)/);
    const depthMatch = message.match(/depth (\d+)/);
    const evalDepth = document.getElementById("eval-depth");

    if (depthMatch && evalDepth && data.engineState === "analyzing")
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

    if (data.engineState === "analyzing") {
      const evalText = (Math.abs(whiteScore) / 100).toFixed(2);
      const evalDisplay = document.getElementById("eval");
      const sign = whiteScore >= 0 ? "+" : "-";
      const evaluation = `${sign}${evalText}`;
      if (evalDisplay) evalDisplay.innerText = `Eval: ${evaluation}`;
    }

    data.positionEvaluations.set(currentFen, whiteScore);
  }

  if (message.startsWith("bestmove")) {
    if (data.engineState === "going_back") {
      data.engineState = "analyzing";
      updateEngine();
      return;
    }

    const fenAfter = game.fen();
    const evalAfter = data.positionEvaluations.get(fenAfter);

    if (evalAfter !== undefined) {
      const ply = data.currentIndex + 1;
      if (ply > 0) {
        const fenBefore = data.fenHistory[ply - 1];
        const evalBefore = data.positionEvaluations.get(fenBefore);

        if (evalBefore !== undefined) {
          const isWhiteMove = game.turn() === "b";
          const classification = classifyMove(
            evalBefore,
            evalAfter,
            isWhiteMove,
          );
          $("#classification").textContent = `${classification.name}`;
          $("#classification").style.color = `${classification.color}`;
        } else {
          data.engineState = "going_back";
          engine.postMessage("ucinewgame");
          engine.postMessage(`position fen ${fenBefore}`);
          engine.postMessage(
            `go depth ${data.depth} movetime ${data.movetime} Threads ${data.threads}`,
          );
          return;
        }
      }
    }

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
  data.engineState = "analyzing";
  engine.postMessage("ucinewgame");
  engine.postMessage(
    `position fen ${game.fen()} moves ${data.moveHistory.join(" ")}`,
  );
  engine.postMessage(
    `go depth ${data.depth} movetime ${data.movetime} Threads ${data.threads}`,
  );
}

function goBack() {
  if (data.currentIndex > 0) {
    game.undo();
    data.currentIndex--;
    board.setPosition(game.fen(), true);
    updateEngine();
  }
}

function goForward() {
  if (data.currentIndex < data.moveHistory.length - 1) {
    data.currentIndex++;
    game.move(data.moveHistory[data.currentIndex]);
    board.setPosition(game.fen(), true);
    updateEngine();
  }
}

$("#go-back")?.addEventListener("click", goBack);
$("#go-forward")?.addEventListener("click", goForward);

window.toggleOrientation = () => {
  board.setOrientation(board.getOrientation() === "w" ? "b" : "w");
};

engine.postMessage("uci");
engine.postMessage("isready");
updateEngine();
