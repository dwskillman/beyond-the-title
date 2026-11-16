/* GENERATED from the story-kit regions of builder/builder.html by tests/embed-fixtures.mjs. Do not edit by hand.
   The builder's own text tools (transcript parsing, name detection, quote, headline and description suggestions,
   zip), shared with the share page so both give identical results. No network, no storage, no DOM writes. */
(function () {
  'use strict';
/* ---- text-util ---- */
/* Pure text and time helpers. The story-kit regions are copied into site/js/story-kit.js by
   tests/embed-fixtures.mjs, so the employee site's share page uses exactly the same code. */
const TextUtil = {
  words(s) { return (String(s || '').match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) || []); },
  wordCount(s) { return TextUtil.words(s).length; },
  plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); },
  parseTs(s) {
    const m = String(s).trim().match(/^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})(?:[.,](\d{1,3}))?$/);
    if (!m) return null;
    const hh = m[1] ? +m[1] : 0, mm = +m[2], ss = +m[3];
    if (ss > 59 || (m[1] && mm > 59)) return null;
    const ms = m[4] ? +m[4].padEnd(3, '0') : 0;
    return hh * 3600 + mm * 60 + ss + ms / 1000;
  },
  /** Display form: 01:23 or 1:02:03 */
  clock(sec) {
    if (sec === null || sec === undefined || !isFinite(sec)) return '';
    const s = Math.floor(sec + 1e-6), hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    const p = (n) => String(n).padStart(2, '0');
    return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
  },
  /** Storage form: HH:MM:SS */
  hms(sec) {
    if (sec === null || sec === undefined || !isFinite(sec)) return null;
    const s = Math.floor(sec + 1e-6), p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
  },
};

/* ---- text ---- */
/* ==========================================================================
   Decode: bytes → text, reporting which encoding was used
   ========================================================================== */
const Decode = {
  decode(input) {
    const b = input instanceof Uint8Array ? input : new Uint8Array(input);
    let text, encoding;
    if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) { text = new TextDecoder('utf-8').decode(b.subarray(3)); encoding = 'UTF-8 (with BOM)'; }
    else if (b.length >= 2 && b[0] === 0xFF && b[1] === 0xFE) { text = new TextDecoder('utf-16le').decode(b.subarray(2)); encoding = 'UTF-16 LE'; }
    else if (b.length >= 2 && b[0] === 0xFE && b[1] === 0xFF) { text = new TextDecoder('utf-16be').decode(b.subarray(2)); encoding = 'UTF-16 BE'; }
    else {
      const guess = Decode.guessUtf16(b);
      if (guess) { text = new TextDecoder(guess).decode(b); encoding = guess === 'utf-16le' ? 'UTF-16 LE (no BOM)' : 'UTF-16 BE (no BOM)'; }
      else {
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(b); encoding = 'UTF-8'; }
        catch (e) { text = new TextDecoder('windows-1252').decode(b); encoding = 'Windows-1252 (fallback)'; }
      }
    }
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const ctrl = (text.match(/[\u0000-\u0008\u000E-\u001F]/g) || []).length;
    const binary = text.length > 0 && ctrl / text.length > 0.01;
    return { text, encoding, binary };
  },
  guessUtf16(b) {
    const n = Math.min(b.length, 4000); if (n < 8) return null;
    let even = 0, odd = 0;
    for (let i = 0; i < n; i++) if (b[i] === 0) (i % 2 ? odd++ : even++);
    const half = n / 2;
    if (odd > half * 0.3 && even < half * 0.05) return 'utf-16le';
    if (even > half * 0.3 && odd < half * 0.05) return 'utf-16be';
    return null;
  }
};

/* ==========================================================================
   Parser: pluggable transcript formats
   To support a new Socialive layout, add an entry to FORMATS with
   detect(lines, stats) → 0..1 and parse(lines) → segments.
   Segment: { start, end, startLabel, speaker, text, lineFrom, lineTo }
   ========================================================================== */
