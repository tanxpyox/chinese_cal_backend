#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import OpenCC from "opencc-js";
import { Solar } from "lunar-javascript";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const SCHEMA_VERSION = "1.0.0";
const DEFAULT_TIME_ZONE = process.env.CALENDAR_TZ || "Asia/Taipei";
const SOLAR_TERM_KEY_NAMES = {
  LI_CHUN: "立春",
  YU_SHUI: "雨水",
  JING_ZHE: "驚蟄",
  CHUN_FEN: "春分",
  QING_MING: "清明",
  GU_YU: "穀雨",
  LI_XIA: "立夏",
  XIAO_MAN: "小滿",
  MANG_ZHONG: "芒種",
  XIA_ZHI: "夏至",
  XIAO_SHU: "小暑",
  DA_SHU: "大暑",
  LI_QIU: "立秋",
  CHU_SHU: "處暑",
  BAI_LU: "白露",
  QIU_FEN: "秋分",
  HAN_LU: "寒露",
  SHUANG_JIANG: "霜降",
  LI_DONG: "立冬",
  XIAO_XUE: "小雪",
  DA_XUE: "大雪",
  DONG_ZHI: "冬至",
  XIAO_HAN: "小寒",
  DA_HAN: "大寒"
};

const converter = OpenCC.Converter({ from: "cn", to: "tw" });

function parseArgs(argv) {
  const args = {
    date: "today",
    out: null,
    dateOutDir: null,
    timeZone: DEFAULT_TIME_ZONE,
    pretty: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--date") args.date = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--date-out-dir") args.dateOutDir = argv[++i];
    else if (arg === "--timezone" || arg === "--time-zone") args.timeZone = argv[++i];
    else if (arg === "--compact") args.pretty = false;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Generate traditional Chinese calendar JSON.

Usage:
  npm run generate -- [options]

Options:
  --date YYYY-MM-DD       Gregorian date to generate. Defaults to today in CALENDAR_TZ.
  --out FILE              Write JSON to FILE. Defaults to stdout.
  --date-out-dir DIR      Also write DIR/YYYY-MM-DD.json.
  --timezone TZ           IANA timezone for "today". Defaults to CALENDAR_TZ or Asia/Taipei.
  --compact               Write compact JSON.
`);
}

function todayInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseDate(dateArg, timeZone) {
  const date = !dateArg || dateArg === "today" ? todayInTimeZone(timeZone) : dateArg;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date "${date}". Expected YYYY-MM-DD.`);

  const [, y, m, d] = match;
  return {
    date,
    year: Number(y),
    month: Number(m),
    day: Number(d)
  };
}

function call(obj, method, fallback = null, ...args) {
  if (!obj || typeof obj[method] !== "function") return fallback;
  try {
    const value = obj[method](...args);
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function toTraditional(value) {
  if (typeof value === "string") return converter(value);
  if (Array.isArray(value)) return value.map((item) => toTraditional(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toTraditional(item)])
    );
  }
  return value;
}

function nullableString(value) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function serializeSolarTermTable(lunar) {
  const table = call(lunar, "getJieQiTable", null);
  if (!table) return {};

  const entries = table instanceof Map ? table.entries() : Object.entries(table);
  return Object.fromEntries(
    Array.from(entries).map(([name, solar]) => [
      solarTermName(name),
      {
        date: solarToIsoDate(solar),
        time: nullableString(call(solar, "toYmdHms", null) || call(solar, "toYmd", null))
      }
    ])
  );
}

function solarTermName(name) {
  const raw = String(name);
  return converter(SOLAR_TERM_KEY_NAMES[raw] || raw);
}

