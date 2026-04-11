import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

export const MfaVerifySchema = z.object({
  mfaToken: z.string().min(1),
  totpCode: z.string().length(6).regex(/^\d{6}$/),
});

export type MfaVerifyDto = z.infer<typeof MfaVerifySchema>;

export const MfaSetupConfirmSchema = z.object({
  totpCode: z.string().length(6).regex(/^\d{6}$/),
});

export type MfaSetupConfirmDto = z.infer<typeof MfaSetupConfirmSchema>;
