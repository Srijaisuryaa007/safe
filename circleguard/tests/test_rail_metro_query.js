(async () => {
  console.log('Testing Overpass railway query with User-Agent...');
  const query = `[out:json][timeout:15];
(
  way["railway"~"subway|rail|light_rail"](13.04,80.20,13.09,80.28);
);
out geom;`;

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'User-Agent': 'CircleGuardSafetyApp/2.0 (contact@circleguard.internal)',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: 'data=' + encodeURIComponent(query)
    });
    console.log('Overpass status:', res.status);
    const data = await res.json();
    console.log('Rail ways found:', data.elements ? data.elements.length : 0);
    if (data.elements && data.elements.length > 0) {
      console.log('Sample tags:', data.elements[0].tags);
      console.log('Sample geometry points count:', data.elements[0].geometry?.length);
    }
  } catch (e) {
    console.error('Overpass error:', e.message);
  }
})();
