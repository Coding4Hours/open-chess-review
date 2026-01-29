interface Evaluation {
	score: number;
	bestMove?: string;
}

class StateTreeNode {
	fen: string;
	move?: string; // The move that led to this FEN
	evaluation?: Evaluation;
	opening?: string;
	classification?: string;
	children: StateTreeNode[];
	parent: StateTreeNode | null;
	thoughts: StateTreeNode[]; // will be used for custom branching moves ("thoughts")

	constructor(
		fen: string,
		options: {
			move?: string;
			evaluation?: Evaluation;
			opening?: string;
			classification?: string;
			parent?: StateTreeNode | null;
		} = {}
	) {
		this.fen = fen;
		this.move = options.move;
		this.evaluation = options.evaluation;
		this.opening = options.opening;
		this.classification = options.classification;
		this.children = [];
		this.parent = options.parent ?? null;
		this.thoughts = [];
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

	constructor(initialFen: string) {
		this.root = new StateTreeNode(initialFen);
		this.currentNode = this.root;
		this.evaluations = new Map();
	}

	addMove(fen: string, move: string): StateTreeNode {
		const existingChild = this.currentNode.children.find((child) => child.move === move);
		if (existingChild) {
			this.currentNode = existingChild;
			return existingChild;
		}

		const newNode = new StateTreeNode(fen, { move, parent: this.currentNode });
		this.currentNode.addChild(newNode);
		this.currentNode = newNode;
		return newNode;
	}

	updateEvaluation(fen: string, evaluation: Evaluation) {
		this.evaluations.set(fen, evaluation);
		// Optionally update specific nodes if needed, but the Map is the source of truth for the position
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

	setMainLineFromCurrent() {
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
