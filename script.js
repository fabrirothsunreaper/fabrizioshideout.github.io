 
// --- CONSTANTES Y REFERENCIAS DEL DOM ---
const API_URL = 'https://api.scryfall.com/cards/search?q=';
const resultadosDiv = document.getElementById('resultados');
const estadoP = document.getElementById('mensaje-estado');
const listaCarritoDiv = document.getElementById('lista-carrito');
const contadorCarritoSpan = document.getElementById('contador-carrito');
const carritoVacioMsg = document.getElementById('carrito-vacio-msg');

// Botones y Modal
const btnVaciar = document.getElementById('btn-vaciar');
const btnComprar = document.getElementById('btn-comprar');
const checkoutModal = document.getElementById('checkout-modal');
const ordenResumenPre = document.getElementById('orden-resumen');
const btnEnviarEmail = document.getElementById('btn-enviar-email');

// Correo del destinatario (Fabrizio)
const TARGET_EMAIL = 'fabriroth.sunreaper@gmail.com'; 

// Almacenamiento global para el carrito: Map<cardId, cardObject>
let carrito = new Map(); 

/**
 * Realiza la búsqueda de cartas en la API de Scryfall.
 */
async function buscarCartas() {
    const termino = document.getElementById('termino-busqueda').value.trim();
    resultadosDiv.innerHTML = ''; // Limpiar resultados anteriores
    estadoP.textContent = ''; // Limpiar mensajes

    if (!termino) {
        estadoP.textContent = '⚠️ Por favor, introduce un término de búsqueda.';
        return;
    }

    estadoP.textContent = '⏳ Buscando cartas...';

    try {
        // Se fuerza el filtro 'lang:es' para que la API priorice la búsqueda 
        // por nombres y textos de cartas en español.
        const encodedTermino = encodeURIComponent(termino);
        const finalQuery = `${encodedTermino}%20lang:es`; 
        
        const response = await fetch(`${API_URL}${finalQuery}&unique=prints`);
        const data = await response.json();

        if (data.object === 'error') {
            // Manejo de errores amigable si no se encuentra la carta
            if (data.details && data.details.includes('No cards found matching')) {
                estadoP.textContent = '🙁 Carta no encontrada. Intenta con otro nombre o filtro.';
                return; 
            } else {
                throw new Error(data.details || 'Error inesperado de Scryfall.');
            }
        }

        if (data.data && data.data.length > 0) {
            estadoP.textContent = `✅ Encontradas ${data.total_cards} cartas. Mostrando las primeras ${data.data.length}.`;
            mostrarCartas(data.data);
        } else {
            estadoP.textContent = '🙁 Carta no encontrada. Intenta con otro nombre o filtro.';
        }

    } catch (error) {
        console.error('Error de la API o de la red:', error);
        
        // Manejo de errores de conexión/red
        if (error.message.includes('No cards found matching') || error.message.includes('Error inesperado de Scryfall')) {
            estadoP.textContent = '🙁 Carta no encontrada. Intenta con otro nombre o filtro.';
        } else {
            estadoP.textContent = `❌ Error de conexión o red: ${error.message}`;
        }
    }
}

/**
 * Muestra las cartas en el contenedor de resultados.
 * @param {Array} cartas - Array de objetos de cartas de Scryfall.
 */
function mostrarCartas(cartas) {
    cartas.forEach(carta => {
        const isDoubleFaced = carta.card_faces && carta.card_faces.length === 2;
        
        const cardWrapper = document.createElement('div');
        cardWrapper.dataset.cardData = JSON.stringify(carta); 
        
        cardWrapper.className = `w-full max-w-xs bg-gray-900 rounded-xl overflow-hidden shadow-xl card-result flex flex-col justify-between border border-gray-700`;
        
        let cardContentHTML = '';

        if (isDoubleFaced) {
            cardWrapper.classList.add('double-face-card');
            
            // Contenedor de las caras (para el efecto flip)
            cardContentHTML += crearCaraHTML(carta.card_faces[0], 'front-face');
            cardContentHTML += crearCaraHTML(carta.card_faces[1], 'back-face');

            // Al hacer clic en la carta, se voltea
            cardWrapper.addEventListener('click', (e) => {
                // Evita el flip si se hace clic en el botón Añadir al Carrito
                if (!e.target.closest('button')) {
                    cardWrapper.classList.toggle('flipped');
                }
            });
            
        } else {
            // Carta de una sola cara
            const imagen_uri = carta.image_uris ? carta.image_uris.normal : null;
            
            if (imagen_uri) {
                 cardContentHTML = `
                    <img src="${imagen_uri}" alt="Imagen de ${carta.name}" class="w-full h-auto object-cover rounded-t-xl" onerror="this.onerror=null; this.src='https://placehold.co/680x960/FFD700/000?text=Card+No+Image'">
                    <div class="p-3 text-center">
                        <h3 class="text-xl font-bold text-amber-300">${carta.name}</h3>
                        <p class="text-sm text-gray-400">${carta.type_line}</p>
                    </div>
                `;
            }
        }
        
        // Botón Añadir al Carrito
        const buttonHTML = `
            <div class="p-3">
                <button onclick="agregarAlCarrito(this)" 
                    data-card-id="${carta.id}" 
                    class="w-full bg-amber-600 hover:bg-amber-700 text-gray-900 font-semibold py-2 rounded-lg transition duration-150 transform hover:scale-[1.02]">
                    + Añadir al Carrito
                </button>
            </div>
        `;

        cardWrapper.innerHTML = cardContentHTML;
        
        if (cardContentHTML) {
            const buttonDiv = document.createElement('div');
            buttonDiv.innerHTML = buttonHTML;
            cardWrapper.appendChild(buttonDiv.firstElementChild);
            
            resultadosDiv.appendChild(cardWrapper);
        }
    });
}

