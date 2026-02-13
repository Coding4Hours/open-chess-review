export interface EngineEvaluation {
	type: "centipawn" | "mate";
	value: number;
	bestMove?: string;
}

export interface EngineOptions {
	depth: number;
	movetime: number;
	threads: number;
	multipv: number;
}

type EngineMessageHandler = (message: string) => void;

export class Engine {
	private worker: Worker;
	private onMessageCallback: EngineMessageHandler | null = null;

	constructor() {
		this.worker = new Worker("/stockfish/stockfish.js");
		this.worker.onmessage = (event) => {
			if (this.onMessageCallback) {
				this.onMessageCallback(event.data);
			}
		};
		this.worker.postMessage("uci");
		this.worker.postMessage("isready");
	}

	setMessageHandler(handler: EngineMessageHandler) {
		this.onMessageCallback = handler;
	}

	analyze(fen: string, options: EngineOptions) {
		this.worker.postMessage("ucinewgame");
		this.worker.postMessage(`position fen ${fen}`);
		this.worker.postMessage(
			`go depth ${options.depth} movetime ${options.movetime} Threads ${options.threads} MultiPV ${options.multipv}`
		);
	}

	stop() {
		this.worker.postMessage("stop");
	}

	terminate() {
		this.worker.terminate();
	}
}
