# Design System Strategy: The Forensic Lens

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Laboratory."** 

We are moving away from the cluttered, "hacker-green" aesthetic of legacy cybersecurity. Instead, we are adopting an ultra-premium, editorial-grade interface that mirrors the precision of high-end optical equipment. This system is defined by **Absolute Contrast** (Pure Black vs. Pure White) and **Optical Depth** (Liquid Glass).

To break the "template" look, we utilize **Intentional Asymmetry**. Large-scale italicized serif headings should sit offset from tight, technical sans-serif data grids. The layout should feel like a high-end forensic report: breathing room is not "empty space"; it is a tool for focus.

---

## 2. Colors: Absolute Void & Luminous Accents
Our palette is rooted in a `#000000` base, ensuring that every pixel of "on" color feels intentional and high-energy.

### The Palette
- **Primary:** `primary` (#FFFFFF) — Reserved for critical actions and high-level branding.
- **Surface Tiers:** Use `surface_container_lowest` (#0e0e0e) through `surface_container_highest` (#353535) to create structural depth without lines.
- **Functional Accents:** `error` (#ffb4ab) is used sparingly for forensic red flags or manipulated data points.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined by:
1. **Background Shifts:** A `surface_container_low` section sitting on a `surface_background`.
2. **Liquid Glass:** Utilizing `backdrop-blur` (20px+) to create an optical separation.
3. **Negative Space:** Using the `Spacing Scale` (specifically `12` to `24`) to denote shifts in context.

### Signature Textures
Apply a subtle, high-frequency **monochromatic grain** (opacity 2-3%) over the entire UI. This eliminates "banding" in gradients and gives the pure black background a physical, film-like quality that feels "archival" and scientific.

---

## 3. Typography: The Editorial Scientist
We pair the authoritative, academic feel of a serif with the cold precision of a technical sans-serif.

- **Display & Headlines:** `Instrument Serif` (Italic). This is our signature. Use `display-lg` for hero statements. It conveys the "Human Intelligence" behind the AI.
- **Body & Technical Data:** `Barlow`. Use `weights 300-400` for long-form analysis and `weight 600` for labels. `Barlow`'s condensed nature allows for high-density forensic data without feeling cramped.
- **Hierarchy:**
    - **Editorial Layer:** Large, italicized serifs that tell the "story" of the analysis.
    - **Data Layer:** Small, mono-spaced or tight sans-serif labels (`label-sm`) for metadata and timestamps.

---

## 4. Elevation & Depth: Liquid Glass
We do not use drop shadows to indicate height; we use **Refraction and Tonal Layering.**

- **The Layering Principle:** Treat the UI as layers of glass. The "closest" element to the user should be the most translucent/blurred.
- **Liquid Glass System:** 
    - **Background:** `surface_variant` (#353535) at 10-15% opacity.
    - **Blur:** `backdrop-filter: blur(40px)`.
    - **The Ghost Border:** Use `outline_variant` (#474747) at 15% opacity. This creates a "specular highlight" on the edge of the glass rather than a structural border.
- **Ambient Glow:** Instead of a shadow, use a subtle `primary` (#FFFFFF) outer glow with 4% opacity for "Active" states, mimicking a backlit laboratory screen.

---

## 5. Components: Precision Implements

### Buttons
- **Primary (The Lens):** Pure white background (`primary`), black text (`on_primary`). Border-radius: `full` (9999px). 
- **Secondary (The Frame):** Liquid Glass background, white text. Ghost border (15% opacity).
- **Tertiary:** Ghost border only, no background. 

### Cards & Forensic Containers
Forbid the use of divider lines. Separate content using **Vertical Spacing** (`spacing.8`).
- **Media Upload Box:** Large radius (`rounded-xl`), 15% white dashed ghost border, deep backdrop blur.
- **Analysis Cards:** Use `surface_container_low` for the card body and `surface_container_high` for nested "Evidence" chips inside the card.

### Input Fields
- **Search/Input:** Zero background. Only a bottom "Ghost Border" that expands to a full Liquid Glass capsule on focus.
- **States:** Error states use `error` (#ffb4ab) as a subtle outer glow rather than a thick red border.

### Specialized Components
- **Evidence Chips:** `label-sm` text inside a `full` radius pill. Background: `surface_container_highest`. 
- **Scanning Progress:** A 1px high-precision line using a gradient from `primary` (#FFFFFF) to `transparent` to simulate a laser sweep.

---

## 6. Do's and Don'ts

### Do:
- **Use Wide Margins:** Treat the screen like a gallery wall. Forensic data needs room to be "legal" and "trustworthy."
- **Embrace the Italic:** Use `Instrument Serif` italics for headers to create a sense of movement and "Human Touch."
- **Optical Alignment:** Align text-heavy data to a strict grid, but allow "Liquid Glass" floating elements to break that grid slightly for a premium feel.

### Don't:
- **No 100% Opaque Borders:** This kills the "Liquid Glass" effect. If you can't see through it, it's too heavy.
- **No Standard Grey:** Never use hex codes like #808080. Always use the provided tokens (`outline`, `surface_variant`) to maintain the blue-black scientific tone.
- **No Clutter:** If a piece of data isn't vital to the forensic conclusion, hide it in a "Details" drawer.