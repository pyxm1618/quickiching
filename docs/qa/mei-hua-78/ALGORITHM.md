# Mei Hua number + moment algorithm — PR #78

## Adopted rule

The active Mei Hua flow uses the classical object-number rule from 《梅花易数》卷一 rather than the retired Gregorian current-time convention.

Inputs are one positive integer chosen by the user, the exact UTC millisecond captured on **Confirm & Cast**, and the browser-resolved IANA timezone.

1. Convert the sealed UTC instant to the user's local civil hour through the IANA timezone.
2. Convert that local hour to the traditional twelve double-hour ordinal: 子=1 (23:00–00:59), 丑=2, …, 亥=12 (21:00–22:59).
3. Upper trigram = user number divided by 8, using the classical remainder; an exact multiple of 8 maps to 8 (坤).
4. Lower trigram = local double-hour ordinal divided by 8 using the same remainder rule.
5. Changing line = (user number + local double-hour ordinal) divided by 6; an exact multiple of 6 maps to line 6.
6. Trigram numbering is 乾1、兑2、离3、震4、巽5、坎6、艮7、坤8.
7. Build the primary hexagram from the two trigrams, mark that single line as moving (yang→9, yin→6), and derive the relating hexagram by changing that line.

Year, month and day are **not** calculation inputs for this rule. The exact timestamp is nevertheless sealed and persisted so the cast is reproducible and cannot shift after confirmation.

## Source verification

Primary text:
- Wikisource, 《梅花易数》卷一: https://zh.wikisource.org/wiki/%E6%A2%85%E8%8A%B1%E6%98%93%E6%95%B8/%E5%8D%B7%E4%B8%80
  - “周易卦数” supplies the 1–8 trigram order.
  - “卦以八除” and “爻以六除” define the zero-remainder boundaries.
  - “物数占例” specifies number→upper trigram, time-number→lower trigram, and their sum→moving line.
  - “年月日时起例” supplies 子=1 through 亥=12 for the traditional time number; the active object-number rule does not import its year/month/day arithmetic.

Independent cross-checks:
- Wikisource consolidated 《梅花易数》 text: https://zh.wikisource.org/zh-hans/%E6%A2%85%E8%8A%B1%E6%98%93
- 易推智道, “物数占例”: https://mmkat.com/book/meihua-yishu/45.html

The independent texts agree on the material rule used here: object/user number for the upper trigram, the encountered traditional hour number for the lower trigram, and number + hour number for the changing line.

## Engineering boundary

- Active method: `mei_hua_number_time`
- Algorithm version: `mei-hua-number-moment-classical-v1`
- Active storage key: `quickiching:public-v1:mei-hua-number-time-v1`
- Retired method `mei_hua_current_time` is historical read-only compatibility only.
- The active implementation does not call or fall back to `meiHuaFromUtc()`.
- Server persistence recomputes the result from `number + utcMillis + ianaTimeZone` and rejects conflicting client-supplied lines.

Primary implementation: `src/domain/casting/mei-hua/number-time.ts`.
Boundary tests: `src/domain/casting/mei-hua/number-time.test.ts`, `src/app/api/readings/route.test.ts`, and the Mei Hua browser gate.
