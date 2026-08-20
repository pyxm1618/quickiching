# Public SEO V1 provenance

Updated: 2026-08-19

This file records the rules and content provenance used by the credential-free Public SEO V1. It is intentionally narrower than the future Commercial V2 design.

## Three-Coin Method

Public V1 keeps the existing pure domain rule: each of three independent coin faces is valued as yin/tail = 2 or yang/head = 3; the sum produces 6, 7, 8, or 9. Six lines are created bottom-to-top. Values 6 and 9 move. Browser randomness is supplied by Web Crypto (`crypto.getRandomValues`), while the domain function remains deterministic under an injected bit source.

No `Math.random()` production path is used.

## King Wen mapping and line orientation

`src/domain/casting/hexagrams/king-wen.ts` is the single 64-hexagram mapping used by all four public methods. `src/domain/casting/hexagrams/compute.ts` converts six bottom-up yin/yang line states into the primary King Wen number, identifies moving positions, flips only those positions, and derives the relating number. Manual Cast supplies deterministic line values to the same engine; it never samples randomness.

The bit convention is deliberately explicit because reversing a trigram silently produces valid-looking but wrong King Wen numbers:

- bit 0 = bottom line, bit 1 = middle line, bit 2 = top line;
- yang = 1, yin = 0;
- Qian = `111`, Dui = bottom-up `110` visually / numeric bits `011`, Li = `101`, Zhen = bottom-up `100` visually / numeric bits `001`;
- Xun = bottom-up `011` visually / numeric bits `110`, Kan = `010`, Gen = bottom-up `001` visually / numeric bits `100`, Kun = `000`.

Traditional polarity descriptions provide an independent orientation check. A classical commentary witness states that Zhen and Dui have yin above and yang below, while Gen and Xun have yang above and yin below: Chinese Text Project, https://ctext.org/wiki.pl?chapter=756029&if=gb&remap=gb .

Public V1 tests independently lock all eight doubled trigrams, asymmetric hexagrams including 38 (Fire over Lake) and 49 (Lake over Fire), and every single-line change from Hexagram 1 and Hexagram 2. This prevents symmetric Qian/Kun/Li/Kan fixtures from masking a bottom/top reversal in Dui, Zhen, Xun, or Gen.

Public V1 does not publish modern copyrighted Judgment or Line translations. The short English hexagram labels are brief identifiers; the explanatory Basic Interpretation prose is original Quick I Ching text.

## Yarrow Stalk Method

Primary classical procedural basis:

- *Zhouyi*, Xici I: the Great Expansion uses 49; divide into two, hang one, count by fours, collect remainders. Chinese Text Project: https://ctext.org/text.pl?if=gb&node=46928&show=parallel
- A traditional commentary witness preserving the 49-stalk procedure: https://ctext.org/wiki.pl?chapter=756029&if=gb&remap=gb

Quick I Ching uses an explicit **Zhu Xi-style digital probability convention**. It does not claim that every human physical split gesture has one fixed empirical distribution.

For each line:

1. Start with 49 working stalks.
2. First change: sample a valid change removing 5 with probability 3/4 or 9 with probability 1/4.
3. Second and third changes: sample valid changes removing 4 or 8 with equal probability.
4. For the selected removal outcome, record a real left/right split whose one-from-right and remainder-by-four arithmetic exactly produces that outcome.
5. After three changes, remaining stalks / 4 gives 6, 7, 8, or 9.
6. Repeat bottom-to-top for six lines (18 changes).

The resulting line probabilities are exactly:

- 6: 1/16
- 7: 5/16
- 8: 7/16
- 9: 3/16

The implementation consumes one unbiased integer sample per change from a sample space divisible by the reachable conditional split counts. The same draw determines both the target removal class and a valid split inside that class, avoiding a hidden modulo bias while preserving the existing replay/idempotency expectation that one random integer is consumed per change.

The implementation records conservation data for every change and Public V1 persists unfinished progress only in browser `sessionStorage`. Completed readings are saved only after an explicit user action into browser `localStorage`, capped at 50 records; there is no database, account, cloud history, or `/readings/[local-id]` route.

