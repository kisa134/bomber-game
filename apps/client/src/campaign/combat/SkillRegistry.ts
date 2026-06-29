import { UNIQUE_SKILLS, type Skill } from "./SkillSystem.js";

export class SkillRegistry {
  private static instance: SkillRegistry;
  private constructor() {}
  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) SkillRegistry.instance = new SkillRegistry();
    return SkillRegistry.instance;
  }
  getSkill(id: string): Skill | undefined {
    return UNIQUE_SKILLS[id];
  }
}
