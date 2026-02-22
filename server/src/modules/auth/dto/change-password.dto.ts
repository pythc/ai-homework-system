import { IsString, MinLength } from 'class-validator';

export class ChangePasswordRequestDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;

  @IsString()
  @MinLength(6)
  confirmPassword!: string;
}

export class ChangePasswordResponseDto {
  code!: number;
  message!: string;
}
