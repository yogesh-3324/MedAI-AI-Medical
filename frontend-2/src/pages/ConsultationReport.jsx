import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';

const API = 'http://localhost:8000';

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ─── Waveform bars animation ─────────────────────────────────────────────── */
function WaveBar({ delay }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 4,
      borderRadius: 4,
      background: '#ef4444',
      animation: `waveBar 0.9s ease-in-out ${delay}s infinite alternate`,
    }} />
  );
}

export default function ConsultationReportPage() {
  const navigate = useNavigate();

  // phase: idle | recording | stopped | generating | done
  const [phase,      setPhase]      = useState('idle');
  const [elapsed,    setElapsed]    = useState(0);
  const [transcript, setTranscript] = useState('');
  const [report,     setReport]     = useState('');
  const [error,      setError]      = useState('');

  const mediaRecRef = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);
  const recognRef   = useRef(null);
  const liveTextRef = useRef('');
  const reportRef   = useRef(null);

  useEffect(() => () => stopEverything(), []);

  function stopEverything() {
    clearInterval(timerRef.current);
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
    }
    if (recognRef.current) {
      try { recognRef.current.stop(); } catch (_) {}
    }
  }

  async function startRecording() {
    setError('');
    liveTextRef.current = '';
    setTranscript('');
    chunksRef.current   = [];
    setElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec    = new MediaRecorder(stream);
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(250);
      mediaRecRef.current = rec;

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        const sr = new SpeechRec();
        sr.continuous     = true;
        sr.interimResults = true;
        sr.lang           = 'en-US';
        sr.onresult = e => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const txt = e.results[i][0].transcript;
            if (e.results[i].isFinal) liveTextRef.current += txt + ' ';
            else interim = txt;
          }
          setTranscript(liveTextRef.current + (interim ? `[${interim}]` : ''));
        };
        sr.onerror = ev => {
          if (ev.error !== 'no-speech') setError(`Speech recognition error: ${ev.error}`);
        };
        sr.start();
        recognRef.current = sr;
      } else {
        setError('Live speech recognition not supported in this browser. Type the transcript manually below.');
      }

      setPhase('recording');
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000);
    } catch {
      setError('Microphone access denied. Please allow microphone permission and try again.');
    }
  }

  function stopRecording() {
    stopEverything();
    setTranscript(liveTextRef.current.trim());
    setPhase('stopped');
  }

  async function generateReport() {
    const text = transcript.replace(/\[.*?\]/g, '').trim();
    if (!text) {
      setError('No transcript found. Please record a conversation or type the transcript below.');
      return;
    }
    setError('');
    setPhase('generating');
    try {
      const res = await fetch(`${API}/api/consultation/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || 'Server error');
      }
      const data = await res.json();
      setReport(data.report);
      setPhase('done');
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (err) {
      setError(`Report generation failed: ${err.message}`);
      setPhase('stopped');
    }
  }

  /* ─── PDF Download using jsPDF ──────────────────────────────────────────── */
  function downloadPDF() {
    const pdf      = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW    = pdf.internal.pageSize.getWidth();
    const pageH    = pdf.internal.pageSize.getHeight();
    const marginL  = 48;
    const marginR  = 48;
    const marginT  = 56;
    const marginB  = 56;
    const contentW = pageW - marginL - marginR;
    let y          = marginT;

    const dateStr  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    /* ── Header bar ── */
    pdf.setFillColor(10, 110, 110);
    pdf.rect(0, 0, pageW, 38, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(255, 255, 255);
    pdf.text('MedAI — Clinical Consultation Report', marginL, 24);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`Generated: ${dateStr}`, pageW - marginR, 24, { align: 'right' });

    y = 58;

    /* ── Title ── */
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(13, 31, 45);
    pdf.text('Consultation Report', marginL, y);
    y += 10;
    pdf.setDrawColor(10, 110, 110);
    pdf.setLineWidth(1.5);
    pdf.line(marginL, y, pageW - marginR, y);
    y += 18;

    /* ── Body text — split by lines, detect section headers ── */
    const lines = report.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      /* page break check */
      if (y > pageH - marginB - 16) {
        pdf.addPage();
        /* re-draw thin header on continuation pages */
        pdf.setFillColor(10, 110, 110);
        pdf.rect(0, 0, pageW, 6, 'F');
        y = marginT;
      }

      if (!line) { y += 8; continue; }

      /* Detect section headers: lines ending with ":" and not starting with "-" or bullet */
      const isSectionHeader = /^[A-Z][^:]{2,60}:$/.test(line.trim()) ||
                              /^[A-Z][^:]{2,60}:\s*$/.test(line.trim());
      const isBullet        = /^[-•*]\s/.test(line.trim()) || /^\d+\.\s/.test(line.trim());

      if (isSectionHeader) {
        y += 10;
        /* coloured section label background */
        pdf.setFillColor(230, 247, 247);
        pdf.roundedRect(marginL - 6, y - 13, contentW + 12, 20, 3, 3, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(10, 110, 110);
        pdf.text(line.trim(), marginL, y);
        y += 14;
      } else if (isBullet) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(13, 31, 45);
        const bulletText = line.trim().replace(/^[-•*]\s/, '');
        const wrapped    = pdf.splitTextToSize(`• ${bulletText}`, contentW - 14);
        wrapped.forEach((wl, idx) => {
          if (y > pageH - marginB - 12) {
            pdf.addPage();
            pdf.setFillColor(10, 110, 110);
            pdf.rect(0, 0, pageW, 6, 'F');
            y = marginT;
          }
          pdf.text(wl, marginL + (idx === 0 ? 0 : 12), y);
          y += 15;
        });
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(74, 98, 116);
        const wrapped = pdf.splitTextToSize(line.trim(), contentW);
        wrapped.forEach(wl => {
          if (y > pageH - marginB - 12) {
            pdf.addPage();
            pdf.setFillColor(10, 110, 110);
            pdf.rect(0, 0, pageW, 6, 'F');
            y = marginT;
          }
          pdf.text(wl, marginL, y);
          y += 15;
        });
      }
    }

    /* ── Footer on last page ── */
    pdf.setFontSize(8);
    pdf.setTextColor(155, 179, 179);
    pdf.setFont('helvetica', 'italic');
    pdf.text(
      'DISCLAIMER: This report was generated by MedAI, an AI-powered assistant. It is not a substitute for professional medical advice.',
      pageW / 2, pageH - 24, { align: 'center', maxWidth: contentW }
    );

    pdf.save(`MedAI_Consultation_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function resetAll() {
    setPhase('idle');
    setTranscript('');
    setReport('');
    setError('');
    setElapsed(0);
    liveTextRef.current = '';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 0 64px' }}>

      {/* ── Wave bar keyframe injected inline ── */}
      <style>{`
        @keyframes waveBar {
          from { height: 8px; opacity:.5; }
          to   { height: 36px; opacity:1; }
        }
        @keyframes ripple {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,.35); }
          100% { box-shadow: 0 0 0 18px rgba(239,68,68,0); }
        }
      `}</style>

      {/* ── Back button ── */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#4a6274', fontSize: 13, fontWeight: 600,
          padding: '0 0 24px', fontFamily: "'DM Sans',sans-serif",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Back
      </button>

      {/* ── Hero Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0a6e6e 0%, #0d8a8a 60%, #0f9e9e 100%)',
        borderRadius: 24, padding: '40px 44px', marginBottom: 32,
        display: 'flex', alignItems: 'center', gap: 28,
        boxShadow: '0 16px 48px rgba(10,110,110,.25)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-60, right:80, width:160, height:160, borderRadius:'50%', background:'rgba(255,255,255,0.05)', pointerEvents:'none' }}/>

        <div style={{
          width: 72, height: 72, borderRadius: 20, flexShrink: 0,
          background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,.15)',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8"  y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div style={{ zIndex: 1 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', fontFamily: "'DM Serif Display',serif", marginBottom: 6 }}>
            Consultation Report Generator
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, maxWidth: 520 }}>
            Record a doctor–patient conversation in real time. Our AI transcribes and converts it into a structured, professional medical report — ready to download as PDF.
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{
          background: '#fff5f5', border: '1.5px solid #fca5a5', borderRadius: 14,
          padding: '14px 18px', marginBottom: 24,
          color: '#991b1b', fontSize: 13, lineHeight: 1.6,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0, marginTop:1 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* ══════════════════════════════════════
          STEP 1 — RECORD
      ══════════════════════════════════════ */}
      <div style={{
        background: '#fff', borderRadius: 20, padding: '32px 36px', marginBottom: 24,
        boxShadow: '0 4px 24px rgba(10,110,110,.07)',
        border: phase === 'recording' ? '2px solid rgba(239,68,68,.3)' : '1.5px solid #e8f0f0',
        transition: 'border .3s',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
          <div style={{
            width:32, height:32, borderRadius:10, flexShrink:0,
            background: phase === 'recording'
              ? 'linear-gradient(135deg,#ef4444,#dc2626)'
              : 'linear-gradient(135deg,#0a6e6e,#0d8a8a)',
            display:'flex', alignItems:'center', justifyContent:'center',
            transition: 'background .3s',
            animation: phase === 'recording' ? 'ripple 1.2s ease-out infinite' : 'none',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8"  y1="23" x2="16" y2="23"/>
            </svg>
          </div>
          <div style={{ fontSize:17, fontWeight:700, color:'#0d1f2d', fontFamily:"'DM Serif Display',serif" }}>
            Step 1 — Record Consultation
          </div>
          {phase === 'recording' && (
            <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
              {/* waveform bars */}
              <div style={{ display:'flex', alignItems:'flex-end', gap:3, height: 36 }}>
                {[0, .15, .3, .1, .25, .05, .2].map((d, i) => <WaveBar key={i} delay={d} />)}
              </div>
              <span style={{ fontWeight:700, color:'#ef4444', fontSize:15, letterSpacing:1, fontVariantNumeric:'tabular-nums' }}>
                {fmtTime(elapsed)}
              </span>
            </div>
          )}
          {phase === 'stopped' && (
            <span style={{ marginLeft:'auto', fontSize:13, color:'#22c55e', fontWeight:600 }}>
              ✓ {fmtTime(elapsed)} recorded
            </span>
          )}
        </div>

        {/* Controls */}
        {(phase === 'idle') && (
          <button className="btn-primary" onClick={startRecording} style={{ width:'100%', padding:'14px', fontSize:16 }}>
            🎙 Start Recording
          </button>
        )}

        {phase === 'recording' && (
          <button
            onClick={stopRecording}
            style={{
              width:'100%', padding:'14px', fontSize:16, fontWeight:700,
              background:'linear-gradient(135deg,#ef4444,#dc2626)',
              color:'#fff', border:'none', borderRadius:12, cursor:'pointer',
              boxShadow:'0 4px 16px rgba(239,68,68,.35)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              fontFamily:"'DM Sans',sans-serif", transition:'all .2s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
            Stop Recording
          </button>
        )}

        {/* Live transcript (recording phase) */}
        {phase === 'recording' && (
          <div style={{ marginTop:20 }}>
            <div className="section-label">Live Transcript</div>
            <div style={{
              background:'#f8fffe', border:'1.5px solid #c5eeee', borderRadius:14,
              padding:'16px', minHeight:100, maxHeight:180, overflowY:'auto',
              fontSize:14, lineHeight:1.8, color:'#0d1f2d',
            }}>
              {transcript
                ? transcript
                : <span style={{ color:'#9bb3b3', fontStyle:'italic' }}>Listening… speak clearly near your microphone.</span>
              }
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════
          STEP 2 — REVIEW + GENERATE
      ══════════════════════════════════════ */}
      {(phase === 'stopped' || phase === 'generating' || phase === 'done') && (
        <div style={{
          background: '#fff', borderRadius: 20, padding: '32px 36px', marginBottom: 24,
          boxShadow: '0 4px 24px rgba(10,110,110,.07)',
          border: '1.5px solid #e8f0f0',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:22 }}>
            <div style={{
              width:32, height:32, borderRadius:10,
              background:'linear-gradient(135deg,#f59e0b,#d97706)',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div style={{ fontSize:17, fontWeight:700, color:'#0d1f2d', fontFamily:"'DM Serif Display',serif" }}>
              Step 2 — Review Transcript
            </div>
          </div>

          <div className="section-label" style={{ marginBottom:8 }}>
            Transcript (you can edit before generating)
          </div>
          <textarea
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            rows={7}
            disabled={phase === 'generating' || phase === 'done'}
            placeholder="Transcript appears here. You can also paste or type it manually…"
            style={{
              width:'100%', padding:'16px', border:'1.5px solid #c5eeee',
              borderRadius:14, fontSize:14, lineHeight:1.75,
              fontFamily:"'DM Sans',sans-serif", color:'#0d1f2d',
              background: (phase==='generating'||phase==='done') ? '#f8fffe' : '#fafffe',
              resize:'vertical', outline:'none', boxSizing:'border-box',
              opacity: (phase==='generating'||phase==='done') ? .7 : 1,
            }}
            onFocus={e=>{ e.target.style.borderColor='#0a6e6e'; }}
            onBlur={e=>{  e.target.style.borderColor='#c5eeee'; }}
          />

          {phase === 'stopped' && (
            <div style={{ display:'flex', gap:12, marginTop:16, flexWrap:'wrap' }}>
              <button className="btn-primary" onClick={generateReport} style={{ flex:1, minWidth:200, padding:'13px', fontSize:15 }}>
                ✨ Generate Medical Report
              </button>
              <button className="btn-outline" onClick={resetAll} style={{ flex:1, minWidth:140 }}>
                Record Again
              </button>
            </div>
          )}

          {phase === 'generating' && (
            <div style={{
              marginTop:16, padding:'16px', background:'#f8fffe',
              border:'1.5px solid #c5eeee', borderRadius:14,
              display:'flex', alignItems:'center', gap:14, color:'#0a6e6e',
            }}>
              <div className="spinner" style={{ borderTopColor:'#0a6e6e', borderColor:'rgba(10,110,110,.2)' }}/>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>Generating Clinical Report…</div>
                <div style={{ fontSize:12, color:'#4a6274', marginTop:2 }}>AI is analysing the transcript and structuring the report.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          STEP 3 — REPORT OUTPUT
      ══════════════════════════════════════ */}
      {phase === 'done' && report && (
        <div ref={reportRef} style={{
          background:'#fff', borderRadius:20, padding:'32px 36px',
          boxShadow:'0 4px 24px rgba(10,110,110,.07)',
          border:'1.5px solid #c5eeee',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{
                width:32, height:32, borderRadius:10,
                background:'linear-gradient(135deg,#22c55e,#16a34a)',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div style={{ fontSize:17, fontWeight:700, color:'#0d1f2d', fontFamily:"'DM Serif Display',serif" }}>
                Step 3 — Clinical Report
              </div>
            </div>

            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <button
                onClick={downloadPDF}
                className="btn-primary"
                style={{ padding:'10px 22px', fontSize:14, display:'flex', alignItems:'center', gap:8 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PDF
              </button>
              <button className="btn-outline" onClick={resetAll} style={{ padding:'10px 20px', fontSize:14 }}>
                New Report
              </button>
            </div>
          </div>

          {/* Report preview — rendered with section headers highlighted */}
          <div style={{
            background:'#f8fffe', border:'1px solid #dff0f0', borderRadius:16,
            padding:'28px 30px', maxHeight:520, overflowY:'auto',
          }}>
            {report.split('\n').map((line, idx) => {
              const isSectionHeader = /^[A-Z][^:]{2,60}:\s*$/.test(line.trim());
              const isBullet        = /^[-•*]\s/.test(line.trim());
              if (!line.trim()) return <div key={idx} style={{ height:8 }} />;
              if (isSectionHeader) return (
                <div key={idx} style={{
                  fontWeight:700, fontSize:12, textTransform:'uppercase',
                  letterSpacing:'.08em', color:'#0a6e6e',
                  background:'linear-gradient(90deg,#e6f7f7,transparent)',
                  padding:'6px 10px', borderRadius:6, margin:'18px 0 6px',
                  borderLeft:'3px solid #0a6e6e',
                }}>
                  {line.trim()}
                </div>
              );
              if (isBullet) return (
                <div key={idx} style={{
                  display:'flex', gap:8, fontSize:13.5, lineHeight:1.75,
                  color:'#0d1f2d', padding:'2px 0 2px 4px',
                }}>
                  <span style={{ color:'#0a6e6e', fontWeight:700, flexShrink:0 }}>•</span>
                  <span>{line.trim().replace(/^[-•*]\s/, '')}</span>
                </div>
              );
              return (
                <p key={idx} style={{ fontSize:13.5, lineHeight:1.75, color:'#4a6274', margin:'2px 0' }}>
                  {line}
                </p>
              );
            })}
          </div>

          <div style={{
            marginTop:16, padding:'12px 16px',
            background:'#fffbeb', border:'1px solid #fde68a',
            borderRadius:10, fontSize:12, color:'#92400e', lineHeight:1.5,
          }}>
            ⚠️ <strong>Disclaimer:</strong> This report was generated by AI and is not a substitute for professional medical judgment. Always have reports verified by a licensed clinician.
          </div>
        </div>
      )}
    </div>
  );
}
