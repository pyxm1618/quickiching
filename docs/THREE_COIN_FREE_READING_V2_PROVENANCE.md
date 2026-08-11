# Three-Coin Free Reading V2 — Content Provenance

## Purpose

This document records the provenance and authorship policy for the interpretation content introduced by Three-Coin Free Reading V2. The V2 catalog belongs to the I Ching interpretation domain and is method-independent; Three-Coin is only the first product flow that renders it.

## Structural authority inside Quick I Ching

The product's existing casting domain remains authoritative for computational facts:

- King Wen number and hexagram identity: `src/domain/casting/hexagrams/king-wen.ts`
- lower/upper trigram composition: `src/domain/casting/hexagrams/king-wen.ts`
- primary, moving-line positions, and relating-hexagram derivation: `src/domain/casting/hexagrams/compute.ts`
- Three-Coin values and coin-face arithmetic: `src/domain/casting/three-coin/algorithm.ts`

V2 interpretation code does not redefine or override those facts.

## Historical / classical reference material consulted

### 1. Chinese Text Project — 《周易 / Book of Changes》

Reference: https://ctext.org/book-of-changes

Use in this project:

- cross-check the received hexagram sequence and the existence/order of six line texts for each hexagram;
- inspect the classical Chinese material when checking that a modern Quick I Ching line theme does not contradict the broad received context;
- distinguish classical source material from Quick I Ching's modern explanatory prose.

The Chinese Text Project identifies its digital base text for this work and provides scanned-source information. Quick I Ching does **not** copy the site's modern editorial prose or site presentation.

### 2. James Legge, *The I Ching*, Sacred Books of the East, vol. XVI (1899 edition)

Bibliographic cross-check: https://openlibrary.org/works/OL1151029W/I_Ching

Use in this project:

- historical English reference for checking names, sequence, and broad received line context when a second lens was useful;
- not a prose source for V2 output.

No Legge passage is reproduced as V2 interpretation text.

## Existing Quick I Ching material retained as migration input

`src/domain/interpretation/basic.ts` already contained 64 original Quick I Ching V1 theme/summary records. V2 keeps that file intact for existing Yarrow and Mei Hua result flows.

For V2, those established Quick I Ching themes and summaries were used as semantic anchors while expanding each hexagram into:

- core theme and 100–180 word core meaning;
- strength;
- challenge;
- orientation;
- structural interpretation;
- stability / transition composition fields;
- three reflection questions;
- three observable `What to Watch` prompts;
- six position-specific line interpretation records.

V2 does not delete or silently rewrite the V1 catalog.

## 384-line authorship method

The V2 line catalog contains exactly `64 × 6 = 384` interpretation records.

Each record is produced from two explicit semantic inputs maintained in the repository:

1. the hexagram-specific V2 profile: theme, strength, challenge, orientation, transition/stability framing, and trigram structure;
2. one manually authored, hexagram-specific emphasis for that exact line position.

The shared line-content builder then turns those semantic inputs into the product fields required by the result page: theme, what the line highlights, change dynamic, caution, reflection question, and a synthesis phrase.

The six structural positions are intentionally distinguished as:

1. foundation / first emergence;
2. inner center / ordinary practice;
3. inner threshold / pressure before moving outward;
4. outer entry / first contact with wider conditions;
5. outer center / visible responsibility and influence;
6. culmination / completion, excess, or release.

This positional model is a **Quick I Ching presentation convention**. It is not presented as a quotation from the Zhouyi, a universal ancient line-selection rule, or the only correct interpretation.

Every hexagram's six emphasis phrases are separately authored. The deterministic quality gate verifies all 384 expanded line meanings are distinct and that the catalog has no missing or duplicate `(hexagramNumber, position)` keys.

## Original-prose policy

All user-facing English added by V2 is Quick I Ching original prose.

The writing policy is:

- describe structure and reflection rather than claim supernatural certainty;
- prefer language such as “this line highlights,” “Quick I Ching reads,” “emerging pattern,” and “for reflection”;
- do not claim “the ancient text definitively says” when the product is providing a modern synthesis;
- do not turn the relating hexagram into a guaranteed future;
- do not provide medical, legal, financial, or safety directives;
- keep the result useful without AI, login, or payment.

## Modern translation copyright boundary

V2 prose was not sourced from or copied from modern copyrighted English translations or modern I Ching websites. In particular, the content process does not use passages from modern editions such as Wilhelm/Baynes, Blofeld, or other contemporary commercial translations as production copy.

Historical/classical materials are used for semantic cross-checking only. The shipped text is written in the project's own vocabulary and organized around the product's explicit structure/reflection model.

## Determinism and content ownership boundary

The catalog is static TypeScript content. There is no LLM/API call, random prose generation, CMS lookup, or runtime retrieval.

Given the same six line values:

- the casting domain produces the same primary/moving/relating facts;
- the same interpretation records are loaded;
- the same deterministic synthesis functions run;
- the same free-reading text is produced.

Casting owns **what was cast**. Interpretation owns **how that fixed structure is explained**. Result UI owns **how that explanation is presented**.
