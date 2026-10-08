import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceSettings } from './entities/workspace-settings.entity';
import { WorkspaceRole } from './entities/workspace-role.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceInvitation } from './entities/workspace-invitation.entity';

import { WorkspaceService } from './services/workspace.service';
import { WorkspaceMemberService } from './services/workspace-member.service';
import { WorkspaceInvitationService } from './services/workspace-invitation.service';
import { WorkspaceRoleService } from './services/workspace-role.service';
import { WorkspaceSettingsService } from './services/workspace-settings.service';

import { WorkspaceController } from './controllers/workspace.controller';
import { WorkspaceMemberController } from './controllers/workspace-member.controller';
import { WorkspaceInvitationController } from './controllers/workspace-invitation.controller';
import { WorkspaceRoleController } from './controllers/workspace-role.controller';
import { WorkspaceSettingsController } from './controllers/workspace-settings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Workspace,
      WorkspaceSettings,
      WorkspaceRole,
      WorkspaceMember,
      WorkspaceInvitation,
    ]),
  ],
  controllers: [
    WorkspaceController,
    WorkspaceMemberController,
    WorkspaceInvitationController,
    WorkspaceRoleController,
    WorkspaceSettingsController,
  ],
  providers: [
    WorkspaceService,
    WorkspaceMemberService,
    WorkspaceInvitationService,
    WorkspaceRoleService,
    WorkspaceSettingsService,
  ],
  exports: [
    WorkspaceService,
    WorkspaceMemberService,
    WorkspaceRoleService,
  ],
})
export class WorkspaceModule {}
