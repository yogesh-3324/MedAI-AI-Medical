import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { analyzeXrayImage, chatWithXray, analyzeXrayRisk } from "../services/api";
import BackButton from "../components/common/BackButton";
import ImageUpload from "../components/Upload/ImageUpload";

const RISK_CONFIG = {
  EMERGENCY: { color: "#dc2626", bg: "linear-gradient(135deg,#fef2f2,#fee2e2)", border: "#fecaca", emoji: "🚨", label: "EMERGENCY" },
  URGENT:    { color: "#d97706", bg: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "#fde68a", emoji: "⚠️",  label: "URGENT"    },
  SAFE:      { color: "#16a34a", bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "#bbf7d0", emoji: "✅", label: "SAFE"      },
};

export default function XrayAnalyzer({ showToast }) {
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState(null);
  const [activeTab, setActiveTab] = useState("patient");
  const [riskData, setRiskData]   = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);
  const imgRef        = useRef(null);
  const [imgNat, setImgNat]   = useState({ w: 1, h: 1 });
  const [imgRen, setImgRen]   = useState({ w: 0, h: 0 });

  const handleFile = f => {
    if (!f) return;
    setResult(null); setPreview(null); setRiskData(null); setChatHistory([]);
    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(f);
  };

  const analyze = async () => {
    if (!file) { showToast("Please upload an X-ray image first.", "error"); return; }
    setLoading(true); setChatHistory([]); setRiskData(null);
    try {
      const data = await analyzeXrayImage(file);
      if (data.error) throw new Error(data.error);
      setResult(data);
      showToast("Analysis complete!", "success");
    } catch (e) { showToast("Analysis failed: " + e.message, "error"); }
    finally { setLoading(false); }
  };

  const handleRiskAnalyze = async () => {
    setRiskLoading(true);
    try { setRiskData(await analyzeXrayRisk(result)); }
    catch { showToast("Risk analysis failed", "error"); }
    finally { setRiskLoading(false); }
  };

  const handleChatSubmit = async e => {
    e.preventDefault();
    if (!chatInput.trim() || !file) return;
    const msg = chatInput;
    const hist = [...chatHistory];
    setChatHistory([...hist, { role: "user", content: msg }]);
    setChatInput(""); setChatLoading(true);
    try {
      const data = await chatWithXray(file, msg, hist);
      setChatHistory(prev => [...prev, { role: "assistant", content: data.reply }]);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch { showToast("Chat failed.", "error"); setChatHistory(prev => prev.slice(0,-1)); }
    finally { setChatLoading(false); }
  };

  /* ── Bounding box overlay ── */
  const BoundingBox = () => {
    if (!result?.bounding_box || !preview) return null;
    const b = result.bounding_box;
    if ((!b.x1 && !b.x2) || b.label === "None" || (b.x2 - b.x1) < 8) return null;
    const sx = imgRen.w / imgNat.w, sy = imgRen.h / imgNat.h;
    const rx1 = b.x1*sx, ry1 = b.y1*sy, rw = (b.x2-b.x1)*sx, rh = (b.y2-b.y1)*sy;
    const isFracture = /fracture|break|cortical|crack|abnorm/i.test(b.label);
    const col = isFracture ? "#ef4444" : "#f59e0b";
    return (
      <div style={{ position:"absolute", top:ry1, left:rx1, width:rw, height:rh,
        border:`3px solid ${col}`, borderRadius:4, pointerEvents:"none",
        boxShadow:`0 0 0 2px rgba(255,255,255,0.5), 0 0 18px ${col}66`, zIndex:10 }}>
        <div style={{ position:"absolute", top:-26, left:-3, background:col, color:"#fff",
          padding:"2px 9px", fontSize:11, fontWeight:800, borderRadius:"4px 4px 0 0",
          whiteSpace:"nowrap", letterSpacing:0.5 }}>🔍 {b.label}</div>
        {/* Corner tick marks */}
        {[{top:-3,left:-3},{top:-3,right:-3},{bottom:-3,left:-3},{bottom:-3,right:-3}].map((pos,i)=>(
          <div key={i} style={{ position:"absolute", width:10, height:10,
            border:`3px solid ${col}`, borderRadius:2, ...pos }}/>
        ))}
      </div>
    );
  };

  const pv   = result?.patient_view  || {};
  const dv   = result?.doctor_view   || {};
  const conf = pv.confidence_score ?? 0;
  const confColor = conf >= 70 ? "#16a34a" : conf >= 45 ? "#d97706" : "#dc2626";
  const isAbnormal = pv.result_label && !/normal|no fracture|unremarkable|no finding|none/i.test(pv.result_label);

  const Section = ({ color, bg, border, label, children }) => (
    <div style={{ background:bg, border:`2px solid ${border}`, borderRadius:14, padding:"18px 20px", marginBottom:16 }}>
      <div style={{ fontSize:11, fontWeight:800, letterSpacing:1.2, color, marginBottom:10 }}>{label}</div>
      {children}
    </div>
  );

  const customLabel = (
    <>
      <div style={{ fontSize:48, marginBottom:12 }}>🩻</div>
      <p style={{ color:"#4a6274", fontWeight:500 }}>Drag & drop your X-ray here</p>
      <p style={{ color:"#9bb3b3", fontSize:13, marginTop:6 }}>JPG, PNG, DICOM supported</p>
    </>
  );

  return (
    <div className="xray-print-container" style={{ maxWidth:740, margin:"0 auto", padding:"48px 24px" }}>
      <style>{`
        @media print {
          body * { visibility:hidden }
          .xray-print-container, .xray-print-container * { visibility:visible }
          .xray-print-container { position:absolute; left:0; top:0; width:100%; padding:0!important }
          .no-print { display:none!important }
        }
        .xtab { padding:11px 28px; font-weight:700; border-radius:10px; flex:1; border:2px solid transparent; cursor:pointer; font-size:14px; transition:all .2s; }
        .xtab.on  { background:#0f172a; color:#fff; border-color:#0f172a; box-shadow:0 4px 12px rgba(15,23,42,.25); }
        .xtab.off { background:#f8fafc; color:#64748b; border-color:#e2e8f0; }
        .xtab.off:hover { border-color:#94a3b8; color:#334155; }
        .xbody { font-size:15px; line-height:1.78; color:#1e293b; }
      `}</style>

      <div className="no-print"><BackButton /></div>

      <div className="fade-up" style={{ marginBottom:36 }}>
        <div className="section-label no-print">Diagnostic Tool</div>
        <h2 style={{ fontSize:36, color:"#0d1f2d" }}>X-ray Analyzer</h2>
        <p className="no-print" style={{ color:"#4a6274", marginTop:8, lineHeight:1.7 }}>
          Upload your X-ray for AI-driven analysis — plain-language results for patients, clinical detail for doctors.
        </p>
      </div>

      <div className="no-print fade-up-1">
        <ImageUpload file={file} setFile={handleFile} preview={null} label={customLabel} />
      </div>

      {/* Image + bounding box */}
      {preview && (
        <div style={{ position:"relative", marginTop:20, display:"inline-block",
          maxWidth:"100%", borderRadius:12, overflow:"hidden",
          boxShadow:"0 4px 24px rgba(0,0,0,0.14)" }}>
          <img ref={imgRef} src={preview} alt="X-Ray"
            onLoad={e => {
              setImgNat({ w:e.target.naturalWidth,  h:e.target.naturalHeight });
              setImgRen({ w:e.target.offsetWidth,   h:e.target.offsetHeight  });
            }}
            style={{ display:"block", maxWidth:"100%", maxHeight:420 }}
          />
          {result && <BoundingBox />}
          {result && (
            <div style={{ position:"absolute", bottom:10, left:10,
              background: isAbnormal ? "rgba(220,38,38,0.88)" : "rgba(22,163,74,0.88)",
              color:"#fff", padding:"4px 12px", borderRadius:6, fontSize:12, fontWeight:700 }}>
              {isAbnormal ? "⚠️ Abnormality Detected" : "✅ No Major Finding"}
            </div>
          )}
        </div>
      )}

      {!result && (
        <button className="btn-primary fade-up-2 no-print"
          style={{ marginTop:24, width:"100%", fontSize:16, padding:"15px", opacity: !file ? 0.5 : 1 }}
          onClick={analyze} disabled={!file||loading}>
          {loading
            ? <><span className="spinner" style={{ marginRight:10 }}/>Running AI Pipeline…</>
            : "🔍 Analyze X-ray"}
        </button>
      )}

      {result && (
        <div className="fade-in" style={{ marginTop:28 }}>

          {/* Tabs */}
          <div className="no-print" style={{ display:"flex", gap:10, marginBottom:20 }}>
            <button className={`xtab ${activeTab==="patient"?"on":"off"}`} onClick={()=>setActiveTab("patient")}>🤒 For Patients</button>
            <button className={`xtab ${activeTab==="doctor" ?"on":"off"}`} onClick={()=>setActiveTab("doctor") }>🩺 For Doctors</button>
          </div>

          {/* ══ PATIENT VIEW ══ */}
          {activeTab === "patient" && (
            <div>
              {/* RESULT LABEL — bold, colored, front and centre */}
              <div style={{
                background: isAbnormal
                  ? "linear-gradient(135deg,#fef2f2,#fee2e2)"
                  : "linear-gradient(135deg,#f0fdf4,#dcfce7)",
                border:`2px solid ${isAbnormal?"#fca5a5":"#86efac"}`,
                borderRadius:16, padding:"20px 24px", marginBottom:16
              }}>
                <div style={{ fontSize:12, fontWeight:800, letterSpacing:1.2,
                  color: isAbnormal?"#b91c1c":"#15803d", marginBottom:8 }}>
                  🔍 RESULT
                </div>
                <div style={{ fontSize:22, fontWeight:900,
                  color: isAbnormal?"#dc2626":"#16a34a", marginBottom:12, letterSpacing:0.2 }}>
                  {pv.result_label || "Analysis Complete"}
                </div>
                <div className="xbody" style={{ color: isAbnormal?"#7f1d1d":"#14532d" }}>
                  {pv.result_detail || "No further detail available."}
                </div>
              </div>

              {/* LOCATION */}
              <Section color="#0369a1" bg="#f0f9ff" border="#bae6fd" label="📍 WHERE IS IT?">
                <div className="xbody">{pv.location || "Location not determined."}</div>
              </Section>

              {/* WHAT TO DO NEXT */}
              <Section color="#7c3aed" bg="linear-gradient(135deg,#faf5ff,#ede9fe)" border="#c4b5fd" label="✅ WHAT TO DO NEXT">
                <div className="xbody">{pv.what_to_do_next || "Please consult a doctor for guidance."}</div>
              </Section>

              {/* CONFIDENCE */}
              <Section color="#475569" bg="#fafafa" border="#e2e8f0" label="🎯 HOW CONFIDENT IS THE AI?">
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  <div style={{ flex:1, height:12, background:"#e2e8f0", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${conf}%`, background:confColor,
                      borderRadius:99, transition:"width .9s ease" }}/>
                  </div>
                  <span style={{ fontWeight:900, fontSize:22, color:confColor, minWidth:48 }}>{conf}%</span>
                </div>
                <div className="xbody" style={{ marginTop:10, fontSize:13, color:"#64748b" }}>
                  {conf>=70
                    ? "The AI is fairly confident about this result. Still, always confirm with a real doctor."
                    : conf>=45
                    ? "The AI sees something but isn't fully certain. Please see a doctor to be sure."
                    : "Low confidence — the AI recommends an in-person evaluation before drawing any conclusions."}
                </div>
              </Section>

              {/* DISCLAIMER */}
              <Section color="#b45309" bg="#fffbeb" border="#fde68a" label="⚠️ IMPORTANT DISCLAIMER">
                <div className="xbody" style={{ color:"#78350f" }}>
                  {pv.disclaimer || "This is an AI tool. Always consult a qualified doctor before making any medical decisions."}
                </div>
              </Section>
            </div>
          )}

          {/* ══ DOCTOR VIEW ══ */}
          {activeTab === "doctor" && (
            <div>
              {/* Metrics row */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
                {[
                  { label:"Confidence", value:`${dv.metrics?.confidence_score ?? conf}%`, color:confColor },
                  { label:"IoU",        value: dv.iou != null ? dv.iou.toFixed(2) : (dv.metrics?.iou_threshold ?? "—"), color:"#334155" },
                  { label:"Scan Type",  value: result.is_chest ? "Chest" : "Musculoskeletal", color:"#334155" },
                ].map(m=>(
                  <div key={m.label} style={{ background:"#f8fafc", border:"1.5px solid #e2e8f0", borderRadius:12, padding:"14px 16px" }}>
                    <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>📊 {m.label.toUpperCase()}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Observations */}
              <Section
                color={isAbnormal?"#c2410c":"#15803d"}
                bg={isAbnormal?"#fff7ed":"#f0fdf4"}
                border={isAbnormal?"#fed7aa":"#bbf7d0"}
                label="📌 CLINICAL OBSERVATIONS">
                <ul style={{ paddingLeft:20, margin:0 }}>
                  {(dv.observations||["No observations."]).map((o,i)=>(
                    <li key={i} className="xbody" style={{ marginBottom:8 }}>{o}</li>
                  ))}
                </ul>
              </Section>

              {/* Diagnosis grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
                <Section color="#1d4ed8" bg="#eff6ff" border="#bfdbfe" label="🧪 SUGGESTED DIAGNOSIS">
                  <div style={{ fontSize:16, fontWeight:700, color:"#1e3a8a", lineHeight:1.5 }}>
                    {dv.suggested_diagnosis || "N/A"}
                  </div>
                </Section>
                <Section color="#7e22ce" bg="#fdf4ff" border="#e9d5ff" label="📋 DIFFERENTIAL DIAGNOSES">
                  <div style={{ fontSize:14, color:"#581c87", lineHeight:1.75 }}>
                    {(dv.differential_diagnosis||[]).join(" • ") || "N/A"}
                  </div>
                </Section>
              </div>

              {/* Risk summary */}
              {dv.risk_summary && (
                <Section color="#b91c1c" bg="#fff7f7" border="#fecaca" label="🏥 CLINICAL RISK">
                  <div className="xbody">{dv.risk_summary}</div>
                </Section>
              )}

              {/* Limitations */}
              <Section color="#64748b" bg="#f8fafc" border="#e2e8f0" label="📎 LIMITATIONS">
                <div className="xbody" style={{ color:"#64748b", fontSize:13 }}>
                  {(dv.limitations||[]).join("  •  ")}
                </div>
              </Section>

              <button className="no-print" onClick={()=>window.print()}
                style={{ display:"flex", alignItems:"center", gap:8, background:"#f1f5f9",
                  color:"#475569", border:"1px solid #e2e8f0", borderRadius:10,
                  padding:"10px 18px", cursor:"pointer", fontSize:14, fontWeight:600 }}>
                📄 Download PDF Report
              </button>
            </div>
          )}

          {/* ══ RISK BUTTON / RESULT ══ */}
          <div style={{ marginTop:32 }}>
            {!riskData ? (
              <button
                onClick={handleRiskAnalyze}
                disabled={riskLoading}
                style={{
                  display:"flex", alignItems:"center", justifyContent:"center", gap:14,
                  width:"auto", padding:"18px 36px", borderRadius:16, border:"none",
                  cursor: riskLoading?"not-allowed":"pointer", fontSize:17, fontWeight:800,
                  color:"#fff", letterSpacing:0.3,
                  background: riskLoading
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)",
                  boxShadow: riskLoading ? "none" : "0 8px 28px rgba(124,58,237,0.35)",
                  transition:"all .25s",
                }}>
                {riskLoading
                  ? <><span className="spinner" style={{ borderColor:"rgba(255,255,255,.4)", borderTopColor:"#fff" }}/>Evaluating Risk…</>
                  : <><span style={{ fontSize:24 }}>⚡</span>Evaluate Risk Level</>
                }
              </button>
            ) : (
              (() => {
                const cfg = RISK_CONFIG[riskData.risk_level] || RISK_CONFIG.SAFE;
                return (
                  <div style={{ borderRadius:18, overflow:"hidden", border:`2px solid ${cfg.border}`,
                    boxShadow:"0 6px 24px rgba(0,0,0,0.10)" }}>
                    <div style={{ background:cfg.bg, padding:"22px 26px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div>
                          <div style={{ fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1, marginBottom:6 }}>
                            RISK ASSESSMENT
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <span style={{ fontSize:32 }}>{cfg.emoji}</span>
                            <span style={{ fontSize:30, fontWeight:900, color:cfg.color }}>{cfg.label}</span>
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:11, fontWeight:800, color:"#64748b", letterSpacing:1 }}>SEVERITY</div>
                          <div style={{ fontSize:36, fontWeight:900, color:cfg.color, lineHeight:1 }}>
                            {riskData.risk_probability}%
                          </div>
                        </div>
                      </div>
                      {riskData.risk_reason && (
                        <div style={{ marginTop:16, fontSize:14, color:"#374151", lineHeight:1.7,
                          borderTop:"1px solid rgba(0,0,0,0.07)", paddingTop:16 }}>
                          {riskData.risk_reason}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            )}
          </div>

          {/* ══ CHAT UI ══ */}
          <div className="no-print" style={{ marginTop:28, background:"#fff",
            border:"1px solid #e2e8f0", borderRadius:16, overflow:"hidden" }}>
            <div style={{ padding:"16px 20px", background:"#f8fafc",
              borderBottom:"1px solid #e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
              <span>💬</span>
              <h4 style={{ margin:0, color:"#0f172a", fontSize:15 }}>Chat about this X-Ray</h4>
            </div>
            <div style={{ padding:20, maxHeight:360, overflowY:"auto",
              display:"flex", flexDirection:"column", gap:14, background:"#fafafa" }}>
              {chatHistory.length === 0
                ? <div style={{ textAlign:"center", color:"#94a3b8", fontSize:14, padding:"20px 0" }}>
                    Ask anything — "What does this mean?", "Is it serious?", "What should I do?"
                  </div>
                : chatHistory.map((msg,i)=>(
                  <div key={i} style={{ alignSelf:msg.role==="user"?"flex-end":"flex-start", maxWidth:"85%" }}>
                    <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3, marginLeft:4 }}>
                      {msg.role==="user" ? "You" : "MedAI Assistant"}
                    </div>
                    <div style={{
                      background:msg.role==="user"?"#0f172a":"#fff",
                      color:msg.role==="user"?"#fff":"#334155",
                      padding:"11px 15px", fontSize:14, lineHeight:1.65,
                      borderRadius:msg.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
                      border:msg.role==="user"?"none":"1px solid #e2e8f0",
                      boxShadow:"0 2px 6px rgba(0,0,0,0.04)"
                    }}>
                      <ReactMarkdown components={{ p:"span" }}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ))
              }
              {chatLoading && (
                <div style={{ alignSelf:"flex-start", display:"flex", alignItems:"center", gap:8,
                  padding:"11px 15px", background:"#fff", borderRadius:"16px 16px 16px 4px",
                  border:"1px solid #e2e8f0", color:"#64748b", fontSize:14 }}>
                  <span className="spinner" style={{ borderColor:"#e2e8f0", borderTopColor:"#64748b" }}/> Thinking…
                </div>
              )}
              <div ref={chatBottomRef}/>
            </div>
            <form onSubmit={handleChatSubmit} style={{ padding:14, background:"#fff",
              borderTop:"1px solid #e2e8f0", display:"flex", gap:10 }}>
              <input type="text" placeholder="Ask a question about your X-ray…"
                value={chatInput} onChange={e=>setChatInput(e.target.value)}
                style={{ flex:1, padding:"11px 15px", borderRadius:8,
                  border:"1px solid #e2e8f0", fontSize:14, outline:"none" }}
                disabled={chatLoading}/>
              <button type="submit" className="btn-primary"
                style={{ padding:"0 22px", borderRadius:8, opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}
                disabled={chatLoading||!chatInput.trim()}>Send</button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}