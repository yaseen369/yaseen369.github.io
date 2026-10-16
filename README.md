# yaseen369.github.io

Personal portfolio of Yaseen Abdelrhman, live at **https://yaseen369.github.io**.

Plain HTML, CSS and JavaScript, with no frameworks, build step or dependencies. Open `index.html` through any static server to run it locally:

```bash
python -m http.server 8000   # then visit http://localhost:8000
```

## Structure

```
index.html      page content and structure
css/style.css   all styles; colours and fonts are CSS variables at the top
js/hero.js      particle name in the hero
js/demos.js     the three live project demos
js/game.js      the "Fix my bugs" game
js/main.js      cursor, scroll effects, counters, contact interactions
js/interact.js  quiet interactions: tips, skills, headings, shortcuts
assets/         CV and Recrify screenshots
```

## How the interactive parts work

| Feature | File | How |
| --- | --- | --- |
| Particle name | `hero.js` | Draws "YASEEN" on a hidden canvas, samples its pixels into target points, then each frame springs every particle toward its target and pushes it away from the pointer. Pauses when the hero is off screen. |
| Recrify ranking demo | `demos.js` | Recomputes `resume × w + interview × (1 − w)` for each row, re-sorts the list, and animates rows to their new places with the FLIP technique and the Web Animations API. |
| CleanCut demo | `demos.js` | A canvas waveform with word timestamps. A `requestAnimationFrame` loop moves the playhead, reveals words, and turns a Web Audio oscillator on over flagged words when sound is enabled. |
| Timetable demo | `demos.js` | Pointer events for drag and drop (mouse, pen and touch). Each class has a fixed slot; dropping it on an occupied slot reports a clash. Keyboard users can press a class to add it. |
| Horizontal project scroll | `main.js` | The section's height is set to the sideways distance plus one screen. A sticky container stays pinned while vertical scroll progress is mapped to `translateX`. |
| Word reveals, timeline fill | `main.js` | One `requestAnimationFrame`-throttled scroll handler reads positions with `getBoundingClientRect`. |
| Number counters | `main.js` | Each digit is a column of 0–9 that slides into place when it enters the screen (IntersectionObserver). |
| Contact headline | `main.js` | Each letter's variable-font weight and width depend on its distance from the cursor. |
| Custom cursor, magnetic buttons | `main.js` | Mouse-only, eased with linear interpolation each frame. |
| "Fix my bugs" game | `game.js` | A 30-second canvas game. Bugs spawn at the edges, wander with a random turn rate and bounce off the walls; spawn rate and speed grow with time and board size. Clicks pick the nearest bug within reach. Combos, ranks, a personal best in `localStorage` and a share button (Web Share API, or clipboard as a fallback). |

### Quiet interactions (`interact.js`)

Nothing moves on its own; each effect answers a hover, focus, tap or key press.

- **Tips on tech tags and terms:** one floating tooltip, positioned above or below the element, shown on hover and keyboard focus, and tapped open on touch screens.
- **Skills to projects:** pointing at a skill lists the projects that use it, with links that scroll to them (and to the right panel inside the sideways section).
- **Headings:** letters near the pointer get lighter, using the variable font's weight axis.
- **Demo cards:** a 3° tilt and a soft light that follow the pointer, paused while you drag or use a slider.
- **Numbers:** pointing at one rolls its digits again.
- **Reading progress:** a thin line at the top of the window.
- **Keyboard shortcuts:** press `?` to see them (W, E, G, C, T).

## Accessibility and performance

- All content is real HTML and readable without JavaScript.
- `prefers-reduced-motion` turns off the particle animation, horizontal scroll and transitions.
- The custom cursor appears only on devices with a fine pointer; touch devices get touch-friendly versions of every demo.
- Animation loops pause when their section is off screen.