function solarToIsoDate(solar) {
  const year = call(solar, "getYear");
  const month = call(solar, "getMonth");
  const day = call(solar, "getDay");
  if (!year || !month || !day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function serializeNineStar(star) {
  if (!star) return null;
  return toTraditional({
    number: call(star, "getNumber"),
    color: call(star, "getColor"),
    element: call(star, "getWuXing"),
    name: call(star, "getName"),
    taiYiName: call(star, "getNameInTaiYi"),
    luck: call(star, "getLuck"),
    song: call(star, "getSong"),
    fullText: call(star, "toFullString", call(star, "toString", null))
  });
}

function serializeTimes(lunar) {
  const times = call(lunar, "getTimes", []);
  if (!Array.isArray(times)) return [];

  return times.map((time) =>
    toTraditional({
      label: call(time, "toString"),
      fullText: call(time, "toFullString"),
      ganZhi: call(time, "getGanZhi"),
      heavenlyStem: call(time, "getGan"),
      earthlyBranch: call(time, "getZhi"),
      zodiac: call(time, "getShengXiao"),
      naYin: call(time, "getNaYin"),
      clash: call(time, "getChong"),
      clashDescription: call(time, "getChongDesc"),
      sha: call(time, "getSha"),
      auspicious: stringArray(call(time, "getYi", [])),
      inauspicious: stringArray(call(time, "getJi", [])),
      deity: {
        name: call(time, "getTianShen"),
        type: call(time, "getTianShenType"),
        luck: call(time, "getTianShenLuck")
      }
    })
  );
}

function serializeCalendarDay({ year, month, day, date, timeZone }) {
  const solar = Solar.fromYmd(year, month, day);
  const lunar = solar.getLunar();

  const json = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    timeZone,
    date,
    source: {
      lunarJavascript: getPackageVersion("lunar-javascript"),
      openccJs: getPackageVersion("opencc-js"),
      conversion: "OpenCC cn -> tw"
    },
    gregorian: {
      year: call(solar, "getYear"),
      month: call(solar, "getMonth"),
      day: call(solar, "getDay"),
      isoDate: solarToIsoDate(solar),
      weekdayIndex: call(solar, "getWeek"),
      weekday: call(solar, "getWeekInChinese"),
      constellation: call(solar, "getXingZuo"),
      festivals: stringArray(call(solar, "getFestivals", [])),
      otherFestivals: stringArray(call(solar, "getOtherFestivals", []))
    },
    lunar: {
      year: call(lunar, "getYear"),
      month: Math.abs(call(lunar, "getMonth", 0)),
      day: call(lunar, "getDay"),
      isLeapMonth: call(lunar, "isLeap", call(lunar, "getMonth", 0) < 0),
      yearText: call(lunar, "getYearInChinese"),
      monthText: call(lunar, "getMonthInChinese"),
      dayText: call(lunar, "getDayInChinese"),
      dateText: call(lunar, "toString"),
      fullText: call(lunar, "toFullString"),
      festivals: stringArray(call(lunar, "getFestivals", [])),
      otherFestivals: stringArray(call(lunar, "getOtherFestivals", []))
    },
    solarTerms: {
      today: nullableString(call(lunar, "getJieQi")),
      yearTable: serializeSolarTermTable(lunar)
    },
    stemsBranches: {
      year: call(lunar, "getYearInGanZhi"),
      yearByLiChun: call(lunar, "getYearInGanZhiByLiChun"),
      yearExact: call(lunar, "getYearInGanZhiExact"),
      month: call(lunar, "getMonthInGanZhi"),
      monthExact: call(lunar, "getMonthInGanZhiExact"),
      day: call(lunar, "getDayInGanZhi"),
      dayExact: call(lunar, "getDayInGanZhiExact")
    },
    zodiac: {
      year: call(lunar, "getYearShengXiao"),
      month: call(lunar, "getMonthShengXiao"),
      day: call(lunar, "getDayShengXiao")
    },
    naYin: {
      year: call(lunar, "getYearNaYin"),
      month: call(lunar, "getMonthNaYin"),
      day: call(lunar, "getDayNaYin")
    },
    almanac: {
      auspicious: stringArray(call(lunar, "getDayYi", [])),
      inauspicious: stringArray(call(lunar, "getDayJi", [])),
      clash: call(lunar, "getDayChong"),
      clashDescription: call(lunar, "getDayChongDesc"),
      sha: call(lunar, "getDaySha"),
      pengZu: {
        heavenlyStem: call(lunar, "getPengZuGan"),
        earthlyBranch: call(lunar, "getPengZuZhi")
      },
      deity: {
        name: call(lunar, "getDayTianShen"),
        type: call(lunar, "getDayTianShenType"),
        luck: call(lunar, "getDayTianShenLuck")
      }
    },
    directions: {
      joy: call(lunar, "getDayPositionXi"),
      fortune: call(lunar, "getDayPositionFu"),
      wealth: call(lunar, "getDayPositionCai"),
      yangNoble: call(lunar, "getDayPositionYangGui"),
      yinNoble: call(lunar, "getDayPositionYinGui")
    },
    stars: {
      nineStar: serializeNineStar(call(lunar, "getDayNineStar")),
      mansion: {
        name: call(lunar, "getXiu"),
        luck: call(lunar, "getXiuLuck"),
        song: call(lunar, "getXiuSong"),
        animal: call(lunar, "getAnimal"),
        palace: call(lunar, "getGong"),
        beast: call(lunar, "getShou"),
        zheng: call(lunar, "getZheng")
      }
    },
    season: {
      phase: call(lunar, "getYueXiang"),
      hou: call(lunar, "getHou"),
      wuHou: call(lunar, "getWuHou")
    },
    times: serializeTimes(lunar)
  };

  return toTraditional(json);
}

function getPackageVersion(packageName) {
  try {
    let current = path.dirname(require.resolve(packageName));
    while (current && current !== path.dirname(current)) {
      const packageJson = path.join(current, "package.json");
      if (fs.existsSync(packageJson)) {
        const parsed = JSON.parse(fs.readFileSync(packageJson, "utf8"));
        if (parsed.name === packageName) return parsed.version;
      }
      current = path.dirname(current);
    }
    return null;
  } catch {
    return null;
  }
}

function writeJson(filePath, value, pretty) {
  const absolute = path.resolve(repoRoot, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
  return absolute;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dateParts = parseDate(args.date, args.timeZone);
  const calendarDay = serializeCalendarDay({ ...dateParts, timeZone: args.timeZone });

  if (args.out) {
    const written = writeJson(args.out, calendarDay, args.pretty);
    console.error(`Wrote ${path.relative(repoRoot, written)}`);
  } else {
    process.stdout.write(`${JSON.stringify(calendarDay, null, args.pretty ? 2 : 0)}\n`);
  }

  if (args.dateOutDir) {
    const datedFile = path.join(args.dateOutDir, `${dateParts.date}.json`);
    const written = writeJson(datedFile, calendarDay, args.pretty);
    console.error(`Wrote ${path.relative(repoRoot, written)}`);
  }
}

main();
