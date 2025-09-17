import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsTimeZone,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TimezoneUtil } from '../../../common/utils/timezone.util';

@ValidatorConstraint({ name: 'isValidTimezone', async: false })
export class IsValidTimezone implements ValidatorConstraintInterface {
  validate(timezone: string) {
    return TimezoneUtil.isValidTimezone(timezone);
  }

  defaultMessage() {
    const supported = TimezoneUtil.getSupportedTimezones().join(', ');
    return `Timezone must be one of: ${supported}`;
  }
}

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
  @Validate(IsValidTimezone)
  timezone: string;
}
