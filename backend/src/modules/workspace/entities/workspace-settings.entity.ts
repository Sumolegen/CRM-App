import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Workspace } from './workspace.entity';

@Entity('workspace_settings')
export class WorkspaceSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Workspace, (workspace) => workspace.settings, { onDelete: 'CASCADE' })
  @JoinColumn()
  workspace: Workspace;

  @Column({ type: 'varchar', default: 'USD' })
  defaultCurrency: string;

  @Column({ type: 'varchar', default: 'UTC' })
  timezone: string;

  @Column({ type: 'int', default: 1 })
  fiscalYearStart: number;

  @Column({ type: 'varchar', nullable: true })
  primaryColor: string;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string;

  @Column({ type: 'varchar', nullable: true })
  faviconUrl: string;

  @Column({ type: 'varchar', default: 'en' })
  defaultLanguage: string;

  @Column({ type: 'varchar', default: 'YYYY-MM-DD' })
  dateFormat: string;

  @Column({ type: 'varchar', default: 'HH:mm' })
  timeFormat: string;

  @Column({ type: 'boolean', default: false })
  enforce2FA: boolean;

  @Column({ type: 'simple-array', nullable: true })
  allowedDomains: string[];

  @Column({ type: 'int', default: 60 })
  sessionTimeoutMinutes: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
