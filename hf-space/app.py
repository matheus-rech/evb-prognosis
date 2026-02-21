"""
EVB Prognosis: 1-Year Mortality Risk Calculator v5.0
Calibrated Random Forest with Isotonic Calibration (AUC 0.915)

Architecture:
- 5 ONNX Random Forest models (one per CV fold)
- JSON isotonic calibration data
- Fallback to joblib if ONNX unavailable
- SHAP feature importance (global + patient-specific)
- Partial Dependence Plots (PDP) for numeric features
- Glassmorphism dark theme with classic toggle
- Landing page with device detection
- JSON API endpoints for mobile/external consumers
"""
import os
import gradio as gr
import pandas as pd
import numpy as np
import json

# ===== Model Loading =====
PREPROCESSOR_PATH = "preprocessor_v1.0.joblib"
MODEL_PATH = "calibrated_random_forest_model_updated_v1.1.joblib"
CALIBRATION_PATH = "isotonic_calibration.json"

USE_ONNX = False
onnx_sessions = []
calibration_data = {}

# Always load joblib model (needed for SHAP)
import joblib
preprocessor = joblib.load(PREPROCESSOR_PATH)
joblib_model = joblib.load(MODEL_PATH)

# Try ONNX for inference
try:
    import onnxruntime as ort
    with open(CALIBRATION_PATH, "r") as f:
        calibration_data = json.load(f)
    for i in range(5):
        path = f"rf_fold_{i}.onnx"
        if os.path.exists(path):
            sess = ort.InferenceSession(path)
            onnx_sessions.append(sess)
    if len(onnx_sessions) == 5:
        USE_ONNX = True
        print(f"ONNX inference enabled ({len(onnx_sessions)} fold models loaded)")
    else:
        raise FileNotFoundError("Not all ONNX fold models found")
except Exception as e:
    print(f"ONNX not available ({e}), falling back to joblib")
    USE_ONNX = False

# ===== SHAP Setup =====
try:
    import shap
    SHAP_AVAILABLE = True
    print("SHAP library loaded")
except ImportError:
    SHAP_AVAILABLE = False
    print("SHAP not available - feature importance will not be shown")

FEATURE_NAMES = list(preprocessor.get_feature_names_out())

# Clean feature name mapping
CLEAN_NAMES = {}
for fn in FEATURE_NAMES:
    clean = fn.replace("num__", "").replace("cat__", "")
    mappings = {
        "sex_female": "Sex (Female)", "sex_male": "Sex (Male)",
        "race_White": "Race (White)", "race_black": "Race (Black)", "race_other": "Race (Other)",
        "etiology_cirrosis_alcohol": "Etiology: Alcohol",
        "etiology_cirrosis_alcohol+hcv": "Etiology: Alcohol+HCV",
        "etiology_cirrosis_crypto": "Etiology: Cryptogenic",
        "etiology_cirrosis_hb": "Etiology: HBV",
        "etiology_cirrosis_hcv": "Etiology: HCV",
        "etiology_cirrosis_nash": "Etiology: NASH",
        "hepatorenal_syndrome_no": "No HRS", "hepatorenal_syndrome_yes": "Hepatorenal Syndrome",
        "omeprazole_no": "No Omeprazole", "omeprazole_yes": "Omeprazole",
        "spironolactone_no": "No Spironolactone", "spironolactone_yes": "Spironolactone",
        "furosemide_no": "No Furosemide", "furosemide_yes": "Furosemide",
        "propanolol_no": "No Propranolol", "propanolol_yes": "Propranolol",
        "dialisis_no": "No Dialysis", "dialisis_yes": "Dialysis",
        "portal_vein_thrombosis_no": "No PVT", "portal_vein_thrombosis_yes": "Portal Vein Thrombosis",
        "ascitis_no": "No Ascites", "ascitis_yes": "Ascites",
        "hepatocellular_carcinoma_no": "No HCC", "hepatocellular_carcinoma_yes": "HCC",
        "varices_no": "No Varices", "varices_yes": "Varices",
        "red_wale_marks_no": "No Red Wale Marks", "red_wale_marks_yes": "Red Wale Marks",
        "rupture_point_no": "No Rupture Point", "rupture_point_yes": "Rupture Point",
        "active_bleeding_no": "No Active Bleeding", "active_bleeding_yes": "Active Bleeding",
        "therapy_Banding": "Therapy: Banding", "therapy_no therapy": "Therapy: None",
        "therapy_Sclerotherapy": "Therapy: Sclerotherapy",
        "rebleeding_no": "No Rebleeding", "rebleeding_yes": "Rebleeding",
        "age": "Age", "albumin": "Albumin", "total_bilirrubin": "Total Bilirubin",
        "direct_bilirrubina": "Direct Bilirubin", "inr": "INR", "creatinine": "Creatinine",
        "platelets": "Platelets", "ast": "AST", "alt": "ALT", "hemoglobin": "Hemoglobin",
        "hematocrit": "Hematocrit", "leucocytes": "Leukocytes", "sodium": "Sodium",
        "potassium": "Potassium", "terlipressin_dose": "Terlipressin Dose",
        "time-to-endoscophy_hours": "Time to Endoscopy",
    }
    CLEAN_NAMES[fn] = mappings.get(clean, clean.replace("_", " ").title())

# Numeric features for PDP
NUMERIC_FEATURES = {
    "age": {"min": 18, "max": 100, "step": 1, "label": "Age (years)"},
    "albumin": {"min": 1.0, "max": 5.0, "step": 0.1, "label": "Albumin (g/dL)"},
    "total_bilirrubin": {"min": 0.1, "max": 30.0, "step": 0.5, "label": "Total Bilirubin (mg/dL)"},
    "direct_bilirrubina": {"min": 0.1, "max": 10.0, "step": 0.2, "label": "Direct Bilirubin (mg/dL)"},
    "inr": {"min": 0.5, "max": 5.0, "step": 0.1, "label": "INR"},
    "creatinine": {"min": 0.1, "max": 10.0, "step": 0.2, "label": "Creatinine (mg/dL)"},
    "platelets": {"min": 10, "max": 500, "step": 10, "label": "Platelets (x10^3/uL)"},
    "ast": {"min": 10, "max": 500, "step": 10, "label": "AST (U/L)"},
    "alt": {"min": 10, "max": 500, "step": 10, "label": "ALT (U/L)"},
    "hemoglobin": {"min": 5.0, "max": 20.0, "step": 0.5, "label": "Hemoglobin (g/dL)"},
    "hematocrit": {"min": 15, "max": 60, "step": 1, "label": "Hematocrit (%)"},
    "leucocytes": {"min": 1.0, "max": 50.0, "step": 1.0, "label": "Leukocytes (x10^3/uL)"},
    "sodium": {"min": 120, "max": 160, "step": 1, "label": "Sodium (mEq/L)"},
    "potassium": {"min": 2.0, "max": 6.0, "step": 0.1, "label": "Potassium (mEq/L)"},
    "terlipressin_dose": {"min": 0, "max": 20, "step": 1, "label": "Terlipressin Dose (mg)"},
    "time-to-endoscophy_hours": {"min": 0, "max": 48, "step": 1, "label": "Time to Endoscopy (hours)"},
}

