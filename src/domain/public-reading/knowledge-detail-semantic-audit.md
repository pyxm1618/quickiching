# English Knowledge Detail Semantic Audit

Scope: PR #69, branch `data/hexagram-english-knowledge-audit`, starting head `8ff97a8dc913289e447b5983f02d132ec31b8e45`.

## Coverage

- Editorial English renderings reviewed source-by-source: **514 / 514**
  - Judgment: 64 / 64
  - Image: 64 / 64
  - Ordinary lines: 384 / 384
  - Qian Use of Nine: 1 / 1
  - Kun Use of Six: 1 / 1
- Review basis: the repository's fixed Chinese classical text, fixed Wikisource revision metadata, and existing field binding.
- This audit did not create a second interpretation catalog and did not rewrite the existing 64 hexagram-level or 384 line-level V2 interpretations.

## Rendering corrections

**21 renderings were corrected.** The corrections are intentionally narrow: remove unsupported additions, avoid over-determining disputed ancient wording, or restore a source clause that had been changed in meaning.

1. H4 line 1 — replaced "continuing in this way" with "going on" so the regret attaches to `以往`, not to continuing discipline.
2. H13 line 5 — removed the added object "obstacles" from `大师克相遇`.
3. H14 line 4 — removed the added psychological gloss "boastful" from `匪其彭`.
4. H15 line 5 — removed the added moral justification "what must be corrected" from `利用侵伐`.
5. H22 Image — removed "by appearance alone", which is not present in `无敢折狱`.
6. H25 line 2 — replaced an intention-based paraphrase with a syntax-preserving rendering of `不耕获，不菑畬`.
7. H29 line 3 — `枕` is rendered conservatively as unsettled rather than as a place of rest.
8. H33 line 4 — removed "voluntary", which is not stated by `好遁`.
9. H34 line 1 — corrected `有孚` from "this is certain" to "There is sincerity."
10. H37 line 2 — removed the added "outside" qualifier from `无攸遂`.
11. H40 line 5 — replaced an inferred claim of proof with the direct `有孚于小人` clause.
12. H41 line 2 — removed invented self/other pronoun assignment from `弗损益之`.
13. H48 Judgment — removed the invented event "the rope fails"; the source places the failure in the unfinished draw and broken jar.
14. H50 line 1 — corrected the cauldron image so the feet are overturned rather than the vessel being "on its legs".
15. H54 line 3 — retained the traditional waiting sense of `须` without mixing it into an invented "secondary wife" state.
16. H55 line 1 — `旬` has traditional disagreement (equal/even vs ten-day/full-cycle readings); changed the wording to the less determinate "full cycle".
17. H58 line 6 — removed the invented object "others" from `引兑`.
18. H59 line 4 — removed the added causal verb "gathers" from `涣有丘`.
19. H61 line 1 — removed the unsupported word "trust" from `虞吉`.
20. H63 line 4 — avoided collapsing the `𦈡/繻 ... 袽` textual tradition into one leak-specific reading; retained the conservative fine-silk / worn-cloth wording.
21. H64 line 5 — restored the clause boundary between `君子之光` and `有孚`.

## Traditional ambiguity handled conservatively

Targeted external verification was used only where the locked Chinese text remained materially ambiguous after repository-only review:

- H25 line 2, `不耕获，不菑畬` — early and later commentarial traditions differ over whether the clause describes receiving outcomes without initiating the work or acting without calculating the result. The saved English now stays close to the surface syntax.
- H29 line 3, `险且枕` — Wang Bi / Kong Yingda read `枕` as instability / inability to rest, so "place of rest" was removed.
- H54 line 3, `归妹以须` — Wang Bi / Kong Yingda support the waiting sense; the revised English does not turn that waiting itself into a marital rank.
- H55 line 1, `旬` — traditional sources preserve both equality and ten-day/full-cycle readings. The revised wording avoids asserting only one historical explanation.
- H61 line 1, `虞吉` — traditional glosses vary; the revised wording removes the unsupported "trust" claim.
- H62 line 6, `飞鸟离之` — targeted check confirmed the traditional caught/ensnared sense; no data change was required.
- H63 line 4, `𦈡有衣袽` — traditions differ between fine-silk/worn-cloth and leak-stopping-rags explanations. The saved rendering stays at the more conservative lexical level.

## Field-level modern interpretation

- Judgment-specific modern interpretation: **64 / 64**
- Image-specific modern interpretation: **64 / 64**
- Each is stored next to its corresponding editorial rendering and is directly about that field's classical text.
- Judgment interpretation no longer reuses `hexagram.coreMeaning`.
- Image interpretation no longer reuses `hexagram.structureInterpretation`.
- Existing 384 line-level V2 interpretation fields remain unchanged.

## Deliberately unchanged

- Classical Chinese text and fixed source revisions / URLs
- Existing hexagram-level V2 interpretation catalog
- Existing line-level V2 interpretation catalog
- Stage / State remains optional and empty
- Special cases remain Qian Use of Nine and Kun Use of Six only
- Relationships remain `structural-complement` and `structural-line-reversal` only
