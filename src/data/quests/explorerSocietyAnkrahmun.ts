import { Quest } from "./index";

export const explorerSocietyAnkrahmun: Quest = {
  id: "explorer-society-ankrahmun",
  slug: "explorer-society-ankrahmun",
  title: {
    pt: "Explorer Society / Acesso a Ankrahmun",
    en: "Explorer Society / Access to Ankrahmun",
    es: "Explorer Society / Acceso a Ankrahmun",
    pl: "Explorer Society / Dostęp do Ankrahmun",
  },
  description: {
    pt: "Ajude a Explorer Society e ganhe acesso à cidade de Ankrahmun.",
    en: "Help the Explorer Society and gain access to the city of Ankrahmun.",
    es: "Ayuda a la Explorer Society y obtén acceso a la ciudad de Ankrahmun.",
    pl: "Pomóż Explorer Society i uzyskaj dostęp do miasta Ankrahmun.",
  },
  level: 0,
  premium: true,
  
  available: true,
  requirements: {
    items: [
      {
        pt: "1 Pick",
        en: "1 Pick",
        es: "1 Pick",
        pl: "1 Pick",
      },
      {
        pt: "Itens/Suprimentos para matar alguns beholders",
        en: "Items/Supplies to kill some beholders",
        es: "Objetos/Suministros para matar algunos beholders",
        pl: "Przedmioty/Zaopatrzenie do zabicia kilku beholderów",
      },
    ],
  },
  rewards: [
    {
      pt: "Acesso a Ankrahmun",
      en: "Access to Ankrahmun",
      es: "Acceso a Ankrahmun",
      pl: "Dostęp do Ankrahmun",
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
        pt: "Tudo começa com o NPC Mortimer, o representante da Explorer Society que fica localizado {aqui}.",
        en: "Everything starts with NPC Mortimer, the Explorer Society representative located {here}.",
        es: "Todo comienza con el NPC Mortimer, el representante de la Explorer Society ubicado {aquí}.",
        pl: "Wszystko zaczyna się od NPC Mortimer, przedstawiciela Explorer Society, który znajduje się {tutaj}.",
      },
      mapCoordinates: { x: 32500, y: 31626, z: 7, zoom: 3 },
      images: ["/quests/explorer-society/mortimer-location.jpg"],
    },
    // Seção 2: Primeira Conversa com Mortimer
    {
      type: "dialogue",
      title: {
        pt: "Conversa com Mortimer",
        en: "Conversation with Mortimer",
        es: "Conversación con Mortimer",
        pl: "Rozmowa z Mortimer",
      },
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Mortimer", text: "Greetings, what can I do for you?" },
        { speaker: "player", text: "priorities" },
        {
          speaker: "Mortimer",
          text: "Our members are constantly exposed to many dangers and we are currently struggling to provide proper equipment to our explorers. We might need some external help to keep our operations running.",
        },
        { speaker: "player", text: "help" },
        {
          speaker: "Mortimer",
          text: "Do you want to help the explorer society on acquiring some essential equipment?",
        },
        { speaker: "player", text: "yes" },
        {
          speaker: "Mortimer",
          text: "Your help is much appreciated. Considering you seem eager to assist our society, I will ask you to do a few things for us...",
        },
        {
          speaker: "Mortimer",
          text: "Since our explorers are constantly venturing inside deep and dangerous caves around the world, it is not uncommon for them to run into strong creatures such as dragons...",
        },
        {
          speaker: "Mortimer",
          text: "It is said that there is some kind of amulet called 'dragon necklace' that can protect one from their deadly firebreath...",
        },
        {
          speaker: "Mortimer",
          text: "For your first mission, I want you to bring me one of these necklaces, so our members can conduct their future explorations in a safer manner...",
        },
        { speaker: "Mortimer", text: "Simple enough? Are you interested in this task?" },
        { speaker: "player", text: "yes" },
        { speaker: "Mortimer", text: "Good! Find a dragon necklace and bring it to me." },
        { speaker: "player", text: "bye" },
        { speaker: "Mortimer", text: "Good bye." },
      ],
    },
    // Seção 3: Dragon Necklace Quest
    {
      type: "text",
      title: {
        pt: "Conseguindo o Dragon Necklace",
        en: "Getting the Dragon Necklace",
        es: "Obteniendo el Dragon Necklace",
        pl: "Zdobywanie Dragon Necklace",
      },
      content: {
        pt: "Agora é hora de conseguir um Dragon Necklace para o Mortimer. A melhor maneira de fazer isso é concluindo a quest do Dragon Necklace em Thais.",
        en: "Now it's time to get a Dragon Necklace for Mortimer. The best way to do this is by completing the Dragon Necklace quest in Thais.",
        es: "Ahora es hora de conseguir un Dragon Necklace para Mortimer. La mejor manera de hacerlo es completando la quest del Dragon Necklace en Thais.",
        pl: "Teraz czas zdobyć Dragon Necklace dla Mortimera. Najlepszym sposobem jest ukończenie questa Dragon Necklace w Thais.",
      },
      images: [
        "/quests/explorer-society/dragon-necklace-1.jpg",
        "/quests/explorer-society/dragon-necklace-2.jpg",
        "/quests/explorer-society/dragon-necklace-3.jpg",
        "/quests/explorer-society/dragon-necklace-4.jpg",
      ],
    },
    // Seção 4: Entregando o Dragon Necklace
    {
      type: "text",
      title: {
        pt: "Entregando o Dragon Necklace",
        en: "Delivering the Dragon Necklace",
        es: "Entregando el Dragon Necklace",
        pl: "Dostarczanie Dragon Necklace",
      },
      content: {
        pt: "Hora de voltar ao Mortimer e entregar o Dragon Necklace.",
        en: "Time to go back to Mortimer and deliver the Dragon Necklace.",
        es: "Es hora de volver a Mortimer y entregar el Dragon Necklace.",
        pl: "Czas wrócić do Mortimera i dostarczyć Dragon Necklace.",
      },
    },
    // Seção 5: Segunda Conversa com Mortimer
    {
      type: "dialogue",
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Mortimer", text: "Greetings, what can I do for you?" },
        { speaker: "player", text: "mission" },
        { speaker: "Mortimer", text: "Did you get the requested dragon necklace?" },
        { speaker: "player", text: "yes" },
        {
          speaker: "Mortimer",
          text: "Thanks, this will help us a lot! I'm even considering admitting you into our ranks if you are willing to keep cooperating with our organization ...",
        },
        {
          speaker: "Mortimer",
          text: "But first, I need to ask you to do one more thing for us. Talk to me again once you are ready for another assignment.",
        },
        { speaker: "player", text: "mission" },
        {
          speaker: "Mortimer",
          text: "This mission will require some tracking skills to be accomplished, but if you manage to do it, I shall admit you into our very exclusive society ...",
        },
        { speaker: "player", text: "yes" },
        { speaker: "Mortimer", text: "Good! Now go and find Caleb." },
        { speaker: "player", text: "bye" },
        { speaker: "Mortimer", text: "Good bye." },
      ],
    },
    // Seção 6: Encontrando Caleb
    {
      type: "text",
      title: {
        pt: "Encontrando Caleb em Venore",
        en: "Finding Caleb in Venore",
        es: "Encontrando a Caleb en Venore",
        pl: "Znajdowanie Caleba w Venore",
      },
      content: {
        pt: 'Agora é hora de achar o Caleb. Vamos para Venore. Use uma shovel logo acima da árvore conforme a imagem. Ao descer no buraco que aparecerá, você verá o corpo do Caleb. Clique nele para receber uma espécie de "jornal" (sheet of tracing).',
        en: "Now it's time to find Caleb. Let's go to Venore. Use a shovel just above the tree as shown in the image. When you go down the hole that appears, you will see Caleb's body. Click on it to receive a \"sheet of tracing\".",
        es: 'Ahora es hora de encontrar a Caleb. Vamos a Venore. Usa una shovel justo encima del árbol como se muestra en la imagen. Al bajar por el agujero que aparece, verás el cuerpo de Caleb. Haz clic en él para recibir un "sheet of tracing".',
        pl: 'Teraz czas znaleźć Caleba. Idziemy do Venore. Użyj łopaty tuż nad drzewem, jak pokazano na obrazku. Gdy zejdziesz do dziury, która się pojawi, zobaczysz ciało Caleba. Kliknij na nie, aby otrzymać "sheet of tracing".',
      },
      images: ["/quests/explorer-society/deliver-necklace.jpg", "/quests/explorer-society/caleb-location.jpg"],
    },
    // Seção 7: Retornando ao Mortimer com o Sheet of Tracing
    {
      type: "text",
      title: {
        pt: "Retornando ao Mortimer",
        en: "Returning to Mortimer",
        es: "Regresando a Mortimer",
        pl: "Powrót do Mortimera",
      },
      content: {
        pt: "Agora você precisa voltar ao Mortimer para entregar o sheet of tracing e informá-lo sobre a morte do Caleb.",
        en: "Now you need to return to Mortimer to deliver the sheet of tracing and inform him about Caleb's death.",
        es: "Ahora necesitas volver a Mortimer para entregar el sheet of tracing e informarle sobre la muerte de Caleb.",
        pl: "Teraz musisz wrócić do Mortimera, aby dostarczyć sheet of tracing i poinformować go o śmierci Caleba.",
      },
    },
    // Seção 8: Diálogo com Mortimer sobre Caleb
    {
      type: "dialogue",
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Mortimer", text: "Greetings, what can I do for you?" },
        { speaker: "player", text: "mission" },
        { speaker: "Mortimer", text: "Did you find Caleb and brought his report?" },
        { speaker: "player", text: "yes" },
        {
          speaker: "Mortimer",
          text: "Ohh I see, this is indeed Caleb's handwriting. If you are here and he is not, does this mean that he is... dead?",
        },
        { speaker: "player", text: "yes" },
        { speaker: "Mortimer", text: "Poor Caleb! He will be missed among our society ..." },
        {
          speaker: "Mortimer",
          text: "As I promised, I grant you now a membership status on our select group. Ask me for another mission when you are ready to hear about it.",
        },
        { speaker: "player", text: "mission" },
        {
          speaker: "Mortimer",
          text: "Even though my heart is taken by sorrow over learning about Caleb's death, I am afraid that we won't have much time to mourn him right now, as we need to hurry to save another valuable member of ours. ...",
        },
        { speaker: "player", text: "yes" },
        {
          speaker: "Mortimer",
          text: "I knew I could count on you! I wrote this report to the Caliph explaining the situation. I am sure he will consider letting you through the southern gate after he reads this. ...",
        },
        {
          speaker: "Mortimer",
          text: "Report back to me if you find Angus, and let me know what are his plans for the Tiquanda region. Go now and watch your back in the desert!",
        },
      ],
    },
    // Seção 9: Mensagem do Parchment
    {
      type: "parchment",
      content: {
        pt: "You see a parchment.\nIt contains a detailed report of the Explorer Society's activities in Darama.",
        en: "You see a parchment.\nIt contains a detailed report of the Explorer Society's activities in Darama.",
        es: "You see a parchment.\nIt contains a detailed report of the Explorer Society's activities in Darama.",
        pl: "You see a parchment.\nIt contains a detailed report of the Explorer Society's activities in Darama.",
      },
    },
    // Seção 10: Falando com Kazzan
    {
      type: "text",
      title: {
        pt: "Falando com Kazzan em Darashia",
        en: "Talking to Kazzan in Darashia",
        es: "Hablando con Kazzan en Darashia",
        pl: "Rozmowa z Kazzan w Darashia",
      },
      content: {
        pt: "Hora de ir falar com o Caliph em Darashia. Seu nome é Kazzan.",
        en: "Time to go talk to the Caliph in Darashia. His name is Kazzan.",
        es: "Es hora de ir a hablar con el Califa en Darashia. Su nombre es Kazzan.",
        pl: "Czas porozmawiać z Kalifem w Darashia. Jego imię to Kazzan.",
      },
      mapCoordinates: { x: 33234, y: 32391, z: 6, zoom: 3 },
      images: ["/quests/explorer-society/caleb-body.jpg"],
    },
    // Seção 8: Conversa com Kazzan
    {
      type: "dialogue",
      dialogue: [
        { speaker: "player", text: "hi" },
        {
          speaker: "Kazzan",
          text: "Feel welcome in the lands of the children of the enlightened Daraman",
        },
        { speaker: "player", text: "permission" },
        {
          speaker: "Kazzan",
          text: "What reason do I have to let you through the southern passage?",
        },
        { speaker: "player", text: "report" },
        {
          speaker: "Kazzan",
          text: "By Daraman's tear! The Explorer Society should have shared this information sooner!...",
        },
        {
          speaker: "Kazzan",
          text: "Those people might be still alive, struggling in the wild. They need our support...",
        },
        { speaker: "Kazzan", text: "I will make it known to the guards that you have my permission to head south..." },
        {
          speaker: "Kazzan",
          text: "But I cannot risk sending any of my men on this enterprise at this moment, so you will have to investigate the matter on your own...",
        },
        {
          speaker: "Kazzan",
          text: "Once you find yourself to the south of the passage, be careful of what's around you as there are many dangers in the area...",
        },
        {
          speaker: "Kazzan",
          text: "We now know that the necromancers and their minions are once again a threat to all the living beings that reach their sight...",
        },
        {
          speaker: "Kazzan",
          text: "Also, a fisherman has reported some major outlaw activity in the last couple of months. Seems like they arrived in ships and are now building a stronghold by the east coast...",
        },
        {
          speaker: "Kazzan",
          text: "And last but not least, it might be worth trying to contact our old allies, the Marid. Their clan lives in the Ashta'daramai fortress...",
        },
        {
          speaker: "Kazzan",
          text: "We haven't heard from them in the last few years, after our victory in the last coalition war, but they might have some valuable information about what happened to the city of Ankrahmun...",
        },
        {
          speaker: "Kazzan",
          text: "I hope you manage to avoid all danger and find the survivors. If you succeed, let them know that they shall have all the support they need from Darashia...",
        },
        {
          speaker: "Kazzan",
          text: "After finding them, you must return to me immediately to give us directions on their whereabouts. Go now and may Daraman guide your footsteps! I will be waiting for you to return with good news, explorer.",
        },
        { speaker: "player", text: "bye" },
        { speaker: "Kazzan", text: "May your soul flourish." },
      ],
    },
    // Seção 9: Passagem Liberada
    {
      type: "text",
      title: {
        pt: "Passagem Liberada",
        en: "Passage Unlocked",
        es: "Pasaje Liberado",
        pl: "Przejście Odblokowane",
      },
      content: {
        pt: "Após isso sua passagem para Ankrahmun está liberada, basta clicar na porta e passar.",
        en: "After that your passage to Ankrahmun is unlocked, just click on the door and go through.",
        es: "Después de eso tu pasaje a Ankrahmun está liberado, solo haz clic en la puerta y pasa.",
        pl: "Po tym twoje przejście do Ankrahmun jest odblokowane, wystarczy kliknąć na drzwi i przejść.",
      },
      images: ["/quests/explorer-society/passage-unlocked.jpg"],
    },
    // Seção 12: Créditos
    {
      type: "credits",
      content: {
        pt: "Spoiler cedido pela guild Avatarhood, Chill Zone e Amigos.",
        en: "Spoiler provided by guild Avatarhood, Chill Zone and Friends.",
        es: "Spoiler proporcionado por la guild Avatarhood, Chill Zone y Amigos.",
        pl: "Spoiler dostarczony przez gildię Avatarhood, Chill Zone i Przyjaciele.",
      },
      images: ["/quests/explorer-society/ankrahmun-celebration.jpg"],
    },
  ],
};
