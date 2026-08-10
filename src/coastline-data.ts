// Accurate coastline of the Gulf of Pozzuoli (Golfo di Pozzuoli)
// One continuous polyline tracing the coast from Capo Miseno (west) to Posillipo (east)
// Based on actual geographic coordinates
export const COASTLINE_POLYLINES: [number, number][][] = [
  // Main coastline: Monte di Procida → Capo Miseno → Bacoli → Baia → Pozzuoli → Bagnoli → Posillipo
  [
    // Monte di Procida / western approach
    [40.800, 14.030], [40.797, 14.035], [40.794, 14.040], [40.791, 14.045],
    [40.789, 14.050], [40.787, 14.055], [40.786, 14.060], [40.785, 14.065],
    // Capo Miseno area
    [40.784, 14.070], [40.783, 14.075], [40.783, 14.080], [40.784, 14.085],
    [40.786, 14.089],
    // Miliscola beach toward Bacoli
    [40.789, 14.083], [40.792, 14.080], [40.795, 14.078],
    // Bacoli / Baia area - the coast curves northeast
    [40.800, 14.075], [40.804, 14.073], [40.808, 14.072],
    [40.811, 14.073], [40.813, 14.075],
    // Baia to Lucrino
    [40.815, 14.078], [40.817, 14.082], [40.818, 14.087],
    [40.819, 14.092], [40.819, 14.097],
    // Lucrino to Pozzuoli - the main town waterfront
    [40.820, 14.102], [40.821, 14.107], [40.821, 14.112],
    [40.822, 14.117], [40.822, 14.122], [40.821, 14.127],
    [40.820, 14.132],
    // Pozzuoli harbour area
    [40.819, 14.137], [40.818, 14.142], [40.817, 14.147],
    // From Pozzuoli eastward toward Arco Felice / Bagnoli
    [40.815, 14.152], [40.813, 14.157], [40.811, 14.161],
    [40.808, 14.165], [40.805, 14.168],
    // Bagnoli area
    [40.802, 14.170], [40.799, 14.172], [40.796, 14.173],
    // Nisida / Coroglio / Posillipo
    [40.794, 14.175], [40.793, 14.178], [40.792, 14.182],
    [40.793, 14.186], [40.795, 14.190], [40.798, 14.193],
    [40.801, 14.195], [40.805, 14.197], [40.809, 14.199],
    [40.813, 14.201], [40.817, 14.204], [40.821, 14.207],
    [40.825, 14.210], [40.830, 14.213], [40.835, 14.216],
    [40.840, 14.218], [40.845, 14.220],
  ],
  // Nisida island (small rocky island off Bagnoli)
  [
    [40.794, 14.168], [40.793, 14.166], [40.791, 14.166],
    [40.790, 14.168], [40.790, 14.170], [40.791, 14.172],
    [40.793, 14.172], [40.794, 14.170], [40.794, 14.168],
  ],
];
