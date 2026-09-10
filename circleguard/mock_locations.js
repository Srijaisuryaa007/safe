const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[MockLocations] Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function simulate() {
  const { data: locs } = await supabase.from('locations').select('*').order('updated_at', { ascending: false }).limit(1);
  if (!locs || locs.length === 0) {
     console.log('No locations found to base off of');
     return;
  }
  
  const baseLoc = locs[0];
  console.log('Base location:', baseLoc.geom);
  const match = baseLoc.geom.match(/POINT\(([-.\d]+)\s+([-.\d]+)\)/i);
  if (!match) return;
  const lng = parseFloat(match[1]);
  const lat = parseFloat(match[2]);

  const { data: users } = await supabase.from('profiles').select('*');
  console.log('Found users:', users.length);
  
  for (const user of users) {
     if (user.id === baseLoc.user_id) continue;
     
     const offsetLng = lng + (Math.random() - 0.5) * 0.01; // ~500 meters
     const offsetLat = lat + (Math.random() - 0.5) * 0.01;
     
     await supabase.from('locations').upsert({
       user_id: user.id,
       geom: `POINT(${offsetLng} ${offsetLat})`,
       accuracy_m: 10,
       speed_mps: 0,
       updated_at: new Date().toISOString()
     });
     console.log('Inserted dummy location for', user.full_name);
  }
}
simulate();
