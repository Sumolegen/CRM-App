import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Finds a user by email.
   * @param email User email address
   * @param includePassword Whether to include the password hash (which is select: false)
   */
  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    const normalizedEmail = email.toLowerCase().trim();
    if (includePassword) {
      return this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.password')
        .where('user.email = :email', { email: normalizedEmail })
        .getOne();
    }

    return this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
  }

  /**
   * Finds a user by their UUID primary key.
   * @param id User UUID
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  /**
   * Creates a new user in the database.
   * @param data User registration data
   */
  async create(data: {
    email: string;
    password: string;
    name: string;
    role?: string;
  }): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    const user = this.userRepository.create({
      email: data.email.toLowerCase().trim(),
      password: data.password,
      name: data.name.trim(),
      role: data.role || 'user',
    });

    return this.userRepository.save(user);
  }
}
