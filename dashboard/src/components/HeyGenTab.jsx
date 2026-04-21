import React, { useState, useEffect, useRef } from 'react';
import { User, Mic, Upload, Play, Video, Loader, Check, Download, AlertCircle } from 'lucide-react';
import { getApiUrl } from '../config';
import HeyGenVoiceSelector from './HeyGenVoiceSelector';

const POLL_INTERVAL = 3000;

function AvatarCard({ avatar, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[9/16] bg-zinc-900 ${
        selected ? 'border-primary shadow-lg shadow-primary/20' : 'border-white/10 hover:border-white/30'
      }`}
    >
      {avatar.preview_image_url ? (
        <img src={avatar.preview_image_url} alt={avatar.avatar_name || avatar.talking_photo_name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center"><User size={24} className="text-zinc-600" /></div>
      )}
      {selected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <Check size={12} className="text-white" />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 p-1.5">
        <p className="text-[10px] text-white truncate">{avatar.avatar_name || avatar.talking_photo_name}</p>
      </div>
    </button>
  );
}

export default function HeyGenTab({ heygenApiKey }) {
  const [avatars, setAvatars] = useState([]);
  const [talkingPhotos, setTalkingPhotos] = useState([]);
  const [voices, setVoices] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState(null); // {type, id}
  const [selectedVoice, setSelectedVoice] = useState('');
  const [mode, setMode] = useState('script'); // 'script' | 'lipsync'
  const [scriptText, setScriptText] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [userPhotoFile, setUserPhotoFile] = useState(null);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const headers = { 'X-HeyGen-Key': heygenApiKey };

  useEffect(() => {
    if (!heygenApiKey) return;
    Promise.all([
      fetch(getApiUrl('/api/heygen/avatars'), { headers }).then(r => r.json()),
      fetch(getApiUrl('/api/heygen/voices'), { headers }).then(r => r.json()),
    ]).then(([avatarData, voiceData]) => {
      setAvatars(avatarData.avatars || []);
      setTalkingPhotos(avatarData.talking_photos || []);
      const voiceList = voiceData.voices || [];
      setVoices(voiceList);
      if (voiceList.length > 0) setSelectedVoice(voiceList[0].voice_id);
    }).catch(err => setError(`Failed to load HeyGen data: ${err.message}`));
  }, [heygenApiKey]);

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
    if (mode === 'script' && !scriptText.trim()) return setError('Please enter a script');
    if (mode === 'script' && !selectedVoice) return setError('Please select a voice');
    if (mode === 'lipsync' && !audioFile) return setError('Please upload an audio file');

    setError(null);
    setIsLoading(true);
    setResult(null);
    setLogs([]);

    try {
      // Upload user photo if provided
      let talkingPhotoId = selectedAvatar.type === 'talking_photo' ? selectedAvatar.id : null;
      let avatarId = selectedAvatar.type === 'avatar' ? selectedAvatar.id : null;

      if (userPhotoFile) {
        const photoForm = new FormData();
        photoForm.append('file', userPhotoFile);
        const uploadRes = await fetch(getApiUrl('/api/heygen/upload'), { method: 'POST', headers, body: photoForm });
        if (!uploadRes.ok) throw new Error('Photo upload failed');
        const uploadData = await uploadRes.json();
        talkingPhotoId = uploadData.asset_id;
        avatarId = null;
      }

      // Upload audio for lip sync
      let audioAssetId = null;
      if (mode === 'lipsync' && audioFile) {
        const audioForm = new FormData();
        audioForm.append('file', audioFile);
        const audioRes = await fetch(getApiUrl('/api/heygen/upload'), { method: 'POST', headers, body: audioForm });
        if (!audioRes.ok) throw new Error('Audio upload failed');
        audioAssetId = (await audioRes.json()).asset_id;
      }

      const payload = {
        mode,
        avatar_id: avatarId,
        talking_photo_id: talkingPhotoId,
        script_text: mode === 'script' ? scriptText : null,
        voice_id: mode === 'script' ? selectedVoice : null,
        audio_asset_id: audioAssetId,
        background_color: backgroundColor,
      };

      const res = await fetch(getApiUrl('/api/heygen/generate'), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Generation request failed');
      const { job_id } = await res.json();
      setJobId(job_id);
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
    }
  };

  if (!heygenApiKey) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center glass-panel p-8 max-w-sm">
          <User size={40} className="text-zinc-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">HeyGen API Key Required</h2>
          <p className="text-sm text-zinc-500">Add your HeyGen API key in Settings to generate avatar videos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2"><User size={24} className="text-primary" /> Avatar Videos</h1>
          <p className="text-sm text-zinc-500 mt-1">Generate 9:16 avatar shorts with HeyGen — lip sync, custom voice, or your own photo</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1: Avatar selection */}
          <div className="glass-panel p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><User size={16} /> 1. Choose Avatar</h2>

            {/* Upload own photo */}
            <label className="block mb-4 cursor-pointer">
              <div className={`border-2 border-dashed rounded-xl p-3 text-center transition-colors ${userPhotoFile ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/30'}`}>
                {userPhotoFile ? (
                  <p className="text-xs text-primary"><Check size={12} className="inline mr-1" />{userPhotoFile.name}</p>
                ) : (
                  <p className="text-xs text-zinc-500"><Upload size={12} className="inline mr-1" />Use your own photo</p>
                )}
              </div>
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => { setUserPhotoFile(e.target.files[0] || null); setSelectedAvatar(null); }} />
            </label>

            {/* Predefined avatars */}
            {!userPhotoFile && (
              <>
                {talkingPhotos.length > 0 && (
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Talking Photos</p>
                )}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {talkingPhotos.map(tp => (
                    <AvatarCard key={tp.talking_photo_id} avatar={tp} selected={selectedAvatar?.id === tp.talking_photo_id} onClick={() => setSelectedAvatar({ type: 'talking_photo', id: tp.talking_photo_id })} />
                  ))}
                </div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Avatars</p>
                <div className="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
                  {avatars.map(av => (
                    <AvatarCard key={av.avatar_id} avatar={av} selected={selectedAvatar?.id === av.avatar_id} onClick={() => setSelectedAvatar({ type: 'avatar', id: av.avatar_id })} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Col 2: Voice & Script */}
          <div className="glass-panel p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Mic size={16} /> 2. Voice & Script</h2>

            {/* Mode toggle */}
            <div className="flex rounded-xl overflow-hidden border border-white/10 mb-4">
              {['script', 'lipsync'].map(m => (
                <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === m ? 'bg-primary text-white' : 'text-zinc-400 hover:text-white'}`}>
                  {m === 'script' ? '✍️ Script' : '🎙️ Lip Sync'}
                </button>
              ))}
            </div>

            {mode === 'script' ? (
              <>
                <label className="text-xs text-zinc-500 mb-1 block">Script</label>
                <textarea
                  value={scriptText}
                  onChange={e => setScriptText(e.target.value)}
                  rows={6}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-primary/50 mb-4"
                  placeholder="Write the script for your avatar to speak..."
                />
                <label className="text-xs text-zinc-500 mb-1 block">Voice</label>
                <HeyGenVoiceSelector voices={voices} value={selectedVoice} onChange={setSelectedVoice} />
              </>
            ) : (
              <>
                <label className="text-xs text-zinc-500 mb-1 block">Audio file (MP3 or WAV)</label>
                <label className="block cursor-pointer">
                  <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${audioFile ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-white/30'}`}>
                    {audioFile ? (
                      <p className="text-xs text-primary"><Check size={12} className="inline mr-1" />{audioFile.name}</p>
                    ) : (
                      <p className="text-xs text-zinc-500"><Upload size={14} className="inline mr-1" />Upload audio for lip sync</p>
                    )}
                  </div>
                  <input type="file" accept="audio/mpeg,audio/mp3,audio/wav" className="hidden" onChange={e => setAudioFile(e.target.files[0] || null)} />
                </label>
              </>
            )}

            <div className="mt-4">
              <label className="text-xs text-zinc-500 mb-1 block">Background Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
                <span className="text-xs text-zinc-400">{backgroundColor}</span>
              </div>
            </div>
          </div>

          {/* Col 3: Result */}
          <div className="glass-panel p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Video size={16} /> 3. Result</h2>

            {result ? (
              <div>
                <video src={result.video_url} controls className="w-full rounded-xl mb-3 aspect-[9/16] object-contain bg-black" />
                <a href={result.video_url} download className="btn-primary w-full flex items-center justify-center gap-2 py-2 text-sm">
                  <Download size={14} /> Download Video
                </a>
                {result.duration && <p className="text-xs text-zinc-500 mt-2 text-center">Duration: {result.duration.toFixed(1)}s</p>}
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <Loader size={24} className="text-primary animate-spin" />
                <p className="text-sm text-zinc-400">Generating avatar video...</p>
                {logs.length > 0 && <p className="text-xs text-zinc-600">{logs[logs.length - 1]}</p>}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-600">
                <Play size={32} className="mb-2" />
                <p className="text-sm">Your video will appear here</p>
              </div>
            )}

            {error && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Generate button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="btn-primary px-10 py-3 text-base font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <><Loader size={16} className="animate-spin" /> Generating...</> : <><Video size={16} /> Generate Avatar Video</>}
          </button>
        </div>
      </div>
    </div>
  );
}
