# EVB Prognosis — Mobile App Design

## Overview
A clinical decision support mobile app for predicting 1-year mortality risk in cirrhotic patients with acute esophageal variceal bleeding (EVB). Combines a machine learning Random Forest model with traditional clinical scores (MELD, MELD-Na, Child-Pugh).

Converted from: HuggingFace Space mmrech/evb-br

## Screen List

| Screen | Type | Navigation |
|--------|------|-----------|
| Calculator | Tab | Tab bar |
| Results | Stack | Push from Calculator |
| History | Tab | Tab bar |
| History Detail | Stack | Push from History |
| Model Info | Tab | Tab bar |
| Settings | Tab | Tab bar |

## Primary Content & Functionality

### Calculator (Home Tab)
- **Content:** Multi-step form with 3 sections matching the original Gradio tabs:
  1. General Info (age, sex, race, etiology, medications)
  2. Clinical Status (portal vein thrombosis, ascites, varices, therapy, etc.)
  3. Laboratory Values (liver function, CBC, enzymes, electrolytes)
- **Functionality:** Step-by-step form with validation, slider inputs for numeric values, dropdown pickers for categorical values
- **Empty State:** Form pre-filled with default values (matching original)

### Results (Stack from Calculator)
- **Content:** Three result cards:
  1. ML Model Results (prediction, probability, risk category with color coding)
  2. Traditional Clinical Scores (MELD, MELD-Na, Child-Pugh)
  3. Model Performance Comparison
- **Functionality:** Color-coded risk display, save to history

### History (Tab)
- **Content:** List of past assessments with date, risk category, probability
- **Functionality:** Tap to view full results, long-press to delete
- **Empty State:** "No assessments yet" with CTA to calculator

### Model Info (Tab)
- **Content:** Model architecture, validation results, clinical guidelines, limitations
- **Functionality:** Static informational content with expandable sections

### Settings (Tab)
- **Content:** App preferences, about section
- **Functionality:** Theme toggle, clear history, app version info

## Key User Flows

### Primary Flow
1. User opens app → Calculator tab (form)
2. User fills in patient data across 3 sections
3. User taps "Calculate Risk" → Results screen
4. Results displayed with ML prediction + traditional scores
5. User can save assessment to history

### History Flow
1. User opens History tab → list of past assessments
2. User taps assessment → full results detail
3. User long-presses → delete confirmation

## Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| primary | #DC2626 | #EF4444 | Accent, buttons (medical red) |
| background | #FFFFFF | #151718 | Screen backgrounds |
| surface | #F5F5F5 | #1E2022 | Cards, elevated surfaces |
| foreground | #11181C | #ECEDEE | Primary text |
| muted | #687076 | #9BA1A6 | Secondary text |
| border | #E5E7EB | #334155 | Dividers |
| success | #22C55E | #4ADE80 | Low risk |
| warning | #F59E0B | #FBBF24 | Moderate risk |
| error | #EF4444 | #F87171 | High risk |

## Data Architecture

| Data | Storage | Reason |
|------|---------|--------|
| Assessment history | AsyncStorage | Local persistence |
| Patient input data | React state/context | Session only |
| ML model parameters | Bundled JSON | Offline inference |
| Preprocessor params | Bundled JSON | Offline inference |

## Architecture Decision: Client-Side ML Inference

Since the user prefers local execution and operational independence, the ML model will be reimplemented in TypeScript:
- StandardScaler parameters (means, scales) extracted and bundled as JSON
- OneHotEncoder categories extracted and bundled as JSON
- Traditional scores (MELD, MELD-Na, Child-Pugh) computed directly in TypeScript
- For the Random Forest model: create a Python API endpoint on the server that loads the joblib model
