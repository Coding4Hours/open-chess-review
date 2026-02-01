import { z } from "zod";

export const classificationSchema = z.object({
	name: z.string(),
	color: z.string(),
});

export type Classification = z.infer<typeof classificationSchema>;

export const classificationsSchema = z.object({
	excellent: classificationSchema,
	good: classificationSchema,
	best: classificationSchema,
	inaccuracy: classificationSchema,
	mistake: classificationSchema,
	blunder: classificationSchema,
	brilliant: classificationSchema,
	great: classificationSchema,
	miss: classificationSchema,
});

export type Classifications = z.infer<typeof classificationsSchema>;