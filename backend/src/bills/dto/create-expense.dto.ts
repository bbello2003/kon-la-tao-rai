import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

enum ExpenseSplitMode {
  EQUAL = 'EQUAL',
  CUSTOM = 'CUSTOM',
}

enum FeeSplitMode {
  EQUAL = 'EQUAL',
  PROPORTIONAL = 'PROPORTIONAL',
}

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @IsInt()
  @Min(1)
  amountSatang!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsString()
  @MinLength(1)
  paidByParticipantId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds!: string[];

  // Main expense split mode
  @IsOptional()
  @IsEnum(ExpenseSplitMode)
  splitMode?: ExpenseSplitMode;

  // Custom amount for each participant.
  // Example:
  // {
  //   "participant-a": 200000,
  //   "participant-b": 100000,
  //   "participant-c": null
  // }
  @IsOptional()
  @IsObject()
  participantAmounts?: Record<string, number | null>;

  // Service Charge
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceChargePercent?: number;

  @IsOptional()
  @IsEnum(FeeSplitMode)
  serviceChargeMode?: FeeSplitMode;

  // VAT
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  vatPercent?: number;

  @IsOptional()
  @IsEnum(FeeSplitMode)
  vatMode?: FeeSplitMode;
}
