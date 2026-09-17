// The week 1 sleep reader, tested against the sample export the course ships.
//
// Two of these are contracts the lab makes to a student and the rest are the
// one bug this parser can actually have.
//
// The contracts: the reader shows one night and never a second one, and it
// never merges two instruments into one timeline. Both are course rules rather
// than implementation details. The scope rule in CLAUDE.md puts anything
// tracked over longer than a single day's structure out of the course, and an
// export holds years; rule 4 gives week 3 the two instruments exercise, and a
// week 1 component that laid a phone over a watch would have taken it.
//
// The bug: the file is read in slices, so a record can be cut in half by a
// chunk boundary, and a scanner that loses it loses it silently. Rather than
// picking a boundary and hoping it is the awkward one, every chunk size from
// one byte upward is run over the same file and every one of them has to
// produce exactly the same night. At a chunk size of one byte, every record in
// the file is split hundreds of times.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  consumeBuffer,
  episodesOf,
  formatClock,
  formatLength,
  groupBySource,
  longestEpisode,
  looksLikeZip,
  nightWindowFor,
  parseAttributes,
  parseHealthDate,
  scanSleepWindow,
  summarise,
  type ScanResult,
} from "../src/lib/health-export";

const SAMPLE = resolve("public/samples/apple-health-sleep-sample.xml");
const sampleBytes = readFileSync(SAMPLE);
const sample = (): Blob => new Blob([new Uint8Array(sampleBytes)], { type: "text/xml" });

// The night the sample was written around: the lab date for week 1.
const NIGHT = "2027-02-22";
const WATCH = "Ada's Apple Watch";
const PHONE = "Ada's iPhone";

const windowFor = (date: string) => {
  const found = nightWindowFor(date);
  if (!found) throw new Error(`no window for ${date}`);
  return found;
};

const scan = async (date: string, chunkSize?: number): Promise<ScanResult> =>
  scanSleepWindow(sample(), windowFor(date), chunkSize ? { chunkSize } : {});

describe("reading the timestamps Apple writes", () => {
  it("takes local time with an offset, which is the form the export uses", () => {
    const parsed = parseHealthDate("2027-02-22 23:41:00 +1100");
    expect(parsed).not.toBeNull();
    expect(formatClock(parsed!.wallMs)).toBe("23:41");
    expect(parsed!.offsetMinutes).toBe(660);
    // The instant is the wall clock minus the offset, so two records written in
    // different offsets still sort against each other correctly.
    expect(new Date(parsed!.absMs).toISOString()).toBe("2027-02-22T12:41:00.000Z");
  });

  it("takes the other spellings without a second code path", () => {
    expect(parseHealthDate("2027-02-22 23:41:00 +11:00")?.offsetMinutes).toBe(660);
    expect(parseHealthDate("2027-02-22T23:41:00Z")?.offsetMinutes).toBe(0);
    expect(parseHealthDate("2027-02-22 23:41:00 -0530")?.offsetMinutes).toBe(-330);
    expect(parseHealthDate("2027-02-22 23:41:00")?.absMs).toBe(
      parseHealthDate("2027-02-22 23:41:00")?.wallMs,
    );
  });

  it("refuses what it cannot read rather than guessing", () => {
    expect(parseHealthDate("")).toBeNull();
    expect(parseHealthDate("yesterday evening")).toBeNull();
  });
});

describe("reading the attributes", () => {
  it("unescapes values, including a device name full of brackets", () => {
    const attributes = parseAttributes(
      '<Record sourceName="Bed &amp; Rest" device="&lt;&lt;HKDevice: 0x1&gt;, name:Apple Watch&gt;" value="7"/>',
    );
    expect(attributes.sourceName).toBe("Bed & Rest");
    expect(attributes.device).toBe("<<HKDevice: 0x1>, name:Apple Watch>");
  });
});

describe("one night, and only the night asked for", () => {
  it("finds both sources that recorded the night of 22 February", async () => {
    const result = await scan(NIGHT);
    expect(result.sawHealthData).toBe(true);
    // Grouped in the order the night reaches them, which is the watch first:
    // its afternoon stretch starts before the phone's evening does.
    expect(groupBySource(result.segments).map((group) => group.source)).toEqual([WATCH, PHONE]);
  });

  it("keeps nothing from any other night, however much the file holds", async () => {
    const result = await scan(NIGHT);
    // The file carries a second night and the scan walked straight past it.
    expect(result.sleepRecordsSeen).toBeGreaterThan(result.segments.length);
    for (const segment of result.segments) {
      expect(segment.startWallMs).toBeGreaterThanOrEqual(windowFor(NIGHT).startWallMs - 1);
      expect(segment.endWallMs).toBeLessThanOrEqual(windowFor(NIGHT).endWallMs);
    }
    // Asking for the other night gets the other night, and none of this one.
    const other = await scan("2027-02-19");
    expect(groupBySource(other.segments).map((group) => group.source).sort()).toEqual([
      "Ada's Apple Watch",
      "Bed & Rest",
    ]);
  });

  it("walks past every record that is not sleep analysis", async () => {
    const result = await scan(NIGHT);
    expect(result.recordsSeen).toBeGreaterThan(result.sleepRecordsSeen);
  });
});

