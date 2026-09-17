// Reading one night of sleep out of an Apple Health export, in the browser.
//
// The file this reads is `export.xml` from Health, profile, Export All Health
// Data. It is routinely hundreds of megabytes, because it holds every heart
// rate sample the person has ever taken, and handing a file that size to
// DOMParser or reading it into one string kills the tab. So nothing here ever
// holds the file: the blob is read a slice at a time, each slice is decoded
// with a streaming TextDecoder, sleep records are picked out of the text as it
// goes, and everything else is discarded before the next slice arrives.
//
// The window is decided before the scan rather than after it. A student asks
// for one date, and only the records overlapping that one night are ever kept,
// so the page holds one night no matter how many years the file covers. That
// is the course's scope rule (nothing tracked over longer than a single day's
// structure) enforced in the reader rather than in the layout, and it is also
// the strongest form of the privacy promise: the rest of the export goes past
// without being retained.
//
// The format, checked against Apple's own docs and against published examples
// rather than assumed:
//
//   <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="..."
//           sourceVersion="..." creationDate="..." startDate="..."
//           endDate="..." value="HKCategoryValueSleepAnalysisAsleepCore">
//     <MetadataEntry key="..." value="..."/>
//   </Record>
//
// Three things about that shape drive the parser. A Record is not always self
// closing: it can carry MetadataEntry children, so only the start tag can be
// scanned for and the closing tag has to be ignored. Attribute values are
// quoted and can contain angle brackets in escaped form, so finding the end of
// a start tag means tracking quotes rather than looking for the next ">". And
// the timestamps are local time with a trailing offset, "2024-01-15 23:45:00
// +1100", which is not a format every browser's Date constructor accepts, so
// they are parsed here by hand instead.
//
// Stages (Core, Deep, REM) only exist from watchOS 9 and iOS 16. An older
// export carries in bed and asleep and nothing else, and that is a complete
// record of what that instrument could say rather than a broken one, so the
// legacy value is normalised alongside the new ones and no caller has to know
// which shape it was handed.

/** The states an export can put a stretch of night into. */
export type SleepStateKey = "inBed" | "awake" | "rem" | "core" | "deep" | "asleep" | "other";

export interface SleepSegment {
  /** The device that wrote the record. Per record, so one night can hold several. */
  source: string;
  /** The raw `value` attribute, kept so nothing is lost in the normalising. */
  value: string;
  state: SleepStateKey;
  /** What to print for that state. */
  label: string;
  /**
   * The clock the instrument recorded, as an epoch built from the wall clock
   * fields alone. Used for placing and printing, so a reader in another
   * timezone still sees the times that were on the watch that night.
   */
  startWallMs: number;
  endWallMs: number;
  /** The real instant, offset applied. Used for lengths, so a night that
   * crosses a daylight saving change still adds up. */
  startAbsMs: number;
  endAbsMs: number;
  minutes: number;
}

export interface NightWindow {
  startWallMs: number;
  endWallMs: number;
}

export interface ScanResult {
  /** Only the segments overlapping the window. Everything else is dropped. */
  segments: SleepSegment[];
  /** How many sleep records the whole file held, kept or not. */
  sleepRecordsSeen: number;
  /** How many Record elements of any type went past. */
  recordsSeen: number;
  bytesRead: number;
  /** True once a `<HealthData` root has been seen: this is the right file. */
  sawHealthData: boolean;
  /** True for export_cda.xml, which is the other file in the zip. */
  sawClinicalDocument: boolean;
}

export interface ScanOptions {
  /** Bytes per slice. Small values are how the tests exercise the boundary. */
  chunkSize?: number;
  onProgress?: (bytesRead: number, total: number) => void;
  /** Called between slices, so a page can stay responsive. */
  yieldBetweenChunks?: () => Promise<void>;
}

const SLEEP_TYPE = "HKCategoryTypeIdentifierSleepAnalysis";
const RECORD_TAG = "<Record";
const DEFAULT_CHUNK = 4 * 1024 * 1024;

// A start tag longer than this is not a start tag, it is a malformed file, and
// carrying it forward for ever would be the one way this scanner could grow
// without limit.
const MAX_CARRY = 1024 * 1024;

