// src/config/oauth.config.ts
export const mezonOAuthConfig = {
  clientID:
    process.env.MEZON_CLIENT_ID ||
    '1840672953654579200',
  clientSecret:
    process.env.MEZON_CLIENT_SECRET ||
    '9dZkohGU!OU*.EZt|LWUbb5>z4*u|L2a',
  callbackURL:
    process.env.MEZON_CALLBACK_URL ||
    'http://localhost:3333/auth/mezon/callback',
  authorizationURL:
    'https://oauth2.mezon.ai/oauth2/auth',
  tokenURL:
    'https://oauth2.mezon.ai/oauth2/token',
  userInfoURL: 'https://oauth2.mezon.ai/userinfo',
};
