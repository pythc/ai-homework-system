import { ApiProperty } from '@nestjs/swagger';

export class MeResponseDto {
  @ApiProperty()
  code!: number;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  data!: {
    userId: string;
    role: string;
    schoolId: string;
    accountType: string;
    account: string;
    name?: string | null;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  };
}
