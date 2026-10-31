// The web prescription stylesheet (chatbot/src/Component/common/
// PrescriptionDocument.css), copied rule for rule so the app's PDF is the
// same page as the web download. Only the @media blocks are left out: the web
// PDF is rendered at a fixed 1024px window, where none of them apply.
// Regenerate from the web file rather than editing by hand.
export const PRESCRIPTION_DOCUMENT_CSS = `
.prescription-document{--rx-ink:#183b3b;--rx-blue:#0f766e;--rx-red:#183b3b;--rx-line:#e2e8f0;--rx-sky:#f0fdfa;--rx-green:#fffbeb;--rx-lavender:#eef2ff;--rx-beige:#f1f5f9;box-sizing:border-box;width:100%;max-width:794px;min-height:1123px;margin:0 auto;padding:30px 30px 22px;display:flex;flex-direction:column;background:#fff;border:1px solid #d4d7db;color:var(--rx-ink);font:14px/1.45 Arial,Helvetica,sans-serif;isolation:isolate;position:relative}
.prescription-document *{box-sizing:border-box}
.prescription-document-header{display:grid;grid-template-columns:23% minmax(0,1fr) 21%;gap:16px;align-items:start;padding:0 0 15px;border-bottom:2px solid var(--rx-blue)}
.prescription-brand{align-self:center;text-align:center;padding-right:8px;min-width:0}
.prescription-brand img{display:block;width:100%;max-height:100px;object-fit:contain;margin:auto}
.prescription-brand>strong{display:block;margin-top:5px;font-size:15px;color:var(--rx-red);overflow-wrap:anywhere}
.prescription-issuer{border-left:1px solid var(--rx-blue);padding-left:14px;min-width:0}
.prescription-document .prescription-issuer h2{font:bold 19px/1.25 Arial,Helvetica,sans-serif;color:var(--rx-red);margin:0 0 4px}
.prescription-issuer p{font-size:12px;line-height:1.4;margin:2px 0;overflow-wrap:anywhere}
.prescription-doctor-contact{margin-top:6px;color:var(--rx-blue)}
.prescription-doctor-contact p{display:flex;gap:5px;align-items:flex-start}
.prescription-doctor-contact svg{width:12px;height:12px;flex-shrink:0;margin-top:2px}
.prescription-doctor-contact span{min-width:0;overflow-wrap:anywhere}
.prescription-reference{border-left:1px solid var(--rx-line);padding-left:10px;display:grid;gap:8px;min-width:0}
.prescription-reference>div{display:grid;gap:2px;font-size:11px;overflow-wrap:anywhere}
.prescription-reference span{font-weight:700;color:var(--rx-blue)}
.prescription-reference strong{font-weight:400}
.prescription-patient{display:grid;grid-template-columns:1.1fr 1fr;gap:0;margin:14px 0 13px;border:1px solid var(--rx-line)}
.prescription-patient-column{min-width:0;display:grid;align-content:start}
.prescription-patient-column+.prescription-patient-column{border-left:1px solid var(--rx-line)}
.prescription-patient-column>div{display:grid;grid-template-columns:100px minmax(0,1fr);gap:6px;padding:5px 8px;line-height:1.35;overflow-wrap:anywhere;font-size:12px}
.prescription-patient-column>div+div{border-top:1px solid #d5d8dc}
.prescription-patient-column span{font-weight:700}
.prescription-patient-column strong{font-weight:400}
.prescription-patient-column>div:first-child strong{font-weight:700}
.prescription-title{text-align:center;margin:2px 0 14px}
.prescription-document .prescription-title h3{margin:0;font:bold 18px/1.4 Arial,Helvetica,sans-serif;color:var(--rx-ink);text-transform:uppercase;text-decoration:underline;text-underline-offset:4px}
.prescription-section{min-width:0;margin:0 0 16px;break-inside:auto}
.prescription-document .prescription-section h3{font:bold 14px/1.4 Arial,Helvetica,sans-serif;color:var(--rx-ink);margin:0;padding:5px 9px;background:var(--rx-sky);border:1px solid var(--rx-line);break-after:avoid}
.prescription-section p{margin:0;font-size:13px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}
.prescription-document .prescription-clinical{display:grid;grid-template-columns:1fr 1fr;border:1px solid #cec5bc;background:var(--rx-beige);gap:0}
.prescription-clinical p{padding:7px 9px}
.prescription-clinical p+p{border-left:1px solid #cec5bc}
.prescription-table-wrap{width:100%;overflow-x:auto;border:1px solid var(--rx-line);border-top:0}
.prescription-document table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
.prescription-document th,.prescription-document td{padding:8px 6px;text-align:left;vertical-align:top;border-right:1px solid #c7cdd2;border-bottom:1px solid #c7cdd2;overflow-wrap:anywhere;line-height:1.5}
.prescription-document th{background:#eef4f6;color:var(--rx-blue);font-weight:700}
.prescription-document th:first-child{width:7%}
.prescription-document th:nth-child(2){width:36%}
.prescription-document th:nth-child(3){width:18%}
.prescription-document th:nth-child(4){width:15%}
.prescription-document th:last-child{width:24%}
.prescription-document th:last-child,.prescription-document td:last-child{border-right:0}
.prescription-document tr:last-child td{border-bottom:0}
.prescription-medicines>p{padding:9px;border:1px solid var(--rx-line);border-top:0}
.prescription-advice{display:block;border:1px solid var(--rx-line)}
.prescription-advice>.prescription-section-icon{display:none}
.prescription-document .prescription-advice h3{background:var(--rx-green);border:0;border-bottom:1px solid var(--rx-line)}
.prescription-advice p,.prescription-advice ul{margin:0;padding:9px 12px;font-size:13px;line-height:1.65}
.prescription-advice ul{padding-left:28px}
.prescription-advice li{overflow-wrap:anywhere}
.prescription-notes,.prescription-tests{border:1px solid var(--rx-line)}
.prescription-document .prescription-notes h3{background:var(--rx-beige);border:0;border-bottom:1px solid var(--rx-line)}
.prescription-document .prescription-tests h3{background:var(--rx-lavender);border:0;border-bottom:1px solid var(--rx-line)}
.prescription-notes>p,.prescription-tests>p{padding:9px 12px}
.prescription-tests>p+p{border-top:1px solid #e1dce6}
.prescription-document-footer{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;min-height:110px;padding:5px 0 16px}
.prescription-followup{display:flex;gap:8px;align-items:flex-start;padding-top:8px;max-width:50%}
.prescription-section-icon{width:20px;height:20px;flex-shrink:0;color:var(--rx-blue)}
.prescription-followup>div{display:grid;gap:5px}
.prescription-followup span{font-size:13px;font-weight:700}
.prescription-followup strong{font-size:12px;font-weight:400}
.prescription-signoff{text-align:center;max-width:47%;display:grid;gap:0;justify-items:center;overflow-wrap:anywhere}
.prescription-signature-space{height:46px;display:flex;align-items:flex-end;justify-content:center}
.prescription-signature-space img{display:block;max-width:145px;max-height:46px;width:auto;height:auto;object-fit:contain;object-position:center bottom}
.prescription-signoff>strong{margin-top:1px}
.prescription-signoff p{margin-top:2px}
.prescription-signoff>strong{font-size:14px;color:var(--rx-blue)}
.prescription-signoff p{font-size:11px;margin:0;line-height:1.4}
.prescription-contact-footer{border-top:1px solid var(--rx-blue);padding:7px 0 3px;text-align:center;color:var(--rx-blue);margin-top:auto}
.prescription-contact-footer p{margin:0;font-size:11px;line-height:1.5;overflow-wrap:anywhere}
.prescription-brand-footer{display:flex;justify-content:center;align-items:center;gap:9px;padding-top:7px;color:#59616c;font-size:9px}
.prescription-brand-footer>div{display:flex;align-items:center;gap:4px}
.prescription-brand-footer img{width:16px;height:16px;object-fit:contain}
.prescription-brand-footer strong{color:var(--rx-blue);font-size:11px;letter-spacing:1px}
.prescription-document>.prescription-watermark{position:absolute;left:50%;top:45%;width:320px;max-width:65%;height:auto;transform:translate(-50%,-50%);opacity:.055;pointer-events:none;z-index:0}
.prescription-document>:not(.prescription-watermark){position:relative;z-index:1}
.prescription-booking-qr{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-width:0;align-self:center;text-align:center;color:var(--rx-blue);font-size:11px;line-height:1.35}
.prescription-booking-qr img{width:100px;max-width:100%;height:auto;aspect-ratio:1;image-rendering:pixelated}
.prescription-document .prescription-patient-column>div{grid-template-columns:110px minmax(0,1fr)}
.prescription-document-header{grid-template-columns:140px minmax(0,1fr) 110px;gap:22px;align-items:center;border-bottom:2px solid #99ded5;padding-bottom:18px}
.prescription-brand{align-self:center;padding:0}
.prescription-brand img{width:96px;height:85px;max-height:none;transform:translateY(-6px)}
.prescription-brand>strong{color:#0f766e;font-size:13px;line-height:1.4;margin-top:2px}
.prescription-issuer{border-left:0;padding-left:0}
.prescription-document .prescription-issuer h2{color:#183b3b;font-size:22px;margin-bottom:7px}
.prescription-issuer p{color:#64748b;line-height:1.6}
.prescription-doctor-contact{color:#64748b}
.prescription-booking-qr{color:#0f766e;font-size:10px}
.prescription-booking-qr img{width:88px}
.prescription-patient{background:#f5f6f6;border:1px solid #cbd5e1;border-radius:0;padding:0}
.prescription-patient-column{grid-template-rows:repeat(5,minmax(30px,auto))}
.prescription-patient-column+.prescription-patient-column{border-left:1px solid #cbd5e1}
.prescription-patient-column>div+div{border-top:1px solid #cbd5e1}
.prescription-patient-column span{color:#64748b}
.prescription-document .prescription-title h3{color:#183b3b}
.prescription-document .prescription-clinical{border:1px solid #cbd5e1;background:#f0fdfa;gap:0}
.prescription-clinical p{background:#f0fdfa;border-radius:0}
.prescription-clinical p+p{background:#eef2ff;border-left:1px solid #cbd5e1}
.prescription-document .prescription-section h3{color:#183b3b}
.prescription-table-wrap{border:1px solid #cbd5e1;border-top:0}
.prescription-document th{background:#0f766e;color:#fff}
.prescription-document th,.prescription-document td{border-right:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1}
.prescription-document th:last-child,.prescription-document td:last-child{border-right:0}
.prescription-document tr:last-child td{border-bottom:0}
.prescription-advice,.prescription-notes,.prescription-tests{border:1px solid #cbd5e1;border-radius:0;padding:0;background:transparent}
.prescription-document .prescription-advice h3{background:#fffbeb;color:#b45309;border-bottom:1px solid #cbd5e1}
.prescription-document .prescription-notes h3{background:#f1f5f9;color:#64748b;border-bottom:1px solid #cbd5e1}
.prescription-document .prescription-tests h3{background:#eef2ff;color:#6366f1;border-bottom:1px solid #cbd5e1}
.prescription-contact-footer{border-color:#99ded5}
.prescription-document-header{grid-template-columns:120px minmax(0,1fr) 108px;gap:20px;padding:24px 20px 22px;align-items:center;background:linear-gradient(115deg,#f0fdfa 0%,#fff 65%);border:1px solid #cce7e2;border-top:5px solid #0f766e;border-bottom:3px solid #0f766e;border-radius:12px 12px 2px 2px}
.prescription-brand img{width:112px;height:100px;max-width:100%;object-fit:contain;transform:none}
.prescription-issuer{padding-left:20px;border-left:1px solid #cce7e2}
.prescription-issuer-label{display:block;margin-bottom:8px;color:#0f766e;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase}
.prescription-document .prescription-issuer h2{font-size:23px;line-height:1.25;letter-spacing:-.5px;overflow-wrap:anywhere;margin-bottom:6px}
.prescription-issuer p{font-size:12px;margin:3px 0}
.prescription-issuer .prescription-qualification{font-weight:700;color:#405f60}
.prescription-issuer .prescription-specialization{color:#0f766e}
.prescription-doctor-contact p{display:inline-flex;padding:5px 8px;margin-top:8px;background:#e7f4f1;border:1px solid #cce7e2;border-radius:5px;font-size:10px;color:#32645e}
.prescription-booking-qr{gap:7px;line-height:1.4;padding:9px 7px;background:#fff;border:1px solid #d9e9e5;border-radius:9px;font-size:9px;font-weight:600;color:#32645e}
.prescription-booking-qr:empty{display:none}
.prescription-booking-qr img{width:88px;padding:4px;background:#fff;border:1px solid var(--rx-line)}
.prescription-patient{display:block;margin:18px 0;background:#fff;border:1px solid #cbd5e1}
.prescription-patient-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));min-width:0}
.prescription-patient-row+.prescription-patient-row{border-top:1px solid #cbd5e1}
.prescription-patient-row>div{display:grid;grid-template-columns:108px minmax(0,1fr);align-content:start;gap:10px;padding:9px 12px;min-width:0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}
.prescription-patient-row>div+div{border-left:1px solid #cbd5e1}
.prescription-patient-row span{color:#64748b;font-weight:400}
.prescription-patient-row strong{font-weight:600;min-width:0}
.prescription-patient-row:first-child{background:#f0fdfa}
.prescription-patient-row-wide{grid-template-columns:minmax(0,1fr)}
.prescription-export{width:794px;background:#fff}
.prescription-export .prescription-document{width:794px;max-width:794px;min-height:0;padding:24px 26px 18px}
.prescription-export .prescription-document-header{grid-template-columns:100px minmax(0,1fr) 88px;gap:16px;padding:12px 14px}
.prescription-export .prescription-brand{grid-column:auto;justify-self:stretch;text-align:center}
.prescription-export .prescription-brand img{width:90px;height:72px;margin:auto}
.prescription-export .prescription-brand>strong{font-size:13px}
.prescription-export .prescription-issuer{padding-left:14px;border-left:1px solid #cce7e2}
.prescription-export .prescription-issuer h2{font-size:20px}
.prescription-export .prescription-issuer p{font-size:12px}
.prescription-export .prescription-issuer-label{font-size:9px;letter-spacing:1.8px}
.prescription-export .prescription-doctor-contact p{padding:5px 8px;font-size:10px}
.prescription-export .prescription-booking-qr{padding:5px;font-size:9px}
.prescription-export .prescription-booking-qr img{width:72px}
.prescription-export .prescription-patient-row>div{grid-template-columns:100px minmax(0,1fr);gap:8px;padding:5px 9px;font-size:12px}
.prescription-export .prescription-title h3{font-size:18px}
.prescription-export .prescription-document .prescription-clinical{grid-template-columns:1fr 1fr!important}
.prescription-export .prescription-clinical p+p{border-left:1px solid #cbd5e1;border-top:0}
.prescription-export .prescription-document table{font-size:12px}
.prescription-export .prescription-document th,.prescription-export .prescription-document td{padding:5px 6px;line-height:1.35}
.prescription-export .prescription-brand-footer{flex-wrap:nowrap;font-size:9px}
.prescription-document-header{grid-template-columns:100px minmax(0,1fr) 88px;gap:16px;padding:12px 14px}
.prescription-brand img{width:90px;height:72px}
.prescription-issuer{padding-left:14px}
.prescription-document .prescription-issuer h2{font-size:20px;margin-bottom:4px}
.prescription-issuer-label{margin-bottom:4px}
.prescription-issuer p{margin:2px 0;line-height:1.35}
.prescription-doctor-contact{margin-top:3px}
.prescription-doctor-contact p{margin-top:3px;padding:3px 6px}
.prescription-booking-qr{padding:5px;gap:3px}
.prescription-booking-qr img{width:72px}
.prescription-patient{margin:10px 0}
.prescription-patient-row>div{padding:5px 9px;gap:8px;line-height:1.35}
.prescription-title{margin:0 0 9px}
.prescription-section{margin-bottom:10px}
.prescription-document th,.prescription-document td{padding:5px 6px;line-height:1.35}
.prescription-clinical p{padding:5px 8px}
.prescription-advice p,.prescription-advice ul,.prescription-notes>p,.prescription-tests>p{padding-top:6px;padding-bottom:6px;line-height:1.45}
.prescription-document-footer{min-height:84px;padding:3px 0 10px}
`;
