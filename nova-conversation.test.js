const test = require('node:test');
const assert = require('node:assert/strict');
const { analizarIntenciones, construirRespuestaAnalisis } = require('./nova-conversation.js');

test('identifica todas las tareas en una solicitud larga y la cantidad pedida', () => {
    const intenciones = analizarIntenciones(
        'NOVA, actúa como mi asistente personal de inventario. Analiza toda la información disponible, identifica los problemas y propón cinco mejoras.'
    );

    assert.equal(intenciones.esCompleja, true);
    assert.equal(intenciones.esSolicitudLarga, true);
    assert.equal(intenciones.cantidadSolicitada, 5);
    assert.deepEqual(intenciones.tareas, ['analisis', 'problemas', 'recomendaciones', 'consultas']);
});

test('clasifica preguntas de explicación sin confundirlas con una orden de inventario', () => {
    const intenciones = analizarIntenciones('¿Qué significa la alerta de bajo stock?');

    assert.ok(intenciones.tareas.includes('explicaciones'));
    assert.ok(intenciones.tareas.includes('consultas'));
});

test('combina estadísticas, hallazgos y recomendaciones con valores proporcionados por el inventario', () => {
    const intenciones = analizarIntenciones('Analiza el inventario, revisa problemas, estadísticas y dame cinco recomendaciones.');
    const respuesta = construirRespuestaAnalisis({
        intenciones,
        fuente: 'Datos locales cargados; no se consultó Supabase en esta respuesta.',
        inventario: { productos: 2, unidades: 7, movimientos: 4, valorCosto: 15 },
        estadisticas: {
            periodo: 'noviembre de 2026', ventas: 42, gastos: 3, costo: 15, ganancia: 24,
            historico: { movimientos: 4, ventas: 42, gastos: 3 }
        },
        problemas: ['Arroz tiene 2 unidades; está debajo del umbral configurado.'],
        recomendaciones: [
            'Revisar el nivel de reposición de Arroz, que tiene 2 unidades.',
            'Confirmar si el stock de Avena (5 unidades) es suficiente.'
        ]
    });

    assert.match(respuesta, /2 productos, 7 unidades, valor del inventario al costo \$15\.00 y 4 movimientos/);
    assert.match(respuesta, /Histórico completo cargado \(4 movimientos\): ventas registradas \$42\.00/);
    assert.match(respuesta, /ventas \$42\.00/);
    assert.match(respuesta, /Arroz tiene 2 unidades/);
    assert.match(respuesta, /2 de 5 solicitadas/);
    assert.match(respuesta, /No inventaré las restantes/);
});

test('no fabrica hallazgos ni afirma consultar Supabase cuando no se hizo', () => {
    const intenciones = analizarIntenciones('Analiza los datos y propón cinco recomendaciones.');
    const respuesta = construirRespuestaAnalisis({
        intenciones,
        fuente: 'No hay datos cargados; no se consultó Supabase.',
        inventario: { productos: 0, unidades: 0, movimientos: 0, valorCosto: 0 },
        estadisticas: null,
        problemas: [],
        recomendaciones: []
    });

    assert.match(respuesta, /No hay productos cargados, así que no puedo evaluar problemas/);
    assert.match(respuesta, /No hay suficientes hallazgos verificables/);
    assert.match(respuesta, /no se consultó Supabase/);
});
