import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { paginateMeta, PaginationDto } from '../common/dto/pagination.dto';
import { UserInfo } from '../entities/user-info.entity';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(UserInfo)
    private readonly userInfoRepo: Repository<UserInfo>,
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

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersRepo.save(
      this.usersRepo.create({
        email,
        passwordHash,
        role: dto.role,
        isActive: dto.isActive ?? true,
      }),
    );

    const userInfo = await this.userInfoRepo.save(
      this.userInfoRepo.create({
        userId: user.id,
        fullName: dto.fullName,
        phone: dto.phone ?? null,
        email, // same as login email
        address: dto.address ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        pincode: dto.pincode ?? null,
        companyName: dto.companyName ?? null,
        gstin: dto.gstin ?? null,
        notes: dto.notes ?? null,
        isActive: dto.isActive ?? true,
      }),
    );

    return this.sanitize({ ...user, userInfo });
  }

  async findAll(query: PaginationDto) {
    const [items, total] = await this.usersRepo.findAndCount({
      relations: ['userInfo'],
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
      relations: ['userInfo'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['userInfo'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      if (email !== user.email) {
        const exists = await this.usersRepo.findOne({ where: { email } });
        if (exists && exists.id !== user.id) {
          throw new ConflictException('Email already in use');
        }
        user.email = email;
      }
    }

    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    // Blank password = keep existing hash
    if (dto.password !== undefined && dto.password.trim() !== '') {
      user.passwordHash = await bcrypt.hash(dto.password.trim(), 10);
    }

    await this.usersRepo.save(user);

    let info = user.userInfo;
    if (!info) {
      info = this.userInfoRepo.create({
        userId: user.id,
        fullName: dto.fullName || user.email,
        email: user.email,
      });
    }

    if (dto.fullName !== undefined) info.fullName = dto.fullName;
    if (dto.phone !== undefined) info.phone = dto.phone;
    // Keep user_info.email in sync with login email (single email)
    info.email = user.email;
    if (dto.address !== undefined) info.address = dto.address;
    if (dto.city !== undefined) info.city = dto.city;
    if (dto.state !== undefined) info.state = dto.state;
    if (dto.pincode !== undefined) info.pincode = dto.pincode;
    if (dto.companyName !== undefined) info.companyName = dto.companyName;
    if (dto.gstin !== undefined) info.gstin = dto.gstin;
    if (dto.notes !== undefined) info.notes = dto.notes;
    if (dto.infoIsActive !== undefined) info.isActive = dto.infoIsActive;

    await this.userInfoRepo.save(info);
    return this.findOne(id);
  }
}
