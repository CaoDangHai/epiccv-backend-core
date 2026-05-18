export interface GenerateRoadmapResponseDto {
  id?: string;
  target_job_title: string;
  summary: string;
  difficulty: string;
  estimated_total_time: string;
  steps: RoadmapStepDto[];
  final_outcomes: LearningOutcomeDto[];
  mentor_advice?: string;
}

export interface LearningResourceDto {
  title: string;
  url: string;
  resource_type: string;
  duration?: string;
  description?: string;
}

export interface RoadmapStepDto {
  order: number;
  title: string;
  description: string;
  linked_skill_gaps: string[];
  focus_skills: string[];
  estimated_duration: string;
  key_topics: string[];
  resources: LearningResourceDto[];
  ui_color: string;
  is_completed: boolean;
}

export interface LearningOutcomeDto {
  skill_name: string;
  target_level: string;
  achieved_competencies: string[];
}