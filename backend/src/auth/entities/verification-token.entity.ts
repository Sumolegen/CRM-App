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

export enum TokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

@Entity('verification_tokens')
export class VerificationToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'integer' })
  userId: number;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  tokenHash: string;

  @Column({ type: 'varchar', length: 40 })
  type: TokenType;

  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne('User', 'verificationTokens', {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  get isExpired(): boolean {
    return new Date() > new Date(this.expiresAt);
  }

  get isUsed(): boolean {
    return this.usedAt !== null;
  }
}
