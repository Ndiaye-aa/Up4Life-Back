import { IsNotEmpty, IsString, IsUrl, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PushKeysDto {
  @IsNotEmpty()
  @IsString()
  p256dh: string;

  @IsNotEmpty()
  @IsString()
  auth: string;
}

export class SubscribePushDto {
  @IsNotEmpty()
  @IsUrl({ require_tld: false })
  endpoint: string;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}

export class UnsubscribePushDto {
  @IsNotEmpty()
  @IsString()
  endpoint: string;
}
