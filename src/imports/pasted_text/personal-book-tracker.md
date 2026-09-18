Design a desktop (1440×900) and mobile (390×844) web app: a PERSONAL BOOK TRACKER shown as a dreamy digital bookshelf. The attached screenshot is a STYLE REFERENCE ONLY. It shows a shelf full of books, but my app must start EMPTY. Copy its look exactly (colors, glow, fonts, spacing, book card style, shelf line, chips, header) and do NOT copy its content: no pre-filled books, no "97 volumes".

GLOBAL STYLE
- Ethereal, minimal, gallery-like. Soft misty gradient background (pale lavender/blush/pearl, low saturation) with faint blurred radial glows behind the shelf. No hard borders.
- Elegant high-contrast serif for headings and book text (Cormorant Garamond or Playfair Display); small tracked-out uppercase sans (Inter) for labels. Dark plum/charcoal text.
- Soft shadows (0 20px 40px rgba(0,0,0,0.15)), 200–300ms ease transitions.

LAYOUT (single page)
1. HEADER, 80px, 48px side padding:
   - Left: tiny tracked uppercase label "A PERSONAL ARCHIVE", above a large serif title "My Library" (56px desktop, 36px mobile). Beneath: muted small text showing a LIVE BOOK COUNT: "0 volumes" when empty, "1 volume" for one book, "N volumes" for more. Count increases by 1 with each added book and decreases if one is removed. Animate the number change with a small fade/slide.
   - Right: pill button "+ Add a book" (translucent glass fill, 1px light border, fully rounded).
2. FILTER BAR: horizontally scrollable pill chips: All · Nonfiction · Fiction · Sci-Fi · Mystery & Thriller · Fantasy · Romance. "All" selected = filled dark pill with white text; others = translucent glass pills. Selecting a chip shows only books tagged with that genre.
3. THE SHELF (hero, ~60% of screen height): a horizontally scrolling row of book covers with 28px gaps, edge to edge, bleeding off the screen. Below the row, a thin glowing shelf line (1px gradient, blurred glow underneath, faint 10% mirrored reflection of the covers). New books are added to the left of the row (newest first) and slide/fade in.
   - Do not loop or repeat books. Show only books the user has added. Auto-scroll only when the row overflows the screen; otherwise leave it static and left-aligned.

BOOK CARD (reusable component)
- Cover image, 2:3 portrait, 200×300px desktop / 140×210px mobile, 4px corner radius, soft drop shadow, subtle glossy spine highlight on the left edge (8px white-to-transparent gradient at 25% opacity). Slight random vertical offset (±8px) for a hand-placed look.
- Hover: lift 12px, scale 1.06, stronger shadow with a soft glow; other cards dim to 70%. Title (serif 14px, max 2 lines), author (11px muted) and year finished (10px uppercase tracked) appear below the cover on hover.
- FALLBACK variant when no cover is available: same size, pastel gradient fill, centered serif title, small author underneath, thin inner border.
- Clicking a card opens a small popover: cover, title, author, genre tag, date finished, star rating, optional one-line note, and "Edit" and "Remove" links.

EMPTY STATE (design this as its own frame)
- Header shows "0 volumes". The shelf row is empty: draw only the glowing shelf line, and centered above it a soft ghosted outline of 3 faint dotted book silhouettes (2:3 ratio, 20% opacity).
- Centered serif text above the shelf: "Your shelf is waiting." Small muted line below: "Add the first book you've read."
- Below that, a primary pill button "+ Add your first book".
- Filter chips are visible but muted (40% opacity) until at least one book exists.
- Filtered-empty state: if a genre chip has no books, show "Nothing here yet — add a {genre} book." with an "+ Add a book" link.

"ADD A BOOK" MODAL (design this in detail)
- Centered 520px frosted-glass card (24px background blur, white 60% fill, 24px radius) over a dimmed backdrop, with a close (×) icon at the top right.
- Title: "Add a book" (serif 28px).
- Field 1: Search box "Search by title or author" with a dropdown of 4 results (small cover thumbnail, title, author, year). Picking a result auto-fills the fields below and the cover. Under it, a small link: "Can't find it? Enter it manually."
- Fields: Title (required), Author, Genre (dropdown using the same 6 genres), Date finished (date picker), Rating (5 stars), Note (optional textarea, one line), Cover (image upload, optional; if none, use the fallback card).
- Live preview: on the right or top of the modal, a book card preview that updates as the user fills in fields.
- Buttons: primary dark pill "Add to shelf" (disabled until Title is filled), ghost "Cancel".
- Success moment: after "Add to shelf", the modal closes, the new card slides onto the left of the shelf with a soft glow pulse, and the count animates from "N volumes" to "N+1 volumes".

FRAMES TO CREATE (desktop + mobile each)
1. Empty state ("0 volumes")
2. Add-a-book modal, empty form
3. Add-a-book modal, search results open
4. Shelf with 1 book ("1 volume")
5. Shelf with ~8 books, one hovered ("8 volumes")
6. Book detail popover
7. Genre filter applied

PROTOTYPE FLOW: Empty → click "+ Add your first book" → modal → "Add to shelf" → shelf with 1 book. Show the count going 0 → 1 → 8 across frames.

Use Auto Layout everywhere, name layers clearly, and create color and text styles. Use gray placeholder covers only for the sample frames (4, 5, 7). Do not add features I haven't listed.