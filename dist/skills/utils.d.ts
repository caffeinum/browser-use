import { z } from 'zod';
import type { SkillDefinition, SkillParameterSchema } from './views.js';
export declare const get_skill_slug: (skill: SkillDefinition, all_skills: SkillDefinition[]) => string;
export declare const build_skill_parameters_schema: (parameters: SkillParameterSchema[], options?: {
    exclude_cookies?: boolean;
}) => z.ZodObject<Record<string, z.ZodTypeAny>>;
