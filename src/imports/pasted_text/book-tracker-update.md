Update the existing book-tracker design with the changes below. Keep everything else (style, empty state, book cards, live "N volumes" count) exactly as it is.

1. ADD "HISTORY" GENRE
- Add a "History" chip to the end of the filter bar, so the order is: All · Nonfiction · Fiction · Sci-Fi · Mystery & Thriller · Fantasy · Romance · History. Same pill style as the others (selected = filled dark pill with white text; unselected = translucent glass pill).
- Add "History" to the Genre dropdown in the "Add a book" modal.
- Add the filtered-empty state for it: "Nothing here yet — add a History book."
- Design one frame with History selected, showing 2 History books on the shelf.

2. REDESIGN THE "DATE FINISHED" FIELD (in the Add a book modal and the Edit form)
Replace the single calendar date picker with three separate dropdowns in one row, so picking a year is quick and not finicky:
- YEAR dropdown (first, widest, 45% of the row width): a scrollable list starting at the current year and going back to 1950, most recent first. The list opens as a frosted-glass panel (max height 220px, scrollable, current selection highlighted, keyboard-typeable, e.g. typing "2019" jumps to it). Default = the current year.
- MONTH dropdown (30% of the row width): January–December, shown as short names (Jan, Feb...). Default = the current month.
- DAY dropdown (25% of the row width): 1–31, adjusts automatically to the month and year (e.g. Feb has 28/29 days). Optional; shows "Day" as a placeholder.
- Label above the row: "Date finished". A small muted helper line below: "Month and day are optional." If only the year is chosen, the book card, spine and popover show just the year. If a month is chosen, they show "Mar 2024".
- Each dropdown: 44px tall, 12px radius, translucent glass fill, 1px light border, small chevron icon on the right, focus state = soft glow ring. Design the open state of the Year dropdown as its own frame.
- Also add a small "Today" text link at the right end of the label row that fills all three dropdowns with today's date.
- Do not use a calendar-grid picker anywhere.

3. VIEW TOGGLE (Covers / Spines)
- Add a small segmented toggle on the right side of the filter bar row, with two segments: "Covers" (grid icon) and "Spines" (vertical bars icon). Glass pill container, 36px tall; the active segment is a filled dark pill with white text. Default = Covers.
- Switching views cross-fades and slides the books (300ms). Filter chips and the live "N volumes" count work identically in both views. The selected view is remembered.

4. SPINES VIEW (full frame, desktop + mobile)
- The same horizontally scrolling shelf, but books stand upright side by side like real books, resting on the same glowing shelf line with the faint reflection beneath. It is empty by default and uses the same empty state; new books are added on the left with a slide-in.
- SPINE component:
  - Solid-color rectangle, 3px top corner radius. Width varies per book between 44–64px, height between 260–340px. Spines touch or have 2px gaps, with some leaning slightly (±3°).
  - Color comes from the book's cover (dominant color), softened and slightly desaturated to fit the pastel palette. With no cover, use a genre color: Nonfiction = dusty blue, Fiction = blush pink, Sci-Fi = periwinkle, Mystery & Thriller = deep plum, Fantasy = sage green, Romance = rose, History = warm sand/ochre.
  - Title written vertically (rotated 90°, reading bottom-to-top), serif font, 14–16px, centered, max 1 line with ellipsis. Text color auto-contrasts (white on dark spines, dark plum on light spines).
  - Author name in tiny uppercase tracked text (9px) at the bottom of the spine, also vertical.
  - Decoration: two thin horizontal lines (1px, 30% opacity) near the top and bottom, a subtle vertical highlight gradient on the left edge (white 20% to transparent), and a soft shadow on the right for depth.
- HOVER STATE (component variant):
  - The hovered spine slides up 24px and tilts forward slightly, like it's being pulled out, with scale 1.04, a stronger shadow, and a soft colored glow matching its color.
  - Adjacent spines shift 6px away; all other spines dim to 70% opacity.
  - A small tooltip pill floats above it: title, author, star rating. Cursor = pointer.
- CLICK STATE: clicking a spine opens the same book detail popover as the Covers view (cover image, title, author, genre tag, date finished, star rating, note, "Edit" and "Remove" links). Design a frame where the spine stays pulled out and a glass popover is anchored above it. On mobile, use a bottom sheet instead.

5. CHANGE THE HEADER TITLE
- Replace the large serif title "My Library" with "Thoughts on Books I've Read". Keep the tiny tracked uppercase label "A PERSONAL ARCHIVE" directly above it, and the live "N volumes" count below it.
- Because the new title is longer, set it at 44px on desktop and 28px on mobile (down from 56px and 36px). It should stay elegant and readable. Allow it to wrap to two lines on mobile, left-aligned, with tight line-height (1.1).
- Use the same high-contrast serif. Set "Thoughts on Books" in regular weight and "I've Read" in italic for a subtle typographic contrast. Same text color as before.
- Update the title in every frame (empty state, both views, modals, popovers), and keep the header layout and the "+ Add a book" button position unchanged.

6. FRAMES TO ADD (desktop + mobile each)
a. Add a book modal with the new Year / Month / Day selector (closed)
b. Add a book modal with the Year dropdown open
c. Covers view with the toggle visible and the new header title
d. Spines view, empty state
e. Spines view with about 12 books in mixed colors and sizes
f. Spines view, one spine hovered (lifted, neighbors shifted, tooltip)
g. Spines view, popover open on a clicked spine
h. History filter selected, in the Spines view

PROTOTYPE: connect the Covers ↔ Spines toggle, the Year dropdown open/close, spine hover (lifted variant), and spine click → popover.

Use Auto Layout, component variants (default / hover / selected) for the spine, and reuse the existing color and text styles. Use placeholder titles only for the sample frames. Do not add features I haven't listed.