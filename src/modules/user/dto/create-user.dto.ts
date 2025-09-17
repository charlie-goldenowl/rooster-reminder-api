import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsTimeZone,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'User first name',
    example: 'John',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'User birthday in YYYY-MM-DD format',
    example: '1990-05-15',
  })
  @IsDateString()
  birthday: string;

  @ApiProperty({
    description: 'User timezone (IANA timezone)',
    example: 'America/New_York',
  })
  @IsString()
  @IsTimeZone()
  timezone: string;
}
