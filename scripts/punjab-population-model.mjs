// Scenario weights express editorial choices; heritage sites are not census evidence.
export const religionTotals = [
  ['Sikhism', 61000000],
  ['Hinduism', 16000000],
  ['Islam', 1700000],
  ['Christianity', 400000],
  ['Jainism', 200000],
  ['Buddhism', 150000],
  ['Other', 150000],
];
export const populationNote =
  'Fictional alternative-world allocation, not a census or forecast. Punjab retains 7.96 crore residents and the user-set totals for all seven religions. District populations stay fixed; religious shares vary with the scenario’s heritage centres, rural communities and urban settlement mix. Heritage references identify places, not evidence of present-day religious populations.';
export const easternDistricts = new Set([
  'Amritsar',
  'Barnala',
  'Bathinda',
  'Faridkot',
  'Fatehgarh Sahib',
  'Fazilka',
  'Ferozepur',
  'Gurdaspur',
  'Hoshiarpur',
  'Jalandhar',
  'Kapurthala',
  'Ludhiana',
  'Mansa',
  'Moga',
  'Pathankot',
  'Patiala',
  'Rupnagar',
  'S A S Nagar',
  'Sangrur',
  'Shahid Bhagat Singh Nagar',
  'Sri Anandpur Sahib',
  'Sri Muktsar Sahib',
  'Tarn Taran',
]);
const settlementWeights = {
  Lahore: 12,
  Sandalbar: 7,
  Rawalpindi: 4.8,
  Ranjitgarh: 4.6,
  Harappa: 4.5,
  Ludhiana: 3.6,
  Sargodha: 3.1,
  Jhang: 2.6,
  'Sacha Sauda': 2.8,
  'Babe Di Ber': 2.6,
  'Bulleh Shah': 2.5,
  Dinga: 2.4,
  Jalandhar: 2.2,
  Amritsar: 2.2,
  Patiala: 1.9,
  Sangrur: 1.9,
  Hoshiarpur: 1.6,
  Bathinda: 1.5,
};
// Order matches religionTotals: Sikh, Hindu, Muslim, Christian, Jain, Buddhist, other.
const profiles = {
  'punjab-d-lahore': [
    [97, 2, 0.4, 0.35, 0.15, 0.002, 0.098],
    'Lahore is a very large Sikh population centre with smaller urban communities.',
  ],
  'punjab-d-faisalabad': [
    [96.5, 2.3, 0.7, 0.3, 0.1, 0.002, 0.098],
    'Sandalbar is a very large Sikh agricultural and settlement centre.',
  ],
  'punjab-d-amritsar': [
    [97, 2, 0.5, 0.3, 0.05, 0.002, 0.148],
    'Amritsar has a strong Sikh majority around its major religious centre.',
  ],
  'punjab-d-nankana-sahib': [
    [98.5, 1, 0.25, 0.15, 0.02, 0.002, 0.078],
    'Nankana Sahib has one of the strongest Sikh concentrations in the scenario.',
  ],
  'punjab-d-kartarpur-ravi': [
    [98, 1.3, 0.3, 0.2, 0.04, 0.002, 0.158],
    'Kartarpur Sahib and the merged Narowal countryside form a strong Sikh population centre.',
  ],
  'punjab-d-narowal': [
    [96, 2.5, 0.7, 0.5, 0.05, 0.002, 0.248],
    'The Narowal countryside supports the strong Sikh concentration of merged Kartarpur Sahib.',
  ],
  'punjab-d-sri-anandpur-sahib': [
    [98, 1.4, 0.25, 0.15, 0.02, 0.002, 0.178],
    'Sri Anandpur Sahib has one of the strongest Sikh concentrations in the scenario.',
  ],
  'punjab-d-tarn-taran': [
    [97.5, 1.7, 0.4, 0.2, 0.04, 0.002, 0.158],
    'Tarn Taran has a strong Sikh majority in its religious centre and surrounding rural communities.',
  ],
  'punjab-d-panja-sahib': [
    [96, 2.5, 0.7, 0.3, 0.05, 0.02, 0.43],
    'Panja Sahib is another strong Sikh heritage and settlement centre.',
  ],
  'punjab-d-sheikhupura': [
    [94, 4, 0.9, 0.7, 0.05, 0.002, 0.348],
    'Sacha Sauda has a strong Sikh settlement emphasis near the Lahore–Nankana corridor.',
  ],
  'punjab-d-hafizabad': [
    [94, 4, 1, 0.4, 0.05, 0.002, 0.548],
    'Rori Sahib has a strong Sikh emphasis in the scenario.',
  ],
  'punjab-d-fatehgarh-sahib': [
    [95, 3, 0.9, 0.4, 0.05, 0.002, 0.648],
    'Fatehgarh Sahib has a strong Sikh heritage and settlement emphasis.',
  ],
  'punjab-d-sri-muktsar-sahib': [
    [91, 7, 1, 0.4, 0.1, 0.002, 0.498],
    'Sri Muktsar Sahib has a strong Sikh rural and heritage emphasis.',
  ],
  'punjab-d-kapurthala': [
    [86, 11, 1.4, 1, 0.1, 0.01, 0.49],
    'Kapurthala combines Sikh heritage centres with a more varied urban mix.',
  ],
  'punjab-d-taxila': [
    [56, 23, 1.5, 0.4, 0.1, 18.5, 0.5],
    'Taxila has the largest Buddhist population and share, reflecting the scenario’s Buddhist learning and monastery centre.',
  ],
  'punjab-d-haripur-hazara': [
    [72, 21, 2, 0.5, 0.1, 3.8, 0.6],
    'Haripur has a secondary Buddhist concentration around the wider Taxila–Gandhara heritage corridor.',
  ],
  'punjab-d-rawalpindi': [
    [68, 27, 3.2, 0.7, 0.4, 0.4, 0.3],
    'Rawalpindi combines a diverse urban mix with a smaller Buddhist concentration in the northern heritage corridor.',
  ],
  'punjab-d-katas-raj-salt-range': [
    [40, 56, 2.5, 0.4, 0.1, 0.05, 0.95],
    'Katas Raj and surrounding Chakwal have a substantial Hindu community centred on the temple and pilgrimage landscape.',
  ],
  'punjab-d-chakwal': [
    [57, 39, 2.5, 0.5, 0.1, 0.01, 0.89],
    'Chakwal contributes a substantial Hindu population to the merged Katas district.',
  ],
  'punjab-d-ludhiana': [
    [55, 42, 1, 0.8, 0.7, 0.01, 0.49],
    'Ludhiana retains a large Hindu population and more substantial Jain and Christian urban communities.',
  ],
  'punjab-d-jalandhar': [
    [58, 38, 1.5, 1.3, 0.5, 0.01, 0.69],
    'Jalandhar has a varied Sikh–Hindu urban mix and a larger Christian community.',
  ],
  'punjab-d-hoshiarpur': [
    [56, 41, 1.3, 0.6, 0.6, 0.01, 0.49],
    'Hoshiarpur retains a substantial Hindu community and a larger Jain allocation.',
  ],
  'punjab-d-pathankot': [
    [38, 58, 2.5, 0.6, 0.2, 0.04, 0.66],
    'Pathankot has a substantial Hindu share in its urban and foothill settlement mix.',
  ],
  'punjab-d-s-a-s-nagar': [
    [49, 47, 1.5, 0.7, 0.5, 0.01, 1.29],
    'S A S Nagar has a broad Sikh–Hindu metropolitan mix.',
  ],
  'punjab-d-rupnagar': [
    [61, 36, 1.5, 0.6, 0.2, 0.02, 0.68],
    'Rupnagar has a mixed Sikh–Hindu foothill and river-valley population.',
  ],
  'punjab-d-patiala': [
    [68, 28, 2, 0.8, 0.5, 0.003, 0.697],
    'Patiala combines a Sikh majority with substantial Hindu and smaller urban communities.',
  ],
  'punjab-d-bathinda': [
    [72, 25, 1.4, 0.6, 0.3, 0.003, 0.697],
    'Bathinda combines Sikh rural communities with a substantial Hindu urban population.',
  ],
  'punjab-d-sangrur': [
    [70, 16, 12, 0.6, 0.15, 0.003, 1.247],
    'The combined Sangrur district has a larger Muslim allocation around its retained Malerkotla area.',
  ],
  'punjab-d-gurdaspur': [
    [78, 17, 2, 2.2, 0.1, 0.01, 0.69],
    'Gurdaspur combines a Sikh majority with a larger Christian community and Hindu settlements.',
  ],
  'punjab-d-kasur-bulleh-shah': [
    [77, 16, 5.5, 1, 0.1, 0.003, 0.397],
    'Bulleh Shah has a larger Muslim allocation around its Sufi heritage and a mixed settlement population.',
  ],
  'punjab-d-jhang': [
    [73, 19, 6, 1, 0.1, 0.003, 0.897],
    'Jhang has a larger Muslim allocation and a varied riverine settlement mix.',
  ],
  'punjab-d-gujrat': [
    [78, 16, 4, 1, 0.2, 0.01, 0.79],
    'Dinga has a Sikh majority with substantial Hindu and Muslim communities.',
  ],
  'punjab-d-khushab': [
    [70, 25, 3.5, 0.5, 0.1, 0.01, 0.89],
    'Khushab has a more varied Salt Range and rural settlement mix.',
  ],
  'punjab-d-sahiwal': [
    [76, 19, 3.4, 0.9, 0.1, 0.003, 0.597],
    'Harappa has a mixed agricultural population; Indus archaeology is not treated as a Buddhist population centre.',
  ],
};

