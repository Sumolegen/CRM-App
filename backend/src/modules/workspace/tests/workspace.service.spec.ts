import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from '../services/workspace.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Workspace } from '../entities/workspace.entity';
import { DataSource } from 'typeorm';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  const mockWorkspaceRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn(),
        save: jest.fn(),
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        {
          provide: getRepositoryToken(Workspace),
          useValue: mockWorkspaceRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWorkspace', () => {
    it('should throw if slug already exists', async () => {
      mockWorkspaceRepository.findOne.mockResolvedValueOnce({ id: '123' });
      await expect(
        service.createWorkspace('userId', { name: 'Test', slug: 'test' }),
      ).rejects.toThrow('Workspace with this slug already exists');
    });

    it('should successfully create workspace', async () => {
      mockWorkspaceRepository.findOne.mockResolvedValueOnce(null);
      const queryRunner = mockDataSource.createQueryRunner();
      queryRunner.manager.save.mockResolvedValueOnce({ id: 'ws123', name: 'Test', slug: 'test' }); // Workspace
      queryRunner.manager.save.mockResolvedValueOnce({}); // Settings
      queryRunner.manager.save.mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]); // Roles
      queryRunner.manager.save.mockResolvedValueOnce({}); // Member

      const result = await service.createWorkspace('user1', { name: 'Test', slug: 'test' });
      expect(result).toHaveProperty('id', 'ws123');
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });
});
