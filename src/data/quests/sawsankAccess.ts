import { Quest } from "./index";

export const sawsankAccess: Quest = {
  id: "sawsank-access",
  slug: "sawsank-access",
  title: {
    pt: "Acesso a Sawsank",
    en: "Access to Sawsank",
    es: "Acceso a Sawsank",
    pl: "Dostęp do Sawsank",
  },
  description: {
    pt: "Descubra a prisão secreta de Carlin quebrando a Lei Seca e ajude a combater os undeads na ilha.",
    en: "Discover Carlin's secret prison by breaking the Dry Law and help fight the undead on the island.",
    es: "Descubre la prisión secreta de Carlin rompiendo la Ley Seca y ayuda a combatir a los no-muertos en la isla.",
    pl: "Odkryj sekretne więzienie Carlin, łamiąc Prawo Prohibicji i pomóż walczyć z nieumarłymi na wyspie.",
  },
  level: 0,
  premium: false,
  hidden: true,
  available: true,
  requirements: {
    items: [
      {
        pt: "20 gold para comprar 1 beer",
        en: "20 gold to buy 1 beer",
        es: "20 gold para comprar 1 beer",
        pl: "20 gold na zakup 1 beer",
      },
      {
        pt: "Itens/Suprimentos para matar alguns skeletons, ghouls e 1 Demon Skeleton",
        en: "Items/Supplies to kill some skeletons, ghouls and 1 Demon Skeleton",
        es: "Objetos/Suministros para matar algunos skeletons, ghouls y 1 Demon Skeleton",
        pl: "Przedmioty/Zaopatrzenie do zabicia kilku skeletonów, ghoulów i 1 Demon Skeletona",
      },
    ],
  },
  rewards: [
    {
      pt: "Acesso à ilha de Sawsank",
      en: "Access to Sawsank island",
      es: "Acceso a la isla de Sawsank",
      pl: "Dostęp do wyspy Sawsank",
    },
    {
      pt: "Autorização para viajar para Sawsank via pescador Bruno (100 gold)",
      en: "Authorization to travel to Sawsank via fisherman Bruno (100 gold)",
      es: "Autorización para viajar a Sawsank a través del pescador Bruno (100 gold)",
      pl: "Pozwolenie na podróż do Sawsank przez rybaka Bruno (100 gold)",
    },
  ],
  sections: [
    // Seção 1: Início da Quest
    {
      type: "text",
      title: {
        pt: "Início da Quest",
        en: "Quest Start",
        es: "Inicio de la Quest",
        pl: "Początek Questa",
      },
      content: {
        pt: "Uma espécie de Lei Seca foi estabelecida em Carlin. Quem desrespeitar e for visto por qualquer Bonecrusher bêbado será jogado na temida prisão de Sawsank. Para descobrir isso, vamos até uma Bonecrusher perguntar sobre Sawsank.",
        en: "A kind of Dry Law has been established in Carlin. Anyone who disrespects it and is seen by any Bonecrusher while drunk will be thrown into the dreaded Sawsank prison. To discover this, let's go to a Bonecrusher and ask about Sawsank.",
        es: "Una especie de Ley Seca ha sido establecida en Carlin. Quien la irrespete y sea visto por cualquier Bonecrusher borracho será arrojado a la temida prisión de Sawsank. Para descubrir esto, vamos a una Bonecrusher a preguntar sobre Sawsank.",
        pl: "W Carlin wprowadzono rodzaj Prawa Prohibicji. Każdy, kto je złamie i zostanie zauważony przez Bonecrushera będąc pijanym, zostanie wrzucony do przerażającego więzienia Sawsank. Aby to odkryć, idźmy do Bonecrushera i zapytajmy o Sawsank.",
      },
      images: ["/quests/sawsank/bonecrusher-sawsank.jpg"],
    },
    // Seção 2: Conversa com Bonecrusher
    {
      type: "dialogue",
      title: {
        pt: "Conversa com Bonecrusher",
        en: "Conversation with Bonecrusher",
        es: "Conversación con Bonecrusher",
        pl: "Rozmowa z Bonecrusher",
      },
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Bambi Bonecrusher", text: "LONG LIVE THE QUEEN!" },
        { speaker: "player", text: "sawsank" },
        {
          speaker: "Bambi Bonecrusher",
          text: "That's our main prison. We send our worst troublemakers there to rot in the cold Sawsank island.",
        },
        { speaker: "player", text: "troublemakers" },
        {
          speaker: "Bambi Bonecrusher",
          text: "The biggest troublemakers we have in this city right now are the members of the so-called 'rebellion'. But they are mostly a bunch of males who keep drinking in the sewers ...",
        },
        {
          speaker: "Bambi Bonecrusher",
          text: "As long as they stay in the sewers while doing their thing, it doesn't bother me much.",
        },
      ],
    },
    // Seção 3: Comprando a Beer
    {
      type: "text",
      title: {
        pt: "Comprando a Beer",
        en: "Buying the Beer",
        es: "Comprando la Beer",
        pl: "Kupowanie Piwa",
      },
      content: {
        pt: "Após essa conversa, vá até a taverna de Carlin que fica no subsolo da cidade e compre uma beer. A Taverna do Karl fica localizada {aqui}.",
        en: "After this conversation, go to Carlin's tavern which is in the basement of the city and buy a beer. Karl's Tavern is located {here}.",
        es: "Después de esta conversación, ve a la taberna de Carlin que está en el sótano de la ciudad y compra una beer. La Taberna de Karl está ubicada {aquí}.",
        pl: "Po tej rozmowie udaj się do tawerny Carlin, która znajduje się w podziemiach miasta, i kup piwo. Tawerna Karla znajduje się {tutaj}.",
      },
      images: ["/quests/sawsank/karl-tavern.jpg"],
      mapCoordinates: { x: 32318, y: 31799, z: 8, zoom: 2 },
    },
    // Seção 4: Provocando a Guarda
    {
      type: "text",
      title: {
        pt: "Provocando a Guarda",
        en: "Provoking the Guard",
        es: "Provocando a la Guardia",
        pl: "Prowokowanie Strażnika",
      },
      content: {
        pt: 'Após comprar sua cerveja, vá até qualquer Bonecrusher e converse com ela. Após falar "crime" e "beer", use a cerveja em você. Ela ficará indignada. Após isso, fale "sawsank" 2x e ela te mandará para a "cidade prisão" de Sawsank.',
        en: 'After buying your beer, go to any Bonecrusher and talk to her. After saying "crime" and "beer", use the beer on yourself. She will be outraged. After that, say "sawsank" 2x and she will send you to the "prison city" of Sawsank.',
        es: 'Después de comprar tu cerveza, ve a cualquier Bonecrusher y habla con ella. Después de decir "crime" y "beer", usa la cerveza en ti mismo. Ella se indignará. Después de eso, di "sawsank" 2 veces y ella te enviará a la "ciudad prisión" de Sawsank.',
        pl: 'Po zakupie piwa idź do dowolnego Bonecrushera i porozmawiaj z nią. Po powiedzeniu "crime" i "beer", użyj piwa na sobie. Ona będzie oburzona. Następnie powiedz "sawsank" 2 razy, a ona wyśle cię do "miasta więzienia" Sawsank.',
      },
    },
    // Seção 5: Diálogo de Provocação
    {
      type: "dialogue",
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Busty Bonecrusher", text: "LONG LIVE THE QUEEN!" },
        { speaker: "player", text: "crime" },
        { speaker: "player", text: "beer" },
        { speaker: "player", text: "Aah..." },
        {
          speaker: "Busty Bonecrusher",
          text: "Hey, you shouldn't be drinking alcohol in this city. It is against the law!",
        },
        { speaker: "player", text: "sawsank" },
        {
          speaker: "Busty Bonecrusher",
          text: "I'm warning you, this is your last chance... Drop the bottle SLOWLY, or you are going to spend some time in Sawsank prison!",
        },
        { speaker: "player", text: "sawsank" },
      ],
    },
    // Seção 6: Em Sawsank
    {
      type: "text",
      title: {
        pt: "Em Sawsank",
        en: "In Sawsank",
        es: "En Sawsank",
        pl: "W Sawsank",
      },
      content: {
        pt: "Lá em Sawsank desça um pouco e você achará a Lana Bonecrusher. Fale com ela e conte que existem undeads na cidade. Ela irá lhe pedir provas, vamos buscá-las.",
        en: "There in Sawsank, go down a bit and you will find Lana Bonecrusher. Talk to her and tell her that there are undead in the city. She will ask you for proof, let's go get it.",
        es: "Allí en Sawsank, baja un poco y encontrarás a Lana Bonecrusher. Habla con ella y cuéntale que hay no-muertos en la ciudad. Ella te pedirá pruebas, vamos a buscarlas.",
        pl: "Tam w Sawsank zejdź trochę w dół, a znajdziesz Lanę Bonecrusher. Porozmawiaj z nią i powiedz, że na wyspie są nieumarli. Poprosi cię o dowody, idźmy je zdobyć.",
      },
    },
    // Seção 7: Conversa com Lana
    {
      type: "dialogue",
      title: {
        pt: "Conversa com Lana",
        en: "Conversation with Lana",
        es: "Conversación con Lana",
        pl: "Rozmowa z Laną",
      },
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Lana Bonecrusher", text: "What do you want, Player?" },
        { speaker: "player", text: "undead" },
        { speaker: "Lana Bonecrusher", text: "Have you been listening to those drunkards? ..." },
        {
          speaker: "Lana Bonecrusher",
          text: "There have never been undeads on this island. Those men are probably hallucinating from the booze ...",
        },
        {
          speaker: "Lana Bonecrusher",
          text: "But on the other hand... If this happens to be true, it might be worth an investigation ...",
        },
        {
          speaker: "Lana Bonecrusher",
          text: "I'll tell you this: if you manage to find any compelling evidence of undead presence in this island, I'll personally bring you to Northport so you can warn our general about it ...",
        },
        { speaker: "Lana Bonecrusher", text: "Come back to me if you find any evidence of undead activity." },
      ],
    },
    // Seção 8: Explorando a Montanha
    {
      type: "text",
      title: {
        pt: "Explorando a Montanha",
        en: "Exploring the Mountain",
        es: "Explorando la Montaña",
        pl: "Eksplorowanie Góry",
      },
      content: {
        pt: "Caminhe até a montanha dominada por ghouls e skeletons a noroeste da ilha. Mate os skeletons e ghouls que encontrar pelo caminho.",
        en: "Walk to the mountain dominated by ghouls and skeletons to the northwest of the island. Kill the skeletons and ghouls you encounter along the way.",
        es: "Camina hasta la montaña dominada por ghouls y skeletons al noroeste de la isla. Mata a los skeletons y ghouls que encuentres en el camino.",
        pl: "Idź do góry zdominowanej przez ghoule i szkielety na północnym zachodzie wyspy. Zabij szkielety i ghoule, które napotkasz po drodze.",
      },
      images: ["/quests/sawsank/cave-entrance.png"],
    },
    // Seção 9: Descendo na Caverna
    {
      type: "text",
      title: {
        pt: "Descendo na Caverna",
        en: "Going Down the Cave",
        es: "Bajando a la Caverna",
        pl: "Schodzenie do Jaskini",
      },
      content: {
        pt: "Desça no buraco mostrado na imagem a seguir. Tome cuidado ao descer e não vá para a esquerda por enquanto.",
        en: "Go down the hole shown in the following image. Be careful when going down and don't go left for now.",
        es: "Baja por el agujero mostrado en la siguiente imagen. Ten cuidado al bajar y no vayas a la izquierda por ahora.",
        pl: "Zejdź przez dziurę pokazaną na następnym obrazku. Bądź ostrożny schodząc i na razie nie idź w lewo.",
      },
      images: ["/quests/sawsank/demon-skeleton.png"],
    },
    // Seção 10: Enfrentando o Demon Skeleton
    {
      type: "text",
      title: {
        pt: "Enfrentando o Demon Skeleton",
        en: "Facing the Demon Skeleton",
        es: "Enfrentando al Demon Skeleton",
        pl: "Walka z Demon Skeletonem",
      },
      content: {
        pt: "Após matar os ghouls e skeletons que encontrou logo na descida, vá com calma para a sua esquerda. 2 ghouls irão até você. Após eliminá-los, você enfrentará um Demon Skeleton.",
        en: "After killing the ghouls and skeletons you encountered right at the descent, slowly go to your left. 2 ghouls will come to you. After eliminating them, you will face a Demon Skeleton.",
        es: "Después de matar a los ghouls y skeletons que encontraste justo al bajar, ve con calma hacia tu izquierda. 2 ghouls irán hacia ti. Después de eliminarlos, enfrentarás un Demon Skeleton.",
        pl: "Po zabiciu ghoulów i szkieletów napotkanych zaraz po zejściu, powoli idź w lewo. 2 ghoule przyjdą do ciebie. Po ich wyeliminowaniu zmierzysz się z Demon Skeletonem.",
      },
      images: ["/quests/sawsank/coffin-bones.jpg"],
    },
    // Seção 11: Pegando a Pilha de Ossos
    {
      type: "text",
      title: {
        pt: "Pegando a Pilha de Ossos",
        en: "Getting the Pile of Bones",
        es: "Obteniendo la Pila de Huesos",
        pl: "Zbieranie Stosu Kości",
      },
      content: {
        pt: "Com o Demon Skeleton morto, clique na parte de cima do caixão que ele estava vigiando e você receberá uma pilha de ossos. OBS: Você precisa ter pelo menos 100 oz de cap.",
        en: "With the Demon Skeleton dead, click on the top of the coffin it was guarding and you will receive a pile of bones. NOTE: You need to have at least 100 oz of cap.",
        es: "Con el Demon Skeleton muerto, haz clic en la parte superior del ataúd que estaba vigilando y recibirás una pila de huesos. NOTA: Necesitas tener al menos 100 oz de cap.",
        pl: "Po zabiciu Demon Skeletona kliknij na górę trumny, której pilnował, a otrzymasz stos kości. UWAGA: Musisz mieć co najmniej 100 oz pojemności.",
      },
      images: ["/quests/sawsank/lana-freedom.jpg"],
    },
    // Seção 12: Parchment - Mensagem
    {
      type: "parchment",
      content: {
        pt: "You have found a pile of bones.",
        en: "You have found a pile of bones.",
        es: "You have found a pile of bones.",
        pl: "You have found a pile of bones.",
      },
    },
    // Seção 13: Entregando a Prova
    {
      type: "text",
      title: {
        pt: "Entregando a Prova",
        en: "Delivering the Evidence",
        es: "Entregando la Prueba",
        pl: "Dostarczanie Dowodu",
      },
      content: {
        pt: 'Entregue a pilha de ossos para Lana e ela lhe dará liberdade da prisão. Então fale "Northport", "yes", que ela te levará de volta para Northport.',
        en: 'Deliver the pile of bones to Lana and she will grant you freedom from prison. Then say "Northport", "yes", and she will take you back to Northport.',
        es: 'Entrega la pila de huesos a Lana y ella te dará libertad de la prisión. Luego di "Northport", "yes", y ella te llevará de vuelta a Northport.',
        pl: 'Dostarcz stos kości Lanie, a ona uwolni cię z więzienia. Następnie powiedz "Northport", "yes", a ona zabierze cię z powrotem do Northport.',
      },
    },
    // Seção 14: Diálogo de Liberdade com Lana
    {
      type: "dialogue",
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Lana Bonecrusher", text: "What do you want, Player?" },
        { speaker: "player", text: "undead" },
        { speaker: "Lana Bonecrusher", text: "Have you found any evidence of undead presence?" },
        { speaker: "player", text: "yes" },
        {
          speaker: "Lana Bonecrusher",
          text: "This is indeed worrisome! We have never seen anything like this in this island. We better take action before this becomes a new ghostland...",
        },
        {
          speaker: "Lana Bonecrusher",
          text: "I will set you free, prisoner. The integrity of Carlin's territories is more important to me than your crimes...",
        },
        { speaker: "Lana Bonecrusher", text: "Just ask me and I will bring you to Northport." },
      ],
    },
    // Seção 15: Reportando à General
    {
      type: "text",
      title: {
        pt: "Reportando para a General da Guarda",
        en: "Reporting to the Guard General",
        es: "Reportando a la General de la Guardia",
        pl: "Raportowanie do Generał Straży",
      },
      content: {
        pt: "Agora iremos reportar tudo para a General da guarda: Bunny Bonecrusher. Ela fica no andar de cima da Queen em Carlin {aqui}.",
        en: "Now we will report everything to the Guard General: Bunny Bonecrusher. She is on the upper floor of the Queen in Carlin {here}.",
        es: "Ahora reportaremos todo a la General de la guardia: Bunny Bonecrusher. Ella está en el piso de arriba de la Queen en Carlin {aquí}.",
        pl: "Teraz zaraportujemy wszystko Generał Straży: Bunny Bonecrusher. Znajduje się na górnym piętrze Queen w Carlin {tutaj}.",
      },
      images: ["/quests/sawsank/bunny-general.jpg"],
      mapCoordinates: { x: 32318, y: 31748, z: 6, zoom: 2 },
    },
    // Seção 16: Diálogo com Bunny
    {
      type: "dialogue",
      title: {
        pt: "Conversa com Bunny Bonecrusher",
        en: "Conversation with Bunny Bonecrusher",
        es: "Conversación con Bunny Bonecrusher",
        pl: "Rozmowa z Bunny Bonecrusher",
      },
      dialogue: [
        { speaker: "player", text: "hail general" },
        { speaker: "Bunny Bonecrusher", text: "Salutations, commoner Player!" },
        { speaker: "player", text: "undead" },
        {
          speaker: "Bunny Bonecrusher",
          text: "If Lana's judgement was to set you free so you can warn me about the undead activity in the island, I assume it is indeed a serious concern ...",
        },
        {
          speaker: "Bunny Bonecrusher",
          text: "Let's not waste time. Go talk to our druid Padrea and see if she knows what might be behind the undead sightings in Sawsank. ...",
        },
        { speaker: "Bunny Bonecrusher", text: "Also, from now on, I authorise you to sail to Sawsank at will. ..." },
        {
          speaker: "Bunny Bonecrusher",
          text: "I count on you to help maintaining the undead population under control. ...",
        },
        {
          speaker: "Bunny Bonecrusher",
          text: "I will send a messenger to the fisherman Bruno in Northport. From now on, he shall bring you there if requested.",
        },
      ],
    },
    // Seção 17: Acesso Liberado
    {
      type: "text",
      title: {
        pt: "Acesso Liberado",
        en: "Access Unlocked",
        es: "Acceso Liberado",
        pl: "Dostęp Odblokowany",
      },
      content: {
        pt: 'Após isso, seu acesso para a ilha de Sawsank está liberado. Basta ir até o Pescador Bruno em Northport e falar "passage" que pelo preço de 100 golds ele te leva a Sawsank.',
        en: 'After that, your access to Sawsank island is unlocked. Just go to Fisherman Bruno in Northport and say "passage" and for the price of 100 gold he will take you to Sawsank.',
        es: 'Después de eso, tu acceso a la isla de Sawsank está liberado. Solo ve al Pescador Bruno en Northport y di "passage" y por el precio de 100 gold él te llevará a Sawsank.',
        pl: 'Po tym twój dostęp do wyspy Sawsank jest odblokowany. Wystarczy udać się do Rybaka Bruno w Northport i powiedzieć "passage", a za cenę 100 gold zabierze cię do Sawsank.',
      },
    },
    // Seção 18: Créditos
    {
      type: "credits",
      content: {
        pt: "Spoiler cedido pelo jogador Ondeth Waters.",
        en: "Spoiler provided by player Ondeth Waters.",
        es: "Spoiler proporcionado por el jugador Ondeth Waters.",
        pl: "Spoiler dostarczony przez gracza Ondeth Waters.",
      },
      images: ["/quests/sawsank/credits-celebration.jpg"],
    },
  ],
};
