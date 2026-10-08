import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import type { User } from './user.entity.js';

@Entity('oauth_accounts')
@Unique(['provider', 'providerUserId'])
export class OAuthAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'integer' })
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  provider: string; // 'google' | 'microsoft'

  @Index()
  @Column({ type: 'varchar', length: 255 })
  providerUserId: string;

  @Column({ type: 'varchar', length: 190, nullable: true })
  providerEmail: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('User', 'oauthAccounts', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;
}
