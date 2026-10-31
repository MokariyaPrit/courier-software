import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  paginateMeta,
  PaginationDto,
  resolveOrder,
} from '../common/dto/pagination.dto';
import { City } from '../entities/city.entity';
import { State } from '../entities/state.entity';
import { CreateStateDto, UpdateStateDto } from './dto/state.dto';

const STATE_SORT = ['name', 'createdAt', 'isActive'] as const;

@Injectable()
export class StatesService {
  constructor(
    @InjectRepository(State) private readonly repo: Repository<State>,
    @InjectRepository(City) private readonly citiesRepo: Repository<City>,
  ) {}

  async create(dto: CreateStateDto) {
    const name = dto.name.trim();
    const exists = await this.repo.findOne({ where: { name: ILike(name) } });
    if (exists) {
      throw new ConflictException('State already exists');
    }
    return this.repo.save(
      this.repo.create({
        name,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async findAll(query: PaginationDto & { search?: string }) {
    const where = query.search
      ? { name: ILike(`%${query.search}%`) }
      : undefined;
    const [items, total] = await this.repo.findAndCount({
      where,
      order: resolveOrder(query, STATE_SORT, {
        sortBy: 'name',
        sortOrder: 'ASC',
      }),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      data: items,
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('State not found');
    }
    return row;
  }

  async update(id: string, dto: UpdateStateDto) {
    const row = await this.findOne(id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const exists = await this.repo.findOne({ where: { name: ILike(name) } });
      if (exists && exists.id !== id) {
        throw new ConflictException('State already exists');
      }
      row.name = name;
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    return this.repo.save(row);
  }

  async remove(id: string) {
    await this.findOne(id);
    const cityCount = await this.citiesRepo.count({ where: { stateId: id } });
    if (cityCount > 0) {
      throw new BadRequestException(
        `Cannot delete state. ${cityCount} city(ies) are linked. Delete cities first.`,
      );
    }
    await this.repo.delete(id);
    return { deleted: true };
  }
}