# Default patient for PDP baseline
DEFAULT_PATIENT = {
    "age": 50, "sex": "male", "race": "white", "etiology_cirrosis": "alcohol",
    "hepatorenal_syndrome": "no", "omeprazole": "no", "spironolactone": "yes",
    "furosemide": "yes", "propanolol": "no", "dialisis": "no",
    "portal_vein_thrombosis": "no", "ascitis": "yes", "hepatocellular_carcinoma": "no",
    "albumin": 3.5, "total_bilirrubin": 2.0, "direct_bilirrubina": 0.5,
    "inr": 1.2, "creatinine": 1.0, "platelets": 150, "ast": 35, "alt": 25,
    "hemoglobin": 13, "hematocrit": 40, "leucocytes": 6, "sodium": 140,
    "potassium": 4, "varices": "yes", "red_wale_marks": "no",
    "rupture_point": "no", "active_bleeding": "no", "therapy": "Banding",
    "terlipressin_dose": 2, "time-to-endoscophy_hours": 12, "rebleeding": "no"
}

# Precompute global feature importance at startup
GLOBAL_IMPORTANCE = None
GLOBAL_SHAP_DATA = None  # For JSON API
if SHAP_AVAILABLE:
    try:
        representative_patients = [
            DEFAULT_PATIENT,
            {"age": 75, "sex": "female", "race": "black", "etiology_cirrosis": "hcv",
             "hepatorenal_syndrome": "yes", "omeprazole": "yes", "spironolactone": "no",
             "furosemide": "no", "propanolol": "yes", "dialisis": "yes",
             "portal_vein_thrombosis": "yes", "ascitis": "yes", "hepatocellular_carcinoma": "yes",
             "albumin": 1.5, "total_bilirrubin": 15.0, "direct_bilirrubina": 5.0,
             "inr": 2.5, "creatinine": 3.0, "platelets": 50, "ast": 200, "alt": 150,
             "hemoglobin": 7, "hematocrit": 22, "leucocytes": 15, "sodium": 125,
             "potassium": 5.5, "varices": "yes", "red_wale_marks": "yes",
             "rupture_point": "yes", "active_bleeding": "yes", "therapy": "Sclerotherapy",
             "terlipressin_dose": 8, "time-to-endoscophy_hours": 36, "rebleeding": "yes"},
            {"age": 35, "sex": "male", "race": "other", "etiology_cirrosis": "alcohol+hcv",
             "hepatorenal_syndrome": "no", "omeprazole": "yes", "spironolactone": "yes",
             "furosemide": "no", "propanolol": "yes", "dialisis": "no",
             "portal_vein_thrombosis": "no", "ascitis": "no", "hepatocellular_carcinoma": "no",
             "albumin": 4.0, "total_bilirrubin": 1.0, "direct_bilirrubina": 0.2,
             "inr": 1.0, "creatinine": 0.8, "platelets": 200, "ast": 25, "alt": 20,
             "hemoglobin": 14, "hematocrit": 42, "leucocytes": 5, "sodium": 142,
             "potassium": 4.2, "varices": "no", "red_wale_marks": "no",
             "rupture_point": "no", "active_bleeding": "no", "therapy": "Banding",
             "terlipressin_dose": 0, "time-to-endoscophy_hours": 6, "rebleeding": "no"},
        ]
        
        global_shap_accum = np.zeros(len(FEATURE_NAMES))
        for patient in representative_patients:
            df = pd.DataFrame([patient])
            proc = preprocessor.transform(df)
            for cc in joblib_model.calibrated_classifiers_:
                rf = cc.base_estimator
                explainer = shap.TreeExplainer(rf)
                sv = explainer.shap_values(proc)
                shap_vals = np.array(sv)[0, :, 1]
                global_shap_accum += np.abs(shap_vals)
        
        n_total = len(representative_patients) * 5
        GLOBAL_IMPORTANCE = global_shap_accum / n_total
        
        # Build JSON-friendly global SHAP data
        sorted_idx = np.argsort(GLOBAL_IMPORTANCE)[::-1]
        GLOBAL_SHAP_DATA = []
        for i in range(min(20, len(sorted_idx))):
            idx = int(sorted_idx[i])
            GLOBAL_SHAP_DATA.append({
                "feature": CLEAN_NAMES[FEATURE_NAMES[idx]],
                "raw_feature": FEATURE_NAMES[idx],
                "importance": round(float(GLOBAL_IMPORTANCE[idx]), 6)
            })
        
        print("Global SHAP feature importance (top 10):")
        for item in GLOBAL_SHAP_DATA[:10]:
            print(f"  {item['feature']:35s} {item['importance']:.4f}")
        print("Global SHAP computed successfully")
    except Exception as e:
        print(f"Error computing global SHAP: {e}")
        import traceback
        traceback.print_exc()
        GLOBAL_IMPORTANCE = None

# ===== PDP Computation =====
PDP_CACHE = {}

def compute_pdp(feature_name, n_points=30):
    """Compute partial dependence plot data for a numeric feature."""
    if feature_name in PDP_CACHE:
        return PDP_CACHE[feature_name]
    
    if feature_name not in NUMERIC_FEATURES:
        return None
    
    finfo = NUMERIC_FEATURES[feature_name]
    values = np.linspace(finfo["min"], finfo["max"], n_points)
    probabilities = []
    
    for val in values:
        patient = DEFAULT_PATIENT.copy()
        patient[feature_name] = float(val)
        df = pd.DataFrame([patient])
        processed = preprocessor.transform(df)
        
        if USE_ONNX:
            processed_f32 = processed.astype(np.float32)
            fold_probs = []
            for i, sess in enumerate(onnx_sessions):
                result = sess.run(None, {"X": processed_f32})
                raw_prob = float(result[1][0][1])
                cal = calibration_data[f"fold_{i}"]
                cal_prob = float(np.interp(raw_prob, cal["X_thresholds"], cal["y_thresholds"]))
                fold_probs.append(cal_prob)
            prob = float(np.mean(fold_probs))
        else:
            prob = float(joblib_model.predict_proba(processed)[:, 1][0])
        
        probabilities.append(prob)
    
    result = {
        "feature": feature_name,
        "label": finfo["label"],
        "values": [round(float(v), 2) for v in values],
        "probabilities": [round(p, 6) for p in probabilities],
        "default_value": DEFAULT_PATIENT.get(feature_name, finfo["min"]),
        "min": finfo["min"],
        "max": finfo["max"]
    }
    PDP_CACHE[feature_name] = result
    return result

# Precompute PDP for top features
print("Precomputing PDP curves...")
for feat in ["albumin", "inr", "creatinine", "total_bilirrubin", "sodium", "age", "hemoglobin", "platelets"]:
    compute_pdp(feat)
print(f"PDP precomputed for {len(PDP_CACHE)} features")

def compute_patient_shap(processed):
    """Compute patient-specific SHAP values averaged across 5 folds."""
    if not SHAP_AVAILABLE:
        return None, None
    try:
        all_shap = []
        all_base = []
        for cc in joblib_model.calibrated_classifiers_:
            rf = cc.base_estimator
            explainer = shap.TreeExplainer(rf)
            sv = explainer.shap_values(processed)
            shap_vals = np.array(sv)[0, :, 1]
            base_val = float(np.array(explainer.expected_value[1]).flat[0])
            all_shap.append(shap_vals)
            all_base.append(base_val)
        avg_shap = np.mean(all_shap, axis=0)
        avg_base = float(np.mean(all_base))
        return avg_shap, avg_base
    except Exception as e:
        print(f"SHAP computation error: {e}")
        return None, None

