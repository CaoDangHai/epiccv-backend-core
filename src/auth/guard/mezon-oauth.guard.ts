// src/auth/guard/mezon-oauth.guard.ts
import {
  Injectable,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MezonOAuthGuard extends AuthGuard(
  'mezon',
) {
  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const activate = (await super.canActivate(
      context,
    )) as boolean;

    if (activate) {
      const request = context
        .switchToHttp()
        .getRequest<{
          user?: Record<string, unknown>;
          candidate?: Record<string, unknown>;
        }>();

      if (request.user) {
        request.candidate = request.user;
      }
    }

    return activate;
  }
}
