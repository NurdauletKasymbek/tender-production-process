import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Telegram Mini App арқылы кіру' })
  async telegramLogin(@Body('initData') initData: string) {
    return this.auth.loginWithTelegram(initData);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Ағымдағы қолданушы' })
  async me(@Req() req: any) {
    return this.auth.getMe(req.user.id);
  }
}
