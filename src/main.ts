import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Tiền tố cho tất cả API (localhost:3000/api/...)
  app.setGlobalPrefix('api');

  // 2. Cho phép Frontend gọi API (CORS)
  app.enableCors();

  // 3. Tự động kiểm tra dữ liệu đầu vào (Mới thêm)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap().catch((err) => {
  console.error('Lỗi khi khởi động server:', err);
});
