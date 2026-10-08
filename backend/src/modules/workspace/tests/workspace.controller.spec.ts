import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceController } from '../controllers/workspace.controller';
import { WorkspaceService } from '../services/workspace.service';
import { JwtAuthGuard } from '../../../authentication/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../guards/workspace-context.guard';
import { WorkspacePermissionGuard } from '../guards/workspace-permission.guard';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  let service: WorkspaceService;

  const mockWorkspaceService = {
    createWorkspace: jest.fn(),
    getWorkspacesForUser: jest.fn(),
    getWorkspaceDetails: jest.fn(),
    updateWorkspace: jest.fn(),
    deleteWorkspace: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [
        {
          provide: WorkspaceService,
          useValue: mockWorkspaceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(WorkspaceContextGuard).useValue({ canActivate: () => true })
      .overrideGuard(WorkspacePermissionGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WorkspaceController>(WorkspaceController);
    service = module.get<WorkspaceService>(WorkspaceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createWorkspace', () => {
    it('should return created workspace', async () => {
      const mockResult = { id: '1', name: 'Test' };
      mockWorkspaceService.createWorkspace.mockResolvedValue(mockResult);

      const req = { user: { id: 'user1' } };
      const dto = { name: 'Test', slug: 'test' };

      const result = await controller.createWorkspace(req, dto);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(service.createWorkspace).toHaveBeenCalledWith('user1', dto);
    });
  });
});
