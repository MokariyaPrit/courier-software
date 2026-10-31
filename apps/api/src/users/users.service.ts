import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Role } from '@courier/shared';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { paginateMeta, PaginationDto } from '../common/dto/pagination.dto';
import { Branch } from '../entities/branch.entity';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Branch) private readonly branchesRepo: Repository<Branch>,
  ) {}

  private sanitize(user: User) {
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.usersRepo.findOne({ where: { email } });
    if (exists) {
      throw new ConflictException('Email already in use');
    }

    let branchId: string | null = null;
    if (dto.role === Role.BRANCH_MANAGER) {
      if (!dto.branchId) {
        throw new BadRequestException('Branch Manager requires branchId');
      }
      const branch = await this.branchesRepo.findOne({
        where: { id: dto.branchId },
      });
      if (!branch) {
        throw new BadRequestException('Branch not found');
      }
      branchId = dto.branchId;
    } else if (dto.optionalBranchId) {
      branchId = dto.optionalBranchId;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      branchId,
    });
    const saved = await this.usersRepo.save(user);
    return this.sanitize(saved);
  }

  async findAll(query: PaginationDto) {
    const [items, total] = await this.usersRepo.findAndCount({
      relations: ['branch'],
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      data: items.map((u) => this.sanitize(u)),
      meta: paginateMeta(query.page, query.pageSize, total),
    };
  }

  async findOne(id: string) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['branch'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.branchId !== undefined) user.branchId = dto.branchId;
    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (user.role === Role.BRANCH_MANAGER && !user.branchId) {
      throw new BadRequestException('Branch Manager requires branchId');
    }

    const saved = await this.usersRepo.save(user);
    return this.sanitize(saved);
  }
}