const STATES: Record<string, { key: SleepStateKey; label: string }> = {
  HKCategoryValueSleepAnalysisInBed: { key: "inBed", label: "In bed" },
  HKCategoryValueSleepAnalysisAwake: { key: "awake", label: "Awake" },
  HKCategoryValueSleepAnalysisAsleepREM: { key: "rem", label: "REM" },
  HKCategoryValueSleepAnalysisAsleepCore: { key: "core", label: "Core" },
  HKCategoryValueSleepAnalysisAsleepDeep: { key: "deep", label: "Deep" },
  HKCategoryValueSleepAnalysisAsleepUnspecified: { key: "asleep", label: "Asleep" },
  // What every export written before watchOS 9 and iOS 16 says. Apple has
  // deprecated it in favour of AsleepUnspecified and both mean the same thing
  // to a reader: asleep, with no stage claimed.
  HKCategoryValueSleepAnalysisAsleep: { key: "asleep", label: "Asleep" },
};

/** The states that count as sleep. In bed is not one of them, and awake is not either. */
export const ASLEEP_STATES: SleepStateKey[] = ["asleep", "core", "deep", "rem"];

/** The order the lanes are drawn and the rows are listed in. */
export const STATE_ORDER: SleepStateKey[] = ["inBed", "awake", "rem", "core", "asleep", "deep", "other"];

/** Normalise a raw `value` attribute. Anything unrecognised keeps its own name
 * rather than being dropped: a value this course has not met is still a
 * stretch of the night the instrument recorded. */
export const stateOf = (value: string): { key: SleepStateKey; label: string } => {
  const known = STATES[value];
  if (known) return known;
  const tail = value.replace(/^HKCategoryValueSleepAnalysis/, "");
  return { key: "other", label: tail || value };
};

const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&#x27;": "'",
};

/** XML attribute values arrive escaped. Ampersand is unescaped last, so that a
 * literal "&amp;lt;" in a device name does not become "<". */
export const unescapeXml = (text: string): string =>
  text
    .replace(/&(?:lt|gt|quot|apos|#39|#x27);/g, (found) => ENTITIES[found] ?? found)
    .replace(/&amp;/g, "&");

/**
 * The index just past the ">" that closes the start tag beginning at `from`,
 * or -1 if this buffer does not hold the whole of it.
 *
 * Quote aware, because an attribute value may legally contain ">". Apple
 * escapes the angle brackets in its `device` attribute, but a parser that
 * relies on that is relying on something the format does not promise.
 */
export const endOfStartTag = (text: string, from: number): number => {
  let quote = "";
  for (let index = from; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return index + 1;
  }
  return -1;
};

const ATTRIBUTE = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** Every attribute on a start tag, unescaped. */
export const parseAttributes = (tag: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  ATTRIBUTE.lastIndex = 0;
  let found = ATTRIBUTE.exec(tag);
  while (found) {
    attributes[found[1]] = unescapeXml(found[2] ?? found[3] ?? "");
    found = ATTRIBUTE.exec(tag);
  }
  return attributes;
};

const STAMP =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

export interface HealthDate {
  /** The wall clock, as if it were UTC. What the instrument's own clock said. */
  wallMs: number;
  /** The real instant, offset applied. */
  absMs: number;
  offsetMinutes: number;
}

/**
 * "2024-01-15 23:45:00 +1100" to a pair of epochs.
 *
 * Done by hand because that string is not a format the Date constructor is
 * required to accept: the space instead of a T and the offset without a colon
 * are both outside what the specification guarantees, and browsers have
 * genuinely disagreed about it. Both spellings of the offset are taken, plus a
 * trailing Z, plus no offset at all, which is read as the wall clock standing
 * for the instant.
 */
export const parseHealthDate = (value: string): HealthDate | null => {
  const found = STAMP.exec(value.trim());
  if (!found) return null;
  const [, year, month, day, hour, minute, second, zone] = found;
  const wallMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? "0"),
  );
  if (!Number.isFinite(wallMs)) return null;

  let offsetMinutes = 0;
  if (zone && zone !== "Z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    const digits = zone.slice(1).replace(":", "");
    offsetMinutes = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
  }
  return { wallMs, absMs: wallMs - offsetMinutes * 60_000, offsetMinutes };
};

