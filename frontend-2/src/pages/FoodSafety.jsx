import { useState } from "react";
import { checkFoodSafetyData } from "../services/api";
import BackButton from "../components/common/BackButton";
import FoodSafetyForm from "../components/Forms/FoodSafetyForm";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";
import ReactMarkdown from "react-markdown";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function FoodSafety() {
  const [foodText, setFoodText] = useState("");
  const [foodImage, setFoodImage] = useState(null);
  const [form, setForm] = useState({ disease: "", symptoms: "", allergies: "" });
  const [file, setFile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const check = async () => {
    if (!foodText && !foodImage) { 
      showToast("Please enter food name or upload an image.", "error"); 
      return; 
    }
    if (!form.disease && !form.symptoms) { 
      showToast("Please enter your disease or symptoms.", "error"); 
      return; 
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await checkFoodSafetyData(foodText, foodImage, form, file);
      setResult(data);
      showToast("Check complete!", "success");
    } catch (err) { 
      showToast(err.message || "Check failed.", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  // UI styling helpers based on verdict
  const getVerdictStyles = (verdict) => {
    if (verdict === "Safe") {
      return { bg: "#f0fdf4", border: "#86efac", icon: "✅", color: "#166534" };
    }
    if (verdict === "Slightly Unsafe") {
      return { bg: "#fffbeb", border: "#fde047", icon: "⚠️", color: "#854d0e" };
    }
    if (verdict === "Invalid") {
      return { bg: "#f8fafc", border: "#94a3b8", icon: "❓", color: "#334155" };
    }
    // Not Safe
    return { bg: "#fff5f5", border: "#fca5a5", icon: "❌", color: "#991b1b" };
  };

  const renderNutritionChart = () => {
    if (!result?.nutrition) return null;
    const { carbs, protein, fats } = result.nutrition;
    const data = [
      { name: 'Carbs', value: parseInt(carbs) || 0 },
      { name: 'Protein', value: parseInt(protein) || 0 },
      { name: 'Fats', value: parseInt(fats) || 0 },
    ].filter(d => d.value > 0);

    return (
      <div style={{ height: 260, width: "100%", marginTop: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={5}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Helper to prevent indented Markdown from rendering as <pre> code blocks
  const cleanMd = (str) => {
    if (!str) return "";
    return str.split('\n').map(line => line.trimStart()).join('\n');
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.type === "error" ? "#fee2e2" : toast.type === "success" ? "#dcfce7" : "#e0e7ff",
          color: toast.type === "error" ? "#b91c1c" : toast.type === "success" ? "#15803d" : "#4338ca",
          padding: "12px 24px", borderRadius: 8, fontWeight: 500, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)"
        }}>
          {toast.message}
        </div>
      )}
      
      <BackButton />
      
      <div className="fade-up" style={{ marginBottom: 36 }}>
        <div className="section-label">Food Safety AI</div>
        <h2 style={{ fontSize: 36, color: "#0d1f2d" }}>Is It Safe to Eat?</h2>
        <p style={{ color: "#4a6274", marginTop: 8 }}>
          Check if a meal is safe for your medical condition. Upload an image or describe it.
        </p>
      </div>

      <FoodSafetyForm 
        foodText={foodText} setFoodText={setFoodText} 
        foodImage={foodImage} setFoodImage={setFoodImage} 
        form={form} setForm={setForm} 
        file={file} setFile={setFile} 
      />

      <button className="btn-primary" style={{ marginTop: 28, width: "100%", fontSize: 16, padding: "15px" }} onClick={check} disabled={loading}>
        {loading ? <><span className="spinner" style={{ marginRight: 10 }} />Checking Safety…</> : "🍽️ Check Safety"}
      </button>

      {result && (
        <div className="slide-in" style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Main Verdict Card */}
          {(() => {
            const styles = getVerdictStyles(result.verdict);
            return (
              <div style={{ background: styles.bg, border: `2px solid ${styles.border}`, borderRadius: 16, padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 42 }}>{styles.icon}</span>
                  <div>
                    <div style={{ fontSize: 26, fontFamily: "'DM Serif Display',serif", fontWeight: 700, color: styles.color }}>{result.verdict}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: styles.color, opacity: 0.8, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Safety Rating</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: styles.color }}>{result.rating}<span style={{ fontSize: 18, fontWeight: 600, opacity: 0.7 }}>/10</span></div>
                </div>
              </div>
            );
          })()}

          {result.verdict === "Invalid" ? (
            <div style={{ background: "#fff5f5", border: "1px solid #fca5a5", borderRadius: 16, padding: 24 }}>
              <h3 style={{ marginTop: 0, marginBottom: 8, color: "#991b1b", display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚠️</span> Invalid Input Detected
              </h3>
              <p style={{ margin: 0, fontSize: 15, color: "#7f1d1d", lineHeight: 1.6 }}>
                {result.reason || "You entered an abstract or non-food item. Please write a valid meal or re-upload the image."}
              </p>
            </div>
          ) : (
            <>
              {/* Detailed Cards */}
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 16, padding: 24 }}>
                <h3 style={{ marginTop: 0, marginBottom: 8, color: "#334155", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🔍</span> Why?
                </h3>
                <div style={{ margin: 0, fontSize: 15, color: "#475569", lineHeight: 1.6 }} className="markdown-body">
                  <ReactMarkdown>{cleanMd(result.reason)}</ReactMarkdown>
                </div>
              </div>

              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 16, padding: 24 }}>
                <h3 style={{ marginTop: 0, marginBottom: 8, color: "#991b1b", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⚠️</span> If Consumed!
                </h3>
                <div style={{ margin: 0, fontSize: 15, color: "#7f1d1d", lineHeight: 1.6 }} className="markdown-body">
                  <ReactMarkdown>{cleanMd(result.risks)}</ReactMarkdown>
                </div>
              </div>

              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 16, padding: 24 }}>
                <h3 style={{ marginTop: 0, marginBottom: 8, color: "#166534", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>💡</span> What to Do Instead?
                </h3>
                <div style={{ margin: 0, fontSize: 15, color: "#14532d", lineHeight: 1.6 }} className="markdown-body">
                  <ReactMarkdown>{cleanMd(result.alternatives)}</ReactMarkdown>
                </div>
              </div>

              {/* Nutrition Chart */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 24 }}>
                <h3 style={{ marginTop: 0, marginBottom: 8, color: "#1e293b", textAlign: "center" }}>
                  📊 Nutritional Snapshot
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: "#64748b", textAlign: "center" }}>
                  Estimated macronutrient representation.
                </p>
                {renderNutritionChart()}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}