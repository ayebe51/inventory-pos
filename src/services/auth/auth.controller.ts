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
import { LoginSchema, RefreshTokenSchema } from './dto/login.dto';
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
}
