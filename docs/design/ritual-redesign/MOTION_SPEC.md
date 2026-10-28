# MOTION_SPEC.md

## 0. Global Motion Rules

This specification applies only to the existing Quick I Ching casting flow shown in the supplied designs.

### 0.1 Scene continuity

The entire flow must remain inside one continuous visual scene:

```text
Home
→ Question Confirm
→ Casting
→ Casting Result
→ Record Line
→ Next Casting
→ ...
→ Sixth Line Complete
→ Auth / Save Gate when required
→ Saving / History persistence
→ Result Reveal
```

The following elements must **not** be replaced, crossfaded to another background, or treated as separate scenes:

- room environment;
- desk / altar;
- Bagua table;
- windows;
- books;
- incense burner;
- brushes;
- lamps;
- background lighting;
- global camera framing.

The environment is a persistent base layer.

Only the following may transition:

- foreground text/UI;
- three 3D coins;
- Heads / Tails labels;
- casting progress;
- six-line progress;
- existing particles;
- existing light trails;
- existing airflow / smoke-like energy;
- auth/save gate card;
- saving state inside the same gate language;
- final result card.

No camera fly-through, camera orbit, background zoom, scene cut, flash transition, portal transition, or newly invented effect is permitted.

### 0.2 Motion character

Motion should be:

```text
restrained
physical
smooth
ceremonial
continuous
predictable
```

Motion must not feel like:

```text
slot machine
loot box
arcade game
explosion
magic attack
casino animation
```

Avoid overshoot-heavy spring animation.

Primary easing:

```css
--ease-enter: cubic-bezier(0.22, 1, 0.36, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
--ease-settle: cubic-bezier(0.16, 1, 0.3, 1);
```

For Three.js numeric animation, equivalent easing functions may be implemented in JS.

### 0.3 Authoritative business result

The animation is **never responsible for determining Heads / Tails**.

Required order:

```text
1. User starts cast
2. Business layer determines authoritative 3-coin result
3. Result is stored in React/application state
4. Result is passed into the animation system
5. Three.js animates each coin toward the required face
6. Animation completes
7. The exact same stored result is displayed and recorded
```

Forbidden:

```text
coin physics → infer result
Math.random() → Heads/Tails inside Three.js
rotation count → determine result
particle seed → determine result
landing angle → determine result
animation frame timing → determine result
```

Visual randomness must never mutate or replace the authoritative result.

---

# 1. Home → Question Confirm

This section defines the transition from `ref-01-home-full-en.png` to `ref-02-question-full-en.png` for the normal question-first path.

## 1.1 Persistent scene

The following do not change:

- `public/ritual/bg-stage-master-clean.png` environment;
- Bagua table and room framing;
- global camera;
- shared site header/navigation;
- the user's current question value and character count.

Do not navigate through a blank intermediate page and do not replace the background.

## 1.2 Home-only UI exit

Treat the Home-only presentation as one coordinated group:

```text
hero headline / supporting copy
home-only decorative hero elements
home process/navigation strip
home-only supporting CTA copy
```

Exit:

```text
opacity: 1 → 0
translateY: 0 → -10px
scale: 1 → 0.99
duration: 240–280ms
easing: var(--ease-exit)
```

If decorative hero coins are rendered as Three.js objects, they may settle toward the Bagua origin and fade during this interval. They must **not** perform the authoritative casting animation yet.

## 1.3 Question card relocation / confirmation state

The question input state must preserve the exact typed value. Reuse the same logical form state; do not clear and recreate the question.

Transition the question card from its Home layout anchor into the centered Question Confirm anchor defined by `ref-02-question-full-en.png`.

Use DOM/layout anchors rather than hard-coded screen coordinates.

Recommended transform envelope:

```text
opacity: 1 → 1
translate: Home anchor → Question Confirm anchor
scale: 1 → 1.03–1.06 only if required by measured layout
 duration: 340–380ms
 easing: var(--ease-enter)
```

Do not interpolate font sizes independently during the movement. Prefer moving the container, then applying the final measured typography/layout values.

## 1.4 Question Confirm title / CTA entry

The `What Would You Like to Ask?` title group, explanatory copy, divider ornament, and `Cast the Coins` CTA enter as the Home-only content clears.

```text
opacity: 0 → 1
translateY: +10px → 0
duration: 300–340ms
delay: 100–140ms from transition start
easing: var(--ease-enter)
```

The input may remain continuously visible if implementation allows; do not flash or remount it unnecessarily.

## 1.5 Recommended timeline

