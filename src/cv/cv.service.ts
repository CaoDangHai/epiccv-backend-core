/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  MessageEvent,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import FormData from 'form-data';
import { Subject } from 'rxjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { CurriculumVitae } from '../database/entities/curriculum-vitae.entity';
import { JobDescription } from '../database/entities/job-description.entity';
import { AnalysisResult } from '../database/entities/analysis-result.entity';
import { extractTextFromFile } from '../utils/extractText';
import { normalizeAiServerUrl, postToAi } from '../utils/aiClient';
import 'multer';
import {
  CVExtractionResponse,
  JDExtractionResponse,
  CompareResponse,
  SkillMatch,
} from './dto/ai-responses.dto';

interface AiErrorResponse {
  response?: { data?: unknown; status?: number };
  message?: string;
  code?: string;
}

interface ProcessCvPayload {
  cvFile?: Express.Multer.File;
  savedCvId?: string;
  candidateId: string;
  jdFile?: Express.Multer.File;
  jdText?: string;
}

@Injectable()
export class CvService {
  private readonly aiServerUrl: string;
  private readonly publicBaseUrl: string;
  private readonly jobStreams = new Map<string, Subject<MessageEvent>>();

  constructor(
    @InjectRepository(CurriculumVitae)
    private cvRepo: Repository<CurriculumVitae>,
    @InjectRepository(JobDescription)
    private jdRepo: Repository<JobDescription>,
    @InjectRepository(AnalysisResult)
    private analysisRepo: Repository<AnalysisResult>,
  ) {
    this.aiServerUrl = normalizeAiServerUrl(
      process.env.AI_SERVER_URL || 'http://localhost:8000',
    );
    this.publicBaseUrl =
      process.env.PUBLIC_BASE_URL ||
      `http://localhost:${process.env.PORT ?? 3000}`;
  }

  startProcessCV(payload: ProcessCvPayload) {
    const jobId = crypto.randomUUID();
    const subject = new Subject<MessageEvent>();
    this.jobStreams.set(jobId, subject);

    this.processCVBackground(jobId, subject, payload).catch((error: Error) => {
      console.error('CV analysis pipeline failed:', error);
      subject.next({
        data: { error: error.message || 'Unknown processing error' },
      });
      subject.complete();
      this.jobStreams.delete(jobId);
    });

    return { jobId };
  }

  getProgressStream(jobId: string) {
    const subject = this.jobStreams.get(jobId);
    if (!subject)
      throw new NotFoundException(
        'Job does not exist or has already completed',
      );
    return subject.asObservable();
  }

  private async processCVBackground(
    jobId: string,
    subject: Subject<MessageEvent>,
    payload: ProcessCvPayload,
  ) {
    try {
      const isUsingSavedCv = Boolean(payload.savedCvId);
      subject.next({
        data: {
          progress: 10,
          message: isUsingSavedCv
            ? 'Loading saved CV...'
            : 'Reading CV content...',
        },
      });

      const savedCv = await this.resolveCVForAnalysis(payload);

      subject.next({
        data: { progress: 40, message: 'Reading job description...' },
      });
      const savedJd = await this.extractAndSaveJD(
        payload.jdFile,
        payload.jdText,
      );

      subject.next({
        data: { progress: 70, message: 'Analyzing CV and job fit...' },
      });
      const analysisResult = await this.compareCVAndJD(savedCv, savedJd);

      subject.next({
        data: {
          progress: 100,
          message: 'Analysis complete!',
          resultId: analysisResult.id,
        },
      });
      subject.complete();
      this.jobStreams.delete(jobId);
    } catch (error) {
      subject.next({
        data: {
          error:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred',
        },
      });
      subject.complete();
      this.jobStreams.delete(jobId);
    }
  }

  private async resolveCVForAnalysis(
    payload: ProcessCvPayload,
  ): Promise<CurriculumVitae> {
    if (payload.savedCvId) {
      const savedCv = await this.cvRepo.findOne({
        where: { id: payload.savedCvId, candidateId: payload.candidateId },
      });

      if (!savedCv) throw new NotFoundException('Saved CV was not found');
      if (!(savedCv.parsedData as any)?.extractedData) {
        throw new BadRequestException(
          'Saved CV does not contain extracted data',
        );
      }

      return savedCv;
    }

    if (!payload.cvFile) {
      throw new BadRequestException('Provide a CV file or select a saved CV');
    }

    return this.extractAndSaveCV(payload.cvFile, payload.candidateId);
  }

