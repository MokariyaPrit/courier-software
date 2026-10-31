import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginateMeta, PaginationDto } from '../common/dto/pagination.dto';
import { Branch } from '../entities/branch.entity';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch) private readonly repo: Repository<Branch>,
  ) {}

  async create(dto: CreateBranchDto) {
    const code = dto.code.toUpperCase();
    const exists = await this.repo.findOne({ where: { code } });
    if (exists) {
      throw new ConflictException('Branch code already exists');
    }
    const branch = this.repo.create({ ...dto, code });
    return this.repo.save(branch);
  }

  async findAll(query: PaginationDto) {
    const [items, total] = await this.repo.findAndCount({
      order: { name: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      data: items,
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string) {
    const branch = await this.repo.findOne({ where: { id } });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    const branch = await this.findOne(id);
    Object.assign(branch, dto);
    return this.repo.save(branch);
  }
}