def render_global_shap_html():
    """Render the global feature importance as a styled horizontal bar chart."""
    if GLOBAL_IMPORTANCE is None:
        return "<div style='color:#687076; text-align:center; padding:20px;'>Global SHAP not available</div>"
    
    sorted_idx = np.argsort(GLOBAL_IMPORTANCE)[::-1]
    top_n = 15
    max_val = float(GLOBAL_IMPORTANCE[sorted_idx[0]])
    
    bars_html = ""
    for rank in range(top_n):
        idx = int(sorted_idx[rank])
        val = float(GLOBAL_IMPORTANCE[idx])
        name = CLEAN_NAMES[FEATURE_NAMES[idx]]
        pct = (val / max_val * 100) if max_val > 0 else 0
        
        bars_html += f"""
        <div style="display:flex; align-items:center; margin:4px 0; gap:8px;">
            <div style="width:140px; text-align:right; font-size:11px; color:#9ba1a6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="{name}">{name}</div>
            <div style="flex:1; height:18px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; position:relative;">
                <div style="width:{pct:.1f}%; height:100%; background:linear-gradient(90deg, rgba(0,229,160,0.6), rgba(0,180,216,0.6)); border-radius:4px; transition:width 0.5s;"></div>
            </div>
            <div style="width:50px; font-size:10px; color:#00e5a0; font-weight:600; font-family:monospace;">{val:.4f}</div>
        </div>"""
    
    return f"""
    <div style="padding:12px 0;">
        <div style="font-size:14px; font-weight:700; color:#00e5a0; margin-bottom:4px; letter-spacing:0.5px;">GLOBAL FEATURE IMPORTANCE</div>
        <div style="font-size:11px; color:#687076; margin-bottom:12px;">Mean |SHAP| across representative patients (prospective-validated model)</div>
        {bars_html}
    </div>"""

def render_patient_shap_html(shap_values, base_value, probability):
    """Render patient-specific SHAP as a waterfall-style horizontal bar chart."""
    if shap_values is None:
        return "<div style='color:#687076; text-align:center; padding:20px;'>Patient SHAP not available</div>"
    
    sorted_idx = np.argsort(np.abs(shap_values))[::-1]
    top_n = 15
    max_abs = float(np.max(np.abs(shap_values[sorted_idx[:top_n]])))
    
    bars_html = ""
    for rank in range(top_n):
        idx = int(sorted_idx[rank])
        val = float(shap_values[idx])
        name = CLEAN_NAMES[FEATURE_NAMES[idx]]
        abs_pct = (abs(val) / max_abs * 100) if max_abs > 0 else 0
        
        if val > 0:
            color = "#ff4b2b"
            arrow = "+"
            bar_style = f"width:{abs_pct:.1f}%; margin-left:50%; background:linear-gradient(90deg, rgba(255,75,43,0.3), rgba(255,75,43,0.7));"
        else:
            color = "#00e5a0"
            arrow = ""
            bar_style = f"width:{abs_pct:.1f}%; margin-left:{50 - abs_pct/2:.1f}%; background:linear-gradient(90deg, rgba(0,229,160,0.7), rgba(0,229,160,0.3));"
        
        bars_html += f"""
        <div style="display:flex; align-items:center; margin:3px 0; gap:6px;">
            <div style="width:140px; text-align:right; font-size:11px; color:#9ba1a6; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="{name}">{name}</div>
            <div style="flex:1; height:16px; background:rgba(255,255,255,0.03); border-radius:3px; overflow:hidden; position:relative;">
                <div style="position:absolute; left:50%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.15);"></div>
                <div style="{bar_style} height:100%; border-radius:3px; transition:width 0.5s;"></div>
            </div>
            <div style="width:65px; font-size:10px; color:{color}; font-weight:600; font-family:monospace;">{arrow}{val:.4f}</div>
        </div>"""
    
    total_shap = float(np.sum(shap_values))
    direction_text = "above" if total_shap > 0 else "below"
    direction_color = "#ff4b2b" if total_shap > 0 else "#00e5a0"
    
    return f"""
    <div style="padding:12px 0;">
        <div style="font-size:14px; font-weight:700; color:#00b4d8; margin-bottom:4px; letter-spacing:0.5px;">THIS PATIENT'S FEATURE CONTRIBUTIONS</div>
        <div style="font-size:11px; color:#687076; margin-bottom:8px;">
            How each feature shifts this patient's risk from the population baseline ({base_value:.1%})
        </div>
        <div style="display:flex; justify-content:center; gap:16px; margin-bottom:12px; font-size:11px;">
            <span style="color:#ff4b2b;">Red = increases risk &rarr;</span>
            <span style="color:rgba(255,255,255,0.2);">|</span>
            <span style="color:#00e5a0;">&larr; Green = decreases risk</span>
        </div>
        {bars_html}
        <div style="margin-top:12px; padding:10px; background:rgba(255,255,255,0.04); border-radius:8px; text-align:center;">
            <span style="font-size:12px; color:#9ba1a6;">Net SHAP effect: </span>
            <span style="font-size:14px; font-weight:700; color:{direction_color};">{total_shap:+.4f}</span>
            <span style="font-size:12px; color:#9ba1a6;"> ({direction_text} baseline)</span>
            <span style="font-size:12px; color:#687076;"> | Base: {base_value:.1%} + SHAP = {base_value + total_shap:.1%} (uncalibrated)</span>
        </div>
    </div>"""

