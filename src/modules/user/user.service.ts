import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TimezoneUtil } from '../../common/utils/timezone.util';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    this.logger.log(
      `Creating user: ${createUserDto.firstName} ${createUserDto.lastName}`,
    );

    const user = this.userRepository.create({
      ...createUserDto,
      birthday: new Date(createUserDto.birthday),
    });

    return await this.userRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Updating user: ${id}`);

    const user = await this.findOne(id);

    // Convert birthday string to Date if provided
    const updateData: any = { ...updateUserDto };
    if (updateUserDto.birthday) {
      updateData.birthday = new Date(updateUserDto.birthday);
    }

    Object.assign(user, updateData);
    return await this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Removing user: ${id}`);

    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  /**
   * Find users who have birthdays today in the specified timezone
   */
  async findBirthdayUsersInTimezone(timezone: string): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { timezone },
    });

    return users.filter((user) =>
      TimezoneUtil.isBirthdayToday(user.birthday, timezone),
    );
  }

  /**
   * Find users by birthday month and day
   */
  async findUsersByBirthday(month: number, day: number): Promise<User[]> {
    return await this.userRepository
      .createQueryBuilder('user')
      .where('EXTRACT(MONTH FROM user.birthday) = :month', { month })
      .andWhere('EXTRACT(DAY FROM user.birthday) = :day', { day })
      .getMany();
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<any> {
    const total = await this.userRepository.count();
    const byTimezone = await this.userRepository
      .createQueryBuilder('user')
      .select('user.timezone', 'timezone')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.timezone')
      .getRawMany();

    return {
      total,
      byTimezone,
    };
  }
}
