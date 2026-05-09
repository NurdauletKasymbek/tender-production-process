import {
  IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StockMovementType } from '@prisma/client';

export class CreateStockItemDto {
  @IsString() name: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() unit?: string;

  /** Бастапқы қалдық — жасалғанда IN қозғалысы ретінде жазылады. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) initialQuantity?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minQuantity?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateStockItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minQuantity?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * Қозғалыс жазу:
 *   IN     — quantity-ге қосады (приход)
 *   OUT    — quantity-ден алады (теріс қалдыққа жол берілмейді)
 *   ADJUST — qantity-ні нақты мәнге орнатады (инвентаризация)
 */
export class CreateStockMovementDto {
  @IsEnum(StockMovementType) type: StockMovementType;

  /**
   * IN/OUT үшін — өзгеріс мөлшері (әрдайым оң).
   * ADJUST үшін — жаңа қалдық мәні.
   */
  @Type(() => Number) @IsNumber() @Min(0) quantity: number;

  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsUUID() orderId?: string;
}