/**
 * Genera el HTML para una cara de una carta (simple o doble).
 * @param {Object} faceData - Objeto de la cara de la carta.
 * @param {string} faceClass - Clase CSS para la cara.
 * @returns {string} HTML de la cara.
 */
function crearCaraHTML(faceData, faceClass) {
    const imagen_uri = faceData.image_uris ? faceData.image_uris.normal : null;

    if (!imagen_uri) return '';

    return `
        <div class="face ${faceClass} w-full h-full bg-gray-900 rounded-xl overflow-hidden shadow-xl" style="position: absolute;">
            <img src="${imagen_uri}" alt="Imagen de ${faceData.name}" class="w-full h-full object-cover rounded-xl" onerror="this.onerror=null; this.src='https://placehold.co/680x960/FFD700/000?text=Card+No+Image'">
        </div>
    `;
}

/**
 * Agrega una carta al carrito de compras.
 * @param {HTMLElement} buttonElement - El botón que fue clickeado.
 */
function agregarAlCarrito(buttonElement) {
    const cardId = buttonElement.dataset.cardId;
    const cardWrapper = buttonElement.closest('.card-result');
    const cardData = JSON.parse(cardWrapper.dataset.cardData);

    if (!carrito.has(cardId)) {
        carrito.set(cardId, {
            ...cardData,
            quantity: 1
        });
    } else {
        const item = carrito.get(cardId);
        item.quantity++;
        carrito.set(cardId, item);
    }
    
    actualizarVistaCarrito();
}

/**
 * Elimina un item del carrito
 * @param {string} cardId - El ID único de la carta a eliminar.
 */
function eliminarDelCarrito(cardId) {
    if (carrito.has(cardId)) {
        carrito.delete(cardId);
        actualizarVistaCarrito();
    }
}

/**
 * Finaliza la compra, genera el resumen y muestra el modal.
 */
function finalizarCompra() {
    if (carrito.size === 0) return;

    let resumen = "--- PEDIDO DE CARTAS MAGIC ---\n";
    let totalCartas = 0;
    
    // Recorre el carrito y genera un resumen
    carrito.forEach(item => {
        const precio = item.prices.usd ? `$${item.prices.usd} USD` : 'Precio N/A';
        resumen += `${item.quantity}x ${item.name} (${item.set_name}) - ${precio}\n`;
        totalCartas += item.quantity;
    });

    resumen += `\nTotal de items: ${totalCartas}`;
    resumen += "\n--- FIN DEL PEDIDO ---";

    // Codifica el resumen para el enlace mailto
    const subject = encodeURIComponent(`Pedido MTG: ${totalCartas} cartas`);
    const body = encodeURIComponent(resumen);
    const mailtoLink = `mailto:${TARGET_EMAIL}?subject=${subject}&body=${body}`;

    // Actualiza el enlace del botón de enviar email
    btnEnviarEmail.href = mailtoLink;

    mostrarModalOrden(resumen);
}

/**
 * Muestra el modal de confirmación de compra con el resumen del pedido.
 * @param {string} resumenTexto - El texto de resumen del pedido.
 */
function mostrarModalOrden(resumenTexto) {
    ordenResumenPre.textContent = resumenTexto;
    checkoutModal.style.display = 'flex'; // Mostrar el modal
}

/**
 * Cierra el modal de compra y vacía el carrito.
 */
function cerrarModalOrden() {
    checkoutModal.style.display = 'none'; // Ocultar el modal
    vaciarCarrito(); 
}

/**
 * Vacía completamente el carrito.
 */
function vaciarCarrito() {
    if (carrito.size > 0) {
        carrito.clear();
        actualizarVistaCarrito();
    }
}

/**
 * Actualiza el contenido visual del carrito y el estado de los botones.
 */
function actualizarVistaCarrito() {
    listaCarritoDiv.innerHTML = '';
    
    if (carrito.size === 0) {
        carritoVacioMsg.style.display = 'block';
        contadorCarritoSpan.textContent = 0;
        
        // Deshabilitar botones
        btnVaciar.disabled = true;
        btnVaciar.classList.add('opacity-50', 'cursor-not-allowed');
        btnVaciar.classList.remove('hover:scale-[1.01]');
        
        btnComprar.disabled = true;
        btnComprar.classList.add('opacity-50', 'cursor-not-allowed');
        btnComprar.classList.remove('hover:scale-[1.01]');
        
        return;
    }
    
    carritoVacioMsg.style.display = 'none';
    let totalCartas = 0;
    
    carrito.forEach(item => {
        totalCartas += item.quantity;
        const listItem = document.createElement('div');
        listItem.className = 'flex justify-between items-center bg-gray-900 p-2 rounded-lg shadow-md border border-gray-700';
        listItem.innerHTML = `
            <p class="truncate">${item.quantity}x ${item.name}</p>
            <button onclick="eliminarDelCarrito('${item.id}')" 
                class="text-red-400 hover:text-red-500 font-bold ml-2 text-sm transition duration-150">
                (Eliminar)
            </button>
        `;
        listaCarritoDiv.appendChild(listItem);
    });
    
    contadorCarritoSpan.textContent = totalCartas;
    
    // Habilitar botones
    btnVaciar.disabled = false;
    btnVaciar.classList.remove('opacity-50', 'cursor-not-allowed');
    btnVaciar.classList.add('hover:scale-[1.01]');
    
    btnComprar.disabled = false;
    btnComprar.classList.remove('opacity-50', 'cursor-not-allowed');
    btnComprar.classList.add('hover:scale-[1.01]');
}