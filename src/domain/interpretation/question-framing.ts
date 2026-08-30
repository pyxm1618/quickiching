import type { InterpretationGoal, Scene } from "@/domain/casting/types";

// Layer 2 of the deep reading design: bind the user's stated situation to the
// cast. The user already chose a scene and a goal before casting, so this is a
// fixed mapping table rather than anything a model needs to infer.

export type QuestionFraming = {
  // What 体 (the querent) stands for in this scene, and what 用 (the matter
  // asked about) stands for. Ti-Yong is the classical hinge between question
  // and cast; these labels are how it is spoken about to the reader.
  tiMeaning: string;
  yongMeaning: string;
  // Modules the reading should weight most heavily for this goal.
  emphasis: readonly string[];
};

const SCENE_ROLES: Readonly<Record<Scene, { ti: string; yong: string }>> = Object.freeze({
  career: { ti: "你自身的能力与处境", yong: "这份工作、职位或机会本身" },
  relationships: { ti: "你自己", yong: "对方与你们之间的关系" },
  wealth: { ti: "你的资源与承受力", yong: "这笔财务安排或投入" },
  timing: { ti: "你当前的准备程度", yong: "你在等待的那个时机" },
  choices: { ti: "做选择的你", yong: "摆在面前的这个选项" },
  personal_growth: { ti: "现在的你", yong: "你想成为或改变的那部分" },
  other: { ti: "你自己", yong: "你所问的这件事" },
});

const GOAL_EMPHASIS: Readonly<Record<InterpretationGoal, readonly string[]>> = Object.freeze({
  what_do_i_need_to_see_clearly: ["oracleApplication", "structuralReading", "currentStage"],
  what_is_blocking_this_situation: ["obstacles", "structuralReading", "turningConditions"],
  what_should_i_understand_about_my_options: ["conditionalGuidance", "changeMechanism", "obstacles"],
  what_should_i_pay_attention_to_next: ["turningConditions", "changeMechanism", "conditionalGuidance"],
  is_the_timing_favorable: ["currentStage", "turningConditions", "changeMechanism"],
});

export function frameQuestion(scene: Scene, goal: InterpretationGoal): QuestionFraming {
  const roles = SCENE_ROLES[scene];
  return {
    tiMeaning: roles.ti,
    yongMeaning: roles.yong,
    emphasis: GOAL_EMPHASIS[goal],
  };
}