```text
0ms        Start Divination / continue action accepted
0–260ms    Home-only UI exits
80ms       Question card begins relocation
120ms      Question Confirm title/CTA begins entering
~380ms     Question card reaches final anchor
~440ms     Question Confirm state is fully interactive
```

No cast result is generated by this transition. The authoritative three-coin result is created only when the user starts the actual cast.

---

# 2. Question → Casting

## 2.1 Persistent elements

The following remain unchanged during the transition:

- page background;
- environment objects;
- Bagua table;
- global scene lighting;
- header/navigation shell unless existing product implementation already changes navigation state;
- camera;
- background smoke already present in the design.

Do not fade the complete viewport.

## 2.2 Question UI exit

Treat the central Question interface as one primary transition group:

```text
brush title
supporting description
decorative divider / tai-chi icon
question input
character counter
Cast the Coins button
supporting text below button
```

Exit parameters:

```text
opacity: 1 → 0
translateY: 0 → -14px
scale: 1 → 0.985
duration: 240ms
easing: var(--ease-exit)
```

The elements do not need independent staggered exits.

The title may start approximately `30ms` before the input/button group, but the total difference should not exceed `60ms`.

Do not collapse layout while the exit animation is running.

After opacity reaches zero, remove the Question content from pointer interaction.

## 2.3 Casting UI entry

Existing Casting UI enters while the Question UI is finishing its exit.

Included:

```text
Back
Casting Coins...
casting description
existing decorative ink circle
existing cloud ornament
```

Entry parameters:

```text
opacity: 0 → 1
translateY: +12px → 0
scale: 0.99 → 1
duration: 320ms
delay from transition start: 120ms
easing: var(--ease-enter)
```

This produces a controlled overlap rather than:

```text
Question fully disappears
→ blank frame
→ Casting appears
```

There must be no blank intermediate scene.

## 2.4 Recommended transition timeline

```text
0ms      cast request accepted
0–240ms  Question UI exits
120ms     Casting UI begins entering
120–440ms Casting UI entrance
220ms     coin launch sequence may begin
```

The 3D motion can therefore begin before all Casting typography has completely settled.

---

# 3. Three-Coin Launch

## 3.1 Coordinate reference

Use the Bagua / yin-yang center on the desk as the persistent visual cast origin.

Define:

```text
D = rendered coin diameter
O = Bagua center cast origin
```

The coins should appear to rise from the central altar area, not from the viewport edge or directly from their final result positions.

Recommended initial local offsets:

```text
Coin A:
x = O.x - 0.32D
y = O.y
z = O.z + 0.05D

Coin B:
x = O.x
y = O.y + 0.04D
z = O.z

Coin C:
x = O.x + 0.32D
y = O.y - 0.03D
z = O.z + 0.03D
```

Exact world-unit values depend on camera and model scale.

The important constraint is:

```text
all three coins originate visually from the central Bagua casting area
```

They must not visibly spawn already floating in the center of the viewport.

## 3.2 Launch stagger

Base launch offsets:

```text
Coin A: 0ms
Coin B: +65ms
Coin C: +130ms
```

Permitted visual-only micro-variation:

```text
±15ms
```

Maximum interval between first and third launch:

```text
160ms
```

The three coins must still read as one single throw.

## 3.3 Vertical rise

Recommended peak elevation relative to the initial coin position:

```text
Coin A: 2.4D–2.8D
Coin B: 2.7D–3.1D
Coin C: 2.3D–2.7D
```

The difference exists only to prevent an artificial synchronized formation.

Do not create extreme height differences.

## 3.4 Lateral movement

During the rise, each coin may move laterally:

```text
0.55D–1.1D
```

Relative target directions should roughly reproduce the loose triangular arrangement visible in the Casting design.

Suggested visual distribution:

```text
Coin A → upper-left / center-left
Coin B → upper-right
Coin C → lower-right / center-right
```

Do not use perfectly symmetrical trajectories.

## 3.5 Initial tilt

Before launch, avoid perfectly parallel coin planes.

Recommended initial local orientation:

```text
rotationX: ±8°–16°
rotationY: ±5°–12°
rotationZ: ±3°–8°
```

Each coin should receive a slightly different orientation.

These values are purely visual.

## 3.6 Permitted randomness

Small visual differences are allowed for:

- launch delay;
- peak height;
- lateral offset;
- initial tilt;
- rotation velocity;
- precession;
- particle distribution.

Randomization must remain within the ranges in this specification.

Prefer generating one `visualSeed` when the cast begins.

Example conceptual separation:

```ts
authoritativeResult = ["heads", "tails", "tails"]
visualSeed = createVisualSeed()
```

