import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { Candidate } from '../database/entities/candidate.entity';
import { UpdateProfileDto, ChangePasswordDto } from './dto/candidate.dto';

@Injectable()
export class CandidateService {
  constructor(
    @InjectRepository(Candidate) private candidateRepo: Repository<Candidate>,
  ) {}

  async getProfile(id: string) {
    const candidate = await this.candidateRepo.findOne({ where: { id } });
    if (!candidate) throw new NotFoundException('User was not found');

    return {
      id: candidate.id,
      fullName: candidate.fullName || '',
      email: candidate.email || '',
      phone: candidate.phoneNumber || '',
      location: candidate.address || '',
      avatarUrl:
        candidate.avatarUrl ||
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
      role: 'EpicCV User',
      provider: candidate.provider,
    };
  }

  async updateProfile(id: string, data: UpdateProfileDto) {
    await this.candidateRepo.update(id, {
      fullName: data.fullName,
      phoneNumber: data.phone,
      address: data.location,
      avatarUrl: data.avatarUrl,
    });
    return this.getProfile(id);
  }

  async uploadAvatar(id: string, file: Express.Multer.File) {
    const candidate = await this.candidateRepo.findOne({ where: { id } });
    if (!candidate) throw new NotFoundException('User was not found');

    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const savedFileName = `avatar-${id}-${Date.now()}${path.extname(file.originalname || '.png')}`;
    fs.writeFileSync(path.join(uploadDir, savedFileName), file.buffer);

    const publicBaseUrl =
      process.env.PUBLIC_BASE_URL ||
      `http://localhost:${process.env.PORT ?? 3000}`;
    const avatarUrl = `${publicBaseUrl}/uploads/${savedFileName}`;

    await this.candidateRepo.update(id, { avatarUrl });
    return { avatarUrl };
  }

  async changePassword(id: string, data: ChangePasswordDto) {
    const candidate = await this.candidateRepo.findOne({ where: { id } });
    if (!candidate) throw new NotFoundException('User does not exist');
    if (candidate.provider !== 'local') {
      throw new BadRequestException(
        'Linked Mezon accounts cannot change password here',
      );
    }

    const isMatch = await bcrypt.compare(
      data.oldPassword,
      candidate.passwordHash,
    );
    if (!isMatch)
      throw new BadRequestException('Current password is incorrect');

    const hashedNewPassword = await bcrypt.hash(data.newPassword, 10);
    await this.candidateRepo.update(id, { passwordHash: hashedNewPassword });

    return { success: true, message: 'Password changed successfully' };
  }
}
