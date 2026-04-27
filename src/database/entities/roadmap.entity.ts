import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { AnalysisResult } from './analysis-result.entity';
import { RoadmapStep } from './roadmap-step.entity';

@Entity('roadmaps')
export class Roadmap {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'analysis_result_id', unique: true })
  analysisResultId!: string;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
    name: 'target_job_title',
  })
  targetJobTitle!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string;

  @Column({ type: 'varchar', length: 50, default: 'Intermediate' })
  difficulty!: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'estimated_total_time',
  })
  estimatedTotalTime!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'final_outcomes' })
  finalOutcomes!: any[];

  @Column({ type: 'text', nullable: true, name: 'mentor_advice' })
  mentorAdvice!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToOne(() => AnalysisResult, (ar) => ar.roadmap, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'analysis_result_id' })
  analysisResult!: AnalysisResult;

  @OneToMany(() => RoadmapStep, (step) => step.roadmap)
  steps!: RoadmapStep[];
}
