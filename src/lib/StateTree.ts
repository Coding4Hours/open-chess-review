import { parse } from '@mliebelt/pgn-parser'
import type { PgnMove, Tags } from "@mliebelt/pgn-types";
import type { ParseTree } from "@mliebelt/pgn-parser";
import { classifyMove } from "../move-classification";
import { Chess, type Square, type Move } from "chess.js";
import openingsData from "../data/openings.json";
import type { Evaluation } from "../types/Evaluation";
import type { Classification } from "../types/Classification";



const openings = openingsData as Record<string, string>;

class StateTreeNode {
	fen: string;
	move?: string; // The move that led to this FEN
	moveDetails?: Move;
	evaluation?: Evaluation;
	opening?: string;
	classification?: Classification;
	accuracy?: number;
	winrate?: number;
	children: StateTreeNode[];
	parent: StateTreeNode | null;
	thoughts: StateTreeNode[]; // will be used for custom branching moves ("thoughts")
	pgn?: string;

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
		this.pgn = options.pgn;
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
	lastNode: StateTreeNode;
	currentNode: StateTreeNode;
	evaluations: Map<string, Evaluation>;
	fenToNode: Map<string, StateTreeNode>;
	mainLineFens: string[] = [];

	metadata?: ParseTree | ParseTree[] | PgnMove[] | Tags | null;

	constructor(pgn?: string) {
		this.evaluations = new Map();
		this.fenToNode = new Map();
		let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
		let parsed: ParseTree | undefined;

		if (pgn) {
			this.metadata = parse(pgn, { startRule: "game" });
			parsed = (Array.isArray(this.metadata) ? this.metadata[0] : this.metadata) as ParseTree;
			fen = (parsed?.tags as any)?.FEN || fen;
		}

		this.root = this.currentNode = this.lastNode = new StateTreeNode(fen, {
			opening: openings[fen.split(" ")[0]] || "Starting Position",
			pgn
		});

		this.fenToNode.set(fen, this.root);

		if (parsed?.moves)
			this.loadMoves(parsed.moves, this.root);
	}


	loadMoves(pgnMoves: PgnMove[], startNode: StateTreeNode): StateTreeNode {
		let currentChess = new Chess(startNode.fen);
		let parentNode = startNode;
		let lastMainLineNode = startNode;

		for (const pgnMove of pgnMoves) {
			this.currentNode = parentNode;
			try {
				const moveResult = currentChess.move(pgnMove.notation.notation);
				const newNode = this.addMove(currentChess.fen(), pgnMove.notation.notation, moveResult);
				lastMainLineNode = newNode;

				if (pgnMove.variations) {
					for (const variation of pgnMove.variations) {
						this.loadMoves(variation, parentNode);
					}
				}
				parentNode = newNode;
			} catch (e) {
				break;
			}
		}
		this.currentNode = lastMainLineNode;
		return lastMainLineNode;
	}

	addMove(fen: string, move: string, moveDetails?: Move): StateTreeNode {
		const existingChild = this.currentNode.children.find((child) => child.move === move);
		if (existingChild) {
			this.currentNode = existingChild;
			return existingChild;
		}

		const fenKey = fen.split(" ")[0];
		const opening = openings[fenKey] || this.currentNode.opening;
		const newNode = new StateTreeNode(fen, {
			move,
			moveDetails,
			parent: this.currentNode,
			opening
		});
		this.currentNode.addChild(newNode);
		this.currentNode = newNode;
		this.lastNode = newNode;
		this.fenToNode.set(fen, newNode);
		this.classifyNode(newNode);
		return newNode;
	}

	classifyNode(node: StateTreeNode) {
		if (!node.parent || !node.moveDetails) return;

		const evalAfterData = this.getEvaluation(node.fen);
		const evalBeforeData = this.getEvaluation(node.parent.fen);

		if (evalAfterData === undefined || evalBeforeData === undefined) return;

		const isWhite = node.moveDetails.color === 'w';

		const classification = classifyMove(
			evalBeforeData,
			evalAfterData,
			isWhite,
			node.parent.fen,
			node.fen,
			node.moveDetails.to as Square
		);

		node.classification = classification;
	}

	updateEvaluation(fen: string, evaluation: Evaluation) {
		this.evaluations.set(fen, evaluation);
		const node = this.fenToNode.get(fen);
		if (node)
			node.evaluation = evaluation;
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
