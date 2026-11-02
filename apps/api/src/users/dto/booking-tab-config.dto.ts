import { IsArray, IsOptional, IsString } from 'class-validator';

export class BookingTabConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  account?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cash?: string[];
}

export function normalizeBookingTabConfigDto(
  raw?: BookingTabConfigDto | null,
): { account: string[]; cash: string[] } | null {
  if (!raw) return null;
  const account = Array.isArray(raw.account)
    ? raw.account.filter((k) => typeof k === 'string' && k.trim())
    : [];
  const cash = Array.isArray(raw.cash)
    ? raw.cash.filter((k) => typeof k === 'string' && k.trim())
    : [];
  return { account, cash };
}
