# World map appearance

Both the source and password-protected alternate world maps have a **Country colors and borders** section under **Map layers**.

Color choices:

- **Default political:** coordinated atlas colors with subtle unique country shades. Neighboring countries are assigned contrasting palette colors. Provinces inherit their country's fill.
- **Pastel, Muted, Marine, Royal, Modern and Earth tones:** coordinated alternatives with distinct country shades.
- **White countries:** solid white fills.
- **Light gray countries:** solid pale gray fills.
- **White and gray countries:** three restrained neutral tones.
- **Your saved colors:** restores the original world paints, including individually colored provinces.

Applying a scheme preserves the original world paints in a validated saved-map backup and keeps unrelated regional paints unchanged. Switching between schemes retains that backup. **Restore saved colors** returns to it. Manual painting still works within a selected scheme; **Reapply scheme** removes those adjustments. Scheme application hides the large automatically generated legend; restoring saved colors restores its previous visibility. Standard undo/redo and Save/Load retain these settings.

International borders default to opaque black, thicker than the light gray province borders. Each color can be changed independently. Province borders can show when zoomed in, remain always visible, or stay hidden. Existing map-wide and per-area border visibility switches remain applicable. Internal borders use the previous zoom threshold in Equal Earth mode to keep the whole-world view readable.

Equal Earth paths, imagery views and SVG/PNG/JPG exports share the same country fills and border hierarchy. SVG metadata records the selected appearance. No geographic coordinates, administrative relationships, alternate-world edits or password settings change.

Implementation: `app/world-style-model.ts` contains scheme generation, backup/restore, settings validation and border helpers; `app/world-style-controls.tsx` exposes the controls. Country colors now use curated, coordinated palettes with neighbor-aware assignment and subtle tonal variation. Earlier generated rainbow fills migrate to the new Default/Pastel palettes while manual colors are retained. The palette previews show the actual swatches. The original uploaded palette is retained for the saved-colors mode.

Validation:

```powershell
npm run check:world-style
npx tsc --noEmit
npm run build:vercel
npm run preview:vercel -- --host 127.0.0.1 --port 4546 --strictPort
npm run check:world-style-browser
```

Model checks cover all unique country colors, monochrome/neutral fills, province inheritance, original-color restoration, unrelated paint preservation, validation and save/load. Browser checks cover every scheme, border colors and visibility, SVG appearance, reload, restoration, alternate-world access and mobile layout. Screenshots and SVG output are written to ignored `outputs/world-style/`.
