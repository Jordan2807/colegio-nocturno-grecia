//Contador para pasar la imagen del home
window.addEventListener('load', () => {
    const imagenes = document.querySelectorAll('.hero-img');
    let index = 0;

    setInterval(() => {
        imagenes[index].classList.remove('active');
        index = (index + 1) % imagenes.length;
        imagenes[index].classList.add('active');
    }, 4000); //cambia la imagen cada 4 segundos
});

//Ver contraseña
const togglePassword = document.getElementById("togglePassword");
const password = document.getElementById("password");

togglePassword.addEventListener("click", function () {

    const type = password.getAttribute("type") === "password" ? "text" : "password";
    password.setAttribute("type", type);

    this.classList.toggle("fa-eye-slash");
});