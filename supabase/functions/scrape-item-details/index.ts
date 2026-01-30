const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface NpcInfo {
  city: string;
  npc: string;
  price: string;
  mapUrl?: string;
}

interface LootInfo {
  monster: string;
  image: string;
  amount: string;
  chance: string;
}

interface ItemDetails {
  name: string;
  image: string;
  stats: {
    armor?: number;
    attack?: number;
    defense?: number;
    weight: string;
  };
  sellTo: NpcInfo[];
  buyFrom: NpcInfo[];
  lootedFrom: LootInfo[];
}

function itemNameToUrl(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/\s+/g, '_');
}

function extractTextContent(html: string, startTag: string, endTag: string): string {
  const startIndex = html.indexOf(startTag);
  if (startIndex === -1) return '';
  const contentStart = startIndex + startTag.length;
  const endIndex = html.indexOf(endTag, contentStart);
  if (endIndex === -1) return '';
  return html.substring(contentStart, endIndex).trim();
}

function parseNpcTable(html: string, tableId: string): NpcInfo[] {
  const npcs: NpcInfo[] = [];
  
  // Find the table
  const tableStart = html.indexOf(`id="${tableId}"`);
  if (tableStart === -1) return npcs;
  
  // Find tbody
  const tbodyStart = html.indexOf('<tbody>', tableStart);
  const tbodyEnd = html.indexOf('</tbody>', tbodyStart);
  if (tbodyStart === -1 || tbodyEnd === -1) return npcs;
  
  const tbody = html.substring(tbodyStart, tbodyEnd);
  
  // Extract rows - skip header rows with id="topsbi"
  const rowRegex = /<tr(?:\s+[^>]*)?>(?!.*id="topsbi")([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const fullRow = rowMatch[0];
    const row = rowMatch[1];
    
    // Skip header row (has id="topsbi")
    if (fullRow.includes('id="topsbi"')) {
      continue;
    }
    
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1]);
    }
    
    if (cells.length >= 3) {
      // Extract city (remove HTML tags)
      const city = cells[0].replace(/<[^>]*>/g, '').trim();
      
      // Skip if city is "City" (header) or empty
      if (!city || city.toLowerCase() === 'city') {
        continue;
      }
      
      // Extract map URL from the NPC cell (it's in the same cell as NPC name)
      let mapUrl: string | undefined;
      const mapMatch = cells[1].match(/href="([^"]*)"/i);
      if (mapMatch) {
        mapUrl = mapMatch[1];
        // Make URL absolute if needed
        if (!mapUrl.startsWith('http')) {
          mapUrl = 'https://tibiara.netlify.app/en/pages/items/' + mapUrl;
        }
      }
      
      // Extract NPC name (remove HTML tags and clean up)
      const npc = cells[1].replace(/<[^>]*>/g, '').trim();
      
      // Extract price
      const price = cells[2].replace(/<[^>]*>/g, '').trim();
      
      // Skip rows with empty values
      if (!npc || !price) {
        continue;
      }
      
      npcs.push({ city, npc, price, mapUrl });
    }
  }
  
  return npcs;
}

function parseLootTable(html: string): LootInfo[] {
  const loot: LootInfo[] = [];
  
  // Find the looted table
  const tableStart = html.indexOf('id="looted"');
  if (tableStart === -1) return loot;
  
  // Find tbody
  const tbodyStart = html.indexOf('<tbody>', tableStart);
  const tbodyEnd = html.indexOf('</tbody>', tbodyStart);
  if (tbodyStart === -1 || tbodyEnd === -1) return loot;
  
  const tbody = html.substring(tbodyStart, tbodyEnd);
  
  // Extract rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const row = rowMatch[1];
    const cells: string[] = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1]);
    }
    
    if (cells.length >= 4) {
      // Extract monster name
      const monster = cells[0].replace(/<[^>]*>/g, '').trim();
      
      // Extract image URL
      let image = '';
      const imgMatch = cells[1].match(/src="([^"]*)"/i);
      if (imgMatch) {
        image = imgMatch[1];
        if (!image.startsWith('http')) {
          image = 'https://tibiara.netlify.app' + (image.startsWith('/') ? '' : '/') + image;
        }
      }
      
      // Extract amount
      const amount = cells[2].replace(/<[^>]*>/g, '').trim();
      
      // Extract chance
      const chance = cells[3].replace(/<[^>]*>/g, '').trim();
      
      loot.push({ monster, image, amount, chance });
    }
  }
  
  return loot;
}

function parseItemDetails(html: string, itemName: string): ItemDetails {
  const details: ItemDetails = {
    name: itemName,
    image: '',
    stats: { weight: '' },
    sellTo: [],
    buyFrom: [],
    lootedFrom: []
  };
  
  // Extract item image from oneitems table
  const imgMatch = html.match(/id="oneitems"[\s\S]*?<img[^>]*src="([^"]*)"/i);
  if (imgMatch) {
    let imgUrl = imgMatch[1];
    // Make URL absolute if needed
    if (!imgUrl.startsWith('http')) {
      imgUrl = 'https://tibiara.netlify.app/en/pages/items/' + imgUrl;
    }
    details.image = imgUrl;
  }
  
  // Extract stats from oneitems table - parse the data row, not headers
  const oneItemsStart = html.indexOf('id="oneitems"');
  if (oneItemsStart !== -1) {
    const tableEnd = html.indexOf('</table>', oneItemsStart);
    const tableHtml = html.substring(oneItemsStart, tableEnd);
    
    // Find all rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let rowIndex = 0;
    
    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      rowIndex++;
      // Skip header row (first row)
      if (rowIndex === 1) continue;
      
      const row = rowMatch[1];
      const cells: string[] = [];
      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(row)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
      }
      
      // cells[0] = name, cells[1] = image, cells[2] = armor/atk, cells[3] = weight
      if (cells.length >= 4) {
        const statValue = parseInt(cells[2]);
        if (!isNaN(statValue)) {
          details.stats.armor = statValue;
        }
        details.stats.weight = cells[3];
      }
      
      break; // Only need first data row
    }
  }
  
  // Parse NPC tables
  // sbileft = Sell to NPCs, sbiright = Buy from NPCs
  details.sellTo = parseNpcTable(html, 'sbileft');
  details.buyFrom = parseNpcTable(html, 'sbiright');
  
  // Parse loot table
  details.lootedFrom = parseLootTable(html);
  
  return details;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { itemName } = await req.json();

    if (!itemName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Item name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching details for item:', itemName);
    
    const urlName = itemNameToUrl(itemName);
    const url = `https://tibiara.netlify.app/en/pages/items/${urlName}.html`;
    
    console.log('Scraping URL:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      console.log('Failed to fetch page, status:', response.status);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Item not found (${response.status})`,
          itemName 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    console.log('Successfully fetched HTML, length:', html.length);
    
    const itemDetails = parseItemDetails(html, itemName);
    console.log('Parsed item details:', JSON.stringify(itemDetails, null, 2));

    return new Response(
      JSON.stringify({ success: true, data: itemDetails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping item details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch item details';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
