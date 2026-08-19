# Public Reading classical text provenance

Updated: 2026-08-19

The 64 Public Reading entity pages separate classical Chinese text from Quick I Ching's original interpretation prose.

## Judgment and Image

- Judgment and Image text is verified against the Simplified Chinese (`zh-hans`) rendering of the individual [周易 pages on Wikisource](https://zh.wikisource.org/zh-hans/周易). Every page URL in `src/domain/public-reading/classical.ts` includes the exact Wikisource `oldid`, and every record stores that revision number.
- The 64-record source snapshot is locked by a SHA-256 regression fixture. Updating an edition requires reviewing the source diff, changing the stored revisions and text together, and deliberately updating the fixture.
- [godcong/yi `data/gua.json`](https://github.com/godcong/yi/blob/master/data/gua.json) is used only for compact symbol and upper/lower trigram metadata. It is not claimed as the source of the displayed Judgment or Image text. The repository is MIT licensed.
- No modern copyrighted English Judgment or Line translation is copied into Public V1. The English names and Quick I Ching interpretation fields are separate original/product data.

## Interpretation data

The six line sections and the richer English structure are reused from the existing authored `src/domain/interpretation/v2/catalog/` bundles through `loadPublicHexagramKnowledge`. The entity route exposes six stable `#line-1` through `#line-6` anchors; it does not create 384 changing-line pages.

## Source-fidelity rule

If a source edition uses a textual variant, the repository keeps the recorded classical form and source attribution rather than silently substituting a modern translation. A character that cannot be verified from the recorded source must not be presented as a generated quotation.
