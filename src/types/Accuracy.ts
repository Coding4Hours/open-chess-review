import { z } from "zod";

export const accuracySchema = z.object({
	white: z.number(),
	black: z.number(),
});

export type Accuracy = z.infer<typeof accuracySchema>;
