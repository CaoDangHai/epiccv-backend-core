-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('Beginner', 'Intermediate', 'Advanced', 'Expert', 'Unknown');

-- CreateEnum
CREATE TYPE "RequirementPriority" AS ENUM ('Critical', 'Essential', 'Desirable');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('Full Match', 'Partial Match', 'Missing', 'Exceeds');

-- CreateTable
CREATE TABLE "skills" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(50) NOT NULL DEFAULT 'Technical',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone_number" VARCHAR(20),
    "address" TEXT,
    "age" INTEGER,
    "social_links" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hash" TEXT NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_vitaes" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "summary" TEXT,
    "total_exp_years" DECIMAL(4,1) NOT NULL DEFAULT 0.0,
    "work_history" JSONB,
    "education" JSONB,
    "projects" JSONB,
    "certifications" JSONB,
    "languages" JSONB,
    "top_strengths" JSONB,
    "parsed_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_vitaes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_skills" (
    "cv_id" TEXT NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "level_name" "SkillLevel" NOT NULL DEFAULT 'Unknown',
    "years_of_experience" DECIMAL(4,1) NOT NULL DEFAULT 0.0,

    CONSTRAINT "cv_skills_pkey" PRIMARY KEY ("cv_id","skill_id")
);

-- CreateTable
CREATE TABLE "job_descriptions" (
    "id" TEXT NOT NULL,
    "job_title" VARCHAR(255) NOT NULL,
    "company_name" VARCHAR(255),
    "job_type" VARCHAR(50),
    "salary_range" JSONB,
    "experience_reqs" JSONB,
    "project_reqs" JSONB,
    "culture_fit" JSONB,
    "parsed_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jd_skills" (
    "jd_id" TEXT NOT NULL,
    "skill_id" INTEGER NOT NULL,
    "min_level" "SkillLevel" NOT NULL DEFAULT 'Beginner',
    "priority" "RequirementPriority" NOT NULL DEFAULT 'Essential',

    CONSTRAINT "jd_skills_pkey" PRIMARY KEY ("jd_id","skill_id")
);

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" TEXT NOT NULL,
    "cv_id" TEXT NOT NULL,
    "jd_id" TEXT NOT NULL,
    "is_qualified" BOOLEAN NOT NULL DEFAULT false,
    "match_percentage" DECIMAL(5,2),
    "overall_assessment" JSONB,
    "experience_alignment" TEXT,
    "total_years_gap" DECIMAL(4,1),
    "culture_fit_analysis" JSONB,
    "matched_skills_summary" JSONB,
    "missing_skills_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmaps" (
    "id" TEXT NOT NULL,
    "analysis_result_id" TEXT NOT NULL,
    "target_job_title" VARCHAR(255),
    "summary" TEXT,
    "difficulty" VARCHAR(50) NOT NULL DEFAULT 'Intermediate',
    "estimated_total_time" VARCHAR(50),
    "final_outcomes" JSONB,
    "mentor_advice" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_steps" (
    "id" TEXT NOT NULL,
    "roadmap_id" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "ui_color" VARCHAR(50) NOT NULL DEFAULT 'primary',
    "estimated_duration" VARCHAR(50),
    "key_topics" JSONB,
    "linked_skill_gaps" JSONB,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "roadmap_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadmap_resources" (
    "id" TEXT NOT NULL,
    "roadmap_step_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL DEFAULT 'Documentation',
    "url" TEXT NOT NULL,
    "provider" VARCHAR(100),
    "duration" VARCHAR(50),
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,

    CONSTRAINT "roadmap_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roadmaps_analysis_result_id_key" ON "roadmaps"("analysis_result_id");

-- AddForeignKey
ALTER TABLE "curriculum_vitaes" ADD CONSTRAINT "curriculum_vitaes_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_skills" ADD CONSTRAINT "cv_skills_cv_id_fkey" FOREIGN KEY ("cv_id") REFERENCES "curriculum_vitaes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_skills" ADD CONSTRAINT "cv_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jd_skills" ADD CONSTRAINT "jd_skills_jd_id_fkey" FOREIGN KEY ("jd_id") REFERENCES "job_descriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jd_skills" ADD CONSTRAINT "jd_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_cv_id_fkey" FOREIGN KEY ("cv_id") REFERENCES "curriculum_vitaes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_jd_id_fkey" FOREIGN KEY ("jd_id") REFERENCES "job_descriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_analysis_result_id_fkey" FOREIGN KEY ("analysis_result_id") REFERENCES "analysis_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_steps" ADD CONSTRAINT "roadmap_steps_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "roadmaps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadmap_resources" ADD CONSTRAINT "roadmap_resources_roadmap_step_id_fkey" FOREIGN KEY ("roadmap_step_id") REFERENCES "roadmap_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
