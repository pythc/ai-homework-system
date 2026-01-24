import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshRequestDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class RefreshResponseDto {
  @ApiProperty()
  code!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  data!: {
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
  };
}