const Parser = (() => {
  const TS = '(?:\\d{1,2}:)?\\d{1,3}:\\d{2}(?:[.,]\\d{1,3})?';
  const NAME_PART = "\\p{Lu}(?:\\.|[\\p{L}\\p{M}'’\\-]*)";
  const NAME = `(?:[Ss]peaker\\s*\\d+|SPEAKER\\s*\\d+|${NAME_PART}(?:\\s+(?:${NAME_PART}|de|da|del|della|di|du|la|le|van|von|der|den|bin|al|y)){0,4})`;
  const CUE_RE = new RegExp(`^\\s*(${TS})\\s*-->\\s*(${TS})(?:\\s.*)?$`);
  const TS_LINE_RE = new RegExp(`^\\s*[\\[(]?(${TS})[\\])]?\\s*(?:[-–—|:]\\s+)?(.*)$`);
  const TS_ONLY_RE = new RegExp(`^\\s*[\\[(]?(${TS})[\\])]?\\s*:?\\s*$`);
  const HEADER_NAME_TS_RE = new RegExp(`^\\s*(${NAME})\\s*(?:[\\[(]\\s*(${TS})\\s*[\\])]|[-–—|]\\s*(${TS})|\\s(${TS}))\\s*:?\\s*$`, 'u');
  const HEADER_TS_NAME_RE = new RegExp(`^\\s*[\\[(]?(${TS})[\\])]?\\s*(?:[-–—|]\\s*)?(${NAME})\\s*:?\\s*$`, 'u');
  const NAME_ONLY_RE = new RegExp(`^\\s*(${NAME})\\s*:?\\s*$`, 'u');
  const SPEAKER_PREFIX_RE = new RegExp(`^(${NAME}|[Ii]nterviewer|[Hh]ost|[Mm]oderator|Q|A)\\s*:\\s+(\\S.*)$`, 'u');
  const GENERIC_SPEAKER_RE = /^(speaker\s*\d+|interviewer|host|moderator|q|a|unknown|speaker)$/i;
  const VTT_TAG_RE = /<\/?(?:v|c|i|b|u|ruby|rt|lang)(?:[.\s][^>]*)?>|<\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?>/g;

  const collapse = (s) => s.replace(/[\s ]+/g, ' ').trim();
  const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&lrm;|&rlm;/g, '');
  const nextNonEmpty = (lines, i) => { for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return j; return -1; };
  const isHeaderLine = (lines, i) => {
    const t = lines[i].trim();
    if (HEADER_NAME_TS_RE.test(t) || TS_ONLY_RE.test(t)) return true;
    if (HEADER_TS_NAME_RE.test(t)) { const j = nextNonEmpty(lines, i); return j > 0 && !TS_LINE_RE.test(lines[j].trim()) && !CUE_RE.test(lines[j].trim()); }
    return false;
  };

  function labelCounts(texts) {
    const counts = new Map();
    for (const t of texts) { const m = SPEAKER_PREFIX_RE.exec(t); if (m && m[1].length <= 40) counts.set(m[1], (counts.get(m[1]) || 0) + 1); }
    return counts;
  }
  function acceptedLabels(counts) {
    const ok = new Set();
    for (const [k, n] of counts) if (n >= 2 || GENERIC_SPEAKER_RE.test(k)) ok.add(k);
    return ok;
  }
  /** Pull "Name: " prefixes out of segment text, but only for labels that repeat (or are generic). */
  function applySpeakerPrefixes(segs) {
    if (segs.some((s) => s.speaker)) return segs;
    const ok = acceptedLabels(labelCounts(segs.map((s) => s.text)));
    if (!ok.size) return segs;
    for (const s of segs) { const m = SPEAKER_PREFIX_RE.exec(s.text); if (m && ok.has(m[1])) { s.speaker = m[1]; s.text = m[2].trim(); } }
    return segs;
  }

  function stats(lines) {
    const st = { nonEmpty: 0, cue: 0, index: 0, tsLine: 0, header: 0, prefixed: 0, webvtt: false };
    const plainTexts = [];
    lines.forEach((ln, i) => {
      const t = ln.trim(); if (!t) return;
      st.nonEmpty++;
      if (st.nonEmpty === 1 && /^WEBVTT\b/.test(t)) { st.webvtt = true; return; }
      if (CUE_RE.test(t)) { st.cue++; return; }
      if (/^\d+$/.test(t)) { const j = nextNonEmpty(lines, i); if (j > 0 && CUE_RE.test(lines[j].trim())) { st.index++; return; } }
      if (isHeaderLine(lines, i)) { st.header++; return; }
      const nm = NAME_ONLY_RE.exec(t); const j = nextNonEmpty(lines, i);
      if (nm && j > 0 && TS_ONLY_RE.test(lines[j].trim())) { st.header++; return; }
      const m = TS_LINE_RE.exec(t);
      if (m && m[2].trim()) { st.tsLine++; return; }
      plainTexts.push(t);
    });
    const ok = acceptedLabels(labelCounts(plainTexts));
    st.prefixed = plainTexts.filter((t) => { const m = SPEAKER_PREFIX_RE.exec(t); return m && ok.has(m[1]); }).length;
    return st;
  }

  /* ---------- formats ---------- */
  function parseCue(lines) {
    const segs = []; let i = 0, cur = null;
    if (/^WEBVTT\b/.test((lines[0] || '').trim())) { i = 1; while (i < lines.length && lines[i].trim() !== '') i++; }
    const push = () => {
      if (!cur) return;
      if (cur.lines.length) {
        let joined = cur.lines.join(' '), speaker = null;
        const v = joined.match(/<v(?:\.[^\s>]+)?\s+([^>]+)>/);
        if (v) speaker = collapse(v[1]);
        const text = collapse(decodeEntities(joined.replace(VTT_TAG_RE, '')));
        if (text) segs.push({ start: cur.start, end: cur.end, startLabel: cur.startLabel, speaker, text, lineFrom: cur.lineFrom, lineTo: cur.lineTo });
      }
      cur = null;
    };
    for (; i < lines.length; i++) {
      const t = lines[i].trim();
      const m = CUE_RE.exec(t);
      if (m) { push(); cur = { start: Util.parseTs(m[1]), end: Util.parseTs(m[2]), startLabel: m[1], lines: [], lineFrom: i, lineTo: i }; continue; }
      if (!t) { push(); continue; }
      if (!cur) {
        if (/^(NOTE|STYLE|REGION)\b/.test(t)) { while (i + 1 < lines.length && lines[i + 1].trim() !== '') i++; continue; }
        if (/^\d+$/.test(t)) { const j = nextNonEmpty(lines, i); if (j > 0 && CUE_RE.test(lines[j].trim())) continue; }
        // Stray text outside a cue: keep it (never drop words); attach to previous segment.
        const prev = segs[segs.length - 1];
        if (prev) { prev.text = collapse(prev.text + ' ' + decodeEntities(t.replace(VTT_TAG_RE, ''))); prev.lineTo = i; }
        else segs.push({ start: null, end: null, startLabel: null, speaker: null, text: collapse(t), lineFrom: i, lineTo: i });
        continue;
      }
      cur.lines.push(t); cur.lineTo = i;
    }
    push();
    return applySpeakerPrefixes(segs);
  }

  function parseTimestamped(lines) {
    const segs = []; let cur = null;
    const push = () => { if (cur && collapse(cur.text)) { cur.text = collapse(cur.text); segs.push(cur); } cur = null; };
    lines.forEach((ln, i) => {
      const t = ln.trim(); if (!t) return;
      const m = CUE_RE.test(t) ? null : TS_LINE_RE.exec(t);
      if (m) { push(); cur = { start: Util.parseTs(m[1]), end: null, startLabel: m[1], speaker: null, text: m[2] || '', lineFrom: i, lineTo: i }; return; }
      if (cur) { cur.text += ' ' + t; cur.lineTo = i; }
      else cur = { start: null, end: null, startLabel: null, speaker: null, text: t, lineFrom: i, lineTo: i };
    });
    push();
    return applySpeakerPrefixes(segs);
  }

  function parseBlocks(lines) {
    const segs = []; let cur = null;
    const push = () => { if (cur && cur.parts.length) segs.push({ start: cur.start, end: null, startLabel: cur.startLabel, speaker: cur.speaker, text: collapse(cur.parts.join(' ')), lineFrom: cur.lineFrom, lineTo: cur.lineTo }); cur = null; };
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim(); if (!t) continue;
      let m;
      if ((m = HEADER_NAME_TS_RE.exec(t))) { push(); const ts = m[2] || m[3] || m[4]; cur = { speaker: collapse(m[1]), start: Util.parseTs(ts), startLabel: ts, parts: [], lineFrom: i, lineTo: i }; continue; }
      if ((m = TS_ONLY_RE.exec(t))) { push(); cur = { speaker: null, start: Util.parseTs(m[1]), startLabel: m[1], parts: [], lineFrom: i, lineTo: i }; continue; }
      if ((m = HEADER_TS_NAME_RE.exec(t)) && isHeaderLine(lines, i)) { push(); cur = { speaker: collapse(m[2]), start: Util.parseTs(m[1]), startLabel: m[1], parts: [], lineFrom: i, lineTo: i }; continue; }
      const nm = NAME_ONLY_RE.exec(t), j = nextNonEmpty(lines, i);
      if (nm && j > 0 && TS_ONLY_RE.test(lines[j].trim())) {
        push(); const tm = TS_ONLY_RE.exec(lines[j].trim());
        cur = { speaker: collapse(nm[1]), start: Util.parseTs(tm[1]), startLabel: tm[1], parts: [], lineFrom: i, lineTo: j }; i = j; continue;
      }
      if (!cur) cur = { speaker: null, start: null, startLabel: null, parts: [], lineFrom: i, lineTo: i };
      cur.parts.push(t); cur.lineTo = i;
    }
    push();
    return applySpeakerPrefixes(segs);
  }

  function parseSpeakerLines(lines) {
    const ok = acceptedLabels(labelCounts(lines.map((l) => l.trim()).filter(Boolean)));
    const segs = []; let cur = null, lastSpeaker = null;
    const push = () => { if (cur && collapse(cur.text)) { cur.text = collapse(cur.text); segs.push(cur); lastSpeaker = cur.speaker; } cur = null; };
    lines.forEach((ln, i) => {
      const t = ln.trim();
      if (!t) { push(); return; }
      const m = SPEAKER_PREFIX_RE.exec(t);
      if (m && ok.has(m[1])) { push(); cur = { start: null, end: null, startLabel: null, speaker: m[1], text: m[2], lineFrom: i, lineTo: i }; return; }
      if (cur) { cur.text += ' ' + t; cur.lineTo = i; }
      else cur = { start: null, end: null, startLabel: null, speaker: lastSpeaker, text: t, lineFrom: i, lineTo: i };
    });
    push();
    return segs;
  }

  function parsePlain(lines) {
    const segs = []; let cur = null;
    const push = () => { if (cur) { cur.text = collapse(cur.text); if (cur.text) segs.push(cur); } cur = null; };
    lines.forEach((ln, i) => {
      const t = ln.trim();
      if (!t) { push(); return; }
      if (cur) { cur.text += ' ' + t; cur.lineTo = i; }
      else cur = { start: null, end: null, startLabel: null, speaker: null, text: t, lineFrom: i, lineTo: i };
    });
    push();
    return segs;
  }

  const FORMATS = [
    { id: 'cue', label: 'Caption cues (SRT/VTT style)', detect: (st) => {
        if (st.cue < 2) return 0;
        const textLines = Math.max(1, st.nonEmpty - st.cue - st.index - (st.webvtt ? 1 : 0));
        return Math.min(1, (st.cue / textLines) * 1.2 + (st.webvtt ? 0.2 : 0));
      }, parse: parseCue },
    { id: 'blocks', label: 'Speaker / timestamp blocks', detect: (st) => st.header >= 2 ? Math.min(1, (st.header / st.nonEmpty) * 2.5) : 0, parse: parseBlocks },
    { id: 'timestamped', label: 'Timestamped lines', detect: (st) => st.tsLine >= 2 ? st.tsLine / st.nonEmpty : 0, parse: parseTimestamped },
    { id: 'speakers', label: 'Speaker-labelled lines', detect: (st) => st.prefixed >= 2 ? st.prefixed / st.nonEmpty : 0, parse: parseSpeakerLines },
    { id: 'plain', label: 'Plain text', detect: () => 0.15, parse: parsePlain }
  ];

  function parse(text, override) {
    const norm = String(text).replace(/\r\n?/g, '\n').replace(/^﻿/, '');
    const lines = norm.split('\n');
    const st = stats(lines);
    const scores = {};
    for (const f of FORMATS) scores[f.id] = Math.round(f.detect(st) * 100) / 100;
    let fmt = FORMATS.find((f) => f.id === override);
    const auto = !fmt;
    if (!fmt) { fmt = FORMATS[FORMATS.length - 1]; let best = 0.3; for (const f of FORMATS) if (scores[f.id] > best) { best = scores[f.id]; fmt = f; } }
    const segments = fmt.parse(lines).map((s, i) => Object.assign(s, { i }));
    const speakers = new Map();
    for (const s of segments) if (s.speaker) { const v = speakers.get(s.speaker) || { name: s.speaker, words: 0, segments: 0 }; v.words += Util.wordCount(s.text); v.segments++; speakers.set(s.speaker, v); }
    const speakerList = [...speakers.values()].sort((a, b) => b.words - a.words);
    const nonGeneric = speakerList.filter((s) => !/^(interviewer|host|moderator|q)$/i.test(s.name));
    const defaultSpeaker = speakerList.length ? (nonGeneric[0] || speakerList[0]).name : null;
    const hasTimestamps = segments.some((s) => s.start !== null);
    const wordCount = segments.reduce((n, s) => n + Util.wordCount(s.text), 0);
    const warnings = [];
    if (!hasTimestamps) warnings.push('No timestamps found. Quotes will be saved without a time.');
    if (!speakerList.length) warnings.push('No speaker labels found. All text is treated as the employee speaking.');
    if (wordCount < 60) warnings.push('Very short transcript. There may not be enough material for good suggestions.');
    const confidence = auto ? (fmt.id === 'plain' ? (scores.plain >= Math.max(...Object.values(scores)) ? 0.5 : 0.3) : scores[fmt.id]) : 1;
    return { format: fmt.id, formatLabel: fmt.label, auto, confidence, scores, segments, speakers: speakerList, defaultSpeaker, hasTimestamps, wordCount, lineCount: lines.length, warnings };
  }

  /** Letters → x/X; digits, punctuation and line structure kept. For sharing the *format* without the content. */
  function maskedSample(text, maxLines = 30) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n').slice(0, maxLines);
    return lines.map((l) => { const m = l.replace(/\p{L}/gu, (c) => (c !== c.toLowerCase() ? 'X' : 'x')); return m.length > 140 ? m.slice(0, 140) + '…' : m; }).join('\n');
  }

  return { parse, maskedSample, FORMATS, GENERIC_SPEAKER_RE, SPEAKER_PREFIX_RE, CUE_RE, TS_LINE_RE };
})();

