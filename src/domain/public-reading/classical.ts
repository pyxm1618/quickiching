import { CLASSICAL_SOURCE_TEXT, type ClassicalSourceLineText } from "./classical-source-data";

export type ClassicalSource = {
  work: string;
  textSourceUrl: string;
  textSourceRevision: number;
  sourceVariant: "zh-Hans";
  sourceFormat: string;
  conversion: string;
  recordSourceUrl: string;
  recordSourceLicense: string;
  textStatus: string;
};

export type ClassicalLine = ClassicalSourceLineText & {
  position: 1 | 2 | 3 | 4 | 5 | 6;
  source: ClassicalSource;
};

export type ClassicalUseLine = ClassicalSourceLineText & {
  label: "用九" | "用六";
  source: ClassicalSource;
};

export type ClassicalHexagram = {
  number: number;
  slug: string;
  englishName: string;
  chineseName: string;
  pinyin: string;
  symbol: string;
  trigrams: { lower: string; upper: string };
  judgment: string;
  image: string;
  lines: readonly [ClassicalLine, ClassicalLine, ClassicalLine, ClassicalLine, ClassicalLine, ClassicalLine];
  useLine?: ClassicalUseLine;
  variantName?: string;
  source: ClassicalSource;
};

const CLASSICAL_SOURCE = {
  work: "周易",
  textSourceUrl: "https://zh.wikisource.org/zh-hans/周易",
  textSourceRevision: 0,
  sourceVariant: "zh-Hans",
  sourceFormat: "Wikisource fixed oldid page rendered with variant=zh-hans",
  conversion: "The repository stores the fixed page's Simplified Chinese rendering; it is not a modern translation.",
  recordSourceUrl: "https://github.com/godcong/yi/blob/master/data/gua.json",
  recordSourceLicense: "MIT",
  textStatus: "Classical text is checked against the fixed Wikisource revision for this hexagram; professional philological review is not claimed.",
} as const;

const WIKISOURCE_HEXAGRAM_PATHS: Record<number, string> = {
  1: "乾", 2: "坤", 3: "屯", 4: "蒙", 5: "需", 6: "訟", 7: "師", 8: "比",
  9: "小畜", 10: "履", 11: "泰", 12: "否", 13: "同人", 14: "大有", 15: "謙", 16: "豫",
  17: "隨", 18: "蠱", 19: "臨", 20: "觀", 21: "噬嗑", 22: "賁", 23: "剝", 24: "復",
  25: "无妄", 26: "大畜", 27: "頤", 28: "大過", 29: "坎", 30: "離", 31: "咸", 32: "恒",
  33: "遯", 34: "大壯", 35: "晉", 36: "明夷", 37: "家人", 38: "睽", 39: "蹇", 40: "解",
  41: "損", 42: "益", 43: "夬", 44: "姤", 45: "萃", 46: "升", 47: "困", 48: "井",
  49: "革", 50: "鼎", 51: "震", 52: "艮", 53: "漸", 54: "歸妹", 55: "豐", 56: "旅",
  57: "巽", 58: "兌", 59: "渙", 60: "節", 61: "中孚", 62: "小過", 63: "既濟", 64: "未濟",
};

const WIKISOURCE_REVISIONS: Record<number, number> = {
  1: 2404991, 2: 2404999, 3: 2527353, 4: 2601829, 5: 2405039, 6: 2405032, 7: 2405011, 8: 2405022,
  9: 2405006, 10: 2494097, 11: 2106138, 12: 2106139, 13: 2106140, 14: 2494004, 15: 2106142, 16: 2106143,
  17: 2497157, 18: 2106145, 19: 2106146, 20: 2106147, 21: 2404997, 22: 2405035, 23: 2404994, 24: 2497162,
  25: 2527352, 26: 2405001, 27: 2405042, 28: 2405002, 29: 2502716, 30: 2528049, 31: 2404996, 32: 2530043,
  33: 2405037, 34: 2531745, 35: 2584802, 36: 2531747, 37: 2405005, 38: 2531978, 39: 2405036, 40: 2405031,
  41: 2405014, 42: 2405025, 43: 2405003, 44: 2437487, 45: 2535017, 46: 2404995, 47: 2502714, 48: 2404992,
  49: 2674393, 50: 2106200, 51: 2560429, 52: 2405028, 53: 2560535, 54: 2511521, 55: 2560608, 56: 2560781,
  57: 2441563, 58: 2404993, 59: 2405023, 60: 2405027, 61: 2404990, 62: 2405007, 63: 2572417, 64: 2405020,
};

