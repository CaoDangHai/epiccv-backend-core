// src/config/oauth.config.ts

// Không để secret cứng trong code — dùng biến môi trường
export const mezonOAuthConfig = {
  authorizationURL:
    'https://oauth2.mezon.ai/oauth2/auth',
  callbackURL:
    process.env.MEZON_CALLBACK_URL ??
    'http://localhost:3333/auth/mezon/callback',
  clientID: process.env.MEZON_CLIENT_ID ?? '',
  clientSecret:
    process.env.MEZON_CLIENT_SECRET ?? '',
  tokenURL:
    'https://oauth2.mezon.ai/oauth2/token',
  userInfoURL: 'https://oauth2.mezon.ai/userinfo',
};
