import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Bắt buộc import multer để sửa lỗi "Namespace global.Express has no exported member Multer"
import 'multer';

import { AnalysisResult } from '../database/entities/analysis-result.entity';
import { CurriculumVitae } from '../database/entities/curriculum-vitae.entity';
import { JobDescription } from '../database/entities/job-description.entity';

@Injectable()
export class CvService {
  constructor(
    @InjectRepository(AnalysisResult)
    private analysisRepo: Repository<AnalysisResult>,

    @InjectRepository(CurriculumVitae)
    private cvRepo: Repository<CurriculumVitae>,

    @InjectRepository(JobDescription)
    private jdRepo: Repository<JobDescription>,
  ) {}

  async processAndSaveReport(
    cvFile: Express.Multer.File,
    jdFile?: Express.Multer.File,
    jdText?: string,
  ) {
    // 1. TẠO & LƯU JD (Sửa field title -> jobTitle, map mô tả vào parsedData)
    const jd = this.jdRepo.create({
      jobTitle: jdFile ? jdFile.originalname : 'Target Job Role',
      // parsedData là NOT NULL theo Entity của bạn
      parsedData: { text: jdText || 'File Uploaded' },
    });
    const savedJd = await this.jdRepo.save(jd);

    // 2. TẠO & LƯU CV
    const cv = this.cvRepo.create({
      // LƯU Ý QUAN TRỌNG: candidateId là UUID NOT NULL.
      // Tạm thời dùng 1 UUID ảo để vượt qua lỗi Database.
      // Sau này làm xong Auth, bạn phải truyền ID của User đang đăng nhập vào đây.
      candidateId: '00000000-0000-0000-0000-000000000000',

      // parsedData là NOT NULL
      parsedData: {
        fileName: cvFile.originalname,
        status: 'Pending Extraction',
      },
    });
    const savedCv = await this.cvRepo.save(cv);

    // 3. GỌI API PYTHON (Tạm lập dữ liệu mock trước khi nối mạng với Python)
    const pythonAiResponse = {
      match_percentage: Math.floor(Math.random() * 35) + 60, // 60-95%
      is_qualified: true,
      overall: {
        summary: 'Ứng viên phù hợp với hầu hết các yêu cầu cốt lõi.',
        strengths: ['Backend', 'Kiến trúc hệ thống'],
        weaknesses: ['Thiếu kinh nghiệm Cloud'],
        improvement_notes: ['Học thêm AWS'],
      },
      matched_skills: [
        { name: 'NestJS', cv_level: 'Expert', jd_level: 'Expert' },
      ],
      missing_skills: [
        { name: 'AWS', importance: 'Critical', recommendation: 'Nên học AWS.' },
      ],
    };

    // 4. LƯU REPORT VÀO DATABASE THẬT
    const report = this.analysisRepo.create({
      cvId: savedCv.id,
      jdId: savedJd.id,
      isQualified: pythonAiResponse.is_qualified,
      matchPercentage: pythonAiResponse.match_percentage,
      overallAssessment: pythonAiResponse.overall,
      matchedSkillsSummary: pythonAiResponse.matched_skills,
      missingSkillsSummary: pythonAiResponse.missing_skills,
    });
    const savedReport = await this.analysisRepo.save(report);

    // 5. TRẢ VỀ CHO FRONTEND THEO ĐÚNG SCHEMA
    return {
      id: savedReport.id,
      match_percentage: savedReport.matchPercentage,
      is_qualified: savedReport.isQualified,
      overall: savedReport.overallAssessment,
      matched_skills: savedReport.matchedSkillsSummary,
      missing_skills: savedReport.missingSkillsSummary,
      created_at: savedReport.createdAt,
    };
  }

  async getHistory() {
    // Lấy toàn bộ từ DB, sắp xếp mới nhất lên đầu
    const results = await this.analysisRepo.find({
      order: { createdAt: 'DESC' },
    });

    return results.map((r) => ({
      id: r.id,
      match_percentage: r.matchPercentage,
      overall: r.overallAssessment,
      created_at: r.createdAt,
    }));
  }

  async getAnalysisById(id: string) {
    const r = await this.analysisRepo.findOne({ where: { id } });

    if (!r) {
      throw new NotFoundException('Report không tồn tại trong Database!');
    }

    return {
      id: r.id,
      match_percentage: r.matchPercentage,
      is_qualified: r.isQualified,
      overall: r.overallAssessment,
      matched_skills: r.matchedSkillsSummary,
      missing_skills: r.missingSkillsSummary,
      created_at: r.createdAt,
    };
  }
}
