import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  MessageEvent,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import axios from 'axios';
import FormData from 'form-data';
import { Subject } from 'rxjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { CurriculumVitae } from '../database/entities/curriculum-vitae.entity';
import { JobDescription } from '../database/entities/job-description.entity';
import { AnalysisResult } from '../database/entities/analysis-result.entity';
import { extractTextFromFile } from '../utils/extractText';
import 'multer';
import {
  CVExtractionResponse,
  JDExtractionResponse,
  CompareResponse,
} from './dto/ai-responses.dto';

interface AiErrorResponse {
  response?: { data?: unknown; status?: number; };
  message?: string;
  code?: string;
}

@Injectable()
export class CvService {
  private readonly aiServerUrl: string;
  // Map lưu trữ luồng stream của từng Job
  private jobStreams = new Map<string, Subject<MessageEvent>>();

  constructor(
    @InjectRepository(CurriculumVitae) private cvRepo: Repository<CurriculumVitae>,
    @InjectRepository(JobDescription) private jdRepo: Repository<JobDescription>,
    @InjectRepository(AnalysisResult) private analysisRepo: Repository<AnalysisResult>,
  ) {
    this.aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';
  }

  // Khởi tạo Job và trả về JobID ngay lập tức
  async startProcessCV(
    file: Express.Multer.File,
    candidateId: string,
    jdFile?: Express.Multer.File,
    jdText?: string,
  ) {
    const jobId = crypto.randomUUID();
    const subject = new Subject<MessageEvent>();
    this.jobStreams.set(jobId, subject);

    // Chạy ngầm tiến trình
    this.processCVFileBackground(jobId, subject, file, candidateId, jdFile, jdText).catch(error => {
      console.error('❌ Lỗi trong pipeline xử lý CV:', error);
      subject.next({ data: { error: error.message || 'Lỗi không xác định' } });
      subject.complete();
      this.jobStreams.delete(jobId);
    });

    return { jobId };
  }

  // Frontend gọi hàm này để kết nối SSE
  getProgressStream(jobId: string) {
    const subject = this.jobStreams.get(jobId);
    if (!subject) throw new NotFoundException('Job không tồn tại hoặc đã hoàn thành');
    return subject.asObservable();
  }

  // Logic chạy ngầm, bắn tiến độ % liên tục
  private async processCVFileBackground(
    jobId: string,
    subject: Subject<MessageEvent>,
    file: Express.Multer.File,
    candidateId: string,
    jdFile?: Express.Multer.File,
    jdText?: string,
  ) {
    try {
      subject.next({ data: { progress: 10, message: 'Đang đọc nội dung CV...' } });
      const savedCv = await this.extractAndSaveCV(file, candidateId);

      subject.next({ data: { progress: 40, message: 'Đang đọc Job Description...' } });
      const savedJd = await this.extractAndSaveJD(jdFile, jdText);

      subject.next({ data: { progress: 70, message: 'AI đang phân tích độ phù hợp...' } });
      const analysisResult = await this.compareCVAndJD(savedCv, savedJd);

      subject.next({
        data: { progress: 100, message: 'Hoàn tất!', resultId: analysisResult.id }
      });
      subject.complete();
      this.jobStreams.delete(jobId);
    } catch (error) {
      subject.next({ data: { error: error instanceof Error ? error.message : 'Có lỗi xảy ra' } });
      subject.complete();
      this.jobStreams.delete(jobId);
    }
  }

  // --- CÁC HÀM CŨ GIỮ NGUYÊN HOÀN TOÀN ---
  private async extractAndSaveCV(file: Express.Multer.File, candidateId: string): Promise<CurriculumVitae> {
    let rawText: string;
    try { rawText = await extractTextFromFile(file); } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Không thể đọc nội dung file CV');
    }
    let cvData: CVExtractionResponse;
    try {
      const formData = new FormData();
      formData.append('file', Buffer.from(rawText, 'utf-8'), { filename: 'cv_extracted.txt', contentType: 'text/plain; charset=utf-8' });
      const response = await axios.post<CVExtractionResponse>(`${this.aiServerUrl}/ai/extract-cv`, formData, { headers: { ...formData.getHeaders(), 'Content-Length': undefined } });
      cvData = response.data;
    } catch (error) { throw this.handleError(error, 'Không thể trích xuất thông tin từ CV'); }

    let cvFileUrl: string | null = null;
    if (file && file.buffer) {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const savedFileName = `cv-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname || '.pdf') || '.pdf'}`;
      fs.writeFileSync(path.join(uploadDir, savedFileName), file.buffer);
      cvFileUrl = `http://localhost:3000/uploads/${savedFileName}`;
    }

