import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { WorkspaceSettingsService } from '../services/workspace-settings.service';
import { UpdateWorkspaceSettingsDto } from '../dto/settings.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../guards/workspace-context.guard';
import { WorkspacePermissionGuard } from '../guards/workspace-permission.guard';
import { RequirePermissions } from '../decorators/require-permissions.decorator';

@UseGuards(JwtAuthGuard, WorkspaceContextGuard, WorkspacePermissionGuard)
@Controller('api/v1/workspaces/:workspaceId/settings')
export class WorkspaceSettingsController {
  constructor(private readonly settingsService: WorkspaceSettingsService) {}

  @RequirePermissions('settings:read', 'settings:manage')
  @Get()
  async getSettings(@Param('workspaceId') workspaceId: string) {
    const settings = await this.settingsService.getSettings(workspaceId);
    return { success: true, data: settings };
  }

  @RequirePermissions('settings:manage')
  @Patch()
  async updateSettings(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceSettingsDto,
  ) {
    const settings = await this.settingsService.updateSettings(workspaceId, dto);
    return { success: true, data: settings };
  }
}
