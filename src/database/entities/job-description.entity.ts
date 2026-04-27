import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { JdSkill } from './jd-skill.entity';
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
  })
  companyName!: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'job_type' })
  jobType!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'salary_range' })
  salaryRange!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'experience_reqs' })
  experienceReqs!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'project_reqs' })
  projectReqs!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'culture_fit' })
  cultureFit!: Record<string, any>;

  @Column({ type: 'jsonb', name: 'parsed_data' })
  parsedData!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => JdSkill, (jdSkill) => jdSkill.jd)
  jdSkills!: JdSkill[];

  @OneToMany(() => AnalysisResult, (ar) => ar.jd)
  analysisResults!: AnalysisResult[];
}
