import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { City } from '../entities/city.entity';
import { State } from '../entities/state.entity';
import { UserRateCity } from '../entities/user-rate-city.entity';
import { SyncRateColumnSelectionDto } from './dto/rate-column.dto';
import {
  cityRateColumnId,
  ROI_RATE_COLUMN_ID,
  stateRateColumnId,
} from './rate-column-ids';

@Injectable()
export class RateColumnsService {
  constructor(
    @InjectRepository(UserRateCity)
    private readonly repo: Repository<UserRateCity>,
    @InjectRepository(City)
    private readonly citiesRepo: Repository<City>,
    @InjectRepository(State)
    private readonly statesRepo: Repository<State>,
  ) {}

  async getSelectionBoard(user: AuthUser) {
    const userId = user.id;
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
        locations: selected.map((s) => ({
          id: s.id,
          cityId: s.cityId,
          stateId: s.stateId,
          label: s.label,
        })),
      },
    };
  }

  async listForBooking(user: AuthUser) {
    const selected = await this.repo.find({
      where: { createdById: user.id, deletedAt: IsNull() },
      relations: { state: true, cityRef: true },
      order: { label: 'ASC' },
    });
    return {
      data: selected.map((s) => ({
        id: s.cityId,
        cityId: s.cityId,
        stateId: s.stateId,
        label: s.label,
        stateName: s.state?.name ?? null,
        rateColumnId: cityRateColumnId(s.cityId),
      })),
    };
  }

  async syncSelection(dto: SyncRateColumnSelectionDto, user: AuthUser) {
    const userId = user.id;
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
      const found = byCity.get(city.id);
      if (found) {
        found.label = city.name;
        found.stateId = city.stateId;
        found.deletedAt = null;
        await this.repo.save(found);
      } else {
        await this.repo.save(
          this.repo.create({
            cityId: city.id,
            label: city.name,
            stateId: city.stateId,
            createdById: userId,
          }),
        );
      }
    }

    return this.getSelectionBoard(user);
  }

  /**
   * Matrix columns from Rate columns selection:
   * - one column per selected city
   * - one "Within {state}" column per distinct parent state (for city→state→ROI)
   * - ROI always
   */
  async rateGeographyForUser(userId: string) {
    const selected = await this.repo.find({
      where: { createdById: userId, deletedAt: IsNull() },
      relations: { state: true },
    });

    const cityCols = selected.map((s) => ({
      id: cityRateColumnId(s.cityId),
      label: s.label,
      sortOrder: 0,
      kind: 'city' as const,
      cityId: s.cityId,
      stateId: s.stateId,
    }));

    const stateMap = new Map<
      string,
      {
        id: string;
        label: string;
        sortOrder: number;
        kind: 'state';
        stateId: string;
      }
    >();
    for (const s of selected) {
      if (!s.stateId || !s.state?.name) continue;
      if (stateMap.has(s.stateId)) continue;
      const stateName = s.state.name.trim();
      stateMap.set(s.stateId, {
        id: stateRateColumnId(s.stateId),
        label: `Within ${stateName}`,
        sortOrder: 0,
        kind: 'state',
        stateId: s.stateId,
      });
    }
    const stateCols = Array.from(stateMap.values());

    cityCols.sort((a, b) => a.label.localeCompare(b.label));
    stateCols.sort((a, b) => a.label.localeCompare(b.label));
    cityCols.forEach((c, i) => {
      c.sortOrder = i;
    });
    stateCols.forEach((c, i) => {
      c.sortOrder = cityCols.length + i;
    });

    const roi = {
      id: ROI_RATE_COLUMN_ID,
      label: 'ROI (Rest of India)',
      sortOrder: cityCols.length + stateCols.length,
      kind: 'roi' as const,
    };

    return {
      columns: [...cityCols, ...stateCols, roi],
      selected,
    };
  }
}
