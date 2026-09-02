export const TEST_SET_VERSION = 'braciera-eval-v0.1'
export const BASELINE_COMMIT = '17839bf1962682ddd2e9ba68c4674e1c6bb59b30'

// Controlled source pages live in the project Drive folder `labraciera-cardapio`.
// They are intentionally not copied into the public repository. The eval runner
// refuses to use a local source page unless its SHA-256 matches this immutable map.
export const SOURCES = {
  p1: { file: 'braciera-1.webp', driveFileId: '1IgIAScjeG8Qdk1OZE9FWWbcrB-trFrq7', sha256: '6484bdc88808c74affdc1452da0d8d8d40206f0567acc23c303d41fd2c716bcc', width: 1200, height: 1697 },
  p2: { file: 'braciera-2.webp', driveFileId: '1JuXK4sk9hMv8-RQWeajRnezwj-yvGdJM', sha256: '291bc83dd8d37ec9c6cc33fb6253aaa23a04b74595850b82e5b4d73b6ec4db66', width: 1200, height: 1697 },
  p3: { file: 'braciera-3.webp', driveFileId: '1P9ySbGrENyZ6la6GIyti6FCt5cUpMVDm', sha256: 'd7f34ffbb372d84e19cfbf83b3fe7fec3a672c605ca4494f381fe10031fa7c40', width: 1200, height: 1697 },
  p4: { file: 'braciera-4.webp', driveFileId: '1wAjlt-QnFDPHfhhuDt7aCXSb92Cu7OJA', sha256: '23537e6bb17279b9f2f1eba51770149b5bd2d24d6756a079174d2e9447bf3a0b', width: 1200, height: 1697 },
  p5: { file: 'braciera-5.webp', driveFileId: '1furSNNuwDWSQx-XXzMf77Bn5X1dmHDml', sha256: '10bbfab1fb7e8740538de4570e2bf79bfc1cb71327023b0fc811ce77ad06a89e', width: 1200, height: 1697 },
  p6: { file: 'braciera-6.webp', driveFileId: '1DPWwl1BqbYX-05F17yVXNep0AekosP1x', sha256: 'f40c6d197717b7263ea223a255298d807b5c84eaa819023139fc189370c40939', width: 1200, height: 1697 },
  p7: { file: 'braciera-7.webp', driveFileId: '1c4xouMI3uOPX_Aye7p5JvIUwXKsYIl66', sha256: 'b910010776cc90727c95ca486eadb9be157994e485949a844091aead443dc917', width: 1200, height: 1697 }
}

const positive = (expectedId, sourceRef, crop, confusionGroup = null, family = 'pizza', difficulty = confusionGroup ? 'hard' : 'medium') => ({
  id: `menu-${sourceRef}-${expectedId}`,
  groundTruthFamily: family,
  expectedId,
  expectedStatus: 'success',
  sourceType: 'official_menu_crop',
  sourceRef,
  crop,
  transform: null,
  difficulty,
  lighting: 'editorial_studio',
  angle: 'top_or_light_oblique',
  confusionGroup,
  tags: ['official_menu', 'ground_truth_from_labelled_page']
})

