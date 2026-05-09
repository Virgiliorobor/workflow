---
name: Bauhaus Industrial System
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#5b403f'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#8f6f6e'
  outline-variant: '#e4bebc'
  surface-tint: '#bb152c'
  primary: '#b7102a'
  on-primary: '#ffffff'
  primary-container: '#db313f'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb3b1'
  secondary: '#7d5800'
  on-secondary: '#ffffff'
  secondary-container: '#ffb702'
  on-secondary-container: '#6b4b00'
  tertiary: '#465d81'
  on-tertiary: '#ffffff'
  tertiary-container: '#5f759b'
  on-tertiary-container: '#fefcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3b1'
  on-primary-fixed: '#410007'
  on-primary-fixed-variant: '#92001c'
  secondary-fixed: '#ffdea9'
  secondary-fixed-dim: '#ffba27'
  on-secondary-fixed: '#271900'
  on-secondary-fixed-variant: '#5e4100'
  tertiary-fixed: '#d5e3ff'
  tertiary-fixed-dim: '#b0c7f1'
  on-tertiary-fixed: '#001b3c'
  on-tertiary-fixed-variant: '#30476a'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-rg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.1em
  technical-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '400'
    lineHeight: '1.2'
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  grid-pattern-size: 32px
---

## Brand & Style

This design system merges the foundational principles of the Bauhaus movement with the precise, tactile industrial design language of modern synthesizer engineering. The brand personality is **mathematical, playful, and uncompromising**. It values the "essential" over the "decorative," treating every UI element as a functional component in a larger machine.

The aesthetic is characterized by:
- **High-Precision Minimalism:** Thin 1px lines and rigorous grid alignment.
- **Industrial Tactility:** Elements feel like physical switches, machined parts, or technical readouts.
- **Primary Expression:** Utilizing a strict palette of Red, Yellow, and Blue to guide user intent and denote hierarchy without visual clutter.
- **Technical Honesty:** No hidden affordances; if an element is interactive, its geometry and color clearly communicate its state.

## Colors

The color strategy is "functional chromaticism." Colors are never used for decoration; they are reserved for specific semantic roles:

- **Primary Red (#E63946):** High-urgency actions, recording states, critical errors, and the most important "call-to-action" in a view.
- **Vibrant Yellow (#FFB703):** Warnings, active toggles, and "secondary-primary" highlights that require attention but not immediate alarm.
- **Cobalt Blue (#1D3557):** Structural depth, secondary navigation elements, and steady-state information.
- **Industrial Neutrals:** The background uses #FFFFFF (White) for the canvas and #F1F1F1 (Light Grey) for surface containers. Text and 1px borders always utilize absolute #000000 for maximum contrast and precision.

## Typography

Typography is treated as an engineering spec. It relies on a trio of typefaces to establish a clear hierarchy:

- **Space Grotesk (Display/Headlines):** Used for large headings. Its geometric quirks echo the Bauhaus spirit.
- **Inter (Body):** Used for all functional reading and interface copy. It provides maximum legibility within a neutral framework.
- **JetBrains Mono (Technical/Labels):** Used for micro-copy, status indicators, and values. The monospaced nature reinforces the "instrument" feel of the design system.

**Formatting Rule:** Labels and technical readouts should often be set in uppercase with increased letter spacing to mimic engraved industrial faceplates.

## Layout & Spacing

The layout is governed by a **strict 4px baseline grid**. Everything—from padding to the position of a line—must be a multiple of this unit.

- **Grid Background:** All primary canvases should feature a subtle 1px dot or line grid at 32px intervals. Elements must "snap" to these intersections.
- **Gutters & Margins:** A 16px gutter is standard across all viewports.
- **12-Column Framework:** Desktop layouts use a 12-column fixed grid. Mobile transitions to a 4-column fluid grid.
- **Internal Spacing:** Components use "tight" internal padding (typically 8px or 12px) to maintain a dense, technical feel similar to physical hardware.

## Elevation & Depth

This design system rejects soft ambient shadows. Depth is achieved through **structural layering and outlines**:

1.  **Flat Stacking:** Elements do not "float"; they are "placed." Depth is shown by 1px solid black borders (#000000).
2.  **Inset Shadows:** Interactive inputs (like text fields or buttons) may use a very subtle 1px-2px inset shadow to simulate a "pressed" or "milled" surface in the chassis.
3.  **Color Tiers:** A "surface" (White) sits on a "base" (Light Grey). This 2D layering is sufficient for hierarchy without the need for Z-axis blur.
4.  **The "Ghost" Line:** Use 1px #000000 lines to subdivide logical areas of the screen, creating a blueprint-like appearance.

## Shapes

The shape language is strictly **Euclidean**. 
- All corners are sharp (0px radius) to maintain the industrial, precision-cut aesthetic. 
- Circular elements are allowed only for specific functional metaphors: knobs, toggle LEDs, or status pips. 
- Buttons and containers must always be rectangular.

## Components

- **Buttons:** Rectangular with 1px black borders. Default state is White background with Black text. Primary action is Red (#E63946) with White text. Active/Toggle state is Yellow (#FFB703) with Black text.
- **Technical Labels:** Small uppercase monospaced text placed directly above a component or line, serving as a "faceplate" descriptor.
- **Input Fields:** Stark 1px black boxes. Focus state is indicated by a 2px Cobalt Blue (#1D3557) border or a solid Yellow accent block on the left side.
- **Status Indicators (LEDs):** Small 8x8px circles. Red = Error/Rec, Yellow = Standby/Warn, Blue = Active/Processing, Grey = Off.
- **Dividers:** 1px solid #000000 lines. Use them to box in groups of related settings or content, mimicking the modules of a hardware rack.
- **Cards:** Simple 1px bordered boxes. No shadows. Use the "Label-Caps" typography for the card title, often integrated into the top border line itself.