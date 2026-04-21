// lib/sounds.ts
let _ac: AudioContext | null = null;
const AC = () => { if (!_ac && typeof AudioContext !== "undefined") try { _ac = new AudioContext(); } catch {} return _ac; };

const beep = (f: number, d: number, t: OscillatorType = "square", v = 0.07) => {
  const a = AC(); if (!a) return;
  try {
    const g = a.createGain(), o = a.createOscillator();
    o.type = t; o.frequency.value = f;
    g.gain.setValueAtTime(v, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + d);
  } catch {}
};

export const sfx = {
  boot: () => [220,277,330,440,554,659,880].forEach((f,i) => setTimeout(() => beep(f, 0.12, "sawtooth", 0.09), i * 60)),
  hot:  (muted: boolean) => { if (!muted) { beep(523,0.08); setTimeout(()=>beep(659,0.08),90); setTimeout(()=>beep(784,0.14),180); } },
  click:(muted: boolean) => { if (!muted) beep(880, 0.04, "square", 0.05); },
};
