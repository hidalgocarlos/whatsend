const WAVEFORM = [4, 7, 10, 14, 9, 12, 16, 10, 7, 13, 11, 15, 8, 12, 10, 6, 14, 10, 8, 12, 9, 7, 11, 5];

function ReadTicks() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" fill="none" className="inline-block ml-0.5">
      <path d="M1 5.5L4.5 9L10 2" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5.5L8.5 9L14 2" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function AudioWaveform() {
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
        <svg width="14" height="16" viewBox="0 0 14 16" fill="white">
          <path d="M3 1v14M7 3v10M11 1v14M1 5v6M5 2v12M9 4v8M13 6v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <div className="flex items-end gap-px h-8 flex-1">
        {WAVEFORM.map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-300 rounded-full"
            style={{ height: `${(h / 16) * 100}%`, minHeight: 2 }}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400 ml-1 whitespace-nowrap">0:12</span>
    </div>
  );
}

/**
 * WhatsAppBubble — renderiza un preview visual tipo WhatsApp.
 *
 * Props:
 *   text        {string}  — texto del mensaje (whitespace-pre-wrap)
 *   mediaType   {'image'|'audio'|null}
 *   mediaSrc    {string|null}  — URL/objectURL de la imagen o audio
 *   empty       {boolean} — si true muestra un estado placeholder
 */
export default function WhatsAppBubble({ text, mediaType, mediaSrc, empty = false }) {
  const now = new Date();
  const time = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="bg-[#0b141a] rounded-2xl px-4 py-5 min-h-[160px] flex flex-col justify-end">
      {/* Barra superior simulada */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-emerald-500 flex-shrink-0" />
        <div>
          <p className="text-[11px] text-emerald-400 font-semibold leading-none">WhatSend</p>
          <p className="text-[10px] text-slate-500 mt-0.5">en línea</p>
        </div>
      </div>

      {/* Burbuja */}
      {empty ? (
        <div className="ml-auto max-w-[85%] bg-[#1f2c34] border border-dashed border-slate-600 rounded-2xl rounded-tr-sm px-4 py-3 flex items-center justify-center min-h-[60px]">
          <p className="text-slate-500 text-xs text-center">Completa el cuerpo para ver la vista previa</p>
        </div>
      ) : (
        <div className="ml-auto max-w-[85%] bg-white rounded-2xl rounded-tr-sm shadow-md overflow-hidden">
          {/* Media */}
          {mediaType === 'image' && mediaSrc && (
            <img
              src={mediaSrc}
              alt="adjunto"
              className="w-full max-h-48 object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          {mediaType === 'audio' && <AudioWaveform />}

          {/* Texto */}
          {text ? (
            <div className="px-3 pt-2 pb-1">
              <p className="text-sm text-[#111b21] whitespace-pre-wrap leading-relaxed">{text}</p>
            </div>
          ) : (
            mediaType !== 'audio' && (
              <div className="px-3 pt-2 pb-1">
                <p className="text-sm text-slate-400 italic">Sin texto</p>
              </div>
            )
          )}

          {/* Timestamp + ticks */}
          <div className="flex justify-end items-center gap-0.5 px-3 pb-2 pt-1">
            <span className="text-[10px] text-[#667781]">{time}</span>
            <ReadTicks />
          </div>
        </div>
      )}
    </div>
  );
}
