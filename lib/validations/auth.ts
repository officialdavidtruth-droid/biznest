import { z } from "zod";

// Login accepts two identifier shapes in the same field:
//   1. A normal email address (owners, and staff who log in with their own
//      email like anyone else).
//   2. "<Position>@<store-slug>" (e.g. "Cashier@velox-space") — the
//      position-based login staff are given instead of their email. See
//      the staff-login branch in lib/auth.ts authorize() for how this is
//      resolved to an actual account.
// The second shape isn't a valid email (store slugs are bare words with no
// TLD), so a plain z.string().email() would reject it outright.
const STAFF_LOGIN_PATTERN = /^[^@]+@[a-z0-9-]+$/i;

export const loginSchema = z.object({
  email: z
    .string()
    .min(3, "Enter your email, or Position@store")
    .refine(
      (val) => z.string().email().safeParse(val).success || STAFF_LOGIN_PATTERN.test(val),
      { message: "Enter a valid email, or Position@store (e.g. Cashier@velox-space)" }
    ),
  password: z.string().min(8),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  storeSlug: z.string().min(1).optional(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    storeSlug: z.string().min(1).optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
