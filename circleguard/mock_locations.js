const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://phgizfyyywwjieruytsy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoZ2l6Znl5eXd3amllcnV5dHN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NzI0OTgsImV4cCI6MjEwMDQ0ODQ5OH0.2wPN8HhSyfab5FxvNEoMmG4hF0152fLX2CZnL3gvGsQ';
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
