import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const SKILL_FILE_NAMES: Record<string, string> = {
    coach: "COACH.md",
    nutritionist: "NUTRITIONIST.md",
    shopper: "SHOPPER.md",
};

export class SkillLoader {
    private static cache: Map<string, string> = new Map();

    static load(skillName: string): string {
        const normalizedSkillName = skillName.trim().toLowerCase();

        if (this.cache.has(normalizedSkillName)) {
            return this.cache.get(normalizedSkillName)!;
        }

        const fileName = SKILL_FILE_NAMES[normalizedSkillName] ?? `${normalizedSkillName}.md`;
        const candidatePaths = [
            resolve(process.cwd(), "src", "skills", fileName),
            resolve(process.cwd(), "backend", "src", "skills", fileName),
            resolve(__dirname, "..", "skills", fileName),
        ];

        try {
            const skillPath = candidatePaths.find((path) => existsSync(path));

            if (!skillPath) {
                throw new Error(`Skill file "${fileName}" was not found`);
            }

            const content = readFileSync(skillPath, "utf-8");
            this.cache.set(normalizedSkillName, content);

            return content;
        } catch (error) {
            throw new Error(`Failed to load skill '${skillName}': ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    static clearCache(): void {
        this.cache.clear();
    }

    static preload(skillNames: string[]): void {
        skillNames.forEach(name => this.load(name));
    }
}
