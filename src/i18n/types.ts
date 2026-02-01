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
    calculate: string;
    results: string;
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
  pages: {
    spells: {
      title: string;
      description: string;
      spellCount: string;
      vocationNotFound: string;
      backTo: string;
      doesNotExist: string;
      descriptions: {
        sorcerer: string;
        druid: string;
        paladin: string;
        knight: string;
      };
    };
    items: {
      title: string;
      description: string;
      itemCount: string;
      categoryNotFound: string;
      backTo: string;
      doesNotExist: string;
    };
    equipment: {
      title: string;
      description: string;
      itemCount: string;
      categoryNotFound: string;
      backTo: string;
      doesNotExist: string;
    };
    creatures: {
      title: string;
      description: string;
    };
    calculatorsPage: {
      title: string;
      description: string;
      cards: {
        healDamage: { title: string; description: string };
        physicalDamage: { title: string; description: string };
        deathExperience: { title: string; description: string };
        experienceLevel: { title: string; description: string };
        magicLevel: { title: string; description: string };
        loot: { title: string; description: string };
        skills: { title: string; description: string };
        stats: { title: string; description: string };
      };
    };
    highscores: {
      title: string;
      category: string;
      errorLoading: string;
      noPlayers: string;
      lastUpdated: string;
    };
    online: {
      title: string;
      playerCount: string;
      noPlayers: string;
      autoUpdate: string;
    };
    banned: {
      title: string;
      description: string;
      banCount: string;
      noBans: string;
      freeOfCheaters: string;
      date: string;
      character: string;
      reason: string;
    };
    topGainers: {
      title: string;
      description: string;
      period: string;
      xpRanking: string;
      xpGained: string;
      xpTotal: string;
      new: string;
      noVocation: string;
      noData: string;
      dataCollected: string;
      errorLoading: string;
    };
  };
  tables: {
    searchSpell: string;
    searchItem: string;
    searchEquipment: string;
    searchCreature: string;
    showing: string;
    showingSpells: string;
    showingItems: string;
    showingCreatures: string;
    clickForDetails: string;
    columns: {
      img: string;
      name: string;
      words: string;
      magicLevel: string;
      mana: string;
      price: string;
      type: string;
      weight: string;
      duration: string;
      slots: string;
      city: string;
      protection: string;
      effect: string;
      attributes: string;
      charges: string;
      armor: string;
      attack: string;
      defense: string;
      exp: string;
      hp: string;
      summon: string;
      convince: string;
      description: string;
    };
    spellTypes: {
      attack: string;
      healing: string;
      support: string;
      summon: string;
      other: string;
    };
    itemValues: {
      permanent: string;
    };
  };
  calculatorPages: {
    healDamage: {
      title: string;
      description: string;
      level: string;
      magicLevel: string;
      baseMin: string;
      baseMax: string;
      min: string;
      max: string;
      avg: string;
      healingSpells: string;
      healingRunes: string;
      attackRunes: string;
      attackSpells: string;
    };
    physicalDamage: {
      title: string;
      description: string;
      chooseVocation: string;
      skill: string;
      ammo: string;
      weaponAttack: string;
      result: string;
      maxDamageInfo: string;
      vsPve: string;
      vsPvp: string;
      atkWeapon: string;
    };
    deathExperience: {
      title: string;
      description: string;
      currentExperience: string;
      enterExperience: string;
      promotionAndBlessings: string;
      markBlessings: string;
      totalRetention: string;
      loss: string;
      beforeDeath: string;
      afterDeath: string;
      totalLoss: string;
      ofLevel: string;
      levelLossWarning: string;
    };
    experienceLevel: {
      title: string;
      description: string;
      currentExperience: string;
      desiredLevel: string;
      yourStatus: string;
      goal: string;
      progressToLevel: string;
      congratulations: string;
      alreadyReached: string;
      neededExperience: string;
      missing: string;
      toReachLevel: string;
      monstersNeeded: string;
      canReachBy: string;
      monsters: string;
      xpEach: string;
      suggestionsNote: string;
    };
    magicLevel: {
      title: string;
      description: string;
      chooseVocation: string;
      hasPromotion: string;
      currentML: string;
      percentageToNext: string;
      desiredML: string;
      manaNeeded: string;
      trainingTime: string;
      withPromotion: string;
      withoutPromotion: string;
      spellsOf: string;
      spells: string;
      costEach: string;
      fishesNeeded: string;
      fishesDescription: string;
      manaFluids: string;
      totalCost: string;
      summary: string;
      toReach: string;
      willTake: string;
    };
    skills: {
      title: string;
      description: string;
      chooseVocation: string;
      selectSkills: string;
      melee: string;
      distance: string;
      shield: string;
      currentSkill: string;
      desiredSkill: string;
      resultsFor: string;
      estimatedTime: string;
      toAdvanceFrom: string;
      to: string;
      selectAtLeastOne: string;
      selectVocation: string;
      fillFieldsCorrectly: string;
      valuesLessThan10: string;
      desiredMustBeGreater: string;
    };
    stats: {
      title: string;
      description: string;
      chooseVocation: string;
      characterLevel: string;
      enterLevel: string;
      hp: string;
      mp: string;
      cap: string;
      totalLife: string;
      totalMana: string;
      carryWeight: string;
      summaryText: string;
      atLevel: string;
      hasStats: string;
    };
    loot: {
      title: string;
      description: string;
      item: string;
      price: string;
      qty: string;
      selectItem: string;
      addItem: string;
      clearAll: string;
      total: string;
      summary: string;
    };
  };
}
