import { z } from "zod";

export const evaluationSchema = z.object({
	type: z.enum(["centipawn", "mate"]),
	value: z.number(),
	bestMove: z.string().optional()
});

export type Evaluation = z.infer<typeof evaluationSchema>;
