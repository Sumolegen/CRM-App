import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceRole } from '../entities/workspace-role.entity';
import { CreateRoleDto, UpdateRoleDto } from '../dto/role.dto';
import { WorkspaceRole as RoleEnum } from '../enums/workspace-role.enum';
import { WorkspaceMember } from '../entities/workspace-member.entity';

@Injectable()
export class WorkspaceRoleService {
  constructor(
    @InjectRepository(WorkspaceRole)
    private roleRepository: Repository<WorkspaceRole>,
    @InjectRepository(WorkspaceMember)
    private memberRepository: Repository<WorkspaceMember>,
  ) {}

  async createRole(workspaceId: string, createRoleDto: CreateRoleDto): Promise<WorkspaceRole> {
    const role = this.roleRepository.create({
      ...createRoleDto,
      workspaceId,
    });
    return this.roleRepository.save(role);
  }

  async getRoles(workspaceId: string): Promise<WorkspaceRole[]> {
    return this.roleRepository.find({ where: { workspaceId } });
  }

  async updateRole(workspaceId: string, roleId: string, updateRoleDto: UpdateRoleDto): Promise<WorkspaceRole> {
    const role = await this.roleRepository.findOne({ where: { id: roleId, workspaceId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.type !== RoleEnum.CUSTOM) {
      throw new BadRequestException('Cannot modify system roles');
    }
    
    Object.assign(role, updateRoleDto);
    return this.roleRepository.save(role);
  }

  async deleteRole(workspaceId: string, roleId: string): Promise<void> {
    const role = await this.roleRepository.findOne({ where: { id: roleId, workspaceId } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.type !== RoleEnum.CUSTOM) {
      throw new BadRequestException('Cannot delete system roles');
    }

    const membersCount = await this.memberRepository.count({ where: { roleId } });
    if (membersCount > 0) {
      throw new BadRequestException('Cannot delete role assigned to active members');
    }

    await this.roleRepository.remove(role);
  }
}
