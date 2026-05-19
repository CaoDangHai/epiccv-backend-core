import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { Candidate } from '../database/entities/candidate.entity';
import { UpdateProfileDto, ChangePasswordDto } from './dto/candidate.dto';

@Injectable()
export class CandidateService {
    constructor(@InjectRepository(Candidate) private candidateRepo: Repository<Candidate>) { }

    async getProfile(id: string) {
        const candidate = await this.candidateRepo.findOne({ where: { id } });
        if (!candidate) throw new NotFoundException('Không tìm thấy người dùng');
        return {
            id: candidate.id,
            fullName: candidate.fullName || '',
            email: candidate.email || '',
            phone: candidate.phoneNumber || '',
            location: candidate.address || '',
            avatarUrl: candidate.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
            role: 'Người dùng EpicCV',
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
    if (!candidate) throw new NotFoundException('Không tìm thấy người dùng');

    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Đặt tên file ngẫu nhiên tránh trùng lặp
    const savedFileName = `avatar-${id}-${Date.now()}${path.extname(file.originalname || '.png')}`;
    fs.writeFileSync(path.join(uploadDir, savedFileName), file.buffer);

    // Tạo URL giả định chạy ở localhost:3000 
    const avatarUrl = `http://localhost:3000/uploads/${savedFileName}`;

    await this.candidateRepo.update(id, { avatarUrl });

    return { avatarUrl };
  }

    async changePassword(id: string, data: ChangePasswordDto) {
        const candidate = await this.candidateRepo.findOne({ where: { id } });
        if (!candidate) throw new NotFoundException('Người dùng không tồn tại');
        if (candidate.provider !== 'local') {
            throw new BadRequestException('Tài khoản liên kết (Mezon) không thể đổi mật khẩu tại đây');
        }

        const isMatch = await bcrypt.compare(data.oldPassword, candidate.passwordHash);
        if (!isMatch) throw new BadRequestException('Mật khẩu cũ không chính xác');

        const hashedNewPassword = await bcrypt.hash(data.newPassword, 10);
        await this.candidateRepo.update(id, { passwordHash: hashedNewPassword });

        return { success: true, message: 'Đổi mật khẩu thành công' };
    }
}