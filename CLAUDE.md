# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React Native (Expo SDK 54) mobile app for **esophageal variceal bleeding (EVB) prognosis**.
Predicts 90-day mortality using a Random Forest + Isotonic Calibration model with 34 clinical inputs.
On-device ML inference — no backend required for predictions.

- **Bundle ID**: `com.rechmd.evbprognosis`
- **EAS Project**: `mmrech/evb-prognosis`
- **GitHub**: `git@github.com:matheus-rech/evb-prognosis.git` (default branch: `master`)
- **App Store Connect**: App ID `6759500199`, name "EVB Prognosis"
- **Google Play**: Package `com.rechmd.evbprognosis`, internal testing track
- **HF Spaces**: `mmrech/evb-br` and `mmrech/evb-brazil` (Gradio 4.44.1 + ONNX inference)

## Commands

```bash
pnpm dev             # Start Expo dev server + backend (concurrently)
pnpm check           # TypeScript type check (tsc --noEmit)
pnpm test            # Run all unit tests (Vitest)
pnpm test -- --run lib/services/__tests__/ml-inference.test.ts  # Run single test file
pnpm lint            # ESLint
pnpm format          # Prettier

# iOS
eas build --platform ios --profile production     # Build iOS .ipa
eas submit --platform ios --latest                # Submit to TestFlight

# Android
eas build --platform android --profile production # Build Android .aab (local keystore)
eas submit --platform android --latest            # Submit to Google Play internal track
```

## Architecture

```
app/                  Expo Router screens (tabs layout)
  (tabs)/             Tab screens: Calculator (index), History, Info, Settings
  results.tsx         Results screen (stack from Calculator)
  history-detail.tsx  History detail (stack from History)
components/           UI components (form-fields, charts, themed views)
lib/
  services/           Core domain logic:
    ml-inference.ts         Random Forest + Isotonic Calibration (5-fold CV)
    clinical-scores.ts      MELD, MELD-Na, Child-Pugh, ALBI calculators
    validation.ts           Clinical range validation for 34 inputs
    feature-importance.ts   TreeSHAP feature importance
    partial-dependence.ts   Partial dependence plot computation
    pdf-report.ts           PDF report generation
    hf-api.ts               HuggingFace Space API client
    __tests__/              Unit tests (Vitest)
  types/index.ts      PatientInput type definition (34 fields)
  assessment-context.tsx  React context for assessment state + history persistence
  trpc.ts             tRPC client (template, not used for ML)
server/               Express + tRPC backend (Manus template, not used for predictions)
  _core/              Framework code — do not modify
assets/model/         ML model JSON files
hf-space/             HuggingFace Space source (app.py, deploy.py)
```

## Key Technical Details

### ML Model
- 5-fold cross-validated calibrated Random Forest classifiers (averaged at inference)
- Model JSON: `assets/model/full_model.json` (includes trees, preprocessor, and calibration data)
- 34 input features matching Gradio Space inputs exactly
- Reference probability for default inputs: **0.167302** (use for inference verification)
- Race category: lowercase → unknown → all zeros (must match Gradio behavior)

### Deployment
- **iOS**: `eas.json` → `ascAppId: "6759500199"`, ASC API Key `C9L49UMLD2` (on EAS servers)
- **Android**: Local keystore via `credentials.json` + `android-keystore.jks` (both gitignored)
- **Google Play**: Requires `google-play-service-account.json` for automated submission (gitignored)
- Old app "EVB Predictor" (ID: `6759481139`) has wrong bundle ID — do not use

### CI/CD
- `.eas/workflows/build-and-submit-ios.yml` — auto iOS build+submit on push to `master`
- `.eas/workflows/build-and-submit-android.yml` — auto Android build+submit on push to `master`
- `.eas/workflows/pr-checks.yml` — PR validation
- `.github/workflows/deploy-hf-space.yml` — auto-deploys `hf-space/**` to both HF Spaces on push to `master`
- HF model files (`.onnx`, `.joblib`) use Git LFS in HF repos — never commit them to GitHub

### Testing
- Tests in `lib/services/__tests__/` using Vitest
- Coverage: clinical scores, ML inference, validation, feature importance, partial dependence, HF API
- Run with: `pnpm test`

## Development Notes

- **Package manager**: `pnpm` (not npm or yarn)
- **Styling**: NativeWind (Tailwind CSS for React Native) — dark glassmorphism theme
- **Navigation**: Expo Router (file-based, tabs layout)
- **Backend**: The `server/` directory is a Manus template with tRPC/Drizzle/auth. The app does not use it for ML — all inference is client-side.
- When adding new inputs: update types in `lib/types/index.ts`, validation in `lib/services/validation.ts`, and ensure feature order matches the 34-column model exactly
