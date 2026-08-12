# Three-Coin Free Reading V2 — Content Provenance

## Purpose

This document records the provenance and authorship policy for the interpretation content used by Three-Coin Free Reading V2. The catalog belongs to the I Ching interpretation domain and is method-independent; Three-Coin is only the first product flow that renders it.

## Structural authority inside Quick I Ching

The existing casting domain remains authoritative for computational facts:

- King Wen number and hexagram identity: `src/domain/casting/hexagrams/king-wen.ts`
- lower/upper trigram composition: `src/domain/casting/hexagrams/king-wen.ts`
- primary, moving-line positions, and relating-hexagram derivation: `src/domain/casting/hexagrams/compute.ts`
- Three-Coin values and coin-face arithmetic: `src/domain/casting/three-coin/algorithm.ts`

V2 interpretation code does not redefine or override those facts.

## Historical / classical reference material consulted

### Chinese Text Project — 《周易 / Book of Changes》

Reference: https://ctext.org/book-of-changes

Used to cross-check the received King Wen sequence, the six-line order, and broad classical context while reviewing modern Quick I Ching themes. The Chinese Text Project is reference material; its modern editorial prose and site presentation are not production copy.

### James Legge, *The I Ching*, Sacred Books of the East, vol. XVI (1899)

Bibliographic cross-check: https://openlibrary.org/works/OL1151029W/I_Ching

Used as a historical English cross-check for sequence and broad received context where a second lens was useful. No Legge passage is reproduced as V2 interpretation text.

## Existing Quick I Ching material retained as migration input

`src/domain/interpretation/basic.ts` already contains 64 Quick I Ching V1 theme/summary records and remains intact for existing Yarrow and Mei Hua result flows.

Those established themes were used as semantic anchors while the V2 catalog was expanded. V2 does not delete or silently rewrite the V1 catalog.

## V2 hexagram authorship model

Each of the 64 V2 hexagram records now directly stores its own authored:

- `coreTheme`
- `coreMeaning`
- `strength`
- `challenge`
- `orientation`
- `structureInterpretation`
- three `reflectionQuestions`
- three `watchFor` observations
- `transitionTheme`
- `stabilityTheme`

These user-facing fields are static TypeScript content. They are not generated at runtime from a shared prose template.

## 384-line authorship model

The V2 line catalog contains exactly `64 × 6 = 384` records.

Each line record directly stores six line-specific authored semantic fields:

- `theme`
- `meaning`
- `changeDynamic`
- `caution`
- `reflection`
- `synthesisPhrase`

The shared `authoredLine()` function is deliberately non-semantic: it only assembles those six supplied strings into a typed object. The shared catalog builder only attaches the objective `(hexagramNumber, position)` identity and groups the records with their hexagram. It does **not** manufacture line meaning from a generic line-position paragraph, sentence template, or rule engine.

The six positions are still treated with awareness of their structural movement from beginning to culmination, but position is context rather than the interpretation itself. Each record is written for the particular hexagram and particular changing line. For example, Hexagram 24 preserves distinct return dynamics across early return, supported return, repeated return, returning against the surrounding current, sincere return, and missing the moment to return. Hexagram 1 likewise distinguishes hidden potential, emergence into the field, sustained effort, testing the leap, visible creative leadership, and strength carried beyond proper height.

## Quick I Ching presentation convention

Quick I Ching shows every actual changing line in bottom-to-top order and synthesizes all of them. It does not currently apply an ancient line-selection hierarchy that suppresses some moving lines in favor of one selected line.

That is a Quick I Ching presentation convention. It is not presented as a quotation from the Zhouyi, a universal ancient rule, or the only correct interpretation method.

## Original-prose policy

All user-facing English added by V2 is Quick I Ching original prose.

The policy is to:

- describe structure, change, and reflection rather than claim supernatural certainty;
- use classical material as semantic context, not as copy to be rewritten sentence-by-sentence;
- distinguish objective casting structure from Quick I Ching interpretation;
- avoid claims such as “the ancient text definitively says” where the product is offering a modern synthesis;
- treat the relating hexagram as an emerging pattern or direction of change, never a guaranteed future;
- avoid medical, legal, financial, or safety directives;
- keep the free reading useful without AI, login, or payment.

## Modern translation copyright boundary

V2 prose was not sourced from or copied from modern copyrighted English translations or modern I Ching websites. In particular, the content process does not use production passages from modern editions such as Wilhelm/Baynes, Blofeld, or contemporary commercial translations.

Historical/classical materials are used for semantic cross-checking only. The shipped prose is written in Quick I Ching's own vocabulary and organized around the product's structure-and-reflection model.

## Determinism and ownership boundaries

The catalog is static TypeScript content. There is no LLM/API call, random prose generation, CMS lookup, or runtime content retrieval.

Given the same six line values:

- the casting domain produces the same primary, moving, and relating facts;
- the same static interpretation records are loaded;
- the same deterministic synthesis functions run;
- the same free-reading text is produced.

Casting owns **what was cast**. Interpretation owns **how that fixed structure is explained**. Result UI owns **how that explanation is presented**.
