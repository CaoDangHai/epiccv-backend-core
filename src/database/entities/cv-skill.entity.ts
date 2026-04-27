import { Entity, Column, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { CurriculumVitae } from './curriculum-vitae.entity';
import { Skill } from './skill.entity';
import { SkillLevel } from '../../common/enums';

@Entity('cv_skills')
export class CvSkill {
  @PrimaryColumn({ type: 'uuid', name: 'cv_id' })
  cvId!: string;

  @PrimaryColumn({ type: 'int', name: 'skill_id' })
  skillId!: number;

  @Column({
    type: 'enum',
    enum: SkillLevel,
    default: SkillLevel.Unknown,
    name: 'level_name',
  })
  levelName!: SkillLevel;

  @Column({
    type: 'numeric',
    precision: 4,
    scale: 1,
    default: 0.0,
    name: 'years_of_experience',
  })
  yearsOfExperience!: number;

  @ManyToOne(() => CurriculumVitae, (cv) => cv.cvSkills, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cv_id' })
  cv!: CurriculumVitae;

  @ManyToOne(() => Skill, (skill) => skill.cvSkills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skill_id' })
  skill!: Skill;
}
