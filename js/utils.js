// js/utils.js

// Reemplaza alert
export function mostrarAlerta(mensaje, icono = 'info', titulo = '') {
    return Swal.fire({
        title: titulo || 'Aviso',
        text: mensaje,
        icon: icono, // 'success', 'error', 'warning', 'info', 'question'
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#002b5c'
    });
}

// Reemplaza confirm (devuelve true/false)
export async function mostrarConfirmacion(mensaje, titulo = '¿Estás seguro?', textoConfirmar = 'Sí, continuar', textoCancelar = 'Cancelar') {
    const result = await Swal.fire({
        title: titulo,
        text: mensaje,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#002b5c',
        cancelButtonColor: '#dc3545',
        confirmButtonText: textoConfirmar,
        cancelButtonText: textoCancelar
    });
    return result.isConfirmed;
}