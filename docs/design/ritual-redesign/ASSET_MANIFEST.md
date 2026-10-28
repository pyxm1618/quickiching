# ASSET_MANIFEST.md

## Purpose

This directory is the authoritative design handoff for the Quick I Ching Three-Coin / Ritual redesign.

The redesign changes the presentation and interaction layer of the existing ritual flow. Existing casting logic, hexagram content, result data, AI interpretation, authentication, persistence, other divination methods, and global navigation remain authoritative unless a separate product requirement explicitly changes them.

## Repository source of truth

Do not use an old ZIP package as the development source of truth. The authoritative repository locations are:

```text
docs/design/ritual-redesign/
public/ritual/
```

Visual references and specifications live under `docs/design/ritual-redesign/`. Runtime image assets live under `public/ritual/`.

## Reference designs

The seven files under `docs/design/ritual-redesign/references/` are **visual QA references only**. They define approved composition, hierarchy, spacing, scale, state progression, and visual tone.

They must **not** be used as full-screen runtime screenshots, video frames, or background swaps.

| File | State | Runtime use |
|---|---|---|
| `ref-01-home-full-en.png` | Ritual landing / question entry | Reference only |
| `ref-02-question-full-en.png` | Question confirm / focused question state | Reference only |
| `ref-03-casting-full-en.png` | Coins in active 3D cast | Reference only; primary casting/motion reference |
| `ref-04-cast-result-full-en.png` | Three-coin Heads/Tails result | Reference only |
| `ref-05-six-lines-progress-full-en.png` | Six-line progress state | Reference only |
| `ref-06-auth-save-gate-full-en.png` | Auth-required save gate after line six | Reference only |
| `ref-07-hexagram-result-full-en.png` | Final hexagram/result card | Reference only |

Design-render text is not authoritative product copy. Existing product copy and business rules may correct wording, cast numbering, labels, authentication behavior, or result content without invalidating the visual reference.

## Canonical desktop visual QA canvas

The canonical Desktop visual QA viewport is:

```text
1672 × 941 CSS px
```

Use this viewport for state-level screenshot comparison and pixel/difference QA.

Some approved concept exports differ by 1–2 physical image pixels because of generation/export variance. Do **not** rescale those references to force a match. For automated overlay/difference comparison, align the reference to the canonical `1672 × 941` canvas by deterministic edge crop/pad of at most 2 px, without resampling the artwork.

Browser/version, zoom, and `devicePixelRatio` are engineering QA-environment parameters. Development must freeze and record them during visual validation; they are not additional design assets to request from the user.

## Production assets

### `public/ritual/bg-stage-master-clean.png`

**Role:** authoritative persistent room/background for the ritual flow.

Use as the base environment for Home, Question Confirm, Casting, Casting Result, six-line progress, Auth/Save Gate, Saving, and final result presentation.

Rules:
- Do not generate separate room backgrounds for each state.
- Do not crossfade to a different environment during the ritual.
- Minor crop/position/scale adjustments are allowed only for responsive composition.
- Do not animate the static background as a cinematic camera move.

### `public/ritual/coin-front-master.png`

**Role:** approved coin front-face material source.

Technical normalization:
- `2048 × 2048` transparent PNG;
- centered outer coin geometry;
- outer diameter and transparent margin aligned with the reverse master.

### `public/ritual/coin-back-master.png`

**Role:** approved coin reverse-face material source.

Technical normalization:
- `2048 × 2048` transparent PNG;
- centered outer coin geometry;
- outer diameter and transparent margin aligned with the front master.

### Shared 3D coin geometry rule

The front and reverse source artworks have different **visual square-hole sizes**. This is a source-art characteristic and must not create different front/back physical geometry.

Therefore:

```text
one shared Three.js Coin Mesh
├── one authoritative outer diameter
├── one authoritative thickness
├── one authoritative square-hole geometry
├── front material  → coin-front-master.png
└── back material   → coin-back-master.png
```

The PNG alpha hole is **not** authoritative for physical square-hole dimensions. The shared 3D mesh defines the physical hole for both faces. Do not build separate front/back meshes with different hole sizes, and do not locally warp or redraw either approved texture to force the source-art holes to match.

### `public/ritual/coin-edge-reference.png`

**Role:** 3D geometry/material reference only.

Use to calibrate:
- coin thickness;
- outer rim profile;
- square-hole inner wall;
- edge wear;
- bronze material response.

Do not display this image directly in the UI.

### `public/ritual/hexagram-result-card-blank.png`

**Role:** blank parchment/result-card visual asset.

Dynamic content must be rendered by HTML/React on top of the card, including:
- hexagram name;
- hexagram number;
- seal/name content;
- six-line symbol;
- Judgment;
- Image;
- interpretation text;
- buttons/actions.

Do not bake dynamic result content into the image.

### `public/ritual/decorative-elements-master.png`

**Role:** source sheet for approved decorative elements.

Contains:
- ink circle/brush mark;
- gold cloud ornament;
- yin-yang divider ornament.

It may be split during implementation into separate optimized assets. Do not invent additional decorative motifs solely for the ritual redesign.

## Existing brand assets

No new logo asset is included in this redesign.

Continue to reuse the existing Quick I Ching brand implementation already present in the repository, including the existing `BrandMark`, `Quick I Ching` wordmark text, favicon/app icons, and current shared header component.

The ritual redesign must not trigger an unrelated logo or navigation redesign.

## Typography

See `docs/design/ritual-redesign/TYPOGRAPHY_SPEC.md`.

Typography must remain live text. Do not turn headings, body copy, buttons, or labels into images.

## Motion

See `docs/design/ritual-redesign/MOTION_SPEC.md`.

Key rule:

```text
business/casting state → animation
```

Never:

```text
animation → business/casting result
```

Three.js/WebGL renders the approved result; it never decides Heads/Tails or line values.

## Auth / Save Gate boundary

The approved flow is:

```text
Home
→ Question Confirm
→ Casting
→ Casting Result
→ Record Line / repeat through line 6
→ Auth / Save Gate when required
→ Saving / History persistence
→ Result Reveal
```

`ref-06-auth-save-gate-full-en.png` is the visual reference for the unauthenticated gate. The Saving state is a state change inside the same persistent scene/card language and is specified in `MOTION_SPEC.md`; it is not a separate free-design screen.

## Implementation boundary

Preserve existing authoritative systems unless a separate task explicitly changes them:
- three-coin casting algorithm;
- six-line derivation;
- primary/relating hexagram calculation;
- 64-hexagram content;
- reading/interpretation pipeline;
- AI deep reading;
- persistence/session restore;
- authentication and saving gates;
- history;
- other methods such as yarrow stalks and Mei Hua Yi Shu;
- global site header/footer/navigation.

## Visual QA rule

Use the seven reference images as state-level comparison targets while using the production assets under `public/ritual/` for the actual runtime implementation.

Background differences inside concept renders are not instructions to swap backgrounds. `public/ritual/bg-stage-master-clean.png` is the authoritative runtime environment asset.