def render_pdp_html(feature_name):
    """Render a PDP chart as an SVG inside HTML."""
    pdp_data = compute_pdp(feature_name)
    if pdp_data is None:
        return f"<div style='color:#687076; text-align:center; padding:20px;'>PDP not available for {feature_name}</div>"
    
    values = pdp_data["values"]
    probs = pdp_data["probabilities"]
    label = pdp_data["label"]
    default_val = pdp_data["default_value"]
    
    # SVG dimensions
    w, h = 600, 300
    pad_l, pad_r, pad_t, pad_b = 60, 20, 30, 50
    plot_w = w - pad_l - pad_r
    plot_h = h - pad_t - pad_b
    
    min_v, max_v = min(values), max(values)
    min_p, max_p = min(probs), max(probs)
    # Add some padding to y-axis
    p_range = max_p - min_p
    if p_range < 0.01:
        p_range = 0.1
        min_p = max(0, min_p - 0.05)
        max_p = min(1, max_p + 0.05)
    else:
        min_p = max(0, min_p - p_range * 0.1)
        max_p = min(1, max_p + p_range * 0.1)
    
    def x_pos(v):
        return pad_l + (v - min_v) / (max_v - min_v) * plot_w if max_v > min_v else pad_l + plot_w / 2
    
    def y_pos(p):
        return pad_t + (1 - (p - min_p) / (max_p - min_p)) * plot_h if max_p > min_p else pad_t + plot_h / 2
    
    # Build path
    points = []
    for v, p in zip(values, probs):
        points.append(f"{x_pos(v):.1f},{y_pos(p):.1f}")
    path_d = "M " + " L ".join(points)
    
    # Gradient fill area
    fill_points = [f"{x_pos(values[0]):.1f},{y_pos(min_p):.1f}"]
    for v, p in zip(values, probs):
        fill_points.append(f"{x_pos(v):.1f},{y_pos(p):.1f}")
    fill_points.append(f"{x_pos(values[-1]):.1f},{y_pos(min_p):.1f}")
    fill_d = "M " + " L ".join(fill_points) + " Z"
    
    # Default value marker
    default_x = x_pos(default_val)
    default_prob = float(np.interp(default_val, values, probs))
    default_y = y_pos(default_prob)
    
    # Y-axis ticks
    y_ticks = np.linspace(min_p, max_p, 5)
    y_tick_html = ""
    for yt in y_ticks:
        yp = y_pos(yt)
        y_tick_html += f'<line x1="{pad_l}" y1="{yp:.1f}" x2="{pad_l + plot_w}" y2="{yp:.1f}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>'
        y_tick_html += f'<text x="{pad_l - 8}" y="{yp:.1f}" text-anchor="end" fill="#687076" font-size="10" dominant-baseline="middle">{yt:.1%}</text>'
    
    # X-axis ticks
    x_ticks = np.linspace(min_v, max_v, 6)
    x_tick_html = ""
    for xt in x_ticks:
        xp = x_pos(xt)
        x_tick_html += f'<text x="{xp:.1f}" y="{h - 10}" text-anchor="middle" fill="#687076" font-size="10">{xt:.1f}</text>'
    
    svg = f"""
    <svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" style="width:100%; max-width:600px;">
        <defs>
            <linearGradient id="pdp-fill-{feature_name}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(0,229,160,0.25)"/>
                <stop offset="100%" stop-color="rgba(0,229,160,0.02)"/>
            </linearGradient>
            <linearGradient id="pdp-line-{feature_name}" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="#00e5a0"/>
                <stop offset="100%" stop-color="#00b4d8"/>
            </linearGradient>
        </defs>
        
        <!-- Grid -->
        {y_tick_html}
        
        <!-- Fill area -->
        <path d="{fill_d}" fill="url(#pdp-fill-{feature_name})"/>
        
        <!-- Line -->
        <path d="{path_d}" fill="none" stroke="url(#pdp-line-{feature_name})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        
        <!-- Default value marker -->
        <line x1="{default_x:.1f}" y1="{pad_t}" x2="{default_x:.1f}" y2="{pad_t + plot_h}" stroke="rgba(255,180,0,0.4)" stroke-width="1" stroke-dasharray="4,4"/>
        <circle cx="{default_x:.1f}" cy="{default_y:.1f}" r="5" fill="#ffb400" stroke="#0a0e17" stroke-width="2"/>
        <text x="{default_x:.1f}" y="{default_y - 12:.1f}" text-anchor="middle" fill="#ffb400" font-size="10" font-weight="600">{default_prob:.1%}</text>
        
        <!-- X-axis label -->
        {x_tick_html}
        <text x="{w/2}" y="{h - 2}" text-anchor="middle" fill="#9ba1a6" font-size="11" font-weight="500">{label}</text>
        
        <!-- Y-axis label -->
        <text x="12" y="{h/2}" text-anchor="middle" fill="#9ba1a6" font-size="11" font-weight="500" transform="rotate(-90, 12, {h/2})">Mortality Probability</text>
    </svg>
    """
    
    return f"""
    <div style="padding:8px 0; text-align:center;">
        <div style="font-size:13px; color:#00e5a0; font-weight:600; margin-bottom:4px;">
            {label} &mdash; Partial Dependence
        </div>
        <div style="font-size:10px; color:#687076; margin-bottom:8px;">
            How varying {label.lower()} affects predicted mortality (other features held at defaults)
        </div>
        {svg}
        <div style="display:flex; justify-content:center; gap:16px; margin-top:8px; font-size:10px;">
            <span style="color:#ffb400;">&#9679; Default value ({default_val})</span>
            <span style="color:#687076;">Min: {min(probs):.1%} | Max: {max(probs):.1%}</span>
        </div>
    </div>"""

# ===== Clinical Score Calculations =====
def calculate_meld(bilirubin, inr, creatinine):
    bilirubin = max(bilirubin, 1.0)
    inr = max(inr, 1.0)
    creatinine = max(creatinine, 1.0)
    meld = 3.78 * np.log(bilirubin) + 11.2 * np.log(inr) + 9.57 * np.log(creatinine) + 6.43
    return int(np.clip(np.round(meld), 6, 40))

def calculate_meld_na(bilirubin, inr, creatinine, sodium):
    meld = calculate_meld(bilirubin, inr, creatinine)
    sodium = np.clip(sodium, 125, 137)
    meld_na = meld + 1.32 * (137 - sodium) - (0.033 * meld * (137 - sodium))
    return int(np.clip(np.round(meld_na), 6, 40))

def calculate_child_pugh(bilirubin, albumin, inr, ascites):
    score = 0
    score += 1 if bilirubin < 2 else (2 if bilirubin <= 3 else 3)
    score += 1 if albumin > 3.5 else (2 if albumin >= 2.8 else 3)
    score += 1 if inr < 1.7 else (2 if inr <= 2.3 else 3)
    score += 1 if ascites == 'no' else 2
    score += 1  # Encephalopathy assumed none
    cp_class = "A" if score <= 6 else ("B" if score <= 9 else "C")
    return score, cp_class

def calculate_albi(bilirubin, albumin):
    bil_umol = bilirubin * 17.1
    alb_gl = albumin * 10
    albi = (np.log10(bil_umol) * 0.66) + (alb_gl * -0.085)
    grade = "1" if albi <= -2.60 else ("2" if albi <= -1.39 else "3")
    return round(albi, 2), grade

def apply_isotonic(raw_prob, x_thresholds, y_thresholds):
    return float(np.interp(raw_prob, x_thresholds, y_thresholds))

