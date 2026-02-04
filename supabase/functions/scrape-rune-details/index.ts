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

    // Parse basic info from #oneitems table
    const runeDetails: RuneDetails = {
      name: '',
      image: '',
      spell: '',
      mana: 0,
      vocations: [],
    };

    // Extract name from title or first table
    const nameMatch = html.match(/<td[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/td>/i);
    if (nameMatch) {
      runeDetails.name = nameMatch[1].trim();
    }

    // Extract image
    const imgMatch = html.match(/<img[^>]*src="([^"]*runes[^"]*)"[^>]*>/i);
    if (imgMatch) {
      runeDetails.image = imgMatch[1].startsWith('http') 
        ? imgMatch[1] 
        : `https://tibiara.netlify.app${imgMatch[1].startsWith('/') ? '' : '/en/'}${imgMatch[1]}`;
    }

    // Extract spell (words)
    const spellMatch = html.match(/Spell<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
    if (spellMatch) {
      runeDetails.spell = spellMatch[1].trim();
    }

    // Extract mana
    const manaMatch = html.match(/Mana<\/td>\s*<td[^>]*>(\d+)<\/td>/i);
    if (manaMatch) {
      runeDetails.mana = parseInt(manaMatch[1], 10);
    }

    // Find all vocation sections with time and foods
    // Pattern: table with #monster has vocation name and time, followed by table with #runes for foods
    
    // First, split by vocation sections
    const vocationSections = html.split(/<table[^>]*id="monster"[^>]*>/i);
    
    for (let i = 1; i < vocationSections.length; i++) {
      const section = vocationSections[i];
      
      // Extract vocation name (usually in title class)
      const vocationMatch = section.match(/<td[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/td>/i);
      if (!vocationMatch) continue;
      
      const vocationName = vocationMatch[1].trim();
      
      // Extract time
      const timeMatch = section.match(/Time<\/td>\s*<td[^>]*>([^<]+)<\/td>/i);
      const time = timeMatch ? timeMatch[1].trim() : '';
      
      // Find the foods table (id="runes") that follows this section
      const foodsTableMatch = section.match(/<table[^>]*id="runes"[^>]*>([\s\S]*?)<\/table>/i);
      
      const foods: VocationFood[] = [];
      
      if (foodsTableMatch) {
        const foodsHtml = foodsTableMatch[1];
        
        // Extract all food rows (each has image and quantity)
        const foodRows = foodsHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        
        for (const row of foodRows) {
          // Skip header row
          if (row.includes('<th')) continue;
          
          // Extract image
          const foodImgMatch = row.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
          // Extract quantity (usually in a cell after image)
          const quantityMatch = row.match(/<td[^>]*>\s*(\d+)\s*<\/td>/i);
          
          if (foodImgMatch && quantityMatch) {
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
      }
      
      if (vocationName && time) {
        runeDetails.vocations.push({
          vocation: vocationName,
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
