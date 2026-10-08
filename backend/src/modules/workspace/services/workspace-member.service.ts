import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { UpdateMemberRoleDto, UpdateMemberStatusDto } from '../dto/member.dto';
import { WorkspaceRole as RoleEnum } from '../enums/workspace-role.enum';
import { WorkspaceRole } from '../entities/workspace-role.entity';

@Injectable()
export class WorkspaceMemberService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(WorkspaceRole)
    private roleRepository: Repository<WorkspaceRole>,
  ) {}

  async getMembers(workspaceId: string, page = 1, limit = 10, search?: string) {
    const query = this.memberRepository.createQueryBuilder('member')
      .leftJoinAndSelect('member.user', 'user')
      .leftJoinAndSelect('member.role', 'role')
      .where('member.workspaceId = :workspaceId', { workspaceId });

    if (search) {
      query.andWhere('(user.email ILIKE :search OR user.name ILIKE :search)', { search: `%${search}%` });
    }

    const [items, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async getMember(workspaceId: string, memberId: string): Promise<WorkspaceMember> {
    const member = await this.memberRepository.findOne({
      where: { id: memberId, workspaceId },
      relations: ['user', 'role'],
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async updateMemberRole(workspaceId: string, memberId: string, updateRoleDto: UpdateMemberRoleDto): Promise<WorkspaceMember> {
    const member = await this.getMember(workspaceId, memberId);
    
    // Check if the new role belongs to the workspace
    const newRole = await this.roleRepository.findOne({ where: { id: updateRoleDto.roleId, workspaceId } });
    if (!newRole) {
      throw new BadRequestException('Invalid role for this workspace');
    }

    // Prevent demoting the last owner
    if (member.role.type === RoleEnum.OWNER && newRole.type !== RoleEnum.OWNER) {
      const ownerCount = await this.memberRepository.count({
        where: { workspaceId, role: { type: RoleEnum.OWNER } },
        relations: ['role'],
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot demote the last owner of the workspace');
      }
    }

    member.role = newRole;
    member.roleId = newRole.id;
    return this.memberRepository.save(member);
  }

  async updateMemberStatus(workspaceId: string, memberId: string, updateStatusDto: UpdateMemberStatusDto): Promise<WorkspaceMember> {
    const member = await this.getMember(workspaceId, memberId);
    
    // Prevent deactivating the last owner
    if (member.role.type === RoleEnum.OWNER && !updateStatusDto.isActive) {
      const ownerCount = await this.memberRepository.count({
        where: { workspaceId, isActive: true, role: { type: RoleEnum.OWNER } },
        relations: ['role'],
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot deactivate the last active owner of the workspace');
      }
    }

    member.isActive = updateStatusDto.isActive;
    return this.memberRepository.save(member);
  }

  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    const member = await this.getMember(workspaceId, memberId);
    
    // Prevent removing the last owner
    if (member.role.type === RoleEnum.OWNER) {
      const ownerCount = await this.memberRepository.count({
        where: { workspaceId, role: { type: RoleEnum.OWNER } },
        relations: ['role'],
      });
      if (ownerCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner of the workspace');
      }
    }

    await this.memberRepository.remove(member);
  }
}