## Mei Hua Yi Shu — Gregorian adapter for current-time casting

Primary textual basis for the arithmetic:

- *Mei Hua Yi Shu*, volume 1, “年月日時起例”: year is numbered Zi=1 through Hai=12; month and day are added for the upper trigram; hour branch is added for the lower trigram; the full sum modulo 6 selects the moving line. Wikisource: https://zh.wikisource.org/wiki/%E6%A2%85%E8%8A%B1%E6%98%93%E6%95%B8/%E5%8D%B7%E4%B8%80

The classical arithmetic does not, by itself, settle every calendar/timezone convention required by a global web application. Public V1 therefore names and fixes its own convention instead of calling it the only standard implementation.

### `quickiching-gregorian-current-time-v2`

- Instant: current browser time only; no historical backfill UI.
- Timezone: user-confirmed IANA timezone.
- Calendar: Gregorian civil calendar.
- Year number: Gregorian year converted to terrestrial-branch ordinal with 2020 = Zi = 1, then cycling 1..12.
- Month: Gregorian month 1..12.
- Day: Gregorian civil day.
- Hour branch: Zi=1 at 23:00–00:59, Chou=2 at 01:00–02:59, continuing through Hai=12.
- Zi-hour rollover: 23:00 uses the next Gregorian formula date; 00:00 remains that civil date.
- Lunar calendar: not used by this convention.
- Lunar leap month: not applicable because lunar months are not used.
- Gregorian leap day: treated as an ordinary Gregorian civil date.
- DST: resolved by `Intl.DateTimeFormat` using the chosen IANA timezone.

Formula:

- upper trigram = `(yearBranch + month + day) mod 8`, zero remainder => 8
- lower trigram = `(yearBranch + month + day + hourBranch) mod 8`, zero remainder => 8
- moving line = `(yearBranch + month + day + hourBranch) mod 6`, zero remainder => 6
- trigram numbers: Qian 1, Dui 2, Li 3, Zhen 4, Xun 5, Kan 6, Gen 7, Kun 8

This is a stable, testable Quick I Ching convention. The Chinese product label is “梅花易数公历适配版”; it is not a claim of exclusivity or equivalence across Mei Hua schools.

## Free Basic Interpretation

`src/domain/interpretation/basic.ts` contains original Quick I Ching prose. It is intentionally concise and explains general hexagram themes only. It does not copy a modern I Ching English translation and does not include copyrighted modern Judgment or Line text.

Public V1 free output includes:

- primary hexagram number/name and six-line figure;
- changing-line positions;
- relating hexagram number/name and figure when applicable;
- original basic primary and relating summaries;
- a structural explanation of change;
- a reflection / non-deterministic / non-professional-advice boundary.

The optional personalized interpreter is a separate, explicit-click boundary. It receives only verified reading facts plus the normalized question, is schema-validated and risk-checked, and is production fail-closed until the feature flag, AI Gateway credentials/model, Turnstile configuration, Upstash distributed rate limit, and provider controls are all present. Request cancellation propagates to provider work. Static interpretation remains complete without it.

## Classical hexagram source records

`src/domain/public-reading/classical.ts` stores one record for each of the 64 hexagrams, including the classical Chinese Judgment and Image text, fixed entity slug, source URLs, six stable line positions, and attribution metadata. The 384 ordinary lines and 乾/坤 `用九`/`用六` snapshot are documented in `docs/PUBLIC_READING_CLASSICAL_PROVENANCE.md`; the public result labels them as classical text and links to the fixed Wikisource revision. QuickIChing summaries and line-position hints remain separate product content.

## Search-engine implementation references

Technical SEO implementation is based on current official guidance, including:

- Google Search Central canonicalization and redirects: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls and https://developers.google.com/search/docs/crawling-indexing/301-redirects
- Google sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google robots/noindex: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- IndexNow protocol: https://www.indexnow.org/documentation
- Bing IndexNow setup: https://www.bing.com/indexnow/getstarted

IndexNow is implemented dry-run-first. The launch-preparation work must not send the production submission before the independent final audit.
