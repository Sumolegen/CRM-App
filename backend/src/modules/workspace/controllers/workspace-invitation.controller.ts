import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { WorkspaceInvitationService } from '../services/workspace-invitation.service';
import { CreateInvitationDto, AcceptInvitationDto } from '../dto/invitation.dto';
import { QueryPaginationDto } from '../dto/query-pagination.dto';
import { JwtAuthGuard } from '../../authentication/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../guards/workspace-context.guard';
import { WorkspacePermissionGuard } from '../guards/workspace-permission.guard';
import { RequirePermissions } from '../decorators/require-permissions.decorator';

@Controller('api/v1/workspaces')
export class WorkspaceInvitationController {
  constructor(private readonly invitationService: WorkspaceInvitationService) {}

  @UseGuards(JwtAuthGuard, WorkspaceContextGuard, WorkspacePermissionGuard)
  @RequirePermissions('members:invite')
  @Post(':workspaceId/invitations')
  async createInvitation(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateInvitationDto,
    @Request() req,
  ) {
    const invitation = await this.invitationService.createInvitation(workspaceId, req.user.id, dto);
    return { success: true, data: invitation };
  }

  @UseGuards(JwtAuthGuard, WorkspaceContextGuard, WorkspacePermissionGuard)
  @RequirePermissions('members:read')
  @Get(':workspaceId/invitations')
  async getInvitations(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryPaginationDto,
  ) {
    const result = await this.invitationService.getInvitations(workspaceId, query.page, query.limit);
    return { success: true, data: result.items, meta: result.meta };
  }

  @UseGuards(JwtAuthGuard, WorkspaceContextGuard, WorkspacePermissionGuard)
  @RequirePermissions('members:invite')
  @Post(':workspaceId/invitations/:id/resend')
  async resendInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    const invitation = await this.invitationService.resendInvitation(workspaceId, id);
    return { success: true, data: invitation };
  }

  @UseGuards(JwtAuthGuard, WorkspaceContextGuard, WorkspacePermissionGuard)
  @RequirePermissions('members:manage')
  @Delete(':workspaceId/invitations/:id')
  async revokeInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    const invitation = await this.invitationService.revokeInvitation(workspaceId, id);
    return { success: true, data: invitation };
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/accept')
  async acceptInvitation(@Body() dto: AcceptInvitationDto, @Request() req) {
    const result = await this.invitationService.acceptInvitation(dto.token, req.user.id);
    return { success: true, data: result };
  }
}
