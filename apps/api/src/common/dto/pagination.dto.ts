import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export type SortOrder = 'ASC' | 'DESC';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  pageSize = 50;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: string;
}

export function paginateMeta(page: number, pageSize: number, total: number) {
  return { page, pageSize, total };
}

export function normalizeSortOrder(
  value: string | undefined,
  fallback: SortOrder = 'ASC',
): SortOrder {
  if (!value) return fallback;
  const upper = value.toUpperCase();
  return upper === 'DESC' ? 'DESC' : upper === 'ASC' ? 'ASC' : fallback;
}

/** Safe TypeORM `order` object from query + allow-list */
export function resolveOrder(
  query: Pick<PaginationDto, 'sortBy' | 'sortOrder'>,
  allowed: readonly string[],
  fallback: { sortBy: string; sortOrder: SortOrder },
): Record<string, SortOrder> {
  const sortBy =
    query.sortBy && allowed.includes(query.sortBy)
      ? query.sortBy
      : fallback.sortBy;
  const sortOrder = normalizeSortOrder(query.sortOrder, fallback.sortOrder);
  return { [sortBy]: sortOrder };
}

export function resolveSortPair(
  query: Pick<PaginationDto, 'sortBy' | 'sortOrder'>,
  allowed: readonly string[],
  fallback: { sortBy: string; sortOrder: SortOrder },
): { sortBy: string; sortOrder: SortOrder } {
  const order = resolveOrder(query, allowed, fallback);
  const sortBy = Object.keys(order)[0];
  return { sortBy, sortOrder: order[sortBy] };
}