function sourceFor(number: number): ClassicalSource {
  const path = WIKISOURCE_HEXAGRAM_PATHS[number];
  const revision = WIKISOURCE_REVISIONS[number];
  if (!path || !revision) throw new Error(`CLASSICAL_SOURCE_MISSING: ${number}`);
  return {
    ...CLASSICAL_SOURCE,
    textSourceUrl: `https://zh.wikisource.org/w/index.php?title=周易/${path}&oldid=${revision}&variant=zh-hans`,
    textSourceRevision: revision,
    textStatus: `Judgment, Image, six ordinary lines, and the optional use line are checked against fixed Wikisource revision ${revision}; the GitHub record supplies only symbol and trigram metadata.`,
  };
}

type ClassicalHexagramCatalogEntry = Omit<ClassicalHexagram, "lines" | "useLine" | "variantName">;
type ClassicalPosition = 1 | 2 | 3 | 4 | 5 | 6;
type ClassicalLineTuple = readonly [ClassicalLine, ClassicalLine, ClassicalLine, ClassicalLine, ClassicalLine, ClassicalLine];

function positionFor(index: number): ClassicalPosition {
  if (index < 0 || index > 5) throw new Error(`CLASSICAL_LINE_POSITION_INVALID: ${index + 1}`);
  return (index + 1) as ClassicalPosition;
}

function linesFor(number: number, source: ClassicalSource): ClassicalLineTuple {
  const sourceText = CLASSICAL_SOURCE_TEXT[number];
  if (!sourceText || sourceText.lines.length !== 6) throw new Error(`CLASSICAL_LINE_DATA_MISSING: ${number}`);
  return sourceText.lines.map((line, index) => ({ ...line, position: positionFor(index), source })) as unknown as ClassicalLineTuple;
}

