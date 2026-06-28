# ProofPass demo — voice-over script

**Target length:** 120.0 seconds (2:00)
**Target narration rate:** 150 words / minute = 2.5 words / second
**Target word count:** ~300 words (slightly under to leave breath room)
**Tone:** calm, confident, plain English. No jargon. No "ZK" until after the
problem is framed.

The cues are timed to the second. Read each cue as ONE continuous take; the
silence between cues is built in (≈ 0.6 s of breath + cursor movement). Total
silence budget across the 120 s video is ~5 s, which is exactly what we need.

> **How to use this file**
> 1. Record the screen video per `INSTALL.md` (silent track).
> 2. Generate the voice-over from this script with any TTS that supports
>    per-cue timing (ElevenLabs, MiniMax Speech, OpenAI TTS, etc.).
> 3. Import both into any editor (CapCut, DaVinci, iMovie, ffmpeg) and lay the
>    cues onto the silence gaps above. Total cue duration ≈ 115 s, well under
>    the 120 s video.

---

## Cue-by-cue timing

| Cue | Start | End | Words | Text |
|-----|-------|-----|-------|------|
| 01  | 00:00 | 00:08 | 14 | "Prove you qualify for a place to live. Without ever sharing your financial life." |
| 02  | 00:09 | 00:18 | 19 | "Today, proving you can afford an apartment means handing over bank statements, salary history, and a full transaction trail." |
| 03  | 00:19 | 00:24 | 11 | "ProofPass changes that. With one zero-knowledge proof, generated in your browser." |
| 04  | 00:25 | 00:32 | 19 | "A renter enters their real monthly income — five thousand dollars — and a public threshold — three thousand." |
| 05  | 00:33 | 00:40 | 17 | "They click Prove. The proof is built locally, in the page. Nothing private ever leaves this device." |
| 06  | 00:41 | 01:10 | 33 | "Thirty seconds. A zero-knowledge proof is generated. The browser computes a Poseidon commitment, executes the Noir circuit, and produces an UltraHonk proof. The Soroban verifier on Stellar checks it, on-chain, in one transaction." |
| 07  | 01:11 | 01:24 | 34 | "Now the landlord view. They paste the renter's wallet address. They see only yes, the threshold that was proven, and the expiry date. They click the link and inspect the proof on Stellar Expert." |
| 08  | 01:25 | 01:39 | 34 | "Open the market. Here is a list of renters who have already proven qualification for this unit. Each entry shows the proof transaction, the threshold, and an expiry. No names, no amounts, no documents." |
| 09  | 01:40 | 01:54 | 35 | "Side by side. On the left, what the renter entered — five thousand dollars in income. On the right, what the landlord saw — yes, three thousand, sixty days. That's it. The rest stayed private." |
| 10  | 01:55 | 02:00 | 13 | "ProofPass. Private qualification for the rental market, on Stellar. Link in the description." |

**Totals:** 10 cues, 229 words, ~92 s of speech, ~28 s of silence/cursor/action built into the video timeline.

## Word-count sanity check (formula)

```
229 words ÷ 150 wpm = 1.53 minutes  =  91.6 seconds of speech
120.0 s video  −  91.6 s speech  =  28.4 s of silence for visual action
```

If your TTS pace drifts to 170 wpm (faster), 229 / 170 = 1.35 min = 80.8 s — leaves 39 s of action.
If it drifts to 130 wpm (slower), 229 / 130 = 1.76 min = 105.7 s — leaves 14 s of action (still doable but tight).

**If TTS comes out slower than 140 wpm**, trim Cue 06 (the longest) by one sentence:
> Drop "The browser computes a Poseidon commitment, executes the Noir circuit, and produces an UltraHonk proof." → -19 words → 210 total → 84 s at 150 wpm.

## SSML-style pause markers (optional)

If your TTS supports `<break>` (ElevenLabs, MiniMax Speech, some OpenAI configs):

```
[0:00] Prove you qualify for a place to live.
[break 400ms] Without ever sharing your financial life.

[0:09] Today, proving you can afford an apartment means
handing over bank statements, salary history,
[break 200ms] and a full transaction trail.
...
```

The `break` markers align with the inter-cue silences in the table above.

## Delivery notes for the human narrator (if not using TTS)

- **Pace:** conversational, not theatrical. 150 wpm feels slow to speakers but is right for narration over UI.
- **Energy:** trust-building, not salesy. Think Stripe / Linear product video, not Superbowl.
- **Pronunciations:**
  - "UltraHonk" → "ULL-truh-honk" (one word, equal stress on each syllable)
  - "Soroban" → "so-ROH-ban" (stress on middle)
  - "Poseidon" → "po-SIGH-don" (stress on middle)
  - "Stellar" → "STELL-er"
  - "Noir" → "NWAHR" (one syllable)

## One-shot TTS command examples

### ElevenLabs (via their public API)
```bash
curl -X POST 'https://api.elevenlabs.io/v1/text-to-speech/<voice_id>' \
  -H 'xi-api-key: <key>' \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg t "$(cat tools/recordly/VOICEOVER_SCRIPT.md | awk '/^## Cue-by/,/^## Word-count/')" '{model_id:"eleven_multilingual_v2", text:$t, voice_settings:{stability:0.55, similarity_boost:0.7}}')" \
  --output tools/recordly/voiceover.mp3
```

### MiniMax Speech (if you have a key)
```bash
curl -X POST 'https://api.minimax.chat/v1/t2a_v2' \
  -H 'Authorization: Bearer <key>' \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg t "$(cat tools/recordly/VOICEOVER_SCRIPT.md | awk '/^## Cue-by/,/^## Word-count/')" '{model:"speech-02-turbo", text:$t, voice_setting:{voice_id:"male-qn-jingying", speed:1.0}}')" \
  --output tools/recordly/voiceover.mp3
```

### Hermes TTS skill (recommended — fastest)
```bash
# from inside the chat, just ask:
# "Read tools/recordly/VOICEOVER_SCRIPT.md from the Cue-by-cue section
#  and save the audio to tools/recordly/voiceover.mp3"
```
