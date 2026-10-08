import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToOne, OneToMany } from 'typeorm';
import { WorkspaceSettings } from './workspace-settings.entity';
import { WorkspaceMember } from './workspace-member.entity';
import { WorkspaceRole } from './workspace-role.entity';
import { WorkspaceInvitation } from './workspace-invitation.entity';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo: string;

  @OneToOne(() => WorkspaceSettings, (settings) => settings.workspace, { cascade: true })
  settings: WorkspaceSettings;

  @OneToMany(() => WorkspaceMember, (member) => member.workspace, { cascade: true })
  members: WorkspaceMember[];

  @OneToMany(() => WorkspaceRole, (role) => role.workspace, { cascade: true })
  roles: WorkspaceRole[];

  @OneToMany(() => WorkspaceInvitation, (invitation) => invitation.workspace, { cascade: true })
  invitations: WorkspaceInvitation[];

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp' })
  deletedAt: Date;
}
