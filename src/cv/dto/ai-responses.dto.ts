// DTOs cho CV Extraction
export interface SocialLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  other?: string[];
}

export interface Skill {
  name?: string;
  level?: string;
  years_of_experience?: number;
  category?: string;
  remark?: string[];
}

export interface Language {
  name: string;
  proficiency?: string;
}

export interface Experience {
  company?: string;
  position?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  description?: string[];
  skills_used?: string[];
}

export interface Education {
  school?: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  graduation_year?: number | string;
  is_current?: boolean;
  gpa?: number | string;
}

export interface Certification {
  title?: string;
  name?: string;
  organization?: string;
  issuer?: string;
  year?: string;
  issue_date?: string;
  expiry_date?: string;
  credential_url?: string;
}

export interface Award {
  title: string;
  issuer?: string;
  issue_date?: string;
  description?: string;
}

export interface Project {
  name?: string;
  description?: string[];
  tech_stack?: string[];
  link?: string;
}

export interface CVExtractionResponse {
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  age?: number | string;
  social_links?: SocialLinks;
  summary?: string;
  total_experience_years?: number;
  skills?: Skill[];
  work_history?: Experience[];
  education?: Education[];
  projects?: Project[];
  certifications?: Certification[];
  awards?: Award[];
  languages?: Language[];
  top_strengths?: string[];
  remark?: string[];
}

// DTOs cho JD Extraction
export interface JDSalary {
  min_val?: number;
  max_val?: number;
  currency?: string;
  is_negotiable?: boolean;
}

export interface JDSkillRequirement {
  name: string;
  category?: string;
  min_level?: string;
  priority?: string;
  min_years?: number;
  is_mandatory?: boolean;
  weight?: number;
}

export interface JDContext {
  role_mission: string;
  ideal_persona: string;
  working_culture?: string[];
  team_structure?: string;
  growth_opportunities?: string[];
}

export interface JDExtractionResponse {
  job_title: string;
  company_name?: string;
  job_location?: string;
  employment_type?: string;

  salary_info?: JDSalary;
  required_skills?: JDSkillRequirement[];
  soft_skills?: JDSkillRequirement[];

  min_total_experience_years?: number;
  preferred_seniority?: string;
  education_requirements?: string[];

  job_context?: JDContext;
  responsibilities?: string[];
  requirements_summary?: string[];
  benefits?: string[];
  
  industry_tags?: string[];
  tool_stack?: string[];
}

// DTOs cho Compare API
export interface SkillMatch {
  name: string;
  category?: string;
  level_cv?: string;
  level_jd_req?: string;
  years_of_experience?: number;
  match_status?: string;
  priority?: string;
  weight?: number;
  cv_evidence?: string;
  score?: number;
  remark?: string;
}

export interface SkillGap {
  name: string;
  importance?: string;
  weight?: number;
  gap_description?: string;
  recommendation?: string;
}

export interface CultureAndIndustryFit {
  culture_score?: number;
  vibe_check?: string;
  industry_relevance?: boolean;
}

export interface OverallAssessment {
  summary?: string;
  recommendation?: string;
  strengths?: string[];
  weaknesses?: string[];
}

export interface CompareResponse {
  is_qualified: boolean;
  score?: number;
  match_percentage?: number;
  overall?: OverallAssessment;
  experience_alignment?: string;
  total_years_gap?: number;
  culture_fit?: CultureAndIndustryFit;
  matched_skills?: SkillMatch[];
  missing_skills?: SkillGap[];
}