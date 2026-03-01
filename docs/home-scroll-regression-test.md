# Home Filter/Sort No-Scroll Regression

## Purpose
Verify that changing Home filters/sort/direction updates the URL query string without scrolling/jumping.

## Steps
1. Start app with `npm run dev`.
2. Open `/home`.
3. Scroll about halfway down the page so `window.scrollY` is clearly non-zero.
4. Click each filter tab repeatedly:
   - `All Active`
   - `Bottlenecked`
   - `At Risk`
   - `On Track`
5. Change Sort controls repeatedly:
   - Sort: `Engagement Date` / `Added Date`
   - Direction: `Newest First` / `Oldest First`
6. Confirm:
   - URL query string updates (`filter`, `sort`, `direction`).
   - The matter list updates.
   - Page does **not** jump to top; scroll position remains stable.