`visualSeed` must not be used by the casting/business logic.

---

# 4. Three-Coin 3D Flip

## 4.1 Rendering requirement

Coins must be actual 3D meshes.

Minimum geometry characteristics:

- non-zero thickness;
- visible outer edge;
- central square-hole depth;
- separate Heads face;
- separate Tails face;
- edge material / texture;
- physically coherent lighting.

Forbidden implementation:

```text
<img> rotateZ(...)
CSS 2D card flip pretending to be a coin
single flat PlaneGeometry
sprite sheet rotation
```

Three.js should own coin transform and final orientation.

## 4.2 Rotation model

The main flip must occur around a local axis approximately parallel to the coin surface.

The motion must combine:

```text
dominant flip rotation
+
moderate secondary precession
+
small longitudinal roll
```

Recommended accumulated rotation during one throw:

```text
dominant local X / tangent axis:
720°–1080°

secondary Y:
140°–320°

Z:
40°–130°
```

The precise dominant world axis may change according to camera and initial orientation.

The important visual rule is:

```text
the coin must repeatedly expose face → edge → opposite face → edge
```

A spinning coin whose face always remains visible is incorrect.

## 4.3 Rotation rhythm

Rotation speed must not remain constant.

Recommended normalized phases:

```text
0.00–0.18   acceleration
0.18–0.62   highest angular velocity
0.62–0.82   gradual reduction
0.82–1.00   controlled final orientation / settle
```

Angular velocity should feel physically related to vertical motion.

Peak rotation should occur around the ascending / apex portion of the trajectory.

## 4.4 Total motion duration

Per coin:

```text
1450–1580ms
```

With stagger, the full three-coin motion finishes in approximately:

```text
1580–1720ms
```

Recommended default:

```text
Coin A: 1520ms
Coin B: 1500ms
Coin C: 1540ms
```

Do not slow the third coin dramatically for emphasis.

## 4.5 Authoritative Heads / Tails landing

Before Three.js begins motion, every coin must already have:

```ts
coin.targetFace = "heads" | "tails";
```

The animation system receives this value but cannot modify it.

Define canonical final orientations:

```text
qHeads
qTails
```

where:

```text
qHeads = Heads face directed toward intended viewing direction
qTails = Tails face directed toward intended viewing direction
```

A small visual landing tilt may then be applied:

```text
pitch: maximum ±5°
yaw: maximum ±6°
roll: maximum ±4°
```

The tilt must not make the visible side ambiguous.

## 4.6 Final-rotation implementation

Do not rely on a free rigid-body simulation to determine the landing side.

Recommended implementation:

### Phase A — visual free spin

Approximately:

```text
0–72% of animation
```

Use controlled procedural 3D motion.

### Phase B — guided landing

Approximately:

```text
72–100%
```

Transition toward the predetermined final orientation.

Use unwrapped rotation values or another interpolation method that preserves the intended number of turns.

Do not use a naïve shortest-path quaternion slerp for the complete throw if it removes the visible rotations.

Conceptual model:

```text
finalFlipAngle =
    fullTurns * 360°
    + faceParity
    + landingTilt
```

where `faceParity` is derived from the previously determined `targetFace`.

The final rendered frame should explicitly set the exact target transform.

Example:

```ts
coin.quaternion.copy(finalTargetQuaternion);
```

This prevents numerical drift.

## 4.7 No result reroll

The following pattern is forbidden:

```ts
if (coin.rotation.x % 360 > 180) {
  result = "tails";
}
```

Correct direction:

```ts
const result = castResult.coins[index];

animateCoinToFace(result);
```

Animation consumes the result.

Animation never creates the result.

---

# 5. Particles, Light Trails and Airflow

Only effects already visible in the supplied Casting design may be implemented.

Do not introduce:

- lightning;
- sparks exploding across the screen;
- magical runes;
- fire;
- shockwaves;
- new floating symbols;
- full-screen bloom flashes;
- new smoke columns.

## 5.1 Start timing

Particle/light activity may begin:

```text
40–100ms before first coin launch
```

Initial intensity must be low.

Intensity rises with the coins.

## 5.2 Peak timing

Maximum visual intensity should occur approximately around:

```text
45–65% of the coin animation
```

This corresponds roughly to the airborne / fast-spin phase.

## 5.3 Duration

Recommended effect lifetime:

```text
1500–1950ms
```

Effects may persist briefly after the first coin settles but must be almost completely gone before result interaction begins.

## 5.4 Particle density

Keep density restrained.

Recommended visible simultaneous particle count at Desktop target resolution:

```text
40–90 primary glowing particles
```

Optional micro-particles:

