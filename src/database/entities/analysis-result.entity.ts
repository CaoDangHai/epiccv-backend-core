import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { CurriculumVitae } from './curriculum-vitae.entity';
import { JobDescription } from './job-description.entity';
import { Roadmap } from './roadmap.entity';

@Entity('analysis_results')
export class AnalysisResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'cv_id' })
  cvId!: string;

  @Column({ type: 'uuid', name: 'jd_id' })
  jdId!: string;

  @Column({ type: 'boolean', default: false, name: 'is_qualified' })
  isQualified!: boolean;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'match_percentage',
  })
  matchPercentage!: number;

  @Column({ type: 'jsonb', nullable: true, name: 'overall_assessment' })
  overallAssessment!: Record<string, any>;

  @Column({ type: 'text', nullable: true, name: 'experience_alignment' })
  experienceAlignment!: string;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 1,
    nullable: true,
    name: 'total_years_gap',
  })
  totalYearsGap!: number;

  @Column({ type: 'jsonb', nullable: true, name: 'culture_fit_analysis' })
  cultureFitAnalysis!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'matched_skills_summary' })
  matchedSkillsSummary!: any[];

  @Column({ type: 'jsonb', nullable: true, name: 'missing_skills_summary' })
  missingSkillsSummary!: any[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => CurriculumVitae, (cv) => cv.analysisResults, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cv_id' })
  cv!: CurriculumVitae;

  @ManyToOne(() => JobDescription, (jd) => jd.analysisResults, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'jd_id' })
  jd!: JobDescription;

  // Quan hệ 1-1 với Roadmap
  @OneToOne(() => Roadmap, (roadmap) => roadmap.analysisResult)
  roadmap!: Roadmap;
}
