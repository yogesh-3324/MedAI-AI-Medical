import { useState, useRef } from "react";
import { generateDietPlan } from "../services/api";
import BackButton from "../components/common/BackButton";
import DietForm from "../components/Forms/DietForm";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function Diet() {
  const [form, setForm] = useState({ disease: "", symptoms: "", allergies: "" });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  
  const dietRef = useRef(null);

  const generate = async () => {
    if (!form.disease && !form.symptoms) { 
      showToast("Please enter your disease or symptoms.", "error"); 
      return; 
    }
    setLoading(true);
    setResult(null); // Clear previous result while loading
    try {
      const plan = await generateDietPlan(form, file);
      setResult(plan);
      showToast("Diet plan ready!", "success");
    } catch (err) { 
      showToast(err.message || "Failed to generate plan.", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSave = () => {
    showToast("Saved successfully", "success");
  };

  const downloadPDF = async () => {
    if (!dietRef.current) return;
    try {
      showToast("Generating PDF...", "info");
      const canvas = await html2canvas(dietRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save("MedAI_Diet_Plan.pdf");
      showToast("PDF Downloaded", "success");
    } catch (err) {
      console.error("PDF Generation Error:", err);
      showToast(`Failed to generate PDF: ${err.message || "Unknown error"}`, "error");
    }
  };

  // Convert nutrition to recharts data
  const renderNutritionChart = () => {
    if (!result?.nutrition) return null;
    const { carbs, protein, fats } = result.nutrition;
    const data = [
      { name: 'Carbs', value: parseInt(carbs) || 0 },
      { name: 'Protein', value: parseInt(protein) || 0 },
      { name: 'Fats', value: parseInt(fats) || 0 },
    ];

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
        <div className="section-label">Nutrition AI</div>
        <h2 style={{ fontSize: 36, color: "#0d1f2d" }}>Make My Diet</h2>
        <p style={{ color: "#4a6274", marginTop: 8 }}>
          Get a personalized diet plan tailored to your health condition.
        </p>
      </div>

      <DietForm form={form} setForm={setForm} file={file} setFile={setFile} />

      <button 
        className="btn-primary" 
        style={{ marginTop: 28, width: "100%", fontSize: 16, padding: "15px" }} 
        onClick={generate} 
        disabled={loading}
      >
        {loading ? <><span className="spinner" style={{ marginRight: 10 }} />Generating Plan…</> : "🥗 Make My Diet"}
      </button>

      {result && (
        <div className="slide-in" style={{ marginTop: 40 }}>
          
          {/* ACTION BUTTONS (Hidden from PDF) */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={handleSave} style={{ flex: 1, padding: "12px", background: "#e2e8f0" }}>
              💾 Save Plan
            </button>
            <button className="btn-secondary" onClick={generate} style={{ flex: 1, padding: "12px", background: "#fef3c7", color: "#b45309" }}>
              🔄 Regenerate
            </button>
            <button className="btn-secondary" onClick={downloadPDF} style={{ flex: 1, padding: "12px", background: "#dbeafe", color: "#1d4ed8" }}>
              📥 Download PDF
            </button>
          </div>

          {/* THE PLAN CONTAINER (Will be rendered to PDF) */}
          <div ref={dietRef} style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 24 }}>
            
            <h2 style={{ textAlign: "center", color: "#0d1f2d", margin: 0 }}>MedAI Diet Plan</h2>

            {/* SUMMARY CARD */}
            {result.summary && (
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 16, padding: 20 }}>
                <h3 style={{ marginTop: 0, marginBottom: 12, color: "#334155" }}>🟢 Summary</h3>
                <div style={{ display: "grid", gap: 8, fontSize: 15 }}>
                  <div><strong>Condition:</strong> {result.summary.disease}</div>
                  <div><strong>Goal:</strong> {result.summary.goal}</div>
                  <div><strong>Target Calories:</strong> {result.summary.calories}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {result.summary.tags?.map((tag, i) => (
                      <span key={i} style={{ background: "#dcfce7", color: "#166534", padding: "4px 10px", borderRadius: 999, fontSize: 13, fontWeight: 500 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* MEAL PLAN */}
            {result.meal_plan && (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 20 }}>
                <h3 style={{ marginTop: 0, marginBottom: 16, color: "#334155" }}>🍽️ Meal Plan</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", marginBottom: 6 }}>🌅 Breakfast</strong>
                    <ul style={{ margin: 0, paddingLeft: 20, color: "#475569" }}>
                      {result.meal_plan.breakfast?.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", marginBottom: 6 }}>☀️ Lunch</strong>
                    <ul style={{ margin: 0, paddingLeft: 20, color: "#475569" }}>
                      {result.meal_plan.lunch?.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", marginBottom: 6 }}>🌙 Dinner</strong>
                    <ul style={{ margin: 0, paddingLeft: 20, color: "#475569" }}>
                      {result.meal_plan.dinner?.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ color: "#0f172a", display: "block", marginBottom: 6 }}>🍎 Snacks</strong>
                    <ul style={{ margin: 0, paddingLeft: 20, color: "#475569" }}>
                      {result.meal_plan.snacks?.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* FOODS TO AVOID & RECOMMENDED */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "#fff5f5", border: "1.5px solid #fca5a5", borderRadius: 16, padding: 20 }}>
                <div style={{ fontWeight: 700, color: "#991b1b", marginBottom: 12, fontSize: 16 }}>❌ Avoid These</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.foods_to_avoid?.map(f => (
                    <div key={f} style={{ fontSize: 14, color: "#991b1b" }}>🔴 {f}</div>
                  ))}
                </div>
              </div>
              
              <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 16, padding: 20 }}>
                <div style={{ fontWeight: 700, color: "#166534", marginBottom: 12, fontSize: 16 }}>✅ Recommended</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.recommended_foods?.map(f => (
                    <div key={f} style={{ fontSize: 14, color: "#166534" }}>🟢 {f}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* NUTRITION RECOMMENDATION */}
            {result.nutrition && (
              <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 16, padding: 20 }}>
                <h3 style={{ marginTop: 0, marginBottom: 8, color: "#334155" }}>📊 Nutrition Target</h3>
                <p style={{ margin: 0, fontSize: 14, color: "#64748b" }}>Recommended daily macronutrient distribution.</p>
                {renderNutritionChart()}
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}