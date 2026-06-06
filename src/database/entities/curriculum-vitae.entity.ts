import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Candidate } from './candidate.entity';
import { AnalysisResult } from './analysis-result.entity';

@Entity('curriculum_vitaes')
export class CurriculumVitae {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'candidate_id' })
  candidateId!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 1,
    default: 0.0,
    name: 'total_exp_years',
  })
  totalExpYears!: number;

  @Column({ type: 'jsonb', nullable: true, name: 'work_history' })
  workHistory!: any[];

  @Column({ type: 'jsonb', nullable: true })
  education!: any[];

  @Column({ type: 'jsonb', nullable: true })
  projects!: any[];

  @Column({ type: 'jsonb', nullable: true })
  certifications!: any[];

  @Column({ type: 'jsonb', nullable: true })
  languages!: any[];

  @Column({ type: 'jsonb', nullable: true, name: 'top_strengths' })
  topStrengths!: string[];

  @Column({ type: 'jsonb', name: 'parsed_data' })
  parsedData!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Candidate, (candidate) => candidate.cvs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: Candidate;

  @OneToMany(() => AnalysisResult, (ar) => ar.cv)
  analysisResults!: AnalysisResult[];
}
