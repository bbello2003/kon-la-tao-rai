import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum PaymentMethodDto {
  PROMPTPAY = 'PROMPTPAY',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
}

export class CreatePaymentInfoDto {
  @IsEnum(PaymentMethodDto)
  method!: PaymentMethodDto;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  promptPayId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  accountName?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(50)
  accountNumber?: string;

  @IsString()
  @MinLength(1)
  participantId!: string;
}
