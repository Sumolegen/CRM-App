import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { WorkspaceInvitation } from '../entities/workspace-invitation.entity';
import { CreateInvitationDto } from '../dto/invitation.dto';
import { InvitationStatus } from '../enums/invitation-status.enum';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { WorkspaceRole } from '../entities/workspace-role.entity';
import * as crypto from 'crypto';

@Injectable()
export class WorkspaceInvitationService {
  constructor(
    @InjectRepository(WorkspaceInvitation)
    private invitationRepository: Repository<WorkspaceInvitation>,
    @InjectRepository(WorkspaceMember)
    private memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(WorkspaceRole)
    private roleRepository: Repository<WorkspaceRole>,
  ) {}

  async createInvitation(workspaceId: string, inviterId: string, dto: CreateInvitationDto) {
    // Check if user is already a member
    const existingMember = await this.memberRepository.createQueryBuilder('member')
      .leftJoinAndSelect('member.user', 'user')
      .where('member.workspaceId = :workspaceId AND user.email = :email', { workspaceId, email: dto.email })
      .getOne();

    if (existingMember) {
      throw new BadRequestException('User is already a member of this workspace');
    }

    // Check for active pending invites
    const existingInvite = await this.invitationRepository.findOne({
      where: {
        workspaceId,
        email: dto.email,
        status: InvitationStatus.PENDING,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (existingInvite) {
      throw new BadRequestException('An active invitation already exists for this email');
    }

    const role = await this.roleRepository.findOne({ where: { id: dto.roleId, workspaceId } });
    if (!role) {
      throw new BadRequestException('Invalid role provided');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    const invitation = this.invitationRepository.create({
      workspaceId,
      email: dto.email,
      roleId: dto.roleId,
      inviterId,
      token,
      expiresAt,
    });

    // TODO: Send email with token here

    return this.invitationRepository.save(invitation);
  }

  async getInvitations(workspaceId: string, page = 1, limit = 10) {
    const [items, total] = await this.invitationRepository.findAndCount({
      where: { workspaceId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items,
      meta: { total, page, limit },
    };
  }

  async resendInvitation(workspaceId: string, id: string) {
    const invitation = await this.invitationRepository.findOne({ where: { id, workspaceId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    
    if (invitation.status !== InvitationStatus.PENDING && invitation.status !== InvitationStatus.EXPIRED) {
      throw new BadRequestException('Can only resend pending or expired invitations');
    }

    invitation.token = crypto.randomBytes(32).toString('hex');
    invitation.expiresAt = new Date();
    invitation.expiresAt.setDate(invitation.expiresAt.getDate() + 7);
    invitation.status = InvitationStatus.PENDING;

    // TODO: Resend email here

    return this.invitationRepository.save(invitation);
  }

  async revokeInvitation(workspaceId: string, id: string) {
    const invitation = await this.invitationRepository.findOne({ where: { id, workspaceId } });
    if (!invitation) throw new NotFoundException('Invitation not found');

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Can only revoke pending invitations');
    }

    invitation.status = InvitationStatus.REVOKED;
    return this.invitationRepository.save(invitation);
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.invitationRepository.findOne({
      where: { token },
      relations: ['workspace', 'role'],
    });

    if (!invitation) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    if (invitation.status !== InvitationStatus.PENDING || invitation.expiresAt < new Date()) {
      invitation.status = InvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException('Invitation is expired or already used');
    }

    // Add user as member
    const newMember = this.memberRepository.create({
      workspaceId: invitation.workspaceId,
      userId,
      roleId: invitation.roleId,
      isActive: true,
    });

    await this.memberRepository.save(newMember);

    // Mark invitation as accepted
    invitation.status = InvitationStatus.ACCEPTED;
    await this.invitationRepository.save(invitation);

    return { success: true, workspaceId: invitation.workspaceId };
  }
}
