# yaseen369.github.io

Personal portfolio of Yaseen Abdelrhman, live at **https://yaseen369.github.io**.

Plain HTML, CSS and JavaScript, with no frameworks, build step or dependencies. Open `index.html` through any static server to run it locally:

```bash
python -m http.server 8000   # then visit http://localhost:8000
```

## Structure

```
index.html      page content and structure
css/style.css   all styles; colours, light and dark themes and fonts are CSS variables at the top
js/hero.js      particle name in the hero
js/demos.js     the four project demos
js/game.js      the "Fix my bugs" game
js/main.js      cursor, scroll effects, counters, contact interactions
js/interact.js  quiet interactions: tips, skills, headings, shortcuts
assets/         CV and Recrify screenshots
```

## How the interactive parts work

| Feature | File | How |
| --- | --- | --- |
| Particle name | `hero.js` | Draws "YASEEN" on a hidden canvas, samples its pixels into target points, then each frame springs every particle toward its target and pushes it away from the pointer. Pauses when the hero is off screen. |
| Recrify ranking demo | `demos.js` | Recomputes `resume × w + interview × (1 − w)` for each row, re-sorts the list, and animates rows to their new places with the FLIP technique and the Web Animations API. A second tab rebuilds the HR report table (same columns and summary sentence as the real report) and can download it as CSV through a `Blob`. |
| CleanCut demo | `demos.js` | A canvas waveform with word timestamps. A `requestAnimationFrame` loop moves the playhead, reveals words, and turns a Web Audio oscillator on over flagged words when sound is enabled. |
| Performance Tester demo | `demos.js` | "Run a test" plays a simulated load test (1, 5, 10 and 20 users) and draws average and 95th-percentile times on a canvas chart. "Real report" shows the summary of a real run from the tool's `Test results` folder. |
| Activity system demo | `demos.js` | A Türkçe/English switch between the two versions of the system: the Turkish Java EE web app and the layered English app. Class names come from the real code; pressing a box explains what it does. |
| Dark mode | `index.html`, `main.js` | A small script in `<head>` picks the saved theme or the system setting before the first paint. The toggle (or the `D` key) switches the CSS variables and remembers the choice. |
| Horizontal project scroll | `main.js` | The section's height is set to the sideways distance plus one screen. A sticky container stays pinned while vertical scroll progress is mapped to `translateX`. |
| Word reveals, timeline fill | `main.js` | One `requestAnimationFrame`-throttled scroll handler reads positions with `getBoundingClientRect`. |
| Number counters | `main.js` | Each digit is a column of 0–9 that slides into place when it enters the screen (IntersectionObserver). |
| Contact headline | `main.js` | Each letter's variable-font weight and width depend on its distance from the cursor. |
| Custom cursor, magnetic buttons | `main.js` | Mouse-only, eased with linear interpolation each frame. |
| "Fix my bugs" game | `game.js` | A 15-second canvas game. Bugs come in five shapes, each tagged with a language and a real error, and each squash shows a joke about that error; hitting a feature gets you roasted. A coffee slows every bug for three seconds, and a "legacy code" boss takes four hits. Spawn rate and speed grow with time and board size. Combos, ranks, a personal best in `localStorage` and a share button (Web Share API, or clipboard as a fallback). |

### Quiet interactions (`interact.js`)

Nothing moves on its own; each effect answers a hover, focus, tap or key press.

- **Tips on tech tags and terms:** one floating tooltip, positioned above or below the element, shown on hover and keyboard focus, and tapped open on touch screens.
- **Skills to projects:** pointing at a skill lists the projects that use it, with links that scroll to them (and to the right panel inside the sideways section).
- **Headings:** letters near the pointer get lighter, using the variable font's weight axis.
- **Demo cards:** a 3° tilt and a soft light that follow the pointer, frozen while a button is held so clicks always land.
- **Numbers:** pointing at one rolls its digits again.
- **Reading progress:** a thin line at the top of the window.
- **Keyboard shortcuts:** press `?` to see them (W, E, G, C, T, D).

## Accessibility and performance

- Text content is real HTML and readable without JavaScript; the demos and the game need it.
- `prefers-reduced-motion` turns off the particle animation, horizontal scroll and transitions.
- The custom cursor appears only on devices with a fine pointer; touch devices get touch-friendly versions of every demo.
- Animation loops pause when their section is off screen.
