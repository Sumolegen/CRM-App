import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { Workspace } from '../entities/workspace.entity';

@Injectable()
export class WorkspaceContextGuard implements CanActivate {
  constructor(
    @InjectRepository(WorkspaceMember)
    private memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const workspaceId = request.params.workspaceId || request.headers['x-workspace-id'];
    
    if (!workspaceId) {
      throw new ForbiddenException('Workspace context is required');
    }

    const workspace = await this.workspaceRepository.findOne({ where: { id: workspaceId } });
    
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await this.memberRepository.findOne({
      where: {
        workspaceId,
        userId: user.id,
        isActive: true,
      },
      relations: ['role'],
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    request.workspace = workspace;
    request.membership = membership;

    return true;
  }
}
