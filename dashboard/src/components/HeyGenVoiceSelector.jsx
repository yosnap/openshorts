import React, { useState, useMemo } from 'react';
import { Mic, Play, ChevronDown, Search, User } from 'lucide-react';

// HeyGen returns a flat voice list — we split "My Voices" by checking if the
// voice has no standard language tag or if it appears to be a cloned voice
// (HeyGen cloned voices typically have language === null or "Custom").
const isCustomVoice = (v) =>
  !v.language || v.language === 'Custom' || v.language === '';

export default function HeyGenVoiceSelector({ voices, value, onChange }) {
  const [langFilter, setLangFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [playingId, setPlayingId] = useState(null);

  // Separate custom (user) voices from standard voices
  const myVoices = useMemo(() => voices.filter(isCustomVoice), [voices]);
  const stdVoices = useMemo(() => voices.filter(v => !isCustomVoice(v)), [voices]);

  // All unique languages from standard voices
  const languages = useMemo(() => {
    const langs = [...new Set(stdVoices.map(v => v.language).filter(Boolean))].sort();
    return langs;
  }, [stdVoices]);

  // Filtered standard voices
  const filteredStd = useMemo(() => {
    return stdVoices.filter(v => {
      const matchLang = langFilter === 'all' || v.language === langFilter;
      const matchSearch = !search || v.name.toLowerCase().includes(search.toLowerCase());
      return matchLang && matchSearch;
    });
  }, [stdVoices, langFilter, search]);

  // Filtered custom voices
  const filteredCustom = useMemo(() => {
    return myVoices.filter(v =>
      !search || v.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [myVoices, search]);

  const selectedVoice = voices.find(v => v.voice_id === value);

  const handlePlay = (e, voice) => {
    e.stopPropagation();
    if (!voice.preview_audio) return;
    if (playingId === voice.voice_id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(voice.preview_audio);
    setPlayingId(voice.voice_id);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
  };

  const handleSelect = (voiceId) => {
    onChange(voiceId);
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white hover:border-white/20 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Mic size={14} className="text-zinc-400 shrink-0" />
          <span className="truncate">{selectedVoice ? selectedVoice.name : 'Select voice...'}</span>
          {selectedVoice?.language && (
            <span className="text-[10px] text-zinc-500 shrink-0">({selectedVoice.language})</span>
          )}
          {selectedVoice && isCustomVoice(selectedVoice) && (
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded shrink-0">My Voice</span>
          )}
        </div>
        <ChevronDown size={14} className={`text-zinc-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#1a1a1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {/* Search + Language filter */}
          <div className="p-2 border-b border-white/5 space-y-2">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search voices..."
                className="w-full bg-black/40 border border-white/5 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary/40 placeholder-zinc-600"
                autoFocus
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
              <button
                onClick={() => setLangFilter('all')}
                className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${langFilter === 'all' ? 'bg-primary text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
              >
                All
              </button>
              {languages.map(lang => (
                <button
                  key={lang}
                  onClick={() => setLangFilter(lang)}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${langFilter === lang ? 'bg-primary text-white' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Voice list */}
          <div className="max-h-64 overflow-y-auto">
            {/* My Voices section */}
            {filteredCustom.length > 0 && (
              <>
                <div className="px-3 py-1.5 flex items-center gap-1.5">
                  <User size={10} className="text-primary" />
                  <span className="text-[10px] text-primary font-medium uppercase tracking-wider">My Voices</span>
                </div>
                {filteredCustom.map(v => (
                  <VoiceRow key={v.voice_id} voice={v} selected={value === v.voice_id} onSelect={handleSelect} onPlay={handlePlay} playingId={playingId} isCustom />
                ))}
                {filteredStd.length > 0 && <div className="border-t border-white/5 my-1" />}
              </>
            )}

            {/* Standard voices */}
            {filteredStd.length > 0 && (
              <>
                {filteredCustom.length > 0 && (
                  <div className="px-3 py-1.5">
                    <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Standard Voices</span>
                  </div>
                )}
                {filteredStd.map(v => (
                  <VoiceRow key={v.voice_id} voice={v} selected={value === v.voice_id} onSelect={handleSelect} onPlay={handlePlay} playingId={playingId} />
                ))}
              </>
            )}

            {filteredStd.length === 0 && filteredCustom.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-6">No voices found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function VoiceRow({ voice, selected, onSelect, onPlay, playingId, isCustom }) {
  const isPlaying = playingId === voice.voice_id;
  return (
    <button
      type="button"
      onClick={() => onSelect(voice.voice_id)}
      className={`w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors text-left ${selected ? 'bg-primary/10' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-white truncate">{voice.name}</span>
          {isCustom && <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded shrink-0">Mine</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {voice.language && <span className="text-[10px] text-zinc-500">{voice.language}</span>}
          {voice.gender && <span className="text-[10px] text-zinc-600">{voice.gender}</span>}
        </div>
      </div>
      {voice.preview_audio && (
        <button
          type="button"
          onClick={(e) => onPlay(e, voice)}
          className={`shrink-0 ml-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isPlaying ? 'bg-primary text-white' : 'bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white'}`}
        >
          <Play size={10} className={isPlaying ? 'animate-pulse' : ''} />
        </button>
      )}
    </button>
  );
}
