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

        // Almacenamiento global para el carrito: Map<uniqueItemId, itemObject>
        let carrito = new Map(); 
        let totalCardsDisplayed = 0; // Contador para llevar la cuenta de todas las impresiones mostradas

        /**
         * Realiza la búsqueda inicial de todas las cartas que coincidan con el término
         * y luego busca todas las impresiones (prints) en inglés para cada una de ellas.
         */
        async function buscarCartas() {
            const termino = document.getElementById('termino-busqueda').value.trim();
            resultadosDiv.innerHTML = ''; // Limpiar resultados anteriores
            estadoP.textContent = ''; // Limpiar mensajes
            totalCardsDisplayed = 0; // Resetear contador

            if (!termino) {
                estadoP.textContent = ' Por favor, introduce un término de búsqueda.';
                return;
            }

            estadoP.textContent = ' Buscando cartas únicas que coincidan con el texto...';

            try {
                // Paso 1: Buscar cartas únicas que coincidan con el término. 
                // Se usa 'lang:es' para que la búsqueda inicial acepte nombres de cartas en español.
                // Usamos `unique=cards` para obtener un representante de cada concepto (oracle_id).
                const encodedTermino = encodeURIComponent(termino);
                const firstSearchQuery = `${API_URL}${encodedTermino}%20lang:es&unique=cards`; 
                
                const response = await fetch(firstSearchQuery);
                const data = await response.json();

                if (data.object === 'error') {
                    if (data.details && data.details.includes('No cards found matching')) {
                        estadoP.textContent = ' No se encontraron cartas que coincidan. Intenta con otro nombre o filtro.';
                        return; 
                    } else {
                        throw new Error(data.details || 'Error inesperado de Scryfall.');
                    }
                }

                if (data.data && data.data.length > 0) {
                    const uniqueCards = data.data; // Cartas únicas por concepto
                    
                    estadoP.textContent = `Encontradas ${uniqueCards.length} cartas únicas. Buscando solo impresiones en inglés...`;

                    // Realizar todas las llamadas a la API de impresiones en paralelo
                    const fetchPromises = uniqueCards.map(card => {
                        // Solo buscamos impresiones si tiene un oracle_id
                        if (card.oracle_id) {
                            return fetchTodasLasImpresiones(card.oracle_id, card.name);
                        }
                        return Promise.resolve(); 
                    });

                    // Esperamos a que todas las búsquedas de impresiones terminen
                    await Promise.all(fetchPromises);

                    // Mensaje de resumen final
                    if (totalCardsDisplayed > 0) {
                        estadoP.textContent = `✅ Búsqueda completa. Se encontraron y mostraron ${totalCardsDisplayed} impresiones en inglés de ${uniqueCards.length} cartas únicas.`;
                    } else {
                        estadoP.textContent = ' No se encontraron impresiones válidas en inglés para las cartas halladas.';
                    }

                } else {
                    estadoP.textContent = ' No se encontraron cartas que coincidan. Intenta con otro nombre o filtro.';
                }

            } catch (error) {
                console.error('Error de la API o de la red:', error);
                estadoP.textContent = ` Error de conexión o red: ${error.message}`;
            }
        }

        /**
         * Busca todas las impresiones (prints) de una carta en idioma INGLÉS utilizando su oracle_id.
         * @param {string} oracleId - El ID de oráculo único de la carta.
         * @param {string} cardName - El nombre de la carta (para el mensaje de estado).
         */
        async function fetchTodasLasImpresiones(oracleId, cardName) {
            // Se usa lang:en para filtrar solo las impresiones en inglés.
            const allPrintsQuery = `https://api.scryfall.com/cards/search?q=oracleid:${oracleId}%20lang:en&order=released&unique=prints`;
            
            try {
                const response = await fetch(allPrintsQuery);
                const data = await response.json();

                if (data.object === 'error') {
                    console.warn(`Advertencia: Error al obtener impresiones de ${cardName} en inglés. Detalle: ${data.details}`);
                    return;
                }

                if (data.data && data.data.length > 0) {
                    mostrarCartas(data.data); // Muestra solo las impresiones en inglés
                    totalCardsDisplayed += data.data.length;
                }
            } catch (error) {
                console.error(`Error al obtener todas las impresiones de ${cardName}:`, error);
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
                
                // Estilos de la tarjeta, ajustados para la cuadrícula
                cardWrapper.className = `w-full max-w-[150px] sm:max-w-[180px] bg-gray-900 rounded-xl overflow-hidden shadow-xl card-result flex flex-col justify-between border border-gray-700`;
                
                let cardContentHTML = '';

                if (isDoubleFaced) {
                    cardWrapper.classList.add('double-face-card');
                    cardWrapper.style.height = '240px'; 
                    
                    // Contenedor de las caras (para el efecto flip)
                    cardContentHTML += crearCaraHTML(carta.card_faces[0], 'front-face', carta.id);
                    cardContentHTML += crearCaraHTML(carta.card_faces[1], 'back-face', carta.id);

                    // Manejo del evento flip
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
                            <div class="p-2 text-center">
                                <h3 class="text-sm font-bold text-amber-300 truncate">${carta.name}</h3>
                                <p class="text-xs text-gray-400">${carta.set_name} (${carta.set.toUpperCase()})</p>
                            </div>
                        `;
                    }
                }
                
                // Botón Añadir al Carrito
                const buttonHTML = `
                    <div class="p-2">
                        <button onclick="agregarAlCarrito(this)" 
                            data-card-id="${carta.id}" 
                            class="w-full bg-amber-600 hover:bg-amber-700 text-gray-900 text-sm font-semibold py-1 rounded-lg transition duration-150 transform hover:scale-[1.02]">
                            + Añadir
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
         * @param {string} cardId - ID de la carta padre.
         * @returns {string} HTML de la cara.
         */
        function crearCaraHTML(faceData, faceClass, cardId) {
            const imageUri = faceData.image_uris ? faceData.image_uris.normal : null;

            if (!imageUri) return '';

            return `
                <div class="face ${faceClass} w-full h-full bg-gray-900 rounded-xl overflow-hidden shadow-xl" style="position: absolute; border: 1px solid #4a5568;">
                    <img src="${imageUri}" alt="Imagen de ${faceData.name}" class="w-full h-full object-cover rounded-xl" onerror="this.onerror=null; this.src='https://placehold.co/680x960/FFD700/000?text=Card+No+Image'">
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

            // Usa una combinación de ID y Set para diferenciar impresiones
            const uniqueItemId = `${cardId}-${cardData.set}`;

            if (!carrito.has(uniqueItemId)) {
                // Almacenar el nombre y el set para el carrito
                carrito.set(uniqueItemId, {
                    id: cardId, // ID original
                    name: cardData.name,
                    set_name: cardData.set_name,
                    set: cardData.set.toUpperCase(),
                    prices: cardData.prices,
                    quantity: 1
                });
            } else {
                const item = carrito.get(uniqueItemId);
                item.quantity++;
                carrito.set(uniqueItemId, item);
            }
            
            actualizarVistaCarrito();
        }

        /**
         * Elimina un item del carrito
         * @param {string} uniqueItemId - El ID único del item (cardId-set) a eliminar.
         */
        function eliminarDelCarrito(uniqueItemId) {
            if (carrito.has(uniqueItemId)) {
                carrito.delete(uniqueItemId);
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
                // Usamos el precio en USD si está disponible
                const precio = item.prices.usd ? `$${item.prices.usd} USD` : 'Precio N/A';
                resumen += `${item.quantity}x ${item.name} (${item.set}) - ${precio}\n`;
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
            
            // Se utiliza Array.from para poder usar .map y ordenar
            Array.from(carrito).sort(([, a], [, b]) => a.name.localeCompare(b.name)).forEach(([uniqueItemId, item]) => {
                totalCartas += item.quantity;
                const listItem = document.createElement('div');
                listItem.className = 'flex justify-between items-center bg-gray-900 p-2 rounded-lg shadow-md border border-gray-700';
                listItem.innerHTML = `
                    <p class="truncate text-sm">
                        <span class="font-bold text-amber-300">${item.quantity}x</span> 
                        ${item.name} 
                        <span class="text-green-400">(${item.set})</span>
                    </p>
                    <button onclick="eliminarDelCarrito('${uniqueItemId}')" 
                        class="text-red-400 hover:text-red-500 font-bold ml-2 text-xs transition duration-150">
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