import { ApiProperty } from '@nestjs/swagger';

export class CJConfig {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  apiKey: string;

  @ApiProperty()
  tier: string;

  @ApiProperty({ required: false })
  platformToken?: string;

  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ required: false })
  accessToken?: string;

  @ApiProperty({ required: false })
  refreshToken?: string;

  @ApiProperty({ required: false })
  tokenExpiry?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

