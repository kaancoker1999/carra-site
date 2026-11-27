/* LUMIA — "Ask Mira" on the product pages. Shown to people with an account (gate() below).
   A small chat helper beside the configurator — no 3D preview. The customer
   writes what they need; Mira fills in the steps on the page, answers the
   usual questions, and adds windows to the cart — a whole list of rooms at once.

   How it shows what it does (from the simulated survey of what people want):
   · it says it is an AI assistant, and "Talk to a person" is always in the header;
   · the first screen is one short line and three starter questions;
   · every change it makes on the page comes back as a small list with Undo;
   · a missing price is a button ("See my price"), not a refusal.

   · It only drives the shop through window.LUMIA_SHOP (snapshot / configure /
     addLines in shopkit.js), so every rule of the shop still applies — and the
     price is shown here only when the page itself shows it (an account).
   · Answers come from the written replies below. Only the local preview server
     (tools/design_chat_server.mjs, with an ANTHROPIC_API_KEY) has an AI route; the live site has none.
   · Version-stamped: bump mira.js?v= in tools/product_template.html + the four product pages, and the
     ?v= on the two imports below (and in design-chat-brain.js) when those files change.
   · English / Spanish / French, following the site's own language switch (lumia_lang). */

import * as core from './design-chat-core.js?v=1';
import * as B from './design-chat-brain.js?v=1';

const SHOP = window.LUMIA_SHOP;
const esc = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const wide = window.matchMedia('(min-width: 1100px)');

const M = {
  lang: 'en', cat: null, ai: false, ready: false, open: false, busy: false, greeted: false,
  history: [], sizeSaid: false, saidAccount: false, askedAdd: false,
  project: null,          /* {rooms: [{label, qty, patch}], added} — a list of rooms waiting to go into the cart */
  undo: null,             /* {before, sizeSaid} — what the newest change card can take back */
  decided: {},            /* what the customer has actually chosen (colour, mount, drive …) — defaults are not shown as choices */
  fromPicker: false,
  guide: null,            /* the guided start on the Roman and drapery pages: {step: 'fabric' | 'rooms' | 'quote' | 'ask'} */
  guideSet: null,         /* the three answers given there (range, light, colours), kept for the room-by-room card */
};
try { const lg = localStorage.getItem('lumia_lang'); if(lg === 'es' || lg === 'fr') M.lang = lg; } catch(e){}
const tv = (v) => B.tv(M.lang, v);
const colon = () => M.lang === 'fr' ? '\u00A0: ' : ': ';                 /* French puts a space before the colon */
const KEYS = ['collection', 'colour', 'mount', 'fold', 'drive', 'tdbu', 'liner', 'banding', 'heading', 'panel', 'trackopt', 'track', 'fabric', 'chain'];

/* ════════ words ════════ */
const UI = {
  en: {
    launch: 'Ask Mira', title: 'Mira', ai: 'AI assistant', human: 'Talk to a person', close: 'Close',
    ph: 'Change anything, or ask', ph0: '34 1/2 x 60, bedroom', send: 'Send',
    foot: 'A person checks every order before it is cut.',
    cardT: 'Not sure where to start?',
    cardP: 'Tell Mira which room it is and what you need there. She suggests a fabric and fills in the options below for you.',
    cardPG: 'Three quick choices — the range, the light and the color — and Mira shows you every fabric that matches. She fills in the options below for you.',
    sideT: 'Your selection', sideTot: 'Total',
    ph0G: 'Ask a question, or type a size',
    example: 'example size', priceAcct: 'Price with a free account', priceBox: 'Your price shows with a free account.', priceBtn: 'See my price',
    undo: 'Undo', undone: 'Undone',
    hTitle: 'Talk to a person', hText: 'Write to our team. We answer within one business day, and your chat with Mira goes along, so you won’t have to repeat yourself.',
    hMsg: 'What can we help with?', hSend: 'Send to the team', hBack: 'Back to Mira', hSending: 'Sending…',
    hSent: 'Sent — thank you. The team answers in your account, under Messages, within one business day.',
    hFail: 'That did not go through. Please try again, or write to lumiashades@gmail.com.', hMail: 'Or write to lumiashades@gmail.com',
    hNeed: 'Write a line about what you need.',
    row: { size: 'Size', fabric: 'Fabric', cell: 'Cell & color', pleat: 'Pleat', colour: 'Color', mount: 'Mount', drive: 'Mechanism', fold: 'Fold style', heading: 'Heading', panel: 'Panels',
      liner: 'Liner', tdbu: 'Top-down bottom-up', trackopt: 'Track', track: 'Track mount', banding: 'Edge banding', chain: 'Control side', qty: 'Quantity', price: 'Price' },
    each: 'each', copy: 'Copy link', copied: 'Link copied', shareBtn: 'Share…',
  },
  es: {
    launch: 'Pregúntale a Mira', title: 'Mira', ai: 'Asistente de IA', human: 'Hablar con alguien', close: 'Cerrar',
    ph: 'Cambia algo o pregunta', ph0: '34 1/2 x 60, dormitorio', send: 'Enviar',
    foot: 'Una persona revisa cada pedido antes del corte.',
    cardT: '¿No sabes por dónde empezar?',
    cardP: 'Dile a Mira qué habitación es y qué necesitas ahí. Ella sugiere una tela y completa las opciones de abajo por ti.',
    cardPG: 'Tres pasos rápidos (la gama, la luz y el color) y Mira te muestra todas las telas que coinciden. Ella completa las opciones de abajo por ti.',
    sideT: 'Tu selección', sideTot: 'Total',
    ph0G: 'Haz una pregunta o escribe una medida',
    example: 'medida de ejemplo', priceAcct: 'Precio con una cuenta gratis', priceBox: 'Tu precio aparece con una cuenta gratis.', priceBtn: 'Ver mi precio',
    undo: 'Deshacer', undone: 'Deshecho',
    hTitle: 'Hablar con una persona', hText: 'Escríbele a nuestro equipo. Respondemos en un día hábil, y tu conversación con Mira va incluida para que no tengas que repetir nada.',
    hMsg: '¿En qué podemos ayudarte?', hSend: 'Enviar al equipo', hBack: 'Volver con Mira', hSending: 'Enviando…',
    hSent: 'Enviado, gracias. El equipo responde en tu cuenta, en Mensajes, en un día hábil.',
    hFail: 'No se pudo enviar. Inténtalo de nuevo o escribe a lumiashades@gmail.com.', hMail: 'O escribe a lumiashades@gmail.com',
    hNeed: 'Escribe una línea sobre lo que necesitas.',
    row: { size: 'Medida', fabric: 'Tela', cell: 'Celda y color', pleat: 'Plisado', colour: 'Color', mount: 'Montaje', drive: 'Mecanismo', fold: 'Estilo de pliegue', heading: 'Cabecera', panel: 'Paneles',
      liner: 'Forro', tdbu: 'Apertura superior e inferior', trackopt: 'Riel', track: 'Montaje del riel', banding: 'Ribete', chain: 'Lado del control', qty: 'Cantidad', price: 'Precio' },
    each: 'c/u', copy: 'Copiar enlace', copied: 'Enlace copiado', shareBtn: 'Compartir…',
  },
  fr: {
    launch: 'Demander à Mira', title: 'Mira', ai: 'Assistante IA', human: 'Parler à quelqu’un', close: 'Fermer',
    ph: 'Modifiez un détail ou posez une question', ph0: '34 1/2 x 60, chambre', send: 'Envoyer',
    foot: 'Une personne vérifie chaque commande avant la coupe.',
    cardT: 'Vous ne savez pas par où commencer ?',
    cardP: 'Dites à Mira de quelle pièce il s’agit et ce qu’il vous y faut. Elle propose un tissu et remplit les options ci-dessous pour vous.',
    cardPG: 'Trois choix rapides (la gamme, la lumière et la couleur) et Mira vous montre tous les tissus qui correspondent. Elle remplit les options ci-dessous pour vous.',
    sideT: 'Votre sélection', sideTot: 'Total',
    ph0G: 'Posez une question ou indiquez des dimensions',
    example: 'dimensions d’exemple', priceAcct: 'Prix avec un compte gratuit', priceBox: 'Votre prix s’affiche avec un compte gratuit.', priceBtn: 'Voir mon prix',
    undo: 'Annuler', undone: 'Annulé',
    hTitle: 'Parler à une personne', hText: 'Écrivez à notre équipe. Nous répondons sous un jour ouvrable, et votre conversation avec Mira est jointe : vous n’aurez rien à répéter.',
    hMsg: 'Comment pouvons-nous vous aider ?', hSend: 'Envoyer à l’équipe', hBack: 'Retour à Mira', hSending: 'Envoi…',
    hSent: 'Envoyé, merci. L’équipe vous répond dans votre compte, sous Messages, sous un jour ouvrable.',
    hFail: 'L’envoi n’a pas abouti. Réessayez, ou écrivez à lumiashades@gmail.com.', hMail: 'Ou écrivez à lumiashades@gmail.com',
    hNeed: 'Écrivez une ligne sur ce dont vous avez besoin.',
    row: { size: 'Dimensions', fabric: 'Tissu', cell: 'Alvéole et couleur', pleat: 'Pli', colour: 'Couleur', mount: 'Pose', drive: 'Mécanisme', fold: 'Style de pli', heading: 'Tête de rideau', panel: 'Panneaux',
      liner: 'Doublure', tdbu: 'Ouverture haut-bas', trackopt: 'Rail', track: 'Pose du rail', banding: 'Galon de bordure', chain: 'Côté de commande', qty: 'Quantité', price: 'Prix' },
    each: 'l’unité', copy: 'Copier le lien', copied: 'Lien copié', shareBtn: 'Partager…',
  },
};
const t = (k) => UI[M.lang][k] || UI.en[k] || k;

