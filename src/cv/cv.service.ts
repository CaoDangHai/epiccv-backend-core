import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import FormData from 'form-data';

import { CurriculumVitae } from '../database/entities/curriculum-vitae.entity';
import { JobDescription } from '../database/entities/job-description.entity';
import { AnalysisResult } from '../database/entities/analysis-result.entity';
import { extractTextFromFile } from '../utils/extractText';
import 'multer';

// Khai báo Interface (Fix lỗi ESLint)
interface AiErrorResponse {
  response?: {
    data?: unknown;
  };
  message?: string;
}

interface AiSuccessResponse {
  is_qualified: boolean;
  score?: number;
  match_percentage?: number;
  overall: Record<string, unknown>;
  matched_skills: unknown[];
  missing_skills: unknown[];
}

@Injectable()
export class CvService {
  constructor(
    @InjectRepository(CurriculumVitae)
    private cvRepo: Repository<CurriculumVitae>,

    @InjectRepository(JobDescription)
    private jdRepo: Repository<JobDescription>,

    @InjectRepository(AnalysisResult)
    private analysisRepo: Repository<AnalysisResult>,
  ) {}

  async processCVFile(
    file: Express.Multer.File,
    candidateId: string,
    jdFile?: Express.Multer.File,
    jdText?: string,
  ) {
    let rawText: string;
    try {
      rawText = await extractTextFromFile(file);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Không thể đọc nội dung file CV',
      );
    }

    let finalJdText = jdText || '';
    if (jdFile) {
      try {
        finalJdText = await extractTextFromFile(jdFile);
      } catch {
        throw new BadRequestException('Không thể đọc nội dung file JD');
      }
    }

    const jd = this.jdRepo.create({
      jobTitle: jdFile?.originalname || 'Target Role',
      parsedData: { text: finalJdText || 'File Uploaded' },
    });
    const savedJd = await this.jdRepo.save(jd);

    const cv = this.cvRepo.create({
      candidateId,
      parsedData: {
        fileName: file?.originalname || 'CV_Uploaded',
        fileType: file?.mimetype || 'application/pdf',
        rawText,
        status: 'Extracted',
      },
    });
    const savedCv = await this.cvRepo.save(cv);

    let aiResponse: AiSuccessResponse;
    try {
      console.log('Đang gửi dữ liệu sang AI Backend để phân tích...');
      const aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';
      const endpoint = `${aiServerUrl}/ai/full-pipeline`;

      const formData = new FormData();
      formData.append('cv_file', Buffer.from(rawText, 'utf-8'), {
        filename: 'cv_extracted.txt',
        contentType: 'text/plain',
      });
      formData.append('jd_file', Buffer.from(finalJdText, 'utf-8'), {
        filename: 'jd_extracted.txt',
        contentType: 'text/plain',
      });

      const response = await axios.post<AiSuccessResponse>(endpoint, formData, {
        headers: formData.getHeaders(),
      });

      aiResponse = response.data;
      console.log('✅ Phân tích thành công từ AI!');
    } catch (error: unknown) {
      const err = error as AiErrorResponse;
      console.error(
        '❌ Lỗi kết nối tới Backend AI Python:',
        err.message || 'Lỗi không xác định',
      );
      if (err.response) {
        console.error('Chi tiết lỗi từ AI:', err.response.data);
      }
      throw new InternalServerErrorException(
        'Không thể kết nối tới AI Engine để phân tích CV. Vui lòng kiểm tra lại server Python.',
      );
    }

    // Lấy score (bắt cả 2 trường hợp AI trả về key 'score' hoặc 'match_percentage')
    const matchScore = aiResponse.score ?? aiResponse.match_percentage ?? 0;

    const report = this.analysisRepo.create({
      cvId: savedCv.id,
      jdId: savedJd.id,
      isQualified: aiResponse.is_qualified,
      matchPercentage: matchScore,
      overallAssessment: aiResponse.overall,
      matchedSkillsSummary: aiResponse.matched_skills,
      missingSkillsSummary: aiResponse.missing_skills,
    });
    const savedReport = await this.analysisRepo.save(report);

    return {
      id: savedReport.id,
      match_percentage: savedReport.matchPercentage,
      overall: savedReport.overallAssessment,
      matched_skills: savedReport.matchedSkillsSummary,
      missing_skills: savedReport.missingSkillsSummary,
      created_at: savedReport.createdAt,
    };
  }

  async getReports(candidateId: string) {
    const results = await this.analysisRepo.find({
      relations: ['cv'],
      where: { cv: { candidateId } },
      order: { createdAt: 'DESC' },
    });
    return results.map((r) => ({
      id: r.id,
      match_percentage: r.matchPercentage,
      overall: r.overallAssessment,
      created_at: r.createdAt,
    }));
  }

  async getAnalysisById(id: string, candidateId: string) {
    const r = await this.analysisRepo.findOne({
      where: { id, cv: { candidateId } },
      relations: ['cv'],
    });

    if (!r)
      throw new NotFoundException(
        'Report không tồn tại hoặc không có quyền truy cập',
      );

    return {
      id: r.id,
      match_percentage: r.matchPercentage,
      overall: r.overallAssessment,
      matched_skills: r.matchedSkillsSummary,
      missing_skills: r.missingSkillsSummary,
      created_at: r.createdAt,
    };
  }
}
