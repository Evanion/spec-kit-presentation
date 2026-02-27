<template>
  <div class="regent-footer">
    <div class="regent-footer-left">
      <img src="/images/regent-icon.svg" alt="" class="regent-footer-icon" />
      <span class="regent-footer-date">{{ new Date().toISOString().slice(0, 10) }}</span>
    </div>
    <div class="regent-footer-center">IT som det borde vara</div>
    <div class="regent-footer-right">Slide {{ $nav.currentPage }}</div>
  </div>
</template>

<style>
.regent-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background-color: #272833;
  border-top: 1px solid rgba(0, 153, 204, 0.3);
  font-family: 'Century Gothic', 'Segoe UI', sans-serif;
  font-size: 0.65rem;
  color: #DADCF1;
  z-index: 10;
}

.regent-footer-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.regent-footer-icon {
  height: 18px;
  width: auto;
}

.regent-footer-date {
  opacity: 0.8;
}

.regent-footer-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  letter-spacing: 0.02em;
}

.regent-footer-right {
  opacity: 0.8;
}
</style>