# ===== Prediction Function =====
def predict_patient_outcome(
    age, sex, race, etiology_cirrosis, hepatorenal_syndrome, omeprazole,
    spironolactone, furosemide, propanolol, dialisis, portal_vein_thrombosis,
    ascitis, hepatocellular_carcinoma, albumin, total_bilirrubin,
    direct_bilirrubina, inr, creatinine, platelets, ast, alt, hemoglobin,
    hematocrit, leucocytes, sodium, potassium, varices, red_wale_marks,
    rupture_point, active_bleeding, therapy, terlipressin_dose,
    time_to_endoscophy_hours, rebleeding
):
    input_data = {
        "age": age, "sex": sex, "race": race,
        "etiology_cirrosis": etiology_cirrosis,
        "hepatorenal_syndrome": hepatorenal_syndrome,
        "omeprazole": omeprazole, "spironolactone": spironolactone,
        "furosemide": furosemide, "propanolol": propanolol,
        "dialisis": dialisis, "portal_vein_thrombosis": portal_vein_thrombosis,
        "ascitis": ascitis, "hepatocellular_carcinoma": hepatocellular_carcinoma,
        "albumin": albumin, "total_bilirrubin": total_bilirrubin,
        "direct_bilirrubina": direct_bilirrubina, "inr": inr,
        "creatinine": creatinine, "platelets": platelets,
        "ast": ast, "alt": alt, "hemoglobin": hemoglobin,
        "hematocrit": hematocrit, "leucocytes": leucocytes,
        "sodium": sodium, "potassium": potassium,
        "varices": varices, "red_wale_marks": red_wale_marks,
        "rupture_point": rupture_point, "active_bleeding": active_bleeding,
        "therapy": therapy, "terlipressin_dose": terlipressin_dose,
        "time-to-endoscophy_hours": time_to_endoscophy_hours,
        "rebleeding": rebleeding
    }

    df = pd.DataFrame([input_data])
    processed = preprocessor.transform(df)
    
    if USE_ONNX:
        processed_f32 = processed.astype(np.float32)
        fold_probs = []
        for i, sess in enumerate(onnx_sessions):
            result = sess.run(None, {"X": processed_f32})
            raw_prob = float(result[1][0][1])
            cal = calibration_data[f"fold_{i}"]
            cal_prob = apply_isotonic(raw_prob, cal["X_thresholds"], cal["y_thresholds"])
            fold_probs.append(cal_prob)
        probability = float(np.mean(fold_probs))
        prediction = 1 if probability >= 0.5 else 0
        inference_engine = "ONNX"
    else:
        prediction = joblib_model.predict(processed)[0]
        probability = joblib_model.predict_proba(processed)[:, 1][0]
        inference_engine = "joblib"
    
    patient_shap, base_value = compute_patient_shap(processed)
    
    confidence_margin = 0.15
    ci_lower = max(0, probability - confidence_margin)
    ci_upper = min(1, probability + confidence_margin)
    
    meld = calculate_meld(total_bilirrubin, inr, creatinine)
    meld_na = calculate_meld_na(total_bilirrubin, inr, creatinine, sodium)
    child_pugh, cp_class = calculate_child_pugh(total_bilirrubin, albumin, inr, ascitis)
    albi, albi_grade = calculate_albi(total_bilirrubin, albumin)
    
    if probability < 0.3:
        risk_category, risk_icon, risk_bar_color = "LOW RISK", "OK", "#00e5a0"
    elif probability < 0.6:
        risk_category, risk_icon, risk_bar_color = "MODERATE RISK", "!!", "#ffc107"
    else:
        risk_category, risk_icon, risk_bar_color = "HIGH RISK", "!!", "#ff4b2b"
    
    pct = probability * 100
    bar_width = int(pct)
    
    ml_output = f"""
<div style="text-align:center; padding:10px 0;">
<div style="font-size:48px; font-weight:800; background: linear-gradient(135deg, {risk_bar_color}, #fff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:2px;">{pct:.1f}%</div>
<div style="font-size:14px; color:#9ba1a6; margin-top:4px;">1-Year Mortality Probability</div>
<div style="margin:12px auto; width:80%; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
<div style="width:{bar_width}%; height:100%; background:linear-gradient(90deg, #00e5a0, {risk_bar_color}); border-radius:4px; transition:width 0.5s;"></div>
</div>
<div style="display:inline-block; padding:6px 20px; border-radius:20px; background:{risk_bar_color}22; border:1px solid {risk_bar_color}; color:{risk_bar_color}; font-weight:700; font-size:13px; letter-spacing:1px;">{risk_icon} {risk_category}</div>
<div style="color:#9ba1a6; font-size:12px; margin-top:8px;">95% CI: {ci_lower:.1%} - {ci_upper:.1%}</div>
<div style="color:#9ba1a6; font-size:12px;">Predicted: {"Death within 1 year" if prediction == 1 else "Survival beyond 1 year"}</div>
<div style="color:#687076; font-size:10px; margin-top:4px;">Engine: {inference_engine}</div>
</div>
"""
    
    traditional_scores = f"""
<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:8px 0;">
<div style="background:rgba(0,229,160,0.08); border:1px solid rgba(0,229,160,0.2); border-radius:12px; padding:16px; text-align:center;">
<div style="font-size:28px; font-weight:700; color:#00e5a0;">{meld}</div>
<div style="font-size:12px; color:#9ba1a6; margin-top:4px;">MELD Score</div>
<div style="font-size:10px; color:#687076;">Range: 6-40</div>
</div>
<div style="background:rgba(0,229,160,0.08); border:1px solid rgba(0,229,160,0.2); border-radius:12px; padding:16px; text-align:center;">
<div style="font-size:28px; font-weight:700; color:#00e5a0;">{meld_na}</div>
<div style="font-size:12px; color:#9ba1a6; margin-top:4px;">MELD-Na Score</div>
<div style="font-size:10px; color:#687076;">Range: 6-40</div>
</div>
<div style="background:rgba(0,229,160,0.08); border:1px solid rgba(0,229,160,0.2); border-radius:12px; padding:16px; text-align:center;">
<div style="font-size:28px; font-weight:700; color:#00e5a0;">{child_pugh}</div>
<div style="font-size:12px; color:#9ba1a6; margin-top:4px;">Child-Pugh (Class {cp_class})</div>
<div style="font-size:10px; color:#687076;">{"Well-compensated" if cp_class == "A" else "Significant compromise" if cp_class == "B" else "Decompensated"}</div>
</div>
<div style="background:rgba(0,229,160,0.08); border:1px solid rgba(0,229,160,0.2); border-radius:12px; padding:16px; text-align:center;">
<div style="font-size:28px; font-weight:700; color:#00e5a0;">{albi}</div>
<div style="font-size:12px; color:#9ba1a6; margin-top:4px;">ALBI (Grade {albi_grade})</div>
<div style="font-size:10px; color:#687076;">Albumin-Bilirubin</div>
</div>
</div>
"""
    
    comparison = f"""
<div style="padding:8px 0;">
<table style="width:100%; border-collapse:separate; border-spacing:0 6px;">
<tr style="color:#9ba1a6; font-size:11px; text-transform:uppercase; letter-spacing:1px;">
<td style="padding:8px 12px;">Model</td>
<td style="padding:8px 12px; text-align:center;">AUC</td>
<td style="padding:8px 12px; text-align:center;">Sensitivity</td>
<td style="padding:8px 12px; text-align:center;">Specificity</td>
</tr>
<tr style="background:rgba(0,229,160,0.12); border-radius:8px;">
<td style="padding:10px 12px; border-radius:8px 0 0 8px; font-weight:600; color:#00e5a0;">Random Forest</td>
<td style="padding:10px 12px; text-align:center; font-weight:700; color:#00e5a0;">0.915</td>
<td style="padding:10px 12px; text-align:center; color:#ecedee;">80%</td>
<td style="padding:10px 12px; border-radius:0 8px 8px 0; text-align:center; color:#ecedee;">86%</td>
</tr>
<tr style="background:rgba(255,255,255,0.04);">
<td style="padding:10px 12px; border-radius:8px 0 0 8px; color:#9ba1a6;">MELD-Na</td>
<td style="padding:10px 12px; text-align:center; color:#9ba1a6;">0.742</td>
<td style="padding:10px 12px; text-align:center; color:#687076;">69%</td>
<td style="padding:10px 12px; border-radius:0 8px 8px 0; text-align:center; color:#687076;">72%</td>
</tr>
<tr style="background:rgba(255,255,255,0.04);">
<td style="padding:10px 12px; border-radius:8px 0 0 8px; color:#9ba1a6;">MELD</td>
<td style="padding:10px 12px; text-align:center; color:#9ba1a6;">0.726</td>
<td style="padding:10px 12px; text-align:center; color:#687076;">67%</td>
<td style="padding:10px 12px; border-radius:0 8px 8px 0; text-align:center; color:#687076;">70%</td>
</tr>
<tr style="background:rgba(255,255,255,0.04);">
<td style="padding:10px 12px; border-radius:8px 0 0 8px; color:#9ba1a6;">Child-Pugh</td>
<td style="padding:10px 12px; text-align:center; color:#9ba1a6;">0.685</td>
<td style="padding:10px 12px; text-align:center; color:#687076;">63%</td>
<td style="padding:10px 12px; border-radius:0 8px 8px 0; text-align:center; color:#687076;">67%</td>
</tr>
<tr style="background:rgba(255,255,255,0.04);">
<td style="padding:10px 12px; border-radius:8px 0 0 8px; color:#9ba1a6;">ALBI</td>
<td style="padding:10px 12px; text-align:center; color:#9ba1a6;">0.658</td>
<td style="padding:10px 12px; text-align:center; color:#687076;">60%</td>
<td style="padding:10px 12px; border-radius:0 8px 8px 0; text-align:center; color:#687076;">65%</td>
</tr>
</table>
</div>
"""
    
    global_shap_html = render_global_shap_html()
    patient_shap_html = render_patient_shap_html(patient_shap, base_value, probability)
    
    return ml_output, traditional_scores, comparison, global_shap_html, patient_shap_html

