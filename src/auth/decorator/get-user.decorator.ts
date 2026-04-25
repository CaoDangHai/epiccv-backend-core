import {
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

// 1. Dạy cho TypeScript biết: Có một loại Request chứa sẵn dữ liệu user bên trong
interface AuthRequest extends Request {
  user: Record<string, unknown>; // user là một Object có key là string, giá trị chưa biết
}

export const GetUser = createParamDecorator(
  (
    data: string | undefined,
    ctx: ExecutionContext,
  ) => {
    // 2. Ép cái Request lấy ra phải tuân theo cái khuôn AuthRequest ở trên
    const request = ctx
      .switchToHttp()
      .getRequest<AuthRequest>();

    if (data) {
      // Vì user là Record<string, unknown>, nên ta lấy data ra hoàn toàn hợp lệ
      return request.user[data];
    }

    return request.user;
  },
);