```text
maximum 120
```

provided they remain visually subtle.

Do not generate a dense particle cloud around the coins.

## 5.5 Distribution

Particles should concentrate around:

```text
Bagua center
coin trajectories
lower 30–50% of the coin orbit
```

Recommended distribution:

```text
60–70% around central casting volume
20–30% following coin paths
≤10% drifting outside the core area
```

No particle should intentionally cover an entire coin face.

## 5.6 Particle size

Recommended projected size:

```text
primary particles: 1.5–4px
rare highlights: 4–6px
```

Large glowing blobs are not permitted.

## 5.7 Particle speed

Approximate visual velocity:

```text
slow drift: 15–35 px/s
active orbit: 45–90 px/s
rare streak particle: ≤130 px/s
```

Avoid high-speed projectile behavior.

## 5.8 Opacity

Typical:

```text
0.15–0.50
```

Rare local highlight:

```text
maximum 0.70
```

Do not allow the particle system to create a white/gold opaque mass.

## 5.9 Light trails

Each coin may receive a thin existing-style light trace.

Trail principles:

```text
short-lived
curved
warm gold
semi-transparent
strongest around fast motion
```

Recommended trail history:

```text
180–320ms
```

Trail alpha:

```text
0.08–0.35
```

The trail must remain visually secondary to the coin.

## 5.10 Airflow

Existing airflow / light-smoke forms may curl upward from the Bagua center.

Motion:

```text
slow vertical rise
small radial curvature
low opacity
```

Recommended lifetime:

```text
700–1300ms per strand
```

Opacity:

```text
0.06–0.22
```

Do not obscure labels or coin textures.

## 5.11 Dissipation

Once a coin enters its final settling phase:

```text
particle emission rate decreases by 60–80%
```

After the final coin settles:

```text
stop new emission within 100ms
fade remaining particles over 260–420ms
fade trails over 180–280ms
fade active airflow over 300–500ms
```

Residual environmental smoke already belonging to the background is unaffected.

---

# 6. Casting → Casting Result

## 6.1 Deceleration

Coin angular deceleration begins approximately:

```text
72% through each coin animation
```

Use controlled easing rather than abrupt braking.

Recommended easing:

```text
cubic-bezier(0.16, 1, 0.3, 1)
```

## 6.2 Descent

Coins should pass naturally from ascent to descent.

Do not insert a hovering pause at the apex.

Recommended trajectory:

```text
0–46%       rise
46%         approximate apex
46–82%      descent
82–100%     positioning and settle
```

## 6.3 Result layout transition

During the final descent, coins move toward the three fixed result positions shown in the Casting Result design.

Final layout:

```text
left coin
center coin
right coin
```

The coins should end on one shared visual baseline.

Use the actual responsive layout anchors from the Result UI rather than hard-coded screen pixels wherever possible.

## 6.4 Landing

Landing should be controlled, not physically chaotic.

At contact:

```text
vertical velocity → 0
angular velocity → 0
target orientation locked
```

## 6.5 Bounce

One very small bounce is permitted.

Maximum:

```text
vertical rebound: 0.04D–0.07D
duration: 90–140ms
```

No second visible bounce should normally occur.

No coin may bounce into another coin.

No exaggerated spring easing.

If visual testing shows the bounce reduces fidelity to the reference, disable it.

## 6.6 Casting title exit

Existing `Casting Coins...` title group exits near the final settling phase.

Recommended:

```text
opacity: 1 → 0
translateY: 0 → -8px
duration: 180ms
easing: var(--ease-exit)
```

Start:

```text
~100ms before final coin settle
```

## 6.7 Casting Result title entry

Existing result header:

```text
Step X of 6
Casting Result
description
```

Entry:

```text
opacity: 0 → 1
translateY: +10px → 0
duration: 260ms
easing: var(--ease-enter)
```

Start approximately:

```text
60ms after final coin settles
```

## 6.8 Heads / Tails labels

Labels must not appear before the corresponding coin face is completely stable.

Sequence:

```text
coin settles
+100–140ms
label appears
```

Label entrance:

```text
opacity: 0 → 1
translateY: +6px → 0
duration: 180ms
easing: var(--ease-enter)
```

The labels must be derived directly from the same authoritative result used to orient the coins.

## 6.9 Record This Cast

`Record This Cast` enters after all three result labels are visible.

Recommended timing:

```text
last label begins
+120ms
button begins entrance
```

Entrance:

```text
opacity: 0 → 1
translateY: +8px → 0
scale: 0.985 → 1
duration: 220ms
easing: var(--ease-enter)
```

Enable pointer interaction only after:

