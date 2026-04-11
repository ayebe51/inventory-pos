import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import {
  LoginSchema,
  RefreshTokenSchema,
  ChangePasswordSchema,
  MfaVerifySchema,
  MfaSetupConfirmSchema,
} from './dto/login.dto';
import { successResponse } from '../../common/types/api-response.type';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown) {
    const dto = LoginSchema.parse(body);
    const result = await this.authService.login(dto.email, dto.password);
    return successResponse(result, 'Login successful');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: unknown) {
    const dto = RefreshTokenSchema.parse(body);
    const tokens = await this.authService.refreshTokens(dto.refreshToken);
    return successResponse(tokens, 'Tokens refreshed');
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: { user: { userId: string; jti: string } }) {
    await this.authService.logout(req.user.userId, req.user.jti);
    return successResponse(null, 'Logged out successfully');
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req: { user: { userId: string } },
    @Body() body: unknown,
  ) {
    const dto = ChangePasswordSchema.parse(body);
    await this.authService.changePassword(req.user.userId, dto.currentPassword, dto.newPassword);
    return successResponse(null, 'Password changed. All sessions have been invalidated.');
  }

  /**
   * POST /api/v1/auth/mfa/setup
   * Initiate MFA enrollment. Returns TOTP secret + otpauth URL for QR code.
   * Requires a valid mfaToken issued during login (purpose: 'setup').
   */
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  async mfaSetup(@Body() body: unknown) {
    const { mfaToken } = MfaVerifySchema.pick({ mfaToken: true }).parse(body);
    const result = await this.authService.setupMfa(mfaToken);
    return successResponse(result, 'Scan the QR code with your authenticator app, then confirm with a TOTP code');
  }

  /**
   * POST /api/v1/auth/mfa/setup/confirm
   * Confirm MFA enrollment by verifying the first TOTP code.
   * On success, returns full JWT tokens.
   */
  @Post('mfa/setup/confirm')
  @HttpCode(HttpStatus.OK)
  async mfaSetupConfirm(@Body() body: unknown) {
    const { mfaToken, totpCode } = MfaVerifySchema.parse(body);
    const result = await this.authService.confirmMfaSetup(mfaToken, totpCode);
    return successResponse(result, 'MFA setup complete');
  }

  /**
   * POST /api/v1/auth/mfa/verify
   * Verify TOTP code for users with MFA already enrolled.
   * On success, returns full JWT tokens.
   */
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async mfaVerify(@Body() body: unknown) {
    const { mfaToken, totpCode } = MfaVerifySchema.parse(body);
    const result = await this.authService.verifyMfa(mfaToken, totpCode);
    return successResponse(result, 'MFA verified');
  }
}
