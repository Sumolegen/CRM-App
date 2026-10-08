import { Controller, Get, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { WorkspaceMemberService } from '../services/workspace-member.service';
import { QueryPaginationDto } from '../dto/query-pagination.dto';
import { UpdateMemberRoleDto, UpdateMemberStatusDto } from '../dto/member.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../guards/workspace-context.guard';
import { WorkspacePermissionGuard } from '../guards/workspace-permission.guard';
import { RequirePermissions } from '../decorators/require-permissions.decorator';

@UseGuards(JwtAuthGuard, WorkspaceContextGuard, WorkspacePermissionGuard)
@Controller('api/v1/workspaces/:workspaceId/members')
export class WorkspaceMemberController {
  constructor(private readonly memberService: WorkspaceMemberService) {}

  @RequirePermissions('members:read')
  @Get()
  async getMembers(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryPaginationDto,
  ) {
    const result = await this.memberService.getMembers(workspaceId, query.page, query.limit, query.search);
    return { success: true, data: result.items, meta: result.meta };
  }

  @RequirePermissions('members:read')
  @Get(':memberId')
  async getMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    const member = await this.memberService.getMember(workspaceId, memberId);
    return { success: true, data: member };
  }

  @RequirePermissions('members:manage')
  @Patch(':memberId')
  async updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const member = await this.memberService.updateMemberRole(workspaceId, memberId, dto);
    return { success: true, data: member };
  }

  @RequirePermissions('members:manage')
  @Patch(':memberId/status')
  async updateMemberStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberStatusDto,
  ) {
    const member = await this.memberService.updateMemberStatus(workspaceId, memberId, dto);
    return { success: true, data: member };
  }

  @RequirePermissions('members:manage')
  @Delete(':memberId')
  async removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    await this.memberService.removeMember(workspaceId, memberId);
    return { success: true, data: null };
  }
}
