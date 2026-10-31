import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '@courier/shared';
import { In, IsNull, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { City } from '../entities/city.entity';
import { SenderLocation } from '../entities/sender-location.entity';
import { State } from '../entities/state.entity';
import { cityRateColumnId } from '../rate-columns/rate-column-ids';
import {
  SetDefaultSenderLocationDto,
  SyncSenderLocationSelectionDto,
} from './dto/sender-location.dto';

@Injectable()
export class SenderLocationsService {
  constructor(
    @InjectRepository(SenderLocation)
    private readonly repo: Repository<SenderLocation>,
    @InjectRepository(City)
    private readonly citiesRepo: Repository<City>,
    @InjectRepository(State)
    private readonly statesRepo: Repository<State>,
  ) {}

  private scopeUserId(user: AuthUser) {
    return user.id;
  }

  /** Full master tree + which cities the user has selected as Centers */
  async getSelectionBoard(user: AuthUser) {
    const userId = this.scopeUserId(user);
    const [states, cities, selected] = await Promise.all([
      this.statesRepo.find({
        where: { isActive: true },
        order: { name: 'ASC' },
      }),
      this.citiesRepo.find({
        where: { isActive: true },
        order: { name: 'ASC' },
      }),
      this.repo.find({
        where: { createdById: userId, deletedAt: IsNull() },
      }),
    ]);

    const selectedCityIds = new Set(selected.map((s) => s.cityId));
    const defaultCityId =
      selected.find((s) => s.isDefault)?.cityId ?? selected[0]?.cityId ?? null;

    const groups = states.map((state) => ({
      stateId: state.id,
      stateName: state.name,
      cities: cities
        .filter((c) => c.stateId === state.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          selected: selectedCityIds.has(c.id),
        })),
    }));

    return {
      data: {
        groups,
        selectedCityIds: Array.from(selectedCityIds),
        defaultCityId,
        locations: selected.map((s) => ({
          id: s.id,
          cityId: s.cityId,
          stateId: s.stateId,
          label: s.label,
          rateColumnId: s.rateColumnId,
          isDefault: s.isDefault,
        })),
      },
    };
  }

  /** Centers available for booking dropdown */
  async listForBooking(user: AuthUser) {
    const userId = this.scopeUserId(user);
    const items = await this.repo.find({
      where: { createdById: userId, isActive: true },
      relations: { state: true, cityRef: true },
      order: { label: 'ASC' },
    });
    return { data: items };
  }

  async syncSelection(dto: SyncSenderLocationSelectionDto, user: AuthUser) {
    const userId = this.scopeUserId(user);
    const cityIds = [...new Set(dto.cityIds ?? [])];

    const cities =
      cityIds.length === 0
        ? []
        : await this.citiesRepo.find({
            where: { id: In(cityIds) },
            relations: { state: true },
          });

    if (cities.length !== cityIds.length) {
      throw new BadRequestException('One or more cities were not found');
    }

    const existing = await this.repo.find({
      where: { createdById: userId },
      withDeleted: true,
    });

    const byCity = new Map(existing.map((e) => [e.cityId, e]));
    const keep = new Set(cityIds);

    for (const row of existing) {
      if (!row.deletedAt && !keep.has(row.cityId)) {
        await this.repo.softDelete(row.id);
      }
    }

    for (const city of cities) {
      const rateColumnId = cityRateColumnId(city.id);
      const found = byCity.get(city.id);
      if (found) {
        found.label = city.name;
        found.stateId = city.stateId;
        found.rateColumnId = rateColumnId;
        found.isActive = true;
        found.deletedAt = null;
        found.isDefault = false;
        await this.repo.save(found);
      } else {
        await this.repo.save(
          this.repo.create({
            cityId: city.id,
            label: city.name,
            stateId: city.stateId,
            rateColumnId,
            isDefault: false,
            isActive: true,
            createdById: userId,
          }),
        );
      }
    }

    const active = await this.repo.find({
      where: { createdById: userId, deletedAt: IsNull() },
    });
    if (active.length) {
      let defaultId = dto.defaultCityId;
      if (!defaultId || !keep.has(defaultId)) {
        defaultId = active[0].cityId;
      }
      for (const row of active) {
        row.isDefault = row.cityId === defaultId;
      }
      await this.repo.save(active);
    }

    return this.getSelectionBoard(user);
  }

  async setDefault(dto: SetDefaultSenderLocationDto, user: AuthUser) {
    const userId = this.scopeUserId(user);
    const row = await this.repo.findOne({
      where: { createdById: userId, cityId: dto.cityId },
    });
    if (!row) throw new NotFoundException('Center city not in your selection');
    await this.repo
      .createQueryBuilder()
      .update(SenderLocation)
      .set({ isDefault: false })
      .where('createdById = :userId', { userId })
      .andWhere('deletedAt IS NULL')
      .execute();
    row.isDefault = true;
    await this.repo.save(row);
    return this.getSelectionBoard(user);
  }

  async findOne(id: string, user: AuthUser) {
    const row = await this.repo.findOne({
      where: { id },
      relations: { state: true, cityRef: true },
    });
    if (!row) throw new NotFoundException('Sender location not found');
    if (user.role !== Role.ADMIN && row.createdById !== user.id) {
      throw new ForbiddenException('You can only access your own centers');
    }
    return row;
  }
}