```text
opacity >= 0.9
```

or when the entrance animation completes.

## 6.10 Complete cast timeline

Approximate timeline from first coin launch:

```text
0ms        Coin A launches
65ms       Coin B launches
130ms      Coin C launches

~700ms     coins near apex / maximum visual energy

~1150ms    controlled descent / orientation convergence

~1520ms    Coin A settles
~1565ms    Coin B settles
~1650ms    Coin C settles

~1710ms    Casting Result heading enters
~1770ms    labels begin
~2070ms    Record This Cast available
```

A complete cast should normally become actionable approximately:

```text
2.0–2.2 seconds
```

after the throw begins.

---

# 7. Six-Cast Loop

## 7.1 Line order

Six lines must be recorded strictly from bottom to top.

Internal ordering:

```text
cast 1 → line 1 → bottom line
cast 2 → line 2
cast 3 → line 3
cast 4 → line 4
cast 5 → line 5
cast 6 → line 6 → top line
```

Do not visually reverse this ordering.

## 7.2 Recording a cast

When the user activates `Record This Cast`:

```text
1. freeze current authoritative cast result
2. derive the I Ching line value using existing business logic
3. persist/update cast state
4. mark current line as complete
5. update six-line progress UI
6. transition into next cast if castIndex < 6
```

Motion must not delay persistence until after a new random result has been generated.

## 7.3 Progress-line entrance

When one line is recorded:

```text
new line opacity: 0 → 1
scaleX: 0.92 → 1
duration: 220ms
easing: var(--ease-enter)
```

If the existing design contains an active gold glow, it may briefly rise and settle:

```text
opacity/intensity peak duration: ≤180ms
```

Do not add a new pulse effect if no glow exists in the implementation.

## 7.4 Transition to next casting

For casts 1–5:

Current result UI exits:

```text
Heads/Tails labels:
opacity 1 → 0
translateY 0 → +5px
duration 150ms

Record button:
opacity 1 → 0
translateY 0 → +6px
duration 160ms

result heading:
opacity 1 → 0
translateY 0 → -8px
duration 180ms
```

Coins then return to the Bagua cast origin.

Recommended return motion:

```text
opacity: 1 → 0.85 → 1
position: result anchors → cast origin
scale: 1 → 0.94 → 1
duration: 300–360ms
easing: var(--ease-standard)
```

The coin models should not disappear and respawn in unrelated positions unless implementation constraints require it.

If reinitialization is technically necessary, perform the model reset while opacity is near its minimum so no teleport is visible.

## 7.5 Next Casting heading

The normal Casting heading re-enters during coin reset:

```text
delay: 120ms
duration: 260ms
opacity: 0 → 1
translateY: +8px → 0
```

The next throw may become available after the reset completes.

## 7.6 Reset between casts

Reset:

```text
coin world positions
coin angular velocity
temporary coin orientation
particle emitters
light trail history
airflow emitters
temporary result labels
temporary local animation timers
visual seed
```

Preserve:

```text
original user question
completed authoritative casts
completed six-line state
current cast number
derived line values
authentication/session state
completed storage state
background scene
camera
environment
```

## 7.7 Rhythm consistency

All six casts use essentially the same timing.

Do not progressively slow the flow.

Permitted timing variation:

```text
maximum ±5%
```

Do not make:

```text
cast 1 = 2 seconds
cast 6 = 4 seconds
```

The sixth throw may receive only the separate post-completion transition described below.

---

# 8. Sixth Line → Auth / Save Gate → Result Reveal

## 8.1 Sixth line completion

When cast 6 is recorded:

```text
line 6 fills
all six line states become complete
```

Line 6 uses the same completion motion as earlier lines. Do not invent a special explosive completion animation.

## 8.2 Coin exit

After the sixth line is successfully committed:

```text
delay: 180–260ms
opacity: 1 → 0
translateY: 0 → -10px
scale: 1 → 0.96
duration: 280ms
easing: var(--ease-exit)
```

Particles stop emitting immediately; residual particles fade over `300–420ms`.

Do not throw coins offscreen and do not change the persistent room/background.

## 8.3 Six-line completion hold

The complete six-line state remains visible for:

```text
260–400ms
```

This establishes continuity before the save/auth state.

## 8.4 Authoritative result / persistence pipeline

The existing application business pipeline remains authoritative:

```text
six authoritative line results
↓
existing hexagram derivation
↓
authentication requirement check
↓
History / persistence save
↓
existing reading / interpretation request
↓
final result data
```

Motion must not contain authentication, persistence, hexagram derivation, or interpretation logic.