const CLASSICAL_HEXAGRAM_DATA = [
  {"number":1,"slug":"1-the-creative","englishName":"The Creative","chineseName":"乾","pinyin":"qián","symbol":"䷀","trigrams":{"lower":"qian","upper":"qian"},"judgment":"乾：元亨。利贞。","image":"天行健，君子以自强不息。","source": CLASSICAL_SOURCE},
  {"number":2,"slug":"2-the-receptive","englishName":"The Receptive","chineseName":"坤","pinyin":"kūn","symbol":"䷁","trigrams":{"lower":"kun","upper":"kun"},"judgment":"坤：元亨。利牝马之贞。君子有攸往，先迷后得主。利西南得朋，东北丧朋。安贞，吉。","image":"地势坤，君子以厚德载物。","source": CLASSICAL_SOURCE},
  {"number":3,"slug":"3-difficulty-at-the-beginning","englishName":"Difficulty at the Beginning","chineseName":"屯","pinyin":"zhūn","symbol":"䷂","trigrams":{"lower":"zhen","upper":"kan"},"judgment":"屯：元亨，利贞。勿用有攸往，利建侯。","image":"云雷，屯；君子以经纶。","source": CLASSICAL_SOURCE},
  {"number":4,"slug":"4-youthful-folly","englishName":"Youthful Folly","chineseName":"蒙","pinyin":"méng","symbol":"䷃","trigrams":{"lower":"kan","upper":"gen"},"judgment":"蒙：亨。匪我求童蒙，童蒙求我。初筮告，再三渎，渎则不告。利贞。","image":"山下出泉，蒙；君子以果行育德。","source": CLASSICAL_SOURCE},
  {"number":5,"slug":"5-waiting","englishName":"Waiting","chineseName":"需","pinyin":"xū","symbol":"䷄","trigrams":{"lower":"qian","upper":"kan"},"judgment":"需：有孚，光亨。贞吉，利涉大川。","image":"云上于天，需；君子以饮食宴乐。","source": CLASSICAL_SOURCE},
  {"number":6,"slug":"6-conflict","englishName":"Conflict","chineseName":"讼","pinyin":"sòng","symbol":"䷅","trigrams":{"lower":"kan","upper":"qian"},"judgment":"讼：有孚，窒，惕，中吉，终凶。利见大人，不利涉大川。","image":"天与水违行，讼；君子以作事谋始。","source": CLASSICAL_SOURCE},
  {"number":7,"slug":"7-the-army","englishName":"The Army","chineseName":"师","pinyin":"shī","symbol":"䷆","trigrams":{"lower":"kan","upper":"kun"},"judgment":"师：贞丈人吉，无咎。","image":"地中有水，师；君子以容民畜众。","source": CLASSICAL_SOURCE},
  {"number":8,"slug":"8-holding-together","englishName":"Holding Together","chineseName":"比","pinyin":"bǐ","symbol":"䷇","trigrams":{"lower":"kun","upper":"kan"},"judgment":"比：吉。原筮元永贞，无咎。不宁方来，后夫凶。","image":"地上有水，比；先王以建万国，亲诸侯。","source": CLASSICAL_SOURCE},
  {"number":9,"slug":"9-small-taming","englishName":"Small Taming","chineseName":"小畜","pinyin":"xiǎo chù","symbol":"䷈","trigrams":{"lower":"qian","upper":"xun"},"judgment":"小畜：亨。密云不雨，自我西郊。","image":"风行天上，小畜，君子以懿文德。","source": CLASSICAL_SOURCE},
  {"number":10,"slug":"10-treading","englishName":"Treading","chineseName":"履","pinyin":"lǚ","symbol":"䷉","trigrams":{"lower":"dui","upper":"qian"},"judgment":"履虎尾，不咥人，亨。","image":"上天下泽，履；君子以辨上下，定民志。","source": CLASSICAL_SOURCE},
  {"number":11,"slug":"11-peace","englishName":"Peace","chineseName":"泰","pinyin":"tài","symbol":"䷊","trigrams":{"lower":"qian","upper":"kun"},"judgment":"泰：小往大来，吉亨。","image":"天地交，泰；后以财成天地之道，辅相天地之宜，以左右民。","source": CLASSICAL_SOURCE},
  {"number":12,"slug":"12-standstill","englishName":"Standstill","chineseName":"否","pinyin":"pǐ","symbol":"䷋","trigrams":{"lower":"kun","upper":"qian"},"judgment":"否之匪人，不利君子贞，大往小来。","image":"天地不交，否；君子以俭德辟难，不可荣以禄。","source": CLASSICAL_SOURCE},
  {"number":13,"slug":"13-fellowship","englishName":"Fellowship","chineseName":"同人","pinyin":"tóng rén","symbol":"䷌","trigrams":{"lower":"li","upper":"qian"},"judgment":"同人于野，亨。 利涉大川，利君子贞。","image":"天与火，同人；君子以类族辨物。","source": CLASSICAL_SOURCE},
  {"number":14,"slug":"14-great-possession","englishName":"Great Possession","chineseName":"大有","pinyin":"dà yǒu","symbol":"䷍","trigrams":{"lower":"qian","upper":"li"},"judgment":"大有：元亨。","image":"火在天上，大有；君子以遏恶扬善，顺天休命。","source": CLASSICAL_SOURCE},
  {"number":15,"slug":"15-modesty","englishName":"Modesty","chineseName":"谦","pinyin":"qiān","symbol":"䷎","trigrams":{"lower":"gen","upper":"kun"},"judgment":"谦：亨，君子有终。","image":"地中有山，谦；君子以裒多益寡，称物平施。","source": CLASSICAL_SOURCE},
  {"number":16,"slug":"16-enthusiasm","englishName":"Enthusiasm","chineseName":"豫","pinyin":"yù","symbol":"䷏","trigrams":{"lower":"kun","upper":"zhen"},"judgment":"豫：利建侯行师。","image":"雷出地奋，豫。先王以作乐崇德，殷荐之上帝，以配祖考。","source": CLASSICAL_SOURCE},
  {"number":17,"slug":"17-following","englishName":"Following","chineseName":"随","pinyin":"suí","symbol":"䷐","trigrams":{"lower":"zhen","upper":"dui"},"judgment":"随：元亨。利贞。无咎。","image":"泽中有雷，随；君子以向晦入宴息。","source": CLASSICAL_SOURCE},
  {"number":18,"slug":"18-work-on-the-decayed","englishName":"Work on the Decayed","chineseName":"蛊","pinyin":"gǔ","symbol":"䷑","trigrams":{"lower":"xun","upper":"gen"},"judgment":"蛊：元亨。利涉大川。先甲三日，后甲三日。","image":"山下有风，蛊；君子以振民育德。","source": CLASSICAL_SOURCE},
  {"number":19,"slug":"19-approach","englishName":"Approach","chineseName":"临","pinyin":"lín","symbol":"䷒","trigrams":{"lower":"dui","upper":"kun"},"judgment":"临：元亨。利贞。至于八月有凶。","image":"泽上有地，临；君子以教思无穷，容保民无疆。","source": CLASSICAL_SOURCE},
  {"number":20,"slug":"20-contemplation","englishName":"Contemplation","chineseName":"观","pinyin":"guān","symbol":"䷓","trigrams":{"lower":"kun","upper":"xun"},"judgment":"观：盥而不荐，有孚颙若。","image":"风行地上，观；先王以省方，观民设教。","source": CLASSICAL_SOURCE},
  {"number":21,"slug":"21-biting-through","englishName":"Biting Through","chineseName":"噬嗑","pinyin":"shì kè","symbol":"䷔","trigrams":{"lower":"zhen","upper":"li"},"judgment":"噬嗑：亨。利用狱。","image":"雷电噬嗑；先王以明罚敕法。","source": CLASSICAL_SOURCE},
  {"number":22,"slug":"22-grace","englishName":"Grace","chineseName":"贲","pinyin":"bì","symbol":"䷕","trigrams":{"lower":"li","upper":"gen"},"judgment":"贲：亨。小利有攸往。","image":"山下有火，贲；君子以明庶政，无敢折狱。","source": CLASSICAL_SOURCE},
  {"number":23,"slug":"23-splitting-apart","englishName":"Splitting Apart","chineseName":"剥","pinyin":"bō","symbol":"䷖","trigrams":{"lower":"kun","upper":"gen"},"judgment":"剥：不利。有攸往。","image":"山附地上，剥；上以厚下，安宅。","source": CLASSICAL_SOURCE},
  {"number":24,"slug":"24-return","englishName":"Return","chineseName":"复","pinyin":"fù","symbol":"䷗","trigrams":{"lower":"zhen","upper":"kun"},"judgment":"复：亨。出入无疾，朋来无咎。反复其道，七日来复，利有攸往。","image":"雷在地中，复；先王以至日闭关，商旅不行，后不省方。","source": CLASSICAL_SOURCE},
  {"number":25,"slug":"25-innocence","englishName":"Innocence","chineseName":"无妄","pinyin":"wú wàng","symbol":"䷘","trigrams":{"lower":"zhen","upper":"qian"},"judgment":"无妄：元亨。利贞。其匪正有眚，不利有攸往。","image":"天下雷行，物与无妄；先王以茂对时，育万物。","source": CLASSICAL_SOURCE},
  {"number":26,"slug":"26-great-taming","englishName":"Great Taming","chineseName":"大畜","pinyin":"dà chù","symbol":"䷙","trigrams":{"lower":"qian","upper":"gen"},"judgment":"大畜：利贞，不家食吉，利涉大川。","image":"天在山中，大畜；君子以多识前言往行，以畜其德。","source": CLASSICAL_SOURCE},
  {"number":27,"slug":"27-nourishment","englishName":"Nourishment","chineseName":"颐","pinyin":"yí","symbol":"䷚","trigrams":{"lower":"zhen","upper":"gen"},"judgment":"颐：贞吉。观颐，自求口实。","image":"山下有雷，颐；君子以慎言语，节饮食。","source": CLASSICAL_SOURCE},
  {"number":28,"slug":"28-great-exceeding","englishName":"Great Exceeding","chineseName":"大过","pinyin":"dà guò","symbol":"䷛","trigrams":{"lower":"xun","upper":"dui"},"judgment":"大过：栋桡，利有攸往，亨。","image":"泽灭木，大过。君子以独立不惧，遁世无闷。","source": CLASSICAL_SOURCE},
  {"number":29,"slug":"29-the-abysmal-water","englishName":"The Abysmal Water","chineseName":"坎","pinyin":"kǎn","symbol":"䷜","trigrams":{"lower":"kan","upper":"kan"},"judgment":"习坎：有孚，维心亨。行有尚。","image":"水洊至，习坎；君子以常德行，习教事。","source": CLASSICAL_SOURCE},
  {"number":30,"slug":"30-the-clinging-fire","englishName":"The Clinging Fire","chineseName":"离","pinyin":"lí","symbol":"䷝","trigrams":{"lower":"li","upper":"li"},"judgment":"离：利贞。亨。畜牝牛，吉。","image":"明两作离，大人以继明照于四方。","source": CLASSICAL_SOURCE},
  {"number":31,"slug":"31-influence","englishName":"Influence","chineseName":"咸","pinyin":"xián","symbol":"䷞","trigrams":{"lower":"gen","upper":"dui"},"judgment":"咸：亨。利贞。取女吉。","image":"山上有泽，咸；君子以虚受人。","source": CLASSICAL_SOURCE},
  {"number":32,"slug":"32-duration","englishName":"Duration","chineseName":"恒","pinyin":"héng","symbol":"䷟","trigrams":{"lower":"xun","upper":"zhen"},"judgment":"恒：亨，无咎。利贞，利有攸往。","image":"雷风，恒；君子以立不易方。","source": CLASSICAL_SOURCE},
  {"number":33,"slug":"33-retreat","englishName":"Retreat","chineseName":"遁","pinyin":"dùn","symbol":"䷠","trigrams":{"lower":"gen","upper":"qian"},"judgment":"遁：亨。小利贞。","image":"天下有山，遁；君子以远小人，不恶而严。","source": CLASSICAL_SOURCE},
  {"number":34,"slug":"34-great-power","englishName":"Great Power","chineseName":"大壮","pinyin":"dà zhuàng","symbol":"䷡","trigrams":{"lower":"qian","upper":"zhen"},"judgment":"大壮：利贞。","image":"雷在天上，大壮；君子以非礼弗履。","source": CLASSICAL_SOURCE},
  {"number":35,"slug":"35-progress","englishName":"Progress","chineseName":"晋","pinyin":"jìn","symbol":"䷢","trigrams":{"lower":"kun","upper":"li"},"judgment":"晋：康侯用锡马蕃庶，昼日三接。","image":"明出地上，晋；君子以自昭明德。","source": CLASSICAL_SOURCE},
  {"number":36,"slug":"36-darkening-of-the-light","englishName":"Darkening of the Light","chineseName":"明夷","pinyin":"míng yí","symbol":"䷣","trigrams":{"lower":"li","upper":"kun"},"judgment":"明夷：利艰贞。","image":"明入地中，明夷；君子以莅众，用晦而明。","source": CLASSICAL_SOURCE},
  {"number":37,"slug":"37-the-family","englishName":"The Family","chineseName":"家人","pinyin":"jiā rén","symbol":"䷤","trigrams":{"lower":"li","upper":"xun"},"judgment":"家人：利女贞。","image":"风自火出，家人；君子以言有物，而行有恒。","source": CLASSICAL_SOURCE},
  {"number":38,"slug":"38-opposition","englishName":"Opposition","chineseName":"睽","pinyin":"kuí","symbol":"䷥","trigrams":{"lower":"dui","upper":"li"},"judgment":"睽：小事吉。","image":"上火下泽，睽；君子以同而异。","source": CLASSICAL_SOURCE},
  {"number":39,"slug":"39-obstruction","englishName":"Obstruction","chineseName":"蹇","pinyin":"jiǎn","symbol":"䷦","trigrams":{"lower":"gen","upper":"kan"},"judgment":"蹇：利西南，不利东北；利见大人，贞吉。","image":"山上有水，蹇；君子以反身修德。","source": CLASSICAL_SOURCE},
  {"number":40,"slug":"40-deliverance","englishName":"Deliverance","chineseName":"解","pinyin":"jiě","symbol":"䷧","trigrams":{"lower":"kan","upper":"zhen"},"judgment":"解：利西南，无所往，其来复吉。有攸往，夙吉。","image":"雷雨作，解；君子以赦过宥罪。","source": CLASSICAL_SOURCE},
  {"number":41,"slug":"41-decrease","englishName":"Decrease","chineseName":"损","pinyin":"sǔn","symbol":"䷨","trigrams":{"lower":"dui","upper":"gen"},"judgment":"损：有孚，元吉。无咎，可贞，利有攸往。曷之用？二簋可用享。","image":"山下有泽，损；君子以惩忿窒欲。","source": CLASSICAL_SOURCE},
  {"number":42,"slug":"42-increase","englishName":"Increase","chineseName":"益","pinyin":"yì","symbol":"䷩","trigrams":{"lower":"zhen","upper":"xun"},"judgment":"益：利有攸往。利涉大川。","image":"风雷，益；君子以见善则迁，有过则改。","source": CLASSICAL_SOURCE},
  {"number":43,"slug":"43-breakthrough","englishName":"Breakthrough","chineseName":"夬","pinyin":"guài","symbol":"䷪","trigrams":{"lower":"qian","upper":"dui"},"judgment":"夬：扬于王庭，孚号，有厉，告自邑，不利即戎，利有攸往。","image":"泽上于天，夬；君子以施禄及下，居德则忌。","source": CLASSICAL_SOURCE},
  {"number":44,"slug":"44-coming-to-meet","englishName":"Coming to Meet","chineseName":"姤","pinyin":"gòu","symbol":"䷫","trigrams":{"lower":"xun","upper":"qian"},"judgment":"姤：女壮，勿用取女。","image":"天下有风，姤；后以施命诰四方。","source": CLASSICAL_SOURCE},
  {"number":45,"slug":"45-gathering-together","englishName":"Gathering Together","chineseName":"萃","pinyin":"cuì","symbol":"䷬","trigrams":{"lower":"kun","upper":"dui"},"judgment":"萃：亨。王假有庙，利见大人，亨。利贞。用大牲吉，利有攸往。","image":"泽上于地，萃；君子以除戎器，戒不虞。","source": CLASSICAL_SOURCE},
  {"number":46,"slug":"46-pushing-upward","englishName":"Pushing Upward","chineseName":"升","pinyin":"shēng","symbol":"䷭","trigrams":{"lower":"xun","upper":"kun"},"judgment":"升：元亨，用见大人，勿恤，南征吉。","image":"地中生木，升；君子以顺德，积小以高大。","source": CLASSICAL_SOURCE},
  {"number":47,"slug":"47-oppression","englishName":"Oppression","chineseName":"困","pinyin":"kùn","symbol":"䷮","trigrams":{"lower":"kan","upper":"dui"},"judgment":"困：亨，贞大人吉，无咎，有言不信。","image":"泽无水，困；君子以致命遂志。","source": CLASSICAL_SOURCE},
  {"number":48,"slug":"48-the-well","englishName":"The Well","chineseName":"井","pinyin":"jǐng","symbol":"䷯","trigrams":{"lower":"xun","upper":"kan"},"judgment":"井：改邑不改井，无丧无得，往来井井。汔至亦未繘井。羸其瓶，凶。","image":"木上有水，井；君子以劳民劝相。","source": CLASSICAL_SOURCE},
  {"number":49,"slug":"49-revolution","englishName":"Revolution","chineseName":"革","pinyin":"gé","symbol":"䷰","trigrams":{"lower":"li","upper":"dui"},"judgment":"革：巳日乃孚，元亨。利贞。悔亡。","image":"泽中有火，革；君子以治历明时。","source": CLASSICAL_SOURCE},
  {"number":50,"slug":"50-the-cauldron","englishName":"The Cauldron","chineseName":"鼎","pinyin":"dǐng","symbol":"䷱","trigrams":{"lower":"xun","upper":"li"},"judgment":"鼎：元吉，亨。","image":"木上有火，鼎；君子以正位凝命。","source": CLASSICAL_SOURCE},
  {"number":51,"slug":"51-the-arousing-thunder","englishName":"The Arousing Thunder","chineseName":"震","pinyin":"zhèn","symbol":"䷲","trigrams":{"lower":"zhen","upper":"zhen"},"judgment":"震：亨。震来虩虩，笑言哑哑。震惊百里，不丧匕鬯。","image":"洊雷，震；君子以恐惧修省。","source": CLASSICAL_SOURCE},
  {"number":52,"slug":"52-keeping-still-mountain","englishName":"Keeping Still Mountain","chineseName":"艮","pinyin":"gèn","symbol":"䷳","trigrams":{"lower":"gen","upper":"gen"},"judgment":"艮：艮其背，不获其身，行其庭，不见其人，无咎。","image":"兼山，艮；君子以思不出其位。","source": CLASSICAL_SOURCE},
  {"number":53,"slug":"53-development","englishName":"Development","chineseName":"渐","pinyin":"jiàn","symbol":"䷴","trigrams":{"lower":"gen","upper":"xun"},"judgment":"渐：女归吉，利贞。","image":"山上有木，渐；君子以居贤德，善俗。","source": CLASSICAL_SOURCE},
  {"number":54,"slug":"54-the-marrying-maiden","englishName":"The Marrying Maiden","chineseName":"归妹","pinyin":"guī mèi","symbol":"䷵","trigrams":{"lower":"dui","upper":"zhen"},"judgment":"归妹：征凶，无攸利。","image":"泽上有雷，归妹；君子以永终知敝。","source": CLASSICAL_SOURCE},
  {"number":55,"slug":"55-abundance","englishName":"Abundance","chineseName":"丰","pinyin":"fēng","symbol":"䷶","trigrams":{"lower":"li","upper":"zhen"},"judgment":"丰：亨。王假之，勿忧，宜日中。","image":"雷电皆至，丰；君子以折狱致刑。","source": CLASSICAL_SOURCE},
  {"number":56,"slug":"56-the-wanderer","englishName":"The Wanderer","chineseName":"旅","pinyin":"lǚ","symbol":"䷷","trigrams":{"lower":"gen","upper":"li"},"judgment":"旅：小亨，旅贞吉。","image":"山上有火，旅；君子以明慎用刑，而不留狱。","source": CLASSICAL_SOURCE},
  {"number":57,"slug":"57-the-gentle-wind","englishName":"The Gentle Wind","chineseName":"巽","pinyin":"xùn","symbol":"䷸","trigrams":{"lower":"xun","upper":"xun"},"judgment":"巽：小亨。利有攸往。利见大人。","image":"随风，巽；君子以申命行事。","source": CLASSICAL_SOURCE},
  {"number":58,"slug":"58-the-joyous-lake","englishName":"The Joyous Lake","chineseName":"兑","pinyin":"duì","symbol":"䷹","trigrams":{"lower":"dui","upper":"dui"},"judgment":"兑：亨。利贞。","image":"丽泽，兑；君子以朋友讲习。","source": CLASSICAL_SOURCE},
  {"number":59,"slug":"59-dispersion","englishName":"Dispersion","chineseName":"涣","pinyin":"huàn","symbol":"䷺","trigrams":{"lower":"kan","upper":"xun"},"judgment":"涣：亨。王假有庙，利涉大川，利贞。","image":"风行水上，涣；先王以享于帝立庙。","source": CLASSICAL_SOURCE},
  {"number":60,"slug":"60-limitation","englishName":"Limitation","chineseName":"节","pinyin":"jié","symbol":"䷻","trigrams":{"lower":"dui","upper":"kan"},"judgment":"节：亨。苦节不可贞。","image":"泽上有水，节；君子以制数度，议德行。","source": CLASSICAL_SOURCE},
  {"number":61,"slug":"61-inner-truth","englishName":"Inner Truth","chineseName":"中孚","pinyin":"zhōng fú","symbol":"䷼","trigrams":{"lower":"dui","upper":"xun"},"judgment":"中孚：豚鱼吉，利涉大川，利贞。","image":"泽上有风，中孚；君子以议狱缓死。","source": CLASSICAL_SOURCE},
  {"number":62,"slug":"62-small-exceeding","englishName":"Small Exceeding","chineseName":"小过","pinyin":"xiǎo guò","symbol":"䷽","trigrams":{"lower":"gen","upper":"zhen"},"judgment":"小过：亨。利贞。可小事，不可大事。飞鸟遗之音，不宜上宜下，大吉。","image":"山上有雷，小过；君子以行过乎恭，丧过乎哀，用过乎俭。","source": CLASSICAL_SOURCE},
  {"number":63,"slug":"63-after-completion","englishName":"After Completion","chineseName":"既济","pinyin":"jì jì","symbol":"䷾","trigrams":{"lower":"li","upper":"kan"},"judgment":"既济：亨小。利贞。初吉终乱。","image":"水在火上，既济；君子以思患而豫防之。","source": CLASSICAL_SOURCE},
  {"number":64,"slug":"64-before-completion","englishName":"Before Completion","chineseName":"未济","pinyin":"wèi jì","symbol":"䷿","trigrams":{"lower":"kan","upper":"li"},"judgment":"未济：亨。小狐汔济，濡其尾，无攸利。","image":"火在水上，未济；君子以慎辨物居方。","source": CLASSICAL_SOURCE},
] as const satisfies readonly ClassicalHexagramCatalogEntry[];