/**
 * The night that closes a given day: midday on that date to midday the next.
 *
 * Noon to noon is the sleep diary convention and it is what makes "the night of
 * the fifteenth" mean one thing. It takes an evening bedtime and a morning
 * waking without taking the previous night's, and it is stated on the page so a
 * reader is never guessing which night they were shown.
 *
 * The window is in wall clock terms, so it lines up with the clock the student
 * read that night rather than with wherever the browser thinks it is now.
 */
export const nightWindowFor = (isoDate: string): NightWindow | null => {
  const found = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!found) return null;
  const noon = Date.UTC(Number(found[1]), Number(found[2]) - 1, Number(found[3]), 12);
  if (!Number.isFinite(noon)) return null;
  return { startWallMs: noon, endWallMs: noon + 24 * 60 * 60_000 };
};

const overlaps = (start: number, end: number, window: NightWindow): boolean =>
  start < window.endWallMs && end > window.startWallMs;

const readTag = (tag: string, window: NightWindow, sink: ScanResult): void => {
  sink.recordsSeen += 1;
  // Cheapest possible rejection first. Nearly every record in the file is a
  // heart rate sample, and the substring test is what keeps a 500MB scan from
  // running the attribute regex half a million times.
  if (!tag.includes(SLEEP_TYPE)) return;
  const attributes = parseAttributes(tag);
  if (attributes.type !== SLEEP_TYPE) return;
  sink.sleepRecordsSeen += 1;

  const start = parseHealthDate(attributes.startDate ?? "");
  const end = parseHealthDate(attributes.endDate ?? "");
  if (!start || !end) return;
  if (!overlaps(start.wallMs, end.wallMs, window)) return;

  const value = attributes.value ?? "";
  const { key, label } = stateOf(value);
  sink.segments.push({
    source: attributes.sourceName?.trim() || "Unnamed source",
    value,
    state: key,
    label,
    startWallMs: start.wallMs,
    endWallMs: end.wallMs,
    startAbsMs: start.absMs,
    endAbsMs: end.absMs,
    minutes: Math.max(0, (end.absMs - start.absMs) / 60_000),
  });
};

/**
 * Pull every complete Record start tag out of `buffer` and return what has to
 * be carried into the next slice.
 *
 * This is the whole of the boundary case, and it is the bug this scanner exists
 * to not have. A record can be cut anywhere: in the middle of an attribute, in
 * the middle of the word Record, between the "<" and the "R". So a buffer whose
 * last start tag has no ">" yet is carried from that tag onward, and a buffer
 * that merely ends in something that could become "<Record" carries those few
 * characters. Everything before that point has been read and is dropped.
 */
export const consumeBuffer = (
  buffer: string,
  window: NightWindow,
  sink: ScanResult,
  final: boolean,
): string => {
  let position = 0;
  for (;;) {
    const at = buffer.indexOf(RECORD_TAG, position);
    if (at === -1) break;
    // "<RecordSomething" is a different element. Only whitespace, a slash or
    // the closing bracket may follow the name.
    const next = buffer[at + RECORD_TAG.length];
    if (next !== undefined && !/[\s/>]/.test(next)) {
      position = at + RECORD_TAG.length;
      continue;
    }
    if (next === undefined && !final) return buffer.slice(at);
    const tagEnd = endOfStartTag(buffer, at);
    if (tagEnd === -1) {
      if (final) break;
      return buffer.slice(at);
    }
    readTag(buffer.slice(at, tagEnd), window, sink);
    position = tagEnd;
  }
  if (final) return "";
  const keepFrom = Math.max(position, buffer.length - (RECORD_TAG.length - 1));
  return buffer.slice(keepFrom);
};

const emptyResult = (): ScanResult => ({
  segments: [],
  sleepRecordsSeen: 0,
  recordsSeen: 0,
  bytesRead: 0,
  sawHealthData: false,
  sawClinicalDocument: false,
});

/** The first four bytes of a zip archive. A student who drops export.zip gets
 * told what to do with it rather than watching a scan find nothing. */
