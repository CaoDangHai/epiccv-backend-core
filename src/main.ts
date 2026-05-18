import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 1. Tiền tố cho tất cả API (localhost:3000/api/...)
  app.setGlobalPrefix('api');

  // 2. Cho phép Frontend gọi API (CORS)
  app.enableCors();

  // 3. Tự động kiểm tra dữ liệu đầu vào
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 4. CẤU HÌNH PUBLIC THƯ MỤC 'uploads' ĐỂ MỞ FILE
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap().catch((err) => {
  console.error('Lỗi khi khởi động server:', err);
});