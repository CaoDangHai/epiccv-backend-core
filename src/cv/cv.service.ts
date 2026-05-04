import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm'; // ✅ Thêm DeepPartial
import axios from 'axios';
import FormData from 'form-data';

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
  response?: {
    data?: unknown;
    status?: number;
  };
  message?: string;
  code?: string;
}

@Injectable()
export class CvService {
  private readonly aiServerUrl: string;

  constructor(
    @InjectRepository(CurriculumVitae)
    private cvRepo: Repository<CurriculumVitae>,

    @InjectRepository(JobDescription)
    private jdRepo: Repository<JobDescription>,

    @InjectRepository(AnalysisResult)
    private analysisRepo: Repository<AnalysisResult>,
  ) {
    this.aiServerUrl = process.env.AI_SERVER_URL || 'http://localhost:8000';
  }

  /**
   * Main pipeline: Extract CV → Extract JD → Compare
   */
  async processCVFile(
    file: Express.Multer.File,
    candidateId: string,
    jdFile?: Express.Multer.File,
    jdText?: string,
  ) {
    try {
      const savedCv = await this.extractAndSaveCV(file, candidateId);
      const savedJd = await this.extractAndSaveJD(jdFile, jdText);
      const analysisResult = await this.compareCVAndJD(savedCv, savedJd);

      return {
        id: analysisResult.id,
        match_percentage: analysisResult.matchPercentage,
        overall: analysisResult.overallAssessment,
        matched_skills: analysisResult.matchedSkillsSummary,
        missing_skills: analysisResult.missingSkillsSummary,
        created_at: analysisResult.createdAt,
      };
    } catch (error) {
      console.error('❌ Lỗi trong pipeline xử lý CV:', error);
      throw this.handleError(error, 'Không thể hoàn thành quy trình phân tích CV');
    }
  }

  /**
   * Step 1: Extract CV từ file và lưu vào database
   */
  private async extractAndSaveCV(
    file: Express.Multer.File,
    candidateId: string,
  ): Promise<CurriculumVitae> {
    console.log('📄 Bước 1: Đang trích xuất thông tin từ CV...');

    // Step 1.1: Extract raw text từ file
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

    // Step 1.2: Gọi AI API để extract structured data
    let cvData: CVExtractionResponse;
    try {
      const formData = new FormData();
      
      // ✅ Gửi text đã extract dưới dạng file .txt UTF-8
      formData.append('file', Buffer.from(rawText, 'utf-8'), {
        filename: 'cv_extracted.txt',  
        contentType: 'text/plain; charset=utf-8',  
      });

      const response = await axios.post<CVExtractionResponse>(
        `${this.aiServerUrl}/ai/extract-cv`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            // ✅ Đảm bảo không có conflict headers
            'Content-Length': undefined, // Let FormData calculate
          },
        },
      );