/** Consecutive segments by the same speaker joined into turns, with offset → segment maps. */
function buildTurns(segments) {
  const turns = []; let cur = null;
  segments.forEach((s, idx) => {
    if (!cur || cur.speaker !== s.speaker) { cur = { speaker: s.speaker, text: '', map: [], index: turns.length }; turns.push(cur); }
    const from = cur.text ? cur.text.length + 1 : 0;
    cur.text = cur.text ? cur.text + ' ' + s.text : s.text;
    cur.map.push({ seg: idx, from, to: cur.text.length });
  });
  return turns;
}
function segAt(turn, offset) {
  for (const m of turn.map) if (offset < m.to) return m.seg;
  return turn.map[turn.map.length - 1].seg;
}

/* ==========================================================================
   Analyzer: keyword-based heuristics (NOT AI). Transparent and explainable:
   every suggestion lists the patterns that triggered it.
   ========================================================================== */
const Analyzer = (() => {
  const THEMES = {
    pride: { label: 'Proud moment', tag: null, weight: 3, patterns: [/\bproud(est)?\b/, /\bfavou?rite\b/, /\bmeaningful\b/, /\brewarding\b/, /\bmeans? (a lot|so much|the world)\b/, /\bhighlight\b/, /\bstands? out\b/, /\bbest (part|day|days|thing|things|training)\b/, /\bpassionate\b/, /\bgrateful\b|\bthankful\b/, /\blove (it|that|this|working|being|helping|seeing)\b/, /\bnever forget\b|\bwill never forget\b|\bi'll never forget\b/] },
    accomplishment: { label: 'Accomplishment', tag: 'Accomplishment', weight: 2, patterns: [/\b(launched|built|created|designed|developed|delivered|implemented|founded|introduced|rolled out|shipped|completed|achieved|organized|rebuilt|redesigned|started)\b/, /\bi led\b|\bwe led\b|\bled the\b/, /\baward(ed|s)?\b|\brecogni[sz](ed|ition)\b/, /\bpromoted\b/, /\bwon\b/] },
    challenge: { label: 'Challenge', tag: 'Problem Solving', weight: 2, patterns: [/\bchalleng(e|es|ing)\b/, /\bdifficult\b/, /\bhard(est)? part\b|\bwas hard\b|\breally hard\b/, /\btough\b/, /\bstruggl(e|ed|ing)\b/, /\bobstacles?\b/, /\bproblems?\b/, /\bcomfort zone\b/, /\bwasn't easy\b/, /\bstuck\b/, /\bpressure\b|\bdeadlines?\b/, /\bgiving up\b/, /\bexhausted\b|\boverwhelm(ed|ing)\b/] },
    solution: { label: 'Solution', tag: 'Innovation', weight: 2, patterns: [/\bsolved\b|\bsolutions?\b/, /\bfigured out\b/, /\bcame up with\b/, /\bideas?\b/, /\bapproach\b/, /\bfixed\b/, /\bstreamlin(ed|ing)\b|\bautomat(ed|ing)\b|\bsimplif(ied|y)\b/, /\bturned (all of )?(that|it|this|them) into\b/, /\bwhat worked\b/, /\bso (i|we) (created|built|started|stopped|invited|made)\b/] },
    collaboration: { label: 'Collaboration', tag: 'Collaboration', weight: 1.5, patterns: [/\btogether\b/, /\bcollaborat\w*/, /\bpartner(ed|ing|s)?\b/, /\bcross[- ]functional\b|\bacross (teams|departments|groups)\b/, /\bteam(s|mates|work)?\b/, /\bcolleagues?\b/, /\bworked with\b/, /\bhelp(ed|ing)? each other\b/, /\bmentor\w*/] },
    learning: { label: 'Lesson learned', tag: 'Learning & Growth', weight: 2, patterns: [/\blearn(ed|t|ing)?\b/, /\blessons?\b/, /\brealiz(e|ed)\b/, /\btaught me\b/, /\bdiscover(ed)?\b/, /\bgrow(th)?\b/, /\bperspective\b/, /\bchanged (how|the way|everything|my)\b/, /\btakeaway\b|\btake away\b/] },
    outcome: { label: 'Outcome', tag: 'Impact', weight: 2.5, patterns: [/\bresults?\b/, /\bimpact\b/, /\bsaved\b/, /\breduc(ed|e|tion)\b|\bcut\b/, /\bincreas(ed|e)\b/, /\bdropped\b/, /\bfaster\b/, /\bpercent\b|%/, /\bmade a (big |real |huge )?difference\b/, /\boutcomes?\b/, /\bfrom (about |over |under |nearly )?[\w-]+( \w+)? to (under |about |fewer than |over |less than )?[\w-]+\b/, /\bstopped (about |over |nearly |more than )?(\d|one|two|three|four|five|six|seven|eight|nine|ten|dozens|hundreds|thousands)/, /\bnow (more than |over )?[\w-]+ (colleagues|people|teams|customers) use\b/] },
    surprise: { label: 'Surprising / personal', tag: 'Beyond Work', weight: 2, patterns: [/\bsurpris(ed|ing|e)\b/, /\bunexpected\b/, /\bnever thought\b/, /\bdidn't expect\b/, /\bfun fact\b/, /\boutside (of )?work\b/, /\bhobb(y|ies)\b/, /\bused to\b/, /\bgrew up\b/, /\bfirst time\b/, /\bmost people (don't|wouldn't)\b/, /\bvolunteer\w*/] }
  };
  const TOPIC_TAGS = [
    { tag: 'Onboarding', re: /\bonboard\w*|\bnew hires?\b/g }, { tag: 'Accessibility', re: /\baccessib\w*|\bscreen readers?\b/g },
    { tag: 'Fraud Prevention', re: /\bfraud\w*|\bscams?\b/g }, { tag: 'Mentorship', re: /\bmentor\w*/g },
    { tag: 'Customer Experience', re: /\bcustomers?\b|\bcallers?\b|\bclients?\b/g }, { tag: 'Data & Analytics', re: /\bdata\b|\banalytic\w*|\bforecast\w*/g },
    { tag: 'Automation', re: /\bautomat\w*/g }, { tag: 'Leadership', re: /\bi led\b|\bled the\b|\bas a manager\b|\bmy team\b|\bi manage\b/g },
    { tag: 'Process Improvement', re: /\bstreamlin\w*|\bsimplif\w*|\befficien\w*|\bquick reference\b|\breconciliation\b/g },
    { tag: 'Community', re: /\bvolunteer\w*|\bcommunity\b|\byouth program\b|\blocal\b/g }, { tag: 'Technology', re: /\bsoftware\b|\bengineer\w*|\bsystems?\b|\bapps?\b|\bplatform\b/g },
    { tag: 'Design', re: /\bdesign\w*/g }, { tag: 'Training', re: /\btraining\b|\bteach\w*|\bcoach\w*/g }, { tag: 'Reliability', re: /\breliab\w*|\bon-call\b|\bincidents?\b|\balert\w*/g }
  ];
  const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred|hundreds|thousand|thousands|million|half|twice|double|tripled?)\b/;
  const STOP = new Set(('a about above after again against all also am an and any are around as at back be because been before being below between both but by can could did do does doing down during each even every few for from further get got had has have having he her here hers him his how i if in into is it its just know like make made many me more most much my no nor not now of off on once only or other our ours out over own really right same she should so some still such than that the their theirs them then there these they thing things think this those through to too under until up us very was we well were what when where which while who whom why will with would yeah yes you your yours actually always basically every everyone going gonna kind lot lots maybe need okay pretty said say see sort sure take thank thanks time um uh way week weeks want went year years day days people first one two three new last next also able came come').split(' '));
  const MONTHS_DAYS = /^(January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|I|I'm|I've|I'd|I'll|OK|Okay)$/;
  const ABBR = /\b(?:Mr|Mrs|Ms|Dr|Jr|Sr|St|vs|etc|e\.g|i\.e|U\.S|a\.m|p\.m|No|Inc|Ltd|Co|approx|dept)\.$/i;

  function sentenceSpans(text) {
    const spans = []; let start = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '…') continue;
      let j = i + 1;
      while (j < text.length && /[.!?…"'”’)\]]/.test(text[j])) j++;
      if (j < text.length && !/\s/.test(text[j])) { i = j - 1; continue; }
      if (ch === '.' && ABBR.test(text.slice(Math.max(start, i - 6), i + 1))) continue;
      let k = j; while (k < text.length && /\s/.test(text[k])) k++;
      if (k < text.length && ch === '.' && /\p{Ll}/u.test(text[k])) { i = j - 1; continue; }
      spans.push([start, j]); start = k; i = k - 1;
    }
    if (start < text.length && text.slice(start).trim()) spans.push([start, text.length]);
    return spans;
  }
  function splitAtCommas(text, a, b) {
    if (Util.wordCount(text.slice(a, b)) <= 60) return [[a, b]];
    const out = []; let prev = a, acc = 0;
    const re = /,\s+/g; re.lastIndex = a; let m;
    while ((m = re.exec(text)) && m.index < b) {
      acc = Util.wordCount(text.slice(prev, m.index));
      if (acc >= 20 && Util.wordCount(text.slice(m.index, b)) >= 8) { out.push([prev, m.index + 1]); prev = m.index + m[0].length; }
    }
    out.push([prev, b]);
    return out;
  }
  /** Very long "sentences" (common in unpunctuated auto-transcripts) are split at segment boundaries, then commas. */
  function splitLong(turn, s, e) {
    if (Util.wordCount(turn.text.slice(s, e)) <= 60) return [[s, e]];
    const cuts = turn.map.map((m) => m.from).filter((f) => f > s && f < e);
    const parts = []; let prev = s;
    for (const c of cuts) {
      if (Util.wordCount(turn.text.slice(prev, c - 1)) >= 25 && Util.wordCount(turn.text.slice(c, e)) >= 8) { parts.push([prev, c - 1]); prev = c; }
    }
    parts.push([prev, e]);
    return parts.flatMap(([a, b]) => splitAtCommas(turn.text, a, b));
  }

  function buildUnits(turns, employeeSpeaker, hasSpeakers) {
    const units = [];
    for (const turn of turns) {
      const emp = !hasSpeakers || employeeSpeaker === null || turn.speaker === null || turn.speaker === employeeSpeaker;
      for (const [s0, e0] of sentenceSpans(turn.text)) {
        for (const [s, e] of splitLong(turn, s0, e0)) {
          let a = s, b = e;
          while (a < b && /\s/.test(turn.text[a])) a++;
          while (b > a && /\s/.test(turn.text[b - 1])) b--;
          if (b <= a) continue;
          const text = turn.text.slice(a, b);
          units.push({ idx: units.length, turn: turn.index, speaker: turn.speaker, emp, start: a, end: b, text, words: Util.wordCount(text), seg: segAt(turn, a) });
        }
      }
    }
    return units;
  }

  function scoreText(text) {
    const lc = text.toLowerCase().replace(/[’‘]/g, "'");
    const themes = {}; const reasons = []; let score = 0;
    for (const id of Object.keys(THEMES)) {
      const th = THEMES[id]; let hits = 0;
      for (const re of th.patterns) if (re.test(lc)) hits++;
      if (hits) { const pts = th.weight * (hits === 1 ? 1 : 1.5); themes[id] = pts; score += pts; reasons.push(th.label); }
    }
    const words = Util.wordCount(text);
    if (/\b(i|i'm|i've|i'd|my|me|we|we're|we've|our|us)\b/.test(lc)) score += 1;
    if (/\d/.test(text) || NUMBER_WORDS.test(lc)) { score += 1; reasons.push('Specific detail'); }
    if (/\b(the moment|that's when|one (time|day|call)|i remember|what (worked|surprised)|never forget)\b/.test(lc)) { score += 1; reasons.push('Story moment'); }
    if (words >= 10 && words <= 35) score += 1;
    else if (words < 6) score -= 2.5;
    else if (words < 8) score -= 1;
    else if (words > 60) score -= 3;
    else if (words > 45) score -= 1;
    if (/\?\s*["'”’)]*$/.test(text.trim())) score -= 4;
    const fillers = (lc.match(/\b(um+|uh+|erm|you know|i mean|sort of|kind of)\b/g) || []).length;
    if (fillers >= 2) score -= 1.5; else if (fillers === 1) score -= 0.5;
    if (/\b(my name is|thanks? (you )?(for|so much)|thank you|nice to (meet|be here)|can you hear)\b/.test(lc)) score -= 3;
    else if (/^(hi|hello|so )?,?\s*(i'm a|i am a|i work (in|on|at)|i've been (here|at|with))\b/.test(lc)) score -= 1.5;
    if (/^(?:hi|hello|hey|hola)?[,\s]*i['’]m \p{Lu}\p{L}+(?:\s\p{Lu}\p{L}+)?\b/u.test(text.trim())) score -= 2;
    let primary = 'general', best = 0;
    for (const id of Object.keys(themes)) if (themes[id] > best) { best = themes[id]; primary = id; }
    return { score: Math.round(score * 10) / 10, themes, reasons, primary };
  }

  function capitalPhrases(units, exclude) {
    const counts = new Map();
    for (const u of units) {
      const toks = u.text.split(/\s+/);
      let seq = [];
      const flush = () => { if (seq.length >= 2) { const p = seq.join(' '); if (!exclude.has(p.toLowerCase())) counts.set(p, (counts.get(p) || 0) + 1); } seq = []; };
      toks.forEach((raw, i) => {
        const tok = raw.replace(/^["“'(]+|[)"”'.,;:!?…]+$/g, '');
        const isCap = /^\p{Lu}[\p{L}\d&'’-]*$/u.test(tok) && !MONTHS_DAYS.test(tok.replace(/’/g, "'"));
        const sentenceStart = i === 0 || /[.!?…]["”']?$/.test(toks[i - 1]);
        const prev = (toks[i - 1] || '').toLowerCase().replace(/’/g, "'"), prev2 = (toks[i - 2] || '').toLowerCase();
        if (isCap && seq.length === 0 && (prev === "i'm" || (prev === 'am' && prev2 === 'i') || (prev === 'is' && prev2 === 'name'))) { flush(); return; } // self-introductions: a name, not a topic
        if (isCap && !(sentenceStart && seq.length === 0)) seq.push(tok); else flush();
        if (/[.,;:!?…]["”')]*$/.test(raw)) flush();
      });
      flush();
    }
    return counts;
  }

  const PROJECT_PATTERNS = [
    /\b(?:project|program|initiative|tool|platform|app|system|pilot)\s+(?:called|named|known as)\s+["“]?(\p{Lu}[\p{L}\d&'’-]*(?:\s+\p{Lu}[\p{L}\d&'’-]*){0,4})/u,
    /\b(?:called|named)\s+["“]([^"”]{3,40})["”]/u,
    /\b(?:most proud of|proudest of)\s+(?:is|was)\s+(?:the\s+|our\s+|a\s+|an\s+)?(.{3,60}?)(?=,|\.|;|\s+that\b|\s+we\b|\s+which\b|\s+i\b|\s+for\b|$)/iu,
    /\b(\p{Lu}[\p{L}\d&'’-]*(?:\s+\p{Lu}[\p{L}\d&'’-]*){0,3})\s+(?:project|program|initiative|pilot)\b/u
  ];

  /* ---------- self-introductions: "My name is …", "Hi, I'm …", "Avery here" ---------- */
  const NAME_STOP = new Set(('excited happy glad proud here so really very not just currently also based working responsible one part a an the in on at ' +
    'from with going thrilled honored honoured grateful lucky super still now senior junior lead principal chief head vice director manager supervisor ' +
    'associate assistant analyst engineer specialist consultant officer designer developer today joining sure ok okay sorry thankful delighted pleased ' +
    'new back actually basically originally fine good great hoping looking trying talking speaking sitting standing told always never usually member ' +
    'leading running passionate interested data product software customer project program team operations business technology sales marketing ' +
    'finance human it our my your this that what when where how why who').split(' '));
  const PARTICLES = new Set(['de', 'da', 'del', 'della', 'di', 'van', 'von', 'der', 'den', 'la', 'le', 'du', 'dos', 'das', 'bin', 'al', 'el']);
  const NAME_TOKEN = /^\p{Lu}[\p{L}'’-]*\.?$/u;
  const LEADS = [
    { re: /\bmy name(?:['’]s| is)\s+/gi, strength: 3, lowerOk: true },
    { re: /^(?:hi|hello|hey|hola|good (?:morning|afternoon|evening))\b[\s,!.]*(?:(?:every(?:one|body)|all|there|folks|team|y['’]all)\b[\s,!.]*)?(?:i['’]m|i am|this is)\s+/gi, strength: 2.5, once: true },
    { re: /(?:^|[.!?]\s+|,\s*|\band\s+)(?:i['’]m|i am)\s+/gi, strength: 1.5 },
    { re: /^this is\s+/gi, strength: 1.2, once: true, early: 2 }
  ];
  const HERE_RE = /^(?:[Hh]i|[Hh]ello|[Hh]ey|[Hh]ola)\b[\s,!.]*(?:(?:every(?:one|body)|all|there|folks)\b[\s,!.]*)?((?:\p{Lu}[\p{L}'’-]+\s+){0,2}\p{Lu}[\p{L}'’-]+),?\s+here\b/u;
  const titleCase = (t) => t.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
  /** Reads up to four name tokens starting at `pos`. Returns null if what follows isn't a name. */
  function readName(text, pos, lowerMode) {
    const toks = text.slice(pos).split(/\s+/).slice(0, 7), out = [];
    for (let i = 0; i < toks.length && out.length < 4; i++) {
      const raw = toks[i];
      const tok = raw.replace(/^["“'(]+/, '').replace(/[)"”'.,;:!?…]+$/, '');
      const endsClause = /[.,;:!?…)"”]$/.test(raw) && !/^\p{Lu}\.$/u.test(raw);
      if (!tok) break;
      const lc = tok.toLowerCase().replace(/’/g, "'");
      if (out.length && PARTICLES.has(lc)) { out.push(lc); if (endsClause) break; continue; }
      const proper = NAME_TOKEN.test(tok) && !MONTHS_DAYS.test(tok.replace(/’/g, "'"));
      const lower = lowerMode && /^\p{Ll}[\p{Ll}'’-]+$/u.test(tok) && !NAME_STOP.has(lc) && !STOP.has(lc);
      if (!proper && !lower) break;
      if (NAME_STOP.has(lc) || (out.length === 0 && STOP.has(lc))) { if (!out.length) return null; break; }
      out.push(lower ? titleCase(tok) : tok);
      if (endsClause) break;
    }
    while (out.length && PARTICLES.has(out[out.length - 1])) out.pop();
    return out.length ? out : null;
  }
  /**
   * The employee's name as they say it ("My name is Avery Example", "Hi, I'm Taylor"). Earlier and stronger
   * introductions win. All-lowercase auto-transcripts are accepted after "my name is", with low confidence.
   * Returns { name, evidence, time, segIndex, confidence } or null. Never guesses from anything else.
   */
  function findName(units, parse) {
    const emp = units.filter((u) => u.emp);
    if (!emp.length) return null;
    const words = emp.map((u) => u.text).join(' ').split(/\s+/).filter(Boolean);
    const midCaps = words.filter((w, i) => i && !/[.!?…]["”']?$/.test(words[i - 1]) && /^\p{Lu}/u.test(w) && !/^I(['’]|$)/.test(w)).length;
    const lowerMode = words.length >= 30 && midCaps / words.length < 0.01;
    const found = new Map();
    const add = (toks, strength, k, u, lower) => {
      const name = toks.join(' ');
      const score = strength + (k < 3 ? 1 : k < 8 ? 0.5 : 0) + (toks.length >= 2 ? 0.5 : 0) - (lower ? 1 : 0);
      const prev = found.get(name.toLowerCase());
      if (prev) { prev.score += 0.5; return; }
      found.set(name.toLowerCase(), { name, score, u, lower });
    };
    emp.slice(0, 40).forEach((u, k) => {
      for (const L of LEADS) {
        if (L.early !== undefined && k >= L.early) continue;
        L.re.lastIndex = 0; let m;
        while ((m = L.re.exec(u.text))) {
          const lower = !!(lowerMode && L.lowerOk);
          const toks = readName(u.text, m.index + m[0].length, lower);
          if (toks) add(toks, L.strength, k, u, lower && !/^\p{Lu}/u.test(u.text.slice(m.index + m[0].length).trim()));
          if (L.once || m[0].length === 0) break;
        }
      }
      const here = HERE_RE.exec(u.text);
      if (here) { const toks = readName(here[1], 0, false); if (toks) add(toks, 2, k, u, false); }
    });
    if (!found.size) return null;
    const best = [...found.values()].sort((a, b) => b.score - a.score)[0];
    const seg = parse.segments[best.u.seg];
    return { name: best.name, evidence: best.u.text, time: seg ? seg.start : null, segIndex: best.u.seg, confidence: best.lower ? 'low' : best.score >= 3.5 ? 'high' : best.score >= 2.5 ? 'medium' : 'low' };
  }

  function analyze(parse, turns, employeeSpeaker) {
    const hasSpeakers = parse.speakers.length > 0;
    const units = buildUnits(turns, employeeSpeaker, hasSpeakers);
    const emp = units.filter((u) => u.emp);
    const employeeWords = emp.reduce((n, u) => n + u.words, 0);
    const firstEmp = emp.length ? emp[0].idx : -1;
    for (const u of emp) { const s = scoreText(u.text); Object.assign(u, s); if (u.idx === firstEmp) u.score -= 0.5; }

    // Candidate pool: single units plus short adjacent pairs from the same turn.
    const pool = emp.map((u) => ({ first: u.idx, last: u.idx, turn: u.turn, start: u.start, end: u.end, text: u.text, words: u.words, score: u.score, themes: u.themes, reasons: u.reasons, primary: u.primary, seg: u.seg }));
    for (let i = 0; i + 1 < units.length; i++) {
      const a = units[i], b = units[i + 1];
      if (!a.emp || !b.emp || a.turn !== b.turn) continue;
      if (a.words + b.words > 45 || (a.words >= 12 && b.words >= 12)) continue;
      const text = turns[a.turn].text.slice(a.start, b.end);
      const s = scoreText(text);
      pool.push({ first: a.idx, last: b.idx, turn: a.turn, start: a.start, end: b.end, text, words: Util.wordCount(text), score: s.score - 0.5, themes: s.themes, reasons: s.reasons, primary: s.primary, seg: a.seg });
    }
    pool.sort((x, y) => y.score - x.score);

    const chosen = [];
    const overlaps = (c, o) => !(c.last < o.first || c.first > o.last);
    const adjacent = (c, o) => c.first - o.last < 2 && o.first - c.last < 2;
    for (const allowAdjacent of [false, true]) {
      while (chosen.length < 3) {
        const used = new Set(chosen.map((c) => c.primary));
        let best = null, bestAdj = -Infinity;
        for (const c of pool) {
          if (c.score < 1.5) continue;
          if (chosen.some((o) => overlaps(c, o) || (!allowAdjacent && adjacent(c, o)))) continue;
          const adj = c.score * (used.has(c.primary) ? 0.8 : 1);
          if (adj > bestAdj) { best = c; bestAdj = adj; }
        }
        if (!best) break;
        chosen.push(best);
      }
    }
    const segs = parse.segments;
    const candidates = chosen.map((c, i) => {
      const seg = segs[c.seg];
      const prev = units[c.first - 1], next = units[c.last + 1];
      return Object.assign({}, c, {
        rank: i + 1, time: seg ? seg.start : null, timeLabel: seg && seg.start !== null ? Util.clock(seg.start) : null, speaker: turns[c.turn].speaker,
        before: prev ? { text: prev.text, speaker: prev.speaker, sameTurn: prev.turn === c.turn } : null,
        after: next ? { text: next.text, speaker: next.speaker, sameTurn: next.turn === c.turn } : null
      });
    });

    // Theme totals (employee speech only)
    const themeTotals = {};
    for (const id of Object.keys(THEMES)) themeTotals[id] = { id, label: THEMES[id].label, points: 0, units: 0, best: null };
    for (const u of emp) for (const id of Object.keys(u.themes || {})) {
      const t = themeTotals[id]; t.points += u.themes[id]; t.units++;
      if (!t.best || u.score > t.best.score) t.best = u;
    }
    const themeRank = Object.values(themeTotals).filter((t) => t.units > 0).sort((a, b) => b.points - a.points);

    // Tags: themes → topics → frequent phrases
    const empText = emp.map((u) => u.text).join(' ');
    const lcText = empText.toLowerCase().replace(/[’‘]/g, "'");
    const tags = [];
    const addTag = (tag, kind, evidence) => { if (!tags.some((t) => t.tag.toLowerCase() === tag.toLowerCase())) tags.push({ tag, kind, evidence }); };
    const themeTags = themeRank.filter((t) => THEMES[t.id].tag && (t.units >= 2 || t.points >= 3)).map((t) => ({ tag: THEMES[t.id].tag, kind: 'theme', evidence: Util.plural(t.units, 'statement') }));
    const topics = TOPIC_TAGS.map((t) => ({ tag: t.tag, n: (lcText.match(t.re) || []).length })).filter((t) => t.n > 0).sort((a, b) => b.n - a.n)
      .map((t) => ({ tag: t.tag, kind: 'topic', evidence: Util.plural(t.n, 'mention') }));
    // Interleave specific topics with broader themes so the first few are the most useful.
    for (let i = 0; i < Math.max(themeTags.length, topics.length); i++) { if (topics[i]) addTag(topics[i].tag, topics[i].kind, topics[i].evidence); if (themeTags[i]) addTag(themeTags[i].tag, themeTags[i].kind, themeTags[i].evidence); }
    const speakerNames = new Set(parse.speakers.map((s) => s.name.toLowerCase()));
    const caps = capitalPhrases(emp, speakerNames);
    const toks = (lcText.match(/[a-z][a-z'-]+/g) || []);
    const bigrams = new Map();
    for (let i = 0; i + 1 < toks.length; i++) {
      const a = toks[i], b = toks[i + 1];
      if (STOP.has(a) || STOP.has(b) || a.length < 3 || b.length < 3) continue;
      const k = a + ' ' + b; bigrams.set(k, (bigrams.get(k) || 0) + 1);
    }
    const keywordList = [];
    for (const [p, n] of caps) if (n >= 1) keywordList.push({ tag: p, n: n + 0.5 });
    const usedEdges = [];
    for (const [p, n] of [...bigrams].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])) {
      const [a, b] = p.split(' ');
      if (usedEdges.some(([x, y]) => x === b || y === a)) continue;
      usedEdges.push([a, b]); keywordList.push({ tag: p.replace(/\b\w/g, (c) => c.toUpperCase()), n });
    }
    keywordList.sort((a, b) => b.n - a.n);
    for (const k of keywordList.slice(0, 5)) addTag(k.tag, 'keyword', Util.plural(Math.floor(k.n), 'mention'));

    // Project hints
    const projects = [];
    const addProject = (name, unit) => {
      name = name.trim().replace(/[.,;:]+$/, '');
      if (!name || name.length > 60 || Util.wordCount(name) > 6) return;
      name = name.replace(/^(the|our|a|an)\s+/i, '');
      if (/^(when|how|that|what|getting|being|working|seeing|moment|way)\b/i.test(name)) return;
      if (Util.wordCount(name) === 1 && (STOP.has(name.toLowerCase()) || /^(this|that|our|my|every|each|another|any|some)$/i.test(name))) return;
      if (speakerNames.has(name.toLowerCase())) return;
      if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
      const seg = segs[unit.seg];
      projects.push({ name, evidence: unit.text, time: seg ? seg.start : null });
    };
    for (const u of emp) for (const re of PROJECT_PATTERNS) { const m = re.exec(u.text); if (m) addProject(m[1], u); }
    for (const [p, n] of caps) if (n >= 2) { const u = emp.find((x) => x.text.includes(p)); if (u) addProject(p, u); }

    const top = candidates[0] ? candidates[0].score : 0;
    const strong = candidates.filter((c) => c.score >= 5).length;
    let level = 'low', reason;
    if (employeeWords < 40) reason = 'The transcript is too short to find strong statements automatically.';
    else if (top >= 7 && strong >= 2) { level = 'high'; reason = 'Several statements match story patterns (accomplishments, outcomes, lessons).'; }
    else if (top >= 4.5) { level = 'medium'; reason = 'Some statements match story patterns. Review the full transcript too.'; }
    else reason = 'No statement clearly matches story patterns.';

    return { units, candidates, themeTotals, themeRank, tags: tags.slice(0, 12), projects: projects.slice(0, 4), confidence: { level, reason }, employeeWords, name: findName(units, parse) };
  }

  return { analyze, scoreText, sentenceSpans, findName, THEMES };
})();

/* ==========================================================================
   Quote: exact-substring verification (whitespace + apostrophe style only)
   ========================================================================== */
const Quote = (() => {
  const normChar = (c) => (c === '’' || c === '‘' || c === 'ʼ' || c === '′') ? "'" : (c === '“' || c === '”' || c === '″') ? '"' : c;
  /** Normalized text plus map from normalized index → original index. */
  function normalizeWithMap(text) {
    let norm = ''; const map = []; let lastSpace = true;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (/\s/.test(c)) { if (!lastSpace) { norm += ' '; map.push(i); lastSpace = true; } continue; }
      norm += normChar(c); map.push(i); lastSpace = false;
    }
    if (norm.endsWith(' ')) { norm = norm.slice(0, -1); map.pop(); }
    return { norm, map };
  }
  const stripEdges = (s) => String(s || '').replace(/^[\s"'“”‘’(\[…—–-]+/, '').replace(/[\s"'“”‘’)\],.;:!?…—–-]+$/, '');
  const norm = (s) => normalizeWithMap(stripEdges(s)).norm;

  function verify(quote, ts) {
    const q = norm(quote);
    if (!q) return { status: 'empty' };
    if (!ts || !ts.turns) return { status: 'unverifiable' };
    if (q.length < 3) return { status: 'not-found' };
    const variants = [q];
    if (/\p{L}/u.test(q[0])) variants.push((q[0] === q[0].toUpperCase() ? q[0].toLowerCase() : q[0].toUpperCase()) + q.slice(1));
    for (const turn of ts.turns) {
      if (!turn._norm) turn._norm = normalizeWithMap(turn.text);
      for (let v = 0; v < variants.length; v++) {
        const idx = turn._norm.norm.indexOf(variants[v]);
        if (idx < 0) continue;
        const orig = turn._norm.map[idx];
        const segIdx = segAt(turn, orig);
        const seg = ts.parse.segments[segIdx];
        return { status: 'verbatim', caseDiffers: v === 1, speaker: turn.speaker, segIndex: segIdx, start: seg.start, startLabel: seg.startLabel, turn: turn.index, offset: orig, length: turn._norm.map[idx + variants[v].length - 1] - orig + 1 };
      }
    }
    return { status: 'not-found' };
  }
  return { verify, normalizeWithMap, stripEdges, norm };
})();

/* ==========================================================================
   Headlines: exact-quote clause + theme templates grounded in evidence
   ========================================================================== */
const Headlines = (() => {
  const T = [
    { theme: 'pride', text: 'The project I’m most proud of', requires: ['pride', 'accomplishment'], needs: /\bproud/i },
    { theme: 'pride', text: 'Why {project} means so much to me', requires: ['pride'], slot: true },
    { theme: 'pride', text: 'The work that makes me proud', requires: ['pride'] },
    { theme: 'accomplishment', text: 'How we built {project}', requires: ['accomplishment'], slot: true },
    { theme: 'accomplishment', text: 'What it took to build something new', requires: ['accomplishment'] },
    { theme: 'challenge', text: 'How one challenge changed my approach', requires: ['challenge', 'learning'] },
    { theme: 'challenge', text: 'The challenge that pushed me to grow', requires: ['challenge'] },
    { theme: 'solution', text: 'The small idea that made a big difference', requires: ['solution', 'outcome'] },
    { theme: 'solution', text: 'The idea behind {project}', requires: ['solution'], slot: true },
    { theme: 'solution', text: 'How a simple idea solved a real problem', requires: ['solution', 'challenge'] },
    { theme: 'collaboration', text: 'The team effort behind {project}', requires: ['collaboration'], slot: true },
    { theme: 'collaboration', text: 'What we accomplished together', requires: ['collaboration', 'accomplishment'] },
    { theme: 'collaboration', text: 'Why the best work is a team effort', requires: ['collaboration'] },
    { theme: 'learning', text: 'What {project} taught me', requires: ['learning'], slot: true },
    { theme: 'learning', text: 'What I learned from building something new', requires: ['learning', 'accomplishment'] },
    { theme: 'learning', text: 'The lesson I carry with me', requires: ['learning'] },
    { theme: 'outcome', text: 'How {project} made a real difference', requires: ['outcome'], slot: true },
    { theme: 'outcome', text: 'The change that made a real difference', requires: ['outcome'] },
    { theme: 'surprise', text: 'Something most people don’t know about me', requires: ['surprise'] },
    { theme: 'surprise', text: 'The story you might not expect', requires: ['surprise'] }
  ];

  function quoteClause(an, turns) {
    let best = null;
    for (const c of an.candidates) {
      const text = turns[c.turn].text.slice(c.start, c.end);
      const spans = [];
      const whole = Quote.stripEdges(text);
      if (Util.wordCount(whole) <= 14 && Util.wordCount(whole) >= 4) spans.push(whole);
      // Verbatim prefixes that end before a relative clause ("…the pilot | we launched…") are exact words too.
      const cutRe = /\s(?=(?:we|that|which|who|when|because|and|but|so)\s)/g; let cm;
      const prefixes = new Set();
      while ((cm = cutRe.exec(text))) { const pre = Quote.stripEdges(text.slice(0, cm.index)); const w = Util.wordCount(pre); if (w >= 5 && w <= 14) { spans.push(pre); prefixes.add(pre); } }
      const parts = text.split(/(?<=[,;:—–.!?])\s+/);
      for (let i = 0; i < parts.length; i++) {
        let acc = '';
        for (let j = i; j < Math.min(parts.length, i + 3); j++) {
          acc = acc ? acc + ' ' + parts[j] : parts[j];
          const s = Quote.stripEdges(acc); const w = Util.wordCount(s);
          if (w >= 5 && w <= 14) spans.push(s);
        }
      }
      for (const s of spans) {
        const sc = Analyzer.scoreText(s);
        const value = sc.score + (/^\p{Lu}/u.test(s) ? 1.5 : 0) + (Object.keys(sc.themes).length ? 1 : -2) + (sc.themes.pride ? 1 : 0)
          - (/^(so|and|but|because|then|well|honestly|yeah|um|uh)\b/i.test(s) ? 2 : 0) - c.rank * 0.3
          - Math.max(0, Util.wordCount(s) - 9) * 0.25 - (prefixes.has(s) ? 1 : 0);
        if (!best || value > best.value) best = { text: s, value, cand: c };
      }
    }
    return best;
  }

  function suggest(an, turns, parse) {
    const out = [];
    const q = quoteClause(an, turns);
    if (q) out.push({ kind: 'quote', text: q.text, timeLabel: q.cand.timeLabel, evidence: q.cand.text, flags: [] });
    const have = new Set(Object.keys(an.themeTotals).filter((k) => an.themeTotals[k].units > 0));
    const project = an.projects[0] ? an.projects[0].name : null;
    const usedThemes = new Set();
    for (const th of an.themeRank) {
      if (out.length >= 3) break;
      if (usedThemes.has(th.id)) continue;
      const empText = an.units.filter((u) => u.emp).map((u) => u.text).join(' ');
      const opts = T.filter((t) => t.theme === th.id && t.requires.every((r) => have.has(r)) && (!t.slot || project) && (!t.needs || t.needs.test(empText)));
      if (!opts.length) continue;
      const tpl = opts.find((t) => t.slot) || opts[0];
      const slot = project && /^\p{Ll}/u.test(project) ? 'the ' + project : project;
      const text = tpl.slot ? tpl.text.replace('{project}', slot) : tpl.text;
      if (out.some((o) => o.text === text)) continue;
      const flags = [];
      if (!tpl.slot) flags.push('generic');
      if (th.points < 3) flags.push('weak');
      const ev = th.best;
      const seg = ev && parse ? parse.segments[ev.seg] : null;
      out.push({ kind: 'template', theme: th.id, themeLabel: th.label, text, evidence: ev ? ev.text : null, timeLabel: seg && seg.start !== null ? Util.clock(seg.start) : null, flags, grounded: !!tpl.slot });
      usedThemes.add(th.id);
    }
    return out.slice(0, 3);
  }
  return { suggest, TEMPLATES: T };
})();

/* ==========================================================================
   Descriptions: built only from the transcript. Option 1 quotes the employee's
   exact words (checked word for word); the templates are paraphrases that use
   only detected themes, the project hint and known names. No he/she.
   ========================================================================== */
const Descriptions = (() => {
  const TOPIC = { pride: 'what makes them proud', accomplishment: 'building something new', challenge: 'a tough challenge', solution: 'solving a real problem', collaboration: 'teamwork', learning: 'a lesson learned', outcome: 'the difference the work made', surprise: 'something you might not expect', general: 'their work' };
  const CLAUSE = { pride: 'the work that makes them proud', accomplishment: 'how they built something new', challenge: 'how they worked through a tough challenge', solution: 'how a simple idea solved a real problem', collaboration: 'what teaming up made possible', learning: 'what the experience taught them', outcome: 'the difference the work made', surprise: 'something you might not expect' };
  const MAX = 240;
  const firstName = (name) => { const t = String(name || '').trim().split(/\s+/)[0] || ''; return /^\p{Lu}[\p{L}'’-]*$/u.test(t) ? t : ''; };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  /** "{First} on {topic}: “exact words”". The quoted part is always a verbatim span of the transcript. */
  function inTheirWords(first, passage, theme) {
    // Keep the speaker's own end punctuation; only surrounding quote marks and spaces are removed.
    const q = String(passage).replace(/\s+/g, ' ').trim().replace(/^["“'‘]+|["”'’]+$/g, '').trim();
    return (first ? `${first} on ${TOPIC[theme] || TOPIC.general}: ` : 'In their own words: ') + '“' + q + '”';
  }
  function quotedPart(text) { const m = /“([^”]+)”$/.exec(String(text || '')); return m ? m[1] : null; }
  function fromSelection(name, selection) {
    const sc = Analyzer.scoreText(selection);
    return inTheirWords(firstName(name), selection, sc.primary);
  }
  /** @param ctx { name, team } current story values, so templates can greet the person by name. */
  function suggest(an, ts, ctx = {}) {
    if (!an) return [];
    const out = [];
    const first = firstName(ctx.name || (an.name && an.name.name));
    const segs = ts && ts.parse ? ts.parse.segments : [];
    // 1. Exact words: the best suggested statement (or one of its sentences) that fits.
    for (const c of an.candidates) {
      const options = [c.text];
      if (c.first !== c.last) for (const u of an.units.slice(c.first, c.last + 1)) options.push(u.text);
      const pick = options.find((t) => inTheirWords(first, t, c.primary).length <= MAX && Util.wordCount(t) >= 6);
      if (!pick || (ts && Quote.verify(Quote.stripEdges(pick), ts).status !== 'verbatim')) continue;
      out.push({ kind: 'words', text: inTheirWords(first, pick, c.primary), theme: c.primary, timeLabel: c.timeLabel, evidence: pick, flags: c.score < 4 ? ['weak'] : [] });
      break;
    }
    // 2–3. Templates grounded in the strongest themes and the project hint.
    const themes = an.themeRank.filter((t) => CLAUSE[t.id]).slice(0, 3);
    const project = an.projects[0] ? an.projects[0].name : null;
    const projSlot = project && /^\p{Ll}/u.test(project) ? 'the ' + project : project;
    const team = String(ctx.team || '').trim();
    const ev = (th) => { const u = th && th.best; const seg = u ? segs[u.seg] : null; return { evidence: u ? u.text : null, timeLabel: seg && seg.start !== null ? Util.clock(seg.start) : null }; };
    const weak = (ths) => ths.some((t) => t.points < 3);
    if (themes.length) {
      const [a, b] = themes;
      const hear = projSlot ? `the story behind ${projSlot}${a ? ', and ' + CLAUSE[a.id] : ''}` : CLAUSE[a.id] + (b ? ' and ' + CLAUSE[b.id] : '');
      const text = first ? `Meet ${first}${team ? ' from ' + team : ''} and hear ${hear}.` : cap(`hear ${hear}.`);
      const flags = []; if (!projSlot && !team) flags.push('generic'); if (weak([a, b].filter(Boolean))) flags.push('weak');
      if (text.length <= MAX) out.push(Object.assign({ kind: 'template', text, themeLabel: a.label, flags }, ev(a)));
    }
    if (themes.length >= 2) {
      const [a, second] = themes;
      const text = first ? `${first} shares ${CLAUSE[a.id]}, and ${CLAUSE[second.id]}.` : cap(`${CLAUSE[a.id]}, and ${CLAUSE[second.id]}.`);
      const flags = ['generic']; if (weak([a, second])) flags.push('weak');
      if (text.length <= MAX && !out.some((o) => o.text === text)) out.push(Object.assign({ kind: 'template', text, themeLabel: second.label, flags }, ev(second)));
    }
    return out.slice(0, 3);
  }
  return { suggest, fromSelection, inTheirWords, quotedPart, firstName, MAX };
})();

/** The employee's name from the transcript: the speaker label, or their self-introduction when that's fuller. */
function nameFromTranscript(ts) {
  if (!ts || !ts.analysis) return null;
  const sp = ts.employeeSpeaker;
  const label = sp && !Parser.GENERIC_SPEAKER_RE.test(sp) && Util.wordCount(sp) <= 5 ? sp : null;
  const intro = ts.analysis.name;
  if (label && intro && intro.name.toLowerCase() !== label.toLowerCase() && intro.name.toLowerCase().startsWith(label.toLowerCase() + ' ')) return Object.assign({ source: 'intro' }, intro);
  if (label) return Object.assign({ name: label, source: 'speaker', confidence: 'high' }, intro && intro.name.toLowerCase() === label.toLowerCase() ? { evidence: intro.evidence, time: intro.time, segIndex: intro.segIndex } : {});
  return intro ? Object.assign({ source: 'intro' }, intro) : null;
}

/* ---- prepare ---- */
/** Parse + analyze a transcript state lazily, cached until format/speaker change. */
function prepareTranscript(ts) {
  if (!ts || typeof ts.text !== 'string') return ts;
  if (!ts.parse || ts.parsedWith !== ts.formatOverride) {
    ts.parse = Parser.parse(ts.text, ts.formatOverride || null);
    ts.parsedWith = ts.formatOverride;
    ts.turns = buildTurns(ts.parse.segments);
    ts.analysis = null;
    const names = ts.parse.speakers.map((s) => s.name);
    if (ts.employeeSpeaker === undefined || (ts.employeeSpeaker !== null && !names.includes(ts.employeeSpeaker))) ts.employeeSpeaker = ts.parse.defaultSpeaker;
  }
  if (!ts.analysis) {
    ts.analysis = Analyzer.analyze(ts.parse, ts.turns, ts.parse.speakers.length ? ts.employeeSpeaker : null);
    ts.headlines = Headlines.suggest(ts.analysis, ts.turns, ts.parse);
  }
  return ts;
}

/* ---- zip ---- */
/* ==========================================================================
   Zip: store-only ZIP writer/reader (CRC32). Large files (videos) are streamed
   from disk for the CRC and never copied into memory.
   ========================================================================== */
const Zip = (() => {
  const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const update = (c, b) => { for (let i = 0; i < b.length; i++) c = TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return c; };
  function crc32(b) { return (update(0xFFFFFFFF, b) ^ 0xFFFFFFFF) >>> 0; }
  async function crcOf(data) {
    if (data instanceof Uint8Array) return crc32(data);
    let c = 0xFFFFFFFF; const r = data.stream().getReader();
    for (;;) { const { done, value } = await r.read(); if (done) break; c = update(c, value); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xFFFF;
  const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  function headers(name, size, crc, offset, date) {
    const lh = new Uint8Array(30 + name.length), dv = new DataView(lh.buffer);
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0x0800, true); dv.setUint16(8, 0, true);
    dv.setUint16(10, dosTime(date), true); dv.setUint16(12, dosDate(date), true); dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true); dv.setUint32(22, size, true); dv.setUint16(26, name.length, true); dv.setUint16(28, 0, true);
    lh.set(name, 30);
    const ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 0x0314, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime(date), true); cv.setUint16(14, dosDate(date), true); cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true); cv.setUint32(24, size, true); cv.setUint16(28, name.length, true);
    cv.setUint32(38, (0o100644 << 16) >>> 0, true); cv.setUint32(42, offset, true);
    ch.set(name, 46);
    return { lh, ch };
  }
  function trailer(count, cdSize, cdOffset) {
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, count, true); ev.setUint16(10, count, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, cdOffset, true);
    return end;
  }
  /** files: [{ path, data: string | Uint8Array | Blob }] → Blob */
  async function createBlob(files, date = new Date()) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.path), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const size = data instanceof Uint8Array ? data.length : data.size;
      if (offset + size > 0xFFFFFFFF - 1e6) throw new Error('The package would be larger than 4 GB. Export without videos and copy them by hand.');
      const { lh, ch } = headers(name, size, await crcOf(data), offset, date);
      parts.push(lh, data); central.push(ch); offset += lh.length + size;
    }
    const cdSize = central.reduce((n, c) => n + c.length, 0);
    return new Blob([...parts, ...central, trailer(files.length, cdSize, offset)], { type: 'application/zip' });
  }
  function createBytes(files, date = new Date()) {
    const enc = new TextEncoder(), chunks = [], central = []; let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.path), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const { lh, ch } = headers(name, data.length, crc32(data), offset, date);
      chunks.push(lh, data); central.push(ch); offset += lh.length + data.length;
    }
    const cdSize = central.reduce((n, c) => n + c.length, 0);
    const all = [...chunks, ...central, trailer(files.length, cdSize, offset)], out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
    let p = 0; for (const c of all) { out.set(c, p); p += c.length; }
    return out;
  }
  function read(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), dec = new TextDecoder();
    let e = bytes.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Not a zip file');
    const count = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const out = [];
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Bad central directory');
      const crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 20, true), nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const path = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
      const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
      const data = bytes.subarray(start, start + size);
      out.push({ path, data, crcOk: crc32(data) === crc });
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }
  /**
   * Reads a zip File without loading it into memory: each entry is a Blob slice of the file.
   * Stored entries (ours) and deflated ones (a zip re-made by Finder) are both supported.
   * → [{ path, size, crc, method, raw }]; use entryBlob(entry) for the contents.
   */
  async function readFile(file) {
    const tailLen = Math.min(file.size, 22 + 65535);
    const tail = new Uint8Array(await file.slice(file.size - tailLen).arrayBuffer()), tv = new DataView(tail.buffer);
    let e = tail.length - 22; while (e >= 0 && tv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('Not a zip file');
    const count = tv.getUint16(e + 10, true), cdSize = tv.getUint32(e + 12, true), cdOff = tv.getUint32(e + 16, true);
    if (cdOff + cdSize > file.size) throw new Error('This zip file is incomplete.');
    const cd = new Uint8Array(await file.slice(cdOff, cdOff + cdSize).arrayBuffer()), dv = new DataView(cd.buffer), dec = new TextDecoder(), out = [];
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (p + 46 > cd.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error('Bad central directory');
      const method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true), csize = dv.getUint32(p + 20, true), size = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const path = dec.decode(cd.subarray(p + 46, p + 46 + nlen));
      const lh = new DataView(await file.slice(lo, lo + 30).arrayBuffer());
      if (lh.byteLength < 30 || lh.getUint32(0, true) !== 0x04034b50) throw new Error('Bad local header');
      const start = lo + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
      out.push({ path, size, crc, method, raw: file.slice(start, start + csize) });
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }
  async function entryBlob(entry, type = '') {
    if (entry.method === 0) return entry.raw.slice(0, entry.raw.size, type);
    if (entry.method === 8 && typeof DecompressionStream === 'function') return new Response(entry.raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob().then((b) => b.slice(0, b.size, type));
    throw new Error(`${entry.path} uses a compression method this browser can't read.`);
  }
  return { createBlob, createBytes, read, readFile, entryBlob, crc32, crcOf };
})();

  const Util = TextUtil; // eslint-disable-line no-unused-vars
  window.BTT_KIT = Object.freeze({ TextUtil, Decode, Parser, buildTurns, segAt, Analyzer, Quote, Headlines, Descriptions, nameFromTranscript, prepareTranscript, Zip });
})();
