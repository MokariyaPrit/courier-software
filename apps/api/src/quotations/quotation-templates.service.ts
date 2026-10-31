import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RateTemplateKind, Role } from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  paginateMeta,
  PaginationDto,
  resolveSortPair,
} from '../common/dto/pagination.dto';
import { QuotationRateRow } from '../entities/quotation-rate-row.entity';
import { QuotationRateTemplate } from '../entities/quotation-rate-template.entity';
import { RateColumnsService } from '../rate-columns/rate-columns.service';
import {
  defaultRateMatrix,
  syncMatrixToGeography,
} from './default-rate-bands';
import {
  CreateQuotationTemplateDto,
  RateColumnDto,
  RateRowDto,
  RateSectionDto,
  UpdateQuotationTemplateDto,
} from './dto/quotation-template.dto';
import type { RateColumnDef } from './rate-matrix.types';

const TEMPLATE_SORT = ['name', 'createdAt', 'updatedAt'] as const;

@Injectable()
export class QuotationTemplatesService {
  constructor(
    @InjectRepository(QuotationRateTemplate)
    private readonly templatesRepo: Repository<QuotationRateTemplate>,
    @InjectRepository(QuotationRateRow)
    private readonly rowsRepo: Repository<QuotationRateRow>,
    @Inject(forwardRef(() => RateColumnsService))
    private readonly rateColumns: RateColumnsService,
  ) {}

  private sanitize(template: QuotationRateTemplate) {
    if (template.createdBy) {
      delete (template.createdBy as { passwordHash?: string }).passwordHash;
    }
    return template;
  }

  private assertOwner(template: QuotationRateTemplate, user: AuthUser) {
    if (user.role !== Role.ADMIN && template.createdById !== user.id) {
      throw new ForbiddenException('You can only access your own templates');
    }
  }

