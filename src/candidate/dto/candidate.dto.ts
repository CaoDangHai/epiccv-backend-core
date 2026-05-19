export class UpdateProfileDto {
  fullName?: string;
  phone?: string;
  location?: string;
  avatarUrl?: string;
}

export class ChangePasswordDto {
  oldPassword!: string;
  newPassword!: string;
}