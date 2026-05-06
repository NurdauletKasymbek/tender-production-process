import { IsString, IsOptional, IsInt, IsDateString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
}

export class ChangeStatusDto {
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsString() responsibleId?: string;
}
