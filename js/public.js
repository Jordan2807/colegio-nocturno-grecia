// js/public.js
import { setupPasswordToggles, initHeroSlider } from './common.js';
// auth.js ya expone login, registrar, logout, olvidePassword al window

// Inicializar componentes comunes
window.addEventListener('DOMContentLoaded', () => {
  setupPasswordToggles();
  initHeroSlider(); // solo afecta si hay .hero-img
});