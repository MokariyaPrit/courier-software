import { Role } from '@courier/shared';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserInfo } from './user-info.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar' })
  passwordHash: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToOne(() => UserInfo, (info) => info.user)
  userInfo: UserInfo | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
