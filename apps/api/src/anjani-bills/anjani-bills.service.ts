import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '@courier/shared';
import { LessThan, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  paginateMeta,
  resolveSortPair,
} from '../common/dto/pagination.dto';
import {
  AnjaniBill,
  AnjaniBillRow,
} from '../entities/anjani-bill.entity';
import { extensionFromMime } from '../storage/file-validation';
import { R2StorageService } from '../storage/r2.service';
import {
  AnjaniBillQueryDto,
  UpsertAnjaniBillDto,
} from './dto/anjani-bill.dto';

const SORT = ['createdAt', 'billNo', 'billDate', 'customerName', 'bill'] as const;
const ARCHIVE_MS = 30 * 24 * 60 * 60 * 1000;

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
      'editedPdfFileName',
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

  private ownedPrefixes(userId: string, billId: string) {
    return [`anjani/${userId}/${billId}/`, `archive/anjani/${userId}/${billId}/`];
  }

  private async withFreshUrls(
    bill: AnjaniBill,
    opts?: { includeDownloads?: boolean },
  ) {
    const includeDownloads = opts?.includeDownloads !== false;
    const [headerImage, sourcePdf, editedPdf] = await Promise.all([
      this.storage.toStoredFile(bill.headerImageKey, 'header'),
      this.storage.toStoredFile(bill.sourcePdfKey, bill.sourcePdfFileName),
      this.storage.toStoredFile(bill.editedPdfKey, bill.editedPdfFileName),
    ]);

    // List views only need view URLs; skip downloadUrl payload noise.
    const slim = (file: typeof headerImage) => {
      if (!file) return null;
      if (includeDownloads) return file;
      return {
        key: file.key,
        fileLabel: file.fileLabel,
        signedUrl: file.signedUrl,
        downloadUrl: file.signedUrl,
      };
    };

    return {
      ...bill,
      headerImageUrl: headerImage?.signedUrl || null,
      sourcePdfUrl: sourcePdf?.signedUrl || null,
      editedPdfUrl: editedPdf?.signedUrl || null,
      headerImage: slim(headerImage),
      sourcePdf: slim(sourcePdf),
      editedPdf: slim(editedPdf),
    };
  }

  private async moveKeyToArchive(key: string | null | undefined) {
    if (!key) return null;
    return this.storage.archiveObject(key);
  }

  /**
   * Clear DB file refs on soft-deleted bills older than 30 days.
   * R2 objects under `archive/` are deleted by the bucket lifecycle rule.
   */
  async purgeExpiredArchives() {
    const cutoff = new Date(Date.now() - ARCHIVE_MS);
    const old = await this.repo.find({
      withDeleted: true,
      where: { deletedAt: LessThan(cutoff) },
      take: 50,
    });
    for (const bill of old) {
      if (!bill.sourcePdfKey && !bill.headerImageKey && !bill.editedPdfKey) {
        continue;
      }
      await this.repo.update(bill.id, {
        sourcePdfKey: null,
        sourcePdfUrl: null,
        headerImageKey: null,
        headerImageUrl: null,
        editedPdfKey: null,
        editedPdfUrl: null,
      });
    }
  }

  async findAll(query: AnjaniBillQueryDto, user: AuthUser) {
    await this.purgeExpiredArchives();
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
        return this.withFreshUrls(item, { includeDownloads: false });
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
    return this.withFreshUrls(bill, { includeDownloads: true });
  }

  async create(dto: UpsertAnjaniBillDto, user: AuthUser) {
    this.storage.requireR2();
    const bill = this.repo.create({
      createdById: user.id,
      rows: [],
    });
    this.applyDto(bill, dto);
    const saved = await this.repo.save(bill);
    return this.attachFileKeys(saved.id, user, dto);
  }

  async update(id: string, dto: UpsertAnjaniBillDto, user: AuthUser) {
    this.storage.requireR2();
    const bill = await this.repo.findOne({ where: { id } });
    if (!bill) throw new NotFoundException('Bill not found');
    this.assertOwner(bill, user);
    this.applyDto(bill, dto);
    await this.repo.save(bill);
    return this.attachFileKeys(id, user, dto);
  }

  private async attachFileKeys(
    id: string,
    user: AuthUser,
    dto: UpsertAnjaniBillDto,
  ) {
    const bill = await this.repo.findOne({ where: { id } });
    if (!bill) throw new NotFoundException('Bill not found');
    this.assertOwner(bill, user);

    const prefixes = this.ownedPrefixes(user.id, id);

    if (dto.sourcePdfKey) {
      const previous = bill.sourcePdfKey;
      const finalKey = `anjani/${user.id}/${id}/source.pdf`;
      const key = await this.storage.resolveUploadKey(
        dto.sourcePdfKey,
        user.id,
        finalKey,
        prefixes,
        { allowedMimePrefix: ['application/pdf'] },
      );
      if (key) {
        bill.sourcePdfKey = key;
        bill.sourcePdfUrl = null;
        if (previous && previous !== key && !previous.startsWith('archive/')) {
          await this.storage.archiveObject(previous);
        }
      }
    }

    if (dto.editedPdfKey) {
      const previous = bill.editedPdfKey;
      const finalKey = `anjani/${user.id}/${id}/edited.pdf`;
      const key = await this.storage.resolveUploadKey(
        dto.editedPdfKey,
        user.id,
        finalKey,
        prefixes,
        { allowedMimePrefix: ['application/pdf'] },
      );
      if (key) {
        bill.editedPdfKey = key;
        bill.editedPdfUrl = null;
        if (previous && previous !== key && !previous.startsWith('archive/')) {
          await this.storage.archiveObject(previous);
        }
      }
    }

    if (dto.headerImageKey) {
      const previous = bill.headerImageKey;
      let ext = 'jpg';
      let headerMeta: Awaited<ReturnType<R2StorageService['headObject']>> | undefined;
      if (this.storage.isOwnedTempKey(dto.headerImageKey, user.id)) {
        headerMeta = await this.storage.headObject(dto.headerImageKey);
        ext = extensionFromMime(headerMeta.contentType || 'image/jpeg');
      } else {
        const match = dto.headerImageKey.match(/\.([a-z0-9]+)$/i);
        if (match) ext = match[1].toLowerCase();
      }
      const finalKey = `anjani/${user.id}/${id}/header.${ext}`;
      // If we already HEADed temp, promote with that meta (skip second HEAD).
      const key = headerMeta
        ? await this.storage.promoteTempToFinal(
            dto.headerImageKey,
            finalKey,
            user.id,
            { allowedMimePrefix: ['image/'], meta: headerMeta },
          )
        : await this.storage.resolveUploadKey(
            dto.headerImageKey,
            user.id,
            finalKey,
            prefixes,
            { allowedMimePrefix: ['image/'] },
          );
      if (key) {
        bill.headerImageKey = key;
        bill.headerImageUrl = null;
        if (previous && previous !== key && !previous.startsWith('archive/')) {
          await this.storage.archiveObject(previous);
        }
      }
    }

    await this.repo.save(bill);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    const bill = await this.repo.findOne({ where: { id } });
    if (!bill) throw new NotFoundException('Bill not found');
    this.assertOwner(bill, user);

    const sourceMoved = await this.moveKeyToArchive(bill.sourcePdfKey);
    if (sourceMoved) {
      bill.sourcePdfKey = sourceMoved;
      bill.sourcePdfUrl = null;
    }
    const headerMoved = await this.moveKeyToArchive(bill.headerImageKey);
    if (headerMoved) {
      bill.headerImageKey = headerMoved;
      bill.headerImageUrl = null;
    }
    const editedMoved = await this.moveKeyToArchive(bill.editedPdfKey);
    if (editedMoved) {
      bill.editedPdfKey = editedMoved;
      bill.editedPdfUrl = null;
    }

    await this.repo.save(bill);
    await this.repo.softDelete(id);
    await this.purgeExpiredArchives();
    return { ok: true };
  }
}