export const looksLikeZip = async (blob: Blob): Promise<boolean> => {
  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
};

/**
 * Scan a Health export for the one night asked for.
 *
 * Nothing outside the window survives the call, and the file itself is never
 * held: at any moment this holds one slice, one carry buffer and the segments
 * of a single night.
 */
export const scanSleepWindow = async (
  blob: Blob,
  window: NightWindow,
  options: ScanOptions = {},
): Promise<ScanResult> => {
  const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK);
  const decoder = new TextDecoder("utf-8");
  const sink = emptyResult();
  let carry = "";
  let position = 0;
  let firstChunk = true;

  while (position < blob.size) {
    const end = Math.min(position + chunkSize, blob.size);
    const buffer = await blob.slice(position, end).arrayBuffer();
    position = end;
    sink.bytesRead = position;
    const text = decoder.decode(buffer, { stream: true });

    if (firstChunk) {
      firstChunk = false;
      if (text.includes("<HealthData")) sink.sawHealthData = true;
      if (text.includes("ClinicalDocument")) sink.sawClinicalDocument = true;
    }

    carry = consumeBuffer(carry + text, window, sink, false);
    if (carry.length > MAX_CARRY) carry = "";
    options.onProgress?.(position, blob.size);
    if (options.yieldBetweenChunks) await options.yieldBetweenChunks();
  }

  consumeBuffer(carry + decoder.decode(), window, sink, true);
  sink.segments.sort((one, two) => one.startWallMs - two.startWallMs || one.endWallMs - two.endWallMs);
  return sink;
};

export interface SourceNight {
  source: string;
  segments: SleepSegment[];
}

/**
 * One group per device that wrote a record on this night, in the order they
 * first appear.
 *
 * Deliberately not merged. An export commonly holds records from a phone and a
 * watch for the same hours, written by two instruments that were not measuring
 * the same thing, and laying one over the other would invent a timeline neither
 * of them recorded. It would also be week 3's exercise, which is the one thing
 * this component must not do.
 */
export const groupBySource = (segments: SleepSegment[]): SourceNight[] => {
  const groups = new Map<string, SleepSegment[]>();
  for (const segment of segments) {
    const existing = groups.get(segment.source);
    if (existing) existing.push(segment);
    else groups.set(segment.source, [segment]);
  }
  return Array.from(groups, ([source, list]) => ({ source, segments: list }));
};

export interface StateTotal {
  key: SleepStateKey;
  label: string;
  minutes: number;
  count: number;
}

export interface NightSummary {
  segmentCount: number;
  /** Where the instrument's record of this night starts and ends. */
  spanStartWallMs: number | null;
  spanEndWallMs: number | null;
  /** First and last stretch the export called sleep of any kind. */
  firstAsleepWallMs: number | null;
  lastAsleepWallMs: number | null;
  asleepMinutes: number;
  inBedMinutes: number;
  totals: StateTotal[];
  hasStages: boolean;
}

/**
 * Add up what one source recorded. Sums and nothing else: no score, no
 * comparison, no reading of what any of it means.
 */
export const summarise = (segments: SleepSegment[]): NightSummary => {
  const totals = new Map<SleepStateKey, StateTotal>();
  let spanStart: number | null = null;
  let spanEnd: number | null = null;
  let firstAsleep: number | null = null;
  let lastAsleep: number | null = null;

  for (const segment of segments) {
    const running = totals.get(segment.state);
    if (running) {
      running.minutes += segment.minutes;
      running.count += 1;
    } else {
      totals.set(segment.state, {
        key: segment.state,
        label: segment.label,
        minutes: segment.minutes,
        count: 1,
      });
    }
    spanStart = spanStart === null ? segment.startWallMs : Math.min(spanStart, segment.startWallMs);
    spanEnd = spanEnd === null ? segment.endWallMs : Math.max(spanEnd, segment.endWallMs);
    if (ASLEEP_STATES.includes(segment.state)) {
      firstAsleep = firstAsleep === null ? segment.startWallMs : Math.min(firstAsleep, segment.startWallMs);
      lastAsleep = lastAsleep === null ? segment.endWallMs : Math.max(lastAsleep, segment.endWallMs);
    }
  }

  const ordered = STATE_ORDER.flatMap((key) => {
    const total = totals.get(key);
    return total ? [total] : [];
  });

  return {
    segmentCount: segments.length,
    spanStartWallMs: spanStart,
    spanEndWallMs: spanEnd,
    firstAsleepWallMs: firstAsleep,
    lastAsleepWallMs: lastAsleep,
    asleepMinutes: ordered
      .filter((total) => ASLEEP_STATES.includes(total.key))
      .reduce((sum, total) => sum + total.minutes, 0),
    inBedMinutes: totals.get("inBed")?.minutes ?? 0,
    totals: ordered,
    // Stages arrived with watchOS 9 and iOS 16. An export without them is
    // complete for the instrument that wrote it, and the page says so rather
    // than showing empty rows.
    hasStages: ordered.some((total) => ["core", "deep", "rem"].includes(total.key)),
  };
};