describe("two instruments are two instruments", () => {
  it("never merges the sources into one timeline", async () => {
    const result = await scan(NIGHT);
    const groups = groupBySource(result.segments);
    expect(groups).toHaveLength(2);
    for (const group of groups) {
      for (const segment of group.segments) expect(segment.source).toBe(group.source);
    }
  });

  it("reports the staged night the watch wrote", async () => {
    const result = await scan(NIGHT);
    const watch = groupBySource(result.segments).find((group) => group.source === WATCH);
    const night = longestEpisode(episodesOf(watch!.segments));
    const totals = summarise(night!.segments);
    expect(totals.hasStages).toBe(true);
    expect(formatClock(night!.startWallMs)).toBe("23:41");
    expect(formatClock(night!.endWallMs)).toBe("07:06");
    expect(formatLength(totals.asleepMinutes)).toBe("7 h 8 m");
    expect(totals.totals.map((total) => total.label)).toEqual(["Awake", "REM", "Core", "Deep"]);
  });

  it("reports an export with no sleep stages without it looking broken", async () => {
    const result = await scan(NIGHT);
    const phone = groupBySource(result.segments).find((group) => group.source === PHONE);
    const totals = summarise(phone!.segments);
    expect(totals.hasStages).toBe(false);
    // In bed is not sleep, and is not counted as any.
    expect(formatLength(totals.asleepMinutes)).toBe("7 h 32 m");
    expect(formatLength(totals.inBedMinutes)).toBe("7 h 55 m");
    expect(totals.totals.map((total) => total.label)).toEqual(["In bed", "Asleep"]);
  });
});

describe("the afternoon in the window is not the night", () => {
  it("separates the short stretch from the long one", async () => {
    const result = await scan(NIGHT);
    const watch = groupBySource(result.segments).find((group) => group.source === WATCH);
    const episodes = episodesOf(watch!.segments);
    expect(episodes).toHaveLength(2);
    expect(formatClock(episodes[0].startWallMs)).toBe("15:12");
    expect(formatLength(episodes[0].asleepMinutes)).toBe("22 m");
    expect(longestEpisode(episodes)).toBe(episodes[1]);
  });
});

describe("a record split across a chunk boundary", () => {
  it("reads the same night at every chunk size, down to one byte", async () => {
    const whole = await scan(NIGHT);
    const shape = (result: ScanResult) =>
      result.segments.map((segment) => `${segment.source} ${segment.value} ${segment.startWallMs} ${segment.endWallMs}`);
    const expected = shape(whole);
    expect(expected.length).toBeGreaterThan(15);

    for (const chunkSize of [1, 2, 3, 5, 7, 13, 64, 97, 512, 4096, 65_536]) {
      const result = await scan(NIGHT, chunkSize);
      expect(shape(result), `chunk size ${chunkSize} lost or changed a record`).toEqual(expected);
      expect(result.sleepRecordsSeen, `chunk size ${chunkSize} miscounted`).toBe(
        whole.sleepRecordsSeen,
      );
    }
  });

  it("carries a tag cut in the middle of its own name", () => {
    const window = windowFor(NIGHT);
    const sink: ScanResult = {
      segments: [],
      sleepRecordsSeen: 0,
      recordsSeen: 0,
      bytesRead: 0,
      sawHealthData: false,
      sawClinicalDocument: false,
    };
    const record =
      '<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Split" startDate="2027-02-22 23:00:00 +1100" endDate="2027-02-23 06:00:00 +1100" value="HKCategoryValueSleepAnalysisAsleep"/>';
    // Cut after "<Rec": the buffer ends in something that could become a record
    // and could equally be the start of <Recovery>.
    const carry = consumeBuffer(`<Workout/>${record.slice(0, 4)}`, window, sink, false);
    // Only the tail that could still become a record is carried: everything
    // read is dropped, and the carry can never grow with the file.
    expect(carry.endsWith("<Rec")).toBe(true);
    expect(carry.length).toBeLessThanOrEqual(6);
    expect(sink.segments).toHaveLength(0);
    consumeBuffer(carry + record.slice(4), window, sink, true);
    expect(sink.segments).toHaveLength(1);
    expect(sink.segments[0].source).toBe("Split");
  });

  it("is not fooled by an element whose name merely starts with Record", () => {
    const window = windowFor(NIGHT);
    const sink: ScanResult = {
      segments: [],
      sleepRecordsSeen: 0,
      recordsSeen: 0,
      bytesRead: 0,
      sawHealthData: false,
      sawClinicalDocument: false,
    };
    consumeBuffer('<RecordingSession id="1"/>', window, sink, true);
    expect(sink.recordsSeen).toBe(0);
  });
});

describe("the wrong file", () => {
  it("knows a zip when it is handed one", async () => {
    const zip = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])]);
    expect(await looksLikeZip(zip)).toBe(true);
    expect(await looksLikeZip(sample())).toBe(false);
  });

  it("knows the clinical document that ships in the same zip", async () => {
    const cda = new Blob([
      '<?xml version="1.0"?><ClinicalDocument xmlns="urn:hl7-org:v3"><title>Health</title></ClinicalDocument>',
    ]);
    const result = await scanSleepWindow(cda, windowFor(NIGHT));
    expect(result.sawClinicalDocument).toBe(true);
    expect(result.sawHealthData).toBe(false);
    expect(result.segments).toHaveLength(0);
  });
});
