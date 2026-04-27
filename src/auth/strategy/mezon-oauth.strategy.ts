// src/auth/strategy/mezon-oauth.strategy.ts
import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import axios from 'axios';
import { mezonOAuthConfig } from '../../config/oauth.config';

interface MezonUserInfo {
  sub: string;
  email: string;
  name?: string;
}

interface OAuthUser {
  accessToken: string;
  email: string;
  fullName: string;
  id: string;
  mezonId: string;
  refreshToken: string;
}

@Injectable()
export class MezonOAuthStrategy extends PassportStrategy(
  Strategy,
  'mezon',
) {
  private readonly logger = new Logger(
    MezonOAuthStrategy.name,
  );

  constructor() {
    super({
      authorizationURL:
        mezonOAuthConfig.authorizationURL,
      callbackURL: mezonOAuthConfig.callbackURL,
      clientID: mezonOAuthConfig.clientID,
      clientSecret: mezonOAuthConfig.clientSecret,
      state: true,
      tokenURL: mezonOAuthConfig.tokenURL,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
  ): Promise<OAuthUser> {
    const userInfo =
      await this.getUserInfo(accessToken);

    return {
      accessToken,
      email: userInfo.email,
      fullName: userInfo.name ?? userInfo.email,
      id: userInfo.sub,
      mezonId: userInfo.sub,
      refreshToken,
    };
  }

  private async getUserInfo(
    accessToken: string,
  ): Promise<MezonUserInfo> {
    try {
      const response =
        await axios.get<MezonUserInfo>(
          mezonOAuthConfig.userInfoURL,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
      console.log(response.data);
      return response.data;
    } catch (error) {
      this.logger.error(
        'Failed to get Mezon user info',
        error instanceof Error
          ? error.stack
          : String(error),
      );
      throw error;
    }
  }
}
