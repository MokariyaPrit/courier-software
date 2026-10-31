import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { paginateMeta, PaginationDto } from '../common/dto/pagination.dto';
import { Pincode } from '../entities/pincode.entity';
import { CreatePincodeDto, UpdatePincodeDto } from './dto/pincode.dto';

@Injectable()
export class PincodesService {
  constructor(
    @InjectRepository(Pincode) private readonly repo: Repository<Pincode>,
  ) {}

  async create(dto: CreatePincodeDto) {
    const code = dto.code.trim();
    const exists = await this.repo.findOne({ where: { code } });
    if (exists) {
      throw new ConflictException('Pincode already exists');
    }
    return this.repo.save(this.repo.create({ ...dto, code }));
  }

  async findAll(query: PaginationDto & { search?: string }) {
    const where = query.search
      ? [{ code: ILike(`%${query.search}%`) }, { city: ILike(`%${query.search}%`) }]
      : undefined;
    const [items, total] = await this.repo.findAndCount({
      where,
      relations: ['serviceBranch'],
      order: { code: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      data: items,
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string) {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['serviceBranch'],
    });
    if (!row) {
      throw new NotFoundException('Pincode not found');
    }
    return row;
  }

  async update(id: string, dto: UpdatePincodeDto) {
    const row = await this.findOne(id);
    Object.assign(row, dto);
    return this.repo.save(row);
  }
}
