import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
}
