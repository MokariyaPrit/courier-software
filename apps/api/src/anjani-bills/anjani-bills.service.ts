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
  resolveSortPair,
} from '../common/dto/pagination.dto';
import {
  AnjaniBill,
  AnjaniBillRow,
} from '../entities/anjani-bill.entity';
import { R2StorageService } from '../storage/r2.service';
import {
  AnjaniBillQueryDto,
  UpsertAnjaniBillDto,
} from './dto/anjani-bill.dto';

const SORT = ['createdAt', 'billNo', 'billDate', 'customerName', 'bill'] as const;

@Injectable()
export class AnjaniBillsService {
  constructor(
    @InjectRepository(AnjaniBill)
    private readonly repo: Repository<AnjaniBill>,
    private readonly storage: R2StorageService,
  ) {}

  private assertOwner(bill: AnjaniBill, user: AuthUser) {
    if (user.role !== Role.ADMIN && bill.createdById !== user.id) {
      throw new ForbiddenException('You can only access your own bills');
    }
  }

  private normalizeRows(rows?: UpsertAnjaniBillDto['rows']): AnjaniBillRow[] {
    if (!rows?.length) return [];
    return rows.map((r, i) => ({
      id: r.id || `r${i + 1}`,
      date: r.date || '',
      docNo: r.docNo || '',
      type: r.type || 'ND',
      party: r.party || '',
      center: r.center || '',
      weight: r.weight || '',
      unit: r.unit || 'kg',
      amount: r.amount || '',
    }));
  }

  private applyDto(bill: AnjaniBill, dto: UpsertAnjaniBillDto) {
    const fields: Array<keyof UpsertAnjaniBillDto> = [
      'billNo',
      'billDate',
      'billPeriod',
      'hsn',
      'customerName',
      'address1',
      'address2',
      'customerGst',
      'customerCode',
      'customerPan',
      'bankName',
      'accountNo',
      'ifsc',
      'fuel',
      'gross',
      'sub',
      'sgst',
      'cgst',
      'igst',
      'bill',
      'words',
      'layoutJson',
      'sourcePdfFileName',
      'sourcePdfBytes',
    ];
    for (const key of fields) {
      if (dto[key] !== undefined) {
        (bill as unknown as Record<string, unknown>)[key] = dto[key];
      }
    }
    if (dto.rows !== undefined) {
      bill.rows = this.normalizeRows(dto.rows);
    }
  }

  private async withFreshUrls(bill: AnjaniBill) {
    const [headerImageUrl, sourcePdfUrl] = await Promise.all([
      bill.headerImageKey
        ? this.storage.getSignedDownloadUrl(bill.headerImageKey)
        : Promise.resolve(bill.headerImageUrl || ''),
      bill.sourcePdfKey
        ? this.storage.getSignedDownloadUrl(bill.sourcePdfKey)
        : Promise.resolve(bill.sourcePdfUrl || ''),
    ]);
    return {
      ...bill,
      headerImageUrl: headerImageUrl || null,
      sourcePdfUrl: sourcePdfUrl || null,
    };
  }

  async findAll(query: AnjaniBillQueryDto, user: AuthUser) {
    const { sortBy, sortOrder } = resolveSortPair(query, SORT, {
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
    const qb = this.repo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .where('b.deletedAt IS NULL')
      .orderBy(`b.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (user.role !== Role.ADMIN) {
      qb.andWhere('b.createdById = :uid', { uid: user.id });
    }
    if (query.search?.trim()) {
      qb.andWhere(
        '(b.billNo ILIKE :q OR b.customerName ILIKE :q OR b.customerGst ILIKE :q)',
        { q: `%${query.search.trim()}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    const data = await Promise.all(
      items.map(async (item) => {
        if (item.createdBy) {
          delete (item.createdBy as { passwordHash?: string }).passwordHash;
        }
        return this.withFreshUrls(item);
      }),
    );
    return { data, meta: paginateMeta(query.page, query.pageSize, total) };
  }

  async findOne(id: string, user: AuthUser) {
    const bill = await this.repo.findOne({
      where: { id },
      relations: { createdBy: { userInfo: true } },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    this.assertOwner(bill, user);
    if (bill.createdBy) {
      delete (bill.createdBy as { passwordHash?: string }).passwordHash;
    }
    return this.withFreshUrls(bill);
  }

  async create(
    dto: UpsertAnjaniBillDto,
    user: AuthUser,
    files?: {
      sourcePdf?: Express.Multer.File;
      headerImage?: Express.Multer.File;
    },
  ) {
    const bill = this.repo.create({
      createdById: user.id,
      rows: [],
    });
    this.applyDto(bill, dto);
    const saved = await this.repo.save(bill);
    return this.attachFiles(saved.id, user, files);
  }

  async update(
    id: string,
    dto: UpsertAnjaniBillDto,
    user: AuthUser,
    files?: {
      sourcePdf?: Express.Multer.File;
      headerImage?: Express.Multer.File;
    },
  ) {
    const bill = await this.repo.findOne({ where: { id } });
    if (!bill) throw new NotFoundException('Bill not found');
    this.assertOwner(bill, user);
    this.applyDto(bill, dto);
    await this.repo.save(bill);
    return this.attachFiles(id, user, files);
  }

  private async attachFiles(
    id: string,
    user: AuthUser,
    files?: {
      sourcePdf?: Express.Multer.File;
      headerImage?: Express.Multer.File;
    },
  ) {
    const bill = await this.repo.findOne({ where: { id } });
    if (!bill) throw new NotFoundException('Bill not found');
    this.assertOwner(bill, user);

    if (files?.sourcePdf?.buffer?.length) {
      const key = `anjani/${user.id}/${id}/source.pdf`;
      const stored = await this.storage.putObject(
        key,
        files.sourcePdf.buffer,
        files.sourcePdf.mimetype || 'application/pdf',
      );
      bill.sourcePdfKey = stored.key;
      bill.sourcePdfUrl = stored.url || null;
      bill.sourcePdfFileName =
        files.sourcePdf.originalname || bill.sourcePdfFileName;
      bill.sourcePdfBytes = files.sourcePdf.size;
    }

    if (files?.headerImage?.buffer?.length) {
      const mime = files.headerImage.mimetype || 'image/jpeg';
      const ext = mime.includes('png')
        ? 'png'
        : mime.includes('webp')
          ? 'webp'
          : 'jpg';
      const key = `anjani/${user.id}/${id}/header.${ext}`;
      const stored = await this.storage.putObject(
        key,
        files.headerImage.buffer,
        mime,
      );
      bill.headerImageKey = stored.key;
      bill.headerImageUrl = stored.url || null;
    }

    await this.repo.save(bill);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    const bill = await this.repo.findOne({ where: { id } });
    if (!bill) throw new NotFoundException('Bill not found');
    this.assertOwner(bill, user);
    await this.repo.softDelete(id);
    return { ok: true };
  }
}
