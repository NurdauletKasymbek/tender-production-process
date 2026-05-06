import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  // Swagger құжаттамасы
  const config = new DocumentBuilder()
    .setTitle('Tender Production API')
    .setDescription('Goszakup тендерлер мен өндірісті басқару жүйесі')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Сервер іске қосылды: http://localhost:${port}`);
  console.log(`📚 API құжаттамасы: http://localhost:${port}/api/docs`);
}
bootstrap();
