import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { CvSkill } from './cv-skill.entity';
import { JdSkill } from './jd-skill.entity';

@Entity('skills')
export class Skill {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 50, default: 'Technical' })
  category!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  // Khóa ngoại ngược (Trỏ tới bảng phụ)
  @OneToMany(() => CvSkill, (cvSkill) => cvSkill.skill)
  cvSkills!: CvSkill[];

  @OneToMany(() => JdSkill, (jdSkill) => jdSkill.skill)
  jdSkills!: JdSkill[];
}
