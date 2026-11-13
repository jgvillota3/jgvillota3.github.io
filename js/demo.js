// Datos de ejemplo para el modo demo (no tocan Google).
import { today, addDays, iso, uid } from './util.js';

export function demoState() {
  const t = today();
  const y = t.getFullYear(), m = t.getMonth();
  const D = (d, mm = m) => new Date(y, mm, d);
  const rutina = [];
  const add = (dia, titulo, tipo, inicio, fin) => rutina.push({ id: uid(), dia, titulo, tipo, inicio, fin });
  add(1, 'Gimnasio · espalda, bíceps y abdomen', 'gym', '05:45', '06:45');
  add(2, 'Gimnasio · pierna (cuádriceps)', 'gym', '05:45', '06:45');
  add(3, 'Gimnasio · pecho, tríceps y hombro', 'gym', '05:45', '06:45');
  add(4, 'Gimnasio · espalda, bíceps y abdomen', 'gym', '05:45', '06:45');
  add(5, 'Gimnasio · pierna (isquios)', 'gym', '05:45', '06:45');
  add(6, 'Gimnasio · pecho, tríceps y hombro', 'gym', '05:45', '06:45');
  add(1, 'Squash', 'squash', '20:00', '21:00');
  add(4, 'Squash', 'squash', '20:00', '21:00');
  add(5, 'Fútbol', 'futbol', '20:00', '21:30');
  add(7, 'Bici de ruta', 'bici', '07:00', '10:00');
  for (let d = 1; d <= 6; d++) { add(d, 'BRAVO', 'bravo', '09:00', '11:30'); add(d, 'BRAVO', 'bravo', '14:00', '19:30'); }

  const dias = {};
  for (let k = 1; k <= 4; k++) {
    const f = iso(addDays(t, -k));
    const dow = ((addDays(t, -k).getDay() + 6) % 7) + 1;
    const hechos = rutina.filter(r => r.dia === dow && r.tipo !== 'bravo' && k !== 2).map(r => r.id).join(',');
    dias[f] = { fecha: f, desayuno: '1', media_manana: '1', almuerzo: '1', media_tarde: k === 1 ? '' : '1', cena: '1', agua: 9, creatina: '1', whey: '1', entrenos: hechos };
  }
  const dowHoy = ((t.getDay() + 6) % 7) + 1;
  const gymHoy = rutina.find(r => r.dia === dowHoy && r.tipo === 'gym');
  dias[iso(t)] = { fecha: iso(t), desayuno: '1', media_manana: '1', almuerzo: '', media_tarde: '', cena: '', agua: 5, creatina: '1', whey: '', entrenos: gymHoy ? gymHoy.id : '' };

  const comp = [
    ['Arriendo', 1000000, 7, true], ['Nu', 9450, 7, true], ['Préstamo', 173000, 13, t.getDate() > 13],
    ['RappiCard', 1452901, 15, false], ['Mercado', 250000, 16, false], ['Bancolombia', 1141050, 16, false],
    ['Davivienda', 1797068, 24, false], ['Servicios', 250000, 28, false]
  ].map((c, i) => ({ row: 8 + i, concepto: c[0], valor: c[1], fecha: D(c[2]), pagado: c[3] }));
  const total = comp.reduce((a, c) => a + c.valor, 0);
  const falta = comp.filter(c => !c.pagado).reduce((a, c) => a + c.valor, 0);

  const compras = [
    [-1, 'Mercado D1', 'Bancolombia', 86400, '', 0], [-2, 'Gasolina', 'Davivienda', 120000, '', 0],
    [-3, 'Leche y vasos para BRAVO', 'Bancolombia', 254900, 'BRAVO', 254900], [-5, 'Cena con Sofía', 'RappiCard', 186000, 'Sofía', 93000],
    [-6, 'Proteína whey', 'Nu', 189000, '', 0], [-8, 'Netflix', 'Nu', 26900, '', 0]
  ].map(c => ({ fecha: addDays(t, c[0]), desc: c[1], tarjeta: c[2], valor: c[3], limite: null, cobrarA: c[4], valorCobrar: c[5] }));

  const pend = [
    { id: uid(), titulo: 'Cotizar filtro de agua para BRAVO', fecha: iso(t), repetir: 'no', diaMes: null, hecho: '', cat: 'pend', monto: 0 },
    { id: uid(), titulo: 'Comprar proteína whey', fecha: iso(addDays(t, 1)), repetir: 'no', diaMes: null, hecho: '', cat: 'pend', monto: 0 },
    { id: uid(), titulo: 'Foto del consumo a la inmobiliaria', fecha: '', repetir: 'mensual', diaMes: 18, hecho: '', cat: 'pend', monto: 0 },
    { id: uid(), titulo: 'Revisar factura EPM de BRAVO', fecha: '', repetir: 'mensual', diaMes: 9, hecho: '', cat: 'pend', monto: 0 },
    { id: uid(), titulo: 'Internet de la casa', fecha: iso(addDays(t, -1)), repetir: 'no', diaMes: null, hecho: '', cat: 'dinero', monto: 95000 }
  ];

  const events = {};
  const monday = addDays(t, -((t.getDay() + 6) % 7));
  for (let k = 0; k < 7; k++) events[iso(addDays(monday, k))] = [];
  events[iso(t)] = [
    { id: 'e1', titulo: 'Cotizar filtro de agua', start: 13 * 60 + 15, end: 13 * 60 + 45, cat: 'agenda' },
    { id: 'e2', titulo: 'Llamada con el contador', start: 17 * 60, end: 17 * 60 + 30, cat: 'agenda' }
  ];
  events[iso(addDays(t, 1))] = [{ id: 'e3', titulo: 'Almuerzo familiar', start: 12 * 60 + 30, end: 14 * 60, cat: 'agenda' }];

  return {
    demo: true,
    fin: {
      month: new Date(y, m, 1),
      cards: [
        { name: 'Bancolombia', cupo: 7000000, disp: 5233000, corte: 30, pago: 16, mes: 1141050 },
        { name: 'Nu', cupo: 3000000, disp: 2611000, corte: 15, pago: 7, mes: 9450 },
        { name: 'Davivienda', cupo: 4000000, disp: 2202932, corte: 8, pago: 24, mes: 1797068 },
        { name: 'RappiCard', cupo: 3001177, disp: 1548276, corte: 5, pago: 15, mes: 1452901 }
      ],
      compromisos: comp, total, falta, neto: total - 1443202,
      porCobrar: [{ quien: 'Sofía', total: 348700 }, { quien: 'BRAVO', total: 1094502 }],
      tarjetasMes: 4400469, compras, nextComprasRow: 200,
      ingresos: [{ fecha: D(1), concepto: 'Quincena', valor: 2400000, tipo: 'Quincena' }], hasIngresos: true
    },
    home: { id: 'demo', config: { avisoPagos: '1', avisoCorte: '1', avisoPendientes: '1', avisoEntrenos: '0' }, configRows: {}, rutina, dias, nextDiaRow: 50, pendientes: pend, nextPendRow: 50 },
    events, calendars: [{ id: 'primary', name: 'Personal', primary: true }], alertCalId: null
  };
}
