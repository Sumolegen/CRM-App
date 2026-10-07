import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { User } from './user.entity.js';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'integer' })
  userId: number;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  refreshTokenHash: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  deviceName: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'boolean', default: false })
  isRememberMe: boolean;

  @Column({ type: 'datetime' })
  lastUsedAt: Date;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('User', 'sessions', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  get isValid(): boolean {
    return !this.revokedAt && new Date() < new Date(this.expiresAt);
  }
}
