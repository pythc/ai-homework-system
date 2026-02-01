import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AccountType } from '../entities/user.entity';

export class LoginRequestDto {
  @ApiProperty()
  @IsString()
  schoolId!: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  accountType!: AccountType;

  @ApiProperty()
  @IsString()
  account!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ description: 'Client device identifier.' })
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class LoginResponseDto {
  @ApiProperty()
  code!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  data!: {
    token: {
      accessToken: string;
      refreshToken: string;
      tokenType: 'Bearer';
      expiresIn: number;
    };
    user: {
      userId: string;
      role: string;
      schoolId: string;
      accountType: string;
      account: string;
      name?: string | null;
      createdAt?: string | Date;
      updatedAt?: string | Date;
    };
  };
}
