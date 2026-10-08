import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { WorkspaceService } from '../services/workspace.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../dto/workspace.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../guards/workspace-context.guard';
import { WorkspacePermissionGuard } from '../guards/workspace-permission.guard';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { CurrentWorkspace } from '../decorators/current-workspace.decorator';

// Assuming the auth guard is named JwtAuthGuard, in real projects it might be imported from its specific path
@UseGuards(JwtAuthGuard)
@Controller('api/v1/workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  async createWorkspace(@Request() req, @Body() dto: CreateWorkspaceDto) {
    const workspace = await this.workspaceService.createWorkspace(req.user.id, dto);
    return { success: true, data: workspace };
  }

  @Get()
  async getWorkspaces(@Request() req) {
    const workspaces = await this.workspaceService.getWorkspacesForUser(req.user.id);
    return { success: true, data: workspaces };
  }

  @UseGuards(WorkspaceContextGuard)
  @Get(':workspaceId')
  async getWorkspaceDetails(@Param('workspaceId') workspaceId: string) {
    const workspace = await this.workspaceService.getWorkspaceDetails(workspaceId);
    return { success: true, data: workspace };
  }

  @UseGuards(WorkspaceContextGuard, WorkspacePermissionGuard)
  @RequirePermissions('workspace:update')
  @Patch(':workspaceId')
  async updateWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    const workspace = await this.workspaceService.updateWorkspace(workspaceId, dto);
    return { success: true, data: workspace };
  }

  @UseGuards(WorkspaceContextGuard, WorkspacePermissionGuard)
  @RequirePermissions('workspace:delete') // Typically restricted to OWNER, but checked via guard
  @Delete(':workspaceId')
  async deleteWorkspace(@Param('workspaceId') workspaceId: string) {
    await this.workspaceService.deleteWorkspace(workspaceId);
    return { success: true, data: null };
  }

  @UseGuards(WorkspaceContextGuard)
  @Post(':workspaceId/switch')
  async switchWorkspace(@CurrentWorkspace() context, @Request() req) {
    // In a real application, you might generate a new workspace-scoped JWT here
    // For now, return the context confirmation
    return { 
      success: true, 
      data: {
        workspace: context.workspace,
        role: context.membership.role,
        message: 'Switched active context successfully'
      } 
    };
  }
}