## 8.5 Auth-required gate

When authentication is required, enter the approved gate shown in `ref-06-auth-save-gate-full-en.png` over the same room background.

The Gate card enters as one coherent element:

```text
opacity: 0 → 1
translateY: +16px → 0
scale: 0.98 → 1
duration: 360ms
easing: var(--ease-enter)
```

Content includes the approved hierarchy:

```text
Your six lines are complete
Save Your Reading
supporting sign-in copy
Sign In to Save & Reveal
```

Do not show final hexagram name, number, Judgment, Image, or interpretation before the gate succeeds.

The sign-in CTA becomes interactive only after its entrance completes.

## 8.6 Already-authenticated path

If the user is already authenticated, do not invent a visible sign-in step. Keep the same state machine boundary but enter the Saving state directly after the six-line hold.

## 8.7 Saving state

Saving is not a separate creative screen. It is a state change within the same persistent scene and card language.

After successful authentication, or immediately for an already-authenticated user:

```text
1. disable the sign-in CTA / prevent duplicate submission
2. transition gate action area to Saving state
3. persist History using existing application logic
4. keep final result content concealed
```

Recommended visual transition:

```text
action opacity: 1 → 0       120ms
Saving indicator/copy: 0 → 1  180ms
easing: var(--ease-standard)
```

Use the existing product loading/saving indicator if one already exists. Do not design a new spinner family solely for this flow.

Saving duration is business/network dependent. Do not hold the animation for an artificial minimum beyond what is required to avoid a visual flash; if a minimum is needed, cap it at approximately `180ms`.

On save failure, existing product error handling remains authoritative. Do not invent a new motion-only error screen.

## 8.8 Gate exit after successful save

Once History persistence succeeds and the result is ready to reveal:

```text
opacity: 1 → 0
translateY: 0 → -10px
scale: 1 → 0.99
duration: 220–260ms
easing: var(--ease-exit)
```

The persistent background remains unchanged.

## 8.9 Result-card entrance

The parchment-style final result card shown in `ref-07-hexagram-result-full-en.png` enters after the gate/save state clears.

```text
opacity: 0 → 1
translateY: +18px → 0
scale: 0.975 → 1
duration: 420ms
easing: var(--ease-enter)
```

No full-screen wipe, page-turn effect, rotating card, scene cut, or newly invented reveal is permitted.

## 8.10 Result content

When result data is already available at entrance time:

```text
card shell + content enter together
```

If interpretation data is still asynchronous after persistence, use the project's existing loading/result pipeline inside the approved result system. Do not reveal a different page or a new motion-only placeholder.

## 8.11 Optional internal content stagger

Only if the current UI implementation benefits from it:

```text
card shell: 0ms
title / hexagram number: +60ms
hexagram lines: +100ms
Judgment / Image: +120ms
buttons: +160ms
```

Each child:

```text
opacity: 0 → 1
translateY: +4px → 0
duration: 180–220ms
```

Maximum total internal stagger: `160ms`.

The result card must read as one coherent element rather than multiple theatrical reveals.

---

# 9. Reduced Motion

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

Reduced Motion must change only presentation.

It must never alter:

- Heads / Tails;
- cast order;
- line values;
- six-line result;
- persistence;
- API requests;
- authentication flow;
- final hexagram.

## 9.1 UI transitions

Replace large movement with short fades.

Recommended:

```text
duration: 100–160ms
translate distance: ≤4px
scale effects: disabled
```

## 9.2 Coin animation

Coins remain actual 3D objects.

Do not perform repeated multi-turn flipping.

Reduced sequence:

```text
1. coin becomes visible at cast origin
2. move upward only 0.15D–0.30D
3. rotate directly toward authoritative final orientation
4. settle into result position
```

Duration:

```text
220–320ms
```

Rotation should use the shortest practical 3D orientation transition.

No repeated 720°+ spin.

## 9.3 Particles

Reduced Motion:

```text
new particle emission: disabled
light trails: disabled
animated airflow: disabled or static low-opacity treatment
```

Existing environmental background details may remain if they are not actively animated by this flow.

## 9.4 Auth / Saving / Result entrance

When an Auth/Save Gate is required, keep the same state order but replace large transforms with short fades. Do not skip authentication or persistence because Reduced Motion is enabled.

Gate / Saving / Result card transitions:

```text
opacity 0 → 1 or 1 → 0
duration 120–200ms
translation disabled or ≤4px
scale effects disabled
```

Functionality, persistence, content gating, and final result remain identical.

---

# 10. Technical Ownership

## 10.1 React state

React/application state owns:

```text
question
current cast index
authoritative three-coin results
completed casts
line values
six-line completion
storage state
authentication gate
hexagram derivation state
reading request state
result data
animation phase/state machine trigger
```

Recommended animation-related phase model:

```ts
type MotionPhase =
  | "home"
  | "question-confirm-enter"
  | "question"
  | "question-exit"
  | "casting-enter"
  | "casting"
  | "settling"
  | "cast-result"
  | "recording"
  | "reset-next-cast"
  | "six-lines-complete"
  | "auth-gate-enter"
  | "auth-required"
  | "saving"
  | "result-enter"
  | "result";
```

This phase state coordinates rendering.

It does not decide cast outcomes.

## 10.2 Three.js

Three.js owns:

```text
coin geometry
coin thickness
square-hole geometry
Heads/Tails materials
coin lighting response
coin position
coin scale
coin 3D orientation
coin launch trajectories
coin flip
coin deceleration
coin descent
coin result positioning
optional tiny physical settle/bounce
```

Three.js must receive authoritative face state from React.

Example contract:

```ts
type CoinMotionInput = {
  coinIndex: 0 | 1 | 2;
  targetFace: "heads" | "tails";
  visualSeed: number;
};
```

## 10.3 WebGL particles / shaders

Use WebGL particle or shader systems for:

```text
small gold particles
light streaks / trails
existing luminous airflow
local glow around casting area
```

Particle systems must remain decorative.

They must not participate in hit-testing or business state.

Avoid CPU-heavy DOM particle elements.

## 10.4 CSS

CSS transitions / animations own:

```text
titles
descriptions
Back control
Home → Question Confirm UI transition
input/question UI exit
Auth / Save Gate UI
Saving state UI
Heads / Tails labels
Record This Cast
progress UI
six-line list UI
final result parchment card
final card text/buttons
```

Do not animate the static environmental background with CSS transforms.

## 10.5 Recommended separation

```text
React
  ↓ authoritative state

Three.js
  ↓ renders physical coin motion

WebGL particles/shader
  ↓ renders decorative energy

CSS
  ↓ renders foreground UI transitions
```

Data direction must remain one-way for the cast result:

```text
business state
→ animation
```

Never:

```text
animation
→ business result
```

---

# 11. Implementation Guardrails

The following are explicit acceptance criteria.

### Required

- One persistent room/background throughout the casting flow.
- No visual scene cut between Home, Question Confirm, Casting, Casting Result, Auth/Save Gate, Saving, and final hexagram.
- Three real 3D coins.
- Visible coin thickness while flipping.
- Both coin faces correctly modeled/textured.
- Three coins have small timing and trajectory differences.
- Heads / Tails predetermined before the animation.
- Final visible faces exactly match authoritative results.
- Six casts recorded from bottom to top.
- Same approximate casting duration for all six casts.
- Auth/Save Gate and existing result card enter in the same persistent room.
- Final hexagram content remains concealed until the required auth/save path succeeds.
- Reduced Motion remains fully functional.

### Forbidden

- 2D coin rotation.
- Randomizing Heads / Tails in the renderer.
- Inferring business result from landing physics.
- Changing result to match the animation.
- Background scene replacement.
- Full-screen flash.
- New transition page.
- Skipping or visually bypassing the required Auth/Save Gate when authentication is required.
- Revealing final hexagram content before required persistence succeeds.
- New cinematic camera movement.
- New special effects not shown in the supplied designs.
- Excessive particle density.
- Excessive bounce.
- Game-like screen shake.
- Random coin collisions that can change final layout.
- Progressive slowing of six casts.
- Animation blocking storage or result correctness.

---

# 12. Final Motion Parameter Table

