import { test } from "node:test";
import assert from "node:assert/strict";
import { haversine, parseOverpass, fmtDistance } from "./geo.ts";
import { extractHotelUrls, parseHotelHtml } from "./parse.ts";

test("haversine ~ 1.1 km per 0.01 deg lat", () => {
  const d = haversine(48.85, 2.35, 48.86, 2.35);
  assert.ok(d > 1100 && d < 1120, String(d));
});

test("parseOverpass picks nearest subway and 3 distinct attractions", () => {
  const els = [
    { tags: { name: "Far Metro", railway: "station", station: "subway" }, lat: 48.87, lon: 2.35 },
    { tags: { name: "Near Metro", railway: "subway_entrance" }, lat: 48.851, lon: 2.35 },
    { tags: { name: "Louvre", tourism: "museum" }, center: { lat: 48.855, lon: 2.35 } },
    { tags: { name: "Louvre", tourism: "museum" }, lat: 48.8551, lon: 2.35 },
    { tags: { name: "Tower", tourism: "attraction" }, lat: 48.86, lon: 2.35 },
    { tags: { name: "Nameless" } },
  ];
  const r = parseOverpass(els, 48.85, 2.35);
  assert.equal(r.subway?.name, "Near Metro");
  assert.deepEqual(r.attractions.map((a) => a.name), ["Louvre", "Tower"]);
});

test("fmtDistance", () => { assert.equal(fmtDistance(450), "450 m"); assert.equal(fmtDistance(1520), "1.5 km"); });

test("url dates are captured, even from a later duplicate", () => {
  const r = extractHotelUrls("https://www.booking.com/hotel/it/a.html https://www.booking.com/hotel/it/a.en-gb.html?checkin=2027-05-01&checkout=2027-05-04&group_adults=2");
  assert.equal(r.length, 1);
  assert.equal(r[0].checkin, "2027-05-01");
  assert.equal(r[0].checkout, "2027-05-04");
});

test("page extras: city, geo, amenities", () => {
  const html = `<script type="application/ld+json">{"@type":"Hotel","name":"H","address":{"addressLocality":"Rome","addressCountry":"IT"},"geo":{"latitude":41.9,"longitude":12.5}}</script>
  <div>Kitchen: washing machine. Room with 2 single beds</div>`;
  const m = parseHotelHtml(html)!;
  assert.equal(m.city, "Rome"); assert.equal(m.lat, 41.9); assert.equal(m.lng, 12.5);
  assert.equal(m.washingMachine, true); assert.equal(m.twinBeds, true);
  const none = parseHotelHtml(`<meta property="og:title" content="X - Y">`)!;
  assert.equal(none.washingMachine, null);
});