export const CLASSICAL_HEXAGRAMS = CLASSICAL_HEXAGRAM_DATA.map((hexagram) => {
  const source = sourceFor(hexagram.number);
  const sourceText = CLASSICAL_SOURCE_TEXT[hexagram.number];
  if (!sourceText) throw new Error(`CLASSICAL_SOURCE_TEXT_MISSING: ${hexagram.number}`);
  return {
    ...hexagram,
    ...(hexagram.number === 33 ? { chineseName: "遁", variantName: "遯" } : {}),
    judgment: sourceText.judgment,
    image: sourceText.image,
    source,
    lines: linesFor(hexagram.number, source),
    ...(sourceText.useLine ? { useLine: { ...sourceText.useLine, source } } : {}),
  };
}) satisfies readonly ClassicalHexagram[];

export const CLASSICAL_HEXAGRAM_BY_NUMBER: Map<number, ClassicalHexagram> = new Map(
  CLASSICAL_HEXAGRAMS.map((hexagram) => [hexagram.number, hexagram]),
);

export function classicalHexagramByNumber(number: number): ClassicalHexagram {
  const hexagram = CLASSICAL_HEXAGRAM_BY_NUMBER.get(number);
  if (!hexagram) throw new Error(`CLASSICAL_HEXAGRAM_MISSING: ${number}`);
  return hexagram;
}
