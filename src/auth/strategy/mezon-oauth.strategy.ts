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
  username: string;
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
    const config = {
      authorizationURL:
        mezonOAuthConfig.authorizationURL,
      callbackURL: mezonOAuthConfig.callbackURL,
      clientID: mezonOAuthConfig.clientID,
      clientSecret: mezonOAuthConfig.clientSecret,
      state: true,
      tokenURL: mezonOAuthConfig.tokenURL,
    };

    console.log('=== MEZON OAUTH CONFIG ===');
    console.log(config); // xem callbackURL thực tế là gì

    super(config);
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
      fullName: userInfo.username,
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

      // {
      //   aud: [ '2048697583102070784' ],
      //   auth_time: 1776944601,
      //   avatar: 'https://profile.mezon.ai/2038885936216936448/2038886435850817536.jpg',
      //   display_name: 'MCS01_hieu.vovan',
      //   email: 'vobahoaan@gmail.com',
      //   iat: 1777284289,
      //   iss: 'https://oauth2.mezon.ai',
      //   mezon_id: 'AT6XVXR4sDDwiVWxrziw7LR22hZ3sFHoZVQDJJKHqK9L',
      //   rat: 1777284289,
      //   sub: 'AT6XVXR4sDDwiVWxrziw7LR22hZ3sFHoZVQDJJKHqK9L',
      //   user_id: '2038885936216936448',
      //   username: 'vobahoaan'
      // }

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