export const CASES = [
  positive('margherita-verace', 'p1', [890, 55, 310, 415], 'margherita-red-base'),
  positive('cuore-di-napoli', 'p1', [0, 185, 335, 420]),
  positive('provola-croccante-di-parma', 'p1', [910, 500, 290, 465]),
  positive('bastarda', 'p1', [0, 665, 335, 505]),
  positive('zozzona', 'p1', [885, 1015, 315, 475], 'calabresa-charcuterie'),

  positive('margherita-burrata', 'p2', [930, 15, 270, 370], 'burrata-center'),
  positive('portuguesa', 'p2', [0, 155, 280, 410]),
  positive('porchetta', 'p2', [920, 525, 280, 460], 'parma-pork-cheese'),
  positive('quattro-formaggi', 'p2', [0, 690, 280, 430], 'white-cheese-creamy'),
  positive('pepperoni', 'p2', [915, 1095, 285, 420]),
  positive('caprese', 'p2', [0, 1210, 285, 450], 'burrata-center'),

  positive('calabresa', 'p3', [875, 15, 325, 485], 'calabresa-charcuterie'),
  positive('napoli-in-higienopolis', 'p3', [0, 180, 330, 480]),
  positive('palmito-palmeira-real', 'p3', [880, 505, 320, 465]),
  positive('casteloes', 'p3', [0, 690, 330, 475], 'calabresa-charcuterie'),
  positive('vero-parma', 'p3', [875, 980, 325, 480], 'parma-pork-cheese'),
  positive('burrata-al-pesto-e-pepperoni', 'p3', [0, 1190, 340, 507], 'burrata-center'),

  positive('mozzarella', 'p4', [890, 45, 310, 470], 'white-cheese-creamy'),
  positive('frango-com-catupiry', 'p4', [0, 285, 330, 480], 'white-cheese-creamy'),
  positive('italiana-speciale', 'p4', [875, 560, 325, 490], 'calabresa-charcuterie'),
  positive('don-barbieri', 'p4', [0, 905, 330, 480], 'parma-pork-cheese'),
  positive('burrata-al-pesto-rosso', 'p4', [865, 1110, 335, 550], 'burrata-center'),

  positive('carbonara', 'p5', [905, 40, 295, 360]),
  positive('don-antonio', 'p5', [0, 235, 250, 355]),
  positive('marinara', 'p5', [910, 560, 290, 410], 'margherita-red-base'),
  positive('zucchine-gratinate-al-parmigiano', 'p5', [0, 655, 285, 405]),
  positive('prima-di-napoli', 'p5', [0, 1090, 300, 375], 'parma-pork-cheese'),
  positive('margherita', 'p5', [910, 1180, 290, 425], 'margherita-red-base'),

  positive('delizia-rossa', 'p6', [845, 165, 355, 520], 'dolci-chocolate-pistachio', 'dolci', 'hard'),
  positive('nutella-lindt-brownie', 'p6', [0, 440, 385, 540], 'dolci-chocolate-pistachio', 'dolci', 'hard'),
  positive('pistacchio-italiano-e-nutella', 'p6', [835, 840, 365, 555], 'dolci-chocolate-pistachio', 'dolci', 'hard'),
  positive('nutella-brownie-butter-cookies', 'p6', [0, 1035, 375, 560], 'dolci-chocolate-pistachio', 'dolci', 'hard'),

  // Real catalog-OOD item: official current menu novelty not present in the baseline 36-class allowlist.
  { id: 'menu-p7-abbra-cciami-ood', groundTruthFamily: 'pizza', expectedId: null, expectedStatus: 'inconclusive', sourceType: 'official_menu_crop', sourceRef: 'p7', crop: [40, 390, 1120, 890], transform: null, difficulty: 'hard_negative', lighting: 'editorial_studio', angle: 'top_or_light_oblique', confusionGroup: 'catalog-ood-new-item', tags: ['official_menu', 'catalog_ood', 'current_new_item'] },

  // Deterministic quality regressions. These do not replace real bad-camera captures in the GO gate.
  { id: 'quality-blur-margherita-verace', groundTruthFamily: 'pizza', expectedId: null, expectedStatus: 'inconclusive', sourceType: 'derived_quality', sourceRef: 'p1', crop: [890, 55, 310, 415], transform: { blurSigma: 13 }, difficulty: 'quality_gate', lighting: 'editorial_studio', angle: 'top_or_light_oblique', confusionGroup: null, tags: ['derived', 'blur', 'quality_gate'] },
  { id: 'quality-dark-margherita-verace', groundTruthFamily: 'pizza', expectedId: null, expectedStatus: 'inconclusive', sourceType: 'derived_quality', sourceRef: 'p1', crop: [890, 55, 310, 415], transform: { brightness: 0.16 }, difficulty: 'quality_gate', lighting: 'derived_underexposed', angle: 'top_or_light_oblique', confusionGroup: null, tags: ['derived', 'underexposed', 'quality_gate'] },
  { id: 'quality-extreme-crop-margherita-verace', groundTruthFamily: 'pizza', expectedId: null, expectedStatus: 'inconclusive', sourceType: 'derived_quality', sourceRef: 'p1', crop: [890, 55, 310, 415], transform: { relativeExtract: [0, 0, 0.34, 0.34], resize: [640, 640] }, difficulty: 'quality_gate', lighting: 'editorial_studio', angle: 'extreme_crop', confusionGroup: null, tags: ['derived', 'extreme_crop', 'quality_gate'] },
  { id: 'quality-multiple-products-page3', groundTruthFamily: 'pizza', expectedId: null, expectedStatus: 'inconclusive', sourceType: 'official_menu_multi_product', sourceRef: 'p3', crop: null, transform: { fit: [800, 800] }, difficulty: 'quality_gate', lighting: 'editorial_studio', angle: 'menu_page', confusionGroup: null, tags: ['real_source', 'multiple_products', 'quality_gate'] },
  { id: 'other-chef-page7', groundTruthFamily: 'other', expectedId: null, expectedStatus: 'inconclusive', sourceType: 'official_menu_other', sourceRef: 'p7', crop: [560, 0, 560, 390], transform: null, difficulty: 'easy_negative', lighting: 'editorial_studio', angle: 'portrait', confusionGroup: null, tags: ['real_source', 'other', 'non_food'] }
]

export const PENDING_COVERAGE = [
  { family: 'calzone', reason: 'No supervised calzone photo exists in the currently accessible labraciera-cardapio Drive folder; required before GO.' },
  { expectedId: 'la-diciannove', family: 'pizza', reason: 'No labelled crop in the current seven-page supervised folder.' },
  { expectedId: 'atum', family: 'pizza', reason: 'No labelled crop in the current seven-page supervised folder.' },
  { expectedId: 'do-benja', family: 'pizza', reason: 'No labelled crop in the current seven-page supervised folder.' },
  { expectedId: 'nocciola-chocolat-du-jour', family: 'dolci', reason: 'No labelled crop in the current seven-page supervised folder; availability conflict remains.' },
  { kind: 'real_bad_camera_photo', reason: 'Derived quality regressions exist, but a genuinely bad capture from a physical device is required before GO.' }
]

export const METRIC_POLICY = {
  top1Accuracy: 'correct final top1 / positive recognition cases; inconclusive and errors are misses',
  top3Recall: 'expectedId in final top1 plus alternatives / positive recognition cases',
  acceptedAccuracy: 'correct accepted decisions / all accepted decisions; accepted negatives and wrong SKUs are errors',
  falsePositiveRate: 'accepted decisions on negative cases / all negative cases',
  wrongAcceptedRate: 'accepted wrong SKU on positive cases / positive recognition cases',
  inconclusiveRate: 'inconclusive / all non-error measured cases',
  perClassRecall: 'correct final top1 / cases for that expectedId',
  latency: 'wall-clock HTTP round-trip; report mean, p50 and p95'
}
