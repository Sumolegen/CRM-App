import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Session } from './session.entity.js';
import { OAuthAccount } from './oauth-account.entity.js';
import { VerificationToken } from './verification-token.entity.js';
import { LoginHistory } from './login-history.entity.js';

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  MEMBER = 'member',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190, unique: true })
  email: string;

  // Nullable for OAuth-only users
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string | null;

  @Column({ type: 'varchar', length: 100, default: '' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  lastName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', length: 20, default: UserRole.MEMBER })
  role: string;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'datetime', nullable: true })
  lockoutUntil: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  workspaceId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => OAuthAccount, (oauth) => oauth.user)
  oauthAccounts: OAuthAccount[];

  @OneToMany(() => VerificationToken, (vt) => vt.user)
  verificationTokens: VerificationToken[];

  @OneToMany(() => LoginHistory, (lh) => lh.user)
  loginHistories: LoginHistory[];

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }
}
