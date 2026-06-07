<script setup lang="ts">
import {
  Bookmark,
  Heart,
  Home,
  MessageCircle,
  Mic,
  Play,
  Search,
  SquarePen,
  User,
} from 'lucide-vue-next';

// Cosmetic waveform — first `filled` bars are solid, the rest faint.
const BAR_HEIGHTS = [
  30, 52, 40, 66, 48, 78, 58, 92, 66, 100, 72, 52, 80, 42, 62, 36, 74, 52, 90,
  46, 62, 34,
];
const FILLED_BARS = 11;
</script>

<template>
  <div class="stage" aria-hidden="true">
    <span class="chip chip--voice">
      <span class="chip__ic chip__ic--blue"><Mic :size="15" /></span>
      their real voice
    </span>
    <span class="chip chip--kept">
      <span class="chip__ic chip__ic--rose">
        <Heart :size="15" fill="currentColor" :stroke-width="0" />
      </span>
      kept forever
    </span>

    <div class="phone">
      <div class="screen">
        <div class="bar">
          <img src="/logo-mark.svg" alt="" width="18" height="18" />
          <b>Vocabu</b>
        </div>

        <div class="feed">
          <div class="entry">
            <div class="who">
              <b>Mira</b> <span>· my daughter · 22 mo</span>
            </div>
            <div class="word">
              <span class="quote">“</span>nana-lella<span class="quote">”</span>
            </div>
            <div class="gloss">watermelon</div>
            <div class="wave">
              <span class="play"
                ><Play :size="12" fill="currentColor" :stroke-width="0"
              /></span>
              <span class="bars">
                <i
                  v-for="(height, index) in BAR_HEIGHTS"
                  :key="index"
                  :class="{ on: index < FILLED_BARS }"
                  :style="{ height: `${height}%` }"
                />
              </span>
            </div>
            <div class="social">
              <span class="social__it social__it--liked">
                <Heart :size="16" fill="currentColor" :stroke-width="0" />14
              </span>
              <span class="social__it"><MessageCircle :size="16" />2</span>
              <span class="social__it"><Bookmark :size="16" /></span>
            </div>
          </div>

          <div class="div"></div>

          <div class="otd">
            <div class="otd__ov">on this day · a year ago</div>
            <div class="word word--sm">
              <span class="quote">“</span>don't trust a quiet dog.<span
                class="quote"
                >”</span
              >
            </div>
          </div>

          <div class="div"></div>

          <div class="entry entry--peek">
            <div class="who"><b>Theo</b> <span>· best friend</span></div>
            <div class="word word--sm">
              <span class="quote">“</span>emotionally damp<span class="quote"
                >”</span
              >
            </div>
          </div>
        </div>

        <div class="fab">
          <span class="fab__t fab__t--active"><Home :size="20" /></span>
          <span class="fab__t"><Search :size="20" /></span>
          <span class="fab__compose"><SquarePen :size="20" /></span>
          <span class="fab__t"><Bookmark :size="20" /></span>
          <span class="fab__t"><User :size="20" /></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  display: flex;
  justify-content: center;
}

.phone {
  position: relative;
  width: 310px;
  height: 632px;
  background: var(--paper);
  border-radius: 42px;
  padding: 11px;
  box-shadow:
    var(--shadow-lg),
    0 0 0 1px var(--hairline);
  border: 1px solid var(--frame-bg);
  transform: rotate(1.4deg);
}

@media (prefers-reduced-motion: no-preference) {
  .phone {
    animation: phone-float 7s var(--ease-in-out) infinite;
  }
}

.screen {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 32px;
  overflow: hidden;
  background:
    radial-gradient(
      110% 60% at 10% 0%,
      color-mix(in oklch, var(--rose-500) 6%, transparent),
      transparent 55%
    ),
    radial-gradient(
      110% 60% at 95% 100%,
      color-mix(in oklch, var(--blue-500) 6%, transparent),
      transparent 55%
    ),
    var(--paper);
  display: flex;
  flex-direction: column;
}

