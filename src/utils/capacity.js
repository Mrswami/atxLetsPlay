export function getSimulatedCapacity(courtId) {
  const hour = new Date().getHours();
  
  // Base capacity curve based on time of day (0-23)
  let baseCapacity = 20;
  if (hour >= 6 && hour <= 9) baseCapacity = 40 + (hour - 6) * 10;
  else if (hour > 9 && hour <= 16) baseCapacity = 30 + (hour % 2) * 5;
  else if (hour >= 17 && hour <= 21) baseCapacity = 70 + (21 - hour) * 5;
  else baseCapacity = 10;

  // Add some deterministic pseudo-randomness using the courtId string
  let idHash = 0;
  if (courtId) {
    for (let i = 0; i < courtId.length; i++) {
      idHash += courtId.charCodeAt(i);
    }
  }
  
  // Fluctuate by +/- 20% based on the courtId hash and current hour
  const variance = ((idHash + hour) % 40) - 20;
  
  let finalCapacity = baseCapacity + variance;
  // Clamp between 5% and 100%
  finalCapacity = Math.max(5, Math.min(100, finalCapacity));
  
  let label = 'Quiet';
  let colorClass = 'capacity-quiet';
  if (finalCapacity > 75) {
    label = 'Packed';
    colorClass = 'capacity-packed';
  } else if (finalCapacity > 40) {
    label = 'Moderate';
    colorClass = 'capacity-moderate';
  }

  return {
    percentage: finalCapacity,
    label,
    colorClass
  };
}
