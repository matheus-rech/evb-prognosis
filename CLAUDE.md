# CLAUDE.md — EVB Prognosis

Guidance for Claude Code when working in this repository.

## Project Overview

React Native (Expo SDK 54) iOS app for **esophageal variceal bleeding (EVB) prognosis**.
Predicts 90-day mortality using a Random Forest + Isotonic Calibration model with 34 clinical inputs.
On-device ML inference — no backend required for predictions.

- **Bundle ID**: `com.rechmd.evbprognosis`
- **EAS Project**: `mmrech/evb-prognosis`
- **GitHub**: `git@github.com:matheus-rech/evb-prognosis.git` (default branch: `master`)
- **App Store Connect**: App ID `6759500199`, name "EVB Prognosis"
- **HF Spaces**: `mmrech/evb-br` and `mmrech/evb-brazil` (Gradio 4.44.1 + ONNX inference)

## Commands

```bash
pnpm dev           # Start Expo dev server
pnpm test          # Run all unit tests (Jest)
pnpm lint          # ESLint
pnpm format        # Prettier
pnpm build         # TypeScript check

eas build --platform ios --profile production   # Build iOS .ipa
eas submit --platform ios --latest              # Submit latest build to TestFlight
```

## Architecture

```
app/              Expo Router screens (tabs: Calculator, History, Model Info, Settings)
components/       Shared UI components (FeatureImportance, PDPChart, etc.)
lib/              Core services:
  ml-inference.ts         Random Forest + Isotonic Calibration (5-fold CV, JSON model)
  clinical-scores.ts      MELD, MELD-Na, Child-Pugh, ALBI score calculators
  validation.ts           Clinical range validation for all 34 inputs
  feature-importance.ts   TreeSHAP feature importance calculation
  pdp.ts                  Partial dependence plot computation
  assessment-history.ts   AsyncStorage-based history service
  assessment-context.tsx  React context for assessment state + auto-save
hf-space/         HuggingFace Space source (app.py ONNX, HTML, deploy.py)
tests/            Unit tests (50 total: clinical + ML + validation + SHAP + PDP)
```

## Key Technical Details

### ML Model
- 5-fold cross-validated calibrated Random Forest classifiers (averaged at inference)
- Model stored as JSON: `assets/random_forest_model.json`
- Isotonic calibration JSON: `hf-space/isotonic_calibration.json`
- 34 input features matching Gradio Space inputs exactly
- Reference probability for default inputs: **0.167302** (use for inference verification)
- Race category: lowercase → unknown → all zeros (must match Gradio behavior)

### EAS / iOS Deployment
- `eas.json` → `ascAppId: "6759500199"` (EVB Prognosis, correct bundle ID)
- Old app "EVB Predictor" (ID: `6759481139`) has wrong Manus bundle ID — do not use
- ASC API Key: `C9L49UMLD2` (stored in EAS servers, auto-selected)
- TestFlight: Internal Testers group with `matheusmrech2@icloud.com`
- EAS workflows in `.eas/workflows/`: `build-and-submit-ios.yml`, `pr-checks.yml`

### HuggingFace Space CI/CD
- `.github/workflows/deploy-hf-space.yml` — auto-deploys `hf-space/**` changes to both Spaces on push to `master`
- `hf-space/deploy.py` — uploads code files only (skips `.onnx`/`.joblib` LFS weights)
- `HF_TOKEN` is set as a GitHub Actions secret
- Model files use Git LFS in HF Space repos — never commit them to GitHub

### Testing
- 50 unit tests: 10 clinical scores + 5 ML inference + 13 validation + 12 feature importance + 10 PDP
- Run with: `pnpm test`
- Tests live in `tests/unit/`

## Development Notes

- **Package manager**: `pnpm` (not npm or yarn)
- **Styling**: NativeWind (Tailwind CSS for React Native) — dark glassmorphism theme
- **Theme**: Dark background, cyan/green accents (medical branding)
- **Navigation**: Expo Router (file-based, tabs layout)
- When adding new inputs: update types in `lib/types.ts`, validation in `lib/validation.ts`, and ensure feature order matches the 34-column model exactly