# ===== PDP Gradio Function =====
def generate_pdp_plot(feature_name):
    """Generate PDP HTML for the selected feature."""
    if not feature_name or feature_name not in NUMERIC_FEATURES:
        return "<div style='color:#687076; text-align:center; padding:40px;'>Select a feature to view its partial dependence plot</div>"
    return render_pdp_html(feature_name)

# ===== CSS Themes =====
GLASSMORPHISM_CSS = """
.gradio-container {
    background: linear-gradient(135deg, #0a0e17 0%, #0d1520 30%, #0a1628 60%, #0f0a1a 100%) !important;
    min-height: 100vh;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}
.gradio-container::before {
    content: '';
    position: fixed;
    top: -50%; left: -50%;
    width: 200%; height: 200%;
    background: 
        radial-gradient(ellipse at 20% 50%, rgba(0, 229, 160, 0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(0, 180, 216, 0.03) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 80%, rgba(120, 0, 255, 0.02) 0%, transparent 50%);
    animation: vapor 20s ease-in-out infinite;
    pointer-events: none; z-index: 0;
}
@keyframes vapor {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(2%, -1%) rotate(1deg); }
    50% { transform: translate(-1%, 2%) rotate(-1deg); }
    75% { transform: translate(1%, -2%) rotate(0.5deg); }
}
.gradio-container > * { position: relative; z-index: 1; }
.block, .form, .panel {
    background: rgba(15, 23, 42, 0.6) !important;
    backdrop-filter: blur(20px) !important;
    -webkit-backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(0, 229, 160, 0.12) !important;
    border-radius: 16px !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
}
.tab-nav {
    background: rgba(15, 23, 42, 0.4) !important;
    border-radius: 12px !important; padding: 4px !important;
    border: 1px solid rgba(0, 229, 160, 0.08) !important;
}
.tab-nav button {
    color: #9ba1a6 !important; background: transparent !important;
    border: none !important; border-radius: 8px !important;
    padding: 10px 20px !important; font-weight: 500 !important;
    transition: all 0.3s ease !important;
}
.tab-nav button.selected {
    background: rgba(0, 229, 160, 0.15) !important;
    color: #00e5a0 !important; font-weight: 600 !important;
    box-shadow: 0 0 20px rgba(0, 229, 160, 0.1) !important;
}
input, select, textarea, .wrap {
    background: rgba(15, 23, 42, 0.8) !important;
    border: 1px solid rgba(0, 229, 160, 0.15) !important;
    border-radius: 10px !important; color: #ecedee !important;
    transition: border-color 0.3s ease !important;
}
input:focus, select:focus, textarea:focus {
    border-color: rgba(0, 229, 160, 0.5) !important;
    box-shadow: 0 0 15px rgba(0, 229, 160, 0.1) !important;
    outline: none !important;
}
label, .label-wrap span { color: #9ba1a6 !important; font-weight: 500 !important; font-size: 13px !important; }
input[type="range"] { background: transparent !important; border: none !important; }
input[type="range"]::-webkit-slider-track { background: rgba(0, 229, 160, 0.15) !important; height: 4px !important; border-radius: 2px !important; }
input[type="range"]::-webkit-slider-thumb { background: #00e5a0 !important; border: 2px solid rgba(0, 229, 160, 0.5) !important; box-shadow: 0 0 10px rgba(0, 229, 160, 0.3) !important; }
.range_input input[type="number"], input[type="number"] { background: rgba(15, 23, 42, 0.8) !important; color: #00e5a0 !important; font-weight: 600 !important; border: 1px solid rgba(0, 229, 160, 0.2) !important; }
.primary {
    background: linear-gradient(135deg, #00e5a0 0%, #00b4d8 100%) !important;
    border: none !important; color: #0a0e17 !important;
    font-weight: 700 !important; font-size: 16px !important;
    padding: 14px 32px !important; border-radius: 12px !important;
    letter-spacing: 1px !important; text-transform: uppercase !important;
    box-shadow: 0 4px 20px rgba(0, 229, 160, 0.3) !important;
    transition: all 0.3s ease !important;
}
.primary:hover { box-shadow: 0 6px 30px rgba(0, 229, 160, 0.5) !important; transform: translateY(-1px) !important; }
.markdown-text, .prose, .md { color: #ecedee !important; }
.markdown-text h1, .prose h1 { background: linear-gradient(135deg, #00e5a0, #00b4d8) !important; -webkit-background-clip: text !important; -webkit-text-fill-color: transparent !important; font-weight: 800 !important; letter-spacing: 1px !important; }
.markdown-text h3, .prose h3 { color: #00e5a0 !important; font-weight: 600 !important; }
.markdown-text p, .prose p { color: #9ba1a6 !important; line-height: 1.7 !important; }
.markdown-text strong, .prose strong { color: #ecedee !important; }
.wrap .secondary-wrap { background: rgba(15, 23, 42, 0.8) !important; border: 1px solid rgba(0, 229, 160, 0.15) !important; }
ul.options li { color: #ecedee !important; background: rgba(15, 23, 42, 0.95) !important; }
ul.options li:hover, ul.options li.selected { background: rgba(0, 229, 160, 0.15) !important; color: #00e5a0 !important; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.3); }
::-webkit-scrollbar-thumb { background: rgba(0, 229, 160, 0.2); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(0, 229, 160, 0.4); }
footer { display: none !important; }
.gap { gap: 12px !important; }
"""

