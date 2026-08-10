# Public SEO V1 provenance

Updated: 2026-08-10

This file records the rules and content provenance used by the credential-free Public SEO V1. It is intentionally narrower than the future Commercial V2 design.

## Three-Coin Method

Public V1 keeps the existing pure domain rule: each of three independent coin faces is valued as yin/tail = 2 or yang/head = 3; the sum produces 6, 7, 8, or 9. Six lines are created bottom-to-top. Values 6 and 9 move. Browser randomness is supplied by Web Crypto (`crypto.getRandomValues`), while the domain function remains deterministic under an injected bit source.

No `Math.random()` production path is used.

## King Wen mapping

`src/domain/casting/hexagrams/king-wen.ts` is the single 64-hexagram mapping used by all three methods. `src/domain/casting/hexagrams/compute.ts` converts six bottom-up yin/yang line states into the primary King Wen number, identifies moving positions, flips only those positions, and derives the relating number.

Public V1 does not publish modern copyrighted Judgment or Line translations.

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

The implementation records conservation data for every change and Public V1 persists unfinished progress only in browser `sessionStorage`.

## Mei Hua Yi Shu — Current-Time Casting

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

This is a stable, testable Quick I Ching convention, not a claim of exclusivity across Mei Hua schools.

## Free Basic Interpretation

`src/domain/interpretation/basic.ts` contains original Quick I Ching prose. It is intentionally concise and explains general hexagram themes only. It does not copy a modern I Ching English translation and does not include copyrighted modern Judgment or Line text.

Public V1 free output includes:

- primary hexagram number/name and six-line figure;
- changing-line positions;
- relating hexagram number/name and figure when applicable;
- original basic primary and relating summaries;
- a structural explanation of change;
- a reflection / non-deterministic / non-professional-advice boundary.

Future Commercial V2 personalized AI deep reading is a separate product boundary and is not enabled by Public V1.

## Search-engine implementation references

Technical SEO implementation is based on current official guidance, including:

- Google Search Central canonicalization and redirects: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls and https://developers.google.com/search/docs/crawling-indexing/301-redirects
- Google sitemaps: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google robots/noindex: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- IndexNow protocol: https://www.indexnow.org/documentation
- Bing IndexNow setup: https://www.bing.com/indexnow/getstarted

IndexNow is implemented dry-run-first. The launch-preparation work must not send the production submission before the independent final audit.
