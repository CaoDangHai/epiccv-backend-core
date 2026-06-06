import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { AnalysisResult } from './analysis-result.entity';

@Entity('job_descriptions')
export class JobDescription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, name: 'job_title' })
  jobTitle!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'company_name',
    default: 'Unknown',
  })
  companyName!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'job_location',
  })
  jobLocation!: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'employment_type',
    default: 'Full-time',
  })
  employmentType!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'salary_info' })
  salaryInfo!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'required_skills' })
  requiredSkills!: Record<string, any>[];

  @Column({ type: 'jsonb', nullable: true, name: 'soft_skills' })
  softSkills!: Record<string, any>[];

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 1,
    default: 0,
    name: 'min_total_exp_years',
  })
  minTotalExperienceYears!: number;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'preferred_seniority',
    default: 'Middle',
  })
  preferredSeniority!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'education_requirements' })
  educationRequirements!: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'job_context' })
  jobContext!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'responsibilities' })
  responsibilities!: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'requirements_summary' })
  requirementsSummary!: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'benefits' })
  benefits!: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'industry_tags' })
  industryTags!: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'tool_stack' })
  toolStack!: string[];

  @Column({ type: 'jsonb', name: 'parsed_data', nullable: true })
  parsedData!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  constructor(partial: Partial<JobDescription> = {}) {
    Object.assign(this, partial);
  }

  @OneToMany(() => AnalysisResult, (ar) => ar.jd)
  analysisResults!: AnalysisResult[];
}
