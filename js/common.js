// js/common.js

// Activar/desactivar visibilidad de contraseñas (el ojito)
export function setupPasswordToggles() {
  document.querySelectorAll(".togglePassword").forEach(icon => {
    icon.addEventListener("click", function () {
      const input = this.previousElementSibling;
      const type = input.getAttribute("type") === "password" ? "text" : "password";
      input.setAttribute("type", type);
      this.classList.toggle("fa-eye-slash");
    });
  });
}

// Slider de imágenes en el hero de index.html
export function initHeroSlider() {
  const imagenes = document.querySelectorAll('.hero-img');
  if (imagenes.length === 0) return;
  let index = 0;
  setInterval(() => {
    imagenes[index].classList.remove('active');
    index = (index + 1) % imagenes.length;
    imagenes[index].classList.add('active');
  }, 4000);
}