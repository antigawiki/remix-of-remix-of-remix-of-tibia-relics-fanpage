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
    pt: "Ajude a Explorer Society e ganhe acesso à cidade de Ankrahmun através do barco de Darashia.",
    en: "Help the Explorer Society and gain access to the city of Ankrahmun via the Darashia boat.",
    es: "Ayuda a la Explorer Society y obtén acceso a la ciudad de Ankrahmun a través del barco de Darashia.",
    pl: "Pomóż Explorer Society i uzyskaj dostęp do miasta Ankrahmun przez łódź z Darashia.",
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
      pt: "Acesso a Ankrahmun via barco de Darashia",
      en: "Access to Ankrahmun via Darashia boat",
      es: "Acceso a Ankrahmun vía barco de Darashia",
      pl: "Dostęp do Ankrahmun przez łódź z Darashia",
    },
  ],
  sections: [
    // Section 1: Início da Quest
    {
      type: "text",
      title: {
        pt: "Início da Quest",
        en: "Quest Start",
        es: "Inicio de la Quest",
        pl: "Początek Questa",
      },
      content: {
        pt: "Vá até o NPC Mortimer em Port Hope, no segundo andar do Explorer Society Hall.",
        en: "Go to NPC Mortimer in Port Hope, on the second floor of the Explorer Society Hall.",
        es: "Ve al NPC Mortimer en Port Hope, en el segundo piso del Explorer Society Hall.",
        pl: "Idź do NPC Mortimer w Port Hope, na drugim piętrze Explorer Society Hall.",
      },
      mapCoordinates: { x: 32500, y: 31626, z: 7, zoom: 3 },
    },
    // Section 2: Conversa com Mortimer
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
        { speaker: "Mortimer", text: "Greetings, what can I do for you today?" },
        { speaker: "player", text: "join" },
        { speaker: "Mortimer", text: "Do you want to join the Explorer Society?" },
        { speaker: "player", text: "yes" },
        { speaker: "Mortimer", text: "Welcome to the Explorer Society! To prove your worth, I need you to complete a mission." },
        { speaker: "player", text: "mission" },
        { speaker: "Mortimer", text: "I need you to retrieve a Dragon Necklace from the ancient ruins. Are you interested?" },
        { speaker: "player", text: "yes" },
      ],
    },
    // Section 3: Obtendo o Dragon Necklace
    {
      type: "text",
      title: {
        pt: "Obtendo o Dragon Necklace",
        en: "Getting the Dragon Necklace",
        es: "Obteniendo el Dragon Necklace",
        pl: "Zdobywanie Dragon Necklace",
      },
      content: {
        pt: "Desça as escadas no hall e siga o caminho das ruínas. Você enfrentará alguns beholders no caminho. Use a Pick para quebrar pedras que bloqueiam o caminho. Ao final, você encontrará um baú com o Dragon Necklace.",
        en: "Go down the stairs in the hall and follow the path to the ruins. You will face some beholders on the way. Use the Pick to break rocks blocking the path. At the end, you will find a chest with the Dragon Necklace.",
        es: "Baja las escaleras en el hall y sigue el camino a las ruinas. Enfrentarás algunos beholders en el camino. Usa el Pick para romper las rocas que bloquean el camino. Al final, encontrarás un cofre con el Dragon Necklace.",
        pl: "Zejdź po schodach w holu i podążaj ścieżką do ruin. Po drodze napotkasz kilka beholderów. Użyj Pick, aby rozbić kamienie blokujące drogę. Na końcu znajdziesz skrzynię z Dragon Necklace.",
      },
    },
    // Section 4: Entregando o Dragon Necklace
    {
      type: "dialogue",
      title: {
        pt: "Entregando o Dragon Necklace",
        en: "Delivering the Dragon Necklace",
        es: "Entregando el Dragon Necklace",
        pl: "Dostarczanie Dragon Necklace",
      },
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Mortimer", text: "Welcome back! Did you find the Dragon Necklace?" },
        { speaker: "player", text: "mission" },
        { speaker: "Mortimer", text: "Excellent! You have proven yourself worthy. Now I have another task for you." },
        { speaker: "player", text: "task" },
        { speaker: "Mortimer", text: "Go to Venore and find Caleb. He has important information about Ankrahmun." },
      ],
    },
    // Section 5: Encontrando Caleb em Venore
    {
      type: "text",
      title: {
        pt: "Encontrando Caleb em Venore",
        en: "Finding Caleb in Venore",
        es: "Encontrando a Caleb en Venore",
        pl: "Znajdowanie Caleba w Venore",
      },
      content: {
        pt: "Vá até Venore e procure por Caleb. Ele está localizado próximo ao depot da cidade. Fale com ele sobre a missão.",
        en: "Go to Venore and look for Caleb. He is located near the city depot. Talk to him about the mission.",
        es: "Ve a Venore y busca a Caleb. Está ubicado cerca del depot de la ciudad. Habla con él sobre la misión.",
        pl: "Idź do Venore i poszukaj Caleba. Znajduje się w pobliżu depot miasta. Porozmawiaj z nim o misji.",
      },
    },
    // Section 6: Conversa com Caleb
    {
      type: "dialogue",
      title: {
        pt: "Conversa com Caleb",
        en: "Conversation with Caleb",
        es: "Conversación con Caleb",
        pl: "Rozmowa z Calebem",
      },
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Caleb", text: "Hello adventurer! What brings you here?" },
        { speaker: "player", text: "ankrahmun" },
        { speaker: "Caleb", text: "Ah, you want to access Ankrahmun? You need to speak with Kazzan in Darashia." },
        { speaker: "player", text: "kazzan" },
        { speaker: "Caleb", text: "He is the captain that can take you to Ankrahmun. Tell him I sent you." },
      ],
    },
    // Section 7: Finalizando em Darashia
    {
      type: "text",
      title: {
        pt: "Finalizando em Darashia",
        en: "Finishing in Darashia",
        es: "Finalizando en Darashia",
        pl: "Kończenie w Darashia",
      },
      content: {
        pt: "Vá até Darashia e fale com o NPC Kazzan no porto. Mencione que Caleb te enviou e ele liberará a passagem para Ankrahmun. Parabéns, você agora tem acesso a Ankrahmun!",
        en: "Go to Darashia and talk to NPC Kazzan at the port. Mention that Caleb sent you and he will grant you passage to Ankrahmun. Congratulations, you now have access to Ankrahmun!",
        es: "Ve a Darashia y habla con el NPC Kazzan en el puerto. Menciona que Caleb te envió y él te dará acceso a Ankrahmun. ¡Felicidades, ahora tienes acceso a Ankrahmun!",
        pl: "Idź do Darashia i porozmawiaj z NPC Kazzan w porcie. Wspomnij, że Caleb cię wysłał, a on da ci dostęp do Ankrahmun. Gratulacje, masz teraz dostęp do Ankrahmun!",
      },
    },
    // Section 8: Conversa final com Kazzan
    {
      type: "dialogue",
      title: {
        pt: "Conversa com Kazzan",
        en: "Conversation with Kazzan",
        es: "Conversación con Kazzan",
        pl: "Rozmowa z Kazzan",
      },
      dialogue: [
        { speaker: "player", text: "hi" },
        { speaker: "Kazzan", text: "Welcome to Darashia port. How can I help you?" },
        { speaker: "player", text: "ankrahmun" },
        { speaker: "Kazzan", text: "I can take you to Ankrahmun, but first tell me who sent you." },
        { speaker: "player", text: "caleb" },
        { speaker: "Kazzan", text: "Ah, Caleb! A good friend. I will gladly take you to Ankrahmun. The passage is now open to you!" },
      ],
    },
  ],
};
