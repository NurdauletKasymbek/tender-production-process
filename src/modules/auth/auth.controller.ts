import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsString, MinLength } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';

class LoginDto {
  @IsString() username: string;
  @IsString() @MinLength(1) password: string;
}

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Telegram Mini App арқылы кіру' })
  async telegramLogin(@Body('initData') initData: string) {
    return this.auth.loginWithTelegram(initData);
  }

  @Post('login')
  @ApiOperation({ summary: 'Username + password арқылы кіру' })
  async passwordLogin(@Body() dto: LoginDto) {
    return this.auth.loginWithPassword(dto.username, dto.password);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Ағымдағы қолданушы' })
  async me(@Req() req: any) {
    return this.auth.getMe(req.user.id);
  }
}