  private async extractAndSaveCV(
    file: Express.Multer.File,
    candidateId: string,
  ): Promise<CurriculumVitae> {
    let rawText: string;
    try {
      rawText = await extractTextFromFile(file);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Unable to read CV file content',
      );
    }

    let cvData: CVExtractionResponse;
    try {
      cvData = await this.extractWithAi<CVExtractionResponse>(
        '/ai/extract-cv',
        rawText,
        'cv_extracted.txt',
      );
      cvData.raw_text = rawText;
    } catch (error) {
      throw this.handleError(error, 'Unable to extract CV information');
    }

    const cvFileUrl = this.saveUploadedFile(file, 'cv');

    try {
      const cvInput: DeepPartial<CurriculumVitae> = {
        candidateId,
        summary: cvData.summary || undefined,
        totalExpYears: cvData.total_experience_years || 0,
        workHistory: cvData.work_history as any[],
        education: cvData.education as any[],
        projects: cvData.projects as any[],
        certifications: cvData.certifications as any[],
        languages: cvData.languages as any[],
        topStrengths: cvData.top_strengths || undefined,
        parsedData: {
          fileName: file.originalname || 'Uploaded CV',
          fileType: file.mimetype || 'application/octet-stream',
          fileUrl: cvFileUrl,
          extractedData: cvData,
        },
      };

      return await this.cvRepo.save(this.cvRepo.create(cvInput));
    } catch {
      throw new InternalServerErrorException(
        'Unable to save CV to the database',
      );
    }
  }

  private async extractAndSaveJD(
    jdFile?: Express.Multer.File,
    jdText?: string,
  ): Promise<JobDescription> {
    let rawJdText = jdText || '';
    let fileName = 'jd_extracted.txt';
    let mimeType = 'text/plain; charset=utf-8';

    if (jdFile) {
      try {
        rawJdText = await extractTextFromFile(jdFile);
        fileName =
          jdFile.originalname?.replace(/\.\w+$/, '') + '_extracted.txt';
        mimeType = jdFile.mimetype || mimeType;
      } catch {
        throw new BadRequestException(
          'Unable to read job description file content',
        );
      }
    }

    const trimmedJdText = rawJdText?.trim();
    if (!trimmedJdText || trimmedJdText.length < 10) {
      throw new BadRequestException(
        'Job description content is invalid or too short',
      );
    }

    let jdData: JDExtractionResponse;
    try {
      jdData = await this.extractWithAi<JDExtractionResponse>(
        '/ai/extract-jd',
        trimmedJdText,
        fileName,
      );
      jdData.raw_text = trimmedJdText;
    } catch (error) {
      throw this.handleError(
        error,
        'Unable to extract job description information',
      );
    }

    const jdFileUrl = jdFile ? this.saveUploadedFile(jdFile, 'jd') : null;

    try {
      const jdInput: DeepPartial<JobDescription> = {
        jobTitle: jdData.job_title || 'Unknown Position',
        companyName: jdData.company_name || 'Unknown',
        jobLocation: jdData.job_location || undefined,
        employmentType: jdData.employment_type || 'Full-time',
        salaryInfo: jdData.salary_info as any,
        requiredSkills: jdData.required_skills as any[],
        softSkills: jdData.soft_skills as any[],
        minTotalExperienceYears: jdData.min_total_experience_years || 0,
        preferredSeniority: jdData.preferred_seniority || 'Middle',
        educationRequirements: jdData.education_requirements || undefined,
        jobContext: jdData.job_context as any,
        responsibilities: jdData.responsibilities || undefined,
        requirementsSummary: jdData.requirements_summary || undefined,
        benefits: jdData.benefits || undefined,
        industryTags: jdData.industry_tags || undefined,
        toolStack: jdData.tool_stack || undefined,
        parsedData: {
          fileName,
          fileType: mimeType,
          fileUrl: jdFileUrl,
          extractedData: jdData,
        },
      };

      return await this.jdRepo.save(this.jdRepo.create(jdInput));
    } catch {
      throw new InternalServerErrorException(
        'Unable to save job description to the database',
      );
    }
  }

  private async extractWithAi<T>(
    endpoint: string,
    text: string,
    filename: string,
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', Buffer.from(text, 'utf-8'), {
      filename,
      contentType: 'text/plain; charset=utf-8',
    });

    return postToAi<T>(this.aiServerUrl, endpoint, formData, {
      headers: { ...formData.getHeaders(), 'Content-Length': undefined },
    });
  }

  private saveUploadedFile(
    file: Express.Multer.File,
    prefix: 'cv' | 'jd',
  ): string | null {
    if (!file?.buffer) return null;

    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const extension = path.extname(file.originalname || '') || '.bin';
    const savedFileName = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    fs.writeFileSync(path.join(uploadDir, savedFileName), file.buffer);

    return `${this.publicBaseUrl}/uploads/${savedFileName}`;
  }

  private sanitizeCvForCompare(cvData: any) {
    return {
      summary: cvData.summary ?? null,
      raw_text: cvData.raw_text ?? null,
      total_experience_years: cvData.total_experience_years ?? 0,
      top_strengths: cvData.top_strengths ?? [],
      skills: cvData.skills ?? [],
      work_history: cvData.work_history ?? [],
      education: cvData.education ?? [],
      projects: cvData.projects ?? [],
      certifications: cvData.certifications ?? [],
      awards: cvData.awards ?? [],
      languages: cvData.languages ?? [],
    };
  }

  private sanitizeJdForCompare(jdData: any) {
    return {
      job_title: jdData.job_title ?? null,
      raw_text: jdData.raw_text ?? null,
      company_name: jdData.company_name ?? null,
      job_location: jdData.job_location ?? null,
      employment_type: jdData.employment_type ?? null,
      salary_info: jdData.salary_info ?? null,
      required_skills: jdData.required_skills ?? [],
      soft_skills: jdData.soft_skills ?? [],
      min_total_experience_years: jdData.min_total_experience_years ?? 0,
      preferred_seniority: jdData.preferred_seniority ?? null,
      education_requirements: jdData.education_requirements ?? [],
      job_context: jdData.job_context ?? null,
      responsibilities: jdData.responsibilities ?? [],
      requirements_summary: jdData.requirements_summary ?? [],
      benefits: jdData.benefits ?? [],
      industry_tags: jdData.industry_tags ?? [],
      tool_stack: jdData.tool_stack ?? [],
    };
  }

  private async compareCVAndJD(
    cv: CurriculumVitae,
    jd: JobDescription,
  ): Promise<AnalysisResult> {
    const cvData = (cv.parsedData as any)?.extractedData;
    const jdData = (jd.parsedData as any)?.extractedData;
    if (!cvData || !jdData) {
      throw new BadRequestException(
        'CV or job description data has not been extracted',
      );
    }

    let compareResult: CompareResponse;
    try {
      const payload = {
        cv_data: this.sanitizeCvForCompare(cvData),
        jd_data: this.sanitizeJdForCompare(jdData),
      };
      compareResult = await postToAi<CompareResponse>(
        this.aiServerUrl,
        '/ai/compare',
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error: unknown) {
      throw this.handleError(
        error,
        'Unable to compare CV with job description',
      );
    }

    try {
      const matchScore = this.normalizeMatchPercentage(compareResult);
      const normalizedCompareResult = {
        ...compareResult,
        score: matchScore,
        match_percentage: matchScore,
        overall: {
          ...(compareResult.overall || {}),
          match_percentage: matchScore,
        },
        matched_skills: this.normalizeMatchedSkills(
          compareResult.matched_skills || [],
        ),
      };

      const analysisInput: DeepPartial<AnalysisResult> = {
        cvId: cv.id,
        jdId: jd.id,
        isQualified: compareResult.is_qualified,
        matchPercentage: matchScore,
        overallAssessment: normalizedCompareResult.overall as any,
        experienceAlignment: compareResult.experience_alignment || undefined,
        totalYearsGap: compareResult.total_years_gap || undefined,
        cultureFitAnalysis: compareResult.culture_fit as any,
        matchedSkillsSummary: normalizedCompareResult.matched_skills as any[],
        missingSkillsSummary: compareResult.missing_skills as any[],
        parsedData: { extractedData: normalizedCompareResult },
      };

      return await this.analysisRepo.save(
        this.analysisRepo.create(analysisInput),
      );
    } catch {
      throw new InternalServerErrorException('Unable to save analysis result');
    }
  }

  private normalizeMatchedSkills(skills: SkillMatch[]) {
    return skills.map((skill) => ({
      ...skill,
      cv_level: skill.cv_level ?? skill.level_cv,
      jd_level: skill.jd_level ?? skill.level_jd_req,
    }));
  }

  private normalizeMatchPercentage(compareResult: CompareResponse): number {
    const score = this.toNumber(
      compareResult.match_percentage ?? compareResult.score,
    );
    const overallScore = this.toNumber(compareResult.overall?.match_percentage);

    let percent: number;
    if (score === undefined && overallScore === undefined) {
      percent = 0;
    } else if (
      score !== undefined &&
      score <= 1 &&
      overallScore !== undefined &&
      overallScore > 1
    ) {
      percent = overallScore;
    } else if (score !== undefined) {
      percent = score <= 1 ? score * 100 : score;
    } else {
      percent = overallScore!;
    }

    return Math.min(100, Math.max(0, Number(percent.toFixed(2))));
  }

  private toNumber(value: unknown): number | undefined {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private handleError(error: unknown, defaultMessage: string): Error {
    if (
      error instanceof BadRequestException ||
      error instanceof InternalServerErrorException ||
      error instanceof NotFoundException
    ) {
      return error as Error;
    }

    const err = error as AiErrorResponse;
    if (err.response) {
      const status = err.response.status;
      const responseData = err.response.data;
      if (status === 400) {
        return new BadRequestException(
          typeof responseData === 'string'
            ? responseData
            : JSON.stringify(responseData),
        );
      }
      if (status === 422) {
        return new BadRequestException(
          `Validation error: ${JSON.stringify(responseData)}`,
        );
      }
      if (status === 500) {
        return new InternalServerErrorException(
          typeof responseData === 'string' ? responseData : 'AI server error',
        );
      }
      if (status && [502, 503, 504].includes(status)) {
        return new InternalServerErrorException(
          'AI server is waking up or temporarily unavailable. Please try again shortly.',
        );
      }
    }

    return new InternalServerErrorException(err.message || defaultMessage);
  }

  async getReports(candidateId: string) {
    const results = await this.analysisRepo.find({
      relations: ['cv', 'jd'],
      where: { cv: { candidateId } },
      order: { createdAt: 'DESC' },
    });

    return results.map((result) => {
      const cvParsed = result.cv?.parsedData as any;
      const jdParsed = result.jd?.parsedData as any;
      return {
        id: result.id,
        cvId: result.cvId,
        jdId: result.jdId,
        cvName: cvParsed?.fileName || 'Uploaded CV',
        jdName: result.jd?.jobTitle || jdParsed?.fileName || 'Job Description',
        jobTitle: result.jd?.jobTitle,
        match_percentage: Number(result.matchPercentage) || 0,
        is_qualified: result.isQualified,
        overall: result.overallAssessment,
        created_at: result.createdAt,
      };
    });
  }

  async getAnalysisById(id: string, candidateId: string) {
    const result = await this.analysisRepo.findOne({
      where: { id, cv: { candidateId } },
      relations: ['cv', 'jd'],
    });
    if (!result) throw new NotFoundException('Report was not found');

    const cvParsed = result.cv?.parsedData as any;
    const jdParsed = result.jd?.parsedData as any;
    return {
      id: result.id,
      cvId: result.cvId,
      jdId: result.jdId,
      cvName: cvParsed?.fileName || 'Uploaded CV',
      jdName: result.jd?.jobTitle || jdParsed?.fileName || 'Job Description',
      cvUrl: cvParsed?.fileUrl || null,
      jdUrl: jdParsed?.fileUrl || null,
      jobTitle: result.jd?.jobTitle,
      companyName: result.jd?.companyName,
      match_percentage: Number(result.matchPercentage) || 0,
      is_qualified: result.isQualified,
      overall: result.overallAssessment,
      experience_alignment: result.experienceAlignment,
      total_years_gap: result.totalYearsGap,
      culture_fit: result.cultureFitAnalysis,
      matched_skills: result.matchedSkillsSummary,
      missing_skills: result.missingSkillsSummary,
      created_at: result.createdAt,
    };
  }

  async getSavedCVs(candidateId: string) {
    const cvs = await this.cvRepo.find({
      where: { candidateId },
      order: { createdAt: 'DESC' },
      take: 3,
    });

    return cvs.map((cv) => ({
      id: cv.id,
      name: (cv.parsedData as any)?.fileName || 'Uploaded CV',
      meta: `Uploaded on ${new Date(cv.createdAt).toLocaleDateString('en-US')}`,
      color: 'blue',
      created_at: cv.createdAt,
    }));
  }

  async deleteCV(id: string, candidateId: string) {
    const cv = await this.cvRepo.findOne({ where: { id, candidateId } });
    if (!cv) throw new NotFoundException('CV was not found');
    await this.cvRepo.remove(cv);
    return { success: true };
  }

  async deleteAllHistory(candidateId: string) {
    const results = await this.analysisRepo.find({
      where: { cv: { candidateId } },
    });
    await this.analysisRepo.remove(results);
    return { success: true };
  }
}
