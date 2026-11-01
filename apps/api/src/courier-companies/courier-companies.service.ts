import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '@courier/shared';
import { In, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginateMeta, resolveSortPair } from '../common/dto/pagination.dto';
import { CourierCompany } from '../entities/courier-company.entity';
import { UserCourierCompanyPref } from '../entities/user-courier-company-pref.entity';
import {
  CourierCompanyQueryDto,
  CreateCourierCompanyDto,
  UpdateCourierCompanyDto,
  UpdateCourierCompanyPrefDto,
} from './dto/courier-company.dto';

const COMPANY_SORT = ['name', 'isActive', 'createdAt'] as const;

type CompanyWithPrefs = CourierCompany & {
  isHiddenForMe: boolean;
  isDefaultForMe: boolean;
};

@Injectable()
export class CourierCompaniesService {
  constructor(
    @InjectRepository(CourierCompany)
    private readonly repo: Repository<CourierCompany>,
    @InjectRepository(UserCourierCompanyPref)
    private readonly prefsRepo: Repository<UserCourierCompanyPref>,
  ) {}

  private blankToNull(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private isSharedRow(row: CourierCompany) {
    return row.isShared === true || row.createdById == null;
  }

  private assertCanView(row: CourierCompany, user: AuthUser) {
    if (user.role === Role.ADMIN) return;
    if (this.isSharedRow(row)) return;
    if (row.createdById === user.id) return;
    throw new ForbiddenException('You cannot access this courier company');
  }

  private assertCanMutate(row: CourierCompany, user: AuthUser) {
    if (user.role === Role.ADMIN) return;
    if (this.isSharedRow(row)) {
      throw new ForbiddenException(
        'Shared courier companies can only be changed by Admin',
      );
    }
    if (row.createdById !== user.id) {
      throw new ForbiddenException(
        'You can only change your own courier companies',
      );
    }
  }

  private async assertNameAvailable(
    name: string,
    user: AuthUser,
    excludeId?: string,
  ) {
    const qb = this.repo
      .createQueryBuilder('company')
      .where('company.deletedAt IS NULL')
      .andWhere('LOWER(company.name) = LOWER(:name)', { name });

    if (user.role === Role.ADMIN) {
      qb.andWhere('company.isShared = true');
    } else {
      qb.andWhere('company.createdById = :uid', { uid: user.id }).andWhere(
        'company.isShared = false',
      );
    }

    if (excludeId) {
      qb.andWhere('company.id != :excludeId', { excludeId });
    }

    const exists = await qb.getOne();
    if (exists) {
      throw new ConflictException('Courier company already exists');
    }
  }

  private async prefsMap(userId: string, companyIds: string[]) {
    if (!companyIds.length) return new Map<string, UserCourierCompanyPref>();
    const rows = await this.prefsRepo.find({
      where: { userId, courierCompanyId: In(companyIds) },
    });
    return new Map(rows.map((r) => [r.courierCompanyId, r]));
  }

  private withPrefs(
    items: CourierCompany[],
    prefs: Map<string, UserCourierCompanyPref>,
  ): CompanyWithPrefs[] {
    return items.map((row) => {
      const pref = prefs.get(row.id);
      return Object.assign(row, {
        isHiddenForMe: pref?.isHidden === true,
        isDefaultForMe: pref?.isDefault === true,
      });
    });
  }

  async create(dto: CreateCourierCompanyDto, user: AuthUser) {
    const name = dto.name.trim();
    await this.assertNameAvailable(name, user);

    const isShared = user.role === Role.ADMIN;

    const saved = await this.repo.save(
      this.repo.create({
        name,
        companyLink: this.blankToNull(dto.companyLink),
        isActive: dto.isActive ?? true,
        isShared,
        createdById: user.id,
      }),
    );
    return Object.assign(saved, {
      isHiddenForMe: false,
      isDefaultForMe: false,
    });
  }

  async findAll(query: CourierCompanyQueryDto, user: AuthUser) {
    const { sortBy, sortOrder } = resolveSortPair(query, COMPANY_SORT, {
      sortBy: 'name',
      sortOrder: 'ASC',
    });

    const qb = this.repo
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.createdBy', 'createdBy')
      .leftJoinAndSelect('createdBy.userInfo', 'createdByInfo')
      .where('company.deletedAt IS NULL')
      .orderBy(`company.${sortBy}`, sortOrder)
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (user.role !== Role.ADMIN) {
      qb.andWhere(
        '(company.createdById = :uid OR company.isShared = true OR company.createdById IS NULL)',
        { uid: user.id },
      );
    }

    if (query.activeOnly) {
      qb.andWhere('company.isActive = true');
      // Booking select: exclude companies this user has hidden
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM user_courier_company_prefs pref
          WHERE pref."courierCompanyId" = company.id
            AND pref."userId" = :prefUid
            AND pref."isHidden" = true
        )`,
        { prefUid: user.id },
      );
    }

    if (query.search) {
      qb.andWhere(
        `(company.name ILIKE :q OR company.companyLink ILIKE :q)`,
        { q: `%${query.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    const prefs = await this.prefsMap(
      user.id,
      items.map((i) => i.id),
    );

    return {
      data: this.withPrefs(items, prefs),
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const row = await this.repo.findOne({
      where: { id },
      relations: {
        createdBy: { userInfo: true },
      },
    });
    if (!row) {
      throw new NotFoundException('Courier company not found');
    }
    this.assertCanView(row, user);
    const prefs = await this.prefsMap(user.id, [row.id]);
    return this.withPrefs([row], prefs)[0];
  }

  async update(id: string, dto: UpdateCourierCompanyDto, user: AuthUser) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Courier company not found');
    this.assertCanView(row, user);
    this.assertCanMutate(row, user);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      await this.assertNameAvailable(name, user, id);
      row.name = name;
    }
    if (dto.companyLink !== undefined) {
      row.companyLink = this.blankToNull(dto.companyLink);
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;

    await this.repo.save(row);
    return this.findOne(id, user);
  }

  async remove(id: string, user: AuthUser) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Courier company not found');
    this.assertCanView(row, user);
    this.assertCanMutate(row, user);
    await this.repo.softDelete(id);
    return { deleted: true };
  }

  async updateMyPrefs(
    id: string,
    dto: UpdateCourierCompanyPrefDto,
    user: AuthUser,
  ) {
    if (dto.isHidden === undefined && dto.isDefault === undefined) {
      throw new BadRequestException('Nothing to update');
    }

    const company = await this.repo.findOne({ where: { id } });
    if (!company || company.deletedAt) {
      throw new NotFoundException('Courier company not found');
    }
    this.assertCanView(company, user);

    if (dto.isHidden === true && !this.isSharedRow(company)) {
      throw new BadRequestException(
        'Only shared admin companies can be hidden from your list',
      );
    }

    if (dto.isDefault === true) {
      if (!company.isActive) {
        throw new BadRequestException(
          'Inactive companies cannot be set as default',
        );
      }
      // Clear previous default for this user
      await this.prefsRepo
        .createQueryBuilder()
        .update(UserCourierCompanyPref)
        .set({ isDefault: false })
        .where('"userId" = :uid', { uid: user.id })
        .andWhere('"isDefault" = true')
        .execute();
    }

    let pref = await this.prefsRepo.findOne({
      where: { userId: user.id, courierCompanyId: id },
    });

    if (!pref) {
      pref = this.prefsRepo.create({
        userId: user.id,
        courierCompanyId: id,
        isHidden: false,
        isDefault: false,
      });
    }

    if (dto.isHidden !== undefined) {
      pref.isHidden = dto.isHidden;
      if (dto.isHidden) {
        pref.isDefault = false;
      }
    }
    if (dto.isDefault !== undefined) {
      pref.isDefault = dto.isDefault;
      if (dto.isDefault) {
        pref.isHidden = false;
      }
    }

    await this.prefsRepo.save(pref);

    // If clearing default and no other fields, keep row (or clean empty prefs)
    if (!pref.isHidden && !pref.isDefault) {
      await this.prefsRepo.delete(pref.id);
    }

    return this.findOne(id, user);
  }
}
