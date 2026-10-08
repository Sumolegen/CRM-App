import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from '../../../models/User.entity';
import { WorkspaceRole } from './workspace-role.entity';
import { InvitationStatus } from '../enums/invitation-status.enum';

@Entity('workspace_invitations')
export class WorkspaceInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 190 })
  email: string;

  @Column({ type: 'varchar', unique: true })
  token: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.invitations, { onDelete: 'CASCADE' })
  workspace: Workspace;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => WorkspaceRole, { eager: true, onDelete: 'CASCADE' })
  role: WorkspaceRole;

  @Column({ type: 'uuid' })
  roleId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  inviter: User;

  @Column({ type: 'uuid', nullable: true })
  inviterId: string;

  @Column({ type: 'enum', enum: InvitationStatus, default: InvitationStatus.PENDING })
  status: InvitationStatus;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