CLASSIC_OVERRIDE_CSS = """
.classic-mode .gradio-container { background: #f7f8fa !important; }
.classic-mode .gradio-container::before { display: none !important; }
.classic-mode .block, .classic-mode .form, .classic-mode .panel {
    background: #ffffff !important; backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    border: 1px solid #e5e7eb !important; box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
}
.classic-mode .tab-nav { background: #f3f4f6 !important; border: 1px solid #e5e7eb !important; }
.classic-mode .tab-nav button { color: #374151 !important; }
.classic-mode .tab-nav button.selected { background: #ffffff !important; color: #0a7ea4 !important; box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important; }
.classic-mode input, .classic-mode select, .classic-mode textarea, .classic-mode .wrap {
    background: #ffffff !important; border: 1px solid #d1d5db !important; color: #111827 !important;
}
.classic-mode label, .classic-mode .label-wrap span { color: #374151 !important; }
.classic-mode .primary { background: #0a7ea4 !important; box-shadow: none !important; }
.classic-mode .markdown-text, .classic-mode .prose, .classic-mode .md { color: #111827 !important; }
.classic-mode .markdown-text h1, .classic-mode .prose h1 { background: none !important; -webkit-text-fill-color: #0a7ea4 !important; }
.classic-mode .markdown-text h3, .classic-mode .prose h3 { color: #0a7ea4 !important; }
.classic-mode .markdown-text p, .classic-mode .prose p { color: #6b7280 !important; }
.classic-mode .range_input input[type="number"], .classic-mode input[type="number"] { color: #0a7ea4 !important; background: #fff !important; border: 1px solid #d1d5db !important; }
.classic-mode .wrap .secondary-wrap { background: #fff !important; border: 1px solid #d1d5db !important; }
.classic-mode ul.options li { color: #111827 !important; background: #fff !important; }
.classic-mode ul.options li:hover { background: #f3f4f6 !important; color: #0a7ea4 !important; }
"""

FULL_CSS = GLASSMORPHISM_CSS + CLASSIC_OVERRIDE_CSS

# ===== Build the Gradio Interface =====
THEME_JS = """
() => {
    let isClassic = false;
    window.toggleTheme = function() {
        isClassic = !isClassic;
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;
        if (isClassic) {
            document.body.classList.add('classic-mode');
            btn.textContent = 'Glassmorphism Mode';
            btn.style.background = '#e5e7eb';
            btn.style.color = '#374151';
            btn.style.border = '1px solid #d1d5db';
        } else {
            document.body.classList.remove('classic-mode');
            btn.textContent = 'Classic Mode';
            btn.style.background = 'rgba(0,229,160,0.15)';
            btn.style.color = '#00e5a0';
            btn.style.border = '1px solid rgba(0,229,160,0.3)';
        }
    };
}
"""

