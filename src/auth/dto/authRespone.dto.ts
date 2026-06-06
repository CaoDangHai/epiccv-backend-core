export class AuthResponseDto {
  accessToken!: string;
  user!: {
    id: string;
    email: string | null;
    fullName: string;
    avatarUrl: string | null;
    provider: string;
    isVerified: boolean;
  };
}
