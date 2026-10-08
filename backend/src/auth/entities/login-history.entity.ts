import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { User } from './user.entity.js';

export enum AuthEvent {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  GOOGLE_LOGIN = 'GOOGLE_LOGIN',
  MICROSOFT_LOGIN = 'MICROSOFT_LOGIN',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  SESSION_REVOKED = 'SESSION_REVOKED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
}

@Entity('login_history')
export class LoginHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'integer', nullable: true })
  userId: number | null;

  @Index()
  @Column({ type: 'varchar', length: 190 })
  email: string;

  @Column({ type: 'varchar', length: 50 })
  event: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('User', 'loginHistories', {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'userId' })
  user: User | null;
}
