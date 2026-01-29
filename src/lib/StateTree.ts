import { parse } from '@mliebelt/pgn-parser'
import type { PgnMove, Tags } from "@mliebelt/pgn-types";
import type { ParseTree } from "@mliebelt/pgn-parser";
import { classifyMove } from "../move-classification";
import type { Square, Move } from "chess.js";

interface Evaluation {
	score: number;
	bestMove?: string;
}

interface Classification {
	name: string;
	color: string;
}

class StateTreeNode {
	fen: string;
	move?: string; // The move that led to this FEN
	moveDetails?: Move;
	evaluation?: Evaluation;
	opening?: string;
	classification?: Classification;
	children: StateTreeNode[];
	parent: StateTreeNode | null;
	thoughts: StateTreeNode[]; // will be used for custom branching moves ("thoughts")
	metadata?: ParseTree | ParseTree[] | PgnMove[] | Tags | null;

	constructor(
		fen: string,
		options: {
			move?: string;
			moveDetails?: Move;
			evaluation?: Evaluation;
			opening?: string;
			classification?: Classification;
			parent?: StateTreeNode | null;
			pgn?: string;
		} = {}
	) {
		this.fen = fen;
		this.move = options.move;
		this.moveDetails = options.moveDetails;
		this.evaluation = options.evaluation;
		this.opening = options.opening;
		this.classification = options.classification;
		this.children = [];
		this.parent = options.parent ?? null;
		this.thoughts = [];
		if (options.pgn)
			this.metadata = parse(options.pgn, { startRule: "game" });
	}

	addChild(node: StateTreeNode): StateTreeNode {
		node.parent = this;
		this.children.push(node);
		return node;
	}

	addThought(node: StateTreeNode): StateTreeNode {
		node.parent = this;
		this.thoughts.push(node);
		return node;
	}
}

class StateTree {
	root: StateTreeNode;
	currentNode: StateTreeNode;
	evaluations: Map<string, Evaluation>;
	mainLineFens: string[] = [];

	constructor(initialFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
		this.root = new StateTreeNode(initialFen);
		this.currentNode = this.root;
		this.evaluations = new Map();
	}

	addMove(fen: string, move: string, moveDetails?: Move): StateTreeNode {
		const existingChild = this.currentNode.children.find((child) => child.move === move);
		if (existingChild) {
			this.currentNode = existingChild;
			return existingChild;
		}

		const newNode = new StateTreeNode(fen, { move, moveDetails, parent: this.currentNode });
		this.currentNode.addChild(newNode);
		this.currentNode = newNode;
		return newNode;
	}

	classifyNode(node: StateTreeNode) {
		if (!node.parent || !node.moveDetails) return;

		const evalAfter = this.getEvaluation(node.fen)?.score;
		const evalBefore = this.getEvaluation(node.parent.fen)?.score;

		if (evalAfter === undefined || evalBefore === undefined) return;

		const isWhite = node.moveDetails.color === 'w';

		const classification = classifyMove(
			evalBefore,
			evalAfter,
			isWhite,
			node.parent.fen,
			node.fen,
			node.moveDetails.to as Square
		);

		node.classification = classification;
	}

	updateEvaluation(fen: string, evaluation: Evaluation) {
		this.evaluations.set(fen, evaluation);
	}

	getEvaluation(fen: string): Evaluation | undefined {
		return this.evaluations.get(fen);
	}

	getHistory(): StateTreeNode[] {
		const history: StateTreeNode[] = [];
		let node: StateTreeNode | null = this.currentNode;
		while (node) {
			history.unshift(node);
			node = node.parent;
		}
		return history;
	}

	getFenHistory(): string[] {
		return this.getHistory().map(node => node.fen);
	}

	setLine() {
		this.mainLineFens = this.getFenHistory();
	}

	navigateBack(): StateTreeNode | null {
		if (this.currentNode.parent) {
			this.currentNode = this.currentNode.parent;
			return this.currentNode;
		}
		return null;
	}

	navigateForward(move: string): StateTreeNode | null {
		const child = this.currentNode.children.find((c) => c.move === move);
		if (child) {
			this.currentNode = child;
			return child;
		}
		return null;
	}

	navigateToRoot(): StateTreeNode {
		this.currentNode = this.root;
		return this.root;
	}

}

export { StateTree, StateTreeNode };
export type { Evaluation };
