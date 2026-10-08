import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Workspace } from './workspace.entity';
import { WorkspaceMember } from './workspace-member.entity';
import { WorkspaceRole as WorkspaceRoleEnum } from '../enums/workspace-role.enum';

@Entity('workspace_roles')
export class WorkspaceRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'enum', enum: WorkspaceRoleEnum, default: WorkspaceRoleEnum.CUSTOM })
  type: WorkspaceRoleEnum;

  @Column({ type: 'simple-array', default: '' })
  permissions: string[];

  @ManyToOne(() => Workspace, (workspace) => workspace.roles, { onDelete: 'CASCADE' })
  workspace: Workspace;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @OneToMany(() => WorkspaceMember, (member) => member.role)
  members: WorkspaceMember[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
