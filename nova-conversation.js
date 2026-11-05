(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.NOVAConversation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const numeroPalabra = {
        uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
        seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10
    };

    function normalizar(texto) {
        return String(texto || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[¿?¡!,;:]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function analizarIntenciones(texto) {
        const comando = normalizar(texto);
        const tareas = [];
        const patrones = [
            ['analisis', /\b(analiza|analizar|analisis|revisa|revisar|evalua|evaluar|examina|examinar)\b/],
            ['problemas', /\b(problemas?|errores?|inconsistencias?|riesgos|alertas|fallas?)\b/],
            ['recomendaciones', /\b(recomienda|recomendaciones?|sugiere|sugerencias?|mejoras?|propone|propon|optimiza)\b/],
            ['estadisticas', /\b(estadisticas?|resumen|rendimiento|ventas|ganancias|gastos|reportes?|informes?|compara|comparar|total de productos|cuantos productos|existencias totales|estado del inventario)\b/],
            ['novedades', /\b(novedades?|que hay de nuevo|que hay nuevo|que cambio|que ha cambiado)\b/],
            ['consultas', /\b(consulta|consultar|busca|buscar|muestra|mostrar|cuanto|cuantos|cuanta|cuantas|stock|existencias|productos?|inventario)\b/],
            ['historial', /\b(historial|movimientos?|entradas?|salidas?)\b/],
            ['explicaciones', /\b(explica|explicame|significa|como funciona|por que|porque)\b/]
        ];
        patrones.forEach(([intencion, patron]) => {
            if (patron.test(comando)) tareas.push(intencion);
        });

        const cantidadTexto = comando.match(/\b(10|[1-9]|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:recomendaciones?|sugerencias?|mejoras?)\b/);
        const cantidadSolicitada = cantidadTexto
            ? Number(cantidadTexto[1]) || numeroPalabra[cantidadTexto[1]] || 0
            : null;
        const esSolicitudLarga = comando.split(' ').filter(Boolean).length >= 12;

        return {
            comando,
            tareas,
            cantidadSolicitada,
            esSolicitudLarga,
            esCompleja: tareas.length > 1 || esSolicitudLarga
        };
    }

    function construirRespuestaAnalisis({
        intenciones,
        fuente,
        inventario,
        estadisticas,
        problemas,
        recomendaciones
    }) {
        const tareas = intenciones.tareas || [];
        const secciones = [
            `Analicé la solicitud y detecté estas tareas: ${tareas.length ? tareas.join(', ') : 'análisis general'}.`,
            fuente,
            `Datos cargados: ${inventario.productos} productos, ${inventario.unidades} unidades, `
                + `valor del inventario al costo $${inventario.valorCosto.toFixed(2)} y ${inventario.movimientos} movimientos.`
        ];

        if (estadisticas?.historico) {
            secciones.push(
                `Histórico completo cargado (${estadisticas.historico.movimientos} movimientos): `
                + `ventas registradas $${estadisticas.historico.ventas.toFixed(2)} y gastos $${estadisticas.historico.gastos.toFixed(2)}.`
            );
        }

        if (tareas.includes('estadisticas') && estadisticas) {
            secciones.push(
                `Resumen de ${estadisticas.periodo}: ventas $${estadisticas.ventas.toFixed(2)}, gastos $${estadisticas.gastos.toFixed(2)}, `
                + `costo de productos vendidos $${estadisticas.costo.toFixed(2)} y `
                + `ganancia ${estadisticas.ganancia === null ? 'no disponible porque hay ventas sin costo registrado' : `$${estadisticas.ganancia.toFixed(2)}`}.`
            );
        }

        if (tareas.includes('analisis') || tareas.includes('problemas')) {
            secciones.push(inventario.productos === 0
                ? 'No hay productos cargados, así que no puedo evaluar problemas del inventario.'
                : problemas.length
                ? `Hallazgos basados en los datos: ${problemas.map((problema, indice) => `${indice + 1}. ${problema}`).join(' ')}`
                : 'No detecté problemas en los datos cargados con las validaciones disponibles.');
        }

        if (tareas.includes('recomendaciones')) {
            const solicitadas = intenciones.cantidadSolicitada;
            const limite = solicitadas || recomendaciones.length;
            const disponibles = recomendaciones.slice(0, limite);
            secciones.push(disponibles.length
                ? `Recomendaciones respaldadas por los datos (${disponibles.length}${solicitadas ? ` de ${solicitadas} solicitadas` : ''}): `
                    + disponibles.map((recomendacion, indice) => `${indice + 1}. ${recomendacion}`).join(' ')
                : 'No hay suficientes hallazgos verificables para proponer recomendaciones específicas. No completaré la lista con datos supuestos.');
            if (solicitadas && disponibles.length < solicitadas && disponibles.length > 0) {
                secciones.push(`Solicitaste ${solicitadas}; solo encontré ${disponibles.length} recomendaciones respaldadas por los datos. No inventaré las restantes.`);
            }
        }

        return secciones.join('\n\n');
    }

    return { analizarIntenciones, construirRespuestaAnalisis, normalizar };
});
