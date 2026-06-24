import {
  IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, Min, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { InquiryStatus } from '@prisma/client';

export class CreateProductDto {
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() unit?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() sku?: string;

  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsUUID() stockItemId?: string;
}

export class UpdateProductDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number | null;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsString() stockItemId?: string | null;
}

/** Суреттерді қайта реттеу — id тізімі жаңа ретпен. */
export class ReorderImagesDto {
  @IsArray() @IsUUID('all', { each: true }) imageIds: string[];
}

/** Публичный сұраныс — логинсіз клиент толтырады. */
export class CreateInquiryDto {
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(40) phone: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
  @IsOptional() @IsUUID() productId?: string;
}

/** Сұраныс күйін/ескертпесін жаңарту (ішкі). */
export class UpdateInquiryDto {
  @IsOptional() @IsEnum(InquiryStatus) status?: InquiryStatus;
  @IsOptional() @IsString() notes?: string;
}
