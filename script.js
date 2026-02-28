window.addEventListener('load', () => {
    const imagenes = document.querySelectorAll('.hero-img');
    let index = 0;

    setInterval(() => {
        imagenes[index].classList.remove('active');
        index = (index + 1) % imagenes.length;
        imagenes[index].classList.add('active');
    }, 4000); //cambia la imagen cada 4 segundos
});