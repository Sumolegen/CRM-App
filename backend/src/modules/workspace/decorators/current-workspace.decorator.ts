import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Workspace } from '../entities/workspace.entity';
import { WorkspaceMember } from '../entities/workspace-member.entity';

export interface WorkspaceContext {
  workspace: Workspace;
  membership: WorkspaceMember;
}

export const CurrentWorkspace = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): WorkspaceContext => {
    const request = ctx.switchToHttp().getRequest();
    return {
      workspace: request.workspace,
      membership: request.membership,
    };
  },
);
