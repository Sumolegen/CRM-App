import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Workspace } from '../entities/workspace.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { WorkspaceRole } from '../entities/workspace-role.entity';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from '../dto/workspace.dto';
import { WorkspaceRole as RoleEnum } from '../enums/workspace-role.enum';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    private dataSource: DataSource,
  ) {}

  async createWorkspace(userId: string, dto: CreateWorkspaceDto): Promise<Workspace> {
    const existing = await this.workspaceRepository.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new BadRequestException('Workspace with this slug already exists');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Create Workspace
      const workspace = queryRunner.manager.create(Workspace, {
        name: dto.name,
        slug: dto.slug,
        logo: dto.logo,
      });
      const savedWorkspace = await queryRunner.manager.save(workspace);

      // 2. Create Settings
      const settings = queryRunner.manager.create(WorkspaceSettings, {
        workspace: savedWorkspace,
      });
      await queryRunner.manager.save(settings);

      // 3. Create Default Roles
      const ownerRole = queryRunner.manager.create(WorkspaceRole, {
        name: 'Owner',
        type: RoleEnum.OWNER,
        permissions: ['*'], // Owners have all permissions implicitly, but setting '*' as a convention
        workspaceId: savedWorkspace.id,
      });
      const adminRole = queryRunner.manager.create(WorkspaceRole, {
        name: 'Admin',
        type: RoleEnum.ADMIN,
        permissions: ['*'],
        workspaceId: savedWorkspace.id,
      });
      const memberRole = queryRunner.manager.create(WorkspaceRole, {
        name: 'Member',
        type: RoleEnum.MEMBER,
        permissions: ['workspace:read'],
        workspaceId: savedWorkspace.id,
      });

      const [savedOwnerRole] = await queryRunner.manager.save([ownerRole, adminRole, memberRole]);

      // 4. Assign Creator as Owner
      const member = queryRunner.manager.create(WorkspaceMember, {
        workspaceId: savedWorkspace.id,
        userId,
        roleId: savedOwnerRole.id,
        isActive: true,
      });
      await queryRunner.manager.save(member);

      await queryRunner.commitTransaction();
      return savedWorkspace;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getWorkspacesForUser(userId: string): Promise<Workspace[]> {
    return this.workspaceRepository.createQueryBuilder('workspace')
      .innerJoin('workspace.members', 'member', 'member.userId = :userId AND member.isActive = true', { userId })
      .getMany();
  }

  async getWorkspaceDetails(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: ['settings', 'roles'],
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  async updateWorkspace(workspaceId: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    const workspace = await this.getWorkspaceDetails(workspaceId);
    
    if (dto.slug && dto.slug !== workspace.slug) {
      const existing = await this.workspaceRepository.findOne({ where: { slug: dto.slug } });
      if (existing) {
        throw new BadRequestException('Workspace with this slug already exists');
      }
    }

    Object.assign(workspace, dto);
    return this.workspaceRepository.save(workspace);
  }

  async deleteWorkspace(workspaceId: string): Promise<void> {
    const workspace = await this.getWorkspaceDetails(workspaceId);
    await this.workspaceRepository.softRemove(workspace);
  }
}
