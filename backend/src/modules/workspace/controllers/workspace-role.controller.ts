import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { WorkspaceRoleService } from '../services/workspace-role.service';
import { CreateRoleDto, UpdateRoleDto } from '../dto/role.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../guards/workspace-context.guard';
import { WorkspacePermissionGuard } from '../guards/workspace-permission.guard';
import { RequirePermissions } from '../decorators/require-permissions.decorator';

@UseGuards(JwtAuthGuard, WorkspaceContextGuard, WorkspacePermissionGuard)
@Controller('api/v1/workspaces/:workspaceId/roles')
export class WorkspaceRoleController {
  constructor(private readonly roleService: WorkspaceRoleService) {}

  @RequirePermissions('settings:manage')
  @Post()
  async createRole(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateRoleDto,
  ) {
    const role = await this.roleService.createRole(workspaceId, dto);
    return { success: true, data: role };
  }

  @RequirePermissions('settings:manage')
  @Get()
  async getRoles(@Param('workspaceId') workspaceId: string) {
    const roles = await this.roleService.getRoles(workspaceId);
    return { success: true, data: roles };
  }

  @RequirePermissions('settings:manage')
  @Patch(':id')
  async updateRole(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const role = await this.roleService.updateRole(workspaceId, id, dto);
    return { success: true, data: role };
  }

  @RequirePermissions('settings:manage')
  @Delete(':id')
  async deleteRole(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    await this.roleService.deleteRole(workspaceId, id);
    return { success: true, data: null };
  }
}
