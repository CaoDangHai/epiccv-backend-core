import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { JobDescription } from './job-description.entity';
import { Skill } from './skill.entity';
import { SkillLevel, RequirementPriority } from '../../common/enums';

@Entity('jd_skills')
export class JdSkill {
  @PrimaryColumn({ type: 'uuid', name: 'jd_id' })
  jdId!: string;

  @PrimaryColumn({ type: 'int', name: 'skill_id' })
  skillId!: number;

  @Column({
    type: 'enum',
    enum: SkillLevel,
    default: SkillLevel.Beginner,
    name: 'min_level',
  })
  minLevel!: SkillLevel;

  @Column({
    type: 'enum',
    enum: RequirementPriority,
    default: RequirementPriority.Essential,
  })
  priority!: RequirementPriority;

  @ManyToOne(() => JobDescription, (jd) => jd.jdSkills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jd_id' })
  jd!: JobDescription;

  @ManyToOne(() => Skill, (skill) => skill.jdSkills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill!: Skill;
}
