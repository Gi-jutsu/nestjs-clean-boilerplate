import { z } from "zod";

export const SignUpSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(320),
  password: z.string().min(8).max(128),
});
export type SignUpBody = z.infer<typeof SignUpSchema>;

export const SignInSchema = z.object({
  email: z.email().max(320),
  password: z.string().min(1).max(128),
});
export type SignInBody = z.infer<typeof SignInSchema>;
