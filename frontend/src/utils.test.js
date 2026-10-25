import { describe, expect, it } from "vitest";
import {
  blendLevel,
  bracket,
  buildPieces,
  colorAt,
  fmtDuration,
  mileAtTime,
  pointAt,
  truckState,
  worstStretch,
} from "./utils.js";

describe("colorAt", () => {
  it("returns the exact palette colour at whole levels", () => {
    expect(colorAt(0)).toBe("rgb(47,158,91)");
    expect(colorAt(4)).toBe("rgb(107,33,168)");
  });

  it("blends halfway between two levels", () => {
    expect(colorAt(0.5)).toBe("rgb(137,170,48)");
  });

  it("clamps values outside 0..4", () => {
    expect(colorAt(-3)).toBe(colorAt(0));
    expect(colorAt(9)).toBe(colorAt(4));
  });
});

describe("pointAt", () => {
  const path = [
    [0, 0, 0],
    [0, 10, 100],
  ];

  it("interpolates along the path", () => {
    expect(pointAt(path, 50)).toEqual([0, 5]);
  });

  it("clamps before the start and after the end", () => {
    expect(pointAt(path, -5)).toEqual([0, 0]);
    expect(pointAt(path, 500)).toEqual([0, 10]);
  });
});

describe("bracket", () => {
  const miles = [0, 10, 20];

  it("finds the two checkpoints around a mile", () => {
    expect(bracket(miles, 15)).toEqual({ a: 1, b: 2, f: 0.5 });
  });

  it("uses the end checkpoints outside the range", () => {
    expect(bracket(miles, -1)).toEqual({ a: 0, b: 0, f: 0 });
    expect(bracket(miles, 25)).toEqual({ a: 2, b: 2, f: 0 });
  });
});

describe("blendLevel", () => {
  it("blends two known levels", () => {
    expect(blendLevel(0, 2, 0.5)).toBe(1);
  });

  it("falls back to the known side when one forecast is missing", () => {
    expect(blendLevel(-1, 2, 0.3)).toBe(2);
    expect(blendLevel(3, -1, 0.3)).toBe(3);
  });

  it("stays missing when both are missing", () => {
    expect(blendLevel(-1, -1, 0.5)).toBe(-1);
  });
});

describe("buildPieces", () => {
  const path = [
    [0, 0, 0],
    [0, 10, 100],
  ];

  it("cuts the path into equal-mileage pieces that join up", () => {
    const pieces = buildPieces(path, 4);
    expect(pieces.map((p) => p.mid)).toEqual([12.5, 37.5, 62.5, 87.5]);
    expect(pieces[0].latlngs[0]).toEqual([0, 0]);
    expect(pieces[3].latlngs.at(-1)).toEqual([0, 10]);
    expect(pieces[1].latlngs[0]).toEqual(pieces[0].latlngs.at(-1));
  });
});

describe("fmtDuration", () => {
  it("formats minutes as hours and minutes", () => {
    expect(fmtDuration(45)).toBe("45m");
    expect(fmtDuration(90)).toBe("1h 30m");
    expect(fmtDuration(125)).toBe("2h 05m");
  });
});

describe("mileAtTime", () => {
  const cps = [
    { mile: 0, eta: "2026-10-25T12:00:00Z" },
    { mile: 100, eta: "2026-10-25T14:00:00Z" },
  ];
  const at = (iso) => new Date(iso).getTime();

  it("interpolates between two checkpoint ETAs", () => {
    expect(mileAtTime(cps, at("2026-10-25T13:00:00Z"))).toBe(50);
  });

  it("stays at the start before departure and at the end after arrival", () => {
    expect(mileAtTime(cps, at("2026-10-25T10:00:00Z"))).toBe(0);
    expect(mileAtTime(cps, at("2026-10-25T20:00:00Z"))).toBe(100);
  });
});

describe("truckState", () => {
  const route = (path) => ({
    path,
    checkpoints: [
      { mile: 0, eta: "2026-10-25T12:00:00Z", heat: [0, 2, 4] },
      { mile: 100, eta: "2026-10-25T14:00:00Z", heat: [0, 4, 4] },
    ],
  });
  const east = route([
    [0, 0, 0],
    [0, 10, 100],
  ]);
  const west = route([
    [0, 10, 0],
    [0, 0, 100],
  ]);
  const base = "2026-10-25T12:00:00Z";

  it("puts the truck at the start at hour 0", () => {
    const t = truckState(east, 0, base);
    expect(t.latlng).toEqual([0, 0]);
    expect(t.arrived).toBe(false);
  });

  it("moves the truck halfway after one of two hours, and blends the risk there", () => {
    const t = truckState(east, 1, base);
    expect(t.mile).toBe(50);
    expect(t.latlng).toEqual([0, 5]);
    expect(t.level).toBe(3); // between heat 2 and 4 at the midpoint
  });

  it("mirrors the truck when it heads west", () => {
    expect(truckState(east, 1, base).flipped).toBe(false);
    expect(truckState(west, 1, base).flipped).toBe(true);
  });

  it("marks the truck as arrived after the last checkpoint ETA", () => {
    expect(truckState(east, 2, base).arrived).toBe(true);
  });
});

describe("worstStretch", () => {
  const cp = (mile, level, drivers = [], extra = {}) => ({
    mile,
    level,
    drivers,
    has_data: true,
    eta: `2026-10-25T${String(10 + mile / 10).padStart(2, "0")}:00:00Z`,
    lat: mile,
    lng: 0,
    ...extra,
  });
  const route = (cps) => ({
    name: "Route A",
    distance_miles: 40,
    checkpoints: cps,
  });

  it("picks the longest run at the highest level and measures it like the backend does", () => {
    const w = worstStretch(
      route([
        cp(0, 0),
        cp(10, 3, ["wind"]),
        cp(20, 3, ["wind", "rain"]),
        cp(30, 1),
        cp(40, 3, ["snow"]),
      ]),
    );
    expect(w.level).toBe(3);
    expect(w.startMile).toBe(5);
    expect(w.endMile).toBe(25);
    expect(w.miles).toBe(20);
    expect(w.drivers).toEqual(["wind", "rain"]);
    expect(w.from).toBe("2026-10-25T11:00:00Z");
    expect(w.to).toBe("2026-10-25T12:00:00Z");
  });

  it("covers the edges of the route for a stretch at the start or the end", () => {
    const w = worstStretch(
      route([cp(0, 2), cp(10, 0), cp(20, 0), cp(30, 0), cp(40, 0)]),
    );
    expect(w.startMile).toBe(0);
    expect(w.endMile).toBe(5);
  });

  it("reports level 0 when the whole route is clear", () => {
    expect(worstStretch(route([cp(0, 0), cp(40, 0)])).level).toBe(0);
  });

  it("ignores checkpoints without a forecast, and returns null when none have one", () => {
    const none = { has_data: false, level: 0 };
    expect(
      worstStretch(route([cp(0, 0, [], none), cp(40, 0, [], none)])),
    ).toBeNull();
    expect(worstStretch(route([cp(0, 0, [], none), cp(40, 2)])).level).toBe(2);
  });
});
