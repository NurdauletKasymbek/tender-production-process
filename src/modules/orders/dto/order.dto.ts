import { IsString, IsOptional, IsInt, IsDateString, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { FulfillmentType } from '@prisma/client';

export class CreateOrderDto {
  @IsString() tenderNumber: string;
  @IsOptional() @IsString() goszakupId?: string;
  @IsOptional() @IsString() contractNumber?: string;
  @IsString() customerName: string;
  @IsOptional() @IsString() customerBin?: string;

  @IsString() productName: string;
  @IsOptional() @IsString() productDescription?: string;
  @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() unit?: string;
  @Type(() => Number) @IsNumber() totalAmount: number;

  @IsDateString() deadline: string;
  @IsOptional() @IsDateString() contractDate?: string;
  @IsOptional() @IsString() deliveryAddress?: string;
  @IsOptional() @IsString() deliveryContact?: string;
  @IsOptional() @IsString() notes?: string;

  /** Орындау түрі — әдепкі: PRODUCTION (цех). STOCK таңдалса, склад flow. */
  @IsOptional() @IsEnum(FulfillmentType) fulfillmentType?: FulfillmentType;
}

export class ChangeStatusDto {
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsString() responsibleId?: string;
  /**
   * Тек CONFIRMATION-дан ауысқанда мағыналы:
   *   PACKAGING-ке көшсе  → STOCK ретінде белгіленеді (склад)
   *   PRODUCTION-ге көшсе → PRODUCTION ретінде (өндіріс)
   * Қажет болса қолмен override үшін қолданылады.
   */
  @IsOptional() @IsEnum(FulfillmentType) fulfillmentType?: FulfillmentType;
}
