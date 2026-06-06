import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JobDescription } from '../database/entities/job-description.entity';
import { extractTextFromFile } from '../utils/extractText';
import 'multer';

@Injectable()
export class JdService {
  constructor(
    @InjectRepository(JobDescription)
    private jdRepo: Repository<JobDescription>,
  ) {}

  async processJD(file?: Express.Multer.File, content?: string) {
    let rawText: string;
    let source: string;

    if (file) {
      try {
        rawText = await extractTextFromFile(file);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error
            ? error.message
            : 'Unable to read job description file content',
        );
      }
      source = 'file';
    } else {
      rawText = content!.trim();
      source = 'text';
    }

    const jd = this.jdRepo.create({
      jobTitle: 'Pending Extraction',
      parsedData: {
        fileName: file?.originalname || null,
        fileType: file?.mimetype || null,
        rawText,
        source,
        status: 'Extracted',
      },
    });

    const saved = await this.jdRepo.save(jd);
    return {
      id: saved.id,
      fileName: file?.originalname || null,
      source,
      rawText,
      status: 'Extracted',
      created_at: saved.createdAt,
    };
  }

  async getHistory() {
    const results = await this.jdRepo.find({ order: { createdAt: 'DESC' } });
    return results.map((result) => ({
      id: result.id,
      jobTitle: result.jobTitle,
      created_at: result.createdAt,
    }));
  }

  async getById(id: string) {
    const jd = await this.jdRepo.findOne({ where: { id } });
    if (!jd) throw new NotFoundException('Job description was not found');
    return {
      id: jd.id,
      jobTitle: jd.jobTitle,
      parsedData: jd.parsedData,
      created_at: jd.createdAt,
    };
  }
}
