import moveMove from "@/data/audio/move.mp3";
import moveCheck from "@/data/audio/check.mp3";
import moveCapture from "@/data/audio/capture.mp3";
import moveCastle from "@/data/audio/castle.mp3";
import movePromote from "@/data/audio/promote.mp3";
import moveGameend from "@/data/audio/gameend.mp3";
import { Chess } from "chess.js";

const moveSounds = {
    move: moveMove,
    check: moveCheck,
    capture: moveCapture,
    castle: moveCastle,
    promote: movePromote,
    gameEnd: moveGameend
};

export class AudioManager {
    static playSound(latestMove: string, game: Chess) {
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
}