function apportion(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map((weight) => (total * weight) / sum);
  const counts = values.map(Math.floor);
  const order = values
    .map((value, i) => ({ i, remainder: value - counts[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  for (
    let i = 0, left = total - counts.reduce((a, b) => a + b, 0);
    i < left;
    i++
  )
    counts[order[i].i]++;
  return counts;
}

// Retain the settlement model's district sizes while redistributing religious communities.
export function districtPopulationTargets(districts) {
  const targets = districts.map(() => 0);
  for (const [religion, total] of religionTotals) {
    const counts = apportion(
      total,
      districts.map((district) => {
        const weight =
          settlementWeights[district.name] ||
          Math.max(0.45, Math.min(2, district.areaKm2 / 3000));
        const east = easternDistricts.has(district.name);
        return (
          weight *
          (religion === 'Sikhism'
            ? east
              ? 0.85
              : 1.2
            : religion === 'Hinduism'
              ? east
                ? 1.8
                : 0.35
              : 1)
        );
      }),
    );
    counts.forEach((count, i) => (targets[i] += count));
  }
  return targets;
}

// Fit both margins, then round with a minimum-cost flow so no resident is lost or duplicated.
export function balancePopulation(rowTotals, columnTotals, weights) {
  if (
    !rowTotals.every((value) => Number.isSafeInteger(value) && value > 0) ||
    !columnTotals.every((value) => Number.isSafeInteger(value) && value > 0) ||
    rowTotals.reduce((a, b) => a + b, 0) !==
      columnTotals.reduce((a, b) => a + b, 0) ||
    weights.length !== rowTotals.length ||
    weights.some(
      (row) =>
        row.length !== columnTotals.length ||
        row.some((value) => !Number.isFinite(value) || value <= 0),
    )
  )
    throw Error('Invalid population margins or weights');
  const matrix = weights.map((row) => [...row]);
  let converged = false;
  for (let iteration = 0; iteration < 10000; iteration++) {
    matrix.forEach((row, i) => {
      const scale = rowTotals[i] / row.reduce((a, b) => a + b, 0);
      row.forEach((value, j) => (row[j] = value * scale));
    });
    columnTotals.forEach((total, j) => {
      const scale = total / matrix.reduce((sum, row) => sum + row[j], 0);
      matrix.forEach((row) => (row[j] *= scale));
    });
    if (
      matrix.every(
        (row, i) =>
          Math.abs(row.reduce((a, b) => a + b, 0) - rowTotals[i]) < 1e-6,
      )
    ) {
      converged = true;
      break;
    }
  }
  if (!converged) throw Error('Population balancing did not converge');
  const counts = matrix.map((row) => row.map(Math.floor));
  const rowsLeft = rowTotals.map(
    (total, i) => total - counts[i].reduce((a, b) => a + b, 0),
  );
  const columnsLeft = columnTotals.map(
    (total, j) => total - counts.reduce((sum, row) => sum + row[j], 0),
  );
  const source = rowTotals.length + columnTotals.length,
    sink = source + 1;
  const graph = Array.from({ length: sink + 1 }, () => []);
  function edge(from, to, capacity, cost) {
    const forward = { to, capacity, cost, reverse: graph[to].length };
    graph[from].push(forward);
    graph[to].push({
      to: from,
      capacity: 0,
      cost: -cost,
      reverse: graph[from].length - 1,
    });
    return forward;
  }
  rowsLeft.forEach((left, i) => edge(source, i, left, 0));
  columnsLeft.forEach((left, j) => edge(rowTotals.length + j, sink, left, 0));
  const cells = matrix.map((row, i) =>
    row.map((value, j) =>
      edge(i, rowTotals.length + j, 1, 1 - (value - counts[i][j])),
    ),
  );
  for (let left = rowsLeft.reduce((a, b) => a + b, 0); left > 0; left--) {
    const distances = graph.map(() => Infinity),
      previous = graph.map(() => null);
    distances[source] = 0;
    for (let pass = 0; pass < graph.length - 1; pass++) {
      let changed = false;
      graph.forEach((edges, from) =>
        edges.forEach((item, index) => {
          if (
            item.capacity > 0 &&
            distances[from] + item.cost < distances[item.to] - 1e-12
          ) {
            distances[item.to] = distances[from] + item.cost;
            previous[item.to] = [from, index];
            changed = true;
          }
        }),
      );
      if (!changed) break;
    }
    if (!previous[sink]) throw Error('Unable to round population margins');
    for (let to = sink; to !== source;) {
      const [from, index] = previous[to];
      const item = graph[from][index];
      item.capacity--;
      graph[to][item.reverse].capacity++;
      to = from;
    }
  }
  cells.forEach((row, i) =>
    row.forEach((item, j) => (counts[i][j] += 1 - item.capacity)),
  );
  if (
    !counts.every(
      (row, i) => row.reduce((a, b) => a + b, 0) === rowTotals[i],
    ) ||
    !columnTotals.every(
      (total, j) => counts.reduce((sum, row) => sum + row[j], 0) === total,
    )
  )
    throw Error('Rounded population margins do not reconcile');
  return counts;
}

export function allocatePunjabPopulation(districts) {
  const targets = districtPopulationTargets(districts);
  const defaults = {
    east: [72, 25, 1.7, 0.7, 0.15, 0.003, 0.447],
    west: [79, 17, 2.6, 0.7, 0.15, 0.003, 0.547],
  };
  const seeds = districts.map(
    (district) =>
      profiles[district.id]?.[0] ||
      defaults[easternDistricts.has(district.name) ? 'east' : 'west'],
  );
  const counts = balancePopulation(
    targets,
    religionTotals.map(([, total]) => total),
    seeds,
  );
  return districts.map((district, i) => ({
    total: targets[i],
    religions: religionTotals.map(([name], j) => ({
      name,
      population: counts[i][j],
    })),
    note:
      populationNote +
      ' ' +
      (profiles[district.id]?.[1] ||
        'This district follows the scenario’s regional rural and urban settlement mix.'),
  }));
}