      cvData = response.data;
      console.log('✅ Extract CV thành công:', {
        fullName: cvData.full_name,
        totalExperience: cvData.total_experience_years,
        skillsCount: cvData.skills?.length || 0,
      });
    } catch (error) {
      console.error('❌ Lỗi khi gọi API extract-cv:', error);
      throw this.handleError(error, 'Không thể trích xuất thông tin từ CV');
    }

  // Step 1.3: Lưu vào database (giữ nguyên)
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
        fileName: file.originalname || 'CV_Uploaded',
        fileType: file.mimetype || 'application/pdf',
        extractedData: cvData,
      },
    };

    const cv = this.cvRepo.create(cvInput);
    const savedCv = await this.cvRepo.save(cv);
    console.log('💾 Đã lưu CV vào database với ID:', savedCv.id);
    return savedCv;
  } catch (error) {
    console.error('❌ Lỗi khi lưu CV vào database:', error);
    throw new InternalServerErrorException('Không thể lưu CV vào database');
  }
}

  /**
   * Step 2: Extract JD từ file/text và lưu vào database
   */
  private async extractAndSaveJD(
    jdFile?: Express.Multer.File,
    jdText?: string,
  ): Promise<JobDescription> {
    console.log('📋 Bước 2: Đang trích xuất thông tin từ JD...');

    let rawJdText = jdText || '';
    let fileName = 'jd_extracted.txt';  
    let mimeType = 'text/plain; charset=utf-8';

    // Nếu có file JD, extract text từ file
    if (jdFile) {
      try {
        rawJdText = await extractTextFromFile(jdFile);
        fileName = jdFile.originalname?.replace(/\.\w+$/, '') + '_extracted.txt' || 'jd_extracted.txt';
        mimeType = 'text/plain; charset=utf-8';
      } catch (error) {
        throw new BadRequestException('Không thể đọc nội dung file JD');
      }
    }

    const trimmedJdText = rawJdText?.trim();
    if (!trimmedJdText || trimmedJdText.length < 10) { 
      console.error('❌ JD content too short:', {
        originalLength: rawJdText?.length,
        trimmedLength: trimmedJdText?.length,
        preview: rawJdText?.substring(0, 10),
      });
      throw new BadRequestException('Nội dung JD không hợp lệ hoặc quá ngắn để phân tích');
    }

    let jdData: JDExtractionResponse;
    try {
      const formData = new FormData();
      
      // ✅ FIX: Gửi JD dưới dạng file text (giống extract-cv)
      formData.append('file', Buffer.from(trimmedJdText, 'utf-8'), {  // ✅ Field name: 'file'
        filename: fileName,
        contentType: 'text/plain; charset=utf-8',
      });

      // ✅ Debug log: xem cái gì đang được gửi
      console.log('📤 Sending to /ai/extract-jd:', {
        url: `${this.aiServerUrl}/ai/extract-jd`,
        textLength: trimmedJdText.length,
        filename: fileName,
        preview: trimmedJdText.substring(0, 200) + '...',
      });

      const response = await axios.post<JDExtractionResponse>(
        `${this.aiServerUrl}/ai/extract-jd`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Content-Length': undefined,
          },
        },
      );

      jdData = response.data;
      console.log('✅ Extract JD thành công:', {
        jobTitle: jdData.job_title,
        companyName: jdData.company_name,
        requiredSkillsCount: jdData.required_skills?.length || 0,
      });
    } catch (error) {
      console.error('❌ Lỗi khi gọi API extract-jd:', error);
      
      // ✅ Log response data nếu có để debug
      if ((error as any).response?.data) {
        console.error('🔍 AI Response data:', (error as any).response.data);
      }
      
      throw this.handleError(error, 'Không thể trích xuất thông tin từ JD');
    }

    // Lưu vào database
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
          extractedData: jdData,
        },
      };

      const jd = this.jdRepo.create(jdInput);
      const savedJd = await this.jdRepo.save(jd);
      console.log('💾 Đã lưu JD vào database với ID:', savedJd.id);
      return savedJd;
    } catch (error) {
      console.error('❌ Lỗi khi lưu JD vào database:', error);
      throw new InternalServerErrorException('Không thể lưu JD vào database');
    }
  }

  /**
   * Step 3: So sánh CV và JD bằng AI
   */
  private sanitizeCvForCompare(cvData: any) {
    // chỉ giữ các field thường dùng để so sánh
    return {
      summary: cvData.summary ?? null,
      total_experience_years: cvData.total_experience_years ?? 0,
      top_strengths: cvData.top_strengths ?? [],
      skills: cvData.skills ?? [],
      work_history: cvData.work_history ?? [],
      education: cvData.education ?? [],
      projects: cvData.projects ?? [],
      certifications: cvData.certifications ?? [],
      awards : cvData.awards ?? [],
      languages: cvData.languages ?? [],
      
      
      
    };
  }

  private sanitizeJdForCompare(jdData: any) {
    return {
      job_title: jdData.job_title ?? null,
      company_name: jdData.company_name ?? null,
      job_location: jdData.job_location ?? null,
      employment_type: jdData.employment_type ?? null,

      salary_info: jdData.salary_info ?? null,
      required_skills: jdData.required_skills ?? null,
      soft_skills: jdData.soft_skills ?? null,
      
      min_total_experience_years: jdData.min_total_experience_years ?? null,
      preferred_seniority: jdData.preferred_seniority ?? null,
      education_requirements: jdData.education_requirements ?? null,

      job_context: jdData.job_context ?? null,
      responsibilities: jdData.responsibilities ?? null,
      requirements_summary: jdData.requirements_summary ?? null,
      benefits: jdData.benefits ?? null,
      
      industry_tags: jdData.industry_tags ?? null,
      tool_stack: jdData.tool_stack ?? null,

      
    };
  }


  private async compareCVAndJD(
    cv: CurriculumVitae,
    jd: JobDescription,
  ): Promise<AnalysisResult> {
    console.log('🔍 Bước 3: Đang so sánh CV với JD...');

    // Step 3.1: Prepare data từ database
    const cvData = cv.parsedData?.extractedData;
    const jdData = jd.parsedData?.extractedData;

    // // ✅ Debug: Kiểm tra data trước khi gửi
    // console.log('📦 Data chuẩn bị gửi đến AI compare:', {
    //   cvHasData: !!cvData,
    //   jdHasData: !!jdData,
    //   cvKeys: cvData ? Object.keys(cvData).slice(0, 10) : [],
    //   jdKeys: jdData ? Object.keys(jdData).slice(0, 10) : [],
    //   cvFullName: cvData?.full_name,
    //   jdTitle: jdData?.job_title,
    // });

    // ✅ Validate data
    if (!cvData || !jdData) {
      console.error('❌ Missing extracted data:', {
        cvParsedData: cv.parsedData,
        jdParsedData: jd.parsedData,
      });
      throw new BadRequestException('Dữ liệu CV hoặc JD chưa được trích xuất đúng cách');
    }

    let compareResult: CompareResponse;
    try {
      const payload = {
      cv_data: this.sanitizeCvForCompare(cvData),
      jd_data: this.sanitizeJdForCompare(jdData),
    };


      const response = await axios.post<CompareResponse>(
        `${this.aiServerUrl}/ai/compare`,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },

        },
      );

      // ✅ Check response status manually
      if (response.status >= 400) {
        console.error('❌ AI compare returned error status:', response.status, response.data);
        throw new Error(`AI compare failed with status ${response.status}: ${JSON.stringify(response.data)}`);
      }

      compareResult = response.data;
      
      // ✅ Validate response structure
      if (compareResult.is_qualified === undefined) {
        console.warn('⚠️ Compare response missing is_qualified field:', compareResult);
      }
      
      console.log('✅ So sánh thành công:', {
        isQualified: compareResult.is_qualified,
        matchPercentage: compareResult.match_percentage || compareResult.score,
        matchedSkillsCount: compareResult.matched_skills?.length || 0,
        missingSkillsCount: compareResult.missing_skills?.length || 0,
      });
      
    } catch (error: unknown) {
      console.error('❌ Lỗi khi gọi API compare:', error);
      
      // ✅ Enhanced error inspection
      if (axios.isAxiosError(error)) {
        console.error('🔍 AxiosError details:', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers,
          },
        });
        
        // ✅ Handle specific AI errors
        if (error.response?.status === 400) {
          throw new BadRequestException(
            `AI compare validation error: ${JSON.stringify(error.response.data)}`,
          );
        }
        if (error.response?.status === 422) {
          throw new BadRequestException(
            `AI compare data format error: ${JSON.stringify(error.response.data)}`,
          );
        }
        if (error.code === 'ECONNABORTED') {
          throw new InternalServerErrorException(
            'AI compare request timeout - dữ liệu quá phức tạp hoặc server quá tải',
          );
        }
      } else if (error instanceof Error) {
        console.error('🔍 Generic Error:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
      } else {
        console.error('🔍 Unknown error type:', typeof error, error);
      }
      
      throw this.handleError(error, 'Không thể so sánh CV với JD');
    }

    // Lưu kết quả vào database
    try {
      const matchScore = compareResult.match_percentage ?? compareResult.score ?? 0;

      const analysisInput: DeepPartial<AnalysisResult> = {
        cvId: cv.id,
        jdId: jd.id,
        isQualified: compareResult.is_qualified,
        matchPercentage: matchScore,
        overallAssessment: compareResult.overall as any,
        experienceAlignment: compareResult.experience_alignment || undefined,
        totalYearsGap: compareResult.total_years_gap || undefined,
        cultureFitAnalysis: compareResult.culture_fit as any,
        matchedSkillsSummary: compareResult.matched_skills as any[],
        missingSkillsSummary: compareResult.missing_skills as any[],
      };

      const report = this.analysisRepo.create(analysisInput);
      const savedReport = await this.analysisRepo.save(report);
      console.log('💾 Đã lưu kết quả phân tích vào database với ID:', savedReport.id);
      return savedReport;
    } catch (error) {
      console.error('❌ Lỗi khi lưu kết quả phân tích vào database:', error);
      throw new InternalServerErrorException(
        'Không thể lưu kết quả phân tích vào database',
      );
    }
  }

  /**
   * Helper: Xử lý lỗi từ AI API
   */
  private handleError(error: unknown, defaultMessage: string): Error {
  // ✅ Nếu đã là NestJS exception, return luôn
  if (error instanceof BadRequestException || 
      error instanceof InternalServerErrorException ||
      error instanceof NotFoundException) {
    return error as Error;
  }
  
  const err = error as AiErrorResponse;
  
  console.error('🔍 handleError received:', {
    errorType: typeof error,
    constructor: (error as any)?.constructor?.name,
    message: err.message,
    code: err.code,
    status: err.response?.status,
    data: err.response?.data,
  });

  if (err.response) {
    const status = err.response.status;
    const responseData = err.response.data;
    
    if (status === 400) {
      return new BadRequestException(
        typeof responseData === 'string' 
          ? responseData 
          : JSON.stringify(responseData) || 'Dữ liệu không hợp lệ',
      );
    }
    if (status === 422) {
      return new BadRequestException(
        `Validation error: ${JSON.stringify(responseData)}`,
      );
    }
    if (status === 500) {
      return new InternalServerErrorException(
        typeof responseData === 'string'
          ? responseData
          : 'AI Server gặp lỗi nội bộ',
      );
    }
  }

  return new InternalServerErrorException(
    err.message || defaultMessage,
  );
}

  /**
   * Get reports by candidate
   */
  async getReports(candidateId: string) {
    const results = await this.analysisRepo.find({
      relations: ['cv', 'jd'],
      where: { cv: { candidateId } },
      order: { createdAt: 'DESC' },
    });

    return results.map((r) => ({
      id: r.id,
      cvId: r.cvId,
      jdId: r.jdId,
      jobTitle: r.jd?.jobTitle,
      match_percentage: r.matchPercentage,
      is_qualified: r.isQualified,
      overall: r.overallAssessment,
      created_at: r.createdAt,
    }));
  }

  /**
   * Get analysis by ID
   */
  async getAnalysisById(id: string, candidateId: string) {
    const r = await this.analysisRepo.findOne({
      where: { id, cv: { candidateId } },
      relations: ['cv', 'jd'],
    });

    if (!r) {
      throw new NotFoundException(
        'Report không tồn tại hoặc không có quyền truy cập',
      );
    }

    return {
      id: r.id,
      cvId: r.cvId,
      jdId: r.jdId,
      jobTitle: r.jd?.jobTitle,
      companyName: r.jd?.companyName,
      match_percentage: r.matchPercentage,
      is_qualified: r.isQualified,
      overall: r.overallAssessment,
      experience_alignment: r.experienceAlignment,
      total_years_gap: r.totalYearsGap,
      culture_fit: r.cultureFitAnalysis,
      matched_skills: r.matchedSkillsSummary,
      missing_skills: r.missingSkillsSummary,
      created_at: r.createdAt,
    };
  }
}