const SAY = {
  en: {
    hello: v => `Hi, I’m Mira. Give me your window size and I’ll set ${v} up for you, or pick one below. I only change what you ask.`,
    helloG: 'Hi, I’m Mira. What can I do for you?',
    /* the first screen on the Roman and drapery pages (Kaan, 2026-11-26): a fabric, a price, a question */
    startersG: ['Help me choose a fabric', 'Quick quote', 'I have a question'],
    guide: {
      fabricQ: 'Happy to. Three quick choices: the range, how much light comes through, and the colors you’d like to see. I’ll show you everything that matches — the choice is yours.',
      need: 'Pick a color first.',
      roomsFirst: 'Happy to. First the rooms: which ones is it for, and how many windows in each? Tick them below — one window is fine too. Or type your own list (“living room 3, bedroom 2”).',
      roomsQ: 'Which rooms is it for, and how many windows in each? Tick them below — one window is fine too. Or type your own list (“living room 3, bedroom 2”).',
      roomsGo: 'Continue',
      got: (r, n) => n === 1 ? 'Got it — one window.' : r === 1 ? `Got it — ${n} windows in one room.` : `Got it — ${r} rooms, ${n} windows in all.`,
      sameQ: (v, s) => `Every room has ${v} for now. Press Continue to keep it — or tap “${s}” to give a room its own fabric.`,
      quoteQ: 'Happy to. What size is the window, and how many do you need? If the sizes differ, start with the largest.',
      qSize: 'Window size', qCount: 'How many windows?', qGo: 'Show prices', qNeed: 'Enter the width and the height.',
      quoteA: n => `Here is where each range starts at that size${n > 1 ? `, for ${n} windows` : ''} — with the options as they are on the page, and free shipping. Tap a range to see its fabrics.`,
      quoteSize: 'Tell me the width and the height and I’ll show you where each range starts.',
      each: 'each', forN: (v, n) => `${v} for ${n}`,
      askQ: 'Of course — ask me anything. Here is what people ask most:',
      topics: ['How long does delivery take?', 'What does the guarantee cover?', 'How do I measure?', 'Can I get free swatches?', 'What is the difference between inside and outside mount?'],
    },
    noun: { roman: 'this shade', cellular: 'this shade', pleated: 'this shade', drapery: 'this drapery' },
    thanks: 'My pleasure.',
    lost: 'I can set the size, fabric, color, mount and mechanism on this page, add windows to your cart room by room, or answer questions about delivery, measuring and our guarantee. What would you like to do?',
    changed: n => n === 1 ? 'Done. I changed one thing on the page:' : `Done. I changed ${n} things on the page:`,
    fits: v => `Size fits ${v.toLowerCase()}`, fitsD: 'Size is within what we make',
    undone: v => `Undone — it is back to ${v}.`,
    price: v => `That comes to ${v.price} each${v.qty > 1 ? `, ${v.total} for ${v.qty}` : ''}, with free shipping.`,
    priceAccount: 'Prices appear as soon as you have a free account — it takes a minute.',
    priceNeedSize: 'Tell me the width and height and I’ll give you the exact figure.',
    priceSizeFirst: 'Tell me the width and height first, so the right price is waiting for you.',
    otherPage: v => `You’re on the ${v.here} page. ${v.there} have their own page — I can take you there and carry on from this message.`,
    chooseAsk: 'Happy to. Tick the rooms we are doing, what matters in each one and how many windows it has. I’ll suggest a fabric for every room at once.',
    planTotal: v => `Total for ${v.units}: ${v.total}, with free shipping.`,
    planNoSize: 'Prices follow as soon as I have the size.',
    need: { dark: 'Dark for sleeping', soft: 'Soft daylight', privacy: 'Privacy', heat: 'Heat and cold' },
    needShort: { dark: 'dark', soft: 'soft light', privacy: 'privacy', heat: 'heat' },
    needPick: { dark: 'Dark', soft: 'Soft light', privacy: 'Privacy', heat: 'Heat / cold' },
    because: { dark: 'blackout', soft: 'light-filtering', privacy: 'light-filtering, private by day', heat: 'extra insulation' },
    pick: { size: 'All the same size? (optional)', w: 'Width', h: 'Height', go: 'Set up these rooms', none: 'Tick at least one room.', all: 'all' },
    why: {
      dark: 'For sleep I’d go with a blackout fabric, so that is what I’ve set.',
      soft: 'For soft daylight a light-filtering weave is the one: it glows without glare.',
      privacy: 'For privacy, a light-filtering fabric hides the room by day. At night with the lights on, a liner or top-down bottom-up keeps you covered.',
      privacyF: 'For privacy I’d add the white liner: nobody can see in, and it softens the light a little. Sheer fabrics are see-through at night, so I leave them out.',
      softF: 'For soft daylight I leave out blackout — everything else lets the light in.',
      heatC: 'For heat and cold, double cell is the best insulator we make, so I’ve set it.',
      heat: 'For heat and cold, cellular shades insulate best, and they have their own page. On this one, a liner helps.',
      wet: 'For a kitchen or bathroom I’d pick something slim that sits close to the glass: pleated or cellular shades.',
      wetOk: 'A good pick for a kitchen or bathroom: it sits close to the glass and stays out of the way.',
    },
    several: 'Give me the list any way you like — “living room 3, bedroom 2” or “5 rooms: 4, 3, 4, 2, 5” — and the size, if they are all the same. Each room goes into your cart as its own line.',
    fabricsOpen: 'The fabric step is open on the page. Tap a color there, or tell me one — “something grey”, “Ocean Teal”.',
    share: 'Here is a link to exactly this design. Whoever opens it sees the same size, fabric and options.',
    human: 'Of course. I’ve opened the form — your chat with me goes along, so you won’t have to repeat yourself.',
    rooms: v => `Got it — ${v.rooms} rooms, ${v.units} ${v.unit} in all${v.size ? `, each ${v.size}` : ''}.`,
    roomsCfg: v => `I’ll make them all like the one on this page: ${v}.`,
    roomsAsk: v => `Change anything first — for all of them, or for one room (“room 3 with a blackout liner”) — or shall I add all ${v} to your cart?`,
    roomsAsk2: v => `Anything else to change — or shall I add all ${v} to your cart?`,
    planEdit: 'You can change the sizes and the number of windows right in the list.',
    planNext: 'Check the sizes and the number of windows in the list. When they are right, press the button and we choose colors and options for all of them together.',
    planFill: 'Type the sizes into the list — one per room, or one per window — or tell me one size if they are all the same.',
    planLater: 'Not measured yet? Press the button and choose the fabric first — the sizes can come after.',
    planNeed: n => n === 1 ? 'One window still needs a size before I can add them.' : `${n} windows still need a size before I can add them.`,
    setup: {
      next: 'Next: colors and options', first: 'Before they go into the cart, let’s choose the colors and options together — it only takes a minute.',
      intro: 'Now the details. I’ll ask each one once and it applies to every window; you can still change a single room afterwards.',
      sizesLater: 'The sizes can wait — I’ll ask for them right after the fabric.',
      sizeAsk: pr => pr ? 'Would you like to enter the sizes now, so you see the prices — or choose the fabric first?' : 'Would you like to enter the sizes now, or choose the fabric first?',
      sizeNow: ['Enter the sizes now', 'Every fabric and option then shows its price.', 'One per room, or one per window.'],
      fabricFirst: ['Choose the fabric first', 'The sizes come right after, and the prices with them.', 'The sizes come right after.'],
      sizeQ: 'Now the sizes. Type them into the list — one per room, or one per window — or tell me one size if they are all the same.',
      sizeMiss: n => n === 1 ? 'One window still needs a size.' : `${n} windows still need a size.`, sizesIn: 'The sizes are in.', sizeOk: 'Every window has its size — press Continue in the list.',
      mountMiss: 'Choose inside or outside mount for each size first.', sizeMount: 'Beside each size, choose inside or outside mount.',
      colourQ: 'First the color — which one would you like?',
      fabricQ: 'First the fabric and its color, in three quick choices: the range, how much light it lets through, and the colors you’d like to see. I’ll show you everything that matches — the choice is yours.',
      darkOne: 'For a dark room I’d add the blackout liner: it goes behind any fabric you like, so the fabric and the color stay your choice. Three quick choices and I’ll show you what we have.',
      kindSaid: 'Here you go — two more quick choices and I’ll show you what we have.',
      famSaid: v => `Two quick choices and I’ll show you the ${v} we have.`, famSet: v => `Done — the color filter now shows ${v}.`,
      famNone: v => `No ${v} in this kind of fabric — try another kind, or pick from the colors below.`,
      hidePrivacy: v => `Sheers are left out for ${v}: at night, with the lights on, people can see through them.`,
      hideSoft: v => `Blackout is left out for ${v}, where you want soft daylight.`,
      boHint: 'A blackout liner goes behind the fabric you choose — the prices here include it.', boSheer: 'Behind a sheer fabric the liner takes away the see-through look.',
      privacyLiner: v => `For ${v} I’d add the white liner, so nobody can see in.`,
      heatLiner: v => `For ${v} a liner helps keep heat and cold out; if that matters most, our cellular shades insulate best.`,
      sheerLiner: 'One thing to know: behind a sheer fabric, a blackout liner takes away the see-through look.',
      linerHas: (v, n, rest) => `${v} already ${n > 1 ? 'have their' : 'has its'} blackout liner from the fabric step, so this is for ${rest}.`,
      thisWindow: 'this window', and: 'and',
      wordSaid: 'Three quick choices and I’ll show you what we have — the color is yours to pick.', wordPending: 'The color is yours to pick — you’ll see everything that matches in the color step.',
      kindQ: 'Which range?', opQ: 'How much light should come through?', famQ: 'Which colors would you like to see?',
      kind: { budget: ['Budget friendly', 'Our best prices'], classic: ['Classic', 'Mid-range prices'], solid: ['Solids', 'Plain colors'], wool: ['Wool blend', 'Woven with wool'], linen: ['Linen', 'Linen and linen blends'], premium: ['Premium', 'Our finest fabrics'],
        pattern: ['Patterned', 'Stripes and woven motifs'], any: ['Not sure yet', 'Show me all of them'] },
      op: { sheer: ['Sheer', 'The most daylight. At night, with the lights on, people can see in.'], semi: ['Semi-transparent', 'Daylight comes in. At night only shapes show from outside.'], filter: ['Light filtering', 'A soft glow. Nobody can see in, day or night.'],
        linen: ['Linen', 'Linen and linen blends.'], dim: ['Room darkening', 'Blocks most of the light; the room stays dim, not fully dark.'], blackout: ['Blackout', 'Any fabric here, with a blackout liner behind it.'], any: ['Any', 'Show them all'] },
      from: v => `from ${v}`, change: 'Change', kindA: 'Range', opA: 'Light', otherFabrics: 'See other fabrics',
      darkHint: v => `${v} should be dark: choose any color you like here — the blackout liner comes up in a moment.`,
      darkLiner: v => `For ${v} I’d add the blackout liner, so the room is properly dark.`,
      darkOnly: v => [`Blackout liner in ${v} only`, 'No liner in the other rooms.'],
      linerMix: (d, p, rest) => [[d ? `Blackout liner in ${d}` : '', p ? `${d ? 'white' : 'White'} liner in ${p}` : ''].filter(Boolean).join(', '), rest ? 'No liner in the other rooms.' : ''],
      fam: { white: 'Whites & creams', beige: 'Beiges & sands', grey: 'Greys', dark: 'Dark tones', blue: 'Blues', green: 'Greens', warm: 'Warm tones', pink: 'Pinks & purples', all: 'Show everything' },
      scopeAll: 'Same for all rooms', scopeRoom: 'Different for each room', famFirst: 'Pick a color family above to see the fabrics.', none: 'Nothing in that color — try another.',
      more: n => `Show all ${n}`, allRooms: 'All rooms',
      colourOne: 'The color is yours to choose — here is what it comes in.',
      colourAll: n => `All ${n} colors`, cont: 'Continue', colourNeed: 'Pick a color for each one first.', pick: 'color to choose',
      included: 'included', same: 'same price', plus: (v, n) => n > 1 ? `+${v} for all ${n}` : `+${v}`, less: (v, n) => n > 1 ? `−${v} for all ${n}` : `−${v}`,
      done: 'That is everything. Here is your order — sizes and quantities can still be changed in the list.',
      mount: { q: 'Where will they hang?', Inside: ['Inside the window frame', 'A clean, built-in look.'], Outside: ['Outside, on the wall', 'Covers the whole opening and blocks more light at the edges.'] },
      fold: { q: 'What look would you like?', 'Back rods': ['Flat and clean', 'Smooth fabric with crisp, even folds.'], 'Front rods': ['With slim rods', 'Fine horizontal lines across the fabric — a tailored look.'],
        'Hobbled': ['Soft waves', 'Folds that cascade all the way down.'], 'Relaxed': ['Relaxed', 'A gentle curve at the bottom, easy and casual.'], 'Flat': ['One smooth panel', 'No rods across the fabric. With a cord loop or a motor.'] },
      drive: { q: v => v.loop && v.motor ? `Right now ${v.n > 1 ? 'they are all' : 'it is'} cordless: you lift and lower by hand. You can switch ${v.n > 1 ? 'all ' + v.n : 'it'} to a cord loop for ${v.loop} more, or go motorized for ${v.motor} more.` : 'How would you like to open and close them?',
        Cordless: ['Cordless', 'Lift and lower by hand. Nothing for children to reach.'], loop: ['Cord loop', 'A continuous loop at the side — easy on tall or wide windows.'], Motorized: ['Motorized', 'A remote or your phone. Rechargeable, no visible wiring.'] },
      tdbu: { q: v => `Top-down bottom-up lets you lower the shade from the top as well as raise it from the bottom: daylight in, privacy kept.${v.price ? ` Adding it to ${v.n > 1 ? 'all ' + v.n : 'this one'} costs ${v.price}.` : ''}`,
        No: ['No, thanks', 'Raise and lower from the bottom only.'], Yes: ['Add top-down bottom-up', 'Open from the top, the bottom, or both.'] },
      liner: { q: 'A liner keeps the fabric from being seen through from outside and helps it last longer. A blackout liner shuts the light out completely.',
        Unlined: ['No liner', 'The fabric on its own.'], 'White liner': ['White liner — privacy', 'Also called a light-filtering liner: nobody can see in from outside, the light gets a little softer, and the fabric lasts longer.'], 'Blackout liner': ['Blackout liner — no light', 'For rooms that should be completely dark.'] },
      banding: { q: v => `Last one: would you like edge banding — a colored border down the sides and along the bottom?${v.price ? ` It adds ${v.price}${v.n > 1 ? ' for all ' + v.n : ''}.` : ''}`, None: ['No, thanks', ''] },
      heading: { q: 'How should the top of the drapery look?', 'Wave fold': ['Soft, even waves', 'A modern, relaxed line.'], 'Single pinch pleat': ['Single pleat', 'Light and tailored.'],
        'Double pinch pleat': ['Double pleat', 'A classic, fuller look.'], 'Triple pinch pleat': ['Triple pleat', 'The fullest, most traditional.'], 'Euro pleat': ['Euro pleat', 'Pinched at the very top — crisp.'] },
      panel: { q: 'One panel or a pair?', 'Single panel': ['One panel', 'Stacks to one side.'], 'Pair, centre split': ['A pair', 'Opens from the center.'] },
      track: { q: 'Shall I include the track?', wall: ['Yes, mounted on the wall', ''], ceiling: ['Yes, mounted on the ceiling', ''], no: ['No track', 'You have your own rod or track.'] },
      hdr: (r, n) => `${r} ${r === 1 ? 'room' : 'rooms'}, ${n} ${n === 1 ? 'window' : 'windows'}`,
    },
    plan: { size: 'Size', win: n => `Window ${n}`, split: 'Each window has its own size', same: 'Same size for all', add: n => `Add all ${n} to my cart`, remove: 'Remove', each: 'each', w: 'W', h: 'H' },
    roomsNoSize: 'What size are they? If they are all the same, one size is enough — otherwise tell me room by room (“room 2 is 40 x 60”).',
    roomSet: v => `${v.room}: ${v.what}. The other rooms stay as they are.`,
    roomsStill: v => `Still waiting in your list: ${v.rooms} rooms, ${v.units} ${v.unit}.`,
    roomsAdded: v => `Done — ${v.lines} lines, ${v.units} ${v.unit}, are in your cart, each one named after its room.`,
    cartTotal: v => `Your cart comes to ${v}, with free shipping.`,
    afterAdd: 'To change a single room now, use Edit on its line in the cart.',
    added1: v => `Added to your cart: ${v.qty} × ${v.cfg}.`,
    askAdd: 'Shall I add it to your cart?',
    needChoice: v => `One thing is still open before I can add it: ${v}. Which would you like?`,
    cartHere: v => `Your cart has ${v.lines} lines, ${v.units} pieces — I’ve scrolled the page to it.`,
    cartEmpty: 'Your cart is still empty. Tell me the size and I’ll set up the first window.',
    measure: 'Measure the width and the height to the nearest 1/8″ — we make it to the exact size you give, so it is worth measuring twice. Not sure how to measure your window? Press “Talk to a person” above and the team will help you.',
    samples: 'Fabric swatches are free. Press “Talk to a person” above, tell the team which colors you like, and they will take it from there.',
    trade: 'Dealers and designers have their own trade area, opened with an access code — you can apply at lumiashades.com/trade.html.',
    unit: { roman: 'shades', cellular: 'shades', pleated: 'shades', drapery: 'drapery sets' },
    q: { size: 'What are the width and height? Something like “34 1/2 x 60” works.', sizeD: 'How wide should the track be, and what drop do you need? Something like “96 x 90” works.' },
    /* the first screen: the owner's order — choose, cost, several windows */
    starters: ['Help me choose for my room', 'What will mine cost?', 'I have several windows'],
    chips: {
      choose: ['Bedroom — dark for sleeping', 'Living room — soft light', 'Street-facing — privacy', 'Too hot or too cold'],
      size: ['36 x 60', '48 x 72'], sizeD: ['72 x 84', '96 x 90'],
      several: ['living room 3, bedroom 2 — all 36 x 60', '5 rooms: 4, 3, 4, 2, 5 — all 36 x 60'],
      cfg: ['Add to cart', 'Show me the colors', 'Send to my partner'],
      project: ['Add all to my cart', 'Room 3 with a blackout liner', 'White liner in all of them'],
      projectC: ['Add all to my cart', 'Room 3 motorized', 'Make them all blackout'],
      added: ['Show my cart', 'How long does it take?', 'What does the guarantee cover?'],
      privacy: ['Add top-down bottom-up', 'Add a white liner'], liner: 'Add a blackout liner',
    },
    open: v => `Open ${v}`,
  },
  es: {
    hello: v => `Hola, soy Mira. Dame la medida de tu ventana y preparo ${v} por ti, o elige una opción abajo. Solo cambio lo que me pidas.`,
    helloG: 'Hola, soy Mira. ¿En qué puedo ayudarte?',
    startersG: ['Ayúdame a elegir una tela', 'Cotización rápida', 'Tengo una pregunta'],
    guide: {
      fabricQ: 'Con gusto. Tres pasos rápidos: la gama, cuánta luz deja pasar y los colores que te gustaría ver. Te muestro todo lo que coincide; tú eliges.',
      need: 'Elige primero un color.',
      roomsFirst: 'Con gusto. Primero las habitaciones: ¿para cuáles es y cuántas ventanas tiene cada una? Márcalas abajo; una sola ventana también vale. O escribe tu propia lista (“sala 3, dormitorio 2”).',
      roomsQ: '¿Para qué habitaciones es y cuántas ventanas tiene cada una? Márcalas abajo; una sola ventana también vale. O escribe tu propia lista (“sala 3, dormitorio 2”).',
      roomsGo: 'Continuar',
      got: (r, n) => n === 1 ? 'Entendido: una ventana.' : r === 1 ? `Entendido: ${n} ventanas en una habitación.` : `Entendido: ${r} habitaciones, ${n} ventanas en total.`,
      sameQ: (v, s) => `Por ahora todas las habitaciones llevan ${v}. Pulsa Continuar para dejarlo así, o toca “${s}” para darle a una su propia tela.`,
      quoteQ: 'Con gusto. ¿Qué medida tiene la ventana y cuántas necesitas? Si las medidas son distintas, empieza por la más grande.',
      qSize: 'Medida de la ventana', qCount: '¿Cuántas ventanas?', qGo: 'Ver precios', qNeed: 'Escribe el ancho y el alto.',
      quoteA: n => `Aquí tienes desde cuánto empieza cada gama en esa medida${n > 1 ? `, para ${n} ventanas` : ''}: con las opciones tal como están en la página y envío gratis. Toca una gama para ver sus telas.`,
      quoteSize: 'Dime el ancho y el alto y te muestro desde cuánto empieza cada gama.',
      each: 'c/u', forN: (v, n) => `${v} por ${n}`,
      askQ: 'Claro, pregúntame lo que quieras. Esto es lo que más nos preguntan:',
      topics: ['¿Cuánto tarda la entrega?', '¿Qué cubre la garantía?', '¿Cómo mido la ventana?', '¿Puedo pedir muestras gratis?', '¿Qué diferencia hay entre montaje interior y exterior?'],
    },
    noun: { roman: 'esta cortina', cellular: 'esta cortina', pleated: 'esta cortina', drapery: 'este cortinaje' },
    thanks: 'Con mucho gusto.',
    lost: 'Puedo poner la medida, la tela, el color, el montaje y el mecanismo en esta página, agregar ventanas a tu carrito habitación por habitación, o responder dudas sobre entrega, medición y garantía. ¿Qué te gustaría hacer?',
    changed: n => n === 1 ? 'Listo. Cambié una cosa en la página:' : `Listo. Cambié ${n} cosas en la página:`,
    fits: v => `La medida sirve para ${v.toLowerCase()}`, fitsD: 'La medida está dentro de lo que fabricamos',
    undone: v => `Deshecho: volvió a ${v}.`,
    price: v => `Sale en ${v.price} cada una${v.qty > 1 ? `, ${v.total} por ${v.qty}` : ''}, con envío gratis.`,
    priceAccount: 'Los precios aparecen en cuanto tengas una cuenta gratis; toma un minuto.',
    priceNeedSize: 'Dime el ancho y el alto y te doy la cifra exacta.',
    priceSizeFirst: 'Dime primero el ancho y el alto, así el precio correcto te estará esperando.',
    otherPage: v => `Estás en la página de ${v.here}. ${v.there} tienen su propia página; puedo llevarte ahí y seguir desde este mensaje.`,
    chooseAsk: 'Con gusto. Marca las habitaciones, qué es lo importante en cada una y cuántas ventanas tiene. Te sugiero una tela para todas de una vez.',
    planTotal: v => `Total por ${v.units}: ${v.total}, con envío gratis.`,
    planNoSize: 'Los precios aparecen en cuanto tenga la medida.',
    need: { dark: 'Oscuro para dormir', soft: 'Luz suave', privacy: 'Privacidad', heat: 'Calor y frío' },
    needShort: { dark: 'oscuro', soft: 'luz suave', privacy: 'privacidad', heat: 'calor' },
    needPick: { dark: 'Oscuro', soft: 'Luz suave', privacy: 'Privacidad', heat: 'Calor / frío' },
    because: { dark: 'blackout', soft: 'filtra la luz', privacy: 'filtra la luz, privacidad de día', heat: 'más aislamiento' },
    pick: { size: '¿Todas de la misma medida? (opcional)', w: 'Ancho', h: 'Alto', go: 'Preparar estas habitaciones', none: 'Marca al menos una habitación.', all: 'todas de' },
    why: {
      dark: 'Para dormir yo iría por una tela blackout, así que eso dejé puesto.',
      soft: 'Para luz suave, lo indicado es un tejido que filtra la luz: ilumina sin deslumbrar.',
      privacy: 'Para privacidad, una tela que filtra la luz oculta la habitación de día. De noche, con las luces encendidas, un forro o la apertura superior e inferior te mantiene cubierto.',
      privacyF: 'Para privacidad yo agregaría el forro blanco: nadie ve hacia adentro y suaviza un poco la luz. Las telas traslúcidas se transparentan de noche, así que las dejo fuera.',
      softF: 'Para luz suave dejo fuera el blackout; todas las demás dejan pasar la luz.',
      heatC: 'Para el calor y el frío, la celda doble es el mejor aislante que fabricamos, así que la dejé puesta.',
      heat: 'Para el calor y el frío, las cortinas celulares aíslan mejor y tienen su propia página. En esta, un forro ayuda.',
      wet: 'Para una cocina o un baño yo elegiría algo delgado que quede pegado al vidrio: cortinas plisadas o celulares.',
      wetOk: 'Buena elección para cocina o baño: queda pegada al vidrio y no estorba.',
    },
    several: 'Dame la lista como quieras (“sala 3, dormitorio 2” o “5 habitaciones: 4, 3, 4, 2 y 5”) y la medida, si todas son iguales. Cada habitación entra a tu carrito como una línea aparte.',
    fabricsOpen: 'El paso de telas quedó abierto en la página. Toca un color ahí o dime uno: “algo gris”, “Ocean Teal”.',
    share: 'Aquí tienes un enlace a este diseño exacto. Quien lo abra verá la misma medida, tela y opciones.',
    human: 'Claro. Abrí el formulario; tu conversación conmigo va incluida para que no tengas que repetir nada.',
    rooms: v => `Entendido: ${v.rooms} habitaciones, ${v.units} ${v.unit} en total${v.size ? `, cada una de ${v.size}` : ''}.`,
    roomsCfg: v => `Las haré todas como la de esta página: ${v}.`,
    roomsAsk: v => `Cambia lo que quieras primero, para todas o para una sola (“habitación 3 con forro blackout”), ¿o agrego las ${v} a tu carrito?`,
    roomsAsk2: v => `¿Algo más que cambiar, o agrego las ${v} a tu carrito?`,
    planEdit: 'Puedes cambiar las medidas y la cantidad de ventanas directamente en la lista.',
    planNext: 'Revisa las medidas y la cantidad de ventanas en la lista. Cuando estén bien, pulsa el botón y elegimos colores y opciones para todas juntas.',
    planFill: 'Escribe las medidas en la lista (una por habitación o una por ventana), o dime una sola medida si todas son iguales.',
    planLater: '¿Aún sin medir? Pulsa el botón y elige primero la tela; las medidas pueden venir después.',
    planNeed: n => n === 1 ? 'A una ventana le falta la medida antes de poder agregarlas.' : `A ${n} ventanas les falta la medida antes de poder agregarlas.`,
    setup: {
      next: 'Siguiente: colores y opciones', first: 'Antes de pasarlas al carrito, elijamos juntos los colores y las opciones; toma un minuto.',
      intro: 'Ahora los detalles. Pregunto cada cosa una vez y vale para todas las ventanas; después puedes cambiar una sola habitación.',
      sizesLater: 'Las medidas pueden esperar: te las pido justo después de la tela.',
      sizeAsk: pr => pr ? '¿Quieres escribir las medidas ahora, para ver los precios, o prefieres elegir primero la tela?' : '¿Quieres escribir las medidas ahora o prefieres elegir primero la tela?',
      sizeNow: ['Escribir las medidas ahora', 'Así cada tela y cada opción muestra su precio.', 'Una por habitación o una por ventana.'],
      fabricFirst: ['Elegir primero la tela', 'Las medidas vienen justo después, y con ellas los precios.', 'Las medidas vienen justo después.'],
      sizeQ: 'Ahora las medidas. Escríbelas en la lista (una por habitación o una por ventana), o dime una sola medida si todas son iguales.',
      sizeMiss: n => n === 1 ? 'A una ventana todavía le falta la medida.' : `A ${n} ventanas todavía les falta la medida.`, sizesIn: 'Las medidas ya están.', sizeOk: 'Todas las ventanas tienen medida: pulsa Continuar en la lista.',
      mountMiss: 'Elige primero montaje interior o exterior para cada medida.', sizeMount: 'Junto a cada medida, elige montaje interior o exterior.',
      colourQ: 'Primero el color: ¿cuál te gustaría?',
      fabricQ: 'Primero la tela y su color, en tres pasos rápidos: la gama, cuánta luz deja pasar y los colores que te gustaría ver. Te muestro todo lo que coincide; tú eliges.',
      darkOne: 'Para una habitación oscura yo agregaría el forro blackout: va detrás de la tela que te guste, así que la tela y el color los eliges tú. Tres pasos rápidos y te muestro lo que hay.',
      kindSaid: 'Aquí tienes: dos pasos más y te muestro lo que tenemos.',
      famSaid: v => `Dos pasos rápidos y te muestro lo que tenemos en ${v}.`, famSet: v => `Listo: el filtro de color ahora muestra ${v}.`,
      famNone: v => `No hay ${v} en este tipo de tela; prueba con otro tipo o elige entre los colores de abajo.`,
      hidePrivacy: v => `Dejo fuera las traslúcidas para ${v}: de noche, con las luces encendidas, se ve a través de ellas.`,
      hideSoft: v => `Dejo fuera el blackout para ${v}, donde quieres luz suave.`,
      boHint: 'Detrás de la tela que elijas va un forro blackout; los precios de aquí ya lo incluyen.', boSheer: 'Detrás de una tela traslúcida, el forro le quita la transparencia.',
      privacyLiner: v => `Para ${v} yo agregaría el forro blanco, para que nadie vea hacia adentro.`,
      heatLiner: v => `Para ${v} un forro ayuda contra el calor y el frío; si eso es lo más importante, nuestras cortinas celulares son las que mejor aíslan.`,
      sheerLiner: 'Un detalle: detrás de una tela traslúcida, el forro blackout le quita la transparencia.',
      linerHas: (v, n, rest) => `${v} ya ${n > 1 ? 'tienen' : 'tiene'} su forro blackout desde el paso de la tela, así que esto es para ${rest}.`,
      thisWindow: 'esta ventana', and: 'y',
      wordSaid: 'Tres pasos rápidos y te muestro lo que hay; el color lo eliges tú.', wordPending: 'El color lo eliges tú: en el paso del color verás todo lo que coincide.',
      kindQ: '¿Qué gama?', opQ: '¿Cuánta luz debe pasar?', famQ: '¿Qué colores te gustaría ver?',
      kind: { budget: ['Económicas', 'Nuestros mejores precios'], classic: ['Clásicas', 'Precios intermedios'], solid: ['Lisas', 'Colores lisos'], wool: ['Mezcla de lana', 'Tejida con lana'], linen: ['Lino', 'Lino y mezclas de lino'], premium: ['Premium', 'Nuestras telas más finas'],
        pattern: ['Con diseño', 'Rayas y motivos tejidos'], any: ['Aún no lo sé', 'Muéstramelas todas'] },
      op: { sheer: ['Traslúcida', 'La mayor luz. De noche, con las luces encendidas, se ve hacia adentro.'], semi: ['Semitransparente', 'Entra la luz. De noche, desde afuera solo se ven siluetas.'], filter: ['Filtra la luz', 'Un resplandor suave. Nadie ve hacia adentro, ni de día ni de noche.'],
        linen: ['Lino', 'Lino y mezclas de lino.'], dim: ['Oscurece', 'Bloquea casi toda la luz; la habitación queda en penumbra, no a oscuras.'], blackout: ['Blackout', 'Cualquier tela de aquí, con un forro blackout detrás.'], any: ['Cualquiera', 'Muéstralas todas'] },
      from: v => `desde ${v}`, change: 'Cambiar', kindA: 'Gama', opA: 'Luz', otherFabrics: 'Ver otras telas',
      darkHint: v => `${v} debe quedar a oscuras: elige aquí el color que quieras; el forro blackout aparece en un momento.`,
      darkLiner: v => `Para ${v} yo agregaría el forro blackout, para que quede realmente a oscuras.`,
      darkOnly: v => [`Forro blackout solo en ${v}`, 'Sin forro en las demás habitaciones.'],
      linerMix: (d, p, rest) => [[d ? `Forro blackout en ${d}` : '', p ? `${d ? 'forro' : 'Forro'} blanco en ${p}` : ''].filter(Boolean).join(', '), rest ? 'Sin forro en las demás habitaciones.' : ''],
      fam: { white: 'Blancos y cremas', beige: 'Beiges y arenas', grey: 'Grises', dark: 'Tonos oscuros', blue: 'Azules', green: 'Verdes', warm: 'Tonos cálidos', pink: 'Rosas y morados', all: 'Ver todo' },
      scopeAll: 'Igual en todas', scopeRoom: 'Distinto por habitación', famFirst: 'Elige arriba una familia de color para ver las telas.', none: 'No hay nada en ese color; prueba con otro.',
      more: n => `Ver los ${n}`, allRooms: 'Todas las habitaciones',
      colourOne: 'El color lo eliges tú; estos son los que hay.',
      colourAll: n => `Los ${n} colores`, cont: 'Continuar', colourNeed: 'Elige primero un color para cada una.', pick: 'color por elegir',
      included: 'incluido', same: 'mismo precio', plus: (v, n) => n > 1 ? `+${v} por las ${n}` : `+${v}`, less: (v, n) => n > 1 ? `−${v} por las ${n}` : `−${v}`,
      done: 'Eso es todo. Aquí está tu pedido; las medidas y cantidades todavía se pueden cambiar en la lista.',
      mount: { q: '¿Dónde irán colocadas?', Inside: ['Dentro del marco de la ventana', 'Un aspecto limpio e integrado.'], Outside: ['Por fuera, sobre la pared', 'Cubre todo el vano y bloquea más luz en los bordes.'] },
      fold: { q: '¿Qué estilo te gustaría?', 'Back rods': ['Lisa y limpia', 'Tela lisa con pliegues parejos y nítidos.'], 'Front rods': ['Con varillas delgadas', 'Líneas horizontales finas sobre la tela: un aire sastre.'],
        'Hobbled': ['Ondas suaves', 'Pliegues en cascada de arriba abajo.'], 'Relaxed': ['Relajada', 'Una curva suave en la parte baja, natural e informal.'], 'Flat': ['Un solo paño liso', 'Sin varillas a la vista. Con cadena continua o motor.'] },
      drive: { q: v => v.loop && v.motor ? `Ahora ${v.n > 1 ? 'todas son' : 'es'} sin cordón: se suben y bajan a mano. Puedes pasar ${v.n > 1 ? 'las ' + v.n : 'esta'} a cadena continua por ${v.loop} más, o motorizarlas por ${v.motor} más.` : '¿Cómo te gustaría abrirlas y cerrarlas?',
        Cordless: ['Sin cordón', 'Se suben y bajan a mano. Nada al alcance de los niños.'], loop: ['Cadena continua', 'Una cadena al costado: cómoda en ventanas altas o anchas.'], Motorized: ['Motorizada', 'Con control remoto o desde el teléfono. Recargable, sin cables a la vista.'] },
      tdbu: { q: v => `La apertura superior e inferior permite bajar la cortina desde arriba además de subirla desde abajo: entra luz y se mantiene la privacidad.${v.price ? ` Agregarla a ${v.n > 1 ? 'las ' + v.n : 'esta'} cuesta ${v.price}.` : ''}`,
        No: ['No, gracias', 'Subir y bajar solo desde abajo.'], Yes: ['Agregar apertura superior e inferior', 'Se abre desde arriba, desde abajo o ambas.'] },
      liner: { q: 'Un forro evita que la tela se transparente desde afuera y la hace durar más. Un forro blackout bloquea la luz por completo.',
        Unlined: ['Sin forro', 'La tela sola.'], 'White liner': ['Forro blanco: privacidad', 'También llamado forro que filtra la luz: nadie ve hacia adentro, la luz se suaviza un poco y la tela dura más.'], 'Blackout liner': ['Forro blackout: sin luz', 'Para habitaciones que deben quedar totalmente oscuras.'] },
      banding: { q: v => `La última: ¿quieres ribete, un borde de color a los lados y abajo?${v.price ? ` Suma ${v.price}${v.n > 1 ? ' por las ' + v.n : ''}.` : ''}`, None: ['No, gracias', ''] },
      heading: { q: '¿Cómo quieres la parte superior del cortinaje?', 'Wave fold': ['Ondas suaves y parejas', 'Una línea moderna y relajada.'], 'Single pinch pleat': ['Pliegue sencillo', 'Ligero y sastre.'],
        'Double pinch pleat': ['Pliegue doble', 'Un aspecto clásico, con más cuerpo.'], 'Triple pinch pleat': ['Pliegue triple', 'El más lleno y tradicional.'], 'Euro pleat': ['Pliegue europeo', 'Pinzado arriba: nítido.'] },
      panel: { q: '¿Un panel o un par?', 'Single panel': ['Un panel', 'Se recoge hacia un lado.'], 'Pair, centre split': ['Un par', 'Se abre desde el centro.'] },
      track: { q: '¿Incluyo el riel?', wall: ['Sí, montado en la pared', ''], ceiling: ['Sí, montado en el techo', ''], no: ['Sin riel', 'Ya tienes tu propia barra o riel.'] },
      hdr: (r, n) => `${r} ${r === 1 ? 'habitación' : 'habitaciones'}, ${n} ${n === 1 ? 'ventana' : 'ventanas'}`,
    },
    plan: { size: 'Medida', win: n => `Ventana ${n}`, split: 'Cada ventana tiene su medida', same: 'La misma medida para todas', add: n => `Agregar las ${n} a mi carrito`, remove: 'Quitar', each: 'c/u', w: 'An', h: 'Al' },
    roomsNoSize: '¿De qué medida son? Si todas son iguales, basta una medida; si no, dímelo por habitación (“la habitación 2 es de 40 x 60”).',
    roomSet: v => `${v.room}: ${v.what}. Las demás habitaciones quedan igual.`,
    roomsStill: v => `Siguen en tu lista: ${v.rooms} habitaciones, ${v.units} ${v.unit}.`,
    roomsAdded: v => `Listo: ${v.lines} líneas, ${v.units} ${v.unit}, ya están en tu carrito, cada una con el nombre de su habitación.`,
    cartTotal: v => `Tu carrito suma ${v}, con envío gratis.`,
    afterAdd: 'Para cambiar una sola habitación ahora, usa Editar en su línea del carrito.',
    added1: v => `Agregado a tu carrito: ${v.qty} × ${v.cfg}.`,
    askAdd: '¿La agrego a tu carrito?',
    needChoice: v => `Falta una cosa antes de agregarla: ${v}. ¿Cuál prefieres?`,
    cartHere: v => `Tu carrito tiene ${v.lines} líneas, ${v.units} piezas; llevé la página hasta ahí.`,
    cartEmpty: 'Tu carrito todavía está vacío. Dime la medida y preparo la primera ventana.',
    measure: 'Mide el ancho y el alto al 1/8″ más cercano: la fabricamos a la medida exacta que nos das, así que vale la pena medir dos veces. ¿No sabes cómo medir tu ventana? Toca “Hablar con alguien” arriba y el equipo te ayuda.',
    samples: 'Las muestras de tela son gratis. Toca “Hablar con alguien” arriba, dile al equipo qué colores te gustan y ellos se encargan.',
    trade: 'Distribuidores y diseñadores tienen su propia área profesional, que se abre con un código de acceso; puedes solicitarlo en lumiashades.com/trade.html.',
    unit: { roman: 'cortinas', cellular: 'cortinas', pleated: 'cortinas', drapery: 'juegos de cortinajes' },
    q: { size: '¿Qué ancho y alto tiene? Puedes escribir algo como “34 1/2 x 60”.', sizeD: '¿Qué ancho debe cubrir el riel y qué caída necesitas? Puedes escribir algo como “96 x 90”.' },
    starters: ['Ayúdame a elegir', '¿Cuánto costará la mía?', 'Tengo varias ventanas'],
    chips: {
      choose: ['Dormitorio: oscuro para dormir', 'Sala: luz suave', 'Da a la calle: privacidad', 'Mucho calor o frío'],
      size: ['36 x 60', '48 x 72'], sizeD: ['72 x 84', '96 x 90'],
      several: ['sala 3, dormitorio 2, todas de 36 x 60', '5 habitaciones: 4, 3, 4, 2 y 5, todas de 36 x 60'],
      cfg: ['Agregar al carrito', 'Muéstrame los colores', 'Enviar a mi pareja'],
      project: ['Agrega todas a mi carrito', 'Habitación 3 con forro blackout', 'Forro blanco en todas'],
      projectC: ['Agrega todas a mi carrito', 'Habitación 3 motorizada', 'Todas en blackout'],
      added: ['Ver mi carrito', '¿Cuánto tarda?', '¿Qué cubre la garantía?'],
      privacy: ['Agregar apertura superior e inferior', 'Agregar forro blanco'], liner: 'Agregar forro blackout',
    },
    open: v => `Abrir ${v}`,
  },
  fr: {
    hello: v => `Bonjour, je suis Mira. Donnez-moi les dimensions de votre fenêtre et je prépare ${v} pour vous, ou choisissez une option ci-dessous. Je ne modifie que ce que vous demandez.`,
    helloG: 'Bonjour, je suis Mira. Que puis-je faire pour vous ?',
    startersG: ['Aidez-moi à choisir un tissu', 'Devis rapide', 'J’ai une question'],
    guide: {
      fabricQ: 'Volontiers. Trois choix rapides : la gamme, la quantité de lumière qui passe et les couleurs que vous aimeriez voir. Je vous montre tout ce qui correspond. Le choix vous appartient.',
      need: 'Choisissez d’abord une couleur.',
      roomsFirst: 'Volontiers. D’abord les pièces : lesquelles, et combien de fenêtres dans chacune ? Cochez-les ci-dessous. Une seule fenêtre convient aussi. Ou écrivez votre propre liste (« salon 3, chambre 2 »).',
      roomsQ: 'Pour quelles pièces, et combien de fenêtres dans chacune ? Cochez-les ci-dessous. Une seule fenêtre convient aussi. Ou écrivez votre propre liste (« salon 3, chambre 2 »).',
      roomsGo: 'Continuer',
      got: (r, n) => n === 1 ? 'C’est noté : une fenêtre.' : r === 1 ? `C’est noté : ${n} fenêtres dans une pièce.` : `C’est noté : ${r} pièces, ${n} fenêtres en tout.`,
      sameQ: (v, s) => `Pour l’instant, toutes les pièces ont ${v}. Appuyez sur Continuer pour le garder, ou touchez « ${s} » pour donner à une pièce son propre tissu.`,
      quoteQ: 'Volontiers. Quelles sont les dimensions de la fenêtre, et combien vous en faut-il ? Si les dimensions diffèrent, commencez par la plus grande.',
      qSize: 'Dimensions de la fenêtre', qCount: 'Combien de fenêtres ?', qGo: 'Voir les prix', qNeed: 'Indiquez la largeur et la hauteur.',
      quoteA: n => `Voici à partir de combien commence chaque gamme pour ces dimensions${n > 1 ? `, pour ${n} fenêtres` : ''} : avec les options telles qu’elles sont sur la page, livraison gratuite. Touchez une gamme pour voir ses tissus.`,
      quoteSize: 'Indiquez-moi la largeur et la hauteur et je vous montre à partir de combien commence chaque gamme.',
      each: 'l’unité', forN: (v, n) => `${v} pour ${n}`,
      askQ: 'Bien sûr, posez-moi vos questions. Voici ce qu’on nous demande le plus :',
      topics: ['Quel est le délai de livraison ?', 'Que couvre la garantie ?', 'Comment prendre les mesures ?', 'Puis-je recevoir des échantillons gratuits ?', 'Quelle est la différence entre pose intérieure et extérieure ?'],
    },
    noun: { roman: 'ce store', cellular: 'ce store', pleated: 'ce store', drapery: 'ces rideaux' },
    thanks: 'Avec plaisir.',
    lost: 'Je peux régler les dimensions, le tissu, la couleur, la pose et le mécanisme sur cette page, ajouter des fenêtres à votre panier pièce par pièce, ou répondre à vos questions sur la livraison, la prise de mesures et notre garantie. Que souhaitez-vous faire ?',
    changed: n => n === 1 ? 'C’est fait. J’ai modifié un élément sur la page :' : `C’est fait. J’ai modifié ${n} éléments sur la page :`,
    fits: v => `Dimensions compatibles : ${v.toLowerCase()}`, fitsD: 'Dimensions dans ce que nous fabriquons',
    undone: v => `Annulé : c’est revenu à ${v}.`,
    price: v => `Cela fait ${v.price} l’unité${v.qty > 1 ? `, soit ${v.total} pour ${v.qty}` : ''}, livraison gratuite.`,
    priceAccount: 'Les prix s’affichent dès que vous avez un compte gratuit. Cela prend une minute.',
    priceNeedSize: 'Donnez-moi la largeur et la hauteur et je vous indique le montant exact.',
    priceSizeFirst: 'Donnez-moi d’abord la largeur et la hauteur, pour que le bon prix vous attende.',
    otherPage: v => `Vous êtes sur la page « ${v.here} ». « ${v.there} » a sa propre page : je peux vous y emmener et reprendre à partir de ce message.`,
    chooseAsk: 'Volontiers. Cochez les pièces concernées, ce qui compte dans chacune et le nombre de fenêtres. Je propose un tissu pour chaque pièce en une fois.',
    planTotal: v => `Total pour les ${v.units} : ${v.total}, livraison gratuite.`,
    planNoSize: 'Les prix suivront dès que j’aurai les dimensions.',
    need: { dark: 'Noir pour dormir', soft: 'Lumière douce', privacy: 'Intimité', heat: 'Chaleur et froid' },
    needShort: { dark: 'noir', soft: 'lumière douce', privacy: 'intimité', heat: 'chaleur' },
    needPick: { dark: 'Noir', soft: 'Lumière douce', privacy: 'Intimité', heat: 'Chaud / froid' },
    because: { dark: 'occultant', soft: 'tamisant', privacy: 'tamisant, intime de jour', heat: 'isolation renforcée' },
    pick: { size: 'Toutes de la même taille ? (facultatif)', w: 'Largeur', h: 'Hauteur', go: 'Préparer ces pièces', none: 'Cochez au moins une pièce.', all: 'toutes' },
    why: {
      dark: 'Pour dormir, je choisirais un tissu occultant : c’est ce que j’ai réglé.',
      soft: 'Pour une lumière douce, un tissage tamisant est idéal : une belle clarté, sans éblouir.',
      privacy: 'Pour l’intimité, un tissu tamisant cache la pièce de jour. Le soir, lumières allumées, une doublure ou l’ouverture haut-bas vous protège des regards.',
      privacyF: 'Pour l’intimité, j’ajouterais la doublure blanche : personne ne voit à l’intérieur, et la lumière est un peu adoucie. Les voilages sont transparents le soir, je les laisse donc de côté.',
      softF: 'Pour une lumière douce, je laisse de côté l’occultant. Tout le reste laisse entrer la lumière.',
      heatC: 'Contre la chaleur et le froid, l’alvéole double est le meilleur isolant que nous fabriquons. Je l’ai donc réglée.',
      heat: 'Contre la chaleur et le froid, les stores alvéolaires isolent le mieux, et ils ont leur propre page. Ici, une doublure aide.',
      wet: 'Pour une cuisine ou une salle de bain, je choisirais quelque chose de fin, près de la vitre : des stores plissés ou alvéolaires.',
      wetOk: 'Un bon choix pour une cuisine ou une salle de bain : il reste près de la vitre et ne gêne pas.',
    },
    several: 'Donnez-moi la liste comme vous voulez (« salon 3, chambre 2 » ou « 5 pièces : 4, 3, 4, 2, 5 ») et les dimensions, si elles sont toutes identiques. Chaque pièce devient une ligne à part dans votre panier.',
    fabricsOpen: 'L’étape du tissu est ouverte sur la page. Touchez une couleur, ou dites-m’en une : « quelque chose de gris », « Ocean Teal ».',
    share: 'Voici un lien vers ce modèle précis. La personne qui l’ouvre voit les mêmes dimensions, le même tissu et les mêmes options.',
    human: 'Bien sûr. J’ai ouvert le formulaire. Notre conversation est jointe, vous n’aurez donc rien à répéter.',
    rooms: v => `C’est noté : ${v.rooms} pièces, ${v.units} ${v.unit} en tout${v.size ? `, chacun en ${v.size}` : ''}.`,
    roomsCfg: v => `Je les fais tous comme celui de cette page : ${v}.`,
    roomsAsk: v => `Voulez-vous d’abord modifier quelque chose, pour tous ou pour une seule pièce (« pièce 3 avec doublure occultante ») ? Sinon, j’ajoute les ${v} à votre panier ?`,
    roomsAsk2: v => `Autre chose à modifier ? Sinon, j’ajoute les ${v} à votre panier ?`,
    planEdit: 'Vous pouvez modifier les dimensions et le nombre de fenêtres directement dans la liste.',
    planNext: 'Vérifiez les dimensions et le nombre de fenêtres dans la liste. Quand tout est bon, appuyez sur le bouton et nous choisissons ensemble les couleurs et les options pour toutes.',
    planFill: 'Saisissez les dimensions dans la liste (une par pièce, ou une par fenêtre), ou donnez-moi une seule dimension si elles sont toutes identiques.',
    planLater: 'Pas encore mesuré ? Appuyez sur le bouton et choisissez d’abord le tissu. Les dimensions peuvent venir ensuite.',
    planNeed: n => n === 1 ? 'Il manque encore les dimensions d’une fenêtre avant que je puisse les ajouter.' : `Il manque encore les dimensions de ${n} fenêtres avant que je puisse les ajouter.`,
    setup: {
      next: 'Suite : couleurs et options', first: 'Avant de les mettre au panier, choisissons ensemble les couleurs et les options. Cela ne prend qu’une minute.',
      intro: 'Passons aux détails. Je pose chaque question une seule fois et elle vaut pour toutes les fenêtres. Vous pourrez encore modifier une pièce ensuite.',
      sizesLater: 'Les dimensions peuvent attendre : je vous les demanderai juste après le tissu.',
      sizeAsk: pr => pr ? 'Voulez-vous saisir les dimensions maintenant, pour voir les prix, ou choisir d’abord le tissu ?' : 'Voulez-vous saisir les dimensions maintenant, ou choisir d’abord le tissu ?',
      sizeNow: ['Saisir les dimensions maintenant', 'Chaque tissu et chaque option affiche alors son prix.', 'Une par pièce, ou une par fenêtre.'],
      fabricFirst: ['Choisir d’abord le tissu', 'Les dimensions viennent juste après, et les prix avec.', 'Les dimensions viennent juste après.'],
      sizeQ: 'Maintenant, les dimensions. Saisissez-les dans la liste (une par pièce, ou une par fenêtre), ou donnez-moi une seule dimension si elles sont toutes identiques.',
      sizeMiss: n => n === 1 ? 'Il manque encore les dimensions d’une fenêtre.' : `Il manque encore les dimensions de ${n} fenêtres.`, sizesIn: 'Les dimensions sont saisies.', sizeOk: 'Chaque fenêtre a ses dimensions : appuyez sur Continuer dans la liste.',
      mountMiss: 'Choisissez d’abord la pose intérieure ou extérieure pour chaque dimension.', sizeMount: 'À côté de chaque dimension, choisissez la pose intérieure ou extérieure.',
      colourQ: 'D’abord la couleur : laquelle souhaitez-vous ?',
      fabricQ: 'D’abord le tissu et sa couleur, en trois choix rapides : la gamme, la quantité de lumière qu’il laisse passer et les couleurs que vous aimeriez voir. Je vous montre tout ce qui correspond. Le choix vous appartient.',
      darkOne: 'Pour une pièce sombre, j’ajouterais la doublure occultante : elle se place derrière le tissu de votre choix, le tissu et la couleur restent donc les vôtres. Trois choix rapides et je vous montre ce que nous avons.',
      kindSaid: 'Voici : encore deux choix rapides et je vous montre ce que nous avons.',
      famSaid: v => `Deux choix rapides et je vous montre ce que nous avons en ${v}.`, famSet: v => `C’est fait : le filtre de couleur affiche maintenant ${v}.`,
      famNone: v => `Rien en ${v} dans ce type de tissu. Essayez un autre type, ou choisissez parmi les couleurs ci-dessous.`,
      hidePrivacy: v => `Les voilages sont écartés pour ${v} : le soir, lumières allumées, on voit à travers.`,
      hideSoft: v => `L’occultant est écarté pour ${v}, où vous voulez une lumière douce.`,
      boHint: 'Une doublure occultante se place derrière le tissu choisi. Les prix affichés ici l’incluent.', boSheer: 'Derrière un voilage, la doublure supprime l’effet de transparence.',
      privacyLiner: v => `Pour ${v}, j’ajouterais la doublure blanche, afin que personne ne voie à l’intérieur.`,
      heatLiner: v => `Pour ${v}, une doublure aide à garder la chaleur et le froid dehors. Si c’est le plus important, nos stores alvéolaires isolent le mieux.`,
      sheerLiner: 'À savoir : derrière un voilage, une doublure occultante supprime l’effet de transparence.',
      linerHas: (v, n, rest) => `${v} ${n > 1 ? 'ont déjà leur' : 'a déjà sa'} doublure occultante depuis l’étape du tissu. Ceci concerne donc ${rest}.`,
      thisWindow: 'cette fenêtre', and: 'et',
      wordSaid: 'Trois choix rapides et je vous montre ce que nous avons. La couleur, c’est vous qui la choisissez.', wordPending: 'La couleur, c’est vous qui la choisissez : vous verrez tout ce qui correspond à l’étape de la couleur.',
      kindQ: 'Quelle gamme ?', opQ: 'Quelle quantité de lumière doit passer ?', famQ: 'Quelles couleurs aimeriez-vous voir ?',
      kind: { budget: ['Petit budget', 'Nos meilleurs prix'], classic: ['Classiques', 'Prix intermédiaires'], solid: ['Unis', 'Couleurs unies'], wool: ['Mélange de laine', 'Tissé avec de la laine'], linen: ['Lin', 'Lin et mélanges de lin'], premium: ['Premium', 'Nos plus beaux tissus'],
        pattern: ['À motifs', 'Rayures et motifs tissés'], any: ['Pas encore décidé', 'Tout me montrer'] },
      op: { sheer: ['Voilage', 'Le plus de lumière. Le soir, lumières allumées, on voit à l’intérieur.'], semi: ['Semi-transparent', 'La lumière du jour entre. Le soir, on ne distingue que des silhouettes de l’extérieur.'], filter: ['Tamisant', 'Une lumière douce. Personne ne voit à l’intérieur, de jour comme de nuit.'],
        linen: ['Lin', 'Lin et mélanges de lin.'], dim: ['Obscurcissant', 'Bloque la plus grande partie de la lumière. La pièce reste sombre, sans être dans le noir complet.'], blackout: ['Occultant', 'N’importe quel tissu, avec une doublure occultante derrière.'], any: ['Tous', 'Tout afficher'] },
      from: v => `à partir de ${v}`, change: 'Modifier', kindA: 'Gamme', opA: 'Lumière', otherFabrics: 'Voir d’autres tissus',
      darkHint: v => `${v} doit être sombre : choisissez ici la couleur que vous voulez. La doublure occultante arrive dans un instant.`,
      darkLiner: v => `Pour ${v}, j’ajouterais la doublure occultante, pour que la pièce soit vraiment sombre.`,
      darkOnly: v => [`Doublure occultante dans ${v} seulement`, 'Pas de doublure dans les autres pièces.'],
      linerMix: (d, p, rest) => [[d ? `Doublure occultante dans ${d}` : '', p ? `${d ? 'doublure' : 'Doublure'} blanche dans ${p}` : ''].filter(Boolean).join(', '), rest ? 'Pas de doublure dans les autres pièces.' : ''],
      fam: { white: 'Blancs et crèmes', beige: 'Beiges et sables', grey: 'Gris', dark: 'Tons sombres', blue: 'Bleus', green: 'Verts', warm: 'Tons chauds', pink: 'Roses et violets', all: 'Tout afficher' },
      scopeAll: 'Le même partout', scopeRoom: 'Différent par pièce', famFirst: 'Choisissez une famille de couleurs ci-dessus pour voir les tissus.', none: 'Rien dans cette couleur. Essayez-en une autre.',
      more: n => `Afficher les ${n}`, allRooms: 'Toutes les pièces',
      colourOne: 'La couleur, c’est vous qui la choisissez. Voici ce qui existe.',
      colourAll: n => `Les ${n} couleurs`, cont: 'Continuer', colourNeed: 'Choisissez d’abord une couleur pour chacune.', pick: 'couleur à choisir',
      included: 'inclus', same: 'même prix', plus: (v, n) => n > 1 ? `+${v} pour les ${n}` : `+${v}`, less: (v, n) => n > 1 ? `−${v} pour les ${n}` : `−${v}`,
      done: 'C’est tout. Voici votre commande. Les dimensions et les quantités peuvent encore être modifiées dans la liste.',
      mount: { q: 'Où seront-ils posés ?', Inside: ['Dans le cadre de la fenêtre', 'Un rendu net et intégré.'], Outside: ['À l’extérieur, sur le mur', 'Couvre toute l’ouverture et bloque davantage la lumière sur les bords.'] },
      fold: { q: 'Quel style souhaitez-vous ?', 'Back rods': ['Plat et net', 'Tissu lisse aux plis nets et réguliers.'], 'Front rods': ['Avec de fines baguettes', 'De fines lignes horizontales sur le tissu, pour un style soigné.'],
        'Hobbled': ['Ondulations douces', 'Des plis en cascade sur toute la hauteur.'], 'Relaxed': ['Détendu', 'Une courbe douce en bas, simple et décontractée.'], 'Flat': ['Un seul panneau lisse', 'Pas de baguettes sur le tissu. Avec chaînette continue ou moteur.'] },
      drive: { q: v => v.loop && v.motor ? `Pour l’instant, ${v.n > 1 ? 'ils sont tous' : 'il est'} sans cordon : on monte et on descend à la main. Vous pouvez passer ${v.n > 1 ? 'les ' + v.n : 'celui-ci'} à la chaînette continue pour ${v.loop} de plus, ou au moteur pour ${v.motor} de plus.` : 'Comment souhaitez-vous les ouvrir et les fermer ?',
        Cordless: ['Sans cordon', 'On monte et on descend à la main. Rien à la portée des enfants.'], loop: ['Chaînette continue', 'Une boucle continue sur le côté, pratique pour les fenêtres hautes ou larges.'], Motorized: ['Motorisé', 'Une télécommande ou votre téléphone. Rechargeable, sans câblage apparent.'] },
      tdbu: { q: v => `L’ouverture haut-bas permet d’abaisser le store par le haut autant que de le relever par le bas : la lumière entre, l’intimité reste.${v.price ? ` L’ajouter ${v.n > 1 ? 'aux ' + v.n : 'à celui-ci'} coûte ${v.price}.` : ''}`,
        No: ['Non, merci', 'Monter et descendre par le bas uniquement.'], Yes: ['Ajouter l’ouverture haut-bas', 'Ouvrir par le haut, par le bas, ou les deux.'] },
      liner: { q: 'Une doublure empêche de voir à travers le tissu depuis l’extérieur et l’aide à durer plus longtemps. Une doublure occultante bloque complètement la lumière.',
        Unlined: ['Sans doublure', 'Le tissu seul.'], 'White liner': ['Doublure blanche, pour l’intimité', 'Aussi appelée doublure tamisante : personne ne voit à l’intérieur depuis l’extérieur, la lumière est un peu adoucie et le tissu dure plus longtemps.'], 'Blackout liner': ['Doublure occultante, aucune lumière', 'Pour les pièces qui doivent être complètement sombres.'] },
      banding: { q: v => `Dernière question : souhaitez-vous un galon de bordure, une bande de couleur sur les côtés et en bas ?${v.price ? ` Il ajoute ${v.price}${v.n > 1 ? ' pour les ' + v.n : ''}.` : ''}`, None: ['Non, merci', ''] },
      heading: { q: 'Quel aspect pour le haut des rideaux ?', 'Wave fold': ['Ondulations douces et régulières', 'Une ligne moderne et souple.'], 'Single pinch pleat': ['Pli simple', 'Léger et soigné.'],
        'Double pinch pleat': ['Pli double', 'Un style classique, plus ample.'], 'Triple pinch pleat': ['Pli triple', 'Le plus ample, le plus traditionnel.'], 'Euro pleat': ['Pli européen', 'Pincé tout en haut, très net.'] },
      panel: { q: 'Un panneau ou une paire ?', 'Single panel': ['Un panneau', 'Se range d’un seul côté.'], 'Pair, centre split': ['Une paire', 'S’ouvre par le centre.'] },
      track: { q: 'Dois-je inclure le rail ?', wall: ['Oui, posé au mur', ''], ceiling: ['Oui, posé au plafond', ''], no: ['Sans rail', 'Vous avez votre propre tringle ou rail.'] },
      hdr: (r, n) => `${r} ${r === 1 ? 'pièce' : 'pièces'}, ${n} ${n === 1 ? 'fenêtre' : 'fenêtres'}`,
    },
    plan: { size: 'Dimensions', win: n => `Fenêtre ${n}`, split: 'Chaque fenêtre a ses propres dimensions', same: 'Mêmes dimensions pour toutes', add: n => `Ajouter les ${n} à mon panier`, remove: 'Retirer', each: 'l’unité', w: 'L', h: 'H' },
    roomsNoSize: 'Quelles sont leurs dimensions ? Si elles sont toutes identiques, une seule suffit. Sinon, dites-le-moi pièce par pièce (« la pièce 2 fait 40 x 60 »).',
    roomSet: v => `${v.room} : ${v.what}. Les autres pièces restent telles quelles.`,
    roomsStill: v => `Toujours en attente dans votre liste : ${v.rooms} pièces, ${v.units} ${v.unit}.`,
    roomsAdded: v => `C’est fait : ${v.lines} lignes, ${v.units} ${v.unit}, sont dans votre panier, chacune au nom de sa pièce.`,
    cartTotal: v => `Votre panier s’élève à ${v}, livraison gratuite.`,
    afterAdd: 'Pour modifier une seule pièce maintenant, utilisez Modifier sur sa ligne dans le panier.',
    added1: v => `Ajouté à votre panier : ${v.qty} × ${v.cfg}.`,
    askAdd: 'Je l’ajoute à votre panier ?',
    needChoice: v => `Il reste un choix à faire avant que je puisse l’ajouter : ${v}. Lequel souhaitez-vous ?`,
    cartHere: v => `Votre panier contient ${v.lines} lignes, ${v.units} articles. J’ai fait défiler la page jusqu’à lui.`,
    cartEmpty: 'Votre panier est encore vide. Donnez-moi les dimensions et je prépare la première fenêtre.',
    measure: 'Mesurez la largeur et la hauteur au 1/8″ près : nous fabriquons aux dimensions exactes que vous donnez, cela vaut donc la peine de mesurer deux fois. Vous ne savez pas comment mesurer votre fenêtre ? Appuyez sur « Parler à quelqu’un » en haut et l’équipe vous aidera.',
    samples: 'Les échantillons de tissu sont gratuits. Appuyez sur « Parler à quelqu’un » en haut, indiquez à l’équipe les couleurs qui vous plaisent, et elle s’en occupe.',
    trade: 'Les revendeurs et les décorateurs ont leur propre espace professionnel, accessible avec un code d’accès. Vous pouvez en faire la demande sur lumiashades.com/trade.html.',
    unit: { roman: 'stores', cellular: 'stores', pleated: 'stores', drapery: 'ensembles de rideaux' },
    q: { size: 'Quelles sont la largeur et la hauteur ? Par exemple « 34 1/2 x 60 ».', sizeD: 'Quelle largeur pour le rail, et quelle hauteur de tombée ? Par exemple « 96 x 90 ».' },
    starters: ['Aidez-moi à choisir pour ma pièce', 'Combien coûtera le mien ?', 'J’ai plusieurs fenêtres'],
    chips: {
      choose: ['Chambre : noir pour dormir', 'Salon : lumière douce', 'Côté rue : intimité', 'Trop chaud ou trop froid'],
      size: ['36 x 60', '48 x 72'], sizeD: ['72 x 84', '96 x 90'],
      several: ['salon 3, chambre 2, toutes en 36 x 60', '5 pièces : 4, 3, 4, 2, 5, toutes en 36 x 60'],
      cfg: ['Ajouter au panier', 'Montrez-moi les couleurs', 'Envoyer à mon conjoint'],
      project: ['Tout ajouter à mon panier', 'Pièce 3 avec doublure occultante', 'Doublure blanche dans toutes'],
      projectC: ['Tout ajouter à mon panier', 'Pièce 3 motorisée', 'Toutes en occultant'],
      added: ['Voir mon panier', 'Combien de temps faut-il ?', 'Que couvre la garantie ?'],
      privacy: ['Ajouter l’ouverture haut-bas', 'Ajouter une doublure blanche'], liner: 'Ajouter une doublure occultante',
    },
    open: v => `Ouvrir ${v}`,
  },
};
Object.keys(SAY).forEach(l => Object.assign(SAY[l], B.ANSWERS[l]));
const frFix = (x) => typeof x === 'string' ? x.replace(/ ([?!:;»])/g, '\u00A0$1').replace(/« /g, '«\u00A0') : x;
(function frWalk(o){
  Object.keys(o).forEach(k => {
    const v = o[k];
    if(typeof v === 'function') o[k] = (...a) => { const r = v(...a); return Array.isArray(r) ? r.map(frFix) : frFix(r); };
    else if(Array.isArray(v)) o[k] = v.map(frFix);
    else if(v && typeof v === 'object') frWalk(v);
    else o[k] = frFix(v);
  });
  return frWalk;
})(UI.fr)(SAY.fr);
const S = () => SAY[M.lang];
const STARTER_ICON = [
  '<path d="M12 3l2.4 5.6L20 9.3l-4.3 3.9 1.3 5.8L12 16l-5 3 1.3-5.8L4 9.3l5.6-.7z"/>',                 /* choose */
  '<path d="M4 12V5h7l9 9-7 7z"/><circle cx="8.5" cy="8.5" r="1.3"/>',                                    /* cost */
  '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>', /* several */
];
/* the guided start: a fabric, a price, a question */
const STARTER_ICON_G = [
  '<path d="M4 7c3-2.2 5 2.2 8 0s5-2.2 8 0v10c-3-2.2-5 2.2-8 0s-5-2.2-8 0z"/>',
  STARTER_ICON[1],
  '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9"/><path d="M12 16.9v.1"/>',
];