    try {
      const cvInput: DeepPartial<CurriculumVitae> = {
        candidateId, summary: cvData.summary || undefined, totalExpYears: cvData.total_experience_years || 0,
        workHistory: cvData.work_history as any[], education: cvData.education as any[], projects: cvData.projects as any[],
        certifications: cvData.certifications as any[], languages: cvData.languages as any[], topStrengths: cvData.top_strengths || undefined,
        parsedData: { fileName: file.originalname || 'CV_Uploaded', fileType: file.mimetype || 'application/pdf', fileUrl: cvFileUrl, extractedData: cvData },
      };
      return await this.cvRepo.save(this.cvRepo.create(cvInput));
    } catch (error) { throw new InternalServerErrorException('Không thể lưu CV vào database'); }
  }

  private async extractAndSaveJD(jdFile?: Express.Multer.File, jdText?: string): Promise<JobDescription> {
    let rawJdText = jdText || '';
    let fileName = 'jd_extracted.txt';
    let mimeType = 'text/plain; charset=utf-8';
    if (jdFile) {
      try {
        rawJdText = await extractTextFromFile(jdFile);
        fileName = jdFile.originalname?.replace(/\.\w+$/, '') + '_extracted.txt' || 'jd_extracted.txt';
      } catch (error) { throw new BadRequestException('Không thể đọc nội dung file JD'); }
    }
    const trimmedJdText = rawJdText?.trim();
    if (!trimmedJdText || trimmedJdText.length < 10) throw new BadRequestException('Nội dung JD không hợp lệ hoặc quá ngắn');

    let jdData: JDExtractionResponse;
    try {
      const formData = new FormData();
      formData.append('file', Buffer.from(trimmedJdText, 'utf-8'), { filename: fileName, contentType: 'text/plain; charset=utf-8' });
      const response = await axios.post<JDExtractionResponse>(`${this.aiServerUrl}/ai/extract-jd`, formData, { headers: { ...formData.getHeaders(), 'Content-Length': undefined } });
      jdData = response.data;
    } catch (error) { throw this.handleError(error, 'Không thể trích xuất thông tin từ JD'); }

    let jdFileUrl: string | null = null;
    if (jdFile && jdFile.buffer) {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const savedFileName = `jd-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(jdFile.originalname || '.pdf') || '.pdf'}`;
      fs.writeFileSync(path.join(uploadDir, savedFileName), jdFile.buffer);
      jdFileUrl = `http://localhost:3000/uploads/${savedFileName}`;
    }

    try {
      const jdInput: DeepPartial<JobDescription> = {
        jobTitle: jdData.job_title || 'Unknown Position', companyName: jdData.company_name || 'Unknown', jobLocation: jdData.job_location || undefined,
        employmentType: jdData.employment_type || 'Full-time', salaryInfo: jdData.salary_info as any, requiredSkills: jdData.required_skills as any[],
        softSkills: jdData.soft_skills as any[], minTotalExperienceYears: jdData.min_total_experience_years || 0, preferredSeniority: jdData.preferred_seniority || 'Middle',
        educationRequirements: jdData.education_requirements || undefined, jobContext: jdData.job_context as any, responsibilities: jdData.responsibilities || undefined,
        requirementsSummary: jdData.requirements_summary || undefined, benefits: jdData.benefits || undefined, industryTags: jdData.industry_tags || undefined,
        toolStack: jdData.tool_stack || undefined, parsedData: { fileName, fileType: mimeType, fileUrl: jdFileUrl, extractedData: jdData },
      };
      return await this.jdRepo.save(this.jdRepo.create(jdInput));
    } catch (error) { throw new InternalServerErrorException('Không thể lưu JD vào database'); }
  }

  private sanitizeCvForCompare(cvData: any) {
    return {
      summary: cvData.summary ?? null, total_experience_years: cvData.total_experience_years ?? 0, top_strengths: cvData.top_strengths ?? [],
      skills: cvData.skills ?? [], work_history: cvData.work_history ?? [], education: cvData.education ?? [], projects: cvData.projects ?? [],
      certifications: cvData.certifications ?? [], awards: cvData.awards ?? [], languages: cvData.languages ?? []
    };
  }

  private sanitizeJdForCompare(jdData: any) {
    return {
      job_title: jdData.job_title ?? null, companyName: jdData.company_name ?? null, job_location: jdData.job_location ?? null,
      employment_type: jdData.employment_type ?? null, salary_info: jdData.salary_info ?? null, required_skills: jdData.required_skills ?? null,
      soft_skills: jdData.soft_skills ?? null, min_total_experience_years: jdData.min_total_experience_years ?? null, preferred_seniority: jdData.preferred_seniority ?? null,
      education_requirements: jdData.education_requirements ?? null, job_context: jdData.job_context ?? null, responsibilities: jdData.responsibilities ?? null,
      requirements_summary: jdData.requirements_summary ?? null, benefits: jdData.benefits ?? null, industry_tags: jdData.industry_tags ?? null, tool_stack: jdData.tool_stack ?? null
    };
  }

  private async compareCVAndJD(cv: CurriculumVitae, jd: JobDescription): Promise<AnalysisResult> {
    const cvData = cv.parsedData?.extractedData; const jdData = jd.parsedData?.extractedData;
    if (!cvData || !jdData) throw new BadRequestException('Dữ liệu CV hoặc JD chưa được trích xuất');

    let compareResult: CompareResponse;
    try {
      const payload = { cv_data: this.sanitizeCvForCompare(cvData), jd_data: this.sanitizeJdForCompare(jdData) };
      const response = await axios.post<CompareResponse>(`${this.aiServerUrl}/ai/compare`, payload, { headers: { 'Content-Type': 'application/json' } });
      compareResult = response.data;
    } catch (error: unknown) { throw this.handleError(error, 'Không thể so sánh CV với JD'); }

    try {
      const matchScore = compareResult.match_percentage ?? compareResult.score ?? 0;
      const analysisInput: DeepPartial<AnalysisResult> = {
        cvId: cv.id, jdId: jd.id, isQualified: compareResult.is_qualified, matchPercentage: matchScore,
        overallAssessment: compareResult.overall as any, experienceAlignment: compareResult.experience_alignment || undefined, totalYearsGap: compareResult.total_years_gap || undefined,
        cultureFitAnalysis: compareResult.culture_fit as any, matchedSkillsSummary: compareResult.matched_skills as any[], missingSkillsSummary: compareResult.missing_skills as any[],
        parsedData: { extractedData: compareResult },
      };
      return await this.analysisRepo.save(this.analysisRepo.create(analysisInput));
    } catch (error) { throw new InternalServerErrorException('Không thể lưu kết quả phân tích'); }
  }

  private handleError(error: unknown, defaultMessage: string): Error {
    if (error instanceof BadRequestException || error instanceof InternalServerErrorException || error instanceof NotFoundException) return error as Error;
    const err = error as AiErrorResponse;
    if (err.response) {
      const status = err.response.status; const responseData = err.response.data;
      if (status === 400) return new BadRequestException(typeof responseData === 'string' ? responseData : JSON.stringify(responseData));
      if (status === 422) return new BadRequestException(`Validation error: ${JSON.stringify(responseData)}`);
      if (status === 500) return new InternalServerErrorException(typeof responseData === 'string' ? responseData : 'AI Server lỗi');
    }
    return new InternalServerErrorException(err.message || defaultMessage);
  }

  async getReports(candidateId: string) {
    const results = await this.analysisRepo.find({ relations: ['cv', 'jd'], where: { cv: { candidateId } }, order: { createdAt: 'DESC' } });
    return results.map((r) => {
      const cvParsed = r.cv?.parsedData as any; const jdParsed = r.jd?.parsedData as any;
      return { id: r.id, cvId: r.cvId, jdId: r.jdId, cvName: cvParsed?.fileName || 'CV_Uploaded', jdName: r.jd?.jobTitle || jdParsed?.fileName || 'JD', jobTitle: r.jd?.jobTitle, match_percentage: r.matchPercentage, is_qualified: r.isQualified, overall: r.overallAssessment, created_at: r.createdAt };
    });
  }

  async getAnalysisById(id: string, candidateId: string) {
    const r = await this.analysisRepo.findOne({ where: { id, cv: { candidateId } }, relations: ['cv', 'jd'] });
    if (!r) throw new NotFoundException('Report không tồn tại');
    const cvParsed = r.cv?.parsedData as any; const jdParsed = r.jd?.parsedData as any;
    return { id: r.id, cvId: r.cvId, jdId: r.jdId, cvName: cvParsed?.fileName || 'CV_Uploaded', jdName: r.jd?.jobTitle || jdParsed?.fileName || 'JD', cvUrl: cvParsed?.fileUrl || null, jdUrl: jdParsed?.fileUrl || null, jobTitle: r.jd?.jobTitle, companyName: r.jd?.companyName, match_percentage: r.matchPercentage, is_qualified: r.isQualified, overall: r.overallAssessment, experience_alignment: r.experienceAlignment, total_years_gap: r.totalYearsGap, culture_fit: r.cultureFitAnalysis, matched_skills: r.matchedSkillsSummary, missing_skills: r.missingSkillsSummary, created_at: r.createdAt };
  }

  async getSavedCVs(candidateId: string) {
    const cvs = await this.cvRepo.find({ where: { candidateId }, order: { createdAt: 'DESC' }, take: 3 });
    return cvs.map(cv => ({
      id: cv.id,
      name: (cv.parsedData as any)?.fileName || 'CV_Uploaded.pdf',
      meta: `Tải lên lúc ${new Date(cv.createdAt).toLocaleDateString('vi-VN')}`,
      color: 'blue'
    }));
  }

  async deleteCV(id: string, candidateId: string) {
    const cv = await this.cvRepo.findOne({ where: { id, candidateId } });
    if (!cv) throw new NotFoundException('CV không tồn tại');
    await this.cvRepo.remove(cv);
    return { success: true };
  }

  async deleteAllHistory(candidateId: string) {
    const results = await this.analysisRepo.find({ where: { cv: { candidateId } } });
    await this.analysisRepo.remove(results);
    return { success: true };
  }
}