  private normalizeRates(rates: Record<string, number | string> | undefined) {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(rates ?? {})) {
      if (value === '' || value === null || value === undefined) {
        out[key] = '';
      } else {
        out[key] = String(value);
      }
    }
    return out;
  }

  private mapColumns(cols: RateColumnDto[] | undefined) {
    return (cols ?? []).map((c, i) => ({
      id: c.id.trim(),
      label: c.label.trim(),
      sortOrder: c.sortOrder ?? i,
    }));
  }

  private mapSections(sections: RateSectionDto[] | undefined) {
    return (sections ?? []).map((s, i) => ({
      id: s.id.trim(),
      label: s.label.trim(),
      sortOrder: s.sortOrder ?? i,
    }));
  }

  private mapRow(dto: RateRowDto, templateId: string, index: number) {
    return this.rowsRepo.create({
      templateId,
      sectionId: dto.sectionId.trim(),
      weightLabel: dto.weightLabel.trim(),
      weightGrams: dto.weightGrams ?? null,
      isAdditional: dto.isAdditional ?? false,
      sortOrder: dto.sortOrder ?? index,
      rates: this.normalizeRates(dto.rates),
    });
  }

  private async geographyColumnsFor(userId: string): Promise<RateColumnDef[]> {
    const { columns } = await this.rateColumns.rateGeographyForUser(userId);
    return columns.map((c) => ({
      id: c.id,
      label: c.label,
      sortOrder: c.sortOrder,
    }));
  }

  /** Align template columns with user's Centers; persist for cash. */
  async applyGeographyColumns(
    template: QuotationRateTemplate,
    userId: string,
    mode: 'cash' | 'quotation',
  ) {
    const geo = await this.geographyColumnsFor(userId);
    const synced = syncMatrixToGeography(
      {
        columns: template.columns ?? [],
        rows: (template.rows ?? []).map((r) => ({
          ...r,
          rates: r.rates ?? {},
        })),
      },
      geo,
      mode,
    );

    const colsChanged =
      JSON.stringify((template.columns ?? []).map((c) => c.id)) !==
      JSON.stringify(synced.columns.map((c) => c.id));
    const labelsChanged =
      JSON.stringify((template.columns ?? []).map((c) => c.label)) !==
      JSON.stringify(synced.columns.map((c) => c.label));

    if (!colsChanged && !labelsChanged) {
      return template;
    }

    template.columns = synced.columns;
    await this.templatesRepo.save(template);

    if (template.rows?.length) {
      for (let i = 0; i < template.rows.length; i++) {
        const row = template.rows[i];
        const nextRates = (synced.rows[i]?.rates ?? {}) as Record<
          string,
          string | number
        >;
        row.rates = this.normalizeRates(nextRates);
      }
      await this.rowsRepo.save(template.rows);
    }

    return template;
  }

  /** Rebuild cash template columns after Centers selection changes. */
  async syncCashColumnsForUser(user: AuthUser) {
    const existing = await this.templatesRepo.findOne({
      where: {
        createdById: user.id,
        kind: RateTemplateKind.CASH,
      },
      relations: { rows: true },
    });
    if (!existing) return null;
    await this.applyGeographyColumns(existing, user.id, 'cash');
    return this.findOne(existing.id, user);
  }

  async create(dto: CreateQuotationTemplateDto, user: AuthUser) {
    const seed = dto.seedDefaultBands !== false && !dto.rows?.length;
    const geo = await this.geographyColumnsFor(user.id);
    const defaults = seed ? defaultRateMatrix(geo) : null;

    const template = await this.templatesRepo.save(
      this.templatesRepo.create({
        name: dto.name.trim(),
        kind: dto.kind ?? RateTemplateKind.QUOTATION,
        isActive: dto.isActive ?? true,
        createdById: user.id,
        columns: defaults
          ? defaults.columns
          : this.mapColumns(dto.columns),
        sections: defaults
          ? defaults.sections
          : this.mapSections(dto.sections),
      }),
    );

    const rows = defaults
      ? defaults.rows.map((row, i) => this.mapRow(row, template.id, i))
      : (dto.rows ?? []).map((row, i) => this.mapRow(row, template.id, i));

    if (rows.length) {
      await this.rowsRepo.save(rows);
    }

    return this.findOne(template.id, user);
  }

  async findAll(
    query: PaginationDto & { search?: string; kind?: RateTemplateKind },
    user: AuthUser,
  ) {
    const { sortBy, sortOrder } = resolveSortPair(query, TEMPLATE_SORT, {
      sortBy: 'name',
      sortOrder: 'ASC',
    });

    const qb = this.templatesRepo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .where('template.deletedAt IS NULL')
      .andWhere('template.kind = :kind', {
        kind: query.kind ?? RateTemplateKind.QUOTATION,
      })
      .orderBy(`template.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (user.role !== Role.ADMIN) {
      qb.andWhere('template.createdById = :uid', { uid: user.id });
    }

    if (query.search) {
      qb.andWhere('template.name ILIKE :q', { q: `%${query.search}%` });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      data: items.map((t) => this.sanitize(t)),
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string, user: AuthUser, opts?: { syncGeography?: boolean }) {
    const template = await this.templatesRepo.findOne({
      where: { id },
      relations: {
        createdBy: { userInfo: true },
        rows: true,
      },
    });
    if (!template) {
      throw new NotFoundException('Rate template not found');
    }
    this.assertOwner(template, user);

    if (opts?.syncGeography !== false) {
      const mode =
        template.kind === RateTemplateKind.CASH ? 'cash' : 'quotation';
      await this.applyGeographyColumns(template, user.id, mode);
      // reload after possible mutation
      const refreshed = await this.templatesRepo.findOne({
        where: { id },
        relations: {
          createdBy: { userInfo: true },
          rows: true,
        },
      });
      if (refreshed) {
        Object.assign(template, refreshed);
      }
    }

    if (template.rows?.length) {
      template.rows.sort(
        (a, b) =>
          a.sectionId.localeCompare(b.sectionId) || a.sortOrder - b.sortOrder,
      );
    }
    template.columns = [...(template.columns ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    template.sections = [...(template.sections ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    return this.sanitize(template);
  }

  async update(id: string, dto: UpdateQuotationTemplateDto, user: AuthUser) {
    const template = await this.findOne(id, user, { syncGeography: false });

    if (dto.name !== undefined) template.name = dto.name.trim();
    if (dto.isActive !== undefined) template.isActive = dto.isActive;
    if (dto.columns !== undefined) template.columns = this.mapColumns(dto.columns);
    if (dto.sections !== undefined) {
      template.sections = this.mapSections(dto.sections);
    }

    await this.templatesRepo.save(template);

    if (dto.rows !== undefined) {
      await this.rowsRepo.softDelete({ templateId: id });
      if (dto.rows.length) {
        await this.rowsRepo.save(
          dto.rows.map((row, i) => this.mapRow(row, id, i)),
        );
      }
    }

    return this.findOne(id, user, { syncGeography: false });
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user, { syncGeography: false });
    await this.rowsRepo.softDelete({ templateId: id });
    await this.templatesRepo.softDelete(id);
    return { deleted: true };
  }

  /** One cash rate matrix per user — create with geography columns if missing */
  async getOrCreateCashTemplate(user: AuthUser) {
    const existing = await this.templatesRepo.findOne({
      where: {
        createdById: user.id,
        kind: RateTemplateKind.CASH,
      },
      relations: { rows: true },
    });
    if (existing) {
      return this.findOne(existing.id, user);
    }
    return this.create(
      {
        name: 'Cash booking rates',
        kind: RateTemplateKind.CASH,
        seedDefaultBands: true,
      },
      user,
    );
  }
}