export interface Episode {
  startWallMs: number;
  endWallMs: number;
  segments: SleepSegment[];
  asleepMinutes: number;
}

// An hour of nothing recorded is what separates one stretch of night from
// another. Under that and a wrist that lost contact for forty minutes would be
// read as two nights; over it and an afternoon lie down joins onto the evening.
const EPISODE_GAP_MINUTES = 60;

/**
 * Split one source's night into the continuous stretches it actually recorded.
 *
 * The window is midday to midday, which is what makes "the night of the
 * fifteenth" mean one thing, and it takes in the afternoon of that day as well.
 * So a nap turns up in the window and is not part of the night, and a reader
 * who was shown a single start time and a single end time would be told their
 * sleep began at ten past three in the afternoon. Splitting on gaps is what
 * lets the page print the long stretch and the short one separately, and say
 * plainly that both are in the window.
 */
export const episodesOf = (
  segments: SleepSegment[],
  gapMinutes: number = EPISODE_GAP_MINUTES,
): Episode[] => {
  const ordered = [...segments].sort((one, two) => one.startWallMs - two.startWallMs);
  const gap = gapMinutes * 60_000;
  const episodes: Episode[] = [];
  for (const segment of ordered) {
    const current = episodes[episodes.length - 1];
    if (current && segment.startWallMs <= current.endWallMs + gap) {
      current.endWallMs = Math.max(current.endWallMs, segment.endWallMs);
      current.segments.push(segment);
      if (ASLEEP_STATES.includes(segment.state)) current.asleepMinutes += segment.minutes;
      continue;
    }
    episodes.push({
      startWallMs: segment.startWallMs,
      endWallMs: segment.endWallMs,
      segments: [segment],
      asleepMinutes: ASLEEP_STATES.includes(segment.state) ? segment.minutes : 0,
    });
  }
  return episodes;
};

/** The longest stretch of sleep in the window, which is the one a student came
 * for. Longest by recorded sleep, falling back to the longest span when the
 * export only ever says in bed. */
export const longestEpisode = (episodes: Episode[]): Episode | null => {
  let best: Episode | null = null;
  for (const episode of episodes) {
    if (!best) {
      best = episode;
      continue;
    }
    const better =
      episode.asleepMinutes > best.asleepMinutes ||
      (episode.asleepMinutes === best.asleepMinutes &&
        episode.endWallMs - episode.startWallMs > best.endWallMs - best.startWallMs);
    if (better) best = episode;
  }
  return best;
};

const two = (value: number): string => String(value).padStart(2, "0");

/** The clock the instrument recorded, printed as it recorded it. */
export const formatClock = (wallMs: number): string => {
  const at = new Date(wallMs);
  return `${two(at.getUTCHours())}:${two(at.getUTCMinutes())}`;
};

/** A length in minutes as hours and minutes. */
export const formatLength = (minutes: number): string => {
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest} m`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} m`;
};

/** The calendar date of a wall clock instant, as it was recorded. */
export const formatDate = (wallMs: number): string => {
  const at = new Date(wallMs);
  return `${at.getUTCFullYear()}-${two(at.getUTCMonth() + 1)}-${two(at.getUTCDate())}`;
};
