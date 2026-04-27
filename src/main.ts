// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import session from 'express-session';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    session({
      secret:
        process.env.SESSION_SECRET ??
        'dev-secret-change-in-prod',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 60000, // 1 phút là đủ, chỉ cần tồn tại trong lúc OAuth flow
        secure:
          process.env.NODE_ENV === 'production',
      },
    }),
  );

  await app.listen(3333);
}

bootstrap();
