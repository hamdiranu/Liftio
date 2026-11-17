# Liftio photography

The app shows real photography for every exercise and hero section that has a file here, and
designed fallback art (dark gradient, orange ambient light, muscle-group mark) for the rest.

All 35 exercises plus `gym/hero` and `gym/coach` have photos. 11 came from the RepTrack Figma
file (originals in `design/figma-images/`), and the other 26 were supplied separately as 2048 px
JPEGs and downscaled. Keep app copies as JPEG around 1080 px wide (about 60–170 KB each); full-size
originals would add 1.5–3 MB per photo to the app.

A few photos show a variation of the exercise rather than the exact setup in the catalog:
decline press with dumbbells (catalog: barbell), skull crusher with a straight bar (EZ bar),
overhead triceps extension on a cable (dumbbell), calf raises with dumbbells on the floor
(machine), Russian twist with a medicine ball (plate). The cable crunch and hanging leg raise
photos use a bright daylight gym instead of the dark, orange-lit look of the rest.

## Adding photos

1. Drop files into the folders below, named exactly as listed (`.jpg`, `.png` or `.webp`).
2. Run `npm run generate:images` to regenerate `src/constants/image-manifest.ts`.
3. Restart Metro. Photos appear everywhere the exercise is shown.

Alternatively, upload `<slug>.jpg` files to the public Supabase Storage bucket named in
`EXPO_PUBLIC_EXERCISE_IMAGE_BUCKET` (default `exercise-images`). Local files win over remote ones.

### `gym/`

| File | Used on |
| --- | --- |
| `hero.jpg` | Home dashboard hero |
| `auth.jpg` | Full-screen background of the sign-in ("Welcome back") screen |
| `coach.jpg` | AI Coach header |
| `train.jpg` | Train tab header |

### `exercises/`

`incline-dumbbell-press`, `flat-barbell-bench-press`, `decline-bench-press`, `cable-chest-fly`,
`pec-deck-fly`, `push-up`, `lat-pulldown`, `seated-cable-row`, `barbell-bent-over-row`,
`one-arm-dumbbell-row`, `pull-up`, `deadlift`, `dumbbell-shoulder-press`, `lateral-raise`,
`front-raise`, `reverse-pec-deck`, `arnold-press`, `barbell-bicep-curl`, `hammer-curl`,
`preacher-curl`, `cable-tricep-pushdown`, `overhead-tricep-extension`, `skull-crusher`,
`barbell-squat`, `leg-press`, `leg-extension`, `leg-curl`, `romanian-deadlift`,
`walking-lunges`, `calf-raises`, `plank`, `hanging-leg-raise`, `cable-crunch`,
`russian-twist`, `bicycle-crunch`

## Art direction

- Dark gym environment, low-key lighting with a warm orange rim or practical light.
- One athlete, mid-rep, correct technique and correct equipment for the named exercise.
- Check anatomy before using any image: exactly two arms and two legs, hands gripping the
  equipment naturally, no merged or extra limbs (common in AI-generated images).
- 4:3 or 1:1, at least 1200 px on the short side, subject centered (thumbnails crop to the middle).
- Use one distinct photo per exercise; don't reuse an image for unrelated movements.
- Only use photos you have the rights to (your own shoots, licensed stock, or properly licensed generated images).
