import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AccountType, UserRole, UserStatus } from '../entities/user.entity';

export class RegisterRequestDto {
  @ApiProperty()
  @IsString()
  schoolId!: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  accountType!: AccountType;

  @ApiProperty()
  @IsString()
  account!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class RegisterResponseDto {
  @ApiProperty()
  code!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  data!: {
    userId: string;
    schoolId: string;
    accountType: string;
    account: string;
    email?: string | null;
    role: string;
    status: string;
    name?: string | null;
  };
}
