import type { HexagramResult } from "@/domain/casting/types";
import { hexagramByNumber } from "@/domain/casting/hexagrams/king-wen";

export type BasicHexagramInterpretation = {
  theme: string;
  summary: string;
};

// Original Quick I Ching prose. These are concise thematic glosses based on traditional hexagram
// structures and are not copied from a modern translation. See docs/PUBLIC_SEO_V1_PROVENANCE.md.
export const BASIC_HEXAGRAM_INTERPRETATIONS: Record<number, BasicHexagramInterpretation> = {
  1: { theme: "Creative force", summary: "Strong initiating energy favors purposeful action, but lasting progress depends on discipline, timing, and the ability to keep strength aligned with principle." },
  2: { theme: "Receptive support", summary: "The situation calls for responsiveness, patience, and steady support. Progress comes less from forcing events than from making room for what can genuinely develop." },
  3: { theme: "Difficulty at the beginning", summary: "Early disorder is part of formation. Clarify priorities, gather support, and build structure before expecting a new undertaking to move smoothly." },
  4: { theme: "Learning through uncertainty", summary: "Not knowing is the central condition. Ask carefully, learn from consequences, and replace impulsive certainty with disciplined inquiry." },
  5: { theme: "Waiting with purpose", summary: "Conditions are not fully ready. Prepare, conserve confidence, and use the interval well rather than treating delay as failure." },
  6: { theme: "Conflict", summary: "Competing positions are hardening. Define the real issue, limit unnecessary escalation, and consider where principled compromise or outside perspective can help." },
  7: { theme: "Organization and discipline", summary: "Collective effort needs clear roles, legitimate leadership, and restraint. Order matters more than enthusiasm when many forces must act together." },
  8: { theme: "Holding together", summary: "Connection is possible when commitments are sincere and timely. Examine what truly creates trust before joining, leading, or asking others to align." },
  9: { theme: "Small restraints", summary: "Minor limits can shape a larger outcome. Attend to details, relationships, and incremental preparation instead of trying to overpower the situation." },
  10: { theme: "Careful conduct", summary: "You may be moving near stronger forces or sensitive boundaries. Respect, awareness, and correct conduct reduce unnecessary risk." },
  11: { theme: "Flow and exchange", summary: "Different forces can cooperate productively. Use favorable circulation to strengthen foundations rather than assuming harmony will maintain itself." },
  12: { theme: "Stagnation", summary: "Connection is blocked and useful exchange is limited. Preserve integrity, avoid futile forcing, and watch for the conditions that could restore movement." },
  13: { theme: "Fellowship", summary: "Shared purpose can bring people together across narrower interests. Make the common ground explicit and keep cooperation open rather than factional." },
  14: { theme: "Great possession", summary: "Resources or influence are available. The question is how to use abundance responsibly, proportionately, and without letting possession become arrogance." },
  15: { theme: "Modesty", summary: "Balanced self-measurement supports durable progress. Reduce excess, acknowledge limits, and let competence show through consistent action rather than display." },
  16: { theme: "Enthusiasm", summary: "Energy can mobilize people and plans, but excitement needs direction. Build momentum around something real enough to sustain collective effort." },
  17: { theme: "Following", summary: "Adaptation is useful when it follows what is worthy rather than what is merely convenient. Notice which influence deserves commitment." },
  18: { theme: "Repairing what has decayed", summary: "Something inherited or neglected needs correction. Diagnose the source, accept responsibility for repair, and change the pattern rather than patching symptoms." },
  19: { theme: "Approach", summary: "Access and influence are increasing. Use proximity to understand, support, and prepare, remembering that favorable openings also have limits." },
  20: { theme: "Contemplation", summary: "Step back far enough to see the pattern and your own role in it. Observation becomes useful when it changes the quality of subsequent action." },
  21: { theme: "Biting through obstacles", summary: "A concrete obstruction requires clear discrimination and decisive handling. Apply only the degree of firmness needed to restore order." },
  22: { theme: "Grace and form", summary: "Presentation and form matter, but they should reveal rather than replace substance. Refine what is visible without confusing appearance with the core issue." },
  23: { theme: "Splitting apart", summary: "Support is being stripped away. Reduce exposure, protect what is essential, and avoid pretending a weakening structure can carry the same load." },
  24: { theme: "Return", summary: "A cycle is turning back toward its root. Small, genuine renewal matters more than dramatic correction; restore the right direction step by step." },
  25: { theme: "Uncontrived action", summary: "Act from what is straightforward and appropriate rather than from manipulation or overplanning. Unexpected events are easier to meet when motives remain clear." },
  26: { theme: "Great restraint", summary: "Substantial power is being contained and trained. Accumulate capability, knowledge, and resources so that later action is deliberate rather than premature." },
  27: { theme: "Nourishment", summary: "Pay attention to what sustains people, systems, and attention. What you take in—and what you repeatedly provide—shapes the condition that follows." },
  28: { theme: "Great excess", summary: "The structure is carrying unusual pressure. Ordinary measures may be insufficient, so identify the overloaded point and respond before strain becomes collapse." },
  29: { theme: "Repeated danger", summary: "Risk or uncertainty recurs. Reliability comes from learning the terrain, keeping to sound practice, and moving without denying the danger." },
  30: { theme: "Clarity and attachment", summary: "Illumination depends on what it is attached to. Choose sound objects of attention and make distinctions clearly without becoming consumed by brightness or certainty." },
  31: { theme: "Influence", summary: "Mutual responsiveness can change the situation without coercion. Notice what genuinely moves you and others, and keep influence reciprocal rather than manipulative." },
  32: { theme: "Duration", summary: "Continuity matters more than a burst of effort. Choose a course that can be maintained while allowing methods to adapt as circumstances change." },
  33: { theme: "Retreat", summary: "Stepping back can preserve position and clarity when direct engagement is unproductive. Withdrawal is strongest when it is timely, orderly, and purposeful." },
  34: { theme: "Great power", summary: "Capacity is high, which makes restraint more important. Use strength in proportion to the situation and avoid turning capability into unnecessary pressure." },
  35: { theme: "Progress", summary: "Visibility and forward movement are increasing. Use the opening to contribute clearly, build trust, and keep advancement connected to real value." },
  36: { theme: "Brightness concealed", summary: "An unfavorable environment may punish open display. Protect insight, stay inwardly clear, and choose carefully how much of your position to reveal." },
  37: { theme: "The family", summary: "Stable relationships depend on roles, boundaries, and example. Improve the immediate system of conduct before trying to correct the wider environment." },
  38: { theme: "Opposition", summary: "Differences are real and should not be blurred. Small areas of cooperation may still be possible when each side understands where alignment ends." },
  39: { theme: "Obstruction", summary: "The direct route is blocked. Reconsider direction, seek assistance, and use the obstacle as information about what the current approach cannot solve." },
  40: { theme: "Release", summary: "Tension can now be loosened. Resolve what is necessary, forgive what no longer needs carrying, and move promptly once the obstruction has actually cleared." },
  41: { theme: "Decrease", summary: "Deliberate reduction can restore balance. Let go of what is excessive so attention and resources can return to what is essential." },
  42: { theme: "Increase", summary: "Growth is available when benefits circulate rather than accumulate narrowly. Invest where added energy strengthens the whole situation." },
  43: { theme: "Breakthrough", summary: "A problem needs to be named openly and addressed firmly. Clarity should precede action, and determination should not become aggression." },
  44: { theme: "Coming to meet", summary: "A small but potent influence is entering the situation. Recognize its character early and set boundaries before attraction or convenience gives it disproportionate power." },
  45: { theme: "Gathering", summary: "People or resources can collect around a center. Shared purpose, preparation, and trustworthy leadership determine whether gathering becomes coherence or crowding." },
  46: { theme: "Pushing upward", summary: "Steady ascent is possible through modest, cumulative effort. Seek support, do the next workable thing, and let progress build from a sound base." },
  47: { theme: "Constraint", summary: "External room is limited, so inner steadiness matters. Distinguish what cannot currently be changed from the commitments you can still uphold." },
  48: { theme: "The well", summary: "A durable source of nourishment may already exist, but access and maintenance matter. Improve the shared resource and the means by which people draw from it." },
  49: { theme: "Revolution", summary: "Real change may require replacing an exhausted form, but legitimacy and timing are essential. Transform only when the case for change is mature and understood." },
  50: { theme: "The vessel", summary: "Raw material can be transformed into something of lasting value. Focus on the container, process, and culture that make refinement possible." },
  51: { theme: "Shock", summary: "A sudden disturbance demands presence rather than panic. Recover orientation quickly, learn what the shock reveals, and keep essential responsibilities intact." },
  52: { theme: "Keeping still", summary: "Stopping is appropriate when further motion would only add noise. Let attention settle, respect boundaries, and act again when stillness has clarified the next move." },
  53: { theme: "Gradual development", summary: "Progress is real but sequential. Build each stage so the next has something stable to rest on; rushing would weaken the development." },
  54: { theme: "Unequal position", summary: "You may be entering a situation without full authority or control. Understand the terms, protect dignity, and avoid assuming influence you do not yet possess." },
  55: { theme: "Abundance", summary: "Conditions are full and highly visible. Use the peak actively and responsibly, knowing that fullness is a phase rather than a permanent state." },
  56: { theme: "The traveler", summary: "You are operating without deep roots in the present setting. Keep aims modest, observe local conditions, and rely on good conduct more than entitlement." },
  57: { theme: "Gentle penetration", summary: "Persistent, subtle influence can reach places force cannot. Clarify the direction first, then reinforce it through repeated small actions." },
  58: { theme: "Joyous exchange", summary: "Open communication and shared pleasure can strengthen connection. Keep exchange sincere so enjoyment does not become flattery or avoidance." },
  59: { theme: "Dispersion", summary: "Rigid separation can dissolve when attention returns to a larger shared center. Remove barriers that no longer serve and rebuild connection deliberately." },
  60: { theme: "Limitation", summary: "Useful limits create form and prevent waste. Make constraints clear and proportionate; rules that become oppressive undermine the order they were meant to protect." },
  61: { theme: "Inner truth", summary: "Trust grows from inward sincerity matched by outward consistency. Listen carefully, test assumptions, and let credibility emerge from congruent action." },
  62: { theme: "Small exceeding", summary: "The situation favors careful attention to modest matters rather than grand moves. Precision, humility, and manageable steps are safer than overreach." },
  63: { theme: "After completion", summary: "A major transition has been achieved, but completion creates a new maintenance problem. Guard details and prevent success from turning into complacency." },
  64: { theme: "Before completion", summary: "The crossing is not finished. Keep distinctions clear, avoid premature celebration, and concentrate on the final conditions required for a sound transition." },
};

