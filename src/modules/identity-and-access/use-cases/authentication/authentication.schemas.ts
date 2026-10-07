import { z } from "zod";

const MAX_NORMALIZED_PASSWORD_BYTES = 4096;
const PasswordSchema = z
  .string()
  .max(128)
  .refine(
    (password) =>
      Buffer.byteLength(password.normalize("NFKC"), "utf8") <=
      MAX_NORMALIZED_PASSWORD_BYTES,
    { error: "Password exceeds the normalized byte limit" },
  );

export const SignUpSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(320),
  password: PasswordSchema.min(8),
});
export type SignUpBody = z.infer<typeof SignUpSchema>;

export const SignInSchema = z.object({
  email: z.email().max(320),
  password: PasswordSchema.min(1),
});
export type SignInBody = z.infer<typeof SignInSchema>;
