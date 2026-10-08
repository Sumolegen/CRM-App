import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { UpdateWorkspaceSettingsDto } from '../dto/settings.dto';

@Injectable()
export class WorkspaceSettingsService {
  constructor(
    @InjectRepository(WorkspaceSettings)
    private settingsRepository: Repository<WorkspaceSettings>,
  ) {}

  async getSettings(workspaceId: string): Promise<WorkspaceSettings> {
    const settings = await this.settingsRepository.findOne({
      where: { workspace: { id: workspaceId } },
    });
    if (!settings) {
      throw new NotFoundException('Settings not found');
    }
    return settings;
  }

  async updateSettings(workspaceId: string, updateSettingsDto: UpdateWorkspaceSettingsDto): Promise<WorkspaceSettings> {
    const settings = await this.getSettings(workspaceId);
    Object.assign(settings, updateSettingsDto);
    return this.settingsRepository.save(settings);
  }
}
