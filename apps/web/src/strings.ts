/**
 * Every visible string. Nothing is written inline in JSX.
 *
 * English is the default; `VITE_LANG=pt-BR` switches the whole interface. The
 * two translations sit side by side on purpose — this is a room for a handful
 * of friends, and a real i18n library would be more machinery than the copy it
 * carries. Adding a language means adding one more object down there.
 */

const en = {
  appName: "Drive-In & Popcorn",

  /* Site root: nobody arrives here by invitation, only by typing the domain. */
  landing: {
    heading: "Private session",
    body: "This address on its own opens nothing. Every session has a link of its own, and that link is the door — ask whoever opened the room for yours.",
  },

  /*
    The heading is a label, not a sentence: it goes uppercase on the sign. Each
    notice says what happened in one sentence and what to do in the next — it
    used to list possible causes and leave the diagnosis to whoever was reading.
  */
  notice: {
    loading: "Opening the room…",
    joining: "Coming in…",
    /** Wrong shape: we can say so without asking the server. */
    brokenHeading: "Incomplete link",
    brokenBody:
      "Part of the address is missing. Copy the whole link and open it again — they tend to break on the way through a messaging app.",
    /**
     * Right shape, server found nothing. It does not name which of the two
     * causes it was: saying that would confirm the token once existed.
     */
    goneHeading: "Room not found",
    goneBody:
      "This link does not open a room. Either the address has a wrong character, or the session is already over — they last a few hours. Ask for a new link.",
    failHeading: "Could not get in",
    /** Fallbacks for when the server sends no message of its own. */
    sessionEnded: "the session has ended",
    roomUnavailable: "room unavailable",
    couldNotEnter: "could not get in",
    couldNotProject: "could not turn the projector on",
  },

  joinRoom: {
    /** Sign heading: without it the form does not say where it leads. */
    heading: "Enter the room",
    nameLabel: "Your name",
    paintLabel: "Your car",
    enter: "Come in",
    locked: {
      title: "Room locked",
      body: "The session has started and the room stopped taking people. Ask for a new link.",
    },
    full: {
      title: "Room full",
      body: "All six spots are taken. As soon as somebody leaves you can get in — try again in a moment.",
    },
  },

  dj: {
    /** Label of the button that turns the mode on, inside the dashboard. */
    enter: "DJ mode",
    title: "DJ MODE",
    appMusic: "MUSIC",
    appRoom: "ROOM",
    leave: "Leave DJ mode",
    queueCount: (n: number) => (n === 1 ? "1 queued" : `${n} queued`),
    nowPlaying: "NOW PLAYING",
    queue: "QUEUE",
    queueEmpty: "The queue is empty. Paste a YouTube link to start it.",
    addPlaceholder: "Paste a YouTube link",
    add: "Add",
    addedBy: (name: string) => `by ${name}`,
    /** The browser only releases sound after a gesture from whoever is listening. */
    tapToPlay: "Play",
    tapToPlayHint: "Your browser only releases sound after a click.",
    silent: "Nothing playing",
    /** Resting state of the display, with no track loaded. */
    idle: "Standing by",
    volume: "Music volume",
    remove: "Remove from queue",
    clear: "Clear the queue",
    previous: "Previous track",
    next: "Next track",
    pause: "Pause",
    resume: "Resume",
  },

  lot: {
    /** Dashboard heading: it lists who is in the room. */
    inRoom: "IN THE ROOM",
    upNext: "UP NEXT",
    idle: "Nobody turned the projector on",
    noFeature: "Nothing on the marquee yet",
    take: "Turn the projector on",
    release: "Turn the projector off",
    emptyBay: "Empty spot",
    latency: (ms: number) => `${ms} ms`,
    occupancy: (taken: number, total: number) => `${taken} of ${total} spots taken`,
    /** Computed on every render: a session crossing midnight corrects itself. */
    session: () => {
      const texto = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date());
      return texto.charAt(0).toUpperCase() + texto.slice(1);
    },
  },

  feature: {
    placeholder: "What film, show or anime is playing?",
    year: "Year",
    save: "Put it on the screen",
    clear: "Take it off the screen",
    open: "Choose what is playing",
    add: "Choose what is playing",
  },

  onAir: {
    badge: (name: string) => (name ? `${name} is on air` : "Somebody is on air"),
    you: "You are on air",
  },

  fullscreen: {
    silentOthers: (n: number) =>
      n === 1 ? "and 1 more with the window rolled up" : `and ${n} more with the windows rolled up`,
  },

  controls: {
    title: "CONTROLS",
    aloneInRoom: "Nobody else in the room.",
    mic: "Microphone",
    micOff: "Microphone muted",
    volume: "Volume",
    musicVolume: "Music",
    movieVolume: "Movie",
    voiceVolume: "Voices",
    muted: "Muted",
    enterFullscreen: "Fullscreen",
    exitFullscreen: "Leave fullscreen",
    leave: "Leave the room",
  },

  you: "you",
};

/** Typed against `en`, so a forgotten key fails the typecheck instead of the room. */
const ptBR: typeof en = {
  appName: "Drive-In & Popcorn",

  landing: {
    heading: "Sessão privada",
    body: "Este endereço sozinho não abre nada. Cada sessão tem seu próprio link, e é ele que dá entrada — peça o seu a quem abriu a sala.",
  },

  notice: {
    loading: "Abrindo a sala…",
    joining: "Entrando…",
    brokenHeading: "Link incompleto",
    brokenBody:
      "Falta um pedaço do endereço. Copie o link inteiro e abra de novo — ele costuma quebrar ao passar por aplicativo de mensagem.",
    goneHeading: "Sala não encontrada",
    goneBody:
      "Este link não abre nenhuma sala. Ou o endereço tem um caractere errado, ou a sessão já terminou — elas duram algumas horas. Peça um link novo.",
    failHeading: "Não foi possível entrar",
    sessionEnded: "a sessão foi encerrada",
    roomUnavailable: "sala indisponível",
    couldNotEnter: "não deu para entrar",
    couldNotProject: "não deu para ligar o projetor",
  },

  joinRoom: {
    heading: "Entrar na sala",
    nameLabel: "Seu nome",
    paintLabel: "Seu carro",
    enter: "Entrar",
    locked: {
      title: "Sala trancada",
      body: "A sessão já começou e a sala parou de aceitar gente. Peça um link novo.",
    },
    full: {
      title: "Sala cheia",
      body: "As seis vagas estão ocupadas. Assim que alguém sair, você consegue entrar — tente de novo daqui a pouco.",
    },
  },

  dj: {
    enter: "Modo DJ",
    title: "MODO DJ",
    appMusic: "MÚSICA",
    appRoom: "SALA",
    leave: "Sair do modo DJ",
    queueCount: (n: number) => (n === 1 ? "1 na fila" : `${n} na fila`),
    nowPlaying: "TOCANDO AGORA",
    queue: "FILA",
    queueEmpty: "A fila está vazia. Cole um link do YouTube para começar.",
    addPlaceholder: "Cole um link do YouTube",
    add: "Adicionar",
    addedBy: (nome: string) => `por ${nome}`,
    tapToPlay: "Tocar",
    tapToPlayHint: "Seu navegador só libera o som depois de um clique.",
    silent: "Nada tocando",
    idle: "Em espera",
    volume: "Volume da música",
    remove: "Tirar da fila",
    clear: "Limpar a fila",
    previous: "Faixa anterior",
    next: "Próxima faixa",
    pause: "Pausar",
    resume: "Retomar",
  },

  lot: {
    inRoom: "NA SALA",
    upNext: "A SEGUIR",
    idle: "Ninguém ligou o projetor",
    noFeature: "Nada no cartaz ainda",
    take: "Ligar o projetor",
    release: "Desligar o projetor",
    emptyBay: "Vaga livre",
    latency: (ms: number) => `${ms} ms`,
    occupancy: (taken: number, total: number) => `${taken} de ${total} vagas ocupadas`,
    session: () => {
      const texto = new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date());
      return texto.charAt(0).toUpperCase() + texto.slice(1);
    },
  },

  feature: {
    placeholder: "Que filme, série ou anime vai passar?",
    year: "Ano",
    save: "Colocar no telão",
    clear: "Tirar da tela",
    open: "Escolher o que vai passar",
    add: "Escolher o que vai passar",
  },

  onAir: {
    badge: (name: string) => (name ? `${name} está no ar` : "Alguém está no ar"),
    you: "Você está no ar",
  },

  fullscreen: {
    silentOthers: (n: number) =>
      n === 1 ? "e mais 1 com o vidro fechado" : `e mais ${n} com o vidro fechado`,
  },

  controls: {
    title: "CONTROLES",
    aloneInRoom: "Ninguém mais na sala.",
    mic: "Microfone",
    micOff: "Microfone mudo",
    volume: "Volume",
    musicVolume: "Música",
    movieVolume: "Filme",
    voiceVolume: "Vozes",
    muted: "Sem som",
    enterFullscreen: "Tela cheia",
    exitFullscreen: "Sair da tela cheia",
    leave: "Sair da sala",
  },

  you: "você",
};

export const ui = import.meta.env.VITE_LANG === "pt-BR" ? ptBR : en;
