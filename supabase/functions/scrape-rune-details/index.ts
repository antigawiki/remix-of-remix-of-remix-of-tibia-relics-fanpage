const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface VocationFood {
  name: string;
  image: string;
  quantity: number;
}

interface VocationDetails {
  vocation: string;
  time: string;
  foods: VocationFood[];
}

interface RuneDetails {
  name: string;
  image: string;
  spell: string;
  mana: number;
  vocations: VocationDetails[];
}

// Map food image filenames to readable names
const foodNameMap: Record<string, string> = {
  'dragon_meat.gif': 'Dragon Ham',
  '199.gif': 'Ham',
  '620.gif': 'Brown Mushroom',
  '200.gif': 'Meat',
  '194.gif': 'Fish',
  '344.gif': 'White Mushroom',
  '203.gif': 'Roast Pork',
  'fish.gif': 'Fish',
  'ham.gif': 'Ham',
  'meat.gif': 'Meat',
  'brown_mushroom.gif': 'Brown Mushroom',
  'white_mushroom.gif': 'White Mushroom',
  'roast_pork.gif': 'Roast Pork',
};

function getFoodName(imageSrc: string): string {
  const filename = imageSrc.split('/').pop() || '';
  return foodNameMap[filename] || filename.replace('.gif', '').replace(/_/g, ' ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { runeId } = await req.json();

    if (!runeId) {
      return new Response(
        JSON.stringify({ error: 'runeId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraping rune details for: ${runeId}`);

    const url = `https://tibiara.netlify.app/en/pages/items/${runeId}.html`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch: ${response.status}`);
      return new Response(
        JSON.stringify({ error: `Failed to fetch rune page: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    console.log(`Fetched HTML length: ${html.length}`);

    // Parse basic info
    const runeDetails: RuneDetails = {
      name: '',
      image: '',
      spell: '',
      mana: 0,
      vocations: [],
    };

    // Extract from #oneitems table - structure:
    // Row 1: headers (Name, Image, Spell, mana)
    // Row 2: data cells
    const oneitemsMatch = html.match(/<table[^>]*id="oneitems"[^>]*>([\s\S]*?)<\/table>/i);
    if (oneitemsMatch) {
      const oneitemsContent = oneitemsMatch[1];
      
      // Get all rows
      const rows = oneitemsContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      const rowsArray: string[] = [];
      for (const row of rows) {
        rowsArray.push(row[1]);
      }
      
      // Data row is the second row (index 1)
      if (rowsArray.length >= 2) {
        const dataRow = rowsArray[1];
        
        // Extract all cells
        const cells = dataRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        const cellsArray: string[] = [];
        for (const cell of cells) {
          cellsArray.push(cell[1]);
        }
        
        // Cell 0: name, Cell 1: image, Cell 2: spell, Cell 3: mana
        if (cellsArray.length >= 1) {
          runeDetails.name = cellsArray[0].replace(/<[^>]+>/g, '').trim();
        }
        if (cellsArray.length >= 2) {
          const imgMatch = cellsArray[1].match(/<img[^>]*src="([^"]+)"[^>]*>/i);
          if (imgMatch) {
            runeDetails.image = imgMatch[1].startsWith('http') 
              ? imgMatch[1] 
              : `https://tibiara.netlify.app${imgMatch[1].startsWith('/') ? '' : '/en/'}${imgMatch[1]}`;
          }
        }
        if (cellsArray.length >= 3) {
          runeDetails.spell = cellsArray[2].replace(/<[^>]+>/g, '').trim();
        }
        if (cellsArray.length >= 4) {
          const manaValue = cellsArray[3].replace(/<[^>]+>/g, '').trim();
          runeDetails.mana = parseInt(manaValue, 10) || 0;
        }
      }
    }

    console.log(`Basic info - Name: ${runeDetails.name}, Spell: ${runeDetails.spell}, Mana: ${runeDetails.mana}`);

    // Find all sbileft tables (each contains vocation info)
    const sbiLeftMatches = html.matchAll(/<table[^>]*id="sbileft"[^>]*>([\s\S]*?)<\/table>/gi);
    const sbiLeftSections: string[] = [];
    for (const match of sbiLeftMatches) {
      sbiLeftSections.push(match[0]);
    }

    console.log(`Found ${sbiLeftSections.length} sbileft sections`);

    // Find all runes tables (each contains food info)
    const runesTables = html.matchAll(/<table[^>]*id="runes"[^>]*>([\s\S]*?)<\/table>/gi);
    const runesSections: string[] = [];
    for (const match of runesTables) {
      runesSections.push(match[0]);
    }

    console.log(`Found ${runesSections.length} runes sections`);

    // Process each sbileft section
    for (let i = 0; i < sbiLeftSections.length; i++) {
      const sbiSection = sbiLeftSections[i];
      
      // Extract all rows from sbileft
      const rows = sbiSection.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      const rowsArray: string[] = [];
      for (const row of rows) {
        rowsArray.push(row[1]);
      }

      // Skip if we don't have enough rows (header + data)
      if (rowsArray.length < 2) continue;

      // Data row is the second row (first is header with "Backpack of:", "VOC.", "time to do")
      const dataRow = rowsArray[1];
      
      // Extract cells from data row
      const cells = dataRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      const cellsArray: string[] = [];
      for (const cell of cells) {
        cellsArray.push(cell[1]);
      }

      if (cellsArray.length < 3) continue;

      // Cell 0: backpack image, Cell 1: vocation, Cell 2: time
      let vocation = cellsArray[1]
        .replace(/<\/?\s*br\s*\/?>/gi, ' / ')  // Handle <br>, </br>, <br/>, <br />
        .replace(/<[^>]+>/g, '')
        .replace(/\s*\/\s*/g, ' / ')  // Normalize spacing around slashes
        .replace(/\s+/g, ' ')  // Collapse multiple spaces
        .trim();
      
      const time = cellsArray[2]
        .replace(/<[^>]+>/g, '')
        .trim();

      console.log(`Vocation: ${vocation}, Time: ${time}`);

      // Get corresponding foods from runes table
      const foods: VocationFood[] = [];
      
      if (i < runesSections.length) {
        const runesSection = runesSections[i];
        
        // Find all food cells with images
        const foodCells = runesSection.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        
        for (const foodCell of foodCells) {
          const cellContent = foodCell[1];
          
          // Skip header cells
          if (cellContent.includes('<th') || cellContent.includes('needed food')) continue;
          
          // Extract image
          const foodImgMatch = cellContent.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
          if (!foodImgMatch) continue;
          
          // Extract quantity - pattern is "<br> x N" or just "x N"
          const quantityMatch = cellContent.match(/x\s*(\d+)/i);
          if (!quantityMatch) continue;
          
          const imageSrc = foodImgMatch[1];
          const fullImageUrl = imageSrc.startsWith('http')
            ? imageSrc
            : `https://tibiara.netlify.app${imageSrc.startsWith('/') ? '' : '/en/'}${imageSrc}`;
          
          foods.push({
            name: getFoodName(imageSrc),
            image: fullImageUrl,
            quantity: parseInt(quantityMatch[1], 10),
          });
        }
      }

      console.log(`Foods for ${vocation}: ${foods.length} items`);

      if (vocation && time) {
        runeDetails.vocations.push({
          vocation,
          time,
          foods,
        });
      }
    }

    console.log(`Successfully scraped rune ${runeId}: ${runeDetails.vocations.length} vocations found`);

    return new Response(
      JSON.stringify(runeDetails),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping rune details:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to scrape rune details' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
