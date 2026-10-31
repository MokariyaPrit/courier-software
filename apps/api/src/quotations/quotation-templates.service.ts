import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '@courier/shared';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  paginateMeta,
  PaginationDto,
  resolveSortPair,
} from '../common/dto/pagination.dto';
import { QuotationRateRow } from '../entities/quotation-rate-row.entity';
import { QuotationRateTemplate } from '../entities/quotation-rate-template.entity';
import { defaultRateMatrix } from './default-rate-bands';
import {
  CreateQuotationTemplateDto,
  RateColumnDto,
  RateRowDto,
  RateSectionDto,
  UpdateQuotationTemplateDto,
} from './dto/quotation-template.dto';

const TEMPLATE_SORT = ['name', 'createdAt', 'updatedAt'] as const;

@Injectable()
export class QuotationTemplatesService {
  constructor(
    @InjectRepository(QuotationRateTemplate)
    private readonly templatesRepo: Repository<QuotationRateTemplate>,
    @InjectRepository(QuotationRateRow)
    private readonly rowsRepo: Repository<QuotationRateRow>,
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
      out[key] = String(value ?? 0);
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

  async create(dto: CreateQuotationTemplateDto, user: AuthUser) {
    const seed = dto.seedDefaultBands !== false && !dto.rows?.length;
    const defaults = seed ? defaultRateMatrix() : null;

    const template = await this.templatesRepo.save(
      this.templatesRepo.create({
        name: dto.name.trim(),
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

  async findAll(query: PaginationDto & { search?: string }, user: AuthUser) {
    const { sortBy, sortOrder } = resolveSortPair(query, TEMPLATE_SORT, {
      sortBy: 'name',
      sortOrder: 'ASC',
    });

    const qb = this.templatesRepo
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
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

  async findOne(id: string, user: AuthUser) {
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
    const template = await this.findOne(id, user);

    if (dto.name !== undefined) template.name = dto.name.trim();
    if (dto.isActive !== undefined) template.isActive = dto.isActive;
    if (dto.columns !== undefined) template.columns = this.mapColumns(dto.columns);
    if (dto.sections !== undefined) {
      template.sections = this.mapSections(dto.sections);
    }

    await this.templatesRepo.save(template);

    if (dto.rows !== undefined) {
      await this.rowsRepo.delete({ templateId: id });
      if (dto.rows.length) {
        await this.rowsRepo.save(
          dto.rows.map((row, i) => this.mapRow(row, id, i)),
        );
      }
    }

    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    await this.findOne(id, user);
    await this.templatesRepo.delete(id);
    return { deleted: true };
  }
}
