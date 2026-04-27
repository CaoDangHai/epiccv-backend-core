import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RoadmapStep } from './roadmap-step.entity';

@Entity('roadmap_resources')
export class RoadmapResource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'roadmap_step_id' })
  roadmapStepId!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'Documentation',
    name: 'resource_type',
  })
  resourceType!: string;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  provider!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  duration!: string;

  @Column({ type: 'boolean', default: true, name: 'is_free' })
  isFree!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @ManyToOne(() => RoadmapStep, (step) => step.resources, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roadmap_step_id' })
  roadmapStep!: RoadmapStep;
}