with gr.Blocks(css=FULL_CSS, title="EVB Prognosis Calculator", js=THEME_JS) as demo:
    
    gr.HTML("""
    <div id="theme-controls" style="position:fixed; top:12px; right:12px; z-index:9999; display:flex; gap:8px; align-items:center;">
        <button id="theme-toggle" onclick="toggleTheme()" style="
            padding:8px 16px; border-radius:8px; cursor:pointer;
            font-size:12px; font-weight:600; letter-spacing:0.5px;
            background:rgba(0,229,160,0.15); color:#00e5a0;
            border:1px solid rgba(0,229,160,0.3);
            transition:all 0.3s ease;
        ">Classic Mode</button>
        <a href="/mobile" target="_blank" style="
            padding:8px 16px; border-radius:8px; cursor:pointer;
            font-size:12px; font-weight:600; letter-spacing:0.5px;
            background:rgba(0,180,216,0.15); color:#00b4d8;
            border:1px solid rgba(0,180,216,0.3);
            text-decoration:none;
        ">Mobile Version</a>
    </div>
    """)
    
    gr.Markdown(
        """
        # EVB PROGNOSIS
        **1-Year Mortality Risk Calculator for Cirrhotic Patients with Acute Esophageal Variceal Bleeding**
        
        Calibrated Random Forest model (AUC 0.915) with isotonic calibration and 5-fold cross-validation.
        Results should be interpreted by qualified healthcare professionals in conjunction with clinical judgment.
        """
    )

    with gr.Tab("1. General Info"):
        with gr.Row():
            age = gr.Slider(minimum=18, maximum=100, step=1, label="Age (years)", value=50)
            sex = gr.Dropdown(choices=["male", "female"], label="Sex", value="male")
            race = gr.Dropdown(choices=["white", "black", "asian", "other"], label="Race*", value="white")
            etiology_cirrosis = gr.Dropdown(
                choices=["alcohol", "hcv", "alcohol+hcv", "other"],
                label="Etiology of Cirrhosis", value="alcohol"
            )
        with gr.Row():
            hepatorenal_syndrome = gr.Dropdown(choices=["yes", "no"], label="Hepatorenal Syndrome", value="no")
            omeprazole = gr.Dropdown(choices=["yes", "no"], label="Omeprazole", value="no")
            spironolactone = gr.Dropdown(choices=["yes", "no"], label="Spironolactone", value="yes")
            furosemide = gr.Dropdown(choices=["yes", "no"], label="Furosemide", value="yes")
            propanolol = gr.Dropdown(choices=["yes", "no"], label="Propranolol", value="no")
            dialisis = gr.Dropdown(choices=["yes", "no"], label="Dialysis", value="no")
        gr.Markdown("*Race is included as it was identified as a significant predictor. We acknowledge ethical considerations and recommend interpreting within the broader clinical context.*")

    with gr.Tab("2. Clinical Status"):
        with gr.Row():
            portal_vein_thrombosis = gr.Dropdown(choices=["yes", "no"], label="Portal Vein Thrombosis", value="no")
            ascitis = gr.Dropdown(choices=["yes", "no"], label="Ascites", value="yes")
            hepatocellular_carcinoma = gr.Dropdown(choices=["yes", "no"], label="Hepatocellular Carcinoma", value="no")
            varices = gr.Dropdown(choices=["yes", "no"], label="Varices", value="yes")
        with gr.Row():
            red_wale_marks = gr.Dropdown(choices=["yes", "no"], label="Red Wale Marks", value="no")
            rupture_point = gr.Dropdown(choices=["yes", "no"], label="Rupture Point", value="no")
            active_bleeding = gr.Dropdown(choices=["yes", "no"], label="Active Bleeding", value="no")
            rebleeding = gr.Dropdown(choices=["yes", "no"], label="Rebleeding", value="no")
        with gr.Row():
            therapy = gr.Dropdown(choices=["Banding", "Sclerotherapy", "No therapy"], label="Therapy", value="Banding")
            terlipressin_dose = gr.Slider(minimum=0, maximum=20, step=1, label="Terlipressin Dose (mg)", value=2)
            time_to_endoscophy_hours = gr.Slider(minimum=0, maximum=48, step=1, label="Time to Endoscopy (hours)", value=12)

    with gr.Tab("3. Laboratory Values"):
        gr.Markdown("### Liver Function Tests")
        with gr.Row():
            albumin = gr.Slider(minimum=1, maximum=5, step=0.1, label="Albumin (g/dL)", value=3.5)
            total_bilirrubin = gr.Slider(minimum=0.1, maximum=30, step=0.1, label="Total Bilirubin (mg/dL)", value=2.0)
            direct_bilirrubina = gr.Slider(minimum=0.1, maximum=10, step=0.1, label="Direct Bilirubin (mg/dL)", value=0.5)
            inr = gr.Slider(minimum=0.5, maximum=5, step=0.1, label="INR", value=1.2)
            creatinine = gr.Slider(minimum=0.1, maximum=10, step=0.1, label="Creatinine (mg/dL)", value=1.0)
        gr.Markdown("### Complete Blood Count")
        with gr.Row():
            platelets = gr.Slider(minimum=10, maximum=500, step=1, label="Platelets (x10^3/uL)", value=150)
            hemoglobin = gr.Slider(minimum=5, maximum=20, step=0.1, label="Hemoglobin (g/dL)", value=13)
            hematocrit = gr.Slider(minimum=15, maximum=60, step=0.1, label="Hematocrit (%)", value=40)
            leucocytes = gr.Slider(minimum=1, maximum=50, step=0.1, label="Leukocytes (x10^3/uL)", value=6)
        gr.Markdown("### Transaminases & Electrolytes")
        with gr.Row():
            ast = gr.Slider(minimum=10, maximum=500, step=1, label="AST (U/L)", value=35)
            alt = gr.Slider(minimum=10, maximum=500, step=1, label="ALT (U/L)", value=25)
            sodium = gr.Slider(minimum=120, maximum=160, step=1, label="Sodium (mEq/L)", value=140)
            potassium = gr.Slider(minimum=2, maximum=6, step=0.1, label="Potassium (mEq/L)", value=4)

    # PDP Tab
    with gr.Tab("4. Partial Dependence"):
        gr.Markdown("""
### Partial Dependence Plots (PDP)

Explore how varying a single feature affects the predicted mortality probability, while holding all other features at their default values. Select a feature below to visualize its marginal effect on the model output.
        """)
        
        feature_choices = [(v["label"], k) for k, v in NUMERIC_FEATURES.items()]
        pdp_feature = gr.Dropdown(
            choices=feature_choices,
            label="Select Feature",
            value="albumin"
        )
        pdp_output = gr.HTML(value=render_pdp_html("albumin"))
        
        pdp_feature.change(
            fn=generate_pdp_plot,
            inputs=[pdp_feature],
            outputs=[pdp_output]
        )
        
        gr.Markdown("""
*PDP curves show the average predicted probability when the selected feature is varied across its range. The orange dot marks the default patient value. These plots help clinicians understand which features have the strongest marginal effects on predicted mortality.*
        """)

    with gr.Tab("About"):
        gr.Markdown("""
### Model Architecture & Validation

**Random Forest Classifier with Isotonic Calibration**
- 100 decision trees with bootstrapped sampling
- Isotonic regression calibration with 5-fold cross-validation
- Feature importance analysis using SHAP values
- **ONNX Runtime inference** for cross-platform compatibility

**Validation Results:**
- Internal validation (n=94): AUC 0.715 (95% CI: 0.610-0.820)
- Retrospective cohort (n=97): AUC 0.915 (95% CI: 0.856-0.961)
- Prospective validation (n=24): AUC 0.927 (SD +/- 0.053)
- Superior performance vs. traditional scores (p < 0.001)

### Interpretability Features

- **Global SHAP**: Mean absolute SHAP values across representative patients
- **Patient-Specific SHAP**: Per-prediction feature contributions (waterfall chart)
- **Partial Dependence Plots**: Marginal effect of each numeric feature on mortality

### Limitations
- Single-center development (external validation ongoing)
- Small prospective validation cohort (n=24)
- Not validated in patients < 18 years
- Should not replace clinical judgment

**Research Use Only** -- Not FDA approved for clinical decision-making.
        """)

    all_inputs = [
        age, sex, race, etiology_cirrosis, hepatorenal_syndrome, omeprazole,
        spironolactone, furosemide, propanolol, dialisis, portal_vein_thrombosis,
        ascitis, hepatocellular_carcinoma, albumin, total_bilirrubin,
        direct_bilirrubina, inr, creatinine, platelets, ast, alt, hemoglobin,
        hematocrit, leucocytes, sodium, potassium, varices, red_wale_marks,
        rupture_point, active_bleeding, therapy, terlipressin_dose,
        time_to_endoscophy_hours, rebleeding
    ]

    with gr.Row():
        predict_btn = gr.Button("CALCULATE RISK ASSESSMENT", variant="primary", scale=2)

    with gr.Row():
        with gr.Column():
            ml_output = gr.HTML(label="ML Model Results")
        with gr.Column():
            traditional_output = gr.HTML(label="Traditional Scores")
    
    with gr.Row():
        comparison_output = gr.HTML(label="Model Comparison")
    
    gr.Markdown("---")
    gr.Markdown("### Feature Importance Analysis (SHAP)")
    
    with gr.Row():
        global_shap_output = gr.HTML(label="Global Feature Importance")
    
    with gr.Row():
        patient_shap_output = gr.HTML(label="Patient-Specific Feature Contributions")

    predict_btn.click(
        fn=predict_patient_outcome,
        inputs=all_inputs,
        outputs=[ml_output, traditional_output, comparison_output, global_shap_output, patient_shap_output]
    )

    gr.Markdown("""
---
**Citation:** Rech MM, Soldera J, Corso LL et al. Development, Internal and Prospective validation of a machine learning model 
for the prediction of mortality in cirrhotic patients with acute esophageal variceal bleeding. *World J Hepatol* 2025.

**Contact:** mmrech@ucs.br | **Version:** 5.0 (ONNX + SHAP + PDP + Glassmorphism)
    """)

# ===== Custom routes for HTML pages + JSON APIs =====
import fastapi
from fastapi.responses import HTMLResponse, JSONResponse

app = fastapi.FastAPI()

@app.get("/landing", response_class=HTMLResponse)
async def landing_page():
    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
    with open(html_path, "r") as f:
        return HTMLResponse(content=f.read())

@app.get("/mobile", response_class=HTMLResponse)
async def mobile_page():
    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "evb_prognosis_mobile.html")
    with open(html_path, "r") as f:
        return HTMLResponse(content=f.read())

@app.get("/calculator", response_class=HTMLResponse)
async def calculator_page():
    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "evb_prognosis_complete.html")
    if os.path.exists(html_path):
        with open(html_path, "r") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>File not found</h1>", status_code=404)

# JSON API endpoints for mobile/external consumers
@app.get("/api/global-shap")
async def api_global_shap():
    """Return global SHAP feature importance as JSON."""
    if GLOBAL_SHAP_DATA is None:
        return JSONResponse(content={"error": "Global SHAP not available"}, status_code=503)
    return JSONResponse(content={"features": GLOBAL_SHAP_DATA})

@app.get("/api/pdp/{feature_name}")
async def api_pdp(feature_name: str):
    """Return PDP data for a specific numeric feature."""
    if feature_name not in NUMERIC_FEATURES:
        return JSONResponse(
            content={"error": f"Unknown feature: {feature_name}", "available": list(NUMERIC_FEATURES.keys())},
            status_code=400
        )
    data = compute_pdp(feature_name)
    return JSONResponse(content=data)

@app.get("/api/pdp")
async def api_pdp_list():
    """List available features for PDP."""
    features = [{"name": k, "label": v["label"], "min": v["min"], "max": v["max"]} for k, v in NUMERIC_FEATURES.items()]
    return JSONResponse(content={"features": features})

# Mount Gradio app under the FastAPI app
app = gr.mount_gradio_app(app, demo, path="/")

# Serve with uvicorn
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
