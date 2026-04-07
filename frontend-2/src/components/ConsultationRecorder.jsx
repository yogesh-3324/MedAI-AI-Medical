import React, { useState, useRef, useEffect, useCallback } from 'react';

/* ─── tiny helpers ──────────────────────────────────────────────────────── */
const API = 'http://localhost:8000';

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/* ─── Recording state machine ────────────────────────────────────────────
   idle  →  recording  →  stopped  →  generating  →  done
   ──────────────────────────────────────────────────────────────────────── */

export default function ConsultationRecorder() {
  const [open,      setOpen]      = useState(false);
  const [phase,     setPhase]     = useState('idle');     // idle|recording|stopped|generating|done
  const [elapsed,   setElapsed]   = useState(0);
  const [transcript,setTranscript]= useState('');
  const [report,    setReport]    = useState('');
  const [error,     setError]     = useState('');
  const [micOk,     setMicOk]     = useState(true);

  const mediaRecRef  = useRef(null);
  const chunksRef    = useRef([]);
  const timerRef     = useRef(null);
  const recognRef    = useRef(null);
  const liveTextRef  = useRef('');

  /* ── reset all state when modal closes ── */
  const handleClose = useCallback(() => {
    stopEverything();
    setOpen(false);
    setPhase('idle');
    setElapsed(0);
    setTranscript('');
    setReport('');
    setError('');
  }, []);

  /* ── cleanup on unmount ── */
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

  /* ── Start Recording ── */
  async function startRecording() {
    setError('');
    liveTextRef.current = '';
    setTranscript('');
    chunksRef.current = [];
    setElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      /* MediaRecorder — for the audio blob (not strictly needed for this
         feature but kept for future transcription API upgrade) */
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(250);
      mediaRecRef.current = rec;

      /* Web Speech API — live transcript */
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        const sr = new SpeechRec();
        sr.continuous       = true;
        sr.interimResults   = true;
        sr.lang             = 'en-US';
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
          if (ev.error !== 'no-speech') {
            setError(`Speech recognition error: ${ev.error}`);
          }
        };
        sr.start();
        recognRef.current = sr;
      } else {
        setMicOk(false);
        setError('Your browser does not support live speech recognition. You can type the transcript below.');
      }

      /* timer */
      setPhase('recording');
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000);

    } catch (err) {
      setError('Microphone access denied. Please allow microphone permission and try again.');
    }
  }

  /* ── Stop Recording ── */
  function stopRecording() {
    stopEverything();
    /* finalise transcript */
    setTranscript(liveTextRef.current.trim());
    setPhase('stopped');
  }

  /* ── Generate Report ── */
  async function generateReport() {
    const text = transcript.replace(/\[.*?\]/g, '').trim(); // strip interim brackets
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
    } catch (err) {
      setError(`Report generation failed: ${err.message}`);
      setPhase('stopped');
    }
  }

  /* ── Download Report ── */
  function downloadReport() {
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Consultation_Report_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Trigger Button ── */}
      <button
        id="consultation-recorder-btn"
        onClick={() => setOpen(true)}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          padding:        '9px 16px',
          background:     'linear-gradient(135deg,#0a6e6e,#0d8a8a)',
          color:          '#fff',
          border:         'none',
          borderRadius:   12,
          fontSize:       13,
          fontWeight:     700,
          cursor:         'pointer',
          boxShadow:      '0 4px 14px rgba(10,110,110,.35)',
          transition:     'all .2s ease',
          fontFamily:     "'DM Sans',sans-serif",
          whiteSpace:     'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 20px rgba(10,110,110,.45)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';    e.currentTarget.style.boxShadow='0 4px 14px rgba(10,110,110,.35)'; }}
      >
        {/* mic icon */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8"  y1="23" x2="16" y2="23"/>
        </svg>
        Generate Consultation Report
      </button>

      {/* ── Modal Overlay ── */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
          style={{
            position:       'fixed', inset: 0, zIndex: 9999,
            background:     'rgba(13,31,45,0.65)',
            backdropFilter: 'blur(6px)',
            display:        'flex', alignItems: 'center', justifyContent: 'center',
            padding:        '16px',
          }}
        >
          <div style={{
            background:    '#fff',
            borderRadius:  24,
            width:         '100%',
            maxWidth:      700,
            maxHeight:     '90vh',
            overflowY:     'auto',
            boxShadow:     '0 32px 80px rgba(0,0,0,.28)',
            position:      'relative',
            animation:     'fadeUp .35s ease both',
          }}>
            {/* ── Header ── */}
            <div style={{
              padding:        '24px 28px 20px',
              borderBottom:  '1px solid #e8f0f0',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{
                  width:48, height:48, borderRadius:14,
                  background: phase === 'recording'
                    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                    : 'linear-gradient(135deg,#0a6e6e,#0d8a8a)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow: phase === 'recording' ? '0 0 0 6px rgba(239,68,68,.2)' : 'none',
                  transition: 'all .3s',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8"  y1="23" x2="16" y2="23"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:18, fontWeight:700, color:'#0d1f2d', fontFamily:"'DM Serif Display',serif" }}>
                    Consultation Report Generator
                  </div>
                  <div style={{ fontSize:13, color:'#4a6274', marginTop:2 }}>
                    Record or type a doctor–patient conversation
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                style={{ background:'transparent', border:'none', cursor:'pointer', color:'#4a6274', padding:8, borderRadius:8, lineHeight:0 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:20 }}>

              {/* ── Error banner ── */}
              {error && (
                <div style={{
                  background:'#fff5f5', border:'1.5px solid #fca5a5',
                  borderRadius:12, padding:'12px 16px',
                  color:'#991b1b', fontSize:13, lineHeight:1.5
                }}>
                  ⚠️ {error}
                </div>
              )}

              {/* ─────────────────────────────────
                  PHASE: idle
              ───────────────────────────────── */}
              {phase === 'idle' && (
                <div style={{ textAlign:'center', padding:'20px 0' }}>
                  <div style={{
                    width:96, height:96, borderRadius:'50%', margin:'0 auto 20px',
                    background:'linear-gradient(135deg,#e6f7f7,#c5eeee)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0a6e6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8"  y1="23" x2="16" y2="23"/>
                    </svg>
                  </div>
                  <div style={{ fontSize:16, fontWeight:600, color:'#0d1f2d', marginBottom:8 }}>
                    Ready to Record
                  </div>
                  <div style={{ fontSize:13, color:'#4a6274', marginBottom:28, lineHeight:1.6 }}>
                    Click Start Recording, then speak naturally. The AI will transcribe and generate a structured medical report.
                  </div>
                  <button className="btn-primary" onClick={startRecording} style={{ padding:'12px 36px', fontSize:15 }}>
                    Start Recording
                  </button>
                </div>
              )}

              {/* ─────────────────────────────────
                  PHASE: recording
              ───────────────────────────────── */}
              {phase === 'recording' && (
                <>
                  {/* Animated mic + timer */}
                  <div style={{ textAlign:'center' }}>
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:12,
                      background:'#fff5f5', border:'2px solid #fca5a5',
                      borderRadius:100, padding:'10px 24px',
                    }}>
                      {/* pulsing red dot */}
                      <span style={{
                        width:10, height:10, borderRadius:'50%', background:'#ef4444',
                        animation:'pulse .9s ease-in-out infinite',
                        display:'inline-block',
                      }}/>
                      <span style={{ fontWeight:700, color:'#991b1b', fontSize:15, letterSpacing:1 }}>
                        Recording {fmtTime(elapsed)}
                      </span>
                    </div>
                  </div>

                  {/* Live transcript */}
                  <div>
                    <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', color:'#4a6274', marginBottom:8 }}>
                      Live Transcript
                    </div>
                    <div style={{
                      background:'#f8fffe', border:'1.5px solid #c5eeee',
                      borderRadius:14, padding:'14px 16px',
                      minHeight:120, maxHeight:200, overflowY:'auto',
                      fontSize:14, lineHeight:1.7, color:'#0d1f2d',
                      fontFamily:"'DM Sans',sans-serif",
                    }}>
                      {transcript
                        ? transcript
                        : <span style={{ color:'#9bb3b3' }}>Listening… speak clearly near your microphone.</span>
                      }
                    </div>
                  </div>

                  <button
                    onClick={stopRecording}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                      background:'linear-gradient(135deg,#ef4444,#dc2626)',
                      color:'#fff', border:'none', borderRadius:12,
                      padding:'12px 32px', fontSize:15, fontWeight:700,
                      cursor:'pointer', boxShadow:'0 4px 14px rgba(239,68,68,.35)',
                      transition:'all .2s', fontFamily:"'DM Sans',sans-serif",
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2"/>
                    </svg>
                    Stop Recording
                  </button>
                </>
              )}

              {/* ─────────────────────────────────
                  PHASE: stopped  (review + edit)
              ───────────────────────────────── */}
              {phase === 'stopped' && (
                <>
                  <div style={{
                    background:'#f0fdf4', border:'1.5px solid #86efac',
                    borderRadius:12, padding:'10px 16px',
                    color:'#166534', fontSize:13, display:'flex', gap:8, alignItems:'center'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Recording stopped — {fmtTime(elapsed)} recorded. Review and edit the transcript below, then generate the report.
                  </div>

                  <div>
                    <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', color:'#4a6274', marginBottom:8 }}>
                      Transcript (editable)
                    </div>
                    <textarea
                      value={transcript}
                      onChange={e => setTranscript(e.target.value)}
                      rows={8}
                      placeholder="Transcript will appear here. You can also paste or type it manually..."
                      style={{
                        width:'100%', padding:'14px 16px',
                        border:'1.5px solid #c5eeee', borderRadius:14,
                        fontSize:14, lineHeight:1.7, fontFamily:"'DM Sans',sans-serif",
                        color:'#0d1f2d', background:'#f8fffe',
                        resize:'vertical', outline:'none', boxSizing:'border-box',
                      }}
                      onFocus={e=>{ e.target.style.borderColor='#0a6e6e'; }}
                      onBlur={e=>{  e.target.style.borderColor='#c5eeee'; }}
                    />
                  </div>

                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                    <button className="btn-primary" onClick={generateReport} style={{ flex:1, minWidth:180 }}>
                      Generate Medical Report
                    </button>
                    <button
                      onClick={() => { setPhase('idle'); setTranscript(''); setError(''); }}
                      className="btn-outline"
                      style={{ flex:1, minWidth:140 }}
                    >
                      Record Again
                    </button>
                  </div>
                </>
              )}

              {/* ─────────────────────────────────
                  PHASE: generating
              ───────────────────────────────── */}
              {phase === 'generating' && (
                <div style={{ textAlign:'center', padding:'32px 0' }}>
                  <div style={{
                    width:72, height:72, borderRadius:'50%', margin:'0 auto 20px',
                    background:'linear-gradient(135deg,#e6f7f7,#c5eeee)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    animation:'spin 1.2s linear infinite',
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0a6e6e" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  </div>
                  <div style={{ fontSize:16, fontWeight:600, color:'#0d1f2d', marginBottom:6 }}>
                    Generating Clinical Report...
                  </div>
                  <div style={{ fontSize:13, color:'#4a6274' }}>
                    AI is analysing the transcript and structuring the report.
                  </div>
                </div>
              )}

              {/* ─────────────────────────────────
                  PHASE: done — show report
              ───────────────────────────────── */}
              {phase === 'done' && report && (
                <>
                  <div style={{
                    background:'#f0fdf4', border:'1.5px solid #86efac',
                    borderRadius:12, padding:'10px 16px',
                    color:'#166534', fontSize:13, display:'flex', gap:8, alignItems:'center'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Report generated successfully.
                  </div>

                  <div>
                    <div style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', color:'#4a6274', marginBottom:8 }}>
                      Clinical Consultation Report
                    </div>
                    <div style={{
                      background:'#f8fffe', border:'1.5px solid #c5eeee', borderRadius:14,
                      padding:'20px', maxHeight:380, overflowY:'auto',
                      fontSize:13.5, lineHeight:1.85, color:'#0d1f2d',
                      fontFamily:"'DM Sans',sans-serif", whiteSpace:'pre-wrap',
                    }}>
                      {report}
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                    <button
                      onClick={downloadReport}
                      className="btn-primary"
                      style={{ flex:1, minWidth:180, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download Report
                    </button>
                    <button
                      onClick={() => { setPhase('idle'); setTranscript(''); setReport(''); setError(''); setElapsed(0); liveTextRef.current=''; }}
                      className="btn-outline"
                      style={{ flex:1, minWidth:140 }}
                    >
                      New Recording
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
