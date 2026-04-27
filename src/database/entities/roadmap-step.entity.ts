import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Roadmap } from './roadmap.entity';
import { RoadmapResource } from './roadmap-resource.entity';

@Entity('roadmap_steps')
export class RoadmapStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'roadmap_id' })
  roadmapId!: string;

  @Column({ type: 'int', name: 'order_index' })
  orderIndex!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'varchar', length: 50, default: 'primary', name: 'ui_color' })
  uiColor!: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'estimated_duration',
  })
  estimatedDuration!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'key_topics' })
  keyTopics!: string[];

  @Column({ type: 'jsonb', nullable: true, name: 'linked_skill_gaps' })
  linkedSkillGaps!: string[];

  @Column({ type: 'boolean', default: false, name: 'is_completed' })
  isCompleted!: boolean;

  @ManyToOne(() => Roadmap, (roadmap) => roadmap.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roadmap_id' })
  roadmap!: Roadmap;

  @OneToMany(() => RoadmapResource, (resource) => resource.roadmapStep)
  resources!: RoadmapResource[];
}
