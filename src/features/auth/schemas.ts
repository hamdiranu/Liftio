import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name'),
    email: z.email('Enter a valid email address'),
    password: z.string().min(8, 'Use at least 8 characters').regex(/\d/, 'Include at least one number'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'Passwords don’t match', path: ['confirm'] });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const resetSchema = z.object({ email: z.email('Enter a valid email address') });
export type ResetValues = z.infer<typeof resetSchema>;