/* ════════ the shop, seen as a design ════════ */
function designOf(snap){
  const d = { product: snap.pid, qty: snap.qty, w: snap.w, h: snap.h, sized: M.sizeSaid, wSet: M.sizeSaid, hSet: M.sizeSaid };
  KEYS.forEach(k => { if(snap.sel[k] != null) d[k] = snap.sel[k]; });
  return d;
}
function changed(a, b){ return KEYS.filter(k => a[k] !== b[k] && b[k] != null); }
const cleanName = (n) => String(n).replace(/^\d+\s*[—–-]\s*/, '').replace(/\s*\(\d+\)$/, '');
function fabricLabel(d){
  if(d.product === 'pleated') return (M.lang === 'es' ? 'plisado ' + tv(d.fabric).toLowerCase() : M.lang === 'fr' ? 'plissé ' + tv(d.fabric).toLowerCase() : d.fabric + ' pleat') + ' · ' + tv(d.colour);
  const c = core.collectionOf(M.cat, d.product, d.collection);
  return tv(c ? c.label : d.collection) + ' · ' + cleanName(core.colourName(M.cat, d));
}
const sizeLabel = (d) => core.fmtIn(d.w) + ' × ' + core.fmtIn(d.h);
/* room names are stored the shop's way (English); Spanish and French are for display and for the quick replies */
const ROOM_FR = { 'Kids Room': 'Chambre d’enfant', 'Living Room': 'Salon', 'Bedroom': 'Chambre', 'Kitchen': 'Cuisine', 'Dining Room': 'Salle à manger', 'Bathroom': 'Salle de bain', 'Home Office': 'Bureau', 'Nursery': 'Chambre bébé' };
const ROOM_ES = { 'Kids Room': 'Cuarto de los niños', 'Living Room': 'Sala', 'Bedroom': 'Dormitorio', 'Kitchen': 'Cocina', 'Dining Room': 'Comedor', 'Bathroom': 'Baño', 'Home Office': 'Oficina', 'Nursery': 'Cuarto del bebé' };
function roomName(label){
  const T = M.lang === 'es' ? ROOM_ES : M.lang === 'fr' ? ROOM_FR : null;
  if(!T) return label;
  const m = String(label).match(/^Room (\d+)$/);
  if(m) return (M.lang === 'fr' ? 'Pièce ' : 'Habitación ') + m[1];
  const k = String(label).match(/^(.+) (\d+)$/);                    /* "Bedroom 2" */
  return k && T[k[1]] ? T[k[1]] + ' ' + k[2] : (T[label] || label);
}
const prodName = (pid) => tv(M.cat[pid].name);
function cfgLabel(d){
  return [fabricLabel(d), sizeLabel(d)].concat([d.mount, d.fold, d.heading, d.drive].filter(Boolean).map(v => tv(v).toLowerCase()))
    .concat(d.tdbu === 'Yes' ? ['TDBU'] : []).concat(d.liner && d.liner !== 'Unlined' ? [tv(d.liner).toLowerCase()] : []).join(', ');
}
/* what one design has that another does not, in words */
function diffLabel(base, d){
  const out = [];
  if(d.collection !== base.collection || d.colour !== base.colour || d.fabric !== base.fabric) out.push(fabricLabel(d));
  if(d.w !== base.w || d.h !== base.h) out.push(sizeLabel(d));
  ['mount', 'fold', 'heading', 'panel', 'drive', 'liner', 'tdbu', 'trackopt'].forEach(k => {
    if(d[k] !== base[k] && d[k] != null) out.push(k === 'tdbu' ? 'TDBU ' + tv(d[k]).toLowerCase() : tv(d[k]).toLowerCase());
  });
  return out.join(', ');
}
/* the same difference as rows for the change card: [label, value] */
function diffRows(a, b){
  const R = t('row'), rows = [];
  if(b.w !== a.w || b.h !== a.h) rows.push([R.size, sizeLabel(b)]);
  if(b.product === 'pleated'){
    if(b.fabric !== a.fabric) rows.push([R.pleat, tv(b.fabric)]);
    if(b.colour !== a.colour) rows.push([R.colour, tv(b.colour)]);
  } else if(b.collection !== a.collection || b.colour !== a.colour) rows.push([b.product === 'cellular' ? R.cell : R.fabric, fabricLabel(b)]);
  ['mount', 'drive', 'fold', 'heading', 'panel', 'liner', 'tdbu', 'trackopt', 'track', 'banding', 'chain'].forEach(k => {
    if(b[k] !== a[k] && b[k] != null) rows.push([R[k], tv(b[k])]);
  });
  if(b.qty !== a.qty) rows.push([R.qty, String(b.qty)]);
  return rows;
}
/* write a design back into the page, and show where it went */
function toShop(before, after){
  const ch = changed(before, after), sel = {};
  ch.forEach(k => { sel[k] = after[k]; });
  const sizeCh = after.w !== before.w || after.h !== before.h;
  const open = (ch.indexOf('collection') !== -1 || ch.indexOf('colour') !== -1) ? 'collection' : ch.filter(k => k !== 'collection' && k !== 'colour')[0] || (sizeCh ? '_size' : null);
  if(!ch.length && !sizeCh && after.qty === before.qty) return false;
  SHOP.configure({ sel, w: after.w, h: after.h, qty: after.qty, open });
  showStep(open);
  return true;
}
function showStep(key){
  if(!key || !wide.matches) return;
  const head = document.querySelector('#steps .grphead[data-acc="' + key + '"]');
  if(!head) return;
  head.classList.add('mira-flash'); setTimeout(() => head.classList.remove('mira-flash'), 1800);
  const r = head.getBoundingClientRect();
  if(r.top < 90 || r.bottom > window.innerHeight - 140) head.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function money(v){ return core.money(v); }
/* a link that opens this page on exactly this design (the shop reads these itself) */
function shareLink(){
  const s = SHOP.snapshot(), p = M.cat[s.pid], q = new URLSearchParams();
  if(p.steps.collection){ q.set('fabric', s.sel.collection); q.set('color', s.sel.colour); }
  Object.keys(p.steps).forEach(k => {
    if(k === 'collection' || k === 'cgroup' || s.sel[k] == null) return;
    q.set(k, s.sel[k]);
  });
  q.set('w', s.w); q.set('h', s.h);
  return location.origin + location.pathname + '?' + q.toString();
}

/* ════════ Mira's sample replies ════════ */
function projectUnits(){ return M.project.rooms.reduce((n, r) => n + r.qty, 0); }
/* a room = the page's configuration plus that room's own changes */
function roomDesign(base, r){ return Object.keys(r.patch).length ? core.applyPatch(M.cat, base, r.patch).design : base; }
function newRoom(label, qty, need, patch){ return { label, qty, need: need || null, patch: patch || {}, split: false, sizes: Array(qty).fill(null), mounts: Array(qty).fill(null), colourChosen: false }; }
function newProject(rooms){ return { rooms, added: false, setup: { at: -1, done: false, opts: null, key: '' } }; }
/* every window of every room. A window with no size of its own takes the page's size once
   the customer has given one; `design` is what would be built (the size checked against the rules) */
function projectWindows(base){
  const out = [];
  M.project.rooms.forEach((r, i) => {
    const rd = roomDesign(base, r);
    for(let k = 0; k < r.qty; k++){
      const sz = r.sizes[k] || (M.sizeSaid ? { w: base.w, h: base.h } : null);
      if(!sz){ out.push({ i, k, design: null, notes: [] }); continue; }
      const mt = r.mounts && r.mounts[k];                  /* the mount chosen beside this size */
      const o = core.applyPatch(M.cat, rd, mt ? { w: sz.w, h: sz.h, mount: mt } : { w: sz.w, h: sz.h });
      out.push({ i, k, design: o.design, notes: o.notes });
    }
  });
  return out;
}
function selDiff(base, d){ const sel = {}; changed(base, d).forEach(k => { sel[k] = d[k]; }); return sel; }
/* cart lines: windows of one room that come out identical share a line */
function roomItems(base){
  const items = [], seen = {};
  projectWindows(base).forEach(x => {
    if(!x.design) return;
    const sel = selDiff(base, x.design), key = x.i + '|' + JSON.stringify(sel) + '|' + x.design.w + 'x' + x.design.h;
    if(seen[key] != null){ items[seen[key]].qty++; return; }
    seen[key] = items.length;
    items.push({ label: M.project.rooms[x.i].label, qty: 1, sel, w: x.design.w, h: x.design.h });
  });
  return items;
}
function unsized(){ return projectWindows(designOf(SHOP.snapshot())).filter(x => !x.design).length; }
/* Roman shades: inside or outside mount is asked beside each size (Kaan, 2026-11-27), not as a question of its own.
   A window's mount is its own row's answer — or what was said for its room, or for all of them. */
const mountInRow = (pid) => pid === 'roman';
function mountOf(r, k, base){ return (r.mounts && r.mounts[k]) || r.patch.mount || (M.decided.mount ? base.mount : null) || null; }
function unmounted(){
  const snap = SHOP.snapshot(); if(!M.project || !mountInRow(snap.pid)) return 0;
  const base = designOf(snap); let n = 0;
  M.project.rooms.forEach(r => { for(let k = 0; k < r.qty; k++) if(!mountOf(r, k, base)) n++; });
  return n;
}
function missingLabel(snap){
  const p = M.cat[snap.pid];
  return snap.missing.map(k => (p.steps[k] ? tv(p.steps[k].label) + ' (' + core.options(M.cat, snap.pid, k).map(o => tv(o).toLowerCase()).join(' / ') + ')' : k)).join(', ');
}
/* ════════ the finishing questions ════════
   Asked once the rooms and their sizes stand, and answered for every window at once: colour,
   mount, look, mechanism, top-down bottom-up, liner, edge banding. Mira suggests, the customer
   chooses — and every option says what it adds to the whole list. */
const BAND_HEX = { 'Beige': '#E6DCC3', 'Tan': '#B08D4F', 'Red': '#C01F2F', 'Grey': '#63655C', 'Navy': '#1C2340', 'Moss': '#3C4237', 'Black': '#141414' };
function setupSteps(){
  const pid = SHOP.snapshot().pid, p = M.cat[pid].steps;
  /* the sizes may wait until the fabric is chosen (Kaan): they are asked right after it, if any are still missing —
     before the options, so that each option can say what it costs */
  const order = pid === 'drapery' ? ['colour', 'size', 'heading', 'panel', 'liner', 'track'] : ['colour', 'size', 'mount', 'fold', 'drive', 'tdbu', 'liner', 'banding'];
  return order.filter(k => k === 'colour' || k === 'size' ? true : k === 'track' ? !!p.trackopt : k === 'mount' && mountInRow(pid) ? false : !!p[k]);
}
/* what the whole list costs — as it is, or with one thing changed for every window; null where the page shows no prices */
function totalWith(over){
  const base = designOf(SHOP.snapshot()), items = [];
  projectWindows(base).forEach(x => {
    if(!x.design) return;
    const ov = typeof over === 'function' ? over(x.i) : over;
    const d = ov ? core.applyPatch(M.cat, x.design, ov).design : x.design;
    items.push({ sel: selDiff(base, d), w: d.w, h: d.h });
  });
  if(!items.length || !SHOP.quote) return null;
  const q = SHOP.quote(items);
  return q.some(v => v == null) ? null : Math.round(q.reduce((n, v) => n + v, 0) * 100) / 100;
}
function stepOptions(key){
  const snap = SHOP.snapshot(), pid = snap.pid, base = designOf(snap), L = S().setup, T = L[key] || {}, n = projectUnits();
  const now = totalWith(null);
  const mk = (v, patch, extra) => {
    const cur = Object.keys(patch).every(k => base[k] === patch[k]);
    const then = now == null ? null : totalWith((extra && extra.byRoom) || patch), diff = then == null ? null : Math.round((then - now) * 100) / 100;
    return Object.assign({ v, patch, cur, diff, label: (T[v] || [tv(v)])[0], desc: (T[v] || ['', ''])[1] || '',
      price: diff == null ? '' : Math.abs(diff) < .005 ? (cur ? L.included : L.same) : diff > 0 ? L.plus(money(diff), n) : L.less(money(-diff), n) }, extra || {});
  };
  const step = M.cat[pid].steps[key], imgs = (step && step.imgs) || {};
  const flat = (list) => { if(list.every(o => o.diff == null || Math.abs(o.diff) < .005)) list.forEach(o => { o.price = ''; o.cur = false; }); return list; };
  if(key === 'mount') return flat(core.options(M.cat, pid, 'mount').map(o => mk(o, { mount: o })));
  if(key === 'drive') return core.options(M.cat, pid, 'drive').map(o => mk(/cord loop/i.test(o) ? 'loop' : o, { drive: o }));
  if(key === 'fold') return ['Back rods', 'Front rods', 'Hobbled', 'Relaxed', 'Flat'].filter(o => core.options(M.cat, pid, 'fold').indexOf(o) !== -1).map(o => mk(o, { fold: o }, { img: imgs[o] || '' }));
  if(key === 'heading') return flat(core.options(M.cat, pid, 'heading').map(o => mk(o, { heading: o }, { img: imgs[o] || '' })));
  if(key === 'banding') return core.options(M.cat, pid, 'banding').map(o => mk(o, { banding: o }, o === 'None' ? {} : { dot: BAND_HEX[o] || '#999' }));
  if(key === 'liner'){
    const rooms = M.project.rooms, have = core.options(M.cat, pid, 'liner');
    /* a room that took "Blackout" in the fabric step keeps its liner: the answer is for the others */
    const set = rooms.map(r => !!r.linerChosen), some = set.some(Boolean);
    const m = rooms.reduce((k, r, i) => k + (set[i] ? 0 : r.qty), 0);
    const reprice = (o) => { if(some && o.diff != null && Math.abs(o.diff) >= .005) o.price = o.diff > 0 ? L.plus(money(o.diff), m) : L.less(money(-o.diff), m); if(some) o.cur = false; return o; };
    const list = have.map(o => reprice(some ? mk(o, { liner: o }, { byRoom: (i) => set[i] ? {} : { liner: o } }) : mk(o, { liner: o })));
    /* each room what it asked for — blackout where it should be dark, the white liner where it is about privacy: one more way to answer */
    const want = rooms.map((r, i) => set[i] ? null : r.need === 'dark' && have.indexOf('Blackout liner') !== -1 ? 'Blackout liner' : r.need === 'privacy' && have.indexOf('White liner') !== -1 ? 'White liner' : 'Unlined');
    const open = want.filter(Boolean);
    if(open.some(w => w !== 'Unlined') && open.some(w => w !== open[0])){
      const who = (w) => rooms.filter((r, i) => want[i] === w).map(r => roomName(r.label)).join(', ');
      const words = L.linerMix(who('Blackout liner'), who('White liner'), open.indexOf('Unlined') !== -1);
      const o = reprice(mk('byNeed', {}, { byRoom: (i) => want[i] ? { liner: want[i] } : {} }));
      o.label = words[0]; o.desc = words[1]; o.cur = false;
      if(o.diff != null && Math.abs(o.diff) >= .005) o.price = o.diff > 0 ? L.plus(money(o.diff), 1) : L.less(money(-o.diff), 1);
      list.push(o);
    }
    return list;
  }
  if(key === 'track') return [mk('wall', { trackopt: 'Yes', track: 'Wall' }), mk('ceiling', { trackopt: 'Yes', track: 'Ceiling' }), mk('no', { trackopt: 'No' })];
  return flat(core.options(M.cat, pid, key).map(o => { const patch = {}; patch[key] = o; return mk(o, patch); }));
}
function stepQuestion(key, opts){
  const L = S().setup, T = L[key], n = projectUnits();
  if(key === 'liner'){
    /* what I would add, room by room — the answer stays the customer's */
    const who = (f) => M.project.rooms.filter(f).map(r => roomName(r.label)).join(', ');
    const has = who(r => r.linerChosen), dark = who(r => !r.linerChosen && r.need === 'dark'), priv = who(r => !r.linerChosen && r.need === 'privacy'), heat = who(r => !r.linerChosen && r.need === 'heat');
    const sheer = M.project.rooms.some(r => !r.linerChosen && roomOp(r) === 'sheer');
    return [T.q, has && L.linerHas(has, M.project.rooms.filter(r => r.linerChosen).length, who(r => !r.linerChosen)), dark && L.darkLiner(dark), priv && L.privacyLiner(priv), heat && L.heatLiner(heat), sheer && L.sheerLiner].filter(Boolean).join(' ');
  }
  if(typeof T.q !== 'function') return T.q;
  const price = (v) => { const o = opts.filter(x => x.v === v)[0]; return o && o.diff > 0 ? money(o.diff) : ''; };
  if(key === 'drive'){ const cordless = opts.filter(x => x.v === 'Cordless' && x.cur).length; return T.q({ n, loop: cordless ? price('loop') : '', motor: cordless ? price('Motorized') : '' }); }
  if(key === 'tdbu') return T.q({ n, price: price('Yes') });
  if(key === 'banding'){ const o = opts.filter(x => x.v !== 'None' && x.diff > 0)[0]; return T.q({ n, price: o ? money(o.diff) : '' }); }
  return T.q({ n });
}
function optsHTML(opts){
  return '<div class="mira-opts">' + opts.map((o, i) => '<button type="button" class="mira-opt' + (o.cur ? ' cur' : '') + '" data-i="' + i + '">' +
    (o.img ? '<img src="' + esc(o.img) + '" alt="">' : o.dot ? '<span class="dot" style="background:' + o.dot + '"></span>' : '') +
    '<span class="tx"><b>' + esc(o.label) + '</b>' + (o.desc ? '<small>' + esc(o.desc) + '</small>' : '') + '</span>' +
    (o.price ? '<span class="pz">' + esc(o.price) + '</span>' : '') + '</button>').join('') + '</div>';
}
/* colours: the customer says which colours they want to see, Mira shows the fabrics in them —
   nothing is picked for them. The colour can go to every room at once, or room by room. */
/* a colour's family: read from the fabric photograph itself (its average colour); until the
   photographs are in, or where there is none, from the name — the hue word wins over "mist", "ash" … */
const FAM_ORDER = ['white', 'beige', 'grey', 'dark', 'blue', 'green', 'warm', 'pink'];
const FAM_NAME = [
  ['pink', /blush|rose|mauve|berry|plum|lavender|mulberry|pink/i], ['blue', /blue|indigo|teal|ocean|aqua|horizon|navy/i], ['green', /green|sage|olive|mint|moss/i],
  ['warm', /\bred\b|crimson|ruby|terracotta|sienna|clay|cinnamon|brick|ochre|rust|bark|brown/i], ['dark', /charcoal|graphite|black|midnight|obsidian|nightfall|shadow|coffee|truffle|iron/i],
  ['white', /white|ivory|snow|cloud|cotton|pearl|chalk|frost|bone|cream|pale/i], ['beige', /sand|beige|linen|almond|oyster|honey|oat|taupe|wheat|dune|pebble|drift/i],
  ['grey', /grey|gray|ash|smoke|fog|steel|flint|stone|mist|dust|silver/i],
];
/* thresholds set against the real fabric photographs: most of the range is neutral, so the
   neutrals are split by lightness and warmth, and only clearly coloured cloth counts as a colour */
function famOfRGB(r, g, b){
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if(d){ const R = r / 255, G = g / 255, B2 = b / 255; h = mx === R ? ((G - B2) / d) % 6 : mx === G ? (B2 - R) / d + 2 : (R - G) / d + 4; h = (h * 60 + 360) % 360; }
  const red = h < 18 || h >= 345, sandy = h >= 18 && h < 70, leafy = h >= 70 && h < 170, cool = h >= 170 && h < 262, rosy = h >= 262 && h < 345;
  /* a colour on the border of two families is shown in both (Kaan's answers, quiz of 2026-11-24) */
  if(sat >= .17){                                          /* clearly a colour */
    if(red) return l >= .6 && sat < .3 ? ['pink'] : h >= 345 && sat < .5 ? ['warm', 'pink'] : ['warm'];
    if(sandy){
      if(h < 50 && sat >= .34) return h >= 30 ? ['warm', 'beige'] : ['warm'];
      if(h >= 50) return ['green'];                          /* olive: he files both olives under greens only */
      return h < 36 ? ['beige', 'warm'] : ['beige'];
    }
    return [leafy ? 'green' : cool ? 'blue' : 'pink'];
  }
  if(sat >= .09){                                          /* a tint */
    if(l < .42) return [leafy ? 'green' : 'dark'];
    if(rosy || red) return ['pink'];
    if(leafy) return [l >= .68 ? 'white' : 'green'];
    if(sandy) return l >= .67 ? ['white'] : h < 36 ? ['beige', 'warm'] : ['beige'];
    return [l >= .68 ? 'white' : 'grey'];
  }
  return [l >= .68 ? 'white' : l < .42 ? 'dark' : 'grey'];   /* neutral */
}
/* colours Kaan placed himself, in three quizzes (the latest answer wins): fabric/code → families.
   Every colour near a border of the rules above was asked on its own, so these — not the rules — decide for them. */
const FAM_FIX = {
  'outlander/111': ['white'], 'outlander/107': ['grey', 'warm'], 'outlander/F106': ['warm'], 'outlander/F116': ['beige'], 'outlander/117': ['beige', 'warm'],
  'outlander/F124': ['pink'], 'outlander/125': ['pink'], 'outlander/129': ['dark', 'blue'], 'outlander/F136': ['grey'], 'outlander/133': ['blue'],
  'outlander/F113': ['green'], 'outlander/101': ['warm'], 'outlander/F102': ['dark'], 'outlander/103': ['dark', 'warm'], 'marlow/1': ['white'],
  'marlow/3': ['beige'], 'marlow/5': ['beige'], 'marlow/7': ['beige'], 'marlow/8': ['beige', 'warm'], 'marlow/9': ['green'],
  'marlow/13': ['grey', 'warm'], 'marlow/14': ['dark'], 'marlow/15': ['warm'], 'marlow/17': ['pink'], 'marlow/18': ['warm', 'pink'],
  'marlow/19': ['pink'], 'marlow/20': ['pink'], 'marlow/23': ['green'], 'soho/17721/210': ['white'], 'soho/17723/204': ['white'],
  'soho/17724/205': ['white'], 'lazuli/2': ['beige'], 'lazuli/3': ['white', 'grey'], 'lazuli/4': ['white', 'green'], 'piero/38': ['warm'],
  'piero/26': ['grey'], 'piero/14': ['grey', 'blue'], 'lucetta/1': ['white'], 'lucetta/3': ['white'], 'lucetta/4': ['white'],
  'lucetta/5': ['white'], 'lucetta/7': ['grey'], 'obscura/11': ['beige'], 'obscura/10': ['grey'], 'obscura/9': ['grey', 'warm'],
  'obscura/5': ['beige'], 'obscura/3': ['beige', 'warm'], 'obscura/2': ['beige'], 'carillo/2': ['beige', 'grey'], 'carillo/4': ['beige'],
  'carillo/7': ['dark'], 'carillo/9': ['blue'], 'nomad/162059/1004': ['beige'], 'nomad/162062/1003': ['white', 'beige'], 'nomad/162068/1007': ['warm'],
  'nomad/162059/1009': ['beige'], 'nomad/162068/1005': ['beige', 'warm'], 'nomad/162059/1001': ['grey', 'green'], 'nomad/162068/1012': ['beige'], 'nomad/162059/1002': ['grey'],
  'nomad/162059/1008': ['beige'], 'nomad/162062/1009': ['beige', 'dark'], 'nomad/162068/1015': ['dark'], 'umberto/303': ['beige'], 'umberto/306': ['beige'],
  'umberto/4': ['beige', 'warm'], 'umberto/104': ['dark'], 'umberto/103': ['warm'], 'umberto/107': ['beige', 'green'], 'umberto/102': ['grey', 'blue'],
  'arrow/1': ['grey'], 'arrow/4': ['white'], 'periscope/5': ['white'], 'periscope/6': ['white'], 'periscope/7': ['white'],
  'periscope/8': ['beige'], 'periscope/10': ['dark'], 'periscope/12': ['white'], 'periscope/13': ['beige', 'warm'], 'periscope/18': ['white'],
  'periscope/21': ['grey'], 'periscope/23': ['white'], 'periscope/25': ['blue'], 'periscope/27': ['dark', 'blue'], 'atmosphere/20': ['white'],
  'atmosphere/5': ['white', 'beige'], 'atmosphere/7': ['beige', 'warm'], 'atmosphere/11': ['beige'], 'atmosphere/16': ['grey', 'dark'], 'atmosphere/18': ['dark', 'blue'],
  'hesperia/7': ['green'],
};
/* three choices lead to a colour: the kind of fabric, how much light it lets through, then the colour family.
   Fabrics with a pattern — stripes or a woven motif — were picked out by looking at the photographs. */
const PATTERNED = {
  lucetta: ['Dune Mist', 'Twin Bark', 'Pinstripe', 'Bold Stripe', 'Chevron Stripe'],
  soho: ['Glacial Veil', 'Riverstone Drift', 'Mist Alloy', 'Sandline', 'Ashline', 'Graphite Edge', 'White Trace', 'Crimson Pin', 'Olive Bark', 'Char Thread', 'Redline'],
  nomad: ['Amber Frost', 'Ochre', 'Sandstone Drift', 'Stone', 'Eucalyptus Shadow', 'Mintstone', 'Nordic Steel', 'Nightfall', 'Ashline Granite', 'Slate Mist'],
  arrow: true,
};
/* which kinds a fabric is shown under, and how much light it lets through: Kaan's answers, fabric by fabric
   (quiz of 2026-11-24). A fabric with no kind (Obscura, Umberto) is found under "Not sure yet" only. */
/* Kaan's mapping of 2026-11-26. The first question is the range — Budget friendly, Classic, Premium — and each
   fabric is in exactly one (his own answers; a fabric that is not listed here goes by its price group). */
const TIER_ORDER = ['budget', 'classic', 'premium'];
const TIER_OF = {
  outlander: 'budget', soho: 'budget',
  marlow: 'classic', lazuli: 'classic', piero: 'classic', lucetta: 'classic', obscura: 'classic', carillo: 'classic', nomad: 'classic', umberto: 'classic',
  arrow: 'premium', periscope: 'premium', atmosphere: 'premium', hesperia: 'premium',
};
/* what a typed word can still narrow by ("solids", "wool", "something striped") — these are not offered as cards */
const TAGS_OF = { outlander: ['solid'], marlow: ['solid'], lazuli: ['solid'], carillo: ['solid'], piero: ['wool'] };
const PLAIN_AS_SOLID = ['lucetta', 'nomad'];                               /* patterned fabrics: their few plain colours count as solids */
const LIGHT_OF = { periscope: 'semi' };                                    /* where the site's own label does not say */
/* the second question, in his order. "Linen" is the linen fabrics whatever light they let through — they are found under their light level too. */
const OP_ORDER = ['filter', 'blackout', 'sheer', 'semi', 'linen'];
const LINEN = ['marlow', 'periscope', 'atmosphere'];
/* fabrics Mira never lists (Kaan: Hesperia). A customer can still choose one on the page, or ask for it by name. */
const HIDDEN = ['hesperia'];
const KIND_WORDS = [
  ['pattern', /pattern|stripe|striped|print|motif|con diseno|estampad|rayas|desenli|a motifs|rayures|imprime/], ['linen', /\blinen\b|\blino\b|keten|\blin\b/], ['wool', /\bwool|\blana\b|yunlu|\blaine\b/],
  ['budget', /budget|cheap|affordable|inexpensive|economic|barat|ucuz|pas cher|abordable|economique/], ['classic', /\bclassic|\bclasic|\bclassique|\bklasik/], ['premium', /luxur|premium|finest|de lujo|\blujo\b|luks|\bluxe\b|haut de gamme/], ['solid', /\bsolids?\b|plain colou?r|\blisas?\b|duz renk|\bunie?s?\b/],
];
/* what a colour word opens in the colour filter: Kaan's answers for the less obvious words (quiz 3), the plain ones as they read.
   Matched against the normalised message (lower case, accents off). */
const FAM_WORDS = [
  [/\b(cream|ivory|off.?white|crema|marfil|krem|creme|ivoire|ecru|blanc casse)\b/, ['white', 'beige']],
  [/\b(whites?|blanc[oa]s?|beyaz|blanc(he)?s?)\b(?! casse)/, ['white']],
  [/\b(tan|khaki|camel|caqui|camello|kaki|fauve)\b/, ['beige', 'warm']],
  [/\b(taupe|greige|vizon)\b/, ['grey', 'beige']],
  [/\b(beiges?|sand|sandy|arena|bej|sable)\b/, ['beige']],
  [/\b(charcoal|graphite|anthracite|grafito|antracita|antrasit)\b|\bdark gr[ae]y\b|\bgris oscuro\b|\bgris fonce\b/, ['dark', 'grey']],
  [/\b(gr[ae]ys?|silver|gris|grises|plata|gri|argent)\b/, ['grey']],
  [/\b(black|negr[oa]s?|siyah|noir(e)?s?)\b(?! (complet|total|pour))/, ['dark']],
  [/\b(browns?|chocolate|marron|marrones|kahverengi|bruns?|chocolat)\b/, ['warm', 'dark']],
  [/\b(neutrals?|neutr[oa]s?|notr|neutres?)\b/, ['white', 'beige', 'grey']],
  [/\bearth(y)? (tones?|colou?rs?)\b|\bearthy\b|\bnatural (tones?|colou?rs?|shades?)\b|\bnaturals\b|\btonos? tierra\b|\btoprak ton|\btons? (de terre|naturels?)\b/, ['beige', 'warm', 'green']],
  [/\b(navy|marino|lacivert|marine)\b/, ['blue', 'dark']],
  [/\b(teal|aqua|turquoise|turquesa|turkuaz)\b/, ['blue']],
  [/\b(blues?|azul|azules|mavi|bleu(e)?s?)\b/, ['blue']],
  [/\b(greens?|sage|olive|verdes?|oliva|salvia|yesil|vert(e)?s?|sauge)\b/, ['green']],
  [/\b(yellows?|gold|golden|mustard|amarill[oa]s?|dorad[oa]s?|mostaza|hardal|jaunes?|dore(e)?s?|moutarde)\b|\bsar[ıi](?![a-z])/, ['beige', 'warm']],
  [/\b(reds?|burgundy|maroon|terracotta|orange|roj[oa]s?|terracota|naranja|burdeos|turuncu|bordo|rouges?|bordeaux|rouille)\b|\brust (colou?r|tones?)\b|\bterre cuite\b|\bk[ıi]rm[ıi]z[ıi]/, ['warm']],
  [/\bwarm (tones?|colou?rs?)\b|\btonos? calidos?\b|\b(tons?|couleurs?) chaud(e)?s?\b/, ['warm']],
  [/\b(pinks?|blush|roses?|rosas?|rosad[oa]s?|pembe)\b/, ['pink']],
  [/\b(purples?|lavender|plum|mauve|lilac|morad[oa]s?|violeta|lila|lavanda|mor|violet(te)?s?|lavande|prune|lilas)\b/, ['pink']],
  [/\b(light|lighter|pale) (colou?rs?|tones?|neutrals?)\b|\bsomething (light|pale)\b|\b(colores|tonos) claros\b|\b(couleurs?|tons?) clair(e)?s?\b|\bac[ıi]k renk/, ['white', 'beige']],
  [/\bdark(er)? (colou?rs?|tones?)\b|\bsomething dark\b|\b(colores|tonos) oscuros\b|\b(couleurs?|tons?) (sombres?|fonce(e)?s?)\b|\bkoyu renk/, ['dark']],
  [/\bcolou?rful\b|\bbold\b|\bpop of colou?r\b|\bvivid\b|\bcolorid[oa]s?\b|\bcolore(e)?s?\b|\bvi(f|ve)s?\b|\brenkli\b/, ['blue', 'green', 'warm', 'pink']],
];
function famWords(s){
  s = s.replace(/(white|blackout) lin\w*|forro (blanco|blackout|opaco)|doublure (blanche|occultante)|dans le noir|noir (complet|total|pour dormir)/g, ' ');           /* a liner is not a colour, nor is darkness */
  const hit = [];
  FAM_WORDS.forEach(w => { if(w[0].test(s)) w[1].forEach(f => { if(hit.indexOf(f) === -1) hit.push(f); }); });
  return FAM_ORDER.filter(f => hit.indexOf(f) !== -1);
}
/* "whites & creams, beiges & sands and greys" */
function famText(list){ const L = S().setup, w = list.map(f => L.fam[f].toLowerCase()); return w.length > 1 ? w.slice(0, -1).join(', ') + ' ' + L.and + ' ' + w[w.length - 1] : w[0] || ''; }
/* light levels a room's need rules out (Kaan, quiz 3): privacy → no sheers; soft daylight → no room darkening, no blackout.
   A dark room rules out nothing: any fabric, and the blackout liner is recommended. */
const NEED_HIDES = { privacy: ['sheer'], soft: ['dim', 'blackout'] };
/* [need, name] of the rooms the colour card is choosing for; one window on its own goes by what was last said */
function scopeNeeds(){
  const P = M.project && !M.project.added ? M.project : null, C = M.col;
  if(P) return (C && C.mode === 'room' ? [P.rooms[C.room]] : P.rooms).filter(Boolean).map(r => [r.need, roomName(r.label)]);
  return M.pageNeed ? [[M.pageNeed, S().setup.thisWindow]] : [];
}
function hiddenLevels(){ const out = []; scopeNeeds().forEach(x => (NEED_HIDES[x[0]] || []).forEach(o => { if(out.indexOf(o) === -1) out.push(o); })); return out; }
function opacityOf(id, meta){
  if(LIGHT_OF[id]) return LIGHT_OF[id];
  const t = ((meta && meta.transparency) || '').toLowerCase();
  return /blackout/.test(t) ? 'blackout' : /darken/.test(t) ? 'dim' : /sheer/.test(t) ? 'sheer' : /semi/.test(t) ? 'semi' : 'filter';
}
function colourList(pid){
  if(M.colList && M.colList.pid === pid) return M.colList.items;
  const items = [];
  core.collections(M.cat, pid).forEach(c => core.colours(M.cat, pid, c.id).forEach(code => {
    const sw = core.swatch(M.cat, pid, c.id, code), name = cleanName(sw.name), byName = FAM_NAME.filter(f => f[1].test(name))[0];
    const g = c.group || 0, pat = PATTERNED[c.id] === true || (PATTERNED[c.id] || []).indexOf(name) !== -1;
    /* a fabric that is not in the list yet goes by its price group */
    const kinds = [TIER_OF[c.id] || (g === 1 ? 'budget' : g >= 4 ? 'premium' : 'classic')].concat(TAGS_OF[c.id] || []);
    if(pat) kinds.push('pattern');
    else if(PLAIN_AS_SOLID.indexOf(c.id) !== -1) kinds.push('solid');
    items.push({ coll: c.id, label: c.label, code, name, img: sw.img, group: g, kinds, op: opacityOf(c.id, c.meta), linen: LINEN.indexOf(c.id) !== -1, hidden: HIDDEN.indexOf(c.id) !== -1, fam: FAM_FIX[c.id + '/' + code] || (byName ? [byName[0]] : []) });
  }));
  items.sort((a, b) => a.group - b.group);               /* the gentler prices first */
  M.colList = { pid, items, seen: false };
  return items;
}
/* look at every fabric photograph once (they are small), then call back */
function scanColours(pid, done){
  const list = colourList(pid);
  if(M.colList.seen || M.colList.busy) return;
  M.colList.busy = true;
  const cv = document.createElement('canvas'); cv.width = cv.height = 8;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  let left = list.length;
  /* once seen: gentler prices first, and within a price group from light to dark */
  const fin = () => { if(--left > 0) return; list.sort((a, b) => (a.group - b.group) || ((b.light || 0) - (a.light || 0))); M.colList.seen = true; M.colList.busy = false; done(); };
  list.forEach(it => {
    if(!it.img){ fin(); return; }
    const im = new Image();
    im.onload = () => {
      try {
        cx.drawImage(im, 0, 0, 8, 8);
        const d = cx.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0;
        for(let k = 0; k < d.length; k += 4){ r += d[k]; g += d[k + 1]; b += d[k + 2]; }
        const n = d.length / 4;
        it.light = (Math.max(r, g, b) + Math.min(r, g, b)) / (2 * 255 * n);
        it.fam = FAM_FIX[it.coll + '/' + it.code] || famOfRGB(r / n, g / n, b / n);
      } catch(e){ /* keep the family the name gave */ }
      fin();
    };
    im.onerror = fin;
    im.src = it.img;
  });
}
function colState(){
  const P = M.project && !M.project.added ? M.project : null;
  if(!M.col) M.col = { kind: '', op: '', edit: '', only: '', fam: [], mode: P && P.rooms.length > 1 ? 'all' : (P ? 'room' : 'page'), room: 0, limit: 18 };
  return M.col;
}
/* the fabrics left after the first two choices */
function colourPool(pid, kind, op){
  let list = colourList(pid).filter(x => !x.hidden);                 /* a hidden fabric is never in a list of Mira's own */
  const hide = hiddenLevels();
  if(op && hide.indexOf(op) !== -1) return [];
  if(hide.length) list = list.filter(x => hide.indexOf(x.op) === -1);
  if(kind && kind !== 'any') list = list.filter(x => x.kinds.indexOf(kind) !== -1);
  /* "Blackout" is every fabric: a blackout liner goes behind the one chosen (Kaan, quiz 3) */
  if(op === 'linen') list = list.filter(x => x.linen);
  else if(op && op !== 'any' && op !== 'blackout') list = list.filter(x => x.op === op);
  return list;
}
function opOfColl(pid, coll){ return (colourList(pid).filter(x => x.coll === coll)[0] || {}).op || ''; }
/* the light level of the fabric a room has now */
function roomOp(r){ const snap = SHOP.snapshot(), id = r.patch.collection || designOf(snap).collection, c = core.collectionOf(M.cat, snap.pid, id); return c ? opacityOf(id, c.meta) : ''; }
/* the fabric of a room as things stand */
function roomColl(i){ const base = designOf(SHOP.snapshot()); return M.project.rooms[i].patch.collection || base.collection; }
function coloursHTML(){
  const pid = SHOP.snapshot().pid;
  if(pid === 'roman' || pid === 'drapery') scanColours(pid, () => {
    const el = thread.querySelector('.mira-col:not(.done)');
    if(el){ const top = thread.scrollTop; el.innerHTML = colourBody(); thread.scrollTop = top; }
  });
  return '<div class="mira-col">' + colourBody() + '</div>';
}
function colourBody(){
  const L = S().setup, snap = SHOP.snapshot(), pid = snap.pid, base = designOf(snap), C = colState();
  const P = M.project && !M.project.added ? M.project : null;
  const named = pid === 'roman' || pid === 'drapery';                      /* colours with names, across many fabrics */
  let h = '', items = [], asked = true, open = true;                       /* asked: a colour family was chosen; open: the first two choices are made */
  const priceNum = {};
  const hint = (text) => '<p class="hint">' + esc(text) + '</p>';
  /* the same colour everywhere, or room by room */
  let scoped = false;
  const scope = () => { scoped = true; if(!P || P.rooms.length < 2) return '';
    return '<div class="scope"><button type="button" class="md' + (C.mode === 'all' ? ' on' : '') + '" data-mode="all">' + esc(L.scopeAll) + '</button>' +
      '<button type="button" class="md' + (C.mode === 'room' ? ' on' : '') + '" data-mode="room">' + esc(L.scopeRoom) + '</button></div>' +
      (C.mode === 'room' ? '<div class="rts">' + P.rooms.map((r, i) => '<button type="button" class="rt' + (i === C.room ? ' on' : '') + (r.colourChosen ? ' ok' : '') + '" data-room="' + i + '">' + esc(roomName(r.label)) + '</button>').join('') + '</div>' : ''); };
  /* several rooms: "the same for all" or "different for each room" stands above the three questions (Kaan) */
  if(named && P && P.rooms.length > 1) h += scope();
  if(named){
    const all = colourList(pid);
    /* a choice the rooms in question rule out (a need hides some light levels) is asked again */
    if(C.kind && C.kind !== 'any' && !colourPool(pid, C.kind, '').length){ C.kind = ''; C.op = ''; C.opAuto = false; }
    if(C.kind && C.op && C.op !== 'any' && !colourPool(pid, C.kind, C.op).length){ C.op = ''; C.opAuto = false; }
    const opOf = {}; all.forEach(x => { opOf[x.coll] = x.op; });
    /* with "Blackout" the liner is part of the price shown */
    const lined = (id) => C.op === 'blackout' && !C.only && opOf[id] !== 'blackout' ? { liner: 'Blackout liner' } : {};
    /* what each fabric costs at these sizes, where the page shows prices: the lowest of the windows in question */
    if(SHOP.quote){
      const sizes = [];
      if(P) projectWindows(base).forEach(x => { if(x.design && (C.mode !== 'room' || x.i === C.room) && !sizes.some(z => z.w === x.design.w && z.h === x.design.h)) sizes.push({ w: x.design.w, h: x.design.h }); });
      else sizes.push({ w: base.w, h: base.h });
      const colls = core.collections(M.cat, pid).map(c => c.id), ask = [];
      sizes.slice(0, 12).forEach(z => colls.forEach(id => ask.push({ coll: id, sel: Object.assign({ collection: id, colour: core.colours(M.cat, pid, id)[0] }, lined(id)), w: z.w, h: z.h })));
      (ask.length ? SHOP.quote(ask.map(x => ({ sel: x.sel, w: x.w, h: x.h }))) || [] : []).forEach((v, i) => {
        if(v != null && (priceNum[ask[i].coll] == null || v < priceNum[ask[i].coll])) priceNum[ask[i].coll] = v;
      });
    }
    if(P && snap.prices && SHOP.quote && !Object.keys(priceNum).length) h += hint(S().planNoSize);
    const from = (list) => { let m = null; list.forEach(x => { const v = priceNum[x.coll]; if(v != null && (m == null || v < m)) m = v; }); return m == null ? '' : L.from(money(m)); };
    const head = (n, text) => '<div class="qh"><i>' + n + '</i>' + esc(text) + '</div>';
    const card = (q, v, words, price, on) => '<button type="button" class="kd' + (on ? ' on' : '') + '" data-q="' + q + '" data-v="' + v + '"><b>' + esc(words[0]) + '</b><small>' + esc(words[1]) + '</small>' + (price ? '<em>' + esc(price) + '</em>' : '') + '</button>';
    const said = (q, title, value) => '<button type="button" class="qa" data-q="' + q + '"><i>✓</i><span>' + esc(title) + colon() + '<b>' + esc(value) + '</b></span><u>' + esc(L.change) + '</u></button>';
    if(C.only){
      /* the customer named the fabric: its colours, and a way out to the others */
      const c = core.collectionOf(M.cat, pid, C.only);
      h += '<div class="t">' + esc(c ? tv(c.label) : C.only) + ' · <button type="button" class="other">' + esc(L.otherFabrics) + '</button></div>';
      items = all.filter(x => x.coll === C.only);
    } else {
      /* rooms that need different things are offered different fabrics, so that choice comes first */
      if(!scoped && P && P.rooms.some(r => NEED_HIDES[r.need])) h += scope();
      /* what a room's need leaves out, said up front */
      const hid = hiddenLevels(), sn = scopeNeeds(), who = (need) => sn.filter(x => x[0] === need).map(x => x[1]).join(', ');
      if(hid.indexOf('sheer') !== -1) h += hint(L.hidePrivacy(who('privacy')));
      if(hid.indexOf('blackout') !== -1) h += hint(L.hideSoft(who('soft')));
      /* 1 — the kind of fabric (only the kinds that still have a fabric) */
      if(C.kind && C.edit !== 'kind') h += said('kind', L.kindA, L.kind[C.kind][0]);
      else h += head(1, L.kindQ) + '<div class="ks">' + TIER_ORDER.concat(['any']).filter(k => k === 'any' || colourPool(pid, k, '').length).map(k => {
        const f = k === 'any' ? '' : from(colourPool(pid, k, ''));
        return card('kind', k, L.kind[k], f, C.kind === k);
      }).join('') + '</div>';
      /* 2 — how much light comes through: only what that kind of fabric has; one level only needs no question */
      if(C.kind && !C.op){ const ops = OP_ORDER.filter(o => colourPool(pid, C.kind, o).length); if(ops.length === 1){ C.op = ops[0]; C.opAuto = true; } }
      if(C.kind){
        if(C.op && C.edit !== 'op') h += said('op', L.opA, L.op[C.op][0]);
        else h += head(2, L.opQ) + '<div class="ks">' + OP_ORDER.filter(o => colourPool(pid, C.kind, o).length).concat(['any']).map(o => card('op', o, L.op[o], '', C.op === o)).join('') + '</div>';
      }
      /* 3 — the colours to look at: only the families there are; a short list is shown straight away */
      open = !!(C.kind && C.op); asked = false;
      if(open){
        const pool = colourPool(pid, C.kind, C.op), fams = FAM_ORDER.filter(f => pool.some(x => x.fam.indexOf(f) !== -1));
        const fam = C.fam.length ? C.fam : pool.length <= 12 ? ['all'] : [];
        h += head(3, L.famQ) + '<div class="fams">' + fams.concat(['all']).map(k =>
          '<button type="button" class="fam' + (fam.indexOf(k) !== -1 ? ' on' : '') + '" data-fam="' + k + '">' + esc(L.fam[k]) + '</button>').join('') + '</div>';
        asked = fam.length > 0;
        items = fam.indexOf('all') !== -1 ? pool : pool.filter(x => x.fam.some(f => fam.indexOf(f) !== -1));
        /* the colour the customer wrote is not made in this kind of fabric */
        if(C.famSaid && C.famSaid.length && !C.famSaid.some(f => fams.indexOf(f) !== -1)) h += hint(L.famNone(famText(C.famSaid)));
        if(C.op === 'blackout') h += hint(L.boHint + (pool.some(x => x.op === 'sheer') ? ' ' + L.boSheer : ''));
      }
    }
  }
  if(open && !scoped) h += scope();
  /* what there is to choose from */
  if(pid === 'pleated'){
    items = Object.keys(core.PLEATED_HEX).map(n => ({ coll: '', code: n, name: tv(n), hex: core.PLEATED_HEX[n], label: '' }));
  } else if(!named){
    const coll = P ? roomColl(C.mode === 'room' ? C.room : 0) : base.collection, c = core.collectionOf(M.cat, pid, coll);
    items = core.colours(M.cat, pid, coll).map(code => { const sw = core.swatch(M.cat, pid, coll, code); return { coll, code, name: cleanName(sw.name), img: sw.img, label: '' }; });
    h += '<div class="t">' + esc(c ? tv(c.label) : '') + '</div>';
  }
  const picked = (x) => P ? (C.mode === 'room' ? pickedOf(C.room, x) : P.rooms.every((r, i) => pickedOf(i, x))) : (M.decided.colour === true && base.collection === (x.coll || base.collection) && base.colour === x.code);
  const shown = items.slice(0, C.limit);
  if(!open){ /* the first two choices come first */ }
  else if(named && !asked) h += '<p class="hint">' + esc(L.famFirst) + '</p>';
  else if(!items.length) h += '<p class="hint">' + esc(L.none) + '</p>';
  else h += '<div class="sws">' + shown.map(x => '<button type="button" class="sw' + (picked(x) ? ' on' : '') + '" data-coll="' + esc(x.coll) + '" data-code="' + esc(x.code) + '">' +
      '<span' + (x.hex ? ' style="background:' + x.hex + '"' : '') + '>' + (x.img ? '<img loading="lazy" src="' + esc(x.img) + '" alt="">' : '') + '</span><em>' + esc(x.name) + '</em>' +
      (x.label ? '<small>' + esc(tv(x.label)) + (priceNum[x.coll] != null ? ' · ' + money(priceNum[x.coll]) : '') + (x.op === 'blackout' ? ' · blackout' : '') + '</small>' : '') + '</button>').join('') + '</div>' +
    (items.length > shown.length ? '<button type="button" class="all">' + esc(L.more(items.length)) + '</button>' : '');
  if(P && (open || P.rooms.some(r => r.colourChosen))){
    /* a dark room that is being chosen for now and has no liner yet */
    const dark = P.rooms.filter((r, i) => r.need === 'dark' && !r.linerChosen && (C.mode !== 'room' || i === C.room)).map(r => roomName(r.label));
    if(named && dark.length && C.op !== 'blackout') h += '<p class="hint">' + esc(L.darkHint(dark.join(', '))) + '</p>';
    h += '<div class="sum">' + P.rooms.map((r, i) => '<span' + (r.colourChosen ? ' class="ok"' : '') + '>' + esc(roomName(r.label)) + colon() + esc(r.colourChosen ? roomColourName(i) : '—') + '</span>').join('') + '</div>' +
      '<p class="er" hidden>' + esc(L.colourNeed) + '</p><button type="button" class="go">' + esc(L.cont) + '</button>';
  }
  /* the guided start, before any room is listed: on to the rooms once a colour is chosen */
  else if(!P && open && M.guide && M.guide.step === 'fabric') h += '<p class="er" hidden>' + esc(S().guide.need) + '</p><button type="button" class="go">' + esc(L.cont) + '</button>';
  return h;
}
function roomColourName(i){
  const base = designOf(SHOP.snapshot()), rd = roomDesign(base, M.project.rooms[i]);
  return rd.product === 'pleated' ? tv(rd.colour) : cleanName(core.colourName(M.cat, rd));
}
function pickedOf(i, x){
  const r = M.project.rooms[i]; if(!r.colourChosen) return false;
  const base = designOf(SHOP.snapshot()), rd = roomDesign(base, r);
  if(rd.product === 'pleated') return rd.colour === x.code;
  if(rd.product === 'cellular') return cleanName(core.colourName(M.cat, rd)) === x.name;
  return rd.collection === x.coll && rd.colour === x.code;
}
function lockCards(){
  thread.querySelectorAll('.mira-opts:not(.done), .mira-col:not(.done)').forEach(el => { el.classList.add('done'); el.querySelectorAll('button').forEach(b => { b.disabled = true; }); });
}
/* one colour card is live at a time: an older one keeps its choice, or goes if nothing was chosen in it */
function retireColourCards(){
  thread.querySelectorAll('.mira-col:not(.done)').forEach(el => {
    if(!el.querySelector('.sw.on')){ el.remove(); return; }
    el.classList.add('done'); el.querySelectorAll('button').forEach(b => { b.disabled = true; });
  });
}
function lockPlans(){
  thread.querySelectorAll('.mira-plan.live').forEach(el => { el.classList.remove('live'); el.querySelectorAll('input, button').forEach(x => { x.disabled = true; }); });
}
/* ask the next question — or, when there is none left, show the finished list */
function askStep(prefix){
  const P = M.project; if(!P || P.added) return;
  const steps = setupSteps(), L = S().setup;
  /* nothing left to ask: every room has its colour — or its liner, taken with "Blackout" in the fabric step */
  while(P.setup.at < steps.length && ((steps[P.setup.at] === 'colour' && !P.confirmColour && P.rooms.every(r => r.colourChosen)) || (steps[P.setup.at] === 'size' && !unsized() && !unmounted()) || (steps[P.setup.at] === 'liner' && P.rooms.every(r => r.linerChosen)))) P.setup.at++;
  lockCards(); lockPlans();
  let text, extras = {};
  if(P.setup.at >= steps.length){ P.setup.done = true; text = L.done; extras.plan = planCard(); setChips([]); }
  else {
    const key = steps[P.setup.at];
    if(key === 'colour'){
      const pid = SHOP.snapshot().pid; M.col = null; text = pid === 'roman' || pid === 'drapery' ? L.fabricQ : L.colourQ; extras.colours = true;
      /* after the guided start every room has the fabric chosen there: keep it, or go room by room */
      if(P.confirmColour){ text = S().guide.sameQ(fabricLabel(designOf(SHOP.snapshot())), L.scopeRoom); if(M.guideSet) Object.assign(colState(), M.guideSet); }
    }
    else if(key === 'size'){ text = L.sizeQ + (mountInRow(SHOP.snapshot().pid) ? ' ' + L.sizeMount : ''); extras.plan = planCard(); }             /* the list itself, with a Continue button */
    else { const opts = stepOptions(key); P.setup.opts = opts; P.setup.key = key; text = stepQuestion(key, opts); extras.opts = opts; }
    setChips([]);
  }
  if(prefix) text = prefix + '\n\n' + text;
  addMsg('m', text, extras);
  M.history.push({ role: 'assistant', text });
  renderNow();
}
function beginSetup(){
  const P = M.project; if(!P || P.added) return;
  P.setup.at = 0; P.setup.done = false; P.setup.asking = false;
  askStep(P.fromGuide ? (projectUnits() > 1 ? S().setup.intro : '') : S().setup.intro + (unsized() ? ' ' + S().setup.sizesLater : ''));
}
/* an answer: said back in the customer's own bubble, applied to every window, then the next question */
/* the two ways to go on from a list that has no sizes yet */
function sizeChoice(){
  const L = S().setup, pr = !!SHOP.snapshot().prices;
  const mk = (act, w) => ({ v: act, act, label: w[0], desc: w[pr ? 1 : 2], price: '', cur: false, patch: {} });
  return [mk('sizes', L.sizeNow), mk('fabric', L.fabricFirst)];
}
function answerStep(o){
  const P = M.project, before = designOf(SHOP.snapshot());
  addMsg('y', o.label); M.history.push({ role: 'user', text: o.label });
  if(o.act){                                             /* not a question of the set-up itself */
    P.setup.asking = false;
    lockCards();
    if(o.act === 'fabric'){ setTimeout(beginSetup, 380); return; }
    lockPlans();
    setTimeout(() => {                                   /* the list again, ready for the sizes */
      const L = S(); addMsg('m', L.planFill, { plan: planCard() }); M.history.push({ role: 'assistant', text: L.planFill });
      setChips((SHOP.snapshot().pid === 'drapery' ? L.chips.sizeD : L.chips.size).slice()); renderNow();
    }, 380);
    return;
  }
  let notes = '';
  if(o.byRoom) P.rooms.forEach((r, i) => Object.assign(r.patch, o.byRoom(i)));      /* an answer that differs from room to room */
  else {
    const out = core.applyPatch(M.cat, before, o.patch);
    toShop(before, out.design);
    P.rooms.forEach(r => Object.keys(o.patch).forEach(k => { delete r.patch[k]; }));
    notes = out.notes.map(n => B.noteText(M.lang, n)).filter(Boolean).join(' ');
  }
  M.decided[P.setup.key] = true;
  P.setup.at++;
  lockCards();
  setTimeout(() => askStep(notes), 380);
}
function answerColours(el){
  const P = M.project, L = S().setup;
  if(P.rooms.some(r => !r.colourChosen)){ el.querySelector('.er').hidden = false; return; }
  const names = P.rooms.map((r, i) => roomColourName(i));
  const same = names.every(n => n === names[0]);
  const said = same && P.rooms.length > 1 ? L.allRooms + colon() + names[0] : P.rooms.map((r, i) => roomName(r.label) + colon() + names[i]).join('; ');
  addMsg('y', said); M.history.push({ role: 'user', text: said });
  M.decided.colour = true; M.col = null; P.confirmColour = false;
  P.setup.at++;
  lockCards();
  setTimeout(() => askStep(''), 380);
}
/* a tap in the colour card: a colour family, the scope, a room, or a colour */
function colourTap(col, e){
  const C = colState(), P = M.project && !M.project.added ? M.project : null, snap = SHOP.snapshot(), pid = snap.pid;
  const redraw = () => { const top = thread.scrollTop; col.innerHTML = colourBody(); thread.scrollTop = top; };
  let b;
  if((b = e.target.closest('.kd'))){
    /* one of the first two choices; a later answer that no longer fits is asked again */
    /* a light level that was filled in because the last kind had only one is not the customer's choice */
    if(b.dataset.q === 'op' || C.opAuto){ if(b.dataset.q === 'kind') C.op = ''; C.opAuto = false; }
    C[b.dataset.q] = b.dataset.v; C.edit = '';
    if(C.op && C.op !== 'any' && !colourPool(pid, C.kind, C.op).length) C.op = '';
    const pool = colourPool(pid, C.kind, C.op);
    C.fam = C.fam.filter(f => f === 'all' || pool.some(x => x.fam.indexOf(f) !== -1));
    C.limit = 18; redraw(); return;
  }
  if((b = e.target.closest('.qa'))){ C.edit = b.dataset.q; redraw(); return; }
  if(e.target.closest('.other')){ C.only = ''; C.kind = ''; C.op = ''; C.fam = []; C.limit = 18; redraw(); return; }
  if((b = e.target.closest('.fam'))){
    const k = b.dataset.fam, at = C.fam.indexOf(k);
    if(k === 'all') C.fam = at === -1 ? ['all'] : [];
    else { C.fam = C.fam.filter(x => x !== 'all'); if(at === -1) C.fam.push(k); else C.fam = C.fam.filter(x => x !== k); }
    C.limit = 18; redraw(); return;
  }
  if((b = e.target.closest('.md'))){ if(b.dataset.mode !== C.mode){ C.per = {}; C.mode = b.dataset.mode; } redraw(); return; }
  /* room by room, every room has its own three answers: they are put away when another room is opened,
     and a room that has not been asked yet starts blank */
  const turn = (i) => {
    C.per = C.per || {};
    C.per[C.room] = { kind: C.kind, op: C.op, opAuto: !!C.opAuto, fam: C.fam.slice(), only: C.only };
    const a = C.per[i] || { kind: '', op: '', opAuto: false, fam: [], only: '' };
    C.kind = a.kind; C.op = a.op; C.opAuto = a.opAuto; C.fam = a.fam.slice(); C.only = a.only; C.edit = ''; C.room = i; C.limit = 18;
  };
  if((b = e.target.closest('.rt'))){ if(+b.dataset.room !== C.room) turn(+b.dataset.room); redraw(); return; }
  if(e.target.closest('.all')){ C.limit = 999; redraw(); return; }
  if(e.target.closest('.go')){ if(P) answerColours(col); else guideFabricDone(col); return; }
  if(!(b = e.target.closest('.sw'))) return;
  const coll = b.dataset.coll, code = b.dataset.code, name = b.querySelector('em').textContent;
  /* "Blackout" in the light step: the blackout liner comes with the colour (a blackout fabric needs none) */
  const named = pid === 'roman' || pid === 'drapery', byLight = named && !C.only && C.op === 'blackout';
  const boLiner = byLight && opOfColl(pid, coll) !== 'blackout';
  if(!P){                                                 /* one window: the colour goes straight to the page */
    const before = designOf(snap), patch = coll ? { collection: coll, colour: code } : { colour: code };
    if(boLiner){ patch.liner = 'Blackout liner'; M.linerAuto = true; M.decided.liner = true; }
    else if(named && M.linerAuto){ patch.liner = 'Unlined'; M.linerAuto = false; M.decided.liner = false; }
    toShop(before, core.applyPatch(M.cat, before, patch).design);
    M.decided.colour = true; redraw(); renderNow();
    return;
  }
  const pageLiner = designOf(snap).liner;
  (C.mode === 'room' ? [C.room] : P.rooms.map((r, i) => i)).forEach(i => {
    const r = P.rooms[i];
    if(pid === 'cellular'){
      /* the same colour number in that room's own cell type */
      const own = roomColl(i), hit = core.colours(M.cat, pid, own).filter(c => cleanName(core.swatch(M.cat, pid, own, c).name) === name)[0];
      if(!hit) return;
      r.patch.colour = hit;
    } else { if(coll) r.patch.collection = coll; r.patch.colour = code; }
    /* after the guided start the page itself may carry the blackout liner: a room without one then says so */
    const noLiner = () => { if(pageLiner === 'Blackout liner') r.patch.liner = 'Unlined'; else delete r.patch.liner; };
    if(byLight){ if(!boLiner) noLiner(); else if(pageLiner === 'Blackout liner') delete r.patch.liner; else r.patch.liner = 'Blackout liner'; r.linerChosen = true; }
    else if(named && r.linerChosen){ noLiner(); r.linerChosen = false; }
    r.colourChosen = true;
  });
  /* room by room: on to the next room that still has no colour */
  if(C.mode === 'room'){ const next = P.rooms.findIndex((r, i) => i > C.room && !r.colourChosen); if(next !== -1) turn(next); }
  redraw(); renderNow();
}
function roomFabric(r, rd){
  if(r.colourChosen) return fabricLabel(rd);
  if(rd.product === 'pleated') return S().setup.pick;
  const c = core.collectionOf(M.cat, rd.product, rd.collection);
  return tv(c ? c.label : rd.collection) + ' · ' + S().setup.pick;
}

/* ════════ the guided start (Roman shades and drapery) ════════
   Kaan's mapping of 2026-11-26. Mira opens with "What can I do for you?" and three ways in:
   · "Help me choose a fabric" — the rooms and their windows first, then three choices in one card (the range, the
     light, the colours) for all of them or room by room, then the sizes and the options one by one;
   · "Quick quote" — a size and a number of windows, answered with where each range starts;
   · "I have a question" — what she can answer, as quick replies.
   Cellular and pleated shades keep the first screen they had. */
const GUIDED = (pid) => pid === 'roman' || pid === 'drapery';
const pagePid = () => { const s = SHOP.snapshot && SHOP.snapshot(); return (s && s.pid) || (location.pathname.match(/roman|cellular|pleated|drapery/) || [''])[0]; };
const kindSet = (k) => k === 'linen' ? { op: 'linen' } : { kind: k };          /* "linen" answers the light question */
function say(text, extras){ addMsg('m', text, extras); M.history.push({ role: 'assistant', text }); }
function startGuide(i){
  if(M.busy || !M.ready) return;
  const L = S();
  openPanel(); if(!hand.hidden) closeHandoff();
  const starts = thread.querySelector('.mira-starts'); if(starts) starts.remove();
  input.placeholder = t('ph');
  addMsg('y', L.startersG[i]); M.history.push({ role: 'user', text: L.startersG[i] });
  lockCards(); setChips([]);
  setTimeout(() => { if(i === 0) guideRooms(); else if(i === 1) guideQuote(); else guideQuestions(); }, 380);
}
/* 1 — a fabric: the rooms come first (Kaan), then the three choices — for all of them, or room by room */
function guideRooms(){
  /* a list of rooms is already open: straight to its fabric step */
  if(M.project && !M.project.added){ beginSetup(); return; }
  M.guide = { step: 'rooms' }; M.guideSet = null;
  say(S().guide.roomsFirst, { picker: true });
  setChips([]);
}
/* the three choices before any room is listed: after a quick quote, where the size and the number of windows are known */
function guideFabric(set){
  /* a list of rooms is already open: its own fabric step does this */
  if(M.project && !M.project.added){ beginSetup(); return; }
  M.guide = { step: 'fabric' }; M.guideSet = null;
  M.col = null; retireColourCards();
  if(set) Object.assign(colState(), set);
  M.decided.colour = false;
  say(set && set.kind ? S().setup.kindSaid : S().guide.fabricQ, { colours: true });
  setChips([]); renderNow();
}
function keepGuideSet(){ const C = M.col; M.guideSet = C ? { kind: C.kind, op: C.op, fam: C.fam.slice(), only: C.only } : null; }
/* "Continue" under the three choices: on to the rooms */
function guideFabricDone(el){
  const L = S(), d = designOf(SHOP.snapshot());
  if(M.decided.colour !== true){ el.querySelector('.er').hidden = false; return; }
  const said = fabricLabel(d) + (M.linerAuto && d.liner === 'Blackout liner' ? ' · ' + tv(d.liner).toLowerCase() : '');
  addMsg('y', said); M.history.push({ role: 'user', text: said });
  keepGuideSet(); M.col = null;
  lockCards();
  M.guide = { step: 'rooms' };
  setTimeout(() => { say(L.guide.roomsQ, { picker: true }); setChips([]); }, 380);
}
/* a list of rooms made in the guided start: the fabric step follows at once. Where the fabric was chosen before
   the rooms (after a quick quote), every room starts with that fabric */
function adoptGuide(){
  const P = M.project;
  P.fromGuide = true;
  if(M.decided.colour === true && (M.guide.step === 'fabric' || M.guideSet)){
    if(M.guide.step === 'fabric') keepGuideSet();
    const G = M.guideSet || {};
    P.rooms.forEach(r => { r.colourChosen = true; if(G.op === 'blackout') r.linerChosen = true; });
    P.confirmColour = P.rooms.length > 1;
  }
  M.guide = null; M.col = null;
  lockCards();
}
/* 2 — a quick quote: the size and the number of windows, then where each range starts */
function guideQuote(){
  M.guide = { step: 'quote', n: 1 };
  say(S().guide.quoteQ, { quoteForm: true });
  setChips([]);
}
function quoteFormHTML(){
  const L = S(), G = L.guide;
  return '<div class="mira-pick qf"><div class="sz first"><span>' + esc(G.qSize) + '</span><div><input class="pw" type="number" inputmode="decimal" step="0.125" min="8" placeholder="' + esc(L.pick.w) + '" aria-label="' + esc(L.pick.w) + '"><i>×</i>' +
    '<input class="ph" type="number" inputmode="decimal" step="0.125" min="8" placeholder="' + esc(L.pick.h) + '" aria-label="' + esc(L.pick.h) + '"></div></div>' +
    '<div class="pk on"><span class="ql">' + esc(G.qCount) + '</span><span class="qt"><button type="button" data-q="-1" aria-label="−">−</button><b>1</b><button type="button" data-q="1" aria-label="+">+</button></span></div>' +
    '<p class="er" hidden>' + esc(G.qNeed) + '</p><button type="button" class="go">' + esc(G.qGo) + '</button></div>';
}
function submitQuote(pk){
  const w = parseFloat(pk.querySelector('.pw').value), h = parseFloat(pk.querySelector('.ph').value);
  if(!(w > 0 && h > 0)){ pk.querySelector('.er').hidden = false; return; }
  pk.classList.add('done'); pk.querySelectorAll('button, input').forEach(x => { x.disabled = true; });
  M.guide = { step: 'quote', n: Math.max(1, +pk.querySelector('.qt b').textContent || 1) };
  send(w + ' x ' + h);
}
/* the lowest price in each range at the size on the page, with the page's own options; null where the page shows no prices */
function tierPrices(n){
  const snap = SHOP.snapshot(), pid = snap.pid, base = designOf(snap), L = S();
  if(!SHOP.quote || !snap.prices) return null;
  const list = colourList(pid).filter(x => !x.hidden), colls = [];
  list.forEach(x => { if(colls.indexOf(x.coll) === -1) colls.push(x.coll); });
  const q = SHOP.quote(colls.map(id => ({ sel: { collection: id, colour: core.colours(M.cat, pid, id)[0] }, w: base.w, h: base.h }))) || [];
  return TIER_ORDER.map(k => {
    let m = null;
    colls.forEach((id, i) => { if(q[i] != null && (m == null || q[i] < m) && list.some(x => x.coll === id && x.kinds.indexOf(k) !== -1)) m = q[i]; });
    return m == null ? null : { k, label: L.setup.kind[k][0], desc: L.setup.kind[k][1], price: L.setup.from(money(m)) + (n > 1 ? ' ' + L.guide.each : ''), sub: n > 1 ? L.guide.forN(money(Math.round(m * n * 100) / 100), n) : '' };
  }).filter(Boolean);
}
function tiersHTML(list){
  return '<div class="mira-opts mira-tiers">' + list.map(o => '<button type="button" class="mira-opt" data-tier="' + o.k + '"><span class="tx"><b>' + esc(o.label) + '</b><small>' + esc(o.desc) + '</small></span>' +
    '<span class="pz">' + esc(o.price) + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</span></button>').join('') + '</div>';
}
/* a range tapped under a quote: its fabrics, with that first choice made */
function pickTier(k){
  const label = S().setup.kind[k][0];
  addMsg('y', label); M.history.push({ role: 'user', text: label });
  lockCards(); setChips([]);
  setTimeout(() => guideFabric({ kind: k }), 380);
}
/* 3 — questions: what Mira can answer, as quick replies; the other two ways in stay at hand */
function guideQuestions(){
  M.guide = { step: 'ask', asked: [] };
  say(S().guide.askQ);
  setChips(guideTopics(''));
}
function guideTopics(asked){
  const L = S(), pid = SHOP.snapshot().pid, G = M.guide;
  if(asked) G.asked = (G.asked || []).concat([asked]);
  return L.guide.topics.filter((x, i) => (i !== 4 || pid !== 'drapery') && (G.asked || []).indexOf(x) === -1)     /* drapery has no inside / outside mount */
    .concat([0, 1].map(i => ({ label: L.startersG[i], act: 'guide', value: String(i) })));
}

/* the rooms offered in the picker, each with the need most people have there */
const PICK = [['Bedroom', 'dark'], ['Living Room', 'soft'], ['Kitchen', 'soft'], ['Dining Room', 'soft'], ['Bathroom', 'privacy'], ['Home Office', 'soft'], ['Nursery', 'dark']];
/* what a need means on THIS product's page */
function needPatch(pid, need, base){
  const p = {}, c = base.collection || '', bo = /BO$/.test(c);
  if(pid !== 'cellular') return p;                       /* Roman shades and drapery: a liner is offered later, nothing is chosen here */
  if(need === 'dark') p.collection = ({ CH: 'CHBO', CHBO: 'CHBO', XH: 'XHBO', XHBO: 'XHBO' })[c] || 'BHBO';
  else if(need === 'heat') p.collection = bo ? 'CHBO' : 'CH';
  else if((need === 'soft' || need === 'privacy') && bo) p.collection = ({ BHBO: 'BH', CHBO: 'CH', XHBO: 'XH' })[c] || 'BH';
  return p;
}
/* "bedroom × 2 — dark, living room × 3 — soft light": rooms with their own need, in one message */
function parseRoomNeeds(raw, min){
  const s = B.norm(raw).replace(B.SIZE_ANY, ' ');
  const out = [];
  s.split(/[,;\n]|\band\b|\by\b|\bet\b/).forEach(c => {
    const room = B.roomClause(c);                          /* "bedroom 1 has 4": the room's own number is not its count */
    if(!room) return;
    const need = /blackout|\bdark|sleep|oscur|dormir|occult|obscur|sombre|dans le noir|noir (complet|total|pour)/.test(c) ? 'dark' : /privacy|street|privacidad|\bcalle\b|intimite|\brue\b|vis.a.vis/.test(c) ? 'privacy'
      : /\bheat|\bhot\b|\bcold\b|insulat|calor|\bfrio|aisla|chaleur|\bchaud|\bfroid|\bisol/.test(c) ? 'heat' : /soft|daylight|light|luz|suave|filtr|lumiere|douce|tamis/.test(c) ? 'soft' : null;
    out.push({ label: room.label, index: room.index, qty: room.qty, need, counted: room.counted });
  });
  return out.length >= (min || 2) ? B.nameRooms(out) : null;
}
/* the project as a list the customer can edit: per room what it gets, how many windows, their
   sizes (one for the room, or one per window) and — where the page shows prices — what each costs */
function planCard(){
  const snap = SHOP.snapshot(), base = designOf(snap), wins = projectWindows(base);
  const quoted = SHOP.quote ? SHOP.quote(wins.map(x => x.design ? { sel: selDiff(base, x.design), w: x.design.w, h: x.design.h } : {})) : [];
  let total = 0, all = wins.length > 0;
  const rooms = M.project.rooms.map((r, i) => {
    const rd = roomDesign(base, r);
    const extra = ['drive', 'liner', 'tdbu', 'mount', 'fold', 'heading'].filter(k => rd[k] !== base[k] && rd[k] != null && !(k === 'mount' && mountInRow(snap.pid))).map(k => k === 'tdbu' ? 'TDBU' : tv(rd[k]).toLowerCase());
    const mine = [];
    wins.forEach((x, n) => {
      if(x.i !== i) return;
      const pr = x.design ? quoted[n] : null;
      if(pr == null) all = false; else total += pr;
      mine.push({ k: x.k, w: x.design ? x.design.w : '', h: x.design ? x.design.h : '', price: pr != null ? money(pr) : '', num: pr, mount: mountOf(r, x.k, base),
        msg: x.notes.filter(n => n.code !== 'size_clamped').map(n => B.noteText(M.lang, n)).filter(Boolean).join(' ') });
    });
    return { i, name: roomName(r.label), qty: r.qty, split: !!r.split, flash: r.flash || '', wins: mine,
      sub: [roomFabric(r, rd), r.need ? S().needShort[r.need] : null].concat(extra).filter(Boolean).join(' · ') };
  });
  const units = projectUnits();
  const st = M.project.setup;
  return { rooms, units, mounts: mountInRow(snap.pid), sum: all ? Math.round(total * 100) / 100 : null, live: !M.project.added, next: !st.done, noNext: !!st.asking && wins.some(x => !x.design), sizeStep: st.at >= 0 && !st.done && setupSteps()[st.at] === 'size', missing: wins.filter(x => !x.design).length,
    note: all ? S().planTotal({ units, total: money(Math.round(total * 100) / 100) }) : (snap.prices ? S().planNoSize : '') };
}
function planHTML(pl){
  const P = S().plan, dis = pl.live ? '' : ' disabled';
  const sizeRow = (label, k, w) => '<div class="z" data-k="' + k + '"><label>' + esc(label) + '</label>' +
    '<input class="zw" type="number" inputmode="decimal" step="0.125" min="8" value="' + esc(w.w) + '" placeholder="' + esc(P.w) + '" aria-label="' + esc(label + ' ' + P.w) + '"' + dis + '><i>×</i>' +
    '<input class="zh" type="number" inputmode="decimal" step="0.125" min="8" value="' + esc(w.h) + '" placeholder="' + esc(P.h) + '" aria-label="' + esc(label + ' ' + P.h) + '"' + dis + '>' +
    '<span class="pr">' + esc(w.price ? w.price + (k === 'all' ? ' ' + P.each : '') : '') + '</span></div>' +
    '<p class="zm"' + (w.msg ? '' : ' hidden') + '>' + esc(w.msg || '') + '</p>' +
    (pl.mounts ? '<div class="zt" data-k="' + k + '"><label>' + esc(t('row').mount) + '</label><span class="mt">' + ['Inside', 'Outside'].map(v =>
      '<button type="button" data-mt="' + v + '"' + (w.mount === v ? ' class="on"' : '') + dis + '>' + esc(tv(v)) + '</button>').join('') + '</span></div>' : '');
  return '<div class="mira-plan' + (pl.live ? ' live' : '') + '">' + pl.rooms.map(r =>
    '<div class="p" data-i="' + r.i + '"><div class="a"><b>' + esc(r.name) + '</b>' +
      '<span class="qt"><button type="button" data-pq="-1" aria-label="−"' + dis + '>−</button><b>' + r.qty + '</b><button type="button" data-pq="1" aria-label="+"' + dis + '>+</button></span></div>' +
    '<div class="s" title="' + esc(r.sub) + '">' + esc(r.sub) + '</div>' +
    (r.split ? r.wins.map(w => sizeRow(P.win(w.k + 1), w.k, w)).join('') : sizeRow(P.size, 'all', r.wins[0] || { w: '', h: '', price: '', msg: '' })) +
    '<p class="zm fl"' + (r.flash ? '' : ' hidden') + '>' + esc(r.flash) + '</p>' +
    (pl.live ? '<div class="ln">' + (r.qty > 1 ? '<button type="button" class="sp">' + esc(r.split ? P.same : P.split) + '</button>' : '<span></span>') +
      '<button type="button" class="rv">' + esc(P.remove) + '</button></div>' : '') + '</div>').join('') +
    '<div class="tt">' + esc(pl.note || '') + '</div>' +
    (pl.live ? (pl.sizeStep ? '<button type="button" class="addall sizego">' + esc(S().setup.cont) + ' →</button>' : pl.next ? '<button type="button" class="addall next"' + (pl.noNext ? ' hidden' : '') + '>' + esc(S().setup.next) + ' →</button>' : '<button type="button" class="addall">' + esc(P.add(pl.units)) + '</button>') : '') + '</div>';
}
/* a size typed into the list: update the numbers around it without redrawing the fields being typed in */
function syncPlan(){
  const el = thread.querySelector('.mira-plan.live'); if(!el || !M.project) return;
  const pl = planCard(), P = S().plan;
  pl.rooms.forEach(r => {
    const p = el.querySelector('.p[data-i="' + r.i + '"]'); if(!p) return;
    const set = (row, w, each) => {
      if(!row) return;
      row.querySelector('.pr').textContent = w.price ? w.price + (each ? ' ' + P.each : '') : '';
      const zw = row.querySelector('.zw'), zh = row.querySelector('.zh');
      if(document.activeElement !== zw && w.w !== '' && +zw.value !== w.w) zw.value = w.w;
      if(document.activeElement !== zh && w.h !== '' && +zh.value !== w.h) zh.value = w.h;
      const m = row.nextElementSibling; if(m && m.classList.contains('zm')){ m.textContent = w.msg || ''; m.hidden = !w.msg; }
    };
    if(r.split) r.wins.forEach(w => set(p.querySelector('.z[data-k="' + w.k + '"]'), w, false));
    else if(r.wins[0]) set(p.querySelector('.z[data-k="all"]'), r.wins[0], true);
    const fl = p.querySelector('.fl'); if(fl){ fl.textContent = r.flash; fl.hidden = !r.flash; }
  });
  el.querySelector('.tt').textContent = pl.note || '';
  const nb = el.querySelector('.addall.next'); if(nb) nb.hidden = !!pl.noNext;     /* sizes typed in: the button is back */
}
/* what a room gets stays on one line (Kaan): the type shrinks a little first, and only then is the end cut off */
function fitPlan(){
  thread.querySelectorAll('.mira-plan .s').forEach(el => {
    el.style.fontSize = '';
    let f = parseFloat(getComputedStyle(el).fontSize) || 13;
    while(el.scrollWidth > el.clientWidth + 1 && f > 10.5){ f -= .5; el.style.fontSize = f + 'px'; }
  });
}
/* a change to the list itself (windows added, split, a room removed): draw it again */
function redrawPlan(){
  const el = thread.querySelector('.mira-plan.live'); if(!el || !M.project) return;
  if(!M.project.rooms.length){ M.project = null; el.remove(); return; }
  const tmp = document.createElement('div'); tmp.innerHTML = planHTML(planCard());
  el.replaceWith(tmp.firstChild);
  fitPlan(); renderNow();
}
function pickerHTML(){
  const L = S(), g = !!(M.guide && M.guide.step === 'rooms');      /* the guided start: the light is already chosen, so no need is asked */
  return '<div class="mira-pick' + (g ? ' g' : '') + '">' + PICK.map(([room, need]) =>
    '<div class="pk" data-room="' + room + '"><button type="button" class="rm" aria-pressed="false">' + esc(roomName(room)) + '</button>' +
      '<select class="nd" hidden aria-label="' + esc(roomName(room)) + '">' + ['dark', 'soft', 'privacy', 'heat'].map(n => '<option value="' + n + '"' + (n === need ? ' selected' : '') + '>' + esc(L.needPick[n]) + '</option>').join('') + '</select>' +
      '<span class="qt" hidden><button type="button" data-q="-1" aria-label="−">−</button><b>1</b><button type="button" data-q="1" aria-label="+">+</button></span></div>').join('') +
    '<div class="sz"><span>' + esc(L.pick.size) + '</span><div><input class="pw" type="number" inputmode="decimal" step="0.125" min="8" placeholder="' + esc(L.pick.w) + '" aria-label="' + esc(L.pick.w) + '"><i>×</i>' +
      '<input class="ph" type="number" inputmode="decimal" step="0.125" min="8" placeholder="' + esc(L.pick.h) + '" aria-label="' + esc(L.pick.h) + '"></div></div>' +
    '<p class="er" hidden>' + esc(L.pick.none) + '</p><button type="button" class="go">' + esc(g ? L.guide.roomsGo : L.pick.go) + '</button></div>';
}
/* the picker's choices become one ordinary message, so the list reads back in the chat */
function submitPicker(pk){
  const L = S(), rows = [].slice.call(pk.querySelectorAll('.pk.on'));
  if(!rows.length){ pk.querySelector('.er').hidden = false; return; }
  const g = pk.classList.contains('g');
  const list = rows.map(r => roomName(r.dataset.room) + ' × ' + r.querySelector('.qt b').textContent + (g ? '' : ' — ' + L.need[r.querySelector('.nd').value].toLowerCase()));
  const w = parseFloat(pk.querySelector('.pw').value), h = parseFloat(pk.querySelector('.ph').value);
  pk.classList.add('done');
  pk.querySelectorAll('button, select, input').forEach(x => { x.disabled = true; });
  M.fromPicker = true;
  send(list.join(', ') + (w > 0 && h > 0 ? ' — ' + L.pick.all + ' ' + w + ' x ' + h : ''));
}
/* "help me choose": turn a room and a need into something this page can set, with the reason */
function advise(r, snap, before){
  const L = S(), pid = snap.pid, lines = [], patch = {}, chips = [], links = [];
  const coll = core.collectionOf(M.cat, pid, before.collection);
  const kind = ((coll && coll.meta && coll.meta.transparency) || (coll && coll.label) || '').toLowerCase();
  if(r.need.dark && !r.said.noBlackout) lines.push(L.why.dark);
  const named = pid === 'roman' || pid === 'drapery';
  let open = false;
  if(r.need.soft){
    /* Roman shades and drapery: no fabric is picked — the light step leaves out the dark ones (Kaan, quiz 3) */
    if(named){ lines.push(L.why.softF); open = !r.patch.collection && (!M.decided.colour || /blackout|darkening/.test(kind)); }
    else { if(/blackout|sheer|darkening/.test(kind) && !r.patch.collection) patch.collection = pid === 'cellular' ? 'BH' : 'outlander'; lines.push(L.why.soft); }
  }
  if(r.need.privacy){
    lines.push(named ? L.why.privacyF : L.why.privacy);
    const p = M.cat[pid];
    if(p.steps.tdbu) chips.push(L.chips.privacy[0]);
    if(p.steps.liner) chips.push(L.chips.privacy[1]);
  }
  if(r.need.heat){
    if(pid === 'cellular'){ if(before.collection === 'BH' && !r.patch.collection) patch.collection = 'CH'; lines.push(L.why.heatC); }
    else { lines.push(L.why.heat); links.push('cellular'); }
  }
  if(r.room === 'kitchen' || r.room === 'bath'){
    if(pid === 'pleated' || pid === 'cellular') lines.push(L.why.wetOk);
    else { lines.push(L.why.wet); links.push('pleated'); }
  }
  return { lines, patch, chips, links, open };
}
function mockReply(text){
  const L = S(), snap = SHOP.snapshot(), before = designOf(snap);
  const r = B.understand(M.cat, before, text), a = r.ask, parts = [];
  let chips = null, priceBox = false, plan = false, tail = '', picker = false, startSetup = false, colourFor = false, colourSet = null, tiers = false;
  const drapery = snap.pid === 'drapery';

  /* another product: that is another page */
  if(r.patch.product && r.patch.product !== snap.pid){
    const there = r.patch.product;
    return { reply: L.otherPage({ here: prodName(snap.pid), there: prodName(there) }),
      chips: [{ label: L.open(prodName(there)), go: core.PRODUCT_PAGE[there], carry: text }] };
  }
  delete r.patch.product;
  if(a.human) return { reply: L.human, handoff: true };
  const namedPage = snap.pid === 'roman' || snap.pid === 'drapery';
  if(namedPage && /\bquote\b|cotiza|presupuesto|\bdevis\b/.test(B.norm(text))) a.price = true;
  /* a size given while a quick quote is open is answered with where each range starts; the number of windows is for the sum only */
  const quoting = namedPage && !!(M.guide && M.guide.step === 'quote') && (r.patch.w != null || r.patch.h != null) && !(M.project && !M.project.added);
  if(quoting && r.patch.qty){ M.guide.n = r.patch.qty; delete r.patch.qty; }
  /* a plain colour word ("blue", "something beige") is not the choice of a colour: on these pages nothing is
     picked for the customer — the fabric choices open instead. A colour called by its own name is still taken. */
  const nm = r.said.colourName;
  /* "taupe", "charcoal", "olive" are also the names of single colours — said on their own they are the colour word */
  const generic = namedPage && !!nm && !nm.collection && !/\s/.test(nm.name) && famWords(nm.name).length > 0;
  const undo = namedPage && (r.said.colourWord || (generic ? nm : null));
  if(undo){ if(undo.collection) r.patch.collection = undo.collection; else delete r.patch.collection; delete r.patch.colour; r.said.colour = false; }
  /* the colour families that word opens in the filter (Kaan, quiz 3: yes, fill it in — the customer can still change it) */
  const famSaid = namedPage && !r.said.colour ? famWords(B.norm(text)) : [];
  const wordAsk = namedPage && (!!undo || famSaid.length > 0);
  const kindWord = wordAsk ? KIND_WORDS.filter(k => k[1].test(B.norm(text)))[0] : null;       /* "linen" is a kind of fabric here */
  const withFam = (o) => { if(famSaid.length){ o.fam = famSaid.slice(); o.famSaid = famSaid.slice(); } return Object.keys(o).length ? o : null; };
  let colourKeep = false, warnSheer = false, sizeAsk = false;
  const darkAsk = namedPage && r.need.dark && r.patch.collection === 'obscura' && !/obscura/.test(B.norm(text));
  if(darkAsk){ delete r.patch.collection; delete r.patch.colour; r.said.colour = false; r.need.dark = false; }
  /* "sheers": not one sheer fabric picked for the customer — the fabric choices open on that light level */
  const sheerAsk = namedPage && r.need.sheer && r.patch.collection === 'soho' && !/soho/.test(B.norm(text));
  if(sheerAsk) delete r.patch.collection;

  /* several rooms, each with its own need: those needs belong to the rooms, not to the page */
  let rn = parseRoomNeeds(text, M.fromPicker ? 1 : 2);
  /* rooms that are already in the list, named without a count ("bedroom 1 motorized, bedroom 2 cordless"): a change, not a new list */
  if(rn && !M.fromPicker && M.project && !M.project.added && rn.every(x => !x.counted && M.project.rooms.some(q => q.label === x.label || q.label.indexOf(x.label + ' ') === 0))) rn = null;
  if(rn) ['collection', 'colour', 'liner'].forEach(k => { delete r.patch[k]; });
  /* a room and a need, with or without "help me choose" */
  const adv = rn ? { lines: [], patch: {}, chips: [], links: [] } : advise(r, snap, before);
  Object.assign(r.patch, adv.patch);
  const hasPatch = Object.keys(r.patch).length > 0;

  /* a list of rooms starts (or replaces) the project */
  let isNew = false;
  if(rn){
    M.project = newProject(rn.map(x => newRoom(x.label, x.qty, x.need, x.need ? needPatch(snap.pid, x.need, before) : {})));
    isNew = true;
    if(snap.pid === 'pleated' && rn.some(x => x.need === 'dark')) r.said.noBlackout = true;
  } else if(r.rooms){ M.project = newProject(r.rooms.map(x => newRoom(x.label, x.qty))); isNew = true; }
  if(isNew && namedPage && M.guide && (M.guide.step === 'rooms' || M.guide.step === 'fabric')) adoptGuide();
  const pending = M.project && !M.project.added;
  /* one window on its own: the need last said decides which light levels the fabric choices leave out */
  if(namedPage && !pending){ if(r.need.privacy) M.pageNeed = 'privacy'; else if(r.need.soft) M.pageNeed = 'soft'; else if(darkAsk || r.need.sheer) M.pageNeed = null; }
  const sheerNow = (id) => { const c = core.collectionOf(M.cat, snap.pid, id); return !!c && opacityOf(id, c.meta) === 'sheer'; };

  /* "room 3 …": a change for that room only */
  let notes = [], roomDone = false;
  const target = pending && !isNew && hasPatch ? B.roomTarget(text, M.project.rooms) : -1;
  if(target >= 0){
    /* a change to one room of the list is just that — no general advice on top */
    adv.lines.length = 0; adv.links.length = 0; adv.chips.length = 0;
    const room = M.project.rooms[target];
    const merged = Object.assign({}, room.patch, r.patch);
    const out = core.applyPatch(M.cat, before, merged);
    /* a size said for the room goes to every window in it; the rest stays with the room */
    if(merged.w != null || merged.h != null){
      room.sizes = room.sizes.map(z => ({ w: out.design.w, h: out.design.h }));
      delete merged.w; delete merged.h;
    }
    room.patch = merged;
    if(namedPage && r.patch.liner === 'Blackout liner' && sheerNow(out.design.collection)) warnSheer = true;
    if(darkAsk) room.need = 'dark';
    if(r.said.colour) room.colourChosen = true;
    parts.push(L.roomSet({ room: roomName(room.label), what: diffLabel(before, out.design) || (darkAsk ? L.need.dark.toLowerCase() : cfgLabel(out.design)) }));
    out.notes.map(n => B.noteText(M.lang, n)).filter(Boolean).forEach(x => parts.push(x));
    roomDone = true;
  } else if(hasPatch){
    if(pending && !isNew && r.said.colour){
      /* a colour said for all of them goes to every room, each within its own kind of fabric */
      M.project.rooms.forEach(room => {
        const pr = B.understand(M.cat, roomDesign(before, room), text).patch;
        if(pr.colour){ if(pr.collection) room.patch.collection = pr.collection; room.patch.colour = pr.colour; room.colourChosen = true; }
      });
    }
    ['mount', 'drive', 'tdbu', 'liner', 'fold', 'heading', 'banding'].forEach(k => { if(r.patch[k] != null) M.decided[k] = true; });
    if(r.said.colour) M.decided.colour = true;
    /* a need changed the kind of fabric but no colour was named: the colour stays the customer's to pick */
    if(!pending && r.patch.collection && !r.said.colour){ colourFor = true; M.decided.colour = false; colourSet = { only: r.patch.collection }; }
    if(!pending && wordAsk && !colourFor){ colourFor = true; M.decided.colour = false; colourSet = withFam(kindWord ? kindSet(kindWord[0]) : {}); }
    if(!pending && sheerAsk && !colourFor){ colourFor = true; M.decided.colour = false; colourSet = withFam({ op: 'sheer' }); }
    if(!pending && adv.open && !colourFor){ colourFor = true; M.decided.colour = false; }
    const out = core.applyPatch(M.cat, before, r.patch);
    if(namedPage && r.patch.liner === 'Blackout liner' && (pending ? M.project.rooms.some(x => sheerNow(x.patch.collection || out.design.collection)) : sheerNow(out.design.collection))) warnSheer = true;
    notes = out.notes;
    if(r.patch.w != null || r.patch.h != null){
      M.sizeSaid = true;
      /* "all 36 x 60": the rooms give up the sizes of their own */
      if(pending && !isNew && /\b(all|every|todas|todos|hepsi|tous|toutes)\b/.test(B.norm(text))) M.project.rooms.forEach(x => { x.sizes = x.sizes.map(() => null); });
    }
    out.design.sized = M.sizeSaid;
    toShop(before, out.design);          /* what changed is shown as a card by send() */
  }
  adv.lines.forEach(x => parts.push(x));
  notes.map(n => B.noteText(M.lang, n)).filter(Boolean).forEach(x => parts.push(x));
  if(r.said.noBlackout) parts.push(L.noBlackout);
  if(warnSheer) parts.push(L.setup.sheerLiner);
  if(r.said.noColour && !famSaid.length) parts.push(B.noteText(M.lang, { code: 'unknown', what: 'colour' }));

  /* questions */
  if(a.mountdiff) parts.push(L.mountdiff);
  if(a.child) parts.push(L.child);
  if(a.ship) parts.push(L.ship(snap.pid === 'cellular' ? L.shipC : L.shipO));
  if(a.guarantee) parts.push(L.guarantee);
  if(a.measure) parts.push(L.measure);
  if(a.samples) parts.push(L.samples);
  if(a.about) parts.push(L.about);
  if(a.trade) parts.push(L.trade);
  if(a.contact && !a.trade && !a.samples) parts.push(L.contact);

  const now = SHOP.snapshot(), cur = designOf(now);
  const unit = L.unit[now.pid];
  const priced = now.prices && now.price != null;
  /* no price on the page: a button to the free account, not a refusal — shown once, and whenever asked */
  const offerPrice = (force) => { if(priced) return; if(force || !M.saidAccount){ M.saidAccount = true; if(now.account) parts.push(L.priceAccount); else priceBox = true; } };

  /* into the cart */
  const sayAdd = a.add || (a.yes && (pending || M.askedAdd));
  if(sayAdd && now.missing.length){
    parts.push(L.needChoice(missingLabel(now)));
    chips = core.options(M.cat, now.pid, now.missing[0]).map(o => tv(o));
  } else if(sayAdd && pending && !M.project.setup.done){
    parts.push(L.setup.first); startSetup = true; chips = [];
  } else if(sayAdd && pending && unsized()){
    parts.push(L.planNeed(unsized())); plan = true;
    chips = (drapery ? L.chips.sizeD : L.chips.size).slice();
  } else if(sayAdd && pending){
    const items = roomItems(cur), n = SHOP.addLines(items), units = projectUnits();
    M.project.added = true; M.askedAdd = false;
    const post = SHOP.snapshot();
    parts.push(L.roomsAdded({ lines: n, units, unit }));
    if(post.cartTotal != null) parts.push(L.cartTotal(money(post.cartTotal))); else offerPrice(true);
    parts.push(L.afterAdd);
    SHOP.showCart();
    chips = L.chips.added.slice();
  } else if(sayAdd){
    const label = r.room ? ({ living: 'Living Room', bedroom: 'Bedroom', kitchen: 'Kitchen', dining: 'Dining Room', bath: 'Bathroom', office: 'Home Office', nursery: 'Nursery' })[r.room] || '' : '';
    SHOP.addLines([{ label, qty: now.qty }]);
    M.askedAdd = false;
    const post = SHOP.snapshot();
    parts.push(L.added1({ qty: now.qty, cfg: cfgLabel(cur) }));
    if(post.cartTotal != null) parts.push(L.cartTotal(money(post.cartTotal))); else offerPrice(false);
    SHOP.showCart();
    chips = L.chips.added.slice();
  } else if(a.cart && !a.add){
    if(now.cart.length){ parts.push(L.cartHere({ lines: now.cart.length, units: now.cartUnits })); SHOP.showCart(); }
    else parts.push(L.cartEmpty);
  } else if(a.share && !hasPatch){
    return { reply: L.share, chips: [{ label: t('copy'), act: 'copy', value: shareLink() }].concat(navigator.share ? [{ label: t('shareBtn'), act: 'share', value: shareLink() }] : []) };
  } else if(pending){
    /* the project as it stands — a card, room by room — then the one question that moves it on */
    const rooms = M.project.rooms.length, units = projectUnits();
    if(isNew) parts.push(M.project.fromGuide ? L.guide.got(rooms, units) : L.rooms({ rooms, units, unit, size: M.sizeSaid ? sizeLabel(cur) : '' }));
    else if(wordAsk && !roomDone && !hasPatch && !parts.length){
      /* a colour word while the list is open: nothing is picked for the rooms. If the colour question is the open one,
         its card comes back with the filter set; otherwise the colour waits for its step */
      const P = M.project, atColour = P.setup.at >= 0 && !P.setup.done && setupSteps()[P.setup.at] === 'colour';
      if(atColour && famSaid.length){ parts.push(L.setup.famSet(famText(famSaid))); colourFor = true; colourKeep = true; colourSet = withFam({}); }
      else parts.push(L.setup.wordPending);
    }
    else if(!roomDone && !hasPatch && !parts.length) parts.push(L.roomsStill({ rooms, units, unit }));
    plan = isNew || hasPatch || roomDone;
    if(isNew && M.project.fromGuide){ plan = false; startSetup = true; chips = []; }      /* the fabric is chosen: straight on to the sizes and the options */
    else if(colourKeep){ tail = ''; chips = []; }
    else if(M.project.setup.at >= 0 && !M.project.setup.done && setupSteps()[M.project.setup.at] === 'size'){
      tail = unsized() ? L.planFill : L.setup.sizeOk; chips = unsized() ? (drapery ? L.chips.sizeD : L.chips.size).slice() : [];
    }
    else if(unsized() && isNew && M.project.setup.at < 0){ tail = L.setup.sizeAsk(!!now.prices); sizeAsk = true; chips = []; }
    else if(unsized()){ tail = L.planFill + (M.project.setup.at < 0 ? ' ' + L.planLater : ''); chips = (drapery ? L.chips.sizeD : L.chips.size).slice(); }
    else if(!M.project.setup.done){ tail = L.planNext; chips = []; }
    else {
      tail = L.planEdit;
      /* the list has its own "add all" button: the quick replies only show what can be said */
      chips = (now.pid === 'cellular' || now.pid === 'pleated' ? L.chips.projectC : L.chips.project).slice(1);
      /* the example names a room that is really in the list */
      const ex = M.project.rooms[Math.min(2, rooms - 1)];
      chips[0] = chips[0].replace(/^(Room|Habitación|Pièce) 3/, roomName(ex.label));
    }
  } else if(a.several && !hasPatch){
    parts.push(L.several); chips = L.chips.several.slice();
  } else if(a.choose && !adv.lines.length && !hasPatch && namedPage){
    /* Roman shades and drapery: the rooms first, then the three fabric choices (Kaan's mapping) */
    M.guide = { step: 'rooms' }; M.guideSet = null; parts.push(L.guide.roomsFirst); picker = true; chips = [];
  } else if(a.choose && !adv.lines.length && !hasPatch){
    /* several rooms can be chosen at once: a picker, not a one-room question */
    parts.push(L.chooseAsk); picker = true; chips = [];
  } else if(a.fabrics && !r.said.colour && !hasPatch && !wordAsk){
    SHOP.configure({ open: 'collection' }); showStep('collection');
    parts.push(L.fabricsOpen);
  } else if(hasPatch){
    offerPrice(false);                                     /* a visible price rides in the change card */
    if(quoting && priced && M.sizeSaid){ parts.push(L.guide.quoteA(M.guide.n || 1)); tiers = true; }
    else if(darkAsk){ parts.push(L.setup.darkOne); colourFor = true; M.decided.colour = false; }
    else if(colourFor){ const line = colourSet && (colourSet.kind || colourSet.op) ? L.setup.kindSaid : colourSet && colourSet.fam ? L.setup.famSaid(famText(famSaid)) : wordAsk && !colourSet ? L.setup.wordSaid : adv.open ? '' : L.setup.colourOne; if(line) parts.push(line); }
    else if(!M.sizeSaid) parts.push(drapery ? L.q.sizeD : L.q.size);
    else { parts.push(L.askAdd); M.askedAdd = true; }
    chips = tiers ? [] : darkAsk ? [L.chips.liner] : adv.chips.length ? adv.chips.concat(L.chips.cfg.slice(0, 1)) : L.chips.cfg.slice();
  } else {
    if(a.price){
      if(priced) parts.push(M.sizeSaid ? L.price({ price: money(now.price), qty: now.qty, total: money(now.price * now.qty) }) : namedPage ? L.guide.quoteSize : L.priceNeedSize);
      else { offerPrice(true); if(!M.sizeSaid) parts.push(L.priceSizeFirst); }
      if(!M.sizeSaid) chips = (drapery ? L.chips.sizeD : L.chips.size).slice();
      if(namedPage && !M.sizeSaid) M.guide = { step: 'quote', n: 1 };                 /* the size that follows gets the three ranges */
    }
    if(adv.chips.length) chips = adv.chips.slice();
    if(darkAsk && !pending){ parts.push(L.setup.darkOne); colourFor = true; M.decided.colour = false; chips = [L.chips.liner]; }
    /* "something patterned", "linen", "your cheapest": the fabric choices open with that one made */
    const kindSaid = namedPage && !pending && !parts.length && !priceBox ? KIND_WORDS.filter(k => k[1].test(B.norm(text)))[0] : null;
    if(kindSaid){ parts.push(L.setup.kindSaid); colourFor = true; M.decided.colour = false; colourSet = withFam(kindSet(kindSaid[0])); chips = []; }
    else if(wordAsk && !parts.length && !priceBox){
      if(pending) parts.push(L.setup.wordPending);
      else { parts.push(famSaid.length ? L.setup.famSaid(famText(famSaid)) : L.setup.wordSaid); colourFor = true; M.decided.colour = false; colourSet = withFam({}); chips = []; }
    }
    else if(sheerAsk && !pending && !colourFor){ if(!parts.length) parts.push(L.setup.kindSaid); colourFor = true; M.decided.colour = false; colourSet = withFam({ op: 'sheer' }); chips = []; }
    else if(adv.open && !pending && !colourFor){ colourFor = true; M.decided.colour = false; chips = []; }
    if(!parts.length && !priceBox) parts.push(a.thanks ? L.thanks : a.hello ? (namedPage ? L.helloG : L.hello(L.noun[snap.pid])) : L.lost);
  }
  if(!chips && namedPage && M.guide && M.guide.step === 'ask' && !pending) chips = guideTopics(text);      /* still asking: what is left to ask */
  if(!chips) chips = M.sizeSaid ? L.chips.cfg.slice() : (drapery ? L.chips.sizeD : L.chips.size).slice();
  adv.links.forEach(pid => { if(pid !== now.pid) chips.push({ label: L.open(prodName(pid)), go: core.PRODUCT_PAGE[pid], carry: text }); });
  /* a dark room and a colour in one breath: the choices open with that colour ticked */
  if(colourFor && !pending && famSaid.length && !(colourSet && (colourSet.only || colourSet.fam))) colourSet = withFam(colourSet || {});
  return { reply: parts.join('\n\n'), chips, priceBox, plan, tail, picker, startSetup, colourFor, colourSet, colourKeep, sizeAsk, tiers };
}

/* ════════ the live advisor (only when the preview server has a key) ════════ */
async function askServer(){
  const snap = SHOP.snapshot();
  const res = await fetch('/api/design-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: 'product', messages: M.history, design: designOf(snap), lang: M.lang,
      showPrices: !!snap.prices, price: snap.prices ? snap.price : null,
      cart: { lines: snap.cart.length, units: snap.cartUnits }, missing: snap.missing }) });
  if(!res.ok) throw new Error('advisor ' + res.status);
  return res.json();
}
function applyServer(out){
  const snap = SHOP.snapshot(), before = designOf(snap);
  if(out.design && out.design.product === snap.pid){
    if(out.design.w !== before.w || out.design.h !== before.h) M.sizeSaid = true;
    toShop(before, out.design);
  }
  if(Array.isArray(out.addLines) && out.addLines.length){
    const base = designOf(SHOP.snapshot());
    SHOP.addLines(out.addLines.map(x => {
      const d = x.patch && Object.keys(x.patch).length ? core.applyPatch(M.cat, base, x.patch).design : base;
      const sel = {}; changed(base, d).forEach(k => { sel[k] = d[k]; });
      return { label: x.label || '', qty: x.qty || 1, sel, w: d.w, h: d.h };
    }));
    SHOP.showCart();
  }
}

/* ════════ on screen ════════ */
const css = `
  .mira-launch{position:fixed;right:14px;bottom:144px;z-index:75;display:flex;align-items:center;gap:9px;border:0;cursor:pointer;
    background:#14171A;color:#fff;border-radius:999px;padding:12px 18px 12px 14px;box-shadow:0 12px 32px rgba(20,23,26,.28);
    font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;transition:transform .2s,background .2s}
  .mira-launch:hover{background:#8A6220;transform:translateY(-1px)}
  .mira-launch i{width:8px;height:8px;border-radius:50%;background:#C79A45;display:block}
  body.mira-open .mira-launch{display:none}
  .mira-launch[hidden],.mira-card[hidden]{display:none}
  .mira-card{display:grid;grid-template-columns:1fr auto;gap:18px 34px;align-items:center;margin:0 0 30px;padding:24px 26px;
    background:#FAF5EA;border:1px solid #E4E3DE;border-radius:18px}
  .mira-card h3{font-family:'Fraunces',serif;font-weight:560;letter-spacing:-.015em;font-size:24px;line-height:1.1;margin:0 0 8px}
  .mira-card p{margin:0;font-size:14.5px;line-height:1.55;color:#4A4E52;max-width:54ch}
  .mira-card button{border:0;cursor:pointer;background:#14171A;color:#fff;border-radius:12px;padding:17px 24px;white-space:nowrap;
    font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;transition:background .2s}
  .mira-card button:hover{background:#8A6220}
  /* the helper covers the whole page while it is open (Kaan): the chat, and a narrow column for what has been chosen */
  .mira-panel{position:fixed;z-index:80;left:0;right:0;top:0;bottom:0;background:#fff;display:flex;flex-direction:column;
    transform:translateX(102%);transition:transform .45s cubic-bezier(.2,.75,.2,1);font-family:'IBM Plex Sans',system-ui,sans-serif;color:#14171A}
  .mira-body{flex:1 1 auto;min-height:0;display:flex}
  .mira-main{flex:1 1 auto;min-width:0;min-height:0;display:flex;flex-direction:column}
  .mira-main>.mira-hand{padding-left:max(18px,calc(50% - 380px));padding-right:max(18px,calc(50% - 380px))}
  .mira-side{flex:0 0 clamp(250px,23vw,320px);border-left:1px solid #E4E3DE;background:#FAF5EA;overflow-y:auto;overscroll-behavior:contain;padding:18px 16px 24px}
  .mira-side .hd{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8A6220;margin:0 0 6px}
  .mira-side .it{display:flex;gap:10px;align-items:flex-start;padding:11px 0;border-top:1px solid #EADFC8}
  .mira-side .hd + .it{border-top:0}
  .mira-side .th{flex:none;width:44px;height:44px;border-radius:10px;overflow:hidden;background:#F3ECDD;border:1px solid #E4E3DE}
  .mira-side .th img{width:100%;height:100%;object-fit:cover;display:block}
  .mira-side .tx{flex:1;min-width:0;font-size:12.5px;line-height:1.4;color:#4A4E52}
  .mira-side .tx b{display:block;font-family:'Archivo',sans-serif;font-weight:600;font-size:13.5px;color:#14171A}
  .mira-side .tx span{display:block;overflow-wrap:anywhere}
  .mira-side .pr{flex:none;font-family:'Archivo',sans-serif;font-weight:600;font-size:13.5px;white-space:nowrap}
  .mira-side .tot{display:flex;justify-content:space-between;gap:12px;margin-top:4px;padding-top:12px;border-top:1px solid #D9C9A6;font-family:'Archivo',sans-serif;font-weight:600;font-size:15px}
  body.mira-open .mira-panel{transform:none}
  .mira-head{flex:none;display:flex;align-items:center;gap:9px;padding:14px 12px 14px 18px;border-bottom:1px solid #E4E3DE}
  .mira-head b{font-family:'Fraunces',serif;font-weight:560;font-size:21px;letter-spacing:-.01em;line-height:1}
  .mira-ai{font-size:11.5px;color:#5A5E62;background:#F3F2EE;border-radius:6px;padding:3px 8px;white-space:nowrap}
  .mira-human{margin-left:auto;display:flex;align-items:center;gap:6px;border:1px solid #D3D2CC;background:#fff;border-radius:10px;padding:8px 11px;cursor:pointer;
    font:inherit;font-size:13px;color:#14171A;white-space:nowrap}
  .mira-human:hover{border-color:#14171A}
  .mira-human{min-width:0}
  .mira-human span{overflow:hidden;text-overflow:ellipsis}
  .mira-ai,.mira-x,.mira-head b{flex:none}
  .mira-x{border:0;background:transparent;cursor:pointer;font-size:24px;line-height:1;color:#767A7E;padding:2px 6px}
  .mira-x:hover{color:#14171A}
  .mira-now{flex:none;display:flex;gap:12px;align-items:center;padding:11px 18px;background:#FAF5EA;border-bottom:1px solid #E4E3DE}
  .mira-now .th{flex:none;width:42px;height:42px;border-radius:10px;overflow:hidden;background:#F3ECDD;border:1px solid #E4E3DE}
  .mira-now .th img{width:100%;height:100%;object-fit:cover;display:block}
  .mira-now .tx{flex:1;min-width:0;font-size:12.5px;line-height:1.35;color:#4A4E52}
  .mira-now .tx b{display:block;font-family:'Archivo',sans-serif;font-weight:600;font-size:13.5px;color:#14171A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mira-now .tx em{font-style:normal;font-size:11px;color:#8A6220;background:#FCF4E6;border:1px solid #E8D2AC;border-radius:5px;padding:0 5px;margin-left:5px}
  .mira-now .pr{flex:none;text-align:right;font-family:'Archivo',sans-serif;font-weight:600;font-size:17px;white-space:nowrap}
  .mira-now .pr small{display:block;font-family:'IBM Plex Sans',sans-serif;font-weight:400;font-size:11.5px;color:#767A7E}
  .mira-now .pr button{border:0;background:transparent;padding:0;cursor:pointer;font:inherit;font-family:'IBM Plex Sans',sans-serif;font-weight:500;font-size:12.5px;color:#8A6220;
    text-decoration:underline;text-underline-offset:2px}
  .mira-thread{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;padding:18px max(18px,calc(50% - 380px)) 8px}
  .mira-msg{margin:0 0 18px;max-width:96%;animation:mira-rise .35s cubic-bezier(.2,.7,.2,1) both}
  @keyframes mira-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  .mira-msg.m .who{font-size:12px;color:#8C8472;margin-bottom:4px}
  .mira-msg.m .txt{font-size:15.5px;line-height:1.58;color:#22262A;white-space:pre-line}
  .mira-msg.m .txt + .mira-chg, .mira-msg.m .mira-chg + .txt, .mira-msg.m .txt + .mira-pbox, .mira-msg.m .mira-chg + .mira-pbox{margin-top:10px}
  .mira-msg.y{margin-left:auto;width:fit-content;max-width:86%;background:#F3F2EE;color:#14171A;padding:9px 14px;border-radius:14px;font-size:15px;line-height:1.45;white-space:pre-line}
  .mira-msg.n{max-width:none;font-size:11.5px;color:#8C8472;border:1px dashed #DDD3BE;border-radius:9px;padding:7px 11px}
  .mira-starts{display:grid;gap:7px;margin:0 0 18px}
  .mira-start{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:1px solid #D3D2CC;background:#fff;border-radius:12px;padding:13px 14px;cursor:pointer;
    font:inherit;font-size:15.5px;color:#14171A;transition:border-color .2s,background .2s}
  .mira-start:hover{border-color:#14171A;background:#FAF5EA}
  .mira-start svg{flex:none;color:#8A6220}
  .mira-chg{border:1px solid #E4E3DE;border-radius:12px;padding:4px 14px 10px;background:#fff}
  .mira-chg .r{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid #EEEDE8;font-size:14px}
  .mira-chg .r span{color:#767A7E}
  .mira-chg .r b{font-weight:500;text-align:right}
  .mira-chg .f{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:9px;font-size:13px}
  .mira-chg .ok{color:#2F5D25}
  .mira-chg .ok::before{content:"✓ "}
  .mira-undo{border:0;background:transparent;padding:0;cursor:pointer;font:inherit;font-size:13.5px;color:#8A6220;text-decoration:underline;text-underline-offset:2px}
  .mira-undo:disabled{color:#B9B4A6;text-decoration:none;cursor:default}
  .mira-pbox{display:flex;align-items:center;gap:12px;background:#FAF5EA;border-radius:12px;padding:11px 12px 11px 14px;font-size:14px;color:#4A4E52}
  .mira-pbox span{flex:1}
  .mira-pbox button{flex:none;border:0;cursor:pointer;background:#14171A;color:#fff;border-radius:9px;padding:9px 13px;font:inherit;font-size:13.5px;white-space:nowrap}
  .mira-pbox button:hover{background:#8A6220}
  .mira-msg.m .txt + .mira-plan, .mira-msg.m .mira-plan + .txt, .mira-msg.m .txt + .mira-pick, .mira-msg.m .mira-chg + .mira-plan{margin-top:10px}
  .mira-plan{border:1px solid #E4E3DE;border-radius:12px;padding:2px 14px 0;background:#fff}
  .mira-plan .p{padding:10px 0;border-bottom:1px solid #EEEDE8}
  .mira-plan .a{display:flex;justify-content:space-between;gap:12px;align-items:baseline;font-size:14.5px}
  .mira-plan .a b{font-weight:500}
  .mira-plan .a span{font-family:'Archivo',sans-serif;font-weight:600;font-size:14px;white-space:nowrap}
  .mira-plan .s{font-size:13px;color:#767A7E;margin-top:2px;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mira-plan .tt{padding:10px 0 11px;font-size:14px;font-weight:500}
  .mira-plan .a .qt{display:inline-flex;align-items:center;border:1px solid #D3D2CC;border-radius:9px;overflow:hidden;font-family:inherit}
  .mira-plan .a .qt button{border:0;background:#fff;width:28px;height:30px;cursor:pointer;font-size:15px;color:#14171A}
  .mira-plan .a .qt b{min-width:22px;text-align:center;font-weight:500;font-size:13.5px}
  .mira-plan .z{display:flex;align-items:center;gap:7px;margin-top:8px;font-size:13.5px}
  .mira-plan .z label{flex:0 1 68px;min-width:40px;color:#5A5E62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mira-plan .z input{width:66px;flex:0 1 66px;min-width:46px;border:1px solid #D3D2CC;border-radius:8px;padding:7px 8px;font:inherit;font-size:14.5px;background:#fff;color:#14171A}
  .mira-plan .z input:focus{outline:0;border-color:#14171A}
  .mira-plan .z i{font-style:normal;color:#767A7E}
  .mira-plan .z .pr{margin-left:auto;font-family:'Archivo',sans-serif;font-weight:600;font-size:13.5px;white-space:nowrap}
  .mira-plan .zm{margin:5px 0 0;font-size:12.5px;line-height:1.4;color:#8A6220}
  .mira-plan .ln{display:flex;justify-content:space-between;gap:10px;margin-top:8px}
  .mira-plan .ln button{border:0;background:transparent;padding:0;cursor:pointer;font:inherit;font-size:13px;color:#8A6220;text-decoration:underline;text-underline-offset:2px}
  .mira-plan .ln .rv{color:#767A7E}
  .mira-plan .addall{width:100%;margin:2px 0 12px;border:0;cursor:pointer;background:#14171A;color:#fff;border-radius:10px;padding:13px 16px;font:inherit;font-size:15px}
  .mira-plan .addall:hover{background:#8A6220}
  .mira-plan .addall[hidden]{display:none}
  .mira-plan [hidden]{display:none!important}
  .mira-plan:not(.live) input{background:#F7F6F2;color:#5A5E62}
  .mira-plan .p:last-of-type{border-bottom:1px solid #EEEDE8}
  .mira-pick{border:1px solid #E4E3DE;border-radius:12px;padding:10px 12px 12px;background:#fff}
  .mira-pick [hidden]{display:none!important}
  .mira-pick .pk{display:flex;align-items:center;gap:7px;padding:4px 0;flex-wrap:nowrap}      /* a ticked room — name, need, windows — stays on one line */
  .mira-pick .rm{flex:0 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid #D3D2CC;background:#fff;border-radius:999px;padding:8px 12px;cursor:pointer;font:inherit;font-size:14px;color:#14171A}
  .mira-pick .rm:hover{border-color:#14171A}
  .mira-pick .pk.on .rm{background:#14171A;border-color:#14171A;color:#fff}
  .mira-pick .pk.on .rm::before{content:"✓ "}
  .mira-pick .nd{flex:1 1 0;min-width:76px;border:1px solid #D3D2CC;border-radius:9px;padding:8px 6px;font:inherit;font-size:13px;background:#fff;color:#14171A}
  .mira-pick .qt{flex:none;display:inline-flex;align-items:center;border:1px solid #D3D2CC;border-radius:9px;overflow:hidden}
  .mira-pick .qt button{border:0;background:#fff;width:28px;height:34px;cursor:pointer;font-size:16px;color:#14171A}
  .mira-pick .qt b{min-width:22px;text-align:center;font-weight:500;font-size:14px}
  .mira-pick .sz{margin:10px 0 0;padding-top:10px;border-top:1px solid #EEEDE8;font-size:13.5px;color:#4A4E52}
  .mira-pick .sz div{display:flex;align-items:center;gap:8px;margin-top:6px}
  .mira-pick .sz input{width:92px;border:1px solid #D3D2CC;border-radius:9px;padding:9px 10px;font:inherit;font-size:15px;background:#fff;color:#14171A}
  .mira-pick .sz i{font-style:normal;color:#767A7E}
  .mira-pick .er{color:#8A2620;font-size:13px;margin:8px 0 0}
  .mira-pick .go{margin-top:12px;width:100%;border:0;cursor:pointer;background:#14171A;color:#fff;border-radius:10px;padding:13px 16px;font:inherit;font-size:15px}
  .mira-pick .go:hover{background:#8A6220}
  .mira-pick.done{opacity:.6}
  .mira-pick.done .go{display:none}
  .mira-msg.m .txt + .mira-opts, .mira-msg.m .txt + .mira-col{margin-top:10px}
  .mira-opts{display:grid;gap:7px}
  .mira-opt{display:flex;align-items:center;gap:11px;width:100%;text-align:left;border:1px solid #D3D2CC;background:#fff;border-radius:12px;padding:10px 12px;cursor:pointer;
    font:inherit;color:#14171A;transition:border-color .2s,background .2s}
  .mira-opt:hover:not(:disabled){border-color:#14171A;background:#FAF5EA}
  .mira-opt img{flex:none;width:54px;height:54px;border-radius:9px;object-fit:cover;background:#F3ECDD}
  .mira-opt .dot{flex:none;width:26px;height:26px;border-radius:50%;border:1px solid rgba(20,23,26,.18)}
  .mira-opt .tx{flex:1;min-width:0}
  .mira-opt .tx b{display:block;font-weight:500;font-size:15px;line-height:1.3}
  .mira-opt .tx small{display:block;font-size:12.5px;line-height:1.4;color:#767A7E;margin-top:1px}
  .mira-opt .pz{flex:none;font-family:'Archivo',sans-serif;font-weight:600;font-size:12.5px;white-space:nowrap;color:#4A4E52;text-align:right}
  .mira-opt.on{border-color:#14171A;background:#14171A;color:#fff}
  .mira-opt.on .tx small,.mira-opt.on .pz{color:rgba(255,255,255,.75)}
  .mira-opts.done .mira-opt:not(.on){opacity:.45;cursor:default}
  .mira-col{border:1px solid #E4E3DE;border-radius:12px;padding:12px;background:#fff}
  .mira-col .qh{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-weight:500;font-size:14.5px;line-height:1.3;color:#14171A}
  .mira-col .qh i,.mira-col .qa i{flex:none;width:20px;height:20px;border-radius:50%;background:#14171A;color:#fff;font-style:normal;font-family:'Archivo',sans-serif;font-weight:600;font-size:11.5px;display:grid;place-items:center}
  .mira-col .ks{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 14px}
  .mira-col .kd{display:block;text-align:left;border:1px solid #D3D2CC;background:#fff;border-radius:10px;padding:9px 11px;cursor:pointer;font:inherit;color:#14171A;transition:border-color .2s,background .2s}
  .mira-col .kd:hover{border-color:#14171A;background:#FAF5EA}
  .mira-col .kd b{display:block;font-weight:500;font-size:14px;line-height:1.25}
  .mira-col .kd small{display:block;font-size:11.5px;line-height:1.35;color:#767A7E;margin-top:2px}
  .mira-col .kd.on{background:#14171A;border-color:#14171A;color:#fff}
  .mira-col .kd em{display:block;font-style:normal;font-family:'Archivo',sans-serif;font-weight:600;font-size:11.5px;color:#4A4E52;margin-top:4px}
  .mira-col .kd.on small,.mira-col .kd.on em{color:rgba(255,255,255,.75)}
  .mira-col .qa{display:flex;align-items:center;gap:8px;width:100%;border:0;background:#F6F4EE;border-radius:9px;padding:8px 10px;margin:0 0 6px;cursor:pointer;font:inherit;font-size:13.5px;line-height:1.3;color:#5A5E62;text-align:left}
  .mira-col .qa i{background:#2F5D25}
  .mira-col .qa span{flex:1;min-width:0}
  .mira-col .qa b{font-weight:500;color:#14171A}
  .mira-col .qa u{flex:none;font-size:12.5px;color:#8A6220;text-underline-offset:2px}
  .mira-col .qa + .qh{margin-top:12px}
  .mira-col .t .other{border:0;background:transparent;padding:0;cursor:pointer;font:inherit;color:#8A6220;text-decoration:underline;text-underline-offset:2px}
  .mira-col.done .qh,.mira-col.done .ks,.mira-col.done .qa,.mira-col.done .t .other{display:none}
  .mira-col .fams{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
  .mira-col .fam{border:1px solid #D3D2CC;background:#fff;border-radius:999px;padding:7px 12px;cursor:pointer;font:inherit;font-size:13.5px;color:#14171A}
  .mira-col .fam:hover{border-color:#14171A}
  .mira-col .fam.on{background:#14171A;border-color:#14171A;color:#fff}
  .mira-col .scope{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #D3D2CC;border-radius:10px;overflow:hidden;margin:0 0 10px}
  .mira-col .md{border:0;background:#fff;padding:9px 8px;cursor:pointer;font:inherit;font-size:13px;line-height:1.25;color:#4A4E52;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mira-col .md + .md{border-left:1px solid #D3D2CC}
  .mira-col .md.on{background:#14171A;color:#fff}
  .mira-col .rts{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
  .mira-col .rt{border:1px solid #D3D2CC;background:#fff;border-radius:9px;padding:6px 11px;cursor:pointer;font:inherit;font-size:13px;color:#4A4E52}
  .mira-col .rt.ok::after{content:" ✓";color:#2F5D25}
  .mira-col .rt.on{border-color:#14171A;color:#14171A;box-shadow:inset 0 0 0 1px #14171A}
  .mira-col .hint{margin:4px 0 2px;font-size:13px;line-height:1.45;color:#767A7E}
  .mira-col .sw small{display:block;font-size:10px;line-height:1.25;color:#8C8472;margin-top:1px}
  .mira-col .sum{display:flex;flex-wrap:wrap;gap:4px 12px;margin:12px 0 0;padding-top:10px;border-top:1px solid #EEEDE8;font-size:12.5px;color:#767A7E}
  .mira-col .sum .ok{color:#14171A}
  .mira-col.done .fams,.mira-col.done .scope,.mira-col.done .rts,.mira-col.done .hint{display:none}
  .mira-col .g + .g{margin-top:14px;padding-top:12px;border-top:1px solid #EEEDE8}
  .mira-col .g > b{display:block;font-weight:500;font-size:14.5px}
  .mira-col .t{font-size:12.5px;color:#767A7E;margin:1px 0 9px}
  .mira-col .sws{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:11px 8px}
  .mira-col .sws.more{margin-top:9px}
  .mira-col .sw{border:0;background:transparent;padding:0;cursor:pointer;text-align:center;font:inherit}
  .mira-col .sw span{display:block;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#F3ECDD;border:1px solid #E4E3DE}
  .mira-col .sw img{width:100%;height:100%;object-fit:cover;display:block}
  .mira-col .sw em{font-style:normal;font-size:10.5px;line-height:1.25;color:#5A5E62;margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .mira-col .sw.on span{box-shadow:0 0 0 2px #fff,0 0 0 4px #14171A}
  .mira-col .sw.on em{color:#14171A;font-weight:500}
  .mira-col .all{margin-top:10px;border:0;background:transparent;padding:0;cursor:pointer;font:inherit;font-size:13px;color:#8A6220;text-decoration:underline;text-underline-offset:2px}
  .mira-col .er{color:#8A2620;font-size:13px;margin:10px 0 0}
  .mira-col .go{margin-top:12px;width:100%;border:0;cursor:pointer;background:#14171A;color:#fff;border-radius:10px;padding:13px 16px;font:inherit;font-size:15px}
  .mira-col .go:hover{background:#8A6220}
  .mira-col [hidden]{display:none!important}
  .mira-col.done .go,.mira-col.done .er{display:none}
  .mira-pick .sz.first{margin:0;padding-top:0;border-top:0}
  .mira-pick.qf .pk{margin-top:10px;padding-top:10px;border-top:1px solid #EEEDE8;justify-content:space-between}
  .mira-pick .ql{font-size:13.5px;color:#4A4E52}
  .mira-opt .pz small{display:block;font-weight:400;font-size:11.5px;color:#767A7E;margin-top:2px}
  .mira-opt.on .pz small{color:rgba(255,255,255,.75)}
  .mira-plan .zt{display:flex;align-items:center;gap:7px;margin-top:7px;font-size:13.5px}
  .mira-plan .zt label{flex:0 1 68px;min-width:40px;color:#5A5E62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mira-plan .mt{display:inline-flex;border:1px solid #D3D2CC;border-radius:8px;overflow:hidden}
  .mira-plan .mt button{border:0;background:#fff;padding:7px 13px;cursor:pointer;font:inherit;font-size:13.5px;color:#14171A}
  .mira-plan .mt button + button{border-left:1px solid #D3D2CC}
  .mira-plan .mt button.on{background:#14171A;color:#fff}
  .mira-plan .mt button:disabled{cursor:default}
  .mira-col.done .go,.mira-col.done .all{display:none}
  .mira-col.done .sw:not(.on){opacity:.35}
  .mira-dots{display:inline-flex;gap:5px;padding:5px 0}
  .mira-dots i{width:6px;height:6px;border-radius:50%;background:#B9B4A6;animation:mira-dot 1.1s infinite ease-in-out}
  .mira-dots i:nth-child(2){animation-delay:.15s}.mira-dots i:nth-child(3){animation-delay:.3s}
  @keyframes mira-dot{0%,80%,100%{transform:translateY(0);opacity:.45}40%{transform:translateY(-4px);opacity:1}}
  .mira-foot{flex:none;padding:6px max(18px,calc(50% - 380px)) 12px}
  .mira-chips{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 10px}
  .mira-chip{border:1px solid #D3D2CC;background:#fff;border-radius:999px;padding:7px 13px;cursor:pointer;font:inherit;font-size:13.5px;line-height:1.3;color:#33383C;text-align:left}
  .mira-chip:hover{border-color:#14171A}
  .mira-chip.act{border-color:#14171A;background:#14171A;color:#fff}
  .mira-form{display:flex;align-items:flex-end;gap:8px;border:1px solid #D3D2CC;border-radius:16px;padding:7px 7px 7px 16px;background:#fff}
  .mira-form:focus-within{border-color:#14171A}
  .mira-form textarea{flex:1;border:0;outline:0;resize:none;background:transparent;font:inherit;font-size:15.5px;line-height:1.45;padding:8px 0;max-height:120px;min-height:24px;color:#14171A}
  .mira-form button{flex:none;width:40px;height:40px;border-radius:12px;border:0;background:#14171A;color:#fff;cursor:pointer;display:grid;place-items:center}
  .mira-form button:hover{background:#8A6220}
  .mira-form button:disabled{background:#C9C7C1;cursor:default}
  .mira-footline{margin:9px 2px 0;font-size:12px;color:#8C8472;text-align:center}
  .mira-hand{flex:1 1 auto;overflow-y:auto;padding:20px 18px}
  .mira-hand h4{font-family:'Fraunces',serif;font-weight:560;font-size:22px;letter-spacing:-.01em;margin:0 0 8px}
  .mira-hand p{font-size:14.5px;line-height:1.55;color:#4A4E52;margin:0 0 16px}
  .mira-hand label{display:block;font-size:12.5px;color:#5A5E62;margin:0 0 5px}
  .mira-hand label[hidden]{display:none}
  .mira-hand input,.mira-hand textarea{width:100%;box-sizing:border-box;border:1px solid #D3D2CC;border-radius:10px;padding:11px 12px;font:inherit;font-size:15.5px;margin:0 0 12px;background:#fff;color:#14171A}
  .mira-hand input:focus,.mira-hand textarea:focus{outline:0;border-color:#14171A}
  .mira-hand textarea{min-height:110px;resize:vertical}
  .mira-hand .go{border:0;cursor:pointer;background:#14171A;color:#fff;border-radius:10px;padding:13px 18px;font:inherit;font-size:15px;width:100%}
  .mira-hand .go:hover{background:#8A6220}
  .mira-hand .back{border:0;background:transparent;cursor:pointer;font:inherit;font-size:14px;color:#8A6220;padding:0;margin:0 0 16px;text-decoration:underline;text-underline-offset:2px}
  .mira-hand .note{margin:14px 0 0;padding:11px 13px;border:1px dashed #DDD3BE;border-radius:10px;font-size:13px;color:#6E6652;background:#FAF5EA}
  .mira-hand .err{color:#8A2620;font-size:13px;margin:-4px 0 10px}
  .mira-hand a{color:#8A6220}
  .grphead.mira-flash{animation:mira-flash 1.8s ease}
  @keyframes mira-flash{0%,60%{background:#FCF4E6;box-shadow:inset 3px 0 0 #C79A45}100%{background:transparent;box-shadow:inset 0 0 0 transparent}}
  /* open, the helper is the whole screen: the page behind it does not scroll */
  body.mira-open{overflow:hidden}
  body.mira-open #langsw{display:none}
  /* the selection has its own column on wide screens; on narrow ones it is the bar under the header */
  @media(min-width:900px){ .mira-now{display:none} }
  @media(max-width:899px){ .mira-side{display:none} }
  /* phones */
  @media(max-width:700px){
    .mira-card{grid-template-columns:1fr;padding:18px 16px;margin-bottom:22px}
    .mira-card h3{font-size:21px}
    .mira-card button{width:100%;white-space:normal}
    .mira-launch{padding:11px 15px 11px 12px;font-size:10.5px}
    .mira-head{padding-left:14px}
    .mira-human{padding:8px 9px;font-size:12.5px}
    .mira-foot{padding-bottom:max(10px,env(safe-area-inset-bottom))}
    .mira-pick .pk{gap:6px}
    .mira-pick .rm{padding:8px 10px;font-size:13.5px}
    .mira-pick .qt button{width:26px}
    .mira-plan .z{gap:5px}
    .mira-plan .z label{flex-basis:62px}
    .mira-plan .z input{width:58px;padding:7px 6px}
    .mira-plan .z .pr{font-size:13px}
  }
  @media(prefers-reduced-motion:reduce){ .mira-panel,.mira-msg,body{transition:none!important;animation:none!important} }
`;

let panel, thread, chipsBox, input, sendBtn, nowBox, launch, card, foot, hand, sideBox;
const svg = (d, n) => '<svg width="' + (n || 20) + '" height="' + (n || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
function build(){
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  launch = document.createElement('button');
  launch.className = 'mira-launch'; launch.type = 'button'; launch.setAttribute('data-noi18n', '1');
  launch.innerHTML = '<i></i><span>' + esc(t('launch')) + '</span>';
  document.body.appendChild(launch);

  panel = document.createElement('aside');
  panel.className = 'mira-panel'; panel.setAttribute('data-noi18n', '1'); panel.setAttribute('aria-label', 'Mira');
  panel.innerHTML =
    '<div class="mira-head"><b>' + esc(t('title')) + '</b><span class="mira-ai">' + esc(t('ai')) + '</span>' +
      '<button class="mira-human" type="button">' + svg('<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M20 19a4 4 0 0 1-4 3h-3"/>', 17) + '<span>' + esc(t('human')) + '</span></button>' +
      '<button class="mira-x" type="button" aria-label="' + esc(t('close')) + '">&times;</button></div>' +
    '<div class="mira-body"><div class="mira-main"><div class="mira-now"></div>' +
    '<div class="mira-thread" aria-live="polite"></div>' +
    '<div class="mira-hand" hidden></div>' +
    '<div class="mira-foot"><div class="mira-chips"></div>' +
      '<form class="mira-form" autocomplete="off"><textarea rows="1" placeholder="' + esc(t('ph0')) + '" aria-label="' + esc(t('send')) + '"></textarea>' +
      '<button type="submit" aria-label="' + esc(t('send')) + '">' + svg('<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>', 17) + '</button></form>' +
      '<p class="mira-footline">' + esc(t('foot')) + '</p></div></div><div class="mira-side"></div></div>';
  document.body.appendChild(panel);
  thread = panel.querySelector('.mira-thread'); chipsBox = panel.querySelector('.mira-chips'); foot = panel.querySelector('.mira-foot');
  input = panel.querySelector('.mira-form textarea'); sendBtn = panel.querySelector('.mira-form button'); nowBox = panel.querySelector('.mira-now');
  hand = panel.querySelector('.mira-hand'); sideBox = panel.querySelector('.mira-side');

  /* the way in, right above the first step */
  const steps = document.getElementById('steps');
  if(steps){
    card = document.createElement('div');
    card.className = 'mira-card'; card.setAttribute('data-noi18n', '1');
    /* no text box here: one button that starts "help me choose" in the panel */
    const g = GUIDED(pagePid());
    card.innerHTML = '<div><h3>' + esc(t('cardT')) + '</h3><p>' + esc(t(g ? 'cardPG' : 'cardP')) + '</p></div>' +
      '<button type="button">' + esc(g ? S().startersG[0] : S().starters[0]) + '</button>';
    steps.parentNode.insertBefore(card, steps);
    card.querySelector('button').addEventListener('click', () => { openPanel(); if(g) startGuide(0); else send(S().starters[0]); });
  }

  launch.addEventListener('click', () => openPanel());
  panel.querySelector('.mira-x').addEventListener('click', () => closePanel());
  panel.querySelector('.mira-human').addEventListener('click', () => openHandoff());
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => { if(e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); panel.querySelector('.mira-form').requestSubmit(); } });
  panel.querySelector('.mira-form').addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; grow(); send(v); });
  chipsBox.addEventListener('click', (e) => {
    const c = e.target.closest('.mira-chip'); if(!c) return;
    if(c.dataset.act === 'account'){ SHOP.openAccount(); return; }
    if(c.dataset.act === 'guide'){ startGuide(+c.dataset.value); return; }
    if(c.dataset.act === 'copy'){
      const done = () => { c.textContent = t('copied'); };
      if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(c.dataset.value).then(done, done); else done();
      return;
    }
    if(c.dataset.act === 'share'){ try { navigator.share({ title: document.title, url: c.dataset.value }); } catch(x){} return; }
    if(c.dataset.go){
      try { sessionStorage.setItem('lumia_mira_q', c.dataset.carry || ''); } catch(x){}
      location.href = c.dataset.go; return;
    }
    send(c.textContent);
  });
  thread.addEventListener('click', (e) => {
    const s = e.target.closest('.mira-start'); if(s){ if(s.dataset.g != null) startGuide(+s.dataset.g); else send(s.textContent); return; }
    const pk = e.target.closest('.mira-pick');
    if(pk && !pk.classList.contains('done')){
      const rm = e.target.closest('.rm');
      if(rm){
        const row = rm.parentNode, on = rm.getAttribute('aria-pressed') !== 'true';
        rm.setAttribute('aria-pressed', String(on)); row.classList.toggle('on', on);
        row.querySelector('.nd').hidden = !on || pk.classList.contains('g'); row.querySelector('.qt').hidden = !on;
        pk.querySelector('.er').hidden = true;
        return;
      }
      const q = e.target.closest('.qt button');
      if(q){ const b = q.parentNode.querySelector('b'); b.textContent = Math.max(1, Math.min(20, (+b.textContent) + (+q.dataset.q))); return; }
      if(e.target.closest('.go')){ if(pk.classList.contains('qf')) submitQuote(pk); else submitPicker(pk); return; }
    }
    const tr = e.target.closest('.mira-tiers:not(.done) .mira-opt');
    if(tr){ if(!M.busy){ tr.classList.add('on'); pickTier(tr.dataset.tier); } return; }
    const op = e.target.closest('.mira-opts:not(.done) .mira-opt');
    if(op && M.project && !M.busy){ op.classList.add('on'); answerStep(M.project.setup.opts[+op.dataset.i]); return; }
    const col = e.target.closest('.mira-col:not(.done)');
    if(col && !M.busy){ colourTap(col, e); return; }
    const pl = e.target.closest('.mira-plan.live');
    if(pl && M.project && !M.project.added && !M.busy){
      const row = e.target.closest('.p'), room = row ? M.project.rooms[+row.dataset.i] : null;
      const q = e.target.closest('[data-pq]');
      if(q && room){
        const n = Math.max(1, Math.min(50, room.qty + (+q.dataset.pq)));
        while(room.sizes.length < n) room.sizes.push(room.sizes.length ? room.sizes[room.sizes.length - 1] : null);
        room.sizes.length = n; room.qty = n; if(n === 1) room.split = false;
        if(room.mounts){ while(room.mounts.length < n) room.mounts.push(room.mounts.length ? room.mounts[room.mounts.length - 1] : null); room.mounts.length = n; }
        redrawPlan(); return;
      }
      const mt = e.target.closest('[data-mt]');
      if(mt && room){                                        /* inside or outside, beside a size */
        const zt = mt.closest('.zt'), k = zt.dataset.k;
        if(!room.mounts) room.mounts = Array(room.qty).fill(null);
        if(k === 'all') room.mounts = room.mounts.map(() => mt.dataset.mt); else room.mounts[+k] = mt.dataset.mt;
        zt.querySelectorAll('[data-mt]').forEach(b => b.classList.toggle('on', b === mt));
        renderNow(); return;
      }
      if(e.target.closest('.sp') && room){
        room.split = !room.split;
        if(!room.split){ room.sizes = room.sizes.map(() => room.sizes[0]); if(room.mounts) room.mounts = room.mounts.map(() => room.mounts[0]); }       /* back to one size: the first window's */
        redrawPlan(); return;
      }
      if(e.target.closest('.rv') && room){ M.project.rooms.splice(+row.dataset.i, 1); redrawPlan(); if(!M.project) setChips(S().chips.size.slice()); return; }
      if(e.target.closest('.sizego')){
        const left = unsized(), L = S().setup;
        if(left){ addMsg('m', L.sizeMiss(left)); return; }
        if(unmounted()){ addMsg('m', L.mountMiss); return; }
        addMsg('y', L.sizesIn); M.history.push({ role: 'user', text: L.sizesIn });
        M.project.setup.at++; askStep(''); return;
      }
      if(e.target.closest('.next')){ beginSetup(); return; }
      if(e.target.closest('.addall')){ send(S().chips.project[0]); return; }
    }
    if(e.target.closest('.mira-pbox button')){ SHOP.openAccount(); return; }
    const u = e.target.closest('.mira-undo'); if(u && !u.disabled) undoLast(u);
  });
  /* a size typed into the list */
  thread.addEventListener('change', (e) => {
    const inp = e.target.closest('.mira-plan.live .zw, .mira-plan.live .zh');
    if(!inp || !M.project || M.project.added) return;
    const z = inp.closest('.z'), row = inp.closest('.p'), room = M.project.rooms[+row.dataset.i];
    const w = parseFloat(z.querySelector('.zw').value), h = parseFloat(z.querySelector('.zh').value);
    let sz = null; room.flash = '';
    if(w > 0 && h > 0){
      /* checked against what can be built; a size outside the range comes back corrected, with the reason */
      const o = core.applyPatch(M.cat, roomDesign(designOf(SHOP.snapshot()), room), { w, h });
      sz = { w: o.design.w, h: o.design.h };
      room.flash = o.notes.filter(n => n.code === 'size_clamped').map(n => B.noteText(M.lang, n)).join(' ');
    } else if(w > 0 || h > 0) return;                    /* the other half is still to come */
    if(z.dataset.k === 'all') room.sizes = room.sizes.map(() => (sz ? { w: sz.w, h: sz.h } : null));
    else room.sizes[+z.dataset.k] = sz;
    syncPlan(); renderNow();
  });
  nowBox.addEventListener('click', (e) => { if(e.target.closest('button')) SHOP.openAccount(); });
  hand.addEventListener('click', (e) => {
    if(e.target.closest('.back')){ closeHandoff(); return; }
    if(e.target.closest('.go')){
      const btn = e.target.closest('.go'), msg = hand.querySelector('.h-msg'), err = hand.querySelector('.err'), note = hand.querySelector('.note');
      if(btn.disabled) return;
      if(!msg.value.trim()){ err.textContent = t('hNeed'); err.hidden = false; return; }
      err.hidden = true; btn.disabled = true; btn.textContent = t('hSending');
      /* a conversation in the customer's account (Messages) and in the admin panel's Messages tab */
      const snap = SHOP.snapshot();
      Promise.resolve().then(() => SHOP.sendMessage('Mira chat — ' + (snap ? M.cat[snap.pid].name : 'question'), handoffText(msg.value)))
        .then(() => { note.textContent = t('hSent'); note.hidden = false; msg.value = ''; msg.hidden = true; btn.hidden = true; hand.querySelector('label').hidden = true; })
        .catch(() => { err.textContent = t('hFail'); err.hidden = false; })
        .then(() => { btn.disabled = false; btn.textContent = t('hSend'); });
    }
  });
  placeLaunch(); window.addEventListener('resize', placeLaunch);
}
/* the launcher sits just above the language switch (which sits above the price bar) */
function placeLaunch(){
  const ls = document.getElementById('langsw'), bar = document.getElementById('wizbar');
  let b = 14;
  if(bar && bar.offsetHeight) b = bar.offsetHeight + 14;
  if(ls && ls.offsetHeight) b = Math.max(b, window.innerHeight - ls.getBoundingClientRect().top + 10);
  launch.style.bottom = b + 'px';
}
function scrollDown(){ requestAnimationFrame(() => { thread.scrollTop = thread.scrollHeight; }); }
/* extras: {lead, rows, ok, price, priceBox} — a Mira message can carry the list of what she changed */
function addMsg(kind, text, extras){
  const el = document.createElement('div');
  el.className = 'mira-msg ' + kind;
  if(kind !== 'm'){ el.textContent = text; thread.appendChild(el); scrollDown(); return el; }
  const x = extras || {};
  let h = '<div class="who">Mira</div>';
  if(x.rows && x.rows.length){
    h += '<div class="txt">' + esc(S().changed(x.rows.length)) + '</div><div class="mira-chg">' +
      x.rows.map(r => '<div class="r"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('') +
      (x.price ? '<div class="r"><span>' + esc(t('row').price) + '</span><b>' + esc(x.price) + '</b></div>' : '') +
      '<div class="f"><span class="ok">' + esc(x.ok || '') + '</span><button class="mira-undo" type="button">' + esc(t('undo')) + '</button></div></div>';
  }
  if(x.priceBox) h += '<div class="mira-pbox"><span>' + esc(t('priceBox')) + '</span><button type="button">' + esc(t('priceBtn')) + '</button></div>';
  if(text) h += '<div class="txt">' + esc(text) + '</div>';
  if(x.plan) h += planHTML(x.plan);
  if(x.tail) h += '<div class="txt">' + esc(x.tail) + '</div>';
  if(x.picker) h += pickerHTML();
  if(x.opts) h += optsHTML(x.opts);
  if(x.colours) h += coloursHTML();
  if(x.tiers && x.tiers.length) h += tiersHTML(x.tiers);
  if(x.quoteForm) h += quoteFormHTML();
  el.innerHTML = h;
  /* only the newest change can be taken back */
  if(x.rows && x.rows.length) thread.querySelectorAll('.mira-undo').forEach(b => { b.disabled = true; });
  thread.appendChild(el); scrollDown();
  if(x.plan) fitPlan();
  return el;
}
function undoLast(btn){
  if(!M.undo || M.busy) return;
  const cur = designOf(SHOP.snapshot());
  M.sizeSaid = M.undo.sizeSaid;
  toShop(cur, M.undo.before);
  btn.disabled = true; btn.textContent = t('undone');
  const back = designOf(SHOP.snapshot());
  M.undo = null;
  addMsg('m', S().undone(cfgLabel(back)));
  M.history.push({ role: 'assistant', text: S().undone(cfgLabel(back)) });
  renderNow();
}
function typing(on){
  const old = thread.querySelector('.mira-typing'); if(old) old.remove();
  if(!on) return;
  const el = document.createElement('div');
  el.className = 'mira-msg m mira-typing';
  el.innerHTML = '<div class="who">Mira</div><div class="mira-dots"><i></i><i></i><i></i></div>';
  thread.appendChild(el); scrollDown();
}
function setChips(list){
  chipsBox.innerHTML = (list || []).map(c => typeof c === 'string'
    ? '<button class="mira-chip" type="button">' + esc(c) + '</button>'
    : '<button class="mira-chip act" type="button"' + (c.act ? ' data-act="' + esc(c.act) + '"' : '') + (c.value ? ' data-value="' + esc(c.value) + '"' : '') +
      (c.go ? ' data-go="' + esc(c.go) + '" data-carry="' + esc(c.carry || '') + '"' : '') + '>' + esc(c.label) + '</button>').join('');
}
/* what has been chosen so far, in the narrow column beside the chat: one entry per room — or the one shade on the page */
function renderSide(snap){
  if(!sideBox) return;
  const base = designOf(snap), P = M.project && !M.project.added ? M.project : null, U = t('row');
  const th = (d, ok) => { const sw = ok ? core.swatch(M.cat, d.product, d.collection, d.colour) : null;
    return '<span class="th"' + (sw && sw.hex && !sw.img ? ' style="background:' + sw.hex + '"' : '') + '>' + (sw && sw.img ? '<img src="' + esc(sw.img) + '" alt="">' : '') + '</span>'; };
  /* the options that were really chosen: a default is not shown as a choice */
  const opts = (d, noMount) => ['mount', 'fold', 'heading', 'panel', 'drive'].filter(k => !(k === 'mount' && noMount) && d[k] != null && (M.decided[k] || d[k] !== base[k])).map(k => tv(d[k]))
    .concat(d.tdbu === 'Yes' ? ['TDBU'] : []).concat(d.liner && d.liner !== 'Unlined' ? [tv(d.liner)] : []).concat(d.banding && d.banding !== 'None' ? [U.banding + colon() + tv(d.banding)] : []).join(' · ');
  const item = (thumb, title, lines, price) => '<div class="it">' + thumb + '<div class="tx"><b>' + esc(title) + '</b>' + lines.filter(Boolean).map(x => '<span>' + esc(x) + '</span>').join('') + '</div>' +
    (price ? '<span class="pr">' + esc(price) + '</span>' : '') + '</div>';
  let h = '<div class="hd">' + esc(t('sideT')) + '</div>';
  if(P){
    const pl = planCard();
    pl.rooms.forEach(r => {
      const room = P.rooms[r.i], rd = roomDesign(base, room), sizes = [];
      r.wins.forEach(w => {
        const s = [w.w !== '' ? core.fmtIn(w.w) + ' × ' + core.fmtIn(w.h) : '', pl.mounts && w.mount ? tv(w.mount) : ''].filter(Boolean).join(' · ');
        if(s && sizes.indexOf(s) === -1) sizes.push(s);
      });
      const sum = r.wins.length && r.wins.every(w => w.num != null) ? r.wins.reduce((n, w) => n + w.num, 0) : null;
      h += item(th(rd, room.colourChosen), r.name + ' × ' + r.qty,
        [roomFabric(room, rd)].concat(sizes.slice(0, 3)).concat(sizes.length > 3 ? ['+ ' + (sizes.length - 3)] : []).concat([opts(rd, pl.mounts)]),
        sum != null ? money(Math.round(sum * 100) / 100) : '');
    });
    if(pl.sum != null) h += '<div class="tot"><span>' + esc(t('sideTot')) + '</span><span>' + esc(money(pl.sum)) + '</span></div>';
  } else {
    const chosen = M.decided.colour !== false;
    h += item(th(base, chosen), prodName(snap.pid) + (snap.qty > 1 ? ' × ' + snap.qty : ''),
      [chosen ? fabricLabel(base) : roomFabric({ colourChosen: false }, base), sizeLabel(base) + (M.sizeSaid ? '' : ' (' + t('example') + ')'), opts(base, false)],
      snap.prices && snap.price != null ? money(snap.price * snap.qty) : '');
  }
  sideBox.innerHTML = h;
}
function renderNow(){
  if(!nowBox || !M.cat) return;
  const snap = SHOP.snapshot(); if(!snap) return;
  renderSide(snap);
  if(M.project && !M.project.added){
    const total = unsized() ? null : totalWith(null);
    nowBox.innerHTML = '<span class="tx"><b>' + esc(prodName(snap.pid)) + '</b>' + esc(S().setup.hdr(M.project.rooms.length, projectUnits())) + '</span>' +
      '<span class="pr">' + (total != null ? money(total) : '') + '</span>';
    return;
  }
  const d = designOf(snap), sw = core.swatch(M.cat, d.product, d.collection, d.colour);
  const thumb = sw.img ? '<img src="' + esc(sw.img) + '" alt="">' : '';
  const price = snap.prices && snap.price != null
    ? money(snap.price * snap.qty) + (snap.qty > 1 ? '<small>' + snap.qty + ' × ' + money(snap.price) + '</small>' : '')
    : '<button type="button">' + esc(t('priceBtn')) + '</button>';
  nowBox.innerHTML = '<span class="th"' + (sw.hex && !sw.img ? ' style="background:' + sw.hex + '"' : '') + '>' + thumb + '</span>' +
    '<span class="tx"><b>' + esc(M.decided.colour === false ? roomFabric({ colourChosen: false }, d) : fabricLabel(d)) + '</b>' + esc(sizeLabel(d)) +
      (M.sizeSaid ? '' : '<em>' + esc(t('example')) + '</em>') + ['mount', 'drive'].filter(k => d[k] && M.decided[k]).map(k => ' · ' + esc(tv(d[k]))).join('') + '</span>' +
    '<span class="pr">' + price + '</span>';
}
/* Mira is only for people with an account: without one there is no button,
   no card above the steps and no panel. The page calls back (SHOP.onchange)
   when someone signs up, logs in or is signed out, so this follows along. */
function allowed(){ return !SHOP.signedIn || SHOP.signedIn(); }
function gate(){
  const ok = allowed();
  if(launch) launch.hidden = !ok;
  if(card) card.hidden = !ok;
  if(!ok && M.open) closePanel();
  if(ok && launch) placeLaunch();
  return ok;
}
function openPanel(){
  if(M.open || !allowed()) return;
  M.open = true; document.body.classList.add('mira-open');
  renderNow();
  if(!M.greeted){
    M.greeted = true;
    const snap = SHOP.snapshot(), L = S(), g = GUIDED(pagePid());
    const hello = g ? L.helloG : L.hello(L.noun[snap ? snap.pid : 'roman']);
    addMsg('m', hello);
    M.history.push({ role: 'assistant', text: hello });
    /* the first screen offers three ways in, as plain buttons */
    const st = document.createElement('div'); st.className = 'mira-starts';
    st.innerHTML = (g ? L.startersG : L.starters).map((q, i) => '<button class="mira-start" type="button"' + (g ? ' data-g="' + i + '"' : '') + '>' + svg((g ? STARTER_ICON_G : STARTER_ICON)[i]) + '<span>' + esc(q) + '</span></button>').join('');
    thread.appendChild(st);
    if(g) input.placeholder = t('ph0G');
  }
  if(wide.matches) setTimeout(() => input.focus(), 350);
}
function closePanel(){ M.open = false; document.body.classList.remove('mira-open'); }

/* what the team receives with a "Talk to a person" message: the customer's own words first, then what is on the
   page and the end of the chat. Option names are written in English, as the admin panel reads them; the server
   keeps 2,000 characters. */
function handoffText(msg){
  const MAX = 1950, snap = SHOP.snapshot(), lang = M.lang;
  let out = String(msg).trim().slice(0, 900);
  const add = (line) => { if(out.length + line.length + 1 <= MAX){ out += '\n' + line; return true; } return false; };
  add(''); add('— Sent from Mira' + (snap ? ', ' + M.cat[snap.pid].name + ' page' : '') + (lang !== 'en' ? ' (' + lang.toUpperCase() + ')' : '') + ' —');
  M.lang = 'en';                                      /* labels below in English, whatever the customer reads */
  try {
    if(snap) add('On the page: ' + cfgLabel(designOf(snap)) + (M.sizeSaid ? '' : ' (size not given yet)'));
    const P = M.project && !M.project.added ? M.project : null;
    if(P) add('Room list: ' + P.rooms.map(r => r.label + ' × ' + r.qty).join(', '));
    if(snap && snap.cart.length) add('In the cart: ' + snap.cart.length + ' lines, ' + snap.cartUnits + ' units');
  } catch(e){} finally { M.lang = lang; }
  /* the end of the chat, newest kept first, shown oldest first */
  const lines = [];
  let room = MAX - out.length - 16;
  for(let i = M.history.length - 1; i >= 0 && lines.length < 10; i--){
    const h = M.history[i], line = (h.role === 'user' ? 'Customer: ' : 'Mira: ') + String(h.text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    if(line.length + 1 > room) break;
    room -= line.length + 1; lines.unshift(line);
  }
  if(lines.length){ add('Chat so far:'); lines.forEach(add); }
  return out;
}
/* "Talk to a person": a short form; the conversation goes with it */
function openHandoff(){
  openPanel();
  hand.innerHTML = '<button class="back" type="button">← ' + esc(t('hBack')) + '</button><h4>' + esc(t('hTitle')) + '</h4><p>' + esc(t('hText')) + '</p>' +
    '<label>' + esc(t('hMsg')) + '</label><textarea class="h-msg"></textarea>' +
    '<p class="err" hidden>' + esc(t('hNeed')) + '</p>' +
    '<button class="go" type="button">' + esc(t('hSend')) + '</button>' +
    '<p class="note" hidden></p>' +
    '<p style="margin:14px 0 0;font-size:13.5px"><a href="mailto:lumiashades@gmail.com">' + esc(t('hMail')) + '</a></p>';
  hand.hidden = false; thread.hidden = true; foot.hidden = true; nowBox.hidden = true;
  const f = hand.querySelector('input, textarea'); if(f && wide.matches) f.focus();
}
function closeHandoff(){ hand.hidden = true; thread.hidden = false; foot.hidden = false; nowBox.hidden = false; scrollDown(); }

async function send(text){
  text = String(text || '').trim();
  if(!text || M.busy || !M.ready) return;
  M.busy = true; sendBtn.disabled = true;
  openPanel(); if(!hand.hidden) closeHandoff();
  setChips([]);
  const starts = thread.querySelector('.mira-starts'); if(starts) starts.remove();     /* the starters belong to the first screen only */
  input.placeholder = t('ph');
  addMsg('y', text); M.history.push({ role: 'user', text });
  typing(true);
  const before = designOf(SHOP.snapshot()), sizeSaid0 = M.sizeSaid;
  let out = null;
  /* the room picker, its answer and a list of rooms in the making are handled here, never by the server */
  const local = M.fromPicker || !!parseRoomNeeds(text) || S().starters.indexOf(text) === 0 || !!(M.project && !M.project.added);
  if(M.ai && !local){
    try {
      const r = await askServer();
      if(r.refused) out = { reply: S().refused };
      else if(r.reply){ applyServer(r); out = { reply: r.reply }; }
    } catch(e){ out = null; }
  }
  if(!out){ out = mockReply(text); await wait(480 + Math.min(800, (out.reply || '').length * 3)); }
  typing(false);
  /* whatever changed on the page — by the sample replies or by the live advisor — is listed, with Undo */
  const snap = SHOP.snapshot(), after = designOf(snap), rows = diffRows(before, after);
  M.fromPicker = false;
  if(out.colourFor){
    if(!out.colourKeep) M.col = null;
    retireColourCards();
    if(out.colourSet && (snap.pid === 'roman' || snap.pid === 'drapery')) Object.assign(colState(), out.colourSet);
  }
  const extras = { priceBox: !!out.priceBox, tail: out.tail || '', picker: !!out.picker, colours: !!out.colourFor, tiers: out.tiers ? tierPrices((M.guide && M.guide.n) || 1) : null };
  /* sizes now, or the fabric first: two buttons under the new list */
  if(out.sizeAsk && M.project && !M.project.added){ lockCards(); M.project.setup.asking = true; extras.opts = M.project.setup.opts = sizeChoice(); }
  else if(M.project && M.project.setup.asking){ M.project.setup.asking = false; lockCards(); }       /* the talk moved on: that question is closed */
  if(out.plan && M.project && !M.project.added){
    /* one list is live at a time: an older one stays in the thread as a record */
    thread.querySelectorAll('.mira-plan.live').forEach(el => { el.classList.remove('live'); el.querySelectorAll('input, button').forEach(x => { x.disabled = true; }); });
    extras.plan = planCard();
  } else if(M.project && M.project.added) thread.querySelectorAll('.mira-plan.live').forEach(el => { el.classList.remove('live'); el.querySelectorAll('input, button').forEach(x => { x.disabled = true; }); });
  if(out.colourFor){
    /* the fabric row names the kind of fabric only — the colour is still open */
    const R = t('row'), c = core.collectionOf(M.cat, after.product, after.collection);
    rows.forEach(x => { if(x[0] === R.fabric || x[0] === R.cell) x[1] = tv(c ? c.label : after.collection) + ' · ' + S().setup.pick; });
  }
  if(rows.length && !(M.project && !M.project.added)){
    extras.rows = rows;
    extras.ok = after.drive ? S().fits(tv(after.drive)) : S().fitsD;
    if(snap.prices && snap.price != null) extras.price = money(snap.price) + ' ' + t('each');
    M.undo = { before, sizeSaid: sizeSaid0 };
  }
  addMsg('m', out.reply, extras);
  M.history.push({ role: 'assistant', text: (rows.length ? S().changed(rows.length) + ' ' + rows.map(r => r[0] + ': ' + r[1]).join('; ') + '. ' : '') + (out.reply || '') +
    (extras.plan ? ' ' + extras.plan.rooms.map(r => r.name + ' × ' + r.qty + ': ' + r.sub).join('; ') + '. ' + (extras.plan.note || '') : '') + (out.tail ? ' ' + out.tail : '') });
  setChips(out.chips || (M.sizeSaid ? S().chips.cfg : S().chips.size).slice());
  renderNow();
  M.busy = false; sendBtn.disabled = false;
  if(out.startSetup) setTimeout(beginSetup, 400);
  if(out.handoff) openHandoff(); else if(wide.matches) input.focus();
}

/* ════════ start ════════ */
(async function boot(){
  if(!SHOP || !SHOP.snapshot || !document.getElementById('steps')) return;      /* not a shop page */
  const json = (url) => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);
  /* the shop has already loaded its configuration (always fresh): use that copy rather than fetching it again */
  let cfg = null;
  for(let i = 0; i < 80 && !(cfg = SHOP.config && SHOP.config()); i++) await wait(125);
  if(!cfg) cfg = await json('assets/shop-config.json?v=' + Date.now());
  if(!cfg) return;
  /* the AI route exists only on the local preview server — the live site is never asked */
  const conf = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? await json('/api/design-chat/config') : null;
  M.cat = core.buildCatalog(JSON.parse(JSON.stringify(cfg)));
  M.ai = !!(conf && conf.ai);
  build();
  gate();
  /* the page tells us whenever the customer changes something themselves */
  SHOP.onchange = () => { if(!M.ready && SHOP.snapshot()) M.ready = true; gate(); if(M.open) renderNow(); };
  for(let i = 0; i < 80 && !SHOP.snapshot(); i++) await wait(125);
  M.ready = !!SHOP.snapshot();
  gate();
  placeLaunch();
  /* a message carried over from another product's page */
  let q = null;
  try { q = sessionStorage.getItem('lumia_mira_q'); sessionStorage.removeItem('lumia_mira_q'); } catch(e){}
  if(q && M.ready){ openPanel(); send(q); }
  window.LUMIA_MIRA = { state: M, send, open: openPanel, close: closePanel, handoff: openHandoff };   /* handy in the console */
})();
