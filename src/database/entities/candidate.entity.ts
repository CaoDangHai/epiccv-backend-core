import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { CurriculumVitae } from './curriculum-vitae.entity';

@Entity('candidates')
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName!: string;

  @Column({ type: 'text', nullable: true, name: 'avatar_url' })
  avatarUrl!: string;

  @Column({
    type: 'text',
    nullable: true,
    name: 'password_hash',
    select: false,
  })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 50, default: 'local' })
  provider!: string;

  @Column({ type: 'boolean', default: false, name: 'is_verified' })
  isVerified!: boolean;

  @Column({
    type: 'varchar',
    length: 255,
    unique: true,
    nullable: true,
    name: 'mezon_id',
  })
  mezonId!: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'phone_number' })
  phoneNumber!: string;

  @Column({ type: 'text', nullable: true })
  address!: string;

  @Column({ type: 'int', nullable: true })
  age!: number;

  @Column({ type: 'jsonb', nullable: true, name: 'social_links' })
  socialLinks!: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => CurriculumVitae, (cv) => cv.candidate)
  cvs!: CurriculumVitae[];
}
