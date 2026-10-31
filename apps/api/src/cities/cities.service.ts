import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  paginateMeta,
  PaginationDto,
  resolveSortPair,
} from '../common/dto/pagination.dto';
import { City } from '../entities/city.entity';
import { State } from '../entities/state.entity';
import { CreateCityDto, UpdateCityDto } from './dto/city.dto';

const CITY_SORT = ['name', 'createdAt', 'isActive', 'stateName'] as const;

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City) private readonly repo: Repository<City>,
    @InjectRepository(State) private readonly statesRepo: Repository<State>,
  ) {}

  async create(dto: CreateCityDto) {
    const state = await this.statesRepo.findOne({ where: { id: dto.stateId } });
    if (!state) {
      throw new NotFoundException('State not found');
    }
    const name = dto.name.trim();
    const exists = await this.repo.findOne({
      where: { stateId: dto.stateId, name: ILike(name) },
    });
    if (exists) {
      throw new ConflictException('City already exists in this state');
    }
    return this.repo.save(
      this.repo.create({
        name,
        stateId: dto.stateId,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async findAll(
    query: PaginationDto & { search?: string; stateId?: string },
  ) {
    const { sortBy, sortOrder } = resolveSortPair(query, CITY_SORT, {
      sortBy: 'name',
      sortOrder: 'ASC',
    });
    const qb = this.repo
      .createQueryBuilder('city')
      .leftJoinAndSelect('city.state', 'state')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);

    if (sortBy === 'stateName') {
      qb.orderBy('state.name', sortOrder);
    } else {
      qb.orderBy(`city.${sortBy}`, sortOrder);
    }

    if (query.stateId) {
      qb.andWhere('city.stateId = :stateId', { stateId: query.stateId });
    }
    if (query.search) {
      qb.andWhere('(city.name ILIKE :search OR state.name ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      data: items,
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string) {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['state'],
    });
    if (!row) {
      throw new NotFoundException('City not found');
    }
    return row;
  }

  async update(id: string, dto: UpdateCityDto) {
    const row = await this.findOne(id);
    const stateId = dto.stateId ?? row.stateId;
    if (dto.stateId !== undefined) {
      const state = await this.statesRepo.findOne({
        where: { id: dto.stateId },
      });
      if (!state) {
        throw new NotFoundException('State not found');
      }
      row.stateId = dto.stateId;
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const exists = await this.repo.findOne({
        where: { stateId, name: ILike(name) },
      });
      if (exists && exists.id !== id) {
        throw new ConflictException('City already exists in this state');
      }
      row.name = name;
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    await this.repo.save(row);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
