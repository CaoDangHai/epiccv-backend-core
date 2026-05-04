// src/database/data-source.ts
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load biến môi trường từ file .env
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Trỏ đường dẫn đến các file entity của bạn
  entities: ['src/database/entities/*.entity{.ts,.js}'],
  // Trỏ đường dẫn đến nơi lưu file migration
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false, // Phải tắt synchronize ở đây để dùng migration
});