.bar {
  flex: 0 0 auto;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  background: var(--bar-bg);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--hairline);
}

.bar img {
  border-radius: 5px;
}

.bar b {
  font-size: 16px;
  font-weight: var(--w-bold);
  letter-spacing: -0.03em;
}

.feed {
  flex: 1;
  overflow: hidden;
}

.entry {
  padding: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 11px;
}

.entry--peek {
  padding-bottom: 8px;
}

.who {
  font-size: 12.5px;
}

.who b {
  font-weight: var(--w-semibold);
}

.who span {
  color: var(--text-faint);
}

.word {
  font-family: var(--font-hand);
  font-weight: var(--w-semibold);
  letter-spacing: 0;
  font-size: 31px;
  line-height: 1.05;
  color: var(--text);
  white-space: nowrap;
}

.word--sm {
  font-size: 24px;
}

.otd .word--sm {
  font-size: 21px;
}

.quote {
  color: var(--text-faint);
  font-weight: var(--w-medium);
}

.gloss {
  font-size: 14px;
  font-style: italic;
  color: var(--text-muted);
  margin-top: -3px;
}

.wave {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 200px;
}

.play {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  flex: 0 0 auto;
  border: 1.5px solid var(--blue-300);
  color: var(--secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bars {
  display: flex;
  align-items: center;
  gap: 2.5px;
  height: 22px;
  flex: 1;
}

.bars i {
  flex: 1;
  border-radius: 2px;
  background: var(--blue-200);
}

.bars i.on {
  background: var(--secondary);
}

.social {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
  margin-top: 3px;
  color: var(--text-muted);
}

.social__it {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: var(--w-semibold);
}

.social__it--liked {
  color: var(--like);
}

.div {
  height: 1px;
  background: var(--hairline);
}

.otd {
  background: var(--secondary-soft);
  padding: 16px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
}

.otd__ov {
  font-size: 10px;
  font-weight: var(--w-bold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--on-secondary-soft);
}

.fab {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 9px;
  background: color-mix(in oklch, var(--surface) 78%, transparent);
  backdrop-filter: blur(16px) saturate(1.5);
  border: 1px solid var(--hairline);
  border-radius: var(--r-pill);
  box-shadow: var(--shadow-md);
}

.fab__t {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
}

.fab__t--active {
  color: var(--primary);
}

.fab__compose {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--text-on-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-float);
  border: 2px solid var(--paper);
}

/* floating proof chips */
.chip {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border: 1px solid var(--hairline);
  box-shadow: var(--shadow-md);
  border-radius: var(--r-pill);
  padding: 9px 14px 9px 11px;
  font-size: 13px;
  font-weight: var(--w-semibold);
  color: var(--text);
  white-space: nowrap;
}

.chip__ic {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.chip__ic--blue {
  background: var(--secondary-soft);
  color: var(--on-secondary-soft);
}

.chip__ic--rose {
  background: var(--primary-soft);
  color: var(--on-primary-soft);
}

.chip--voice {
  top: 38px;
  left: -22px;
}

.chip--kept {
  bottom: 88px;
  right: -30px;
}

@media (prefers-reduced-motion: no-preference) {
  .chip--voice {
    animation: chip-float 7s var(--ease-in-out) 0.6s infinite;
  }
  .chip--kept {
    animation: chip-float 7s var(--ease-in-out) 1.4s infinite;
  }
}

@keyframes phone-float {
  0%,
  100% {
    transform: translateY(0) rotate(1.4deg);
  }
  50% {
    transform: translateY(-10px) rotate(1.4deg);
  }
}

@keyframes chip-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-9px);
  }
}

@media (max-width: 900px) {
  .chip--kept {
    right: 4px;
  }
  .chip--voice {
    left: 4px;
  }
}

@media (max-width: 560px) {
  .phone {
    transform: rotate(0);
  }
  @media (prefers-reduced-motion: no-preference) {
    .phone {
      animation: phone-float-flat 7s var(--ease-in-out) infinite;
    }
  }
}

@keyframes phone-float-flat {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
</style>
