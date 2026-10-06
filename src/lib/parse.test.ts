import { test } from "node:test";
import assert from "node:assert/strict";
import { extractHotelUrls, hotelKey, parseHotelHtml, nameFromSlug } from "./parse.ts";

test("extracts and dedupes booking urls, ignoring language/query", () => {
  const text = `Faves:
  https://www.booking.com/hotel/it/casa-rossa.en-gb.html?aid=1&label=x
  https://www.booking.com/hotel/it/casa-rossa.html
  (https://www.booking.com/hotel/pt/quinta_do_mar.html#map) random https://example.com/hotel/it/no.html`;
  const r = extractHotelUrls(text);
  assert.deepEqual(r.map((x) => x.key), ["it/casa-rossa", "pt/quinta_do_mar"]);
  assert.equal(r[0].url, "https://www.booking.com/hotel/it/casa-rossa.html");
});

test("hotelKey rejects non-hotel urls", () => {
  assert.equal(hotelKey("https://www.booking.com/searchresults.html"), null);
});

test("parses JSON-LD", () => {
  const html = `<script type="application/ld+json">{"@type":"Hotel","name":"Casa Rossa &amp; Co","address":{"streetAddress":"Via 1","addressLocality":"Roma","addressCountry":"IT"},"aggregateRating":{"ratingValue":"9.1","reviewCount":"230"},"image":"http://x/y.jpg"}</script>`;
  const m = parseHotelHtml(html)!;
  assert.equal(m.rating, 9.1);
  assert.equal(m.reviewCount, 230);
  assert.equal(m.address, "Via 1, Roma");
  assert.equal(m.country, "IT");
});

test("falls back to og tags", () => {
  const m = parseHotelHtml(`<meta property="og:title" content="Quinta do Mar - Lisbon, Portugal"><meta property="og:image" content="http://i/p.jpg">`)!;
  assert.equal(m.name, "Quinta do Mar");
  assert.equal(m.imageUrl, "http://i/p.jpg");
});

test("nameFromSlug", () => assert.equal(nameFromSlug("it/casa-rossa"), "Casa Rossa"));