| Animation | Duration | Delay / Stagger | Easing | Technology | Visual random micro-variation | Affects business result |
|---|---:|---:|---|---|---|---|
| Home-only UI exit | 240–280ms | 0ms | `cubic-bezier(0.4,0,1,1)` | CSS | No | No |
| Question card relocation | 340–380ms | ~80ms | `cubic-bezier(0.22,1,0.36,1)` | CSS/layout | No | No |
| Question Confirm title/CTA entry | 300–340ms | 100–140ms | `cubic-bezier(0.22,1,0.36,1)` | CSS | No | No |
| Question UI exit | 240ms | 0–60ms internal | `cubic-bezier(0.4,0,1,1)` | CSS | No | No |
| Casting title/UI entry | 320ms | 120ms | `cubic-bezier(0.22,1,0.36,1)` | CSS | No | No |
| Coin launch A | part of 1450–1580ms | 0ms | procedural | Three.js | Yes, bounded | No |
| Coin launch B | part of 1450–1580ms | 65ms ±15ms | procedural | Three.js | Yes, bounded | No |
| Coin launch C | part of 1450–1580ms | 130ms ±15ms | procedural | Three.js | Yes, bounded | No |
| Coin ascent | ~650–730ms | per coin stagger | procedural ease-out | Three.js | Peak height / lateral offset only | No |
| Coin main 3D flip | ~900–1100ms | per coin stagger | procedural | Three.js | Angular speed / precession only | No |
| Coin guided orientation | final 280–360ms | none | `cubic-bezier(0.16,1,0.3,1)` equivalent | Three.js | Landing tilt only | No |
| Coin descent | ~500–620ms | per coin stagger | procedural | Three.js | Small trajectory variation | No |
| Coin settle | 120–180ms | none | settle easing | Three.js | Optional tiny tilt | No |
| Coin bounce | 90–140ms | at contact | restrained ease-out | Three.js | Max 0.04D–0.07D | No |
| Particle emission | 1500–1950ms | 40–100ms before first coin launch | procedural | WebGL particles | Yes | No |
| Light trails | active during fast spin | tied to velocity | procedural | WebGL / shader | Yes | No |
| Particle dissipation | 260–420ms | after final landing | ease-out | WebGL particles | Yes | No |
| Casting title exit | 180ms | ~100ms before final settle | `cubic-bezier(0.4,0,1,1)` | CSS | No | No |
| Casting Result heading | 260ms | ~60ms after final settle | `cubic-bezier(0.22,1,0.36,1)` | CSS | No | No |
| Heads / Tails labels | 180ms | 100–140ms after coin settle | `cubic-bezier(0.22,1,0.36,1)` | CSS | No | No |
| Record This Cast | 220ms | ~120ms after labels begin | `cubic-bezier(0.22,1,0.36,1)` | CSS | No | No |
| Record line | 220ms | after successful record state | `cubic-bezier(0.22,1,0.36,1)` | CSS + React | No | No — React/business state updates independently of motion |
| Current-result UI exit | 150–180ms | 0ms | exit easing | CSS | No | No |
| Coin reset to next cast | 300–360ms | after record | `cubic-bezier(0.4,0,0.2,1)` | Three.js | No | No |
| Next Casting UI entry | 260ms | ~120ms into reset | enter easing | CSS | No | No |
| Sixth line completion | 220ms | after cast 6 record | enter easing | CSS + React | No | No — React/business state updates independently of motion |
| Final coin exit | 280ms | 180–260ms after line 6 | exit easing | Three.js | No | No |
| Six-line completion hold | 260–400ms | after line 6 | none | React timing | No | No |
| Auth/Save Gate entry | 360ms | after line-six hold when auth required | `cubic-bezier(0.22,1,0.36,1)` | CSS + React | No | No |
| Saving state swap | 120–180ms | after auth / directly if already authenticated | `cubic-bezier(0.4,0,0.2,1)` | CSS + React | No | No |
| Auth/Save Gate exit | 220–260ms | after successful persistence | `cubic-bezier(0.4,0,1,1)` | CSS | No | No |
| Result card entry | 420ms | after successful persistence and result readiness | `cubic-bezier(0.22,1,0.36,1)` | CSS | No | No |
| Result internal content | 180–220ms | max stagger 160ms | enter easing | CSS | No | No |
| Reduced Motion coin transition | 220–320ms | small stagger optional | standard / shortest-path | Three.js | Minimal | No |
| Reduced Motion UI | 100–200ms | minimal | standard | CSS | No | No |

---

# 13. Reference Default Timing

For implementation consistency, the default full cast timing should target:

```text
Home → Question Confirm transition:
~440ms

Question → Casting transition:
~440ms overlap transition

One 3-coin cast:
~1650ms coin motion

Casting Result becoming readable:
~1850ms

Record This Cast becoming interactive:
~2050–2200ms

Reset between casts:
~320ms

Auth/Save Gate entry after completed six-line state:
~360ms when authentication is required

Saving state:
network/business dependent; no artificial long hold

Gate exit after successful persistence:
~220–260ms

Result-card reveal after successful persistence:
~420ms
```

These timings are defaults, not independent creative variables.

During visual QA, adjustments should normally remain within:

```text
±10%
```

unless necessary to match the supplied designs or resolve rendering performance problems.

The final implementation must prioritize:

```text
correct authoritative cast result
→ scene continuity
→ physical readability of the 3D coins
→ visual fidelity to the supplied interfaces
→ motion subtlety
```

Animation spectacle is not a priority and must never override any of the above.