export type Language = 'pt' | 'en' | 'es' | 'pl';

export interface TranslationKeys {
  navigation: {
    home: string;
    equipment: string;
    items: string;
    spells: string;
    creatures: string;
    quests: string;
    calculators: string;
    info: string;
    ranking: string;
    online: string;
    banned: string;
    topGainers: string;
    map: string;
    officialSite: string;
  };
  sidebar: {
    navigation: string;
    quickLinks: string;
    serverStatus: string;
    topPlayers: string;
    updates: string;
    viewFullRanking: string;
    noPlayersFound: string;
    status: string;
    online: string;
    offline: string;
    players: string;
    record: string;
    nextSS: string;
    in: string;
    bannedCount: string;
  };
  equipment: {
    helmets: string;
    armors: string;
    legs: string;
    boots: string;
    shields: string;
    swords: string;
    axes: string;
    clubs: string;
    distance: string;
    ammo: string;
  };
  items: {
    amulets: string;
    rings: string;
    backpacks: string;
    foods: string;
    valuables: string;
  };
  spells: {
    sorcerer: string;
    druid: string;
    paladin: string;
    knight: string;
  };
  calculators: {
    healDamage: string;
    physicalDamage: string;
    deathExperience: string;
    experienceLevel: string;
    magicLevel: string;
    skills: string;
    stats: string;
    loot: string;
  };
  common: {
    search: string;
    loading: string;
    error: string;
    notFound: string;
    back: string;
    name: string;
    level: string;
    vocation: string;
    experience: string;
    close: string;
    select: string;
    filter: string;
    all: string;
    yes: string;
    no: string;
    premium: string;
  };
  home: {
    welcome: string;
    welcomeTitle: string;
    welcomeDescription: string;
    createAccount: string;
    downloadClient: string;
    latestNews: string;
    serverInfo: string;
  };
  serverInfo: {
    title: string;
    rates: string;
    experience: string;
    magic: string;
    skills: string;
    loot: string;
    skullSystem: string;
    pzTime: string;
    pzTimeValue: string;
    whiteSkull: string;
    redSkull: string;
    fragsBan: string;
    kills: string;
    hours: string;
    days: string;
    upTo: string;
    from: string;
    banDescription: string;
    general: string;
    updatesComingSoon: string;
    visitOfficialSite: string;
    accessOfficialSite: string;
  };
  news: {
    wikiConstructionTitle: string;
    wikiConstructionContent: string;
    wikiConstructionContent2: string;
    tibiaRelicServerTitle: string;
    tibiaRelicServerContent: string;
  };
  footer: {
    developedBy: string;
    fanPage: string;
    trademark: string;
  };
  breadcrumb: {
    home: string;
  };
  theme: {
    light: string;
    dark: string;
  };
  language: {
    select: string;
    portuguese: string;
    english: string;
    spanish: string;
    polish: string;
  };
  quests: {
    title: string;
    pageDescription: string;
    requirements: string;
    startLocation: string;
    conversation: string;
    nextStep: string;
    rewards: string;
    player: string;
    clickToEnlarge: string;
    backToList: string;
    recommended: string;
    premium: string;
    available: string;
    comingSoon: string;
    underConstruction: string;
    communityHelp: string;
    contactUs: string;
  };
}
