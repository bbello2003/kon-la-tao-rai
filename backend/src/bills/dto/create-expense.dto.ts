import {
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  description!: string;

  @IsInt()
  @Min(1)
  amountSatang!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  category!: string;

  @IsString()
  @MinLength(1)
  paidByParticipantId!: string;
}