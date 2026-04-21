import React, { useState, useEffect, useRef } from 'react';
import { X, User, Loader, Check, Download, AlertCircle } from 'lucide-react';
import { getApiUrl } from '../config';
import HeyGenVoiceSelector from './HeyGenVoiceSelector';

const POLL_INTERVAL = 3000;

export default function HeyGenAvatarModal({ isOpen, onClose, transcript, heygenApiKey }) {
  const [avatars, setAvatars] = useState([]);
  const [talkingPhotos, setTalkingPhotos] = useState([]);
  const [voices, setVoices] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [scriptText, setScriptText] = useState(transcript || '');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const pollRef = useRef(null);

  const headers = { 'X-HeyGen-Key': heygenApiKey };

  // Reset state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setScriptText(transcript || '');
    setResult(null);
    setJobId(null);
    setStatus(null);
    setError(null);
    setLogs([]);
    setIsLoading(false);

    if (loaded || !heygenApiKey) return;
    Promise.all([
      fetch(getApiUrl('/api/heygen/avatars'), { headers }).then(r => r.json()),
      fetch(getApiUrl('/api/heygen/voices'), { headers }).then(r => r.json()),
    ]).then(([avatarData, voiceData]) => {
      const avList = avatarData.avatars || [];
      const tpList = avatarData.talking_photos || [];
      const voiceList = voiceData.voices || [];
      setAvatars(avList);
      setTalkingPhotos(tpList);
      setVoices(voiceList);
      if (!selectedAvatar && avList.length > 0) setSelectedAvatar({ type: 'avatar', id: avList[0].avatar_id });
      if (!selectedVoice && voiceList.length > 0) setSelectedVoice(voiceList[0].voice_id);
      setLoaded(true);
    }).catch(e => setError(`Failed to load HeyGen data: ${e.message}`));
  }, [isOpen]);

  useEffect(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/api/heygen/status/${jobId}`));
        const data = await res.json();
        setStatus(data.status);
        setLogs(data.logs || []);
        if (data.status === 'completed') {
          setResult(data.results?.[0] || null);
          setIsLoading(false);
          clearInterval(pollRef.current);
        } else if (data.status === 'failed') {
          setError(data.error || 'Generation failed');
          setIsLoading(false);
          clearInterval(pollRef.current);
        }
      } catch (e) {
        setError(e.message);
        setIsLoading(false);
        clearInterval(pollRef.current);
      }
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [jobId]);

  const handleGenerate = async () => {
    if (!selectedAvatar) return setError('Please select an avatar');
    if (!scriptText.trim()) return setError('Script is required');
    if (!selectedVoice) return setError('Please select a voice');

    setError(null);
    setIsLoading(true);
    setResult(null);
    setLogs([]);

    try {
      const payload = {
        mode: 'script',
        avatar_id: selectedAvatar.type === 'avatar' ? selectedAvatar.id : null,
        talking_photo_id: selectedAvatar.type === 'talking_photo' ? selectedAvatar.id : null,
        script_text: scriptText,
        voice_id: selectedVoice,
        background_color: backgroundColor,
      };
      const res = await fetch(getApiUrl('/api/heygen/generate'), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Request failed');
      const { job_id } = await res.json();
      setJobId(job_id);
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const allAvatars = [
    ...talkingPhotos.map(tp => ({ type: 'talking_photo', id: tp.talking_photo_id, name: tp.talking_photo_name, img: tp.preview_image_url })),
    ...avatars.map(av => ({ type: 'avatar', id: av.avatar_id, name: av.avatar_name, img: av.preview_image_url })),
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#111114] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
              <User size={16} className="text-primary" />
            </div>
            <h2 className="font-semibold">Recreate with HeyGen Avatar</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Script */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Script (editable)</label>
            <textarea
              value={scriptText}
              onChange={e => setScriptText(e.target.value)}
              rows={4}
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-primary/50"
              placeholder="Enter the script for your avatar..."
            />
          </div>

          {/* Avatar selector */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Avatar</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allAvatars.length === 0 && <p className="text-xs text-zinc-600">Loading avatars...</p>}
              {allAvatars.map(av => (
                <button
                  key={av.id}
                  onClick={() => setSelectedAvatar({ type: av.type, id: av.id })}
                  className={`shrink-0 w-16 h-24 rounded-lg overflow-hidden border-2 transition-all relative ${selectedAvatar?.id === av.id ? 'border-primary' : 'border-white/10 hover:border-white/30'}`}
                >
                  {av.img ? <img src={av.img} alt={av.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-zinc-900"><User size={16} className="text-zinc-600" /></div>}
                  {selectedAvatar?.id === av.id && (
                    <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <Check size={10} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Voice */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Voice</label>
            <HeyGenVoiceSelector voices={voices} value={selectedVoice} onChange={setSelectedVoice} />
          </div>

          {/* Background */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Background</label>
            <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2 w-fit">
              <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
              <span className="text-xs text-zinc-400">{backgroundColor}</span>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div>
              <video src={result.video_url} controls className="w-full rounded-xl aspect-[9/16] object-contain bg-black mb-2" />
              <a href={result.video_url} download className="btn-primary w-full flex items-center justify-center gap-2 py-2 text-sm">
                <Download size={14} /> Download Video
              </a>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <Loader size={14} className="animate-spin" />
              <span>{logs[logs.length - 1] || 'Generating...'}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !!result}
            className="btn-primary px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <><Loader size={14} className="animate-spin" /> Generating...</> : <><User size={14} /> Generate Avatar Video</>}
          </button>
        </div>
      </div>
    </div>
  );
}
