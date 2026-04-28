import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurriculumVitae } from '../database/entities/curriculum-vitae.entity';
import { extractTextFromFile } from '../utils/extractText';
import 'multer';

@Injectable()
export class CvService {
  constructor(
    @InjectRepository(CurriculumVitae)
    private cvRepo: Repository<CurriculumVitae>,
  ) {}

  async processCVFile(file: Express.Multer.File, candidateId: string) {
    let rawText: string;
    try {
      rawText = await extractTextFromFile(file);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Không thể đọc nội dung file',
      );
    }

    const cv = this.cvRepo.create({
      candidateId, // ← dùng candidateId thật từ token
      parsedData: {
        fileName: file.originalname,
        fileType: file.mimetype,
        rawText,
        status: 'Extracted',
      },
    });
    const saved = await this.cvRepo.save(cv);
    console.log("=========================CV=========================");
    console.log(rawText);
    return {
      id: saved.id,
      fileName: file.originalname,
      fileType: file.mimetype,
      rawText,
      status: 'Extracted',
      created_at: saved.createdAt,
    };
  }

  async getHistory(candidateId: string) {
    const results = await this.cvRepo.find({
      where: { candidateId }, // ← lọc theo candidateId
      order: { createdAt: 'DESC' },
    });
    return results.map((r) => ({
      id: r.id,
      fileName: r.parsedData?.fileName,
      created_at: r.createdAt,
    }));
  }

  async getAnalysisById(id: string) {
    const cv = await this.cvRepo.findOne({ where: { id } });
    if (!cv) throw new Error('CV không tồn tại');
    return {
      id: cv.id,
      fileName: cv.parsedData?.fileName,
      rawText: cv.parsedData?.rawText,
      created_at: cv.createdAt,
    };
  }
}