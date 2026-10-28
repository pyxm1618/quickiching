# TYPOGRAPHY_SPEC.md

## Scope

This file locks the authoritative typography for the Quick I Ching Ritual redesign.

The selected fonts below are the implementation source of truth for this redesign. Do not treat them as approximate suggestions and do not re-identify or substitute concept-render fonts during implementation.

## Authoritative typography map

| UI element | Authoritative font | Weight | Italic | Web usage |
|---|---|---:|---|---|
| Large handwritten / brush title, e.g. `What Would You Like to Ask?` | `Kaushan Script` | 400 | No; the typeface already carries a handwritten slant | Google Fonts / open source / Web |
| Main English headings, e.g. `Mountain Over Water`, `Judgment`, `Image` | `Georgia` | 700 | No | System font; use directly through CSS |
| Body and explanatory copy | `Georgia` | 400 | No | System font; use directly through CSS |
| Buttons and input text | `Georgia` | 400–700 | No | System font; use directly through CSS |
| Navigation and brand text | Existing shared site-header typography remains authoritative | Existing implementation | Existing implementation | Reuse current site header; do not redesign it for this ritual |

## Fallbacks

For serif ritual UI text:

```css
font-family: Georgia, "Libre Baskerville", serif;
```

For the brush-style hero title:

```css
font-family: "Kaushan Script", cursive;
```

`Libre Baskerville` is a fallback only. It is not permission to replace Georgia when Georgia is available.

## Reference-art relationship

The concept/reference images are authoritative for:
- position;
- font size;
- line height;
- tracking / letter spacing;
- text block width;
- wrapping;
- alignment;
- visual hierarchy.

The typeface identity itself is authoritative in this document:

```text
Kaushan Script / Georgia → authoritative implementation typography
reference-render glyph variation → non-authoritative generation artifact
```

Therefore, a glyph shape difference between a generated reference and the locked font is not a reason to substitute another typeface. Match the reference layout metrics while keeping the authoritative font family defined here.

## Implementation rules

- Do not rasterize dynamic text into images.
- Do not replace the existing site header/brand typography solely to match ritual concept art.
- Do not introduce a second brush or serif family without an explicit design change.
- Typography changes in the ritual flow must not alter global information architecture or brand-component behavior.
- Use `ASSET_MANIFEST.md` for the canonical Desktop QA viewport and visual comparison rules.
