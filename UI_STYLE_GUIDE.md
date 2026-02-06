# UI Style Guide: Phantom/Persona Style

## Core Philosophy
This project adopts a high-contrast, stylized UI inspired by *Persona 5* and *Persona 3 Reload*.

### key Visual Elements

1.  **Geometry & Skews**
    - Use skewed containers (`transform: skewX(-12deg)`) for kinetic energy.
    - Clip paths (`clip-path`) are preferred over standard border-radius.
    - Trapezoids and parallelograms are the foundational shapes.

2.  **Typography**
    - **Headings**: Big, bold, italic, uppercase. (`font-black italic uppercase`)
    - **Decor**: Small, monospaced, tracking-widest text for decorative subtitles.
    - **Body**: Clean sans-serif for readability.

3.  **Color Palette (Danmachi Blue Variant)**
    - **Backgrounds**: `bg-zinc-950` (Deep Black), `bg-blue-900/20` (Translucent Blue)
    - **Accents**: `text-cyan-400` (Electric Blue), `text-blue-600` (Deep Blue)
    - **Highlights**: White or bright Cyan for active states.
    - **Borders**: Sharp, thin borders. `border-blue-900` or `border-cyan-500`.

4.  **Motion**
    - **Hover**: Instant, snappy transitions. `duration-200`.
    - **Entrance**: Slide-ins with `animate-in`.
    - **Interactive**: Elements should shift position (`translate`) on hover.

## Component Guidelines

### Modals / Panels
- Do not use simple centered white boxes.
- Use full-screen or large skewed containers.
- Three-column layouts work well for RPG menus (Categories | Selection | Details).

### Buttons
- Avoid rounded corners.
- Use the `P5Button` style: Skewed, with a sliding highlight animation.
- Active states should have high contrast.

### Lists
- Grid or stacked lists with distinct borders.
- Selection state must be obvious (e.g., background highlight + indicator icon).

## CSS Utilities
See `index.css` for custom classes:
- `.clip-trapezoid`: For standard angled buttons.
- `.animate-spin-slow`: For background decorative elements.
- `.bg-stripes`: For texture.
