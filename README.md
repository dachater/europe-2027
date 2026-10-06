# Europe 2027 – travel app

Module 1: **Hotels / guesthouses** – import Booking.com favorites.

Booking.com has no public API for personal wishlists, so import works by pasting property
links (`booking.com/hotel/xx/name.html`). Details (name, address, rating, photo) are read from
each page's public metadata; if a page can't be fetched the hotel is still saved from its URL.

```
npm install
npm run dev     # http://localhost:3000
npm test        # parser tests
```

Data lives in `data/travel.db` (SQLite via `node:sqlite`, Node 22+). Override with `DB_PATH`.