export function getBasicInterpretation(number: number): BasicHexagramInterpretation {
  const interpretation = BASIC_HEXAGRAM_INTERPRETATIONS[number];
  if (!interpretation) throw new Error(`BASIC_INTERPRETATION_MISSING: ${number}`);
  return interpretation;
}

export function describeChange(result: HexagramResult): string {
  if (result.movingLinePositions.length === 0) {
    return "No changing lines were produced. This reading therefore emphasizes the primary hexagram without deriving a separate relating hexagram.";
  }
  const positions = result.movingLinePositions.join(", ");
  return `Changing line${result.movingLinePositions.length > 1 ? "s" : ""} ${positions} mark where yin and yang reverse when the relating hexagram is derived. They identify the structural points of change; they do not guarantee a specific future event.`;
}

export function buildBasicReading(result: HexagramResult) {
  const primary = hexagramByNumber(result.primaryHexagramNumber);
  const primaryInterpretation = getBasicInterpretation(primary.number);
  const relating = result.relatingHexagramNumber === null ? null : hexagramByNumber(result.relatingHexagramNumber);
  const relatingInterpretation = relating ? getBasicInterpretation(relating.number) : null;
  return {
    primary,
    primaryInterpretation,
    changeExplanation: describeChange(result),
    relating,
    relatingInterpretation,
  };
}
