(() => {
  const TRACKER_STORAGE_KEY = 'lando-world:lee-lees-tracker:v1';
  const TRACKER_SCHEMA_VERSION = 1;
  const PRE_IMPORT_BACKUP_PREFIX = `${TRACKER_STORAGE_KEY}:pre-import-backup:`;
  const SHARED_SYNC_MIGRATION_KEY = `${TRACKER_STORAGE_KEY}:shared-sync-migration:v1`;
  const SHARED_SYNC_MIGRATION_VERSION = 1;
  const MIN_MIGRATION_PROGRESS_MS = 450;
  const MIGRATION_MAX_RETRIES = 3;
  const MIGRATION_RETRY_BASE_MS = 600;
  const PRE_REBRAND_KEY_PREFIX = ['le', 'vi'].join('');
  const LEGACY_RECORD_STORAGE_KEYS = [
    `${PRE_REBRAND_KEY_PREFIX}_diabetes_records_v1`,
    'lee-lees-tracker',
    'leeLeesTracker',
    `${PRE_REBRAND_KEY_PREFIX}-diabetes-tracker`,
    'diabetes-tracker',
    'tracker-records',
    'glucose-records',
  ];
  const LEGACY_PLAN_STORAGE_KEYS = [
    `${PRE_REBRAND_KEY_PREFIX}_diabetes_insulin_plans_v1`,
  ];
  const EVENT_TYPE_DEFINITIONS = Object.freeze([
    { type: 'check-insulin', label: 'Check / Insulin', fields: ['bloodSugar', 'insulinUnits', 'notes'], defaultContext: 'Breakfast' },
    { type: 'meal', label: 'Meal / Carbs', fields: ['carbs', 'mealDescription', 'notes'], defaultContext: 'Breakfast' },
    { type: 'activity', label: 'Activity / Exercise', fields: ['activityDescription', 'activityDurationMinutes', 'activityIntensity', 'notes'], defaultContext: 'Exercise' },
    { type: 'note', label: 'Note', fields: ['notes'], defaultContext: 'Other' },
  ]);
  const EVENT_TYPE_CONFIG = Object.freeze(Object.fromEntries(
    EVENT_TYPE_DEFINITIONS.map((definition) => [definition.type, Object.freeze({ ...definition, fields: Object.freeze([...definition.fields]) })]),
  ));
  const MEAL_CONTEXT_TYPES = Object.freeze(['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other']);
  const ACTIVE_CHECK_CONTEXT_TYPES = Object.freeze(['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Bedtime', 'Correction']);
  const CHECK_CONTEXT_TYPES = Object.freeze(['Breakfast', 'Lunch', 'Dinner', 'Bedtime', '2 AM', 'Correction', 'Snacks', 'Snack', 'Other']);
  const SINGLE_USE_CHECK_CONTEXT_TYPES = Object.freeze(['Breakfast', 'Lunch', 'Dinner', 'Bedtime']);
  const ACTIVITY_CONTEXT_TYPES = Object.freeze(['Exercise', 'Other']);
  const NOTE_CONTEXT_TYPES = Object.freeze(['Other', 'Breakfast', 'Lunch', 'Dinner', 'Bedtime', '2 AM', 'Correction', 'Snack', 'Exercise']);
  const ACTIVITY_INTENSITY_OPTIONS = Object.freeze(['Easy', 'Moderate', 'Hard']);
  const ENTRY_TYPE_DEFINITIONS = Object.freeze([
    { type: 'Breakfast', label: 'Breakfast', clinicalLogPrimary: true, mealGuidance: true, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
    { type: 'Lunch', label: 'Lunch', clinicalLogPrimary: true, mealGuidance: true, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
    { type: 'Dinner', label: 'Dinner', clinicalLogPrimary: true, mealGuidance: true, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
    { type: 'Bedtime', label: 'Bedtime', clinicalLogPrimary: true, mealGuidance: false, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
    { type: '2 AM', label: '2 AM', clinicalLogPrimary: true, mealGuidance: false, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
    { type: 'Correction', label: 'Correction', clinicalLogPrimary: false, mealGuidance: false, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
    { type: 'Snacks', label: 'Snacks', clinicalLogPrimary: false, mealGuidance: false, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
    { type: 'Snack', label: 'Snack', clinicalLogPrimary: false, mealGuidance: false, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
    { type: 'Exercise', label: 'Exercise', clinicalLogPrimary: false, mealGuidance: false, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
    { type: 'Other', label: 'Other', clinicalLogPrimary: false, mealGuidance: false, fields: ['bloodSugar', 'insulinUnits', 'notes'] },
  ]);
  const ENTRY_TYPE_CONFIG = Object.freeze(Object.fromEntries(
    ENTRY_TYPE_DEFINITIONS.map((definition) => [definition.type, Object.freeze({ ...definition, fields: Object.freeze([...definition.fields]) })]),
  ));
  const PRIMARY_TYPES = ENTRY_TYPE_DEFINITIONS.filter((definition) => definition.clinicalLogPrimary).map((definition) => definition.type);
  const EXTRA_TYPES = ENTRY_TYPE_DEFINITIONS.map((definition) => definition.type);
  const MEAL_TYPES = ENTRY_TYPE_DEFINITIONS.filter((definition) => definition.mealGuidance).map((definition) => definition.type);
  const DEFAULT_ENTRY_TYPE = EXTRA_TYPES[0];
  const DEFAULT_EVENT_TYPE = EVENT_TYPE_DEFINITIONS[0].type;
  const TRACKER_NAV_ITEMS = Object.freeze([
    ['today', 'Today'],
    ['history', 'History'],
    ['reports', 'Reports'],
    ['export', 'Export'],
    ['foods', 'Foods'],
  ]);
  const FOOD_LIBRARY_TABS = Object.freeze([
    ['favorites', 'Favorites'],
    ['recent', 'Recent'],
    ['foods', 'My Foods'],
    ['meals', 'My Meals'],
  ]);
  const LLT_STARTER_FOODS_VERSION = 1;
  const LLT_STARTER_FOOD_SOURCE = 'reference';
  const LLT_STARTER_FOODS_CREATED_AT = '2026-08-31T00:00:00.000Z';
  const LLT_STARTER_FOODS = Object.freeze([
    { id: 'starter-banana-medium', name: 'Banana', emoji: '🍌', servingLabel: '1 medium (118 g)', carbs: 27, category: 'fruit', sourceType: 'reference', sourceName: 'USDA SNAP-Ed', sourceUrl: 'https://snaped.fns.usda.gov/seasonal-produce-guide/bananas', verificationNote: 'Generic USDA reference; actual size varies.' },
    { id: 'starter-apple-medium', name: 'Apple', emoji: '🍎', servingLabel: '1 medium (182 g)', carbs: 25, category: 'fruit', sourceType: 'reference', sourceName: 'USDA SNAP-Ed', sourceUrl: 'https://snaped.fns.usda.gov/resources/nutrition-education-materials/seasonal-produce-guide/apples', verificationNote: 'Generic USDA reference; actual size varies.' },
    { id: 'starter-milk-cup', name: 'Milk', emoji: '🥛', servingLabel: '1 cup', carbs: 12, category: 'dairy', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'CDC reference for nonfat, 1%, 2%, or whole milk; flavored milk can differ.' },
    { id: 'starter-oatmeal-half-cup', name: 'Oatmeal', emoji: '🥣', servingLabel: '1/2 cup cooked', carbs: 15, category: 'breakfast', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Plain cooked oatmeal reference; flavored packets vary.' },
    { id: 'starter-white-rice-third-cup', name: 'White Rice', emoji: '🍚', servingLabel: '1/3 cup cooked', carbs: 15, category: 'grain', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic cooked rice reference.' },
    { id: 'starter-pasta-third-cup', name: 'Pasta', emoji: '🍝', servingLabel: '1/3 cup cooked', carbs: 15, category: 'grain', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic cooked pasta reference; sauce not included.' },
    { id: 'starter-corn-half-cup', name: 'Corn', emoji: '🌽', servingLabel: '1/2 cup cooked', carbs: 15, category: 'vegetable', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference.' },
    { id: 'starter-mashed-potato-half-cup', name: 'Mashed Potatoes', emoji: '🥔', servingLabel: '1/2 cup', carbs: 15, category: 'side', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference.' },
    { id: 'starter-popcorn-three-cups', name: 'Popcorn', emoji: '🍿', servingLabel: '3 cups popped', carbs: 15, category: 'snack', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; coatings and flavors may change carbs.' },
    { id: 'starter-pretzels', name: 'Pretzels', emoji: '🥨', servingLabel: '3/4 oz', carbs: 15, category: 'snack', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; verify package serving.' },
    { id: 'starter-potato-tortilla-chips', name: 'Potato / Tortilla Chips', emoji: '🥔', servingLabel: 'about 13 chips (1 oz)', carbs: 15, category: 'snack', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; brand and chip size vary.' },
    { id: 'starter-graham-crackers', name: 'Graham Crackers', emoji: '🍪', servingLabel: '3 squares (2.5-inch)', carbs: 15, category: 'snack', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference.' },
    { id: 'starter-chicken-nuggets-six', name: 'Chicken Nuggets / Tenders', emoji: '🍗', servingLabel: '6 pieces (about 3.5 oz)', carbs: 15, category: 'meal', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; restaurant and frozen brands vary significantly.' },
    { id: 'starter-hamburger', name: 'Hamburger with Bun', emoji: '🍔', servingLabel: '1 regular burger (about 3.5 oz total)', carbs: 30, category: 'meal', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; condiments and restaurant sizes vary.' },
    { id: 'starter-grilled-chicken-sandwich', name: 'Grilled Chicken Sandwich', emoji: '🥪', servingLabel: '1 sandwich (about 7.5 oz)', carbs: 45, category: 'meal', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; restaurant products vary.' },
    { id: 'starter-french-fries-medium', name: 'French Fries', emoji: '🍟', servingLabel: '1 medium order (about 5 oz)', carbs: 45, category: 'side', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; restaurant portions vary.' },
    { id: 'starter-thin-crust-pizza', name: 'Thin-Crust Pizza', emoji: '🍕', servingLabel: '1/4 of a 12-inch pizza (5 oz)', carbs: 30, category: 'meal', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; crust, restaurant, and toppings vary.' },
    { id: 'starter-beef-bean-burrito', name: 'Beef & Bean Burrito', emoji: '🌯', servingLabel: '1 burrito (5 oz)', carbs: 45, category: 'meal', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; restaurant and frozen products vary.' },
    { id: 'starter-ice-cream-half-cup', name: 'Ice Cream', emoji: '🍨', servingLabel: '1/2 cup', carbs: 15, category: 'dessert', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic regular ice cream reference; verify brand label.' },
    { id: 'starter-sandwich-cookies-two', name: 'Sandwich Cookies', emoji: '🍪', servingLabel: '2 small cookies (about 3/4 oz)', carbs: 15, category: 'dessert', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference; branded cookies vary.' },
    { id: 'starter-cupcake-small', name: 'Frosted Cupcake', emoji: '🧁', servingLabel: '1 small (about 1.75 oz)', carbs: 30, category: 'dessert', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic reference.' },
    { id: 'starter-glazed-donut', name: 'Glazed Doughnut', emoji: '🍩', servingLabel: '1 doughnut (3.75-inch)', carbs: 30, category: 'dessert', sourceType: 'reference', sourceName: 'CDC Carb Choices', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carbohydrate-lists-starchy-foods.html', verificationNote: 'Generic yeast-type glazed doughnut reference.' },
    { id: 'starter-yellow-mustard-tbsp', name: 'Yellow Mustard', emoji: '🟡', servingLabel: '1 tablespoon', carbs: 1, category: 'condiment', sourceType: 'reference', sourceName: 'CDC Carb Counting sample menu', sourceUrl: 'https://www.cdc.gov/diabetes/healthy-eating/carb-counting-manage-blood-sugar.html', verificationNote: 'CDC sample-menu reference; exact brand values can differ.' },
  ]);
  const DATE_RANGE_OPTIONS = [
    { value: 'today', label: 'Today', days: 1 },
    { value: 'last7', label: 'Last 7 days', days: 7 },
    { value: 'last14', label: 'Last 14 days', days: 14 },
    { value: 'last30', label: 'Last 30 days', days: 30 },
    { value: 'all', label: 'All records', days: null },
    { value: 'custom', label: 'Custom range', days: null },
  ];
  const EXPORT_RANGE_OPTIONS = DATE_RANGE_OPTIONS.filter((option) => option.value !== 'all');
  const REPORT_RANGE_OPTIONS = EXPORT_RANGE_OPTIONS.filter((option) => option.value !== 'today');
  const REPORT_VIEW_ITEMS = Object.freeze([
    ['summary', 'Summary'],
    ['trends', 'Trends'],
    ['averages', 'Averages'],
    ['detailed-log', 'Detailed Log'],
  ]);
  const HISTORY_WINDOW_OPTIONS = [
    { value: '7', label: '7 Days', days: 7 },
    { value: '14', label: '14 Days', days: 14 },
    { value: '30', label: '30 Days', days: 30 },
    { value: '60', label: '60 Days', days: 60 },
    { value: 'all', label: 'All Records', days: null },
  ];
  const DEFAULT_HISTORY_WINDOW_DAYS = 30;
  const FALLBACK_DEVICE_USERS = Object.freeze(['Rolando', 'Emily', 'Levi', 'Violet', 'Unknown']);
  const SHARED_SETTINGS_SCHEMA_VERSION = 2;
  const LLT_SETTINGS_INVENTORY = Object.freeze([
    { label: 'Patient Name', key: 'settings.patientName', classification: 'SHARED' },
    { label: 'Date of Birth', key: 'settings.patientBirthDate', classification: 'SHARED' },
    { label: 'Clinic Name', key: 'settings.clinicName', classification: 'SHARED' },
    { label: 'Clinic Phone', key: 'settings.clinicPhone', classification: 'SHARED' },
    { label: 'Plan Name', key: 'insulinPlans[].name', classification: 'SHARED' },
    { label: 'Effective Date', key: 'insulinPlans[].effectiveFrom', classification: 'SHARED' },
    { label: 'Breakfast Base Dose', key: 'insulinPlans[].mealBaseUnitsByType.Breakfast', classification: 'SHARED' },
    { label: 'Lunch Base Dose', key: 'insulinPlans[].mealBaseUnitsByType.Lunch', classification: 'SHARED' },
    { label: 'Dinner Base Dose', key: 'insulinPlans[].mealBaseUnitsByType.Dinner', classification: 'SHARED' },
    { label: 'Insulin-to-Carb Ratio', key: 'insulinPlans[].insulinCarbRatioGrams', classification: 'SHARED' },
    { label: 'Bedtime Base Dose', key: 'insulinPlans[].bedtimeBaseUnits', classification: 'SHARED' },
    { label: 'Correction Table', key: 'insulinPlans[].correctionRanges', classification: 'SHARED' },
    { label: 'Plan Notes', key: 'insulinPlans[].notes', classification: 'SHARED' },
    { label: 'History Initial Window', key: 'settings.historyInitialWindowDays', classification: 'LOCAL' },
    { label: 'This device is used by', key: 'deviceIdentity', classification: 'LOCAL' },
    { label: 'Shared Sync status/diagnostics', key: 'syncStatus/sharedSyncMigrationMetadata', classification: 'LOCAL' },
    { label: 'Local Backup import/export controls', key: 'backup/import/export actions', classification: 'LOCAL' },
    { label: 'Recently Deleted controls', key: 'records[].deletedAt/deletedBy', classification: 'LOCAL' },
  ]);
  const DEFAULT_PLAN_EFFECTIVE_FROM = '2026-07-31';
  const DEFAULT_MEAL_BASE_UNITS_BY_TYPE = Object.freeze({
    Breakfast: 5,
    Lunch: 6,
    Dinner: 6,
  });
  const BEDTIME_CONTEXT_TYPE = 'Bedtime';
  const DEFAULT_BEDTIME_BASE_UNITS = 17;
  const LEGACY_BEDTIME_BASE_UNITS = 15;
  const DEFAULT_INSULIN_CARB_RATIO_GRAMS = 20;
  const SNACK_CARB_COVERAGE_THRESHOLD_GRAMS = 15;
  const HIGH_GLUCOSE_CORRECTION_RANGE = Object.freeze({ minGlucose: 550, maxGlucose: null, correctionUnits: 6 });
  const DEFAULT_INSULIN_PLAN = {
    id: 'meal_plan_2026_07_31',
    name: 'Current Meal Insulin Plan',
    effectiveFrom: DEFAULT_PLAN_EFFECTIVE_FROM,
    effectiveTo: null,
    mealBaseUnitsByType: { ...DEFAULT_MEAL_BASE_UNITS_BY_TYPE },
    mealBaseUnits: DEFAULT_MEAL_BASE_UNITS_BY_TYPE.Breakfast,
    bedtimeBaseUnits: DEFAULT_BEDTIME_BASE_UNITS,
    insulinCarbRatioGrams: DEFAULT_INSULIN_CARB_RATIO_GRAMS,
    supportedMealTypes: [...MEAL_TYPES],
    correctionRanges: [
      { minGlucose: null, maxGlucose: 174, correctionUnits: 0 },
      { minGlucose: 175, maxGlucose: 249, correctionUnits: 1 },
      { minGlucose: 250, maxGlucose: 324, correctionUnits: 2 },
      { minGlucose: 325, maxGlucose: 399, correctionUnits: 3 },
      { minGlucose: 400, maxGlucose: 474, correctionUnits: 4 },
      { minGlucose: 475, maxGlucose: 549, correctionUnits: 5 },
      { ...HIGH_GLUCOSE_CORRECTION_RANGE },
    ],
    notes: '',
    createdAt: new Date(`${DEFAULT_PLAN_EFFECTIVE_FROM}T00:00`).toISOString(),
    updatedAt: new Date(`${DEFAULT_PLAN_EFFECTIVE_FROM}T00:00`).toISOString(),
  };

  const storageAvailability = checkStorageAvailability();
  let persistenceStatus = storageAvailability.available ? 'saved' : 'unavailable';
  let persistenceMessage = storageAvailability.available
    ? 'Saved on this device'
    : 'Records are visible, but this browser is not allowing this device to save tracker data.';
  let trackerData = loadTrackerData();
  let records = trackerData.records;
  let insulinPlans = trackerData.insulinPlans;
  let foodLibrary = trackerData.foodLibrary;
  let savedMeals = trackerData.savedMeals;
  let historyFilters = {
    range: 'all',
    type: 'All',
    startDate: '',
    endDate: '',
  };
  let historyDraftFilters = { ...historyFilters };
  let historyVisibleDayCount = null;
  let historyFilterSheetOpen = false;
  let trackerMenuOpen = false;
  let lastFocusedElement = null;
  let exportOptions = {
    range: 'last7',
    layout: 'clinical',
    startDate: '',
    endDate: '',
  };
  let reportOptions = {
    range: 'last7',
    view: 'summary',
    layout: 'detailed',
    startDate: '',
    endDate: '',
  };
  let foodLibrarySearch = '';
  let savedMealsSearch = '';
  let foodLibraryMessage = '';
  let foodLibraryError = '';
  let currentEditor = null;
  let pendingCarbCalculatorFocusRowId = '';
  let pendingCarbCalculatorFocusFieldName = '';
  let pendingCarbCalculatorUsePointerId = null;
  let lastCarbCalculatorSelection = { id: '', at: 0 };
  let carbCalculatorScrollLock = null;
  let carbCalculatorViewportListenerCleanup = null;
  let syncRepository = null;
  let syncStatus = {
    configured: false,
    signedIn: false,
    deviceIdentity: '',
    pendingCount: 0,
    conflictCount: 0,
    realtimeStatus: 'idle',
    state: 'saved',
    message: 'Saved on this device',
  };
  let authMessage = '';
  let authError = '';
  let patientSettingsMessage = '';
  let patientSettingsError = '';
  let conflictSelection = new Set();
  let conflictAutoResolvedCount = 0;
  let conflictBulkState = null;
  let migrationFlow = {
    state: 'idle',
    total: 0,
    uploaded: 0,
    duplicates: 0,
    conflicts: 0,
    remaining: 0,
    startedFrom: 'home',
    error: '',
  };
  let migrationRetryTimer = null;

  function createId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function getRoot() {
    return document.getElementById('lee-lee-diabetes-root');
  }

  function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getLocalTimeKey(date = new Date()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  function formatDate(date = new Date()) {
    return new Intl.DateTimeFormat(navigator.language || undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  function formatTime(timestamp) {
    return new Intl.DateTimeFormat(navigator.language || undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  }

  function createLocalTimestamp(dateKey, timeKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return null;
    if (!/^\d{2}:\d{2}$/.test(String(timeKey || ''))) return null;
    const date = new Date(`${dateKey}T${timeKey}`);
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function createDateStartTimestamp(dateKey) {
    return createLocalTimestamp(dateKey, '00:00');
  }

  function getRecordTimestamp(record) {
    const timestamp = parseTimestamp(record?.recordTimestamp);
    if (Number.isFinite(timestamp)) return timestamp;
    const combinedTimestamp = createLocalTimestamp(record?.date, record?.time);
    if (Number.isFinite(combinedTimestamp)) return combinedTimestamp;
    const legacyTimestamp = parseTimestamp(record?.timestamp);
    return Number.isFinite(legacyTimestamp) ? legacyTimestamp : Date.now();
  }

  function clonePlanSnapshot(plan) {
    if (!plan) return null;
    return {
      id: plan.id,
      name: plan.name,
      effectiveFrom: plan.effectiveFrom,
      effectiveTo: plan.effectiveTo || null,
      mealBaseUnitsByType: getMealBaseUnitsByType(plan),
      mealBaseUnits: getMealBaseUnitsForType(plan, 'Breakfast'),
      bedtimeBaseUnits: getBedtimeBaseUnits(plan),
      bedtimeBaseUnitsMigratedTo17: plan.bedtimeBaseUnitsMigratedTo17 === true,
      insulinCarbRatioGrams: getInsulinCarbRatioGrams(plan),
      supportedMealTypes: [...plan.supportedMealTypes],
      correctionRanges: plan.correctionRanges.map((range) => ({ ...range })),
      notes: plan.notes || '',
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  function isWholePositiveGlucose(value) {
    return /^\d+$/.test(String(value || '').trim()) && Number(value) > 0;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function sanitizeNotes(value) {
    return String(value || '').replace(/\r/g, '').trim().slice(0, 500);
  }

  function normalizeNumber(value) {
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function normalizeWholeNumber(value) {
    const number = normalizeNumber(value);
    return number == null ? null : Math.round(number);
  }

  function roundToNearestHalf(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.floor(number * 2 + 0.5 + Number.EPSILON) / 2;
  }

  function sanitizeShortText(value, maxLength = 160) {
    return String(value || '').replace(/\r/g, '').trim().slice(0, maxLength);
  }

  function parseTimestamp(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) {
      const timestamp = value.getTime();
      return Number.isFinite(timestamp) ? timestamp : null;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }

  function toIsoTimestamp(value, fallback = Date.now()) {
    const timestamp = parseTimestamp(value) ?? parseTimestamp(fallback) ?? Date.now();
    return new Date(timestamp).toISOString();
  }

  function normalizeBloodSugar(value) {
    return isWholePositiveGlucose(value) ? Number(value) : null;
  }

  function getEntryTypeConfig(type) {
    return ENTRY_TYPE_CONFIG[type] || ENTRY_TYPE_CONFIG.Other;
  }

  function getEventTypeConfig(eventType) {
    return EVENT_TYPE_CONFIG[eventType] || EVENT_TYPE_CONFIG[DEFAULT_EVENT_TYPE];
  }

  function normalizeEventType(value, record = {}) {
    if (EVENT_TYPE_CONFIG[value]) return value;
    if (value === 'blood-glucose' || value === 'insulin') return 'check-insulin';
    if (record.mealCarbs != null || record.carbs != null || record.mealDescription) return 'meal';
    if (record.activityDescription || record.activityDurationMinutes != null || record.activityIntensity) return 'activity';
    if (record.administeredInsulinUnits != null || record.insulinUnits != null || record.bloodSugar != null) return 'check-insulin';
    if (record.notes) return 'note';
    return DEFAULT_EVENT_TYPE;
  }

  function getContextOptionsForEventType(eventType) {
    if (eventType === 'meal') return [...MEAL_CONTEXT_TYPES];
    if (eventType === 'check-insulin') return [...ACTIVE_CHECK_CONTEXT_TYPES];
    if (eventType === 'activity') return [...ACTIVITY_CONTEXT_TYPES];
    if (eventType === 'note') return [...NOTE_CONTEXT_TYPES];
    return [...ACTIVE_CHECK_CONTEXT_TYPES];
  }

  function normalizeRecordContext(type, eventType) {
    const options = eventType === 'check-insulin' ? CHECK_CONTEXT_TYPES : getContextOptionsForEventType(eventType);
    if (options.includes(type)) return type;
    return getEventTypeConfig(eventType).defaultContext;
  }

  function entryTypeHasField(type, fieldName) {
    return getEntryTypeConfig(type).fields.includes(fieldName);
  }

  function entryTypeUsesMealGuidance(type) {
    return getEntryTypeConfig(type).mealGuidance === true;
  }

  function entryTypeUsesDoseGuidance(type) {
    return entryTypeUsesMealGuidance(type) || ['Snacks', 'Snack', 'Correction', BEDTIME_CONTEXT_TYPE].includes(type);
  }

  function entryTypeUsesFoodCalculator(type, eventType = 'check-insulin') {
    return eventType === 'check-insulin' && ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Snack'].includes(type);
  }

  function normalizeCorrectionRange(range) {
    if (!range || typeof range !== 'object') return null;
    const minGlucose = range.minGlucose == null || range.minGlucose === ''
      ? null
      : Number(range.minGlucose);
    const maxGlucose = range.maxGlucose == null || range.maxGlucose === ''
      ? null
      : Number(range.maxGlucose);
    const correctionUnits = Number(range.correctionUnits);
    if (
      (minGlucose != null && (!Number.isInteger(minGlucose) || minGlucose < 0))
      || (maxGlucose != null && (!Number.isInteger(maxGlucose) || maxGlucose < 0))
      || !Number.isFinite(correctionUnits)
      || correctionUnits < 0
    ) {
      return null;
    }
    return { minGlucose, maxGlucose, correctionUnits };
  }

  function ensureHighGlucoseCorrectionRange(correctionRanges) {
    const ranges = Array.isArray(correctionRanges) ? correctionRanges : [];
    const hasHighGlucoseRange = ranges.some((range) => (
      (range.minGlucose == null || HIGH_GLUCOSE_CORRECTION_RANGE.minGlucose >= range.minGlucose)
      && range.maxGlucose == null
    ));
    if (hasHighGlucoseRange) return ranges;
    const finalRange = ranges[ranges.length - 1];
    if (finalRange?.maxGlucose === HIGH_GLUCOSE_CORRECTION_RANGE.minGlucose - 1) {
      return [...ranges, { ...HIGH_GLUCOSE_CORRECTION_RANGE }];
    }
    return ranges;
  }

  function getMealBaseUnitsByType(plan = {}) {
    const source = plan.mealBaseUnitsByType && typeof plan.mealBaseUnitsByType === 'object'
      ? plan.mealBaseUnitsByType
      : {};
    return Object.fromEntries(MEAL_TYPES.map((type) => [
      type,
      normalizeNumber(source[type]) ?? DEFAULT_MEAL_BASE_UNITS_BY_TYPE[type],
    ]));
  }

  function getMealBaseUnitsForType(plan, type) {
    if (!MEAL_TYPES.includes(type)) return null;
    return getMealBaseUnitsByType(plan)[type];
  }

  function getBedtimeBaseUnits(plan = {}) {
    const value = normalizeNumber(plan.bedtimeBaseUnits);
    if (value == null) return DEFAULT_BEDTIME_BASE_UNITS;
    if (value === LEGACY_BEDTIME_BASE_UNITS && plan.bedtimeBaseUnitsMigratedTo17 !== true) return DEFAULT_BEDTIME_BASE_UNITS;
    return value;
  }

  function getInsulinCarbRatioGrams(plan = {}) {
    return normalizeNumber(plan.insulinCarbRatioGrams) ?? DEFAULT_INSULIN_CARB_RATIO_GRAMS;
  }

  function normalizeFoodItem(food = {}) {
    const source = food && typeof food === 'object' ? food : {};
    const inputMode = source.inputMode === 'servings' ? 'servings' : 'direct';
    const servings = normalizeNumber(source.servings);
    const carbsPerServing = normalizeNumber(source.carbsPerServing);
    const directCarbs = normalizeNumber(source.directCarbs ?? source.calculatedCarbs);
    const calculatedCarbs = calculateFoodCarbs({ inputMode, servings, carbsPerServing, directCarbs });
    return {
      id: typeof source.id === 'string' && source.id ? source.id : createId(),
      name: sanitizeShortText(source.name, 80),
      emoji: normalizeFoodEmoji(source.emoji || source.emojiSnapshot),
      inputMode,
      servingDescription: sanitizeShortText(source.servingDescription, 80),
      servings,
      carbsPerServing,
      directCarbs,
      calculatedCarbs,
      savedFoodId: typeof source.savedFoodId === 'string' ? source.savedFoodId : '',
    };
  }

  function calculateFoodCarbs(food = {}) {
    const inputMode = food.inputMode === 'servings' ? 'servings' : 'direct';
    if (inputMode === 'servings') {
      const servings = normalizeNumber(food.servings);
      const carbsPerServing = normalizeNumber(food.carbsPerServing);
      if (servings == null || carbsPerServing == null) return null;
      return Math.round((servings * carbsPerServing) * 10) / 10;
    }
    return normalizeNumber(food.directCarbs);
  }

  function calculateTotalCarbs(foods = []) {
    return Math.round((foods || []).reduce((sum, food) => sum + (normalizeNumber(food.calculatedCarbs) ?? calculateFoodCarbs(food) ?? 0), 0) * 10) / 10;
  }

  function formatCarbAmount(value) {
    const number = normalizeNumber(value);
    if (number == null) return '';
    return String(Math.round((number + Number.EPSILON) * 100) / 100).replace(/\.0$/, '');
  }

  function normalizeQuantity(value, fallback = 1) {
    const number = normalizeNumber(value);
    if (number == null) return fallback;
    return Math.round((number + Number.EPSILON) * 100) / 100;
  }

  function normalizeFoodEmoji(value) {
    return sanitizeShortText(value, 16);
  }

  function normalizeFoodSourceType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['reference', 'user', 'verified-label'].includes(normalized)) return normalized;
    return '';
  }

  function formatFoodSourceLabel(food = {}) {
    const sourceType = normalizeFoodSourceType(food.sourceType ?? food.sourceTypeSnapshot);
    const sourceName = sanitizeShortText(food.sourceName ?? food.sourceNameSnapshot ?? food.sourceProvider, 80);
    if (sourceType === 'reference') return ['Reference', sourceName].filter(Boolean).join(' · ');
    if (sourceType === 'verified-label') return ['Verified Label', sourceName].filter(Boolean).join(' · ');
    if (sourceType === 'user') return sourceName ? `User · ${sourceName}` : '';
    return sourceName || '';
  }

  function getFoodSeedKey(food = {}) {
    return sanitizeShortText(food.seedKey ?? food.seed_key ?? food.referenceKey ?? food.reference_key, 120);
  }

  function createStableStarterFoodId(seedKey) {
    const input = `llt-starter-food:${seedKey}`;
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193;
    let h3 = 0x9e3779b9;
    let h4 = 0x85ebca6b;
    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index);
      h1 = Math.imul(h1 ^ code, 16777619);
      h2 = Math.imul(h2 ^ code, 2246822507);
      h3 = Math.imul(h3 ^ code, 3266489909);
      h4 = Math.imul(h4 ^ code, 668265263);
    }
    const hex = [h1, h2, h3, h4].map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
  }

  function normalizeFoodLibraryItem(food = {}) {
    const source = food && typeof food === 'object' ? food : {};
    const now = new Date().toISOString();
    const createdAt = toIsoTimestamp(source.createdAt || source.created_at, now);
    const updatedAt = toIsoTimestamp(source.updatedAt || source.updated_at, createdAt);
    const name = sanitizeShortText(source.name, 80);
    const carbs = normalizeNumber(source.carbs ?? source.carbGrams ?? source.carbsPerServing);
    if (!name || carbs == null) return null;
    const seedKey = getFoodSeedKey(source);
    const sourceType = normalizeFoodSourceType(source.sourceType ?? source.source_type)
      || (seedKey ? LLT_STARTER_FOOD_SOURCE : '');
    const sourceName = sanitizeShortText(source.sourceName ?? source.source_name ?? source.sourceProvider ?? source.source_provider, 80);
    return {
      id: typeof source.id === 'string' && source.id ? source.id : createId(),
      name,
      emoji: normalizeFoodEmoji(source.emoji),
      carbs,
      servingLabel: sanitizeShortText(source.servingLabel ?? source.serving_label ?? source.servingDescription, 80),
      brand: sanitizeShortText(source.brand, 80),
      notes: sanitizeNotes(source.notes),
      favorite: source.favorite === true || source.is_favorite === true,
      lastUsedAt: source.lastUsedAt || source.last_used_at || null,
      useCount: Math.max(0, Number(source.useCount ?? source.use_count ?? 0) || 0),
      category: sanitizeShortText(source.category, 40),
      sourceType,
      sourceName,
      sourceUrl: sanitizeShortText(source.sourceUrl ?? source.source_url, 240),
      verificationNote: sanitizeNotes(source.verificationNote ?? source.verification_note),
      seedKey,
      starterFoodVersion: Number(source.starterFoodVersion ?? source.starter_food_version ?? 0) || null,
      sourceProvider: sourceName || sanitizeShortText(source.sourceProvider ?? source.source_provider, 80),
      externalId: sanitizeShortText(source.externalId ?? source.external_id, 120),
      barcodeId: sanitizeShortText(source.barcodeId ?? source.barcode_id, 120),
      createdAt,
      updatedAt,
      version: Number(source.version || 1),
      enteredBy: typeof source.enteredBy === 'string' ? source.enteredBy : (typeof source.entered_by === 'string' ? source.entered_by : 'Unknown'),
      lastEditedBy: typeof source.lastEditedBy === 'string' ? source.lastEditedBy : (typeof source.last_edited_by === 'string' ? source.last_edited_by : null),
      deletedAt: source.deletedAt || source.deleted_at || null,
      deletedBy: source.deletedBy || source.deleted_by || null,
      syncStatus: source.syncStatus || 'local',
      syncError: source.syncError || '',
    };
  }

  function getFoodSnapshot(food, quantity = 1) {
    const normalized = normalizeFoodLibraryItem(food);
    if (!normalized) return null;
    const qty = normalizeQuantity(quantity);
    const carbTotal = Math.round((qty * normalized.carbs + Number.EPSILON) * 100) / 100;
    return {
      id: createId(),
      componentType: 'food',
      foodId: normalized.id,
      nameSnapshot: normalized.name,
      emojiSnapshot: normalized.emoji,
      servingLabelSnapshot: normalized.servingLabel,
      brandSnapshot: normalized.brand,
      sourceTypeSnapshot: normalized.sourceType,
      sourceNameSnapshot: normalized.sourceName,
      quantity: qty,
      carbsPerServing: normalized.carbs,
      carbTotal,
    };
  }

  function normalizeMealComponent(component = {}) {
    const source = component && typeof component === 'object' ? component : {};
    const componentType = source.componentType === 'manual' || source.type === 'manual' ? 'manual' : 'food';
    const quantity = normalizeQuantity(source.quantity ?? source.qty);
    const carbsPerServing = normalizeNumber(source.carbsPerServing ?? source.carbs ?? source.carbGrams);
    const explicitTotal = normalizeNumber(source.carbTotal ?? source.calculatedCarbs);
    if (componentType === 'manual') {
      const carbTotal = explicitTotal ?? carbsPerServing;
      if (carbTotal == null) return null;
      return {
        id: typeof source.id === 'string' && source.id ? source.id : createId(),
        componentType: 'manual',
        foodId: '',
        nameSnapshot: sanitizeShortText(source.nameSnapshot || source.name || 'Manual amount', 80) || 'Manual amount',
        emojiSnapshot: '',
        servingLabelSnapshot: '',
        brandSnapshot: '',
        sourceTypeSnapshot: '',
        sourceNameSnapshot: '',
        quantity: 1,
        carbsPerServing: carbTotal,
        carbTotal,
      };
    }
    if (carbsPerServing == null) return null;
    const carbTotal = explicitTotal ?? Math.round((quantity * carbsPerServing + Number.EPSILON) * 100) / 100;
    const nameSnapshot = sanitizeShortText(source.nameSnapshot || source.name, 80);
    if (!nameSnapshot) return null;
    return {
      id: typeof source.id === 'string' && source.id ? source.id : createId(),
      componentType: 'food',
      foodId: typeof source.foodId === 'string' ? source.foodId : (typeof source.food_id === 'string' ? source.food_id : ''),
      nameSnapshot,
      emojiSnapshot: normalizeFoodEmoji(source.emojiSnapshot || source.emoji),
      servingLabelSnapshot: sanitizeShortText(source.servingLabelSnapshot || source.servingLabel || source.serving_label, 80),
      brandSnapshot: sanitizeShortText(source.brandSnapshot || source.brand, 80),
      sourceTypeSnapshot: normalizeFoodSourceType(source.sourceTypeSnapshot || source.sourceType),
      sourceNameSnapshot: sanitizeShortText(source.sourceNameSnapshot || source.sourceName || source.sourceProvider, 80),
      quantity,
      carbsPerServing,
      carbTotal,
    };
  }

  function calculateMealComponentTotal(components = []) {
    return Math.round((components || []).reduce((sum, component) => {
      const normalized = normalizeMealComponent(component);
      return sum + (normalized?.carbTotal ?? 0);
    }, 0) * 100) / 100;
  }

  function normalizeSavedMeal(meal = {}) {
    const source = meal && typeof meal === 'object' ? meal : {};
    const now = new Date().toISOString();
    const name = sanitizeShortText(source.name, 80);
    if (!name) return null;
    const components = (Array.isArray(source.components) ? source.components : [])
      .map(normalizeMealComponent)
      .filter(Boolean);
    return {
      id: typeof source.id === 'string' && source.id ? source.id : createId(),
      name,
      components,
      favorite: source.favorite === true || source.is_favorite === true,
      totalCarbs: calculateMealComponentTotal(components),
      createdAt: toIsoTimestamp(source.createdAt || source.created_at, now),
      updatedAt: toIsoTimestamp(source.updatedAt || source.updated_at, now),
      version: Number(source.version || 1),
      enteredBy: typeof source.enteredBy === 'string' ? source.enteredBy : (typeof source.entered_by === 'string' ? source.entered_by : 'Unknown'),
      lastEditedBy: typeof source.lastEditedBy === 'string' ? source.lastEditedBy : (typeof source.last_edited_by === 'string' ? source.last_edited_by : null),
      deletedAt: source.deletedAt || source.deleted_at || null,
      deletedBy: source.deletedBy || source.deleted_by || null,
      syncStatus: source.syncStatus || 'local',
      syncError: source.syncError || '',
    };
  }

  function isLibraryItemDeleted(item) {
    return Boolean(item?.deletedAt || item?.deleted_at);
  }

  function activeFoodItems(source = trackerData.foodLibrary || []) {
    return source.map(normalizeFoodLibraryItem).filter((item) => item && !isLibraryItemDeleted(item));
  }

  function activeSavedMeals(source = trackerData.savedMeals || []) {
    return source.map(normalizeSavedMeal).filter((item) => item && !isLibraryItemDeleted(item));
  }

  function getSearchTokens(value) {
    return String(value || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  function addSearchTokenVariants(tokens) {
    const variants = new Set();
    tokens.forEach((token) => {
      variants.add(token);
      if (token.length > 3 && token.endsWith('s')) {
        variants.add(token.slice(0, -1));
      }
    });
    return variants;
  }

  function searchTextMatches(value, query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) return true;
    const normalizedValue = String(value || '').toLowerCase();
    if (normalizedValue.includes(normalizedQuery)) return true;
    const queryTokens = getSearchTokens(query);
    if (!queryTokens.length) return true;
    const valueTokens = addSearchTokenVariants(getSearchTokens(value));
    return queryTokens.every((token) => valueTokens.has(token) || (token.length > 3 && token.endsWith('s') && valueTokens.has(token.slice(0, -1))));
  }

  function searchFoodItems(foods = [], query = '') {
    return activeFoodItems(foods)
      .filter((food) => searchTextMatches([food.name, food.brand, food.servingLabel, food.sourceName, food.category].filter(Boolean).join(' '), query))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
  }

  function getRecentFoodItems(foods = []) {
    return activeFoodItems(foods)
      .filter((food) => food.lastUsedAt)
      .sort((a, b) => (parseTimestamp(b.lastUsedAt) || 0) - (parseTimestamp(a.lastUsedAt) || 0));
  }

  function createBlankCarbCalculatorRow() {
    return { id: createId(), sourceType: 'manual', qty: '1', carbs: '' };
  }

  function normalizeCarbCalculatorRow(row = {}) {
    const sourceType = row.sourceType === 'food' ? 'food' : 'manual';
    const qtyText = row.qty == null ? '' : String(row.qty);
    const carbsText = row.carbs == null ? '' : String(row.carbs);
    return {
      id: typeof row.id === 'string' && row.id ? row.id : createId(),
      sourceType,
      foodId: sourceType === 'food' && typeof row.foodId === 'string' ? row.foodId : '',
      name: sourceType === 'food' ? sanitizeShortText(row.name || row.nameSnapshot, 80) : '',
      emoji: sourceType === 'food' ? normalizeFoodEmoji(row.emoji || row.emojiSnapshot) : '',
      servingLabel: sourceType === 'food' ? sanitizeShortText(row.servingLabel || row.servingLabelSnapshot, 80) : '',
      brand: sourceType === 'food' ? sanitizeShortText(row.brand || row.brandSnapshot, 80) : '',
      sourceTypeSnapshot: sourceType === 'food' ? normalizeFoodSourceType(row.sourceTypeSnapshot || row.sourceType) : '',
      sourceNameSnapshot: sourceType === 'food' ? sanitizeShortText(row.sourceNameSnapshot || row.sourceName || row.sourceProvider, 80) : '',
      qty: qtyText,
      carbs: carbsText,
    };
  }

  function getCarbRowDataSelector(rowId) {
    return String(rowId ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function getCarbRowSelector(rowId) {
    return `[data-carb-row-id="${getCarbRowDataSelector(rowId)}"]`;
  }

  function isCarbCalculatorRowStarted(row = {}) {
    return String(row.carbs ?? '').trim() !== '' || !['', '1'].includes(String(row.qty ?? '').trim());
  }

  function calculateCarbCalculatorRowTotal(row = {}) {
    const qty = normalizeNumber(row.qty);
    const carbs = normalizeNumber(row.carbs);
    if (qty == null || carbs == null || String(row.qty ?? '').trim() === '' || String(row.carbs ?? '').trim() === '') return null;
    return Math.round((qty * carbs + Number.EPSILON) * 100) / 100;
  }

  function normalizeCarbCalculatorRows(rows = []) {
    const normalized = (Array.isArray(rows) ? rows : []).map(normalizeCarbCalculatorRow);
    const activeRows = dedupeDuplicateFoodRows(normalized.filter(isCarbCalculatorRowStarted));
    return [...activeRows, createBlankCarbCalculatorRow()];
  }

  function normalizeCarbCalculatorRowsForEditing(rows = [], preserveRowId = '') {
    const normalized = (Array.isArray(rows) ? rows : []).map(normalizeCarbCalculatorRow);
    const editableRows = dedupeDuplicateFoodRows(normalized.filter((row) => isCarbCalculatorRowStarted(row) || row.id === preserveRowId));
    if (!editableRows.some((row) => !isCarbCalculatorRowStarted(row))) {
      editableRows.push(createBlankCarbCalculatorRow());
    }
    return editableRows.length ? editableRows : [createBlankCarbCalculatorRow()];
  }

  function dedupeDuplicateFoodRows(rows = []) {
    const seenFoodIds = new Set();
    return rows.filter((row) => {
      if (row.sourceType !== 'food' || !row.foodId) {
        return true;
      }
      if (seenFoodIds.has(row.foodId)) {
        return false;
      }
      seenFoodIds.add(row.foodId);
      return true;
    });
  }

  function calculateCarbCalculatorMealTotal(rows = []) {
    return Math.round((rows || []).reduce((sum, row) => sum + (calculateCarbCalculatorRowTotal(row) ?? 0), 0) * 100) / 100;
  }

  function hasValidCarbCalculatorTotal(rows = []) {
    return (rows || []).some((row) => calculateCarbCalculatorRowTotal(row) != null && isCarbCalculatorRowStarted(row));
  }

  function buildMealComponentsFromCarbCalculatorRows(rows = []) {
    return normalizeCarbCalculatorRows(rows)
      .filter(isCarbCalculatorRowStarted)
      .map((row) => {
        const total = calculateCarbCalculatorRowTotal(row);
        if (total == null) return null;
        if (row.sourceType === 'food') {
          return normalizeMealComponent({
            componentType: 'food',
            foodId: row.foodId,
            nameSnapshot: row.name,
            emojiSnapshot: row.emoji,
            servingLabelSnapshot: row.servingLabel,
            brandSnapshot: row.brand,
            sourceTypeSnapshot: row.sourceTypeSnapshot,
            sourceNameSnapshot: row.sourceNameSnapshot,
            quantity: row.qty,
            carbsPerServing: row.carbs,
            carbTotal: total,
          });
        }
        return normalizeMealComponent({
          componentType: 'manual',
          nameSnapshot: 'Manual amount',
          carbTotal: total,
        });
      })
      .filter(Boolean);
  }

  function mergeCarbCalculatorRows(rows = [], incomingRows = []) {
    const merged = normalizeCarbCalculatorRows(rows).filter(isCarbCalculatorRowStarted);
    normalizeCarbCalculatorRows(incomingRows).filter(isCarbCalculatorRowStarted).forEach((incoming) => {
      const existing = incoming.sourceType === 'food' && incoming.foodId
        ? merged.find((row) => row.sourceType === 'food' && row.foodId === incoming.foodId)
        : null;
      if (existing) {
        existing.qty = formatCarbAmount(normalizeQuantity(existing.qty, 0) + normalizeQuantity(incoming.qty, 0));
      } else {
        merged.push({ ...incoming, id: incoming.id || createId() });
      }
    });
    return normalizeCarbCalculatorRows(merged);
  }

  function carbRowsFromMealComponents(components = []) {
    const rows = (Array.isArray(components) ? components : [])
      .map(normalizeMealComponent)
      .filter(Boolean)
      .map((component) => ({
        id: createId(),
        sourceType: component.componentType === 'food' ? 'food' : 'manual',
        foodId: component.foodId || '',
        name: component.nameSnapshot || '',
        emoji: component.emojiSnapshot || '',
        servingLabel: component.servingLabelSnapshot || '',
        brand: component.brandSnapshot || '',
        sourceTypeSnapshot: component.sourceTypeSnapshot || '',
        sourceNameSnapshot: component.sourceNameSnapshot || '',
        qty: component.componentType === 'food' ? formatCarbAmount(component.quantity) : '1',
        carbs: component.componentType === 'food' ? formatCarbAmount(component.carbsPerServing) : formatCarbAmount(component.carbTotal),
      }));
    return normalizeCarbCalculatorRows(rows);
  }

  function carbRowFromFood(food) {
    const normalized = normalizeFoodLibraryItem(food);
    if (!normalized) return null;
    return normalizeCarbCalculatorRow({
      id: createId(),
      sourceType: 'food',
      foodId: normalized.id,
      name: normalized.name,
      emoji: normalized.emoji,
      servingLabel: normalized.servingLabel,
      brand: normalized.brand,
      sourceTypeSnapshot: normalized.sourceType,
      sourceNameSnapshot: normalized.sourceName,
      qty: '1',
      carbs: formatCarbAmount(normalized.carbs),
    });
  }

  function getCorrectionDose({ bloodSugar, insulinPlan }) {
    const glucoseText = String(bloodSugar ?? '').trim();
    if (!isWholePositiveGlucose(glucoseText)) {
      return {
        status: 'unavailable',
        correctionUnits: null,
        matchedRange: null,
        message: 'Enter a positive whole-number blood sugar to see correction guidance.',
      };
    }
    const glucose = Number(glucoseText);
    const matches = (insulinPlan?.correctionRanges || []).filter((range) => {
      const aboveMinimum = range.minGlucose == null || glucose >= range.minGlucose;
      const belowMaximum = range.maxGlucose == null || glucose <= range.maxGlucose;
      return aboveMinimum && belowMaximum;
    });
    if (matches.length !== 1) {
      return {
        status: 'outside-configured-range',
        correctionUnits: null,
        matchedRange: null,
        message: 'Reading is outside the configured correction table.',
      };
    }
    return {
      status: 'calculated',
      correctionUnits: Number(matches[0].correctionUnits),
      matchedRange: { ...matches[0] },
      message: '',
    };
  }

  function calculateCarbDose(totalCarbs, ratioGrams = DEFAULT_INSULIN_CARB_RATIO_GRAMS) {
    const carbs = normalizeNumber(totalCarbs) ?? 0;
    const ratio = normalizeNumber(ratioGrams);
    if (!ratio || ratio <= 0) {
      return {
        status: 'unavailable',
        totalCarbs: carbs,
        insulinCarbRatioGrams: ratio,
        rawCarbDose: null,
        roundedCarbDose: null,
        message: 'Insulin-to-carb ratio must be greater than zero.',
      };
    }
    const rawCarbDose = carbs / ratio;
    return {
      status: 'calculated',
      totalCarbs: carbs,
      insulinCarbRatioGrams: ratio,
      rawCarbDose,
      roundedCarbDose: roundToNearestHalf(rawCarbDose),
      message: '',
    };
  }

  function calculateMealSuggestedDose({ bloodSugar, totalCarbs, insulinPlan }) {
    const carbDose = calculateCarbDose(totalCarbs, getInsulinCarbRatioGrams(insulinPlan));
    const correction = getCorrectionDose({ bloodSugar, insulinPlan });
    if (carbDose.status !== 'calculated' || correction.status !== 'calculated') {
      return {
        status: correction.status === 'outside-configured-range' ? correction.status : 'unavailable',
        ...carbDose,
        correctionUnits: correction.correctionUnits,
        suggestedTotalUnits: null,
        matchedRange: correction.matchedRange,
        message: correction.message || carbDose.message,
      };
    }
    return {
      status: 'calculated',
      ...carbDose,
      correctionUnits: correction.correctionUnits,
      suggestedTotalUnits: carbDose.roundedCarbDose + correction.correctionUnits,
      matchedRange: correction.matchedRange,
      message: 'Based on the current clinician-provided insulin plan. Confirm the dose before giving insulin.',
    };
  }

  function calculateSnackSuggestedDose({ totalCarbs, insulinPlan }) {
    const carbs = normalizeNumber(totalCarbs) ?? 0;
    if (carbs <= SNACK_CARB_COVERAGE_THRESHOLD_GRAMS) {
      return {
        status: 'calculated',
        totalCarbs: carbs,
        insulinCarbRatioGrams: getInsulinCarbRatioGrams(insulinPlan),
        rawCarbDose: 0,
        roundedCarbDose: 0,
        correctionUnits: null,
        suggestedTotalUnits: 0,
        matchedRange: null,
        message: 'No fast-acting carb dose is suggested for snacks at 15 g carbs or less.',
      };
    }
    const carbDose = calculateCarbDose(carbs, getInsulinCarbRatioGrams(insulinPlan));
    return {
      status: carbDose.status,
      ...carbDose,
      correctionUnits: null,
      suggestedTotalUnits: carbDose.roundedCarbDose,
      matchedRange: null,
      message: carbDose.message || 'Snack carb coverage only. Correction insulin is logged separately.',
    };
  }

  function normalizeInsulinPlan(plan) {
    if (!plan || typeof plan !== 'object') return null;
    const effectiveFrom = /^\d{4}-\d{2}-\d{2}$/.test(String(plan.effectiveFrom || ''))
      ? plan.effectiveFrom
      : DEFAULT_PLAN_EFFECTIVE_FROM;
    const effectiveTo = /^\d{4}-\d{2}-\d{2}$/.test(String(plan.effectiveTo || ''))
      ? plan.effectiveTo
      : null;
    const correctionRanges = Array.isArray(plan.correctionRanges)
      ? plan.correctionRanges.map(normalizeCorrectionRange).filter(Boolean)
      : [];
    const normalizedCorrectionRanges = ensureHighGlucoseCorrectionRange(correctionRanges);
    const supportedMealTypes = Array.isArray(plan.supportedMealTypes)
      ? plan.supportedMealTypes.filter((type) => MEAL_TYPES.includes(type))
      : [...MEAL_TYPES];
    const mealBaseUnitsByType = getMealBaseUnitsByType(plan);
    const nowTimestamp = new Date().toISOString();
    return {
      ...plan,
      id: typeof plan.id === 'string' ? plan.id : createId(),
      name: String(plan.name || DEFAULT_INSULIN_PLAN.name).trim().slice(0, 80),
      effectiveFrom,
      effectiveTo,
      mealBaseUnitsByType,
      mealBaseUnits: mealBaseUnitsByType.Breakfast,
      bedtimeBaseUnits: getBedtimeBaseUnits(plan),
      bedtimeBaseUnitsMigratedTo17: plan.bedtimeBaseUnitsMigratedTo17 === true || normalizeNumber(plan.bedtimeBaseUnits) === LEGACY_BEDTIME_BASE_UNITS,
      insulinCarbRatioGrams: getInsulinCarbRatioGrams(plan),
      supportedMealTypes: supportedMealTypes.length ? supportedMealTypes : [...MEAL_TYPES],
      correctionRanges: normalizedCorrectionRanges.length ? normalizedCorrectionRanges : DEFAULT_INSULIN_PLAN.correctionRanges.map((range) => ({ ...range })),
      notes: sanitizeNotes(plan.notes),
      createdAt: toIsoTimestamp(plan.createdAt, nowTimestamp),
      updatedAt: toIsoTimestamp(plan.updatedAt, nowTimestamp),
    };
  }

  function createSharedInsulinPlanSnapshot(plan = getCurrentPlan()) {
    return clonePlanSnapshot(normalizeInsulinPlan(plan || DEFAULT_INSULIN_PLAN));
  }

  function createSharedSettingsSnapshot({ plan = getCurrentPlan(), settings = trackerData.settings || {}, version = syncRepository?.getSharedSettings?.()?.version || null } = {}) {
    return {
      schemaVersion: SHARED_SETTINGS_SCHEMA_VERSION,
      patientName: String(settings.patientName || '').trim().slice(0, 80),
      patientBirthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(settings.patientBirthDate || '')) ? settings.patientBirthDate : '',
      clinicName: String(settings.clinicName || '').trim().slice(0, 120),
      clinicPhone: String(settings.clinicPhone || '').trim().slice(0, 40),
      insulinPlan: createSharedInsulinPlanSnapshot(plan),
      version,
    };
  }

  function mergeSharedInsulinPlan(current, sharedPlan) {
    const normalizedPlan = normalizeInsulinPlan(sharedPlan || DEFAULT_INSULIN_PLAN);
    if (!normalizedPlan) return current;
    const nextPlans = (current.insulinPlans || []).map((plan) => (
      plan.id === normalizedPlan.id ? normalizedPlan : plan
    ));
    if (!nextPlans.some((plan) => plan.id === normalizedPlan.id)) {
      nextPlans.push(normalizedPlan);
    }
    return {
      ...current,
      insulinPlans: dedupePlans(nextPlans),
      activeInsulinPlanId: normalizedPlan.id,
    };
  }

  function applySharedSettingsToDocument(current, settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    return mergeSharedInsulinPlan({
      ...current,
      settings: {
        ...(current.settings || {}),
        patientName: source.patientName || '',
        patientBirthDate: source.patientBirthDate || '',
        clinicName: source.clinicName || '',
        clinicPhone: source.clinicPhone || '',
      },
    }, source.insulinPlan || DEFAULT_INSULIN_PLAN);
  }

  function normalizeDoseStatus(value) {
    return [
      'calculated',
      'unsupported-entry-type',
      'outside-configured-range',
      'manual',
      'unavailable',
    ].includes(value) ? value : 'manual';
  }

  function normalizeRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const legacyTimestamp = parseTimestamp(record.timestamp);
    const combinedTimestamp = createLocalTimestamp(record.date, record.time);
    const fallbackTimestamp = Number.isFinite(legacyTimestamp)
      ? legacyTimestamp
      : (combinedTimestamp || Date.now());
    const rawRecordTimestamp = parseTimestamp(record.recordTimestamp);
    const recordTimestamp = Number.isFinite(rawRecordTimestamp) ? rawRecordTimestamp : fallbackTimestamp;
    const rawCreatedAt = parseTimestamp(record.createdAt);
    const rawUpdatedAt = parseTimestamp(record.updatedAt);
    const eventType = normalizeEventType(record.eventType, record);
    const type = normalizeRecordContext(EXTRA_TYPES.includes(record.type) ? record.type : 'Other', eventType);
    const recordDate = new Date(recordTimestamp);
    const date = getLocalDateKey(recordDate);
    const time = getLocalTimeKey(recordDate);
    const administeredInsulinUnits = normalizeNumber(record.administeredInsulinUnits ?? record.insulinUnits);
    const mealComponentsSource = Array.isArray(record.mealComponents)
      ? record.mealComponents
      : (Array.isArray(record.carbComponents) ? record.carbComponents : []);
    const mealComponents = mealComponentsSource.map(normalizeMealComponent).filter(Boolean);
    const foods = Array.isArray(record.foods) ? record.foods.map(normalizeFoodItem).filter(Boolean) : [];
    const mealCarbs = normalizeNumber(record.mealCarbs ?? record.totalCarbs ?? record.carbs)
      ?? (mealComponents.length ? calculateMealComponentTotal(mealComponents) : null)
      ?? (foods.length ? calculateTotalCarbs(foods) : null);
    const activityDurationMinutes = normalizeWholeNumber(record.activityDurationMinutes);
    const activityIntensity = ACTIVITY_INTENSITY_OPTIONS.includes(record.activityIntensity) ? record.activityIntensity : '';
    return {
      ...record,
      id: typeof record.id === 'string' ? record.id : createId(),
      date,
      time,
      eventType,
      type,
      bloodSugar: normalizeBloodSugar(record.bloodSugar),
      insulinUnits: administeredInsulinUnits,
      administeredInsulinUnits,
      mealCarbs,
      foods,
      mealComponents,
      carbComponents: mealComponents,
      totalCarbs: mealCarbs,
      mealDescription: sanitizeShortText(record.mealDescription, 180),
      activityDescription: sanitizeShortText(record.activityDescription, 120),
      activityDurationMinutes,
      activityIntensity,
      suggestedBaseUnits: normalizeNumber(record.suggestedBaseUnits),
      suggestedCarbDoseUnits: normalizeNumber(record.suggestedCarbDoseUnits ?? record.carbDoseUnits ?? record.roundedCarbDose),
      rawCarbDose: normalizeNumber(record.rawCarbDose),
      insulinCarbRatioGrams: normalizeNumber(record.insulinCarbRatioGrams),
      suggestedCorrectionUnits: normalizeNumber(record.suggestedCorrectionUnits),
      suggestedTotalUnits: normalizeNumber(record.suggestedTotalUnits),
      insulinPlanId: typeof record.insulinPlanId === 'string' ? record.insulinPlanId : null,
      insulinPlanSnapshot: record.insulinPlanSnapshot && typeof record.insulinPlanSnapshot === 'object'
        ? clonePlanSnapshot(normalizeInsulinPlan(record.insulinPlanSnapshot))
        : null,
      doseCalculationStatus: normalizeDoseStatus(record.doseCalculationStatus),
      notes: sanitizeNotes(record.notes),
      recordTimestamp: toIsoTimestamp(recordTimestamp, fallbackTimestamp),
      createdAt: toIsoTimestamp(rawCreatedAt, fallbackTimestamp),
      updatedAt: toIsoTimestamp(rawUpdatedAt, fallbackTimestamp),
      version: Number(record.version || 1),
      enteredBy: typeof record.enteredBy === 'string' ? record.enteredBy : (typeof record.entered_by === 'string' ? record.entered_by : 'Unknown'),
      lastEditedBy: typeof record.lastEditedBy === 'string' ? record.lastEditedBy : (typeof record.last_edited_by === 'string' ? record.last_edited_by : null),
      deletedAt: record.deletedAt || record.deleted_at || null,
      deletedBy: record.deletedBy || record.deleted_by || null,
      source: typeof record.source === 'string' ? record.source : 'app',
      clientCreatedAt: toIsoTimestamp(record.clientCreatedAt || record.client_created_at || rawCreatedAt, fallbackTimestamp),
      migrationFingerprint: record.migrationFingerprint || record.migration_fingerprint || null,
      importFingerprint: record.importFingerprint || record.import_fingerprint || null,
      appSchemaVersion: Number(record.appSchemaVersion || record.app_schema_version || TRACKER_SCHEMA_VERSION),
      syncStatus: record.syncStatus || 'local',
      syncError: record.syncError || '',
    };
  }

  function checkStorageAvailability() {
    const testKey = `${TRACKER_STORAGE_KEY}:storage-test`;
    try {
      localStorage.setItem(testKey, 'ok');
      const available = localStorage.getItem(testKey) === 'ok';
      localStorage.removeItem(testKey);
      return { available };
    } catch (error) {
      return { available: false };
    }
  }

  function readStoredJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { exists: false, data: null };
      return { exists: true, data: JSON.parse(raw), raw };
    } catch (error) {
      console.warn(`Lee-Lee’s Tracker could not parse stored data for key ${key}.`);
      return { exists: true, data: null, raw: localStorage.getItem(key), error };
    }
  }

  function getSharedSyncMigrationMetadata() {
    const stored = readStoredJson(SHARED_SYNC_MIGRATION_KEY);
    const source = stored.data && typeof stored.data === 'object' ? stored.data : {};
    return {
      migrationCompleted: source.migrationCompleted === true,
      migrationCompletedAt: typeof source.migrationCompletedAt === 'string' ? source.migrationCompletedAt : null,
      migrationVersion: Number(source.migrationVersion || 0) || null,
      recordsMigrated: Number(source.recordsMigrated || 0) || 0,
      promptDismissed: source.promptDismissed === true,
      promptDismissedAt: typeof source.promptDismissedAt === 'string' ? source.promptDismissedAt : null,
      welcomeShown: source.welcomeShown === true,
      welcomeShownAt: typeof source.welcomeShownAt === 'string' ? source.welcomeShownAt : null,
      session: source.session && typeof source.session === 'object' ? source.session : null,
    };
  }

  function saveSharedSyncMigrationMetadata(patch) {
    if (!storageAvailability.available) return false;
    const nextMetadata = {
      ...getSharedSyncMigrationMetadata(),
      ...patch,
    };
    try {
      localStorage.setItem(SHARED_SYNC_MIGRATION_KEY, JSON.stringify(nextMetadata));
      return true;
    } catch (error) {
      console.warn('Lee-Lee’s Tracker migration metadata could not be saved on this device.');
      return false;
    }
  }

  function createMigrationFingerprint(record) {
    return record.migrationFingerprint || [
      record.recordTimestamp,
      record.eventType || '',
      record.type,
      record.bloodSugar ?? '',
      record.insulinUnits ?? '',
      record.mealCarbs ?? '',
      record.mealDescription || '',
      record.activityDescription || '',
      record.activityDurationMinutes ?? '',
      record.activityIntensity || '',
      record.notes || '',
    ].join('|');
  }

  function createMigrationSessionKey(record) {
    return `${record.id || 'record'}::${createMigrationFingerprint(record)}`;
  }

  function createMigrationSession(recordsToMigrate) {
    const now = new Date().toISOString();
    const sourceRecordIds = recordsToMigrate.map((record) => record.id);
    const sourceFingerprints = recordsToMigrate.map(createMigrationSessionKey);
    return {
      migrationId: createId(),
      migrationVersion: SHARED_SYNC_MIGRATION_VERSION,
      status: 'running',
      originalTotal: sourceFingerprints.length,
      sourceRecordIds,
      sourceFingerprints,
      completedFingerprints: [],
      uploadedFingerprints: [],
      alreadyExistingFingerprints: [],
      duplicateFingerprints: [],
      conflictFingerprints: [],
      failedFingerprints: [],
      pendingFingerprints: [...sourceFingerprints],
      startedAt: now,
      lastProgressAt: now,
      lastAttemptAt: now,
      completedAt: null,
      retryCount: 0,
      lastErrorCategory: '',
      lastErrorMessage: '',
    };
  }

  function getMigrationSession() {
    return getSharedSyncMigrationMetadata().session;
  }

  function saveMigrationSession(session) {
    saveSharedSyncMigrationMetadata({ session });
    return session;
  }

  function uniquePush(list, value) {
    return list.includes(value) ? list : [...list, value];
  }

  function removeValue(list, value) {
    return list.filter((item) => item !== value);
  }

  function markMigrationOutcome(session, fingerprint, outcome, patch = {}) {
    const now = new Date().toISOString();
    const nextSession = {
      ...session,
      lastProgressAt: now,
      pendingFingerprints: removeValue(session.pendingFingerprints || [], fingerprint),
      failedFingerprints: removeValue(session.failedFingerprints || [], fingerprint),
      lastErrorCategory: '',
      lastErrorMessage: '',
      ...patch,
    };
    if (['uploaded', 'already-existing', 'duplicate', 'conflict'].includes(outcome)) {
      nextSession.completedFingerprints = uniquePush(session.completedFingerprints || [], fingerprint);
    }
    if (outcome === 'uploaded') nextSession.uploadedFingerprints = uniquePush(session.uploadedFingerprints || [], fingerprint);
    if (outcome === 'already-existing') nextSession.alreadyExistingFingerprints = uniquePush(session.alreadyExistingFingerprints || [], fingerprint);
    if (outcome === 'duplicate') nextSession.duplicateFingerprints = uniquePush(session.duplicateFingerprints || [], fingerprint);
    if (outcome === 'conflict') nextSession.conflictFingerprints = uniquePush(session.conflictFingerprints || [], fingerprint);
    if (outcome === 'failed') {
      nextSession.failedFingerprints = uniquePush(session.failedFingerprints || [], fingerprint);
      nextSession.pendingFingerprints = removeValue(session.pendingFingerprints || [], fingerprint);
    }
    return saveMigrationSession(nextSession);
  }

  function getMigrationSessionSummary(session = getMigrationSession()) {
    const uploaded = session?.uploadedFingerprints?.length || 0;
    const alreadyExisting = session?.alreadyExistingFingerprints?.length || 0;
    const duplicates = session?.duplicateFingerprints?.length || 0;
    const conflicts = session?.conflictFingerprints?.length || 0;
    const failed = session?.failedFingerprints?.length || 0;
    const processed = uploaded + alreadyExisting + duplicates + conflicts;
    const total = session?.originalTotal || 0;
    return {
      uploaded,
      alreadyExisting,
      duplicates,
      conflicts,
      failed,
      processed,
      total,
      remaining: Math.max(0, total - processed - failed),
      percent: total ? Math.round((processed / total) * 100) : 0,
    };
  }

  function classifyMigrationError(error) {
    const message = String(error?.message || error || '').toLowerCase();
    if (navigator.onLine === false) return { category: 'offline', userMessage: 'Migration paused — you’re offline.' };
    if (message.includes('jwt') || message.includes('auth') || message.includes('sign')) return { category: 'authentication', userMessage: 'Please sign in again to continue migration.' };
    if (message.includes('rls') || message.includes('permission') || message.includes('authorization')) return { category: 'authorization', userMessage: 'Migration needs attention.' };
    if (message.includes('validation') || message.includes('invalid') || message.includes('constraint')) return { category: 'validation', userMessage: 'Migration needs attention.' };
    if (message.includes('timeout')) return { category: 'timeout', userMessage: 'Connection is slow. Retrying automatically…' };
    if (message.includes('rate')) return { category: 'rate-limited', userMessage: 'Shared Sync is temporarily unavailable. We’ll retry automatically.' };
    return { category: 'retryable-network', userMessage: 'Connection is slow. Retrying automatically…' };
  }

  function getMigrationRecordsForSession(session, allRecords) {
    const byFingerprint = new Map(allRecords.map((record) => [createMigrationSessionKey(record), record]));
    return (session?.sourceFingerprints || [])
      .filter((fingerprint) => (session.pendingFingerprints || []).includes(fingerprint))
      .map((fingerprint) => byFingerprint.get(fingerprint))
      .filter(Boolean);
  }

  function getLocalSharedSettings() {
    return createSharedSettingsSnapshot();
  }

  function sharedSettingsHaveValues(settings = getLocalSharedSettings()) {
    return syncRepository?.sharedSettingsHaveValues?.(settings)
      || Boolean(settings.patientName || settings.patientBirthDate || settings.clinicName || settings.clinicPhone);
  }

  function applySharedSettingsToLocal(settings) {
    if (!settings) return;
    updateTrackerData((current) => applySharedSettingsToDocument(current, settings));
  }

  function getSharedSettingsStatus() {
    return syncRepository?.getSharedSettingsStatus?.() || {
      state: 'local',
      message: 'Patient and clinic information is saved on this device.',
      hasRemote: false,
      conflictCount: 0,
      pendingCount: 0,
      migration: {},
    };
  }

  function shouldShowSharedSettingsMigrationPrompt() {
    const status = getSharedSettingsStatus();
    const migration = status.migration || {};
    return shouldShowProtectedApp()
      && sharedSettingsHaveValues()
      && !status.hasRemote
      && !migration.completed
      && !migration.dismissedAt;
  }

  function createEmptyTrackerData(createdAt = new Date().toISOString()) {
    return {
      schemaVersion: TRACKER_SCHEMA_VERSION,
      records: [],
      foodLibrary: [],
      savedMeals: [],
      settings: {},
      insulinPlans: [clonePlanSnapshot(DEFAULT_INSULIN_PLAN)],
      activeInsulinPlanId: DEFAULT_INSULIN_PLAN.id,
      recovery: {
        malformedRecords: [],
        malformedPlans: [],
      },
      metadata: {
        createdAt,
        updatedAt: createdAt,
      },
    };
  }

  function normalizeTrackerDataDocument(data) {
    const now = new Date().toISOString();
    const source = data && typeof data === 'object' ? data : {};
    const recovery = source.recovery && typeof source.recovery === 'object'
      ? {
        malformedRecords: Array.isArray(source.recovery.malformedRecords) ? [...source.recovery.malformedRecords] : [],
        malformedPlans: Array.isArray(source.recovery.malformedPlans) ? [...source.recovery.malformedPlans] : [],
      }
      : { malformedRecords: [], malformedPlans: [] };
    const recordsSource = Array.isArray(source.records) ? source.records : [];
    const foodsSource = Array.isArray(source.foodLibrary) ? source.foodLibrary : [];
    const savedMealsSource = Array.isArray(source.savedMeals) ? source.savedMeals : [];
    const plansSource = Array.isArray(source.insulinPlans) ? source.insulinPlans : [];
    const normalizedRecords = [];
    const normalizedFoodLibrary = [];
    const normalizedSavedMeals = [];
    const normalizedPlans = [];
    recordsSource.forEach((record, index) => {
      const normalized = normalizeRecord(record);
      if (normalized) {
        normalizedRecords.push(normalized);
      } else {
        recovery.malformedRecords.push({ index, value: record, recoveredAt: now });
      }
    });
    plansSource.forEach((plan, index) => {
      const normalized = normalizeInsulinPlan(plan);
      if (normalized) {
        normalizedPlans.push(normalized);
      } else {
        recovery.malformedPlans.push({ index, value: plan, recoveredAt: now });
      }
    });
    foodsSource.forEach((food) => {
      const normalized = normalizeFoodLibraryItem(food);
      if (normalized) normalizedFoodLibrary.push(normalized);
    });
    savedMealsSource.forEach((meal) => {
      const normalized = normalizeSavedMeal(meal);
      if (normalized) normalizedSavedMeals.push(normalized);
    });
    const plans = normalizedPlans.length ? normalizedPlans : [clonePlanSnapshot(DEFAULT_INSULIN_PLAN)];
    const normalizedData = {
      ...source,
      schemaVersion: TRACKER_SCHEMA_VERSION,
      records: dedupeRecords(normalizedRecords),
      foodLibrary: dedupeLibraryItems(normalizedFoodLibrary),
      savedMeals: dedupeLibraryItems(normalizedSavedMeals),
      settings: source.settings && typeof source.settings === 'object' ? { ...source.settings } : {},
      insulinPlans: dedupePlans(plans),
      activeInsulinPlanId: typeof source.activeInsulinPlanId === 'string'
        ? source.activeInsulinPlanId
        : plans[0]?.id || null,
      recovery,
      metadata: {
        ...(source.metadata && typeof source.metadata === 'object' ? source.metadata : {}),
        createdAt: toIsoTimestamp(source.metadata?.createdAt, now),
        updatedAt: toIsoTimestamp(source.metadata?.updatedAt, now),
      },
    };
    return seedStarterFoodsInDocument(normalizedData).data;
  }

  function getRecordIdentity(record) {
    if (record.id) return `id:${record.id}`;
    return [
      'composite',
      record.recordTimestamp,
      record.type,
      record.bloodSugar ?? '',
      record.insulinUnits ?? '',
      record.createdAt ?? '',
    ].join('|');
  }

  function dedupeRecords(sourceRecords) {
    const byIdentity = new Map();
    sourceRecords.forEach((record) => {
      const key = getRecordIdentity(record);
      const existing = byIdentity.get(key);
      if (!existing || getRecordTimestamp(record) >= getRecordTimestamp(existing)) {
        byIdentity.set(key, record);
      }
    });
    return [...byIdentity.values()];
  }

  function dedupePlans(sourcePlans) {
    const byId = new Map();
    sourcePlans.forEach((plan) => {
      const existing = byId.get(plan.id);
      const existingUpdatedAt = parseTimestamp(existing?.updatedAt) || 0;
      const planUpdatedAt = parseTimestamp(plan.updatedAt) || 0;
      if (!existing || planUpdatedAt >= existingUpdatedAt) byId.set(plan.id, plan);
    });
    return [...byId.values()];
  }

  function dedupeLibraryItems(sourceItems) {
    const byId = new Map();
    sourceItems.forEach((item) => {
      if (!item?.id) return;
      const existing = byId.get(item.id);
      const existingUpdatedAt = parseTimestamp(existing?.updatedAt) || 0;
      const itemUpdatedAt = parseTimestamp(item.updatedAt) || 0;
      if (!existing || itemUpdatedAt >= existingUpdatedAt) byId.set(item.id, item);
    });
    return [...byId.values()];
  }

  function validateStarterFood(food) {
    if (!food || typeof food !== 'object') return null;
    const id = sanitizeShortText(food.id, 120);
    const name = sanitizeShortText(food.name, 80);
    const servingLabel = sanitizeShortText(food.servingLabel, 80);
    const carbs = normalizeNumber(food.carbs);
    if (!id || !name || !servingLabel || carbs == null || carbs < 0) return null;
    if (normalizeFoodSourceType(food.sourceType) !== LLT_STARTER_FOOD_SOURCE) return null;
    return normalizeFoodLibraryItem({
      ...food,
      id: createStableStarterFoodId(id),
      carbs,
      favorite: false,
      sourceType: LLT_STARTER_FOOD_SOURCE,
      sourceProvider: food.sourceName,
      seedKey: id,
      starterFoodVersion: LLT_STARTER_FOODS_VERSION,
      createdAt: LLT_STARTER_FOODS_CREATED_AT,
      updatedAt: LLT_STARTER_FOODS_CREATED_AT,
      enteredBy: 'Unknown',
      syncStatus: 'local',
    });
  }

  function getValidatedStarterFoods() {
    return LLT_STARTER_FOODS.map(validateStarterFood).filter(Boolean);
  }

  function foodMatchesStarterSeed(food, seed) {
    return food?.id === seed.id || getFoodSeedKey(food) === seed.seedKey;
  }

  function seedStarterFoodsInDocument(data) {
    const documentData = data && typeof data === 'object' ? data : createEmptyTrackerData();
    const currentFoods = Array.isArray(documentData.foodLibrary) ? documentData.foodLibrary : [];
    const starterFoods = getValidatedStarterFoods();
    const missingSeeds = starterFoods.filter((seed) => !currentFoods.some((food) => foodMatchesStarterSeed(food, seed)));
    if (!missingSeeds.length) {
      return { data: documentData, seededFoods: [] };
    }
    return {
      data: {
        ...documentData,
        foodLibrary: dedupeLibraryItems([...currentFoods, ...missingSeeds]),
        metadata: {
          ...(documentData.metadata && typeof documentData.metadata === 'object' ? documentData.metadata : {}),
          starterFoodsVersion: LLT_STARTER_FOODS_VERSION,
          starterFoodsSeededAt: documentData.metadata?.starterFoodsSeededAt || new Date().toISOString(),
        },
      },
      seededFoods: missingSeeds,
    };
  }

  function mergeTrackerDocuments(baseData, incomingData) {
    const base = normalizeTrackerDataDocument(baseData);
    const incoming = normalizeTrackerDataDocument(incomingData);
    return normalizeTrackerDataDocument({
      ...base,
      records: dedupeRecords([...base.records, ...incoming.records]),
      foodLibrary: dedupeLibraryItems([...(base.foodLibrary || []), ...(incoming.foodLibrary || [])]),
      savedMeals: dedupeLibraryItems([...(base.savedMeals || []), ...(incoming.savedMeals || [])]),
      settings: {
        ...base.settings,
        ...incoming.settings,
      },
      insulinPlans: dedupePlans([...base.insulinPlans, ...incoming.insulinPlans]),
      activeInsulinPlanId: incoming.activeInsulinPlanId || base.activeInsulinPlanId,
      recovery: {
        malformedRecords: [
          ...(base.recovery?.malformedRecords || []),
          ...(incoming.recovery?.malformedRecords || []),
        ],
        malformedPlans: [
          ...(base.recovery?.malformedPlans || []),
          ...(incoming.recovery?.malformedPlans || []),
        ],
      },
      metadata: {
        createdAt: base.metadata?.createdAt,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  function migrateLegacyPayload(key, payload) {
    if (!payload) return null;
    if (Array.isArray(payload)) {
      if (LEGACY_PLAN_STORAGE_KEYS.includes(key)) {
        return { insulinPlans: payload };
      }
      return { records: payload };
    }
    if (payload && typeof payload === 'object') {
      return payload;
    }
    return null;
  }

  function loadTrackerData() {
    const stored = readStoredJson(TRACKER_STORAGE_KEY);
    let data = stored.exists && stored.data
      ? normalizeTrackerDataDocument(stored.data)
      : createEmptyTrackerData();
    let shouldWrite = !stored.exists || (stored.exists && stored.raw && JSON.stringify(data) !== stored.raw);
    [...LEGACY_RECORD_STORAGE_KEYS, ...LEGACY_PLAN_STORAGE_KEYS].forEach((key) => {
      if (key === TRACKER_STORAGE_KEY) return;
      const legacy = readStoredJson(key);
      const legacyPayload = legacy.exists ? migrateLegacyPayload(key, legacy.data) : null;
      if (legacyPayload) {
        data = mergeTrackerDocuments(data, legacyPayload);
        shouldWrite = true;
      }
    });
    if (shouldWrite && storageAvailability.available) {
      writeTrackerDataDocument(data);
    }
    return data;
  }

  function writeTrackerDataDocument(data) {
    const nextData = normalizeTrackerDataDocument(data);
    try {
      localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(nextData));
      return { ok: true, data: nextData };
    } catch (error) {
      console.warn('Lee-Lee’s Tracker data could not be saved on this device.');
      return { ok: false, error };
    }
  }

  function saveTrackerData(data, options = {}) {
    if (!storageAvailability.available) {
      if (!options.keepStatus) setPersistenceStatus('unavailable');
      return { ok: false };
    }
    const nextData = normalizeTrackerDataDocument({
      ...data,
      metadata: {
        ...(data.metadata || {}),
        updatedAt: new Date().toISOString(),
      },
    });
    const written = writeTrackerDataDocument(nextData);
    if (written.ok) {
      trackerData = written.data;
      records = trackerData.records;
      insulinPlans = trackerData.insulinPlans;
      foodLibrary = trackerData.foodLibrary;
      savedMeals = trackerData.savedMeals;
      if (!options.keepStatus) setPersistenceStatus('saved');
      return { ok: true, data: trackerData };
    }
    if (!options.keepStatus) setPersistenceStatus('failed');
    return written;
  }

  function updateTrackerData(updater) {
    const latestStored = readStoredJson(TRACKER_STORAGE_KEY);
    const latest = latestStored.exists && latestStored.data
      ? mergeTrackerDocuments(trackerData, latestStored.data)
      : trackerData;
    const nextData = normalizeTrackerDataDocument(updater(latest));
    const saved = saveTrackerData(nextData);
    if (!saved.ok) {
      trackerData = nextData;
      records = trackerData.records;
      insulinPlans = trackerData.insulinPlans;
      foodLibrary = trackerData.foodLibrary;
      savedMeals = trackerData.savedMeals;
    }
    return saved;
  }

  function queueLibrarySync(entityType, item, existingItem = null) {
    const queueMethod = entityType === 'saved-meal' ? 'queueSavedMealUpsert' : 'queueFoodUpsert';
    syncRepository?.[queueMethod]?.(item, existingItem);
  }

  function queueStarterFoodsForSync() {
    if (!syncRepository?.queueFoodUpsert) return;
    const starterSeedKeys = new Set(getValidatedStarterFoods().map((food) => food.seedKey));
    foodLibrary
      .filter((food) => starterSeedKeys.has(getFoodSeedKey(food)) && food.syncStatus !== 'synced')
      .forEach((food) => {
        queueLibrarySync('food', food, null);
      });
  }

  function saveFoodLibraryItem(food, { addToCalculator = false } = {}) {
    const existing = food.id ? foodLibrary.find((item) => item.id === food.id) : null;
    const now = new Date().toISOString();
    const identity = syncRepository?.getDeviceIdentity?.() || 'Unknown';
    const normalized = normalizeFoodLibraryItem({
      ...existing,
      ...food,
      id: existing?.id || food.id || createId(),
      sourceType: food.sourceType ?? existing?.sourceType,
      sourceName: food.sourceName ?? existing?.sourceName,
      sourceUrl: food.sourceUrl ?? existing?.sourceUrl,
      verificationNote: food.verificationNote ?? existing?.verificationNote,
      seedKey: food.seedKey ?? existing?.seedKey,
      starterFoodVersion: food.starterFoodVersion ?? existing?.starterFoodVersion,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      enteredBy: existing?.enteredBy || identity,
      lastEditedBy: existing ? identity : null,
    });
    if (!normalized) return { error: 'Food name and carb grams are required.' };
    updateTrackerData((current) => ({
      ...current,
      foodLibrary: dedupeLibraryItems([...(current.foodLibrary || []).filter((item) => item.id !== normalized.id), normalized]),
    }));
    queueLibrarySync('food', normalized, existing);
    if (addToCalculator && currentEditor?.carbCalculatorOpen) {
      const row = carbRowFromFood(normalized);
      currentEditor.carbCalculatorRows = mergeCarbCalculatorRows(currentEditor.carbCalculatorRows || [], row ? [row] : []);
    }
    return { food: normalized };
  }

  function saveSavedMeal(meal) {
    const existing = meal.id ? savedMeals.find((item) => item.id === meal.id) : null;
    const now = new Date().toISOString();
    const identity = syncRepository?.getDeviceIdentity?.() || 'Unknown';
    const normalized = normalizeSavedMeal({
      ...existing,
      ...meal,
      id: existing?.id || meal.id || createId(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      enteredBy: existing?.enteredBy || identity,
      lastEditedBy: existing ? identity : null,
    });
    if (!normalized || !normalized.components.length) return { error: 'Saved meals need a name and at least one carb item.' };
    updateTrackerData((current) => ({
      ...current,
      savedMeals: dedupeLibraryItems([...(current.savedMeals || []).filter((item) => item.id !== normalized.id), normalized]),
    }));
    queueLibrarySync('saved-meal', normalized, existing);
    return { meal: normalized };
  }

  function softDeleteLibraryItem(entityType, id) {
    const source = entityType === 'saved-meal' ? savedMeals : foodLibrary;
    const existing = source.find((item) => item.id === id);
    if (!existing) return false;
    const now = new Date().toISOString();
    const identity = syncRepository?.getDeviceIdentity?.() || 'Unknown';
    const deleted = {
      ...existing,
      deletedAt: now,
      deletedBy: identity,
      lastEditedBy: identity,
      updatedAt: now,
    };
    updateTrackerData((current) => ({
      ...current,
      [entityType === 'saved-meal' ? 'savedMeals' : 'foodLibrary']: (current[entityType === 'saved-meal' ? 'savedMeals' : 'foodLibrary'] || [])
        .map((item) => (item.id === id ? deleted : item)),
    }));
    queueLibrarySync(entityType, deleted, existing);
    return true;
  }

  function updateRecentFoodsFromComponents(components = []) {
    const usedIds = [...new Set((components || []).map((component) => component.foodId).filter(Boolean))];
    if (!usedIds.length) return;
    const now = new Date().toISOString();
    updateTrackerData((current) => ({
      ...current,
      foodLibrary: (current.foodLibrary || []).map((food) => {
        if (!usedIds.includes(food.id)) return food;
        const updated = normalizeFoodLibraryItem({
          ...food,
          lastUsedAt: now,
          useCount: Number(food.useCount || 0) + 1,
          updatedAt: now,
        });
        queueLibrarySync('food', updated, food);
        return updated;
      }).filter(Boolean),
    }));
  }

  function setPersistenceStatus(status) {
    persistenceStatus = status;
    persistenceMessage = {
      saved: 'Saved on this device',
      saving: 'Saving...',
      failed: 'Your record is visible, but it could not be saved on this device. Please keep this page open and try again.',
      unavailable: 'Records are visible, but this browser is not allowing this device to save tracker data.',
      imported: 'Backup imported and saved on this device',
      reloaded: 'Newer tracker data was loaded from this device.',
    }[status] || 'Saved on this device';
  }

  function formatRelativeSyncTime(timestamp, nowMs = Date.now()) {
    const syncMs = parseTimestamp(timestamp);
    if (!Number.isFinite(syncMs)) return 'Not yet';
    const elapsedMs = Math.max(0, nowMs - syncMs);
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    if (elapsedMinutes < 1) return 'just now';
    if (elapsedMinutes < 60) return `${elapsedMinutes} ${elapsedMinutes === 1 ? 'minute' : 'minutes'} ago`;
    const syncDate = new Date(syncMs);
    const nowDate = new Date(nowMs);
    if (getLocalDateKey(syncDate) === getLocalDateKey(nowDate)) return `Today ${formatTime(syncMs)}`;
    return `${formatDate(syncDate)} ${formatTime(syncMs)}`;
  }

  function getFriendlySyncStatus(status = syncStatus, nowMs = Date.now()) {
    if (!status.configured) return { state: 'config-needed', message: 'Supabase setup needed' };
    if (!status.signedIn) return { state: 'signed-out', message: 'Sign in to sync' };
    if (status.conflictCount) return { state: 'conflict', message: 'Conflict needs review' };
    if (status.state === 'syncing') return { state: 'syncing', message: 'Syncing...' };
    if (status.state === 'offline') return { state: 'offline', message: 'Offline / Waiting to reconnect' };
    if (status.pendingCount) return { state: 'waiting', message: `${status.pendingCount} waiting to sync` };
    if (status.realtimeStatus && !['idle', 'connected'].includes(status.realtimeStatus)) {
      return { state: 'waiting', message: 'Realtime disconnected / Using periodic sync' };
    }
    if (status.lastSuccessfulSyncAt) {
      return { state: 'synced', message: `✓ Synced ${formatRelativeSyncTime(status.lastSuccessfulSyncAt, nowMs)}` };
    }
    return { state: 'synced', message: '✓ Shared Sync Active' };
  }

  function renderPersistenceStatus() {
    const isSyncEnabled = syncRepository && syncStatus.configured && syncStatus.signedIn;
    const friendlyStatus = getFriendlySyncStatus(syncStatus);
    const statusClass = isSyncEnabled ? friendlyStatus.state : persistenceStatus;
    const statusMessage = isSyncEnabled ? friendlyStatus.message : persistenceMessage;
    const retry = persistenceStatus === 'failed' || syncStatus.state === 'waiting' || syncStatus.state === 'offline'
      ? '<button type="button" class="lee_lee_diabetes_status_retry" data-action="retry-save">Retry</button>'
      : '';
    return `
      <p class="lee_lee_diabetes_save_status lee_lee_diabetes_save_status--${escapeHtml(statusClass)}" aria-live="polite">
        ${escapeHtml(statusMessage)}
        ${retry}
      </p>
    `;
  }

  function renderConfigurationNeeded() {
    const root = getRoot();
    if (!root) return;
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Sync Setup Needed</h1>
        <p class="lee_lee_diabetes_help">Lee-Lee’s Tracker needs the Supabase project URL and publishable key before shared family records can open on this device.</p>
        <p class="lee_lee_diabetes_help">Add the browser-safe values described in <code>docs/SUPABASE_SETUP.md</code>. Do not use a service-role key or database password.</p>
      </section>
    `;
  }

  function renderSignIn() {
    const root = getRoot();
    if (!root) return;
    root.innerHTML = `
      <form class="lee_lee_diabetes_editor" data-auth-form aria-labelledby="lee-lee-diabetes-title">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Sign In</h1>
        <p class="lee_lee_diabetes_help">Use the shared Lee-Lee’s Tracker account to sync records on family devices.</p>
        ${authError ? `<p class="lee_lee_diabetes_error">${escapeHtml(authError)}</p>` : ''}
        ${authMessage ? `<p class="lee_lee_diabetes_save_status lee_lee_diabetes_save_status--synced">${escapeHtml(authMessage)}</p>` : ''}
        <label class="lee_lee_diabetes_field">
          Email
          <input class="lee_lee_diabetes_input" name="email" type="email" autocomplete="email" required>
        </label>
        <label class="lee_lee_diabetes_field">
          Password
          <input class="lee_lee_diabetes_input" name="password" type="password" autocomplete="current-password" required>
        </label>
        <div class="lee_lee_diabetes_actions">
          <button type="submit" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary">Sign In</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="reset-password">Reset Password</button>
        </div>
      </form>
    `;
    root.querySelector('[name="email"]')?.focus();
  }

  function renderDeviceIdentitySetup(errorMessage = '') {
    const root = getRoot();
    if (!root) return;
    root.innerHTML = `
      <form class="lee_lee_diabetes_editor" data-device-identity-form aria-labelledby="lee-lee-diabetes-title">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Who Uses This Device?</h1>
        <p class="lee_lee_diabetes_help">This labels who entered or edited records from this phone. It is separate from the shared sign-in account.</p>
        ${errorMessage ? `<p class="lee_lee_diabetes_error">${escapeHtml(errorMessage)}</p>` : ''}
        <label class="lee_lee_diabetes_field">
          This device is used by
          <select class="lee_lee_diabetes_select" name="deviceIdentity" required>
            <option value="">Choose one</option>
            ${renderDeviceIdentityOptions()}
          </select>
        </label>
        <div class="lee_lee_diabetes_actions">
          <button type="submit" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary">Continue</button>
        </div>
      </form>
    `;
  }

  function getDeviceIdentityOptions() {
    const syncOptions = window.LeeLeeTrackerSync?.DEVICE_USERS;
    return Array.isArray(syncOptions) && syncOptions.length ? syncOptions : FALLBACK_DEVICE_USERS;
  }

  function renderDeviceIdentityOptions(selectedIdentity = '') {
    return getDeviceIdentityOptions()
      .map((name) => `<option value="${escapeHtml(name)}" ${selectedIdentity === name ? 'selected' : ''}>${escapeHtml(name)}</option>`)
      .join('');
  }

  function renderConflicts() {
    const root = getRoot();
    if (!root || !syncRepository) return;
    currentEditor = { mode: 'conflicts' };
    conflictAutoResolvedCount += syncRepository.cleanupIdenticalConflicts?.() || 0;
    const conflicts = syncRepository.getConflicts();
    conflictSelection = new Set([...conflictSelection].filter((id) => conflicts.some((conflict) => conflict.recordId === id)));
    const selectedCount = conflictSelection.size;
    root.innerHTML = `
      ${renderTrackerTop({ active: 'settings', kicker: 'Sync', title: 'Records Needing Review' })}
      ${renderTrackerNav('settings')}
      <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-conflict-summary-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-conflict-summary-title">${escapeHtml(conflicts.length)} ${conflicts.length === 1 ? 'conflict needs' : 'conflicts need'} review</h2>
        <p class="lee_lee_diabetes_help" aria-live="polite">${escapeHtml(selectedCount)} selected</p>
        ${conflictAutoResolvedCount ? `<p class="lee_lee_diabetes_save_status lee_lee_diabetes_save_status--synced">${escapeHtml(conflictAutoResolvedCount)} identical ${conflictAutoResolvedCount === 1 ? 'conflict' : 'conflicts'} resolved automatically.</p>` : ''}
        ${conflictBulkState ? `<p class="lee_lee_diabetes_save_status lee_lee_diabetes_save_status--${escapeHtml(conflictBulkState.state)}">${escapeHtml(conflictBulkState.message)}</p>` : ''}
        <div class="lee_lee_diabetes_backup_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="select-all-conflicts" ${conflicts.length ? '' : 'disabled'}>Select All</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="select-no-conflicts" ${selectedCount ? '' : 'disabled'}>Select None</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="bulk-keep-shared" ${selectedCount ? '' : 'disabled'}>Keep Shared (${escapeHtml(selectedCount)})</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="bulk-use-local" ${selectedCount ? '' : 'disabled'}>Use This Device (${escapeHtml(selectedCount)})</button>
        </div>
      </section>
      <section class="lee_lee_diabetes_timeline" aria-label="Sync conflicts">
        ${conflicts.length ? conflicts.map(renderConflictCard).join('') : '<p class="lee_lee_diabetes_empty" role="status">No conflicts need review.</p>'}
      </section>
    `;
  }

  function formatConflictValue(value, formatter = null) {
    if (formatter) return formatter(value) || 'None';
    return value == null || value === '' ? 'None' : String(value);
  }

  function getConflictRows(conflict) {
    const local = conflict.localRecord || {};
    const shared = conflict.sharedRecord || {};
    if (conflict.entityType === 'shared-settings') {
      return [
        ['Patient Name', shared.patientName, local.patientName],
        ['Date of Birth', shared.patientBirthDate, local.patientBirthDate],
        ['Clinic Name', shared.clinicName, local.clinicName],
        ['Clinic Phone', shared.clinicPhone, local.clinicPhone],
      ];
    }
    return [
      ['Time', formatRecordDateTime(shared.recordTimestamp), formatRecordDateTime(local.recordTimestamp)],
      ['Event', getEventTypeLabel(shared.eventType), getEventTypeLabel(local.eventType)],
      ['Entry Type', shared.type, local.type],
      ['Carbs', formatConflictValue(shared.mealCarbs, formatCarbs), formatConflictValue(local.mealCarbs, formatCarbs)],
      ['Meal Description', shared.mealDescription || '', local.mealDescription || ''],
      ['Activity', [shared.activityDescription, formatActivityDuration(shared.activityDurationMinutes), shared.activityIntensity].filter(Boolean).join(' · '), [local.activityDescription, formatActivityDuration(local.activityDurationMinutes), local.activityIntensity].filter(Boolean).join(' · ')],
      ['Blood Sugar', formatConflictValue(shared.bloodSugar, formatBloodSugar), formatConflictValue(local.bloodSugar, formatBloodSugar)],
      ['Insulin', formatConflictValue(getRecordActualInsulin(shared), formatInsulin), formatConflictValue(getRecordActualInsulin(local), formatInsulin)],
      ['Notes', shared.notes || '', local.notes || ''],
      ['Deleted', shared.deletedAt ? 'Deleted' : 'Active', local.deletedAt ? 'Deleted' : 'Active'],
    ];
  }

  function renderConflictCard(conflict) {
    const local = conflict.localRecord || {};
    const shared = conflict.sharedRecord || {};
    const isSelected = conflictSelection.has(conflict.recordId);
    const rows = getConflictRows(conflict);
    const title = conflict.entityType === 'shared-settings'
      ? 'Patient & Clinic Settings'
      : (local.type || shared.type || 'Entry');
    return `
      <article class="lee_lee_diabetes_timeline_item lee_lee_diabetes_history_record">
        <div>
          <label class="lee_lee_diabetes_checkline">
            <span class="lee_lee_diabetes_timeline_type">${escapeHtml(title)}</span>
            <input type="checkbox" data-conflict-select="${escapeHtml(conflict.recordId)}" aria-label="Select ${escapeHtml(title)} conflict" ${isSelected ? 'checked' : ''}>
          </label>
          <div class="lee_lee_diabetes_record_details">
            ${conflict.entityType === 'shared-settings' ? '' : `<p>${escapeHtml(formatRecordDateTime(local.recordTimestamp || shared.recordTimestamp))}</p>`}
            <p><strong>Shared:</strong> edited by ${escapeHtml(shared.lastEditedBy || shared.enteredBy || 'Unknown')}</p>
            <p><strong>This device:</strong> edited by ${escapeHtml(local.lastEditedBy || local.enteredBy || 'Unknown')}</p>
            <dl class="lee_lee_diabetes_conflict_grid">
              ${rows.map(([label, sharedValue, localValue]) => {
                const differs = String(sharedValue || '') !== String(localValue || '');
                return `
                  <div class="${differs ? 'is-different' : ''}">
                    <dt>${escapeHtml(label)}</dt>
                    <dd><strong>Shared</strong><span>${escapeHtml(formatConflictValue(sharedValue))}</span></dd>
                    <dd><strong>This device</strong><span>${escapeHtml(formatConflictValue(localValue))}</span></dd>
                  </div>
                `;
              }).join('')}
            </dl>
          </div>
        </div>
        <div class="lee_lee_diabetes_record_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="keep-shared-version" data-id="${escapeHtml(conflict.recordId)}">Keep Shared</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="use-local-version" data-id="${escapeHtml(conflict.recordId)}">Use This Device</button>
        </div>
      </article>
    `;
  }

  async function resolveSelectedConflicts(mode) {
    if (!syncRepository || !conflictSelection.size) return;
    const selectedIds = [...conflictSelection];
    const actionLabel = mode === 'keep-shared' ? 'Keep Shared' : 'Use This Device';
    if (selectedIds.length > 1) {
      const message = mode === 'keep-shared'
        ? `Keep the shared version for ${selectedIds.length} selected entries?`
        : `Replace the shared history with this device’s version for ${selectedIds.length} selected entries?`;
      if (!window.confirm(message)) return;
    }
    conflictBulkState = { state: 'syncing', message: `Resolving 0 of ${selectedIds.length}…` };
    renderConflicts();
    let resolved = 0;
    for (const id of selectedIds) {
      conflictBulkState = { state: 'syncing', message: `Resolving ${resolved + 1} of ${selectedIds.length}…` };
      renderConflicts();
      if (mode === 'keep-shared') await syncRepository.keepSharedVersion(id);
      else await syncRepository.useLocalVersion(id);
      resolved += 1;
    }
    const remainingSelected = syncRepository.getConflicts().filter((conflict) => selectedIds.includes(conflict.recordId)).length;
    const resolvedCount = selectedIds.length - remainingSelected;
    conflictSelection = new Set(selectedIds.filter((id) => syncRepository.getConflicts().some((conflict) => conflict.recordId === id)));
    conflictBulkState = {
      state: remainingSelected ? 'waiting' : 'synced',
      message: `${resolvedCount} resolved. ${remainingSelected} ${remainingSelected === 1 ? 'still needs' : 'still need'} review.`,
    };
    syncStatus = syncRepository.getSyncStatus();
    renderConflicts();
  }

  function createBackupDocument() {
    return {
      appIdentifier: 'lee-lee-tracker-full-backup',
      backupFormat: 'lee-lee-tracker-full-backup',
      backupFormatVersion: 1,
      appVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      recordCount: trackerData.records.length,
      ...normalizeTrackerDataDocument(trackerData),
    };
  }

  function exportDataBackup() {
    const backup = createBackupDocument();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const now = new Date();
    const stamp = `${getLocalDateKey(now)}-${getLocalTimeKey(now).replace(':', '')}`;
    link.href = URL.createObjectURL(blob);
    link.download = `lee-lee-tracker-backup-${stamp}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    try {
      localStorage.setItem(`${TRACKER_STORAGE_KEY}:last-full-backup-at`, new Date().toISOString());
    } catch (error) {
      // Backup reminder state is best effort.
    }
  }

  function validateBackupPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { error: 'Choose a valid Lee-Lee’s Tracker backup file.' };
    }
    const candidate = payload.appIdentifier === 'lando-world:lee-lees-tracker'
      ? payload
      : migrateLegacyPayload('backup', payload);
    if (!candidate || typeof candidate !== 'object') {
      return { error: 'Choose a valid Lee-Lee’s Tracker backup file.' };
    }
    const normalized = normalizeTrackerDataDocument(candidate);
    const hasData = normalized.records.length || normalized.insulinPlans.length;
    if (!hasData) return { error: 'That backup did not contain tracker records or insulin plans.' };
    return { data: normalized };
  }

  function renderImportConfirmation(importData) {
    const root = getRoot();
    if (!root) return;
    currentEditor = {
      mode: 'import-confirmation',
      pendingImport: importData,
    };
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Import Data Backup</h1>
        <p class="lee_lee_diabetes_help">The backup will be merged with data already on this device. Matching records will not be duplicated.</p>
        <dl class="lee_lee_diabetes_confirm_list">
          <div>
            <dt>Records found</dt>
            <dd>${escapeHtml(importData.records.length)}</dd>
          </div>
          <div>
            <dt>Insulin plans found</dt>
            <dd>${escapeHtml(importData.insulinPlans.length)}</dd>
          </div>
        </dl>
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="settings">Cancel</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="confirm-import">Import Backup</button>
        </div>
      </section>
    `;
  }

  function handleBackupImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      try {
        const payload = JSON.parse(String(reader.result || ''));
        const validation = validateBackupPayload(payload);
        if (validation.error) {
          renderSettings(validation.error);
          return;
        }
        renderImportConfirmation(validation.data);
      } catch (error) {
        renderSettings('Choose a valid Lee-Lee’s Tracker backup file.');
      }
    });
    reader.readAsText(file);
  }

  function preservePreImportBackup() {
    if (!storageAvailability.available) return false;
    try {
      localStorage.setItem(`${PRE_IMPORT_BACKUP_PREFIX}${Date.now()}`, JSON.stringify(createBackupDocument()));
      return true;
    } catch (error) {
      console.warn('Lee-Lee’s Tracker pre-import backup could not be saved.');
      return false;
    }
  }

  function confirmImportBackup() {
    const importData = currentEditor?.pendingImport;
    if (!importData) return;
    if (!preservePreImportBackup()) {
      setPersistenceStatus('failed');
      renderSettings('Import stopped because a pre-import backup could not be saved on this device.');
      return;
    }
    setPersistenceStatus('saving');
    const result = updateTrackerData((current) => mergeTrackerDocuments(current, importData));
    if (result.ok) setPersistenceStatus('imported');
    renderSettings();
  }

  function retrySave() {
    setPersistenceStatus('saving');
    saveTrackerData(trackerData);
    renderHome();
  }

  function requestPersistentStorage() {
    if (!navigator.storage?.persist) return;
    const dismissedKey = `${TRACKER_STORAGE_KEY}:persistent-storage-requested`;
    try {
      if (localStorage.getItem(dismissedKey) === 'true') return;
      navigator.storage.persist().finally(() => {
        try {
          localStorage.setItem(dismissedKey, 'true');
        } catch (error) {
          // Persistence is best effort; localStorage remains the required source of truth.
        }
      });
    } catch (error) {
      // Some browsers restrict this API. The tracker still works with ordinary localStorage.
    }
  }

  function handleExternalStorageUpdate(event) {
    if (event.key !== TRACKER_STORAGE_KEY || !event.newValue) return;
    try {
      const incoming = JSON.parse(event.newValue);
      trackerData = mergeTrackerDocuments(trackerData, incoming);
      records = trackerData.records;
      insulinPlans = trackerData.insulinPlans;
      foodLibrary = trackerData.foodLibrary;
      savedMeals = trackerData.savedMeals;
      setPersistenceStatus('reloaded');
      if (!currentEditor || ['history', 'history-day', 'reports', 'export', 'settings'].includes(currentEditor.mode)) {
        if (currentEditor?.mode === 'settings') {
          renderSettings();
        } else if (currentEditor?.mode === 'history') {
          renderHistory();
        } else if (currentEditor?.mode === 'history-day') {
          renderHistoryDay(currentEditor.dateKey);
        } else if (currentEditor?.mode === 'reports') {
          renderReports();
        } else if (currentEditor?.mode === 'export') {
          renderExport();
        } else {
          renderHome();
        }
      }
    } catch (error) {
      console.warn('Lee-Lee’s Tracker received an unreadable storage update.');
    }
  }

  function getPlanTimestampRange(plan) {
    return {
      start: createDateStartTimestamp(plan.effectiveFrom) ?? Number.NEGATIVE_INFINITY,
      end: plan.effectiveTo ? createDateStartTimestamp(plan.effectiveTo) : Number.POSITIVE_INFINITY,
    };
  }

  function getActiveInsulinPlan(recordTimestamp = Date.now()) {
    return insulinPlans
      .map((plan) => ({ plan, range: getPlanTimestampRange(plan) }))
      .filter(({ range }) => recordTimestamp >= range.start && recordTimestamp < range.end)
      .sort((a, b) => b.range.start - a.range.start)[0]?.plan || null;
  }

  function calculateMealInsulinDose({ bloodSugar, entryType, insulinPlan, recordTimestamp, totalCarbs = 0 }) {
    const glucoseText = String(bloodSugar ?? '').trim();
    if (entryType === BEDTIME_CONTEXT_TYPE) {
      if (!insulinPlan || !Number.isFinite(Number(recordTimestamp))) {
        return {
          status: 'unavailable',
          baseUnits: null,
          correctionUnits: null,
          suggestedTotalUnits: null,
          matchedRange: null,
          insulinPlanId: insulinPlan?.id || null,
          message: 'No insulin plan is configured for this date.',
        };
      }
      const baseUnits = getBedtimeBaseUnits(insulinPlan);
      return {
        status: 'calculated',
        baseUnits,
        correctionUnits: null,
        suggestedTotalUnits: baseUnits,
        matchedRange: null,
        insulinPlanId: insulinPlan.id,
        message: 'Based on the current clinician-provided insulin plan. Confirm the dose before giving insulin.',
      };
    }
    if (!MEAL_TYPES.includes(entryType) || !insulinPlan?.supportedMealTypes?.includes(entryType)) {
      if (entryType === 'Snacks' || entryType === 'Snack') {
        if (!insulinPlan || !Number.isFinite(Number(recordTimestamp))) {
          return {
            status: 'unavailable',
            baseUnits: null,
            carbDoseUnits: null,
            rawCarbDose: null,
            insulinCarbRatioGrams: null,
            totalCarbs: normalizeNumber(totalCarbs) ?? 0,
            correctionUnits: null,
            suggestedTotalUnits: null,
            matchedRange: null,
            insulinPlanId: insulinPlan?.id || null,
            message: 'No insulin plan is configured for this date.',
          };
        }
        const snack = calculateSnackSuggestedDose({ totalCarbs, insulinPlan });
        return {
          ...snack,
          baseUnits: null,
          carbDoseUnits: snack.roundedCarbDose,
          insulinPlanId: insulinPlan.id,
        };
      }
      if (entryType === 'Correction') {
        if (!insulinPlan || !Number.isFinite(Number(recordTimestamp))) {
          return {
            status: 'unavailable',
            baseUnits: null,
            carbDoseUnits: null,
            rawCarbDose: null,
            insulinCarbRatioGrams: null,
            totalCarbs: null,
            correctionUnits: null,
            suggestedTotalUnits: null,
            matchedRange: null,
            insulinPlanId: insulinPlan?.id || null,
            message: 'No insulin plan is configured for this date.',
          };
        }
        const correction = getCorrectionDose({ bloodSugar, insulinPlan });
        return {
          status: correction.status,
          baseUnits: null,
          carbDoseUnits: null,
          rawCarbDose: null,
          roundedCarbDose: null,
          insulinCarbRatioGrams: getInsulinCarbRatioGrams(insulinPlan),
          totalCarbs: null,
          correctionUnits: correction.correctionUnits,
          suggestedTotalUnits: correction.status === 'calculated' ? correction.correctionUnits : null,
          matchedRange: correction.matchedRange,
          insulinPlanId: insulinPlan.id,
          message: correction.message || 'Based on the current correction table. Confirm the dose before giving insulin.',
        };
      }
      if (MEAL_TYPES.includes(entryType) && !insulinPlan) {
        return {
          status: 'unavailable',
          baseUnits: null,
          carbDoseUnits: null,
          correctionUnits: null,
          suggestedTotalUnits: null,
          matchedRange: null,
          insulinPlanId: null,
          message: 'No insulin plan is configured for this date.',
        };
      }
      return {
        status: 'unsupported-entry-type',
        baseUnits: null,
        carbDoseUnits: null,
        correctionUnits: null,
        suggestedTotalUnits: null,
        matchedRange: null,
        insulinPlanId: insulinPlan?.id || null,
        message: 'Automatic dose guidance is available for Breakfast, Lunch, Dinner, Snacks, Correction, and Bedtime under the current plan.',
      };
    }
    if (!insulinPlan || !Number.isFinite(Number(recordTimestamp))) {
      return {
        status: 'unavailable',
        baseUnits: null,
        carbDoseUnits: null,
        correctionUnits: null,
        suggestedTotalUnits: null,
        matchedRange: null,
        insulinPlanId: insulinPlan?.id || null,
        message: 'No insulin plan is configured for this date.',
      };
    }
    if (!isWholePositiveGlucose(glucoseText)) {
      return {
        status: 'unavailable',
        baseUnits: null,
        carbDoseUnits: null,
        correctionUnits: null,
        suggestedTotalUnits: null,
        matchedRange: null,
        insulinPlanId: insulinPlan.id,
        message: 'Enter a positive whole-number blood sugar to see a suggested dose.',
      };
    }
    const calculated = calculateMealSuggestedDose({ bloodSugar, totalCarbs, insulinPlan });
    return {
      ...calculated,
      baseUnits: null,
      carbDoseUnits: calculated.roundedCarbDose,
      insulinPlanId: insulinPlan.id,
    };
  }

  window.LeeLeeTrackerDoseHelper = {
    calculateFoodCarbs,
    calculateTotalCarbs,
    normalizeCarbCalculatorRows,
    calculateCarbCalculatorRowTotal,
    calculateCarbCalculatorMealTotal,
    hasValidCarbCalculatorTotal,
    normalizeFoodLibraryItem,
    normalizeSavedMeal,
    normalizeMealComponent,
    searchFoodItems,
    getRecentFoodItems,
    getValidatedStarterFoods,
    seedStarterFoodsInDocument,
    formatFoodSourceLabel,
    calculateMealComponentTotal,
    buildMealComponentsFromCarbCalculatorRows,
    mergeCarbCalculatorRows,
    calculateCarbDose,
    calculateMealSuggestedDose,
    calculateSnackSuggestedDose,
    getCorrectionDose,
    roundToNearestHalf,
    calculateMealInsulinDose,
  };

  window.LeeLeeTrackerEntryTypes = {
    eventTypes: EVENT_TYPE_DEFINITIONS.map((definition) => ({ ...definition, fields: [...definition.fields] })),
    all: ENTRY_TYPE_DEFINITIONS.map((definition) => ({ ...definition, fields: [...definition.fields] })),
    primaryTypes: [...PRIMARY_TYPES],
    mealTypes: [...MEAL_TYPES],
    mealContextTypes: [...MEAL_CONTEXT_TYPES],
    getEventTypeConfig: (eventType) => {
      const config = getEventTypeConfig(eventType);
      return { ...config, fields: [...config.fields] };
    },
    getContextOptionsForEventType,
    getEntryTypeConfig: (type) => {
      const config = getEntryTypeConfig(type);
      return { ...config, fields: [...config.fields] };
    },
    entryTypeUsesMealGuidance,
    entryTypeUsesFoodCalculator,
    entryTypeHasField,
  };

  function getRecordEventDateKey(record) {
    return getLocalDateKey(new Date(getRecordTimestamp(record)));
  }

  function getRecordActualInsulin(record) {
    return normalizeNumber(record?.administeredInsulinUnits ?? record?.insulinUnits);
  }

  function sortRecordsChronologically(sourceRecords) {
    return sourceRecords
      .slice()
      .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b));
  }

  function sortRecordsNewestFirst(sourceRecords) {
    return sourceRecords
      .slice()
      .sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a));
  }

  function addDays(dateKey, delta) {
    const timestamp = createDateStartTimestamp(dateKey);
    if (timestamp == null) return '';
    return getLocalDateKey(new Date(timestamp + delta * 24 * 60 * 60 * 1000));
  }

  function getDateRangeBounds(rangeValue, startDate = '', endDate = '') {
    const today = getLocalDateKey();
    const option = DATE_RANGE_OPTIONS.find((item) => item.value === rangeValue);
    if (rangeValue === 'custom') {
      return {
        startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : '',
        endDate: /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : '',
      };
    }
    if (!option || option.days == null) {
      return { startDate: '', endDate: '' };
    }
    return {
      startDate: addDays(today, -(option.days - 1)),
      endDate: today,
    };
  }

  function filterRecordsByDateRange(sourceRecords, filters) {
    const bounds = getDateRangeBounds(filters.range, filters.startDate, filters.endDate);
    return sourceRecords.filter((record) => {
      const dateKey = getRecordEventDateKey(record);
      const afterStart = !bounds.startDate || dateKey >= bounds.startDate;
      const beforeEnd = !bounds.endDate || dateKey <= bounds.endDate;
      return afterStart && beforeEnd;
    });
  }

  function filterRecordsByEntryType(sourceRecords, type) {
    if (!type || type === 'All') return sourceRecords;
    return sourceRecords.filter((record) => record.type === type);
  }

  function getFilteredRecords(sourceRecords, filters) {
    return filterRecordsByEntryType(filterRecordsByDateRange(sourceRecords, filters), filters.type);
  }

  function groupRecordsByLocalDate(sourceRecords) {
    const groups = new Map();
    sortRecordsChronologically(sourceRecords).forEach((record) => {
      const dateKey = getRecordEventDateKey(record);
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey).push(record);
    });
    return [...groups.entries()]
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([dateKey, dateRecords]) => ({
        dateKey,
        records: sortRecordsChronologically(dateRecords),
      }));
  }

  const dailySummaryCache = new Map();

  function getDailySummaryCacheKey(sourceRecords) {
    return sourceRecords
      .slice()
      .sort((a, b) => getRecordTimestamp(a) - getRecordTimestamp(b) || String(a.id || '').localeCompare(String(b.id || '')))
      .map((record) => [
        record.id,
        record.eventType ?? '',
        record.bloodSugar ?? '',
        getRecordActualInsulin(record) ?? '',
        record.mealCarbs ?? '',
        record.activityDurationMinutes ?? '',
        record.updatedAt ?? '',
      ].join(':'))
      .join('|');
  }

  function calculateDailySummary(sourceRecords) {
    const cacheKey = getDailySummaryCacheKey(sourceRecords);
    if (dailySummaryCache.has(cacheKey)) return dailySummaryCache.get(cacheKey);
    const glucoseValues = sourceRecords
      .map((record) => normalizeBloodSugar(record.bloodSugar))
      .filter((value) => value != null);
    const insulinValues = sourceRecords
      .map(getRecordActualInsulin)
      .filter((value) => value != null);
    const totalGlucose = glucoseValues.reduce((sum, value) => sum + value, 0);
    const totalInsulin = insulinValues.reduce((sum, value) => sum + value, 0);
    const summary = {
      entryCount: sourceRecords.length,
      averageBloodSugar: glucoseValues.length ? Math.round(totalGlucose / glucoseValues.length) : null,
      highestBloodSugar: glucoseValues.length ? Math.max(...glucoseValues) : null,
      lowestBloodSugar: glucoseValues.length ? Math.min(...glucoseValues) : null,
      totalInsulin: insulinValues.length ? totalInsulin : null,
    };
    dailySummaryCache.set(cacheKey, summary);
    return summary;
  }

  function getRecordCarbs(record) {
    return normalizeNumber(record?.mealCarbs ?? record?.totalCarbs ?? record?.carbs);
  }

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function sumValues(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  }

  function uniqueRecordDateKeys(sourceRecords) {
    return [...new Set(sourceRecords.map(getRecordEventDateKey).filter(Boolean))].sort();
  }

  function getInclusiveDayCount(startDate, endDate) {
    const start = createDateStartTimestamp(startDate);
    const end = createDateStartTimestamp(endDate);
    if (start == null || end == null || end < start) return null;
    return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
  }

  function getReportDayCount(sourceRecords, filters = {}) {
    const bounds = getDateRangeBounds(filters.range, filters.startDate, filters.endDate);
    const boundedCount = getInclusiveDayCount(bounds.startDate, bounds.endDate);
    if (boundedCount != null) return boundedCount;
    return uniqueRecordDateKeys(sourceRecords).length;
  }

  function getGlucoseTargetRange(settings = trackerData.settings || {}) {
    const min = normalizeBloodSugar(settings.glucoseTargetMin ?? settings.targetGlucoseMin ?? settings.targetRangeMin);
    const max = normalizeBloodSugar(settings.glucoseTargetMax ?? settings.targetGlucoseMax ?? settings.targetRangeMax);
    return min != null && max != null && min <= max ? { min, max } : null;
  }

  function classifyActualInsulin(record) {
    const actual = getRecordActualInsulin(record);
    if (actual == null) return null;
    const type = normalizeRecordContext(record?.type, normalizeEventType(record?.eventType, record));
    const isLongActing = type === BEDTIME_CONTEXT_TYPE;
    const isMealRelated = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Snack'].includes(type);
    const isCorrection = type === 'Correction';
    return {
      actual,
      isFastActing: !isLongActing,
      isLongActing,
      isMealRelated,
      isCorrection,
      type,
    };
  }

  function createValueSummary(values) {
    const validValues = values.filter((value) => value != null);
    return {
      count: validValues.length,
      total: sumValues(validValues),
      average: average(validValues),
      min: validValues.length ? Math.min(...validValues) : null,
      max: validValues.length ? Math.max(...validValues) : null,
    };
  }

  function calculateReportSummary(sourceRecords, filters = {}, settings = trackerData.settings || {}) {
    const visibleRecords = sourceRecords.filter((record) => !isRecordDeleted(record));
    const dayCount = getReportDayCount(visibleRecords, filters);
    const glucoseValues = visibleRecords.map((record) => normalizeBloodSugar(record.bloodSugar)).filter((value) => value != null);
    const insulinEvents = visibleRecords.map(classifyActualInsulin).filter(Boolean);
    const carbValues = visibleRecords.map(getRecordCarbs).filter((value) => value != null);
    const targetRange = getGlucoseTargetRange(settings);
    const targetCounts = targetRange && glucoseValues.length
      ? glucoseValues.reduce((counts, value) => {
        if (value < targetRange.min) counts.below += 1;
        else if (value > targetRange.max) counts.above += 1;
        else counts.inRange += 1;
        return counts;
      }, { inRange: 0, below: 0, above: 0 })
      : null;
    const insulinValues = insulinEvents.map((event) => event.actual);
    const fastActingValues = insulinEvents.filter((event) => event.isFastActing).map((event) => event.actual);
    const longActingValues = insulinEvents.filter((event) => event.isLongActing).map((event) => event.actual);
    const mealValues = insulinEvents.filter((event) => event.isMealRelated).map((event) => event.actual);
    const correctionValues = insulinEvents.filter((event) => event.isCorrection).map((event) => event.actual);
    return {
      dayCount,
      entryCount: visibleRecords.length,
      calendarDateCount: uniqueRecordDateKeys(visibleRecords).length,
      glucose: {
        ...createValueSummary(glucoseValues),
        targetRange,
        targetCounts,
        inRangePercent: targetCounts ? (targetCounts.inRange / glucoseValues.length) * 100 : null,
        belowRangePercent: targetCounts ? (targetCounts.below / glucoseValues.length) * 100 : null,
        aboveRangePercent: targetCounts ? (targetCounts.above / glucoseValues.length) * 100 : null,
      },
      insulin: {
        ...createValueSummary(insulinValues),
        averagePerDay: insulinValues.length && dayCount ? sumValues(insulinValues) / dayCount : null,
        fastActing: createValueSummary(fastActingValues),
        fastActingAveragePerDay: fastActingValues.length && dayCount ? sumValues(fastActingValues) / dayCount : null,
        longActing: createValueSummary(longActingValues),
        longActingAveragePerDay: longActingValues.length && dayCount ? sumValues(longActingValues) / dayCount : null,
        mealRelated: createValueSummary(mealValues),
        mealRelatedAverage: average(mealValues),
        correction: createValueSummary(correctionValues),
        correctionAverage: average(correctionValues),
      },
      carbs: {
        ...createValueSummary(carbValues),
        averagePerDay: carbValues.length && dayCount ? sumValues(carbValues) / dayCount : null,
        averagePerEntry: average(carbValues),
      },
    };
  }

  function calculateContextAverages(sourceRecords) {
    return EXTRA_TYPES.map((type) => {
      const contextRecords = sourceRecords.filter((record) => record.type === type);
      if (!contextRecords.length) return null;
      const glucose = createValueSummary(contextRecords.map((record) => normalizeBloodSugar(record.bloodSugar)));
      const carbs = createValueSummary(contextRecords.map(getRecordCarbs));
      const insulin = createValueSummary(contextRecords.map(getRecordActualInsulin));
      return {
        type,
        recordCount: contextRecords.length,
        glucose,
        carbs,
        insulin,
      };
    }).filter(Boolean);
  }

  function buildAveragesReport(sourceRecords, filters = {}) {
    const summary = calculateReportSummary(sourceRecords, filters);
    return {
      summary,
      contexts: calculateContextAverages(sourceRecords),
      typicalDay: calculateContextAverages(sourceRecords)
        .filter((context) => ['Breakfast', 'Lunch', 'Dinner', BEDTIME_CONTEXT_TYPE].includes(context.type)),
    };
  }

  function buildTrendSeries(sourceRecords) {
    const sorted = sortRecordsChronologically(sourceRecords);
    return {
      glucose: sorted
        .map((record) => ({ record, value: normalizeBloodSugar(record.bloodSugar), timestamp: getRecordTimestamp(record) }))
        .filter((point) => point.value != null),
      insulin: sorted
        .map((record) => {
          const insulin = classifyActualInsulin(record);
          return insulin ? { record, value: insulin.actual, timestamp: getRecordTimestamp(record), category: insulin.isLongActing ? 'Long-acting' : 'Fast-acting' } : null;
        })
        .filter(Boolean),
      carbs: sorted
        .map((record) => ({ record, value: getRecordCarbs(record), timestamp: getRecordTimestamp(record) }))
        .filter((point) => point.value != null),
    };
  }

  function getDailySummaryCacheSize() {
    return dailySummaryCache.size;
  }

  function buildClinicalLog(sourceRecords) {
    return groupRecordsByLocalDate(sourceRecords).map((group) => {
      const usedIds = new Set();
      const primary = {};
      PRIMARY_TYPES.forEach((type) => {
        const record = group.records.find((item) => item.type === type && !usedIds.has(item.id));
        if (record) {
          primary[type] = record;
          usedIds.add(record.id);
        }
      });
      return {
        ...group,
        primary,
        additionalRecords: group.records.filter((record) => !usedIds.has(record.id)),
        summary: calculateDailySummary(group.records),
      };
    });
  }

  function buildDetailedReport(sourceRecords) {
    return groupRecordsByLocalDate(sourceRecords).map((group) => ({
      ...group,
      summary: calculateDailySummary(group.records),
    }));
  }

  function buildClinicalReport(sourceRecords) {
    return {
      id: 'clinical',
      title: 'Clinical Log',
      groups: buildClinicalLog(sourceRecords),
    };
  }

  function buildDetailedReportData(sourceRecords) {
    return {
      id: 'detailed',
      title: 'Detailed Report',
      groups: buildDetailedReport(sourceRecords),
    };
  }

  const REPORT_REGISTRY = [
    {
      id: 'clinical',
      title: 'Clinical Log',
      description: 'A compact table modeled after a paper blood-sugar log.',
      builder: buildClinicalReport,
      printLayout: 'landscape',
    },
    {
      id: 'detailed',
      title: 'Detailed Report',
      description: 'Every selected record with dose details and notes.',
      builder: buildDetailedReportData,
      printLayout: 'portrait',
    },
  ];

  function getReportDefinition(reportId) {
    return REPORT_REGISTRY.find((report) => report.id === reportId) || REPORT_REGISTRY[0];
  }

  function isRecordDeleted(record) {
    return Boolean(record?.deletedAt || record?.deleted_at);
  }

  function activeRecords() {
    return records.filter((record) => !isRecordDeleted(record));
  }

  function deletedRecords() {
    return sortRecordsNewestFirst(records.filter(isRecordDeleted));
  }

  function getHistoryInitialWindowDays() {
    const value = trackerData.settings?.historyInitialWindowDays;
    if (value === 'all') return null;
    const numeric = Number(value);
    return HISTORY_WINDOW_OPTIONS.some((option) => option.days === numeric)
      ? numeric
      : DEFAULT_HISTORY_WINDOW_DAYS;
  }

  function resetHistoryVisibleWindow() {
    historyVisibleDayCount = getHistoryInitialWindowDays();
  }

  function getVisibleHistoryGroups(groups, visibleDayCount) {
    if (visibleDayCount == null) return groups;
    return groups.slice(0, visibleDayCount);
  }

  function getHistoryFilterCount(filters) {
    return [
      filters.range !== 'all',
      filters.type !== 'All',
    ].filter(Boolean).length;
  }

  function getHistoryVisibleSummary(groups) {
    const dayCount = groups.length;
    const entryCount = groups.reduce((count, group) => count + group.records.length, 0);
    return `${dayCount} ${dayCount === 1 ? 'Day' : 'Days'} • ${entryCount} ${entryCount === 1 ? 'Entry' : 'Entries'}`;
  }

  function getTodaysActivityRecords(sourceRecords, todayDateKey = getLocalDateKey()) {
    return sourceRecords
      .filter((record) => !isRecordDeleted(record))
      .filter((record) => getRecordEventDateKey(record) === todayDateKey)
      .sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a));
  }

  function formatDateKey(dateKey) {
    const timestamp = createDateStartTimestamp(dateKey);
    return timestamp == null ? dateKey : formatDate(new Date(timestamp));
  }

  function formatShortDateKey(dateKey) {
    const timestamp = createDateStartTimestamp(dateKey);
    if (timestamp == null) return dateKey;
    return new Intl.DateTimeFormat(navigator.language || undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(timestamp));
  }

  function formatDateRangeText(filters) {
    const filtered = filterRecordsByDateRange(records, filters);
    const bounds = getDateRangeBounds(filters.range, filters.startDate, filters.endDate);
    if (!filtered.length) {
      if (bounds.startDate && bounds.endDate) return `${formatShortDateKey(bounds.startDate)} through ${formatShortDateKey(bounds.endDate)}`;
      return 'the selected range';
    }
    const dateKeys = filtered.map(getRecordEventDateKey).sort();
    return `${formatShortDateKey(dateKeys[0])} through ${formatShortDateKey(dateKeys[dateKeys.length - 1])}`;
  }

  function formatSummaryValue(value, formatter, fallback = 'No data') {
    return value == null ? fallback : formatter(value);
  }

  function todaysRecords() {
    return getTodaysActivityRecords(records);
  }

  function latestRecordForType(type) {
    return todaysRecords().find((record) => record.type === type) || null;
  }

  function formatBloodSugar(value) {
    return value == null ? '' : `${value} mg/dL`;
  }

  function formatInsulin(value) {
    if (value == null) return '';
    return `${value} ${value === 1 ? 'unit' : 'units'}`;
  }

  function formatDoseNumber(value) {
    if (value == null) return '';
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2).replace(/\.?0+$/, '') : '';
  }

  function formatCarbs(value) {
    return value == null ? '' : `${value} g carbs`;
  }

  function formatMealComponentLabel(component) {
    const item = normalizeMealComponent(component);
    if (!item) return '';
    const name = [item.emojiSnapshot, item.nameSnapshot || 'Manual amount'].filter(Boolean).join(' ');
    return item.quantity && item.quantity !== 1 && item.componentType !== 'manual'
      ? `${formatCarbAmount(item.quantity)}× ${name}`
      : name;
  }

  function getMealComponentSummary(record) {
    const components = Array.isArray(record?.mealComponents)
      ? record.mealComponents.map(normalizeMealComponent).filter(Boolean)
      : [];
    if (components.length) {
      return components.map(formatMealComponentLabel).filter(Boolean).join(' · ');
    }
    return '';
  }

  function formatActivityDuration(value) {
    return value == null ? '' : `${value} min`;
  }

  function formatRange(range) {
    if (!range) return '';
    if (range.minGlucose == null) return `Below ${Number(range.maxGlucose) + 1} mg/dL`;
    if (range.maxGlucose == null) return `${range.minGlucose}+ mg/dL`;
    return `${range.minGlucose}-${range.maxGlucose} mg/dL`;
  }

  function formatRecordDateTime(timestamp) {
    const date = new Date(timestamp);
    return `${formatDate(date)} at ${formatTime(timestamp)}`;
  }

  function getMealDoseSummary(record) {
    if (!record || record.doseCalculationStatus !== 'calculated' || record.suggestedTotalUnits == null) return '';
    const given = formatInsulin(record.administeredInsulinUnits ?? record.insulinUnits) || 'No insulin';
    const suggested = formatInsulin(record.suggestedTotalUnits);
    if (record.type === BEDTIME_CONTEXT_TYPE) {
      return `Given: ${given} · Suggested: ${suggested}`;
    }
    if (record.suggestedCarbDoseUnits != null || record.rawCarbDose != null) {
      const parts = [];
      if (record.suggestedCarbDoseUnits != null) parts.push(`${formatInsulin(record.suggestedCarbDoseUnits)} carbs`);
      if (record.suggestedCorrectionUnits != null) parts.push(`${formatInsulin(record.suggestedCorrectionUnits)} correction`);
      const breakdown = parts.length ? parts.join(' + ') : 'Carb coverage';
      return `Given: ${given} · Suggested: ${suggested} · ${breakdown}`;
    }
    const breakdown = `${formatInsulin(record.suggestedBaseUnits)} base + ${formatInsulin(record.suggestedCorrectionUnits)} correction`;
    return `Given: ${given} · Suggested: ${suggested} · ${breakdown}`;
  }

  function getEventTypeLabel(eventType) {
    return getEventTypeConfig(eventType).label;
  }

  function getRecordPrimaryValue(record) {
    if (!record) return '';
    if (record.eventType === 'meal') return formatCarbs(record.mealCarbs);
    if (record.eventType === 'activity') return record.activityDescription || 'Activity';
    if (record.eventType === 'check-insulin' && ['Snacks', 'Snack'].includes(record.type)) return formatCarbs(record.mealCarbs) || formatBloodSugar(record.bloodSugar) || formatInsulin(getRecordActualInsulin(record));
    if (record.eventType === 'check-insulin') return formatBloodSugar(record.bloodSugar) || formatCarbs(record.mealCarbs) || formatInsulin(getRecordActualInsulin(record));
    if (record.eventType === 'note') return record.notes ? 'Note' : '';
    return formatBloodSugar(record.bloodSugar);
  }

  function getRecordSecondaryLines(record) {
    if (!record) return [];
    if (record.eventType === 'meal') {
      return [
        record.type,
        record.mealDescription || '',
        record.notes || '',
      ].filter(Boolean);
    }
    if (record.eventType === 'activity') {
      return [
        [formatActivityDuration(record.activityDurationMinutes), record.activityIntensity].filter(Boolean).join(' · '),
        record.notes || '',
      ].filter(Boolean);
    }
    if (record.eventType === 'check-insulin') {
      const primary = getRecordPrimaryValue(record);
      const actualInsulin = formatInsulin(getRecordActualInsulin(record));
      const carbs = formatCarbs(record.mealCarbs);
      const foodSummary = getMealComponentSummary(record);
      return [
        carbs && carbs !== primary ? carbs : '',
        actualInsulin && actualInsulin !== primary ? actualInsulin : '',
        foodSummary,
        getMealDoseSummary(record),
        record.notes || '',
      ].filter(Boolean);
    }
    if (record.eventType === 'note') {
      return [record.notes || 'No note text'].filter(Boolean);
    }
    return [
      record.type,
      getMealDoseSummary(record),
      record.notes || '',
    ].filter(Boolean);
  }

  function getRecordDisplayTitle(record) {
    if (record.eventType === 'meal') return record.type;
    if (record.eventType === 'activity') return 'Activity';
    if (record.eventType === 'check-insulin') return normalizeRecordContext(record.type, 'check-insulin');
    if (record.eventType === 'note') return 'Note';
    return 'Blood Glucose';
  }

  function renderValuePills(record) {
    if (!record) return '';
    const values = [
      formatBloodSugar(record.bloodSugar),
      formatInsulin(getRecordActualInsulin(record)),
    ].filter(Boolean);
    return values.length
      ? `<div class="lee_lee_diabetes_card_values">${values.map((value) => `<span class="lee_lee_diabetes_pill">${escapeHtml(value)}</span>`).join('')}</div>`
      : '';
  }

  function getEntryCardContent(record) {
    return {
      title: getRecordDisplayTitle(record),
      primary: getRecordPrimaryValue(record),
      secondary: getRecordSecondaryLines(record),
      timestamp: getRecordTimestamp(record),
    };
  }

  function renderEntryCardContent(record) {
    const content = getEntryCardContent(record);
    return `
      <div>
        <div class="lee_lee_diabetes_timeline_type">${escapeHtml(content.title)}</div>
        ${content.primary ? `<div class="lee_lee_diabetes_timeline_values">${escapeHtml(content.primary)}</div>` : ''}
        ${content.secondary.map((line) => `<div class="lee_lee_diabetes_timeline_notes">${escapeHtml(line)}</div>`).join('')}
      </div>
    `;
  }

  function renderTrackerEntryCard(record, { variant = '', actions = '' } = {}) {
    const timestamp = getRecordTimestamp(record);
    return `
      <article class="lee_lee_diabetes_timeline_item${variant ? ` lee_lee_diabetes_timeline_item--${escapeHtml(variant)}` : ''}">
        ${renderEntryCardContent(record)}
        <div class="lee_lee_diabetes_timeline_footer">
          <time class="lee_lee_diabetes_timeline_time" datetime="${escapeHtml(new Date(timestamp).toISOString())}">${escapeHtml(formatTime(timestamp))}</time>
          ${actions}
        </div>
      </article>
    `;
  }

  function getTrackerNavLabel(active) {
    return TRACKER_NAV_ITEMS.find(([action]) => action === active)?.[1] || 'Menu';
  }

  function renderTrackerNav(active) {
    return `
      <div class="lee_lee_diabetes_nav_shell ${trackerMenuOpen ? 'is-open' : ''}">
        <button
          type="button"
          class="lee_lee_diabetes_mobile_nav_button"
          data-action="toggle-tracker-nav"
          aria-controls="lee-lee-diabetes-nav"
          aria-expanded="${trackerMenuOpen ? 'true' : 'false'}"
        >
          <span>${escapeHtml(getTrackerNavLabel(active))}</span>
          <span aria-hidden="true">☰</span>
        </button>
        <nav class="lee_lee_diabetes_nav" id="lee-lee-diabetes-nav" aria-label="Lee-Lee’s Tracker sections">
          ${TRACKER_NAV_ITEMS.map(([action, label]) => `
            <button
              type="button"
              class="lee_lee_diabetes_nav_button ${active === action ? 'is-active' : ''}"
              data-action="${escapeHtml(action)}"
              aria-current="${active === action ? 'page' : 'false'}"
            >${escapeHtml(label)}</button>
          `).join('')}
        </nav>
      </div>
    `;
  }

  function renderTrackerTop({ active = 'today', kicker = formatDate(), title = 'Lee-Lee’s Tracker' } = {}) {
    const settingsActive = active === 'settings';
    return `
      <section class="lee_lee_diabetes_top">
        <div class="lee_lee_diabetes_top_row">
          <div class="lee_lee_diabetes_top_title_group">
            <p class="lee_lee_diabetes_date">${escapeHtml(kicker)}</p>
            <h1 class="lee_lee_diabetes_title" id="lee-lee-diabetes-title">${escapeHtml(title)}</h1>
            ${renderPersistenceStatus()}
          </div>
          <button
            type="button"
            class="lee_lee_diabetes_settings_shortcut ${settingsActive ? 'is-active' : ''}"
            data-action="settings"
            aria-label="${settingsActive ? 'Close Settings' : 'Settings'}"
            aria-pressed="${settingsActive ? 'true' : 'false'}"
            aria-current="${settingsActive ? 'page' : 'false'}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"></circle>
              <path
                d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z">
              </path>
            </svg>
          </button>
        </div>
      </section>
    `;
  }

  function renderHome() {
    currentEditor = null;
    const root = getRoot();
    if (!root) return;
    const timeline = todaysRecords();
    root.innerHTML = `
      ${renderTrackerTop({ active: 'today' })}
      ${renderTrackerNav('today')}
      <section class="lee_lee_diabetes_today_actions" aria-label="Log an entry">
        <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary lee_lee_diabetes_log_entry_button" data-action="log-entry">+ Log Entry</button>
      </section>
      <section aria-labelledby="lee-lee-diabetes-timeline-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-diabetes-timeline-title">Today’s Activity</h2>
        ${timeline.length ? `<div class="lee_lee_diabetes_timeline">${timeline.map(renderTimelineItem).join('')}</div>` : '<p class="lee_lee_diabetes_empty">No entries today.</p>'}
      </section>
    `;
  }

  function renderPrimaryCard(type) {
    const record = latestRecordForType(type);
    const isComplete = Boolean(record);
    return `
      <button type="button" class="lee_lee_diabetes_card ${isComplete ? 'is-complete' : ''}" data-action="edit-primary" data-type="${escapeHtml(type)}">
        <span>
          <span class="lee_lee_diabetes_card_title">${escapeHtml(type)}</span>
          <span class="lee_lee_diabetes_card_status">${isComplete ? '✓ Completed' : '○ Not recorded'}</span>
          ${renderValuePills(record)}
        </span>
        <span class="lee_lee_diabetes_card_icon" aria-hidden="true">${isComplete ? '✓' : '+'}</span>
      </button>
    `;
  }

  function renderTimelineItem(record) {
    return renderTrackerEntryCard(record, {
      variant: 'today',
      actions: `<button type="button" class="lee_lee_diabetes_timeline_edit" data-action="edit-today-record" data-id="${escapeHtml(record.id)}">Edit</button>`,
    });
  }

  function renderFilterControls(filters, scope) {
    const prefix = scope === 'export' ? 'export' : (scope === 'reports' ? 'reports' : 'history');
    const dateOptions = (scope === 'export' ? EXPORT_RANGE_OPTIONS : (scope === 'reports' ? REPORT_RANGE_OPTIONS : DATE_RANGE_OPTIONS))
      .map((option) => `<option value="${escapeHtml(option.value)}" ${filters.range === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`)
      .join('');
    const typeControl = scope === 'history'
      ? `
        <label class="lee_lee_diabetes_field">
          Entry Type
          <select class="lee_lee_diabetes_select" name="type" data-filter-scope="${prefix}">
            ${['All', ...EXTRA_TYPES].map((type) => `<option value="${escapeHtml(type)}" ${filters.type === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}
          </select>
        </label>
      `
      : '';
    return `
      <form class="lee_lee_diabetes_filters" data-${prefix}-filters>
        <label class="lee_lee_diabetes_field">
          Date Range
          <select class="lee_lee_diabetes_select" name="range" data-filter-scope="${prefix}">
            ${dateOptions}
          </select>
        </label>
        ${typeControl}
        <label class="lee_lee_diabetes_field ${filters.range === 'custom' ? '' : 'is-hidden'}" data-custom-range-field="${prefix}">
          Start Date
          <input class="lee_lee_diabetes_input" name="startDate" type="date" value="${escapeHtml(filters.startDate || '')}" data-filter-scope="${prefix}">
        </label>
        <label class="lee_lee_diabetes_field ${filters.range === 'custom' ? '' : 'is-hidden'}" data-custom-range-field="${prefix}">
          End Date
          <input class="lee_lee_diabetes_input" name="endDate" type="date" value="${escapeHtml(filters.endDate || '')}" data-filter-scope="${prefix}">
        </label>
      </form>
    `;
  }

  function renderHistoryFilterTrigger(visibleGroups) {
    const count = getHistoryFilterCount(historyFilters);
    return `
      <div class="lee_lee_diabetes_history_filter_bar">
        <p class="lee_lee_diabetes_filter_summary" aria-live="polite">${escapeHtml(getHistoryVisibleSummary(visibleGroups))}</p>
        <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost lee_lee_diabetes_filter_button" data-action="open-history-filters">
          Filters${count ? ` <span class="lee_lee_diabetes_filter_badge">${escapeHtml(count)}</span>` : ''}
        </button>
      </div>
    `;
  }

  function renderHistoryFilterSheet() {
    if (!historyFilterSheetOpen) return '';
    const filters = historyDraftFilters;
    return `
      <div class="lee_lee_diabetes_sheet_backdrop" data-action="cancel-history-filters"></div>
      <section class="lee_lee_diabetes_sheet" role="dialog" aria-modal="true" aria-labelledby="lee-lee-history-filter-title" data-history-filter-sheet>
        <h2 class="lee_lee_diabetes_editor_title" id="lee-lee-history-filter-title">History Filters</h2>
        <form class="lee_lee_diabetes_filters" data-history-filter-draft>
          <label class="lee_lee_diabetes_field">
            Date Range
            <select class="lee_lee_diabetes_select" name="range">
              ${DATE_RANGE_OPTIONS.map((option) => `<option value="${escapeHtml(option.value)}" ${filters.range === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
            </select>
          </label>
          <label class="lee_lee_diabetes_field">
            Entry Type
            <select class="lee_lee_diabetes_select" name="type">
              ${['All', ...EXTRA_TYPES].map((type) => `<option value="${escapeHtml(type)}" ${filters.type === type ? 'selected' : ''}>${escapeHtml(type === 'All' ? 'All Entry Types' : type)}</option>`).join('')}
            </select>
          </label>
          <label class="lee_lee_diabetes_field ${filters.range === 'custom' ? '' : 'is-hidden'}" data-custom-range-field="history-draft">
            Start Date
            <input class="lee_lee_diabetes_input" name="startDate" type="date" value="${escapeHtml(filters.startDate || '')}">
          </label>
          <label class="lee_lee_diabetes_field ${filters.range === 'custom' ? '' : 'is-hidden'}" data-custom-range-field="history-draft">
            End Date
            <input class="lee_lee_diabetes_input" name="endDate" type="date" value="${escapeHtml(filters.endDate || '')}">
          </label>
        </form>
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="cancel-history-filters">Cancel</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="clear-history-filters">Clear Filters</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="apply-history-filters">Apply</button>
        </div>
      </section>
    `;
  }

  function renderSummaryGrid(summary) {
    const items = [
      ['Entries', summary.entryCount],
      ['Average', formatSummaryValue(summary.averageBloodSugar, formatBloodSugar)],
      ['High', formatSummaryValue(summary.highestBloodSugar, formatBloodSugar)],
      ['Low', formatSummaryValue(summary.lowestBloodSugar, formatBloodSugar)],
      ['Total insulin', formatSummaryValue(summary.totalInsulin, formatInsulin)],
    ];
    return `
      <dl class="lee_lee_diabetes_summary_grid">
        ${items.map(([label, value]) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
          </div>
        `).join('')}
      </dl>
    `;
  }

  function renderHistory() {
    currentEditor = { mode: 'history' };
    const root = getRoot();
    if (!root) return;
    if (historyVisibleDayCount === null && getHistoryInitialWindowDays() !== null) {
      resetHistoryVisibleWindow();
    }
    const visibleRecords = activeRecords();
    const filtered = getFilteredRecords(visibleRecords, historyFilters);
    const groups = groupRecordsByLocalDate(filtered);
    const visibleGroups = getVisibleHistoryGroups(groups, historyVisibleDayCount);
    const hasOlderGroups = visibleGroups.length < groups.length;
    const emptyMessage = visibleRecords.length
      ? `
        <p class="lee_lee_diabetes_empty" role="status">No records match these filters.</p>
        <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost lee_lee_diabetes_extra" data-action="reset-history-filters">Reset Filters</button>
      `
      : `
        <p class="lee_lee_diabetes_empty" role="status">No records yet.</p>
        <p class="lee_lee_diabetes_help">Saved blood-sugar and insulin entries will appear here.</p>
      `;
    root.innerHTML = `
      ${renderTrackerTop({ active: 'history', title: 'History' })}
      ${renderTrackerNav('history')}
      ${renderHistoryFilterTrigger(visibleGroups)}
      <section class="lee_lee_diabetes_history_list" aria-label="History dates">
        ${visibleGroups.length ? visibleGroups.map(renderHistoryDateCard).join('') : emptyMessage}
      </section>
      ${hasOlderGroups ? `<button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost lee_lee_diabetes_extra" data-action="load-older-history">Load Older Records</button>` : ''}
      ${renderHistoryFilterSheet()}
    `;
    focusHistorySheet(root);
  }

  function renderHistoryDateCard(group) {
    const summary = calculateDailySummary(group.records);
    const types = [...new Set(group.records.map((record) => record.type))].join(' · ');
    return `
      <button type="button" class="lee_lee_diabetes_history_date" data-action="history-date" data-date="${escapeHtml(group.dateKey)}">
        <span>
          <span class="lee_lee_diabetes_card_title">${escapeHtml(formatDateKey(group.dateKey))}</span>
          <span class="lee_lee_diabetes_timeline_values">${escapeHtml(summary.entryCount)} ${summary.entryCount === 1 ? 'entry' : 'entries'} · Average: ${escapeHtml(formatSummaryValue(summary.averageBloodSugar, formatBloodSugar))} · Total insulin: ${escapeHtml(formatSummaryValue(summary.totalInsulin, formatInsulin))}</span>
          <span class="lee_lee_diabetes_timeline_notes">${escapeHtml(types)}</span>
        </span>
        <span class="lee_lee_diabetes_card_icon" aria-hidden="true">›</span>
      </button>
    `;
  }

  function renderHistoryDay(dateKey) {
    const root = getRoot();
    if (!root) return;
    const dayRecords = sortRecordsChronologically(activeRecords().filter((record) => getRecordEventDateKey(record) === dateKey));
    const summary = calculateDailySummary(dayRecords);
    currentEditor = {
      mode: 'history-day',
      dateKey,
    };
    root.innerHTML = `
      ${renderTrackerTop({ active: 'history', kicker: 'History', title: formatDateKey(dateKey) })}
      ${renderTrackerNav('history')}
      <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost lee_lee_diabetes_extra" data-action="history">← All Dates</button>
      ${renderSummaryGrid(summary)}
      <section class="lee_lee_diabetes_timeline" aria-label="Records for ${escapeHtml(formatDateKey(dateKey))}">
        ${dayRecords.length ? dayRecords.map(renderHistoryRecord).join('') : '<p class="lee_lee_diabetes_empty" role="status">No records match these filters.</p>'}
      </section>
    `;
  }

  function renderHistoryRecord(record) {
    return renderTrackerEntryCard(record, {
      variant: 'history',
      actions: `
        <div class="lee_lee_diabetes_timeline_actions" aria-label="History record actions">
          <button type="button" class="lee_lee_diabetes_timeline_edit" data-action="edit-record" data-id="${escapeHtml(record.id)}">Edit</button>
          <button type="button" class="lee_lee_diabetes_timeline_edit lee_lee_diabetes_timeline_edit--danger" data-action="delete-record" data-id="${escapeHtml(record.id)}">Delete</button>
        </div>
      `,
    });
  }

  function renderFoodLibrary() {
    const root = getRoot();
    if (!root) return;
    currentEditor = { mode: 'foods' };
    const foods = searchFoodItems(foodLibrary, foodLibrarySearch);
    const meals = activeSavedMeals(savedMeals)
      .filter((meal) => searchTextMatches(meal.name, savedMealsSearch))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
    root.innerHTML = `
      ${renderTrackerTop({ active: 'foods', kicker: 'Food Library', title: 'Foods' })}
      ${renderTrackerNav('foods')}
      ${foodLibraryError ? `<p class="lee_lee_diabetes_error">${escapeHtml(foodLibraryError)}</p>` : ''}
      ${foodLibraryMessage ? `<p class="lee_lee_diabetes_save_status lee_lee_diabetes_save_status--saved">${escapeHtml(foodLibraryMessage)}</p>` : ''}
      <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-foods-add-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-foods-add-title">Add Food</h2>
        <div class="lee_lee_diabetes_food_form" data-food-library-editor>
          <input type="hidden" name="foodId" value="">
          <label class="lee_lee_diabetes_field">Food Name<input class="lee_lee_diabetes_input" name="foodName" type="text" maxlength="80" autocomplete="off" required></label>
          <label class="lee_lee_diabetes_field">Emoji<input class="lee_lee_diabetes_input" name="foodEmoji" type="text" maxlength="16" autocomplete="off"></label>
          <label class="lee_lee_diabetes_field">Carbs<input class="lee_lee_diabetes_input" name="foodCarbs" type="number" inputmode="decimal" min="0" step="0.1" autocomplete="off" required></label>
          <label class="lee_lee_diabetes_field">Serving Label<input class="lee_lee_diabetes_input" name="foodServingLabel" type="text" maxlength="80" autocomplete="off"></label>
          <label class="lee_lee_diabetes_field">Brand / Notes<input class="lee_lee_diabetes_input" name="foodBrand" type="text" maxlength="80" autocomplete="off"></label>
          <label class="lee_lee_diabetes_checkline"><input type="checkbox" name="foodFavorite"> Favorite</label>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="save-food-library-item">Save Food</button>
        </div>
      </section>
      <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-foods-list-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-foods-list-title">My Foods</h2>
        <label class="lee_lee_diabetes_field">Search Foods<input class="lee_lee_diabetes_input" name="foodLibrarySearch" type="search" value="${escapeHtml(foodLibrarySearch)}" autocomplete="off"></label>
        <div class="lee_lee_diabetes_food_list">
          ${foods.length ? foods.map(renderFoodLibraryRow).join('') : '<p class="lee_lee_diabetes_empty">No foods yet.</p>'}
        </div>
      </section>
      <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-meals-list-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-meals-list-title">My Meals</h2>
        <label class="lee_lee_diabetes_field">Search My Meals<input class="lee_lee_diabetes_input" name="savedMealsSearch" type="search" value="${escapeHtml(savedMealsSearch)}" autocomplete="off"></label>
        <div class="lee_lee_diabetes_food_list">
          ${meals.length ? meals.map(renderSavedMealLibraryRow).join('') : '<p class="lee_lee_diabetes_empty">No My Meals yet.</p>'}
        </div>
      </section>
    `;
  }

  function renderFoodLibraryRow(food) {
    const sourceLabel = formatFoodSourceLabel(food);
    const metadata = [food.brand, food.servingLabel, formatCarbs(food.carbs), sourceLabel].filter(Boolean).join(' · ');
    return `
      <article class="lee_lee_diabetes_food_item">
        <div>
          <strong>${food.emoji ? `<span class="lee_lee_diabetes_food_emoji" aria-hidden="true">${escapeHtml(food.emoji)}</span>` : ''}${escapeHtml(food.name)}</strong>
          <p>${escapeHtml(metadata)}</p>
          ${food.verificationNote ? `<p class="lee_lee_diabetes_food_note">${escapeHtml(food.verificationNote)}</p>` : ''}
        </div>
        <div class="lee_lee_diabetes_record_actions">
          <button type="button" class="lee_lee_diabetes_icon_button" data-action="toggle-food-favorite" data-id="${escapeHtml(food.id)}" aria-label="${food.favorite ? 'Remove favorite' : 'Mark favorite'}">${food.favorite ? '★' : '☆'}</button>
          <button type="button" class="lee_lee_diabetes_timeline_edit" data-action="edit-food-library-item" data-id="${escapeHtml(food.id)}">Edit</button>
          <button type="button" class="lee_lee_diabetes_timeline_edit lee_lee_diabetes_timeline_edit--danger" data-action="delete-food-library-item" data-id="${escapeHtml(food.id)}">Delete</button>
        </div>
      </article>
    `;
  }

  function renderSavedMealLibraryRow(meal) {
    return `
      <article class="lee_lee_diabetes_food_item">
        <div>
          <strong>${escapeHtml(meal.name)}</strong>
          <p>${escapeHtml(formatCarbs(meal.totalCarbs))}</p>
          <p>${escapeHtml(meal.components.map(formatMealComponentLabel).join(' · '))}</p>
        </div>
        <div class="lee_lee_diabetes_record_actions">
          <button type="button" class="lee_lee_diabetes_timeline_edit lee_lee_diabetes_timeline_edit--danger" data-action="delete-saved-meal" data-id="${escapeHtml(meal.id)}">Delete</button>
        </div>
      </article>
    `;
  }

  function renderDeleteConfirmation(record) {
    const root = getRoot();
    if (!root) return;
    currentEditor = {
      mode: 'delete-confirmation',
      pendingDeleteId: record.id,
      returnDateKey: getRecordEventDateKey(record),
    };
    const actual = getRecordActualInsulin(record);
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title" role="dialog" aria-modal="true">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Delete this record?</h1>
        <dl class="lee_lee_diabetes_confirm_list">
          <div>
            <dt>Entry</dt>
            <dd>${escapeHtml(getRecordDisplayTitle(record))}</dd>
          </div>
          <div>
            <dt>Context</dt>
            <dd>${escapeHtml(record.type)}</dd>
          </div>
          <div>
            <dt>Date and time</dt>
            <dd>${escapeHtml(formatRecordDateTime(record.recordTimestamp))}</dd>
          </div>
          <div>
            <dt>Value</dt>
            <dd>${escapeHtml(getRecordPrimaryValue(record) || 'No value')}</dd>
          </div>
        </dl>
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="cancel-delete">Cancel</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--danger" data-action="confirm-delete-record">Delete Record</button>
        </div>
      </section>
    `;
    root.querySelector('[data-action="cancel-delete"]')?.focus();
  }

  function getExportRecords() {
    return filterRecordsByDateRange(activeRecords(), exportOptions);
  }

  function getReportRecords() {
    return filterRecordsByDateRange(activeRecords(), reportOptions);
  }

  function renderReportRangeControls() {
    return `
      <section class="lee_lee_diabetes_editor lee_lee_diabetes_report_controls" aria-label="Report options">
        ${renderFilterControls(reportOptions, 'reports')}
        <p class="lee_lee_diabetes_filter_summary" aria-live="polite">${escapeHtml(formatDateRangeText(reportOptions))}</p>
      </section>
    `;
  }

  function renderReportViewTabs() {
    return `
      <div class="lee_lee_diabetes_report_tabs" role="tablist" aria-label="Report views">
        ${REPORT_VIEW_ITEMS.map(([view, label]) => `
          <button
            type="button"
            class="lee_lee_diabetes_nav_button ${reportOptions.view === view ? 'is-active' : ''}"
            data-action="report-view"
            data-view="${escapeHtml(view)}"
            role="tab"
            aria-selected="${reportOptions.view === view ? 'true' : 'false'}"
          >${escapeHtml(label)}</button>
        `).join('')}
      </div>
    `;
  }

  function renderMetricGrid(items) {
    const visibleItems = items.filter((item) => item && item.value !== '');
    if (!visibleItems.length) return '<p class="lee_lee_diabetes_empty" role="status">No data for this section.</p>';
    return `
      <dl class="lee_lee_diabetes_summary_grid lee_lee_diabetes_report_metric_grid">
        ${visibleItems.map(({ label, value, detail = '' }) => `
          <div>
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(value)}</dd>
            ${detail ? `<p>${escapeHtml(detail)}</p>` : ''}
          </div>
        `).join('')}
      </dl>
    `;
  }

  function pluralize(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function formatAverageGlucose(value) {
    return value == null ? 'No data' : formatBloodSugar(Math.round(value));
  }

  function formatAverageCarbs(value) {
    return value == null ? 'No data' : formatCarbs(Math.round(value));
  }

  function formatAverageInsulin(value) {
    return value == null ? 'No data' : formatInsulin(Number(value.toFixed(1)));
  }

  function formatPercent(value) {
    return value == null ? 'No data' : `${Math.round(value)}%`;
  }

  function renderReportsSummary(reportRecords) {
    const summary = calculateReportSummary(reportRecords, reportOptions);
    const targetItems = summary.glucose.targetRange ? [
      { label: 'In target range', value: formatPercent(summary.glucose.inRangePercent), detail: pluralize(summary.glucose.targetCounts.inRange, 'reading') },
      { label: 'Below target', value: formatPercent(summary.glucose.belowRangePercent), detail: pluralize(summary.glucose.targetCounts.below, 'reading') },
      { label: 'Above target', value: formatPercent(summary.glucose.aboveRangePercent), detail: pluralize(summary.glucose.targetCounts.above, 'reading') },
    ] : [
      { label: 'Target range', value: 'Not configured', detail: 'Target percentages will appear when settings include a target range.' },
    ];
    return `
      <section aria-labelledby="lee-lee-reports-summary-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-reports-summary-title">Summary</h2>
        ${renderMetricGrid([
          { label: 'Calendar days', value: String(summary.dayCount || 0), detail: `${summary.calendarDateCount} with entries` },
          { label: 'Entries', value: String(summary.entryCount) },
          { label: 'Glucose readings', value: String(summary.glucose.count) },
          { label: 'Insulin administrations', value: String(summary.insulin.count) },
          { label: 'Carb entries', value: String(summary.carbs.count) },
        ])}
        <h3 class="lee_lee_diabetes_section_title">Glucose</h3>
        ${renderMetricGrid([
          { label: 'Average glucose', value: formatAverageGlucose(summary.glucose.average), detail: summary.glucose.count ? pluralize(summary.glucose.count, 'reading') : '' },
          { label: 'Lowest glucose', value: formatSummaryValue(summary.glucose.min, formatBloodSugar) },
          { label: 'Highest glucose', value: formatSummaryValue(summary.glucose.max, formatBloodSugar) },
          ...targetItems,
        ])}
        <h3 class="lee_lee_diabetes_section_title">Insulin</h3>
        ${renderMetricGrid([
          { label: 'Total insulin given', value: formatSummaryValue(summary.insulin.total, formatInsulin) },
          { label: 'Average per day', value: formatAverageInsulin(summary.insulin.averagePerDay) },
          { label: 'Fast-acting total', value: formatSummaryValue(summary.insulin.fastActing.total, formatInsulin), detail: summary.insulin.fastActing.count ? pluralize(summary.insulin.fastActing.count, 'administration') : '' },
          { label: 'Fast-acting per day', value: formatAverageInsulin(summary.insulin.fastActingAveragePerDay) },
          { label: 'Long-acting total', value: formatSummaryValue(summary.insulin.longActing.total, formatInsulin), detail: summary.insulin.longActing.count ? pluralize(summary.insulin.longActing.count, 'administration') : '' },
          { label: 'Long-acting per day', value: formatAverageInsulin(summary.insulin.longActingAveragePerDay) },
          { label: 'Meal-related total', value: formatSummaryValue(summary.insulin.mealRelated.total, formatInsulin), detail: summary.insulin.mealRelated.count ? pluralize(summary.insulin.mealRelated.count, 'administration') : '' },
          { label: 'Meal-related average', value: formatAverageInsulin(summary.insulin.mealRelatedAverage) },
          { label: 'Correction total', value: formatSummaryValue(summary.insulin.correction.total, formatInsulin), detail: summary.insulin.correction.count ? pluralize(summary.insulin.correction.count, 'administration') : '' },
          { label: 'Correction average', value: formatAverageInsulin(summary.insulin.correctionAverage) },
        ])}
        <h3 class="lee_lee_diabetes_section_title">Carbohydrates</h3>
        ${renderMetricGrid([
          { label: 'Total carbs', value: formatSummaryValue(summary.carbs.total, formatCarbs) },
          { label: 'Average per day', value: formatAverageCarbs(summary.carbs.averagePerDay) },
          { label: 'Average per carb entry', value: formatAverageCarbs(summary.carbs.averagePerEntry), detail: summary.carbs.count ? pluralize(summary.carbs.count, 'entry', 'entries') : '' },
          { label: 'Carb entries', value: String(summary.carbs.count) },
        ])}
      </section>
    `;
  }

  function getChartBounds(series) {
    const timestamps = series.map((point) => point.timestamp);
    const values = series.map((point) => point.value);
    const minX = Math.min(...timestamps);
    const maxX = Math.max(...timestamps);
    const minY = Math.min(0, ...values);
    const maxY = Math.max(...values);
    return {
      minX,
      maxX: maxX === minX ? minX + 1 : maxX,
      minY,
      maxY: maxY === minY ? minY + 1 : maxY,
    };
  }

  function renderTrendChart(title, series, formatter, { targetRange = null } = {}) {
    if (!series.length) return `<p class="lee_lee_diabetes_empty" role="status">No ${escapeHtml(title.toLowerCase())} data for this range.</p>`;
    const width = 640;
    const height = 220;
    const pad = 32;
    const bounds = getChartBounds(series);
    const xFor = (timestamp) => pad + ((timestamp - bounds.minX) / (bounds.maxX - bounds.minX)) * (width - pad * 2);
    const yFor = (value) => height - pad - ((value - bounds.minY) / (bounds.maxY - bounds.minY)) * (height - pad * 2);
    const line = series.map((point) => `${xFor(point.timestamp).toFixed(1)},${yFor(point.value).toFixed(1)}`).join(' ');
    const targetBand = targetRange
      ? `<rect class="lee_lee_diabetes_chart_target" x="${pad}" y="${Math.min(yFor(targetRange.min), yFor(targetRange.max)).toFixed(1)}" width="${width - pad * 2}" height="${Math.abs(yFor(targetRange.min) - yFor(targetRange.max)).toFixed(1)}"></rect>`
      : '';
    return `
      <figure class="lee_lee_diabetes_chart">
        <figcaption>${escapeHtml(title)}</figcaption>
        <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)} chart with ${escapeHtml(series.length)} recorded values" preserveAspectRatio="none">
          ${targetBand}
          <line class="lee_lee_diabetes_chart_axis" x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}"></line>
          <line class="lee_lee_diabetes_chart_axis" x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}"></line>
          ${series.length > 1 ? `<polyline class="lee_lee_diabetes_chart_line" points="${line}"></polyline>` : ''}
          ${series.map((point) => `
            <circle class="lee_lee_diabetes_chart_point ${point.category === 'Long-acting' ? 'is-long-acting' : ''}" cx="${xFor(point.timestamp).toFixed(1)}" cy="${yFor(point.value).toFixed(1)}" r="5">
              <title>${escapeHtml(formatDateKey(getRecordEventDateKey(point.record)))} ${escapeHtml(formatTime(point.timestamp))} - ${escapeHtml(point.record.type)} - ${escapeHtml(formatter(point.value))}</title>
            </circle>
          `).join('')}
        </svg>
        <table class="lee_lee_diabetes_chart_table">
          <thead><tr><th scope="col">Time</th><th scope="col">Context</th><th scope="col">Value</th></tr></thead>
          <tbody>
            ${series.map((point) => `<tr><td>${escapeHtml(formatShortDateKey(getRecordEventDateKey(point.record)))} ${escapeHtml(formatTime(point.timestamp))}</td><td>${escapeHtml(point.record.type)}</td><td>${escapeHtml(formatter(point.value))}</td></tr>`).join('')}
          </tbody>
        </table>
      </figure>
    `;
  }

  function renderReportsTrends(reportRecords) {
    const series = buildTrendSeries(reportRecords);
    const targetRange = getGlucoseTargetRange();
    return `
      <section aria-labelledby="lee-lee-reports-trends-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-reports-trends-title">Trends</h2>
        ${renderTrendChart('Glucose Trend', series.glucose, formatBloodSugar, { targetRange })}
        ${renderTrendChart('Insulin Trend', series.insulin, formatInsulin)}
        ${renderTrendChart('Carbohydrate Trend', series.carbs, formatCarbs)}
      </section>
    `;
  }

  function renderContextAverageCard(context) {
    const metrics = [
      context.glucose.count ? `${formatAverageGlucose(context.glucose.average)} avg glucose (${pluralize(context.glucose.count, 'reading')})` : '',
      context.carbs.count ? `${formatAverageCarbs(context.carbs.average)} avg carbs (${pluralize(context.carbs.count, 'entry', 'entries')})` : '',
      context.insulin.count ? `${formatAverageInsulin(context.insulin.average)} avg insulin (${pluralize(context.insulin.count, 'administration')})` : '',
    ].filter(Boolean);
    return `
      <article class="lee_lee_diabetes_timeline_item lee_lee_diabetes_timeline_item--history">
        <div>
          <div class="lee_lee_diabetes_timeline_type">${escapeHtml(context.type)}</div>
          <div class="lee_lee_diabetes_timeline_values">${escapeHtml(pluralize(context.recordCount, 'record'))}</div>
          ${metrics.map((metric) => `<div class="lee_lee_diabetes_timeline_notes">${escapeHtml(metric)}</div>`).join('')}
        </div>
      </article>
    `;
  }

  function renderReportsAverages(reportRecords) {
    const averages = buildAveragesReport(reportRecords, reportOptions);
    const summary = averages.summary;
    return `
      <section aria-labelledby="lee-lee-reports-averages-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-reports-averages-title">Averages</h2>
        ${renderMetricGrid([
          { label: 'Average glucose', value: formatAverageGlucose(summary.glucose.average), detail: summary.glucose.count ? pluralize(summary.glucose.count, 'reading') : '' },
          { label: 'Insulin per administration', value: formatAverageInsulin(summary.insulin.average), detail: summary.insulin.count ? pluralize(summary.insulin.count, 'administration') : '' },
          { label: 'Insulin per day', value: formatAverageInsulin(summary.insulin.averagePerDay) },
          { label: 'Fast-acting per day', value: formatAverageInsulin(summary.insulin.fastActingAveragePerDay) },
          { label: 'Long-acting per day', value: formatAverageInsulin(summary.insulin.longActingAveragePerDay) },
          { label: 'Carbs per entry', value: formatAverageCarbs(summary.carbs.averagePerEntry), detail: summary.carbs.count ? pluralize(summary.carbs.count, 'entry', 'entries') : '' },
          { label: 'Carbs per day', value: formatAverageCarbs(summary.carbs.averagePerDay) },
          { label: 'Entries per day', value: summary.dayCount ? String(Math.round((summary.entryCount / summary.dayCount) * 10) / 10) : 'No data' },
          { label: 'Glucose readings per day', value: summary.dayCount ? String(Math.round((summary.glucose.count / summary.dayCount) * 10) / 10) : 'No data' },
          { label: 'Insulin administrations per day', value: summary.dayCount ? String(Math.round((summary.insulin.count / summary.dayCount) * 10) / 10) : 'No data' },
        ])}
        <h3 class="lee_lee_diabetes_section_title">Typical Day Averages</h3>
        <div class="lee_lee_diabetes_typical_day" aria-label="Typical day averages">
          ${averages.typicalDay.length ? averages.typicalDay.map((context) => `
            <article>
              <h4>${escapeHtml(context.type)}</h4>
              <p>${[
                context.glucose.count ? `${formatAverageGlucose(context.glucose.average)} avg` : '',
                context.carbs.count ? `${formatAverageCarbs(context.carbs.average)} avg` : '',
                context.insulin.count ? `${formatAverageInsulin(context.insulin.average)} avg${context.type === BEDTIME_CONTEXT_TYPE ? ' long-acting' : ''}` : '',
              ].filter(Boolean).map(escapeHtml).join(' · ')}</p>
            </article>
          `).join('') : '<p class="lee_lee_diabetes_empty">No Breakfast, Lunch, Dinner, or Bedtime averages for this range.</p>'}
        </div>
        <h3 class="lee_lee_diabetes_section_title">Context Averages</h3>
        <div class="lee_lee_diabetes_timeline">
          ${averages.contexts.length ? averages.contexts.map(renderContextAverageCard).join('') : '<p class="lee_lee_diabetes_empty">No context averages for this range.</p>'}
        </div>
      </section>
    `;
  }

  function renderReportsDetailedLog(reportRecords) {
    const groups = buildDetailedReport(reportRecords);
    return `
      <section aria-labelledby="lee-lee-reports-detail-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-reports-detail-title">Detailed Log</h2>
        <div class="lee_lee_diabetes_timeline">
          ${groups.length ? groups.map((group) => `
            <section>
              <h3 class="lee_lee_diabetes_section_title">${escapeHtml(formatDateKey(group.dateKey))}</h3>
              ${group.records.map((record) => renderTrackerEntryCard(record, { variant: 'history' })).join('')}
            </section>
          `).join('') : '<p class="lee_lee_diabetes_empty" role="status">No records are available for this date range.</p>'}
        </div>
      </section>
    `;
  }

  function renderReportsView(reportRecords) {
    if (reportOptions.view === 'trends') return renderReportsTrends(reportRecords);
    if (reportOptions.view === 'averages') return renderReportsAverages(reportRecords);
    if (reportOptions.view === 'detailed-log') return renderReportsDetailedLog(reportRecords);
    return renderReportsSummary(reportRecords);
  }

  function renderReports() {
    currentEditor = { mode: 'reports' };
    const root = getRoot();
    if (!root) return;
    const reportRecords = getReportRecords();
    const rangeText = formatDateRangeText(reportOptions);
    root.innerHTML = `
      ${renderTrackerTop({ active: 'reports', title: 'Reports' })}
      ${renderTrackerNav('reports')}
      <div class="lee_lee_diabetes_report_control_stack">
        ${renderReportRangeControls()}
        ${renderReportViewTabs()}
      </div>
      <section class="lee_lee_diabetes_report_actions" aria-label="Report export">
        <label class="lee_lee_diabetes_field">
          Print Layout
          <select class="lee_lee_diabetes_select" name="layout" data-filter-scope="reports">
            ${REPORT_REGISTRY.map((layout) => `<option value="${escapeHtml(layout.id)}" ${reportOptions.layout === layout.id ? 'selected' : ''}>${escapeHtml(layout.title)}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="print-report" ${reportRecords.length ? '' : 'disabled'}>Print or Save as PDF</button>
      </section>
      <p class="lee_lee_diabetes_help">${escapeHtml(reportRecords.length)} ${reportRecords.length === 1 ? 'record' : 'records'} from ${escapeHtml(rangeText)}.</p>
      <div class="lee_lee_diabetes_reports_body">
        ${renderReportsView(reportRecords)}
      </div>
      <section class="lee_lee_diabetes_report_preview" aria-label="Printable report preview">
        ${renderReportDocument(reportOptions.layout, reportRecords, rangeText, { includeSummary: true, filters: reportOptions })}
      </section>
    `;
  }

  function renderExport() {
    currentEditor = { mode: 'export' };
    const root = getRoot();
    if (!root) return;
    const exportRecords = getExportRecords();
    const rangeText = formatDateRangeText(exportOptions);
    root.innerHTML = `
      ${renderTrackerTop({ active: 'export', title: 'Export' })}
      ${renderTrackerNav('export')}
      <section class="lee_lee_diabetes_editor lee_lee_diabetes_export_controls" aria-label="Export options">
        ${renderFilterControls(exportOptions, 'export')}
        <label class="lee_lee_diabetes_field">
          Report Layout
          <select class="lee_lee_diabetes_select" name="layout" data-filter-scope="export">
            ${REPORT_REGISTRY.map((layout) => `<option value="${escapeHtml(layout.id)}" ${exportOptions.layout === layout.id ? 'selected' : ''}>${escapeHtml(layout.title)}</option>`).join('')}
          </select>
        </label>
        <p class="lee_lee_diabetes_help">${escapeHtml(exportRecords.length)} ${exportRecords.length === 1 ? 'record' : 'records'} from ${escapeHtml(rangeText)}.</p>
        <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="print-report" ${exportRecords.length ? '' : 'disabled'}>Print or Save as PDF</button>
        ${exportRecords.length ? '' : '<p class="lee_lee_diabetes_empty" role="status">No records are available for this date range.</p>'}
      </section>
      <section class="lee_lee_diabetes_report_preview" aria-label="Printable report preview">
        ${renderReportPreview(exportRecords, rangeText)}
      </section>
    `;
  }

  function renderReportPreview(exportRecords, rangeText) {
    return renderReportDocument(exportOptions.layout, exportRecords, rangeText);
  }

  function renderReportDocument(reportId, exportRecords, rangeText, options = {}) {
    const selectedReport = getReportDefinition(reportId);
    const reportData = selectedReport.builder(exportRecords);
    return `
      <article class="lee_lee_diabetes_report ${selectedReport.printLayout === 'landscape' ? 'lee_lee_diabetes_report--landscape' : ''}">
        ${renderReportHeader(rangeText)}
        ${options.includeSummary ? renderPrintableReportSummary(exportRecords, options.filters || reportOptions) : ''}
        ${selectedReport.id === 'clinical'
          ? renderClinicalLogReport(reportData)
          : renderDetailedReport(reportData)}
      </article>
    `;
  }

  function renderPrintableReportSummary(sourceRecords, filters = reportOptions) {
    const summary = calculateReportSummary(sourceRecords, filters);
    if (!sourceRecords.length) return '';
    return `
      <section class="lee_lee_diabetes_report_section lee_lee_diabetes_report_summary">
        <h3>Summary</h3>
        <dl class="lee_lee_diabetes_report_summary_grid">
          ${[
            ['Days', summary.dayCount || 0],
            ['Entries', summary.entryCount],
            ['Glucose readings', summary.glucose.count],
            ['Average glucose', formatAverageGlucose(summary.glucose.average)],
            ['Lowest glucose', formatSummaryValue(summary.glucose.min, formatBloodSugar)],
            ['Highest glucose', formatSummaryValue(summary.glucose.max, formatBloodSugar)],
            ['Insulin given', formatSummaryValue(summary.insulin.total, formatInsulin)],
            ['Fast-acting insulin', formatSummaryValue(summary.insulin.fastActing.total, formatInsulin)],
            ['Long-acting insulin', formatSummaryValue(summary.insulin.longActing.total, formatInsulin)],
            ['Total carbs', formatSummaryValue(summary.carbs.total, formatCarbs)],
          ].map(([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `).join('')}
        </dl>
      </section>
    `;
  }

  function getPatientSettings() {
    return trackerData.settings && typeof trackerData.settings === 'object'
      ? trackerData.settings
      : {};
  }

  function renderReportHeader(rangeText) {
    const settings = getPatientSettings();
    const details = [
      ['Patient', settings.patientName || ''],
      ['Date of birth', settings.patientBirthDate ? formatShortDateKey(settings.patientBirthDate) : ''],
      ['Clinic', settings.clinicName || ''],
      ['Report range', rangeText],
      ['Generated', `${formatDate(new Date())} at ${formatTime(Date.now())}`],
    ];
    return `
      <header class="lee_lee_diabetes_report_header">
        <h2>Glucose &amp; Insulin Log</h2>
        <dl>
          ${details.map(([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `).join('')}
        </dl>
      </header>
    `;
  }

  function renderClinicalLogReport(reportData) {
    const rows = reportData.groups;
    if (!rows.length) return '';
    return `
      <section class="lee_lee_diabetes_report_section">
        <h3>Clinical Log</h3>
        <table class="lee_lee_diabetes_clinical_table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              ${PRIMARY_TYPES.map((type) => `
                <th scope="col">${escapeHtml(type)} BG</th>
                <th scope="col">${escapeHtml(type)} Insulin</th>
              `).join('')}
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(renderClinicalLogRow).join('')}
          </tbody>
        </table>
      </section>
    `;
  }

  function renderClinicalLogRow(group) {
    const additional = group.additionalRecords.length
      ? `Additional events: ${group.additionalRecords.map((record) => `${getRecordDisplayTitle(record)} ${record.type} ${formatTime(getRecordTimestamp(record))} ${getRecordPrimaryValue(record) || 'No value'}${record.notes ? ` (${record.notes})` : ''}`).join('; ')}`
      : '';
    const notes = [
      ...PRIMARY_TYPES.map((type) => group.primary[type]?.notes || '').filter(Boolean),
      additional,
    ].filter(Boolean).join(' | ');
    return `
      <tr>
        <th scope="row">${escapeHtml(formatShortDateKey(group.dateKey))}</th>
        ${PRIMARY_TYPES.map((type) => {
          const record = group.primary[type];
          const bloodSugar = record ? formatClinicalLogCell(record.bloodSugar, formatBloodSugar) : '';
          const insulin = record ? formatClinicalLogCell(getRecordActualInsulin(record), formatInsulin) : '';
          return `
            <td>${escapeHtml(bloodSugar)}</td>
            <td>${escapeHtml(insulin)}</td>
          `;
        }).join('')}
        <td>${escapeHtml(notes)}</td>
      </tr>
    `;
  }

  function formatClinicalLogCell(value, formatter) {
    if (value == null || value === '') return '';
    const formatted = formatter(value);
    return formatted == null || formatted === '' ? '' : formatted;
  }

  function renderDetailedReport(reportData) {
    const groups = reportData.groups;
    if (!groups.length) return '';
    return `
      <section class="lee_lee_diabetes_report_section">
        <h3>Detailed Report</h3>
        ${groups.map((group) => `
          <section class="lee_lee_diabetes_report_day">
            <h4>${escapeHtml(formatDateKey(group.dateKey))}</h4>
            ${renderSummaryGrid(group.summary)}
            <table class="lee_lee_diabetes_detail_table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Event</th>
                  <th scope="col">Type</th>
                  <th scope="col">Carbs</th>
                  <th scope="col">Description</th>
                  <th scope="col">Activity</th>
                  <th scope="col">Blood Sugar</th>
                  <th scope="col">Insulin Given</th>
                  <th scope="col">Suggested</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                ${group.records.map(renderDetailedReportRow).join('')}
              </tbody>
            </table>
          </section>
        `).join('')}
      </section>
    `;
  }

  function renderDetailedReportRow(record) {
    const suggestedParts = [
      record.suggestedTotalUnits == null ? '' : formatInsulin(record.suggestedTotalUnits),
      record.suggestedCarbDoseUnits == null
        ? ''
        : `${formatInsulin(record.suggestedCarbDoseUnits)} carb coverage`,
      record.suggestedBaseUnits == null && record.suggestedCorrectionUnits == null
        ? ''
        : (record.suggestedBaseUnits == null
          ? `${formatInsulin(record.suggestedCorrectionUnits)} correction`
          : `${formatInsulin(record.suggestedBaseUnits)} base + ${formatInsulin(record.suggestedCorrectionUnits)} correction`),
      record.doseCalculationStatus && record.doseCalculationStatus !== 'calculated' && record.doseCalculationStatus !== 'manual'
        ? record.doseCalculationStatus
        : '',
    ].filter(Boolean).join(' · ');
    const planName = record.insulinPlanSnapshot?.name || record.insulinPlanId || '';
    return `
      <tr>
        <td>${escapeHtml(formatTime(getRecordTimestamp(record)))}</td>
        <td>${escapeHtml(getEventTypeLabel(record.eventType))}</td>
        <td>${escapeHtml(record.type)}</td>
        <td>${escapeHtml(formatCarbs(record.mealCarbs) || '—')}</td>
        <td>${escapeHtml(record.mealDescription || '—')}</td>
        <td>${escapeHtml([record.activityDescription, formatActivityDuration(record.activityDurationMinutes), record.activityIntensity].filter(Boolean).join(' · ') || '—')}</td>
        <td>${escapeHtml(formatBloodSugar(record.bloodSugar) || '—')}</td>
        <td>${escapeHtml(formatInsulin(getRecordActualInsulin(record)) || '—')}</td>
        <td>${escapeHtml(suggestedParts || '—')}</td>
        <td>${escapeHtml(planName || '—')}</td>
        <td>${escapeHtml(record.notes || '—')}</td>
      </tr>
    `;
  }

  function renderMealCarbsSection(record = {}) {
    const value = record.mealCarbs ?? record.totalCarbs ?? '';
    return `
      <section class="lee_lee_diabetes_carb_entry" data-carb-entry aria-labelledby="lee-lee-carb-entry-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-carb-entry-title">Meal Carbs</h2>
        <label class="lee_lee_diabetes_field lee_lee_diabetes_carb_total_field">
          Total Carbs
          <span class="lee_lee_diabetes_unit_input">
            <input class="lee_lee_diabetes_input" name="mealCarbs" type="number" inputmode="decimal" min="0" step="0.1" autocomplete="off" required value="${escapeHtml(value)}">
            <span>g</span>
          </span>
        </label>
        <div>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="open-carb-calculator" aria-label="Open Carb Calculator">Open Carb Calc</button>
        </div>
      </section>
    `;
  }

  function renderCarbCalculator(rows = []) {
    const normalizedRows = normalizeCarbCalculatorRows(rows);
    const mealTotal = calculateCarbCalculatorMealTotal(normalizedRows);
    const canUseTotal = hasValidCarbCalculatorTotal(normalizedRows);
    const activePicker = currentEditor?.carbCalculatorPicker || '';
    const search = currentEditor?.carbCalculatorSearch || '';
    return `
      <div class="lee_lee_diabetes_carb_calc_layer" data-carb-calculator-layer>
        <div class="lee_lee_diabetes_carb_calc_backdrop" data-action="close-carb-calculator" aria-hidden="true"></div>
        <section class="lee_lee_diabetes_carb_calculator" data-carb-calculator role="dialog" aria-modal="true" aria-labelledby="lee-lee-carb-calculator-title">
          <div class="lee_lee_diabetes_carb_calculator_header">
            <h2 class="lee_lee_diabetes_section_title" id="lee-lee-carb-calculator-title">Carb Calculator</h2>
            <button type="button" class="lee_lee_diabetes_timeline_edit" data-action="close-carb-calculator" aria-label="Cancel Carb Calculator">Cancel</button>
          </div>
          ${renderCarbCalculatorLibrary(activePicker, search, normalizedRows)}
          ${renderCarbCalculatorPicker(activePicker, search, normalizedRows)}
          ${renderSelectedCarbRows(normalizedRows)}
          <div class="lee_lee_diabetes_carb_calc_grid" data-carb-calculator-rows aria-label="Manual carb amounts">
            <div class="lee_lee_diabetes_carb_calc_heading">Qty</div>
            <div class="lee_lee_diabetes_carb_calc_heading" aria-hidden="true"></div>
            <div class="lee_lee_diabetes_carb_calc_heading">Carbs</div>
            <div class="lee_lee_diabetes_carb_calc_heading lee_lee_diabetes_carb_calc_total_heading">Total</div>
            <div aria-hidden="true"></div>
            ${normalizedRows.filter((row) => row.sourceType !== 'food').map((row) => renderCarbCalculatorRow(row)).join('')}
          </div>
          <div class="lee_lee_diabetes_carb_calc_sum" aria-live="polite">
            <span>Total Carbs</span>
            <strong data-carb-calculator-total aria-label="Meal Total">${escapeHtml(formatCarbAmount(mealTotal))} g</strong>
          </div>
          ${hasReusableFoodSelection(normalizedRows) ? `
            <div class="lee_lee_diabetes_carb_secondary_action">
              <button type="button" class="lee_lee_diabetes_timeline_edit" data-action="open-carb-meal-editor">Save as My Meal</button>
            </div>
          ` : ''}
          ${currentEditor?.carbCalculatorMealEditorOpen ? renderSavedMealEditorPanel(normalizedRows) : ''}
          <div class="lee_lee_diabetes_actions lee_lee_diabetes_actions--single">
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="use-carb-calculator-total" ${canUseTotal ? '' : 'disabled'} aria-label="Use ${escapeHtml(formatCarbAmount(mealTotal))} grams">Use ${escapeHtml(formatCarbAmount(mealTotal))} g</button>
          </div>
        </section>
      </div>
    `;
  }

  function renderCarbCalculatorLibrary(activePicker, search, rows = []) {
    const hasAnyStartedRows = rows.some(isCarbCalculatorRowStarted);
    const normalizedSearch = String(search || '').trim();
    return `
      <div class="lee_lee_diabetes_carb_library">
        <div class="lee_lee_diabetes_carb_search">
          <div class="lee_lee_diabetes_carb_search_controls">
            <span class="lee_lee_diabetes_search_icon" aria-hidden="true"></span>
            <input class="lee_lee_diabetes_input" name="carbFoodSearch" type="search" autocomplete="off" aria-label="Search foods" placeholder="Search foods..." value="${escapeHtml(search)}">
          </div>
        </div>
        <div class="lee_lee_diabetes_carb_tabs" aria-label="Carb Calculator food pickers">
          ${FOOD_LIBRARY_TABS.map(([tab, label]) => `
            <button type="button" class="lee_lee_diabetes_nav_button ${activePicker === tab ? 'is-active' : ''}" data-action="open-carb-calculator-picker" data-picker="${escapeHtml(tab)}" aria-pressed="${activePicker === tab ? 'true' : 'false'}" aria-expanded="${activePicker === tab ? 'true' : 'false'}" aria-controls="lee-lee-carb-picker-panel">${escapeHtml(label)}</button>
          `).join('')}
        </div>
        ${!activePicker && !normalizedSearch && !hasAnyStartedRows ? `
          <div class="lee_lee_diabetes_empty lee_lee_diabetes_carb_calc_empty" data-carb-calculator-empty>
            <p>No foods added yet.</p>
            <small>Search above or choose a food list.</small>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderCarbCalculatorPicker(activePicker, search, rows = []) {
    const normalizedSearch = String(search || '').trim();
    if (!activePicker && !normalizedSearch) return '';
    const pickerKey = normalizedSearch ? 'search' : activePicker;
    const title = normalizedSearch ? 'Search Results' : (FOOD_LIBRARY_TABS.find(([tab]) => tab === activePicker)?.[1] || 'Foods');
    const hasFoodEditor = currentEditor?.carbCalculatorFoodEditorOpen === true;
    const hasMealEditor = currentEditor?.carbCalculatorMealEditorOpen === true;
    return `
      <section class="lee_lee_diabetes_carb_picker" id="lee-lee-carb-picker-panel" data-carb-picker="${escapeHtml(pickerKey)}" aria-labelledby="lee-lee-carb-picker-title">
        <div class="lee_lee_diabetes_carb_picker_header">
          <h3 id="lee-lee-carb-picker-title">${escapeHtml(title)}</h3>
          ${normalizedSearch ? '' : '<button type="button" class="lee_lee_diabetes_timeline_edit" data-action="close-carb-calculator-picker">Done</button>'}
        </div>
        <div class="lee_lee_diabetes_carb_library_list" data-carb-library-list>
          ${renderCarbCalculatorLibraryList(pickerKey, normalizedSearch, rows)}
        </div>
        ${pickerKey === 'foods' && !hasFoodEditor ? `
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="open-carb-food-editor">+ Add New Food</button>
        ` : ''}
        ${hasFoodEditor ? renderFoodEditorPanel() : ''}
        ${pickerKey === 'meals' && !hasMealEditor ? `
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="open-carb-meal-editor" ${hasValidCarbCalculatorTotal(currentEditor?.carbCalculatorRows || []) ? '' : 'disabled'}>+ Save as My Meal</button>
        ` : ''}
      </section>
    `;
  }

  function renderCarbCalculatorLibraryList(activePicker, search, rows = []) {
    const normalizedSearch = String(search || '').trim();
    if (activePicker === 'search' && normalizedSearch) {
      const foods = searchFoodItems(foodLibrary, normalizedSearch);
      return foods.length ? foods.map((food) => renderCarbCalculatorFoodSearchResult(food, rows, { showFavoriteToggle: false })).join('') : `
        <div class="lee_lee_diabetes_empty lee_lee_diabetes_carb_search_empty">
          <p>No foods found for “${escapeHtml(normalizedSearch)}”</p>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="open-carb-food-editor">+ Add New Food</button>
        </div>
      `;
    }
    if (activePicker === 'meals') {
      const meals = activeSavedMeals(savedMeals)
        .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
      return meals.length ? meals.map((meal) => `
        <button type="button" class="lee_lee_diabetes_carb_food_option" data-action="add-saved-meal-to-carb-calculator" data-id="${escapeHtml(meal.id)}">
          <span><strong>${escapeHtml(meal.name)}</strong><small>${escapeHtml(formatCarbs(meal.totalCarbs))}</small></span>
          <span aria-hidden="true">+</span>
        </button>
      `).join('') : '<p class="lee_lee_diabetes_empty">No My Meals yet.</p>';
    }
    let foods = searchFoodItems(foodLibrary, '');
    if (activePicker === 'favorites') foods = foods.filter((food) => food.favorite);
    if (activePicker === 'recent') foods = getRecentFoodItems(foodLibrary);
    return foods.length ? foods.map((food) => renderCarbCalculatorFoodSearchResult(food, rows, { showFavoriteToggle: activePicker !== 'favorites' })).join('') : '<p class="lee_lee_diabetes_empty">No foods match.</p>';
  }

  function hasReusableFoodSelection(rows = []) {
    return rows.some((row) => row.sourceType === 'food' && isCarbCalculatorRowStarted(row));
  }

  function isFoodSelectedInCarbCalculator(foodId, rows = []) {
    return rows.some((row) => row.sourceType === 'food' && row.foodId === foodId && isCarbCalculatorRowStarted(row));
  }

  function renderCarbCalculatorFoodSearchResult(food, rows = [], options = {}) {
    const selected = isFoodSelectedInCarbCalculator(food.id, rows);
    const actionLabel = selected ? 'Selected' : 'Add';
    return `
      <div class="lee_lee_diabetes_carb_food_row${options.showFavoriteToggle === false ? ' lee_lee_diabetes_carb_food_row--picker' : ''}">
        <button type="button" class="lee_lee_diabetes_carb_food_option" data-action="add-food-to-carb-calculator" data-id="${escapeHtml(food.id)}" aria-label="${escapeHtml(`${actionLabel} ${food.name} ${formatCarbs(food.carbs)}`)}">
          <span><strong>${food.emoji ? `<span class="lee_lee_diabetes_food_emoji" aria-hidden="true">${escapeHtml(food.emoji)}</span>` : ''}${escapeHtml(food.name)}</strong><small>${escapeHtml([food.brand, food.servingLabel, formatCarbs(food.carbs)].filter(Boolean).join(' · '))}</small></span>
          <span class="lee_lee_diabetes_carb_pick_state" aria-hidden="true">${selected ? '✓' : '+'}</span>
        </button>
        ${options.showFavoriteToggle === false ? '' : `<button type="button" class="lee_lee_diabetes_icon_button" data-action="toggle-food-favorite" data-id="${escapeHtml(food.id)}" aria-label="${food.favorite ? 'Remove favorite' : 'Mark favorite'}">${food.favorite ? '★' : '☆'}</button>`}
      </div>
    `;
  }

  function renderSelectedCarbRows(rows) {
    const selected = rows.filter((row) => row.sourceType === 'food' && isCarbCalculatorRowStarted(row));
    if (!selected.length) return '';
    return `
      <div class="lee_lee_diabetes_carb_selected" aria-label="Selected foods">
        <h3 class="lee_lee_diabetes_carb_subtitle">Selected Foods · ${selected.length}</h3>
        ${selected.map((row) => {
          const total = calculateCarbCalculatorRowTotal(row) ?? 0;
          return `
            <div class="lee_lee_diabetes_carb_selected_row" data-carb-calculator-row data-carb-row-id="${escapeHtml(row.id)}">
              <input type="hidden" name="carbCalcSourceType" value="food" data-carb-row-id="${escapeHtml(row.id)}">
              <input type="hidden" name="carbCalcFoodId" value="${escapeHtml(row.foodId)}" data-carb-row-id="${escapeHtml(row.id)}">
              <input type="hidden" name="carbCalcName" value="${escapeHtml(row.name)}" data-carb-row-id="${escapeHtml(row.id)}">
              <input type="hidden" name="carbCalcEmoji" value="${escapeHtml(row.emoji)}" data-carb-row-id="${escapeHtml(row.id)}">
              <input type="hidden" name="carbCalcServingLabel" value="${escapeHtml(row.servingLabel)}" data-carb-row-id="${escapeHtml(row.id)}">
              <input type="hidden" name="carbCalcBrand" value="${escapeHtml(row.brand)}" data-carb-row-id="${escapeHtml(row.id)}">
              <input type="hidden" name="carbCalcSourceTypeSnapshot" value="${escapeHtml(row.sourceTypeSnapshot)}" data-carb-row-id="${escapeHtml(row.id)}">
              <input type="hidden" name="carbCalcSourceNameSnapshot" value="${escapeHtml(row.sourceNameSnapshot)}" data-carb-row-id="${escapeHtml(row.id)}">
              <input type="hidden" name="carbCalcCarbs" value="${escapeHtml(row.carbs)}" data-carb-row-id="${escapeHtml(row.id)}">
              <div>
                <strong>${row.emoji ? `<span class="lee_lee_diabetes_food_emoji" aria-hidden="true">${escapeHtml(row.emoji)}</span>` : ''}${escapeHtml(row.name)}</strong>
                <small>${escapeHtml([row.brand, row.servingLabel, `${formatCarbAmount(row.carbs)} g each`, formatFoodSourceLabel(row)].filter(Boolean).join(' · '))}</small>
              </div>
              <div class="lee_lee_diabetes_quantity_control">
                <button type="button" class="lee_lee_diabetes_icon_button" data-action="decrement-carb-row" data-carb-row-id="${escapeHtml(row.id)}" aria-label="Decrease ${escapeHtml(row.name)} quantity">−</button>
                <label>
                  <span class="lee_lee_diabetes_sr_only">Quantity for ${escapeHtml(row.name)}</span>
                  <input class="lee_lee_diabetes_input lee_lee_diabetes_carb_calc_input" name="carbCalcQty" type="number" inputmode="decimal" min="0" step="0.1" autocomplete="off" value="${escapeHtml(row.qty)}" data-carb-row-id="${escapeHtml(row.id)}">
                </label>
                <button type="button" class="lee_lee_diabetes_icon_button" data-action="increment-carb-row" data-carb-row-id="${escapeHtml(row.id)}" aria-label="Increase ${escapeHtml(row.name)} quantity">+</button>
              </div>
              <output class="lee_lee_diabetes_carb_calc_row_total" aria-label="${escapeHtml(row.name)} carbs">${escapeHtml(formatCarbAmount(total))} g</output>
              <button type="button" class="lee_lee_diabetes_icon_button lee_lee_diabetes_icon_button--danger" data-action="remove-carb-calculator-row" data-carb-row-id="${escapeHtml(row.id)}" aria-label="Remove ${escapeHtml(row.name)}">×</button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderFoodEditorPanel(food = {}) {
    return `
      <section class="lee_lee_diabetes_carb_editor_panel" aria-labelledby="lee-lee-carb-food-editor-title">
        <h3 id="lee-lee-carb-food-editor-title">Add Food</h3>
        <label class="lee_lee_diabetes_field">Food Name<input class="lee_lee_diabetes_input" name="foodName" type="text" maxlength="80" autocomplete="off" value="${escapeHtml(food.name || '')}" required></label>
        <label class="lee_lee_diabetes_field">Emoji<input class="lee_lee_diabetes_input" name="foodEmoji" type="text" maxlength="16" autocomplete="off" value="${escapeHtml(food.emoji || '')}"></label>
        <label class="lee_lee_diabetes_field">Carbs<input class="lee_lee_diabetes_input" name="foodCarbs" type="number" inputmode="decimal" min="0" step="0.1" autocomplete="off" value="${escapeHtml(food.carbs ?? '')}" required></label>
        <label class="lee_lee_diabetes_field">Serving Label<input class="lee_lee_diabetes_input" name="foodServingLabel" type="text" maxlength="80" autocomplete="off" value="${escapeHtml(food.servingLabel || '')}"></label>
        <label class="lee_lee_diabetes_field">Brand / Notes<input class="lee_lee_diabetes_input" name="foodBrand" type="text" maxlength="80" autocomplete="off" value="${escapeHtml(food.brand || '')}"></label>
        <label class="lee_lee_diabetes_checkline"><input type="checkbox" name="foodFavorite" ${food.favorite ? 'checked' : ''}> Favorite</label>
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="cancel-carb-food-editor">Cancel</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="save-carb-food-editor">Save Food</button>
        </div>
      </section>
    `;
  }

  function renderSavedMealEditorPanel(rows = []) {
    const total = calculateCarbCalculatorMealTotal(rows);
    return `
      <section class="lee_lee_diabetes_carb_editor_panel" aria-labelledby="lee-lee-carb-meal-editor-title">
        <h3 id="lee-lee-carb-meal-editor-title">Save as My Meal</h3>
        <label class="lee_lee_diabetes_field">Meal Name<input class="lee_lee_diabetes_input" name="savedMealName" type="text" maxlength="80" autocomplete="off" required></label>
        <p class="lee_lee_diabetes_help">${escapeHtml(formatCarbs(total))}</p>
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="cancel-carb-meal-editor">Cancel</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="save-carb-meal-editor">Save My Meal</button>
        </div>
      </section>
    `;
  }

  function renderCarbCalculatorRow(row) {
    const item = normalizeCarbCalculatorRow(row);
    const rowTotal = calculateCarbCalculatorRowTotal(item);
    const started = isCarbCalculatorRowStarted(item);
    return `
      <div class="lee_lee_diabetes_carb_calc_row" data-carb-calculator-row data-carb-row-id="${escapeHtml(item.id)}">
      <input type="hidden" name="carbCalcSourceType" value="manual" data-carb-row-id="${escapeHtml(item.id)}">
      <div class="lee_lee_diabetes_carb_calc_cell lee_lee_diabetes_carb_calc_cell--qty">
        <label>
          <span class="lee_lee_diabetes_sr_only">Quantity</span>
          <input class="lee_lee_diabetes_input lee_lee_diabetes_carb_calc_input" name="carbCalcQty" type="number" inputmode="decimal" min="0" step="0.1" autocomplete="off" value="${escapeHtml(item.qty)}" data-carb-row-id="${escapeHtml(item.id)}">
        </label>
      </div>
      <span class="lee_lee_diabetes_carb_calc_operator" aria-hidden="true">×</span>
      <div class="lee_lee_diabetes_carb_calc_cell lee_lee_diabetes_carb_calc_cell--carbs">
        <label>
          <span class="lee_lee_diabetes_sr_only">Carbohydrate grams</span>
          <span class="lee_lee_diabetes_carb_calc_unit_input">
            <input class="lee_lee_diabetes_input lee_lee_diabetes_carb_calc_input" name="carbCalcCarbs" type="number" inputmode="decimal" min="0" step="0.1" autocomplete="off" value="${escapeHtml(item.carbs)}" data-carb-row-id="${escapeHtml(item.id)}">
            <span aria-hidden="true">g</span>
          </span>
        </label>
      </div>
      <output class="lee_lee_diabetes_carb_calc_row_total" aria-label="Calculated row total">${rowTotal == null ? '—' : `${escapeHtml(formatCarbAmount(rowTotal))} g`}</output>
      <div class="lee_lee_diabetes_carb_calc_remove_slot">
        ${started ? `<button type="button" class="lee_lee_diabetes_icon_button lee_lee_diabetes_icon_button--danger" data-action="remove-carb-calculator-row" data-carb-row-id="${escapeHtml(item.id)}" aria-label="Remove row">×</button>` : ''}
      </div>
      </div>
    `;
  }

  function collectCarbCalculatorRowsFromForm(form) {
    const rows = [];
    form?.querySelectorAll('[name="carbCalcQty"]').forEach((qtyInput) => {
      const id = qtyInput.dataset.carbRowId || createId();
      const carbsInput = form.querySelector(`[name="carbCalcCarbs"]${getCarbRowSelector(id)}`);
      const sourceInput = form.querySelector(`[name="carbCalcSourceType"]${getCarbRowSelector(id)}`);
      const foodIdInput = form.querySelector(`[name="carbCalcFoodId"]${getCarbRowSelector(id)}`);
      const nameInput = form.querySelector(`[name="carbCalcName"]${getCarbRowSelector(id)}`);
      const emojiInput = form.querySelector(`[name="carbCalcEmoji"]${getCarbRowSelector(id)}`);
      const servingInput = form.querySelector(`[name="carbCalcServingLabel"]${getCarbRowSelector(id)}`);
      const brandInput = form.querySelector(`[name="carbCalcBrand"]${getCarbRowSelector(id)}`);
      const sourceTypeInput = form.querySelector(`[name="carbCalcSourceTypeSnapshot"]${getCarbRowSelector(id)}`);
      const sourceNameInput = form.querySelector(`[name="carbCalcSourceNameSnapshot"]${getCarbRowSelector(id)}`);
      rows.push(normalizeCarbCalculatorRow({
        id,
        sourceType: sourceInput?.value || 'manual',
        foodId: foodIdInput?.value || '',
        name: nameInput?.value || '',
        emoji: emojiInput?.value || '',
        servingLabel: servingInput?.value || '',
        brand: brandInput?.value || '',
        sourceTypeSnapshot: sourceTypeInput?.value || '',
        sourceNameSnapshot: sourceNameInput?.value || '',
        qty: qtyInput.value,
        carbs: carbsInput?.value ?? '',
      }));
    });
    return normalizeCarbCalculatorRows(rows);
  }

  function collectEditableCarbCalculatorRowsFromForm(form, preserveRowId = '') {
    const rows = [];
    form?.querySelectorAll('[name="carbCalcQty"]').forEach((qtyInput) => {
      const id = qtyInput.dataset.carbRowId || createId();
      const carbsInput = form.querySelector(`[name="carbCalcCarbs"]${getCarbRowSelector(id)}`);
      const sourceInput = form.querySelector(`[name="carbCalcSourceType"]${getCarbRowSelector(id)}`);
      const foodIdInput = form.querySelector(`[name="carbCalcFoodId"]${getCarbRowSelector(id)}`);
      const nameInput = form.querySelector(`[name="carbCalcName"]${getCarbRowSelector(id)}`);
      const emojiInput = form.querySelector(`[name="carbCalcEmoji"]${getCarbRowSelector(id)}`);
      const servingInput = form.querySelector(`[name="carbCalcServingLabel"]${getCarbRowSelector(id)}`);
      const brandInput = form.querySelector(`[name="carbCalcBrand"]${getCarbRowSelector(id)}`);
      const sourceTypeInput = form.querySelector(`[name="carbCalcSourceTypeSnapshot"]${getCarbRowSelector(id)}`);
      const sourceNameInput = form.querySelector(`[name="carbCalcSourceNameSnapshot"]${getCarbRowSelector(id)}`);
      rows.push(normalizeCarbCalculatorRow({
        id,
        sourceType: sourceInput?.value || 'manual',
        foodId: foodIdInput?.value || '',
        name: nameInput?.value || '',
        emoji: emojiInput?.value || '',
        servingLabel: servingInput?.value || '',
        brand: brandInput?.value || '',
        sourceTypeSnapshot: sourceTypeInput?.value || '',
        sourceNameSnapshot: sourceNameInput?.value || '',
        qty: qtyInput.value,
        carbs: carbsInput?.value ?? '',
      }));
    });
    return normalizeCarbCalculatorRowsForEditing(rows, preserveRowId);
  }

  function collectFoodItemsFromForm(form = null) {
    const components = currentEditor?.mealComponents || buildMealComponentsFromCarbCalculatorRows(currentEditor?.carbCalculatorRows || []);
    return components
      .filter((component) => component.componentType === 'food')
      .map((component) => normalizeFoodItem({
        id: component.id,
        name: component.nameSnapshot,
        emoji: component.emojiSnapshot,
        inputMode: 'direct',
        directCarbs: component.carbTotal,
        calculatedCarbs: component.carbTotal,
        savedFoodId: component.foodId,
      }))
      .filter(Boolean);
  }

  function renderEditor(options) {
    const root = getRoot();
    if (!root) return;
    const previousEditor = currentEditor;
    const record = options.record || {};
    const recordComponentRows = record.id && Array.isArray(record.mealComponents) && record.mealComponents.length
      ? carbRowsFromMealComponents(record.mealComponents)
      : [];
    const carbCalculatorRows = normalizeCarbCalculatorRows(options.carbCalculatorRows || currentEditor?.carbCalculatorRows || recordComponentRows || []);
    const sameEditorSession = previousEditor
      && previousEditor.mode === options.mode
      && previousEditor.id === (record.id || null);
    currentEditor = {
      mode: options.mode,
      id: record.id || null,
      eventType: normalizeEventType(record.eventType || options.eventType, record),
      type: record.type || options.type || DEFAULT_ENTRY_TYPE,
      originalRecord: record.id ? { ...record } : null,
      returnTo: options.returnTo || null,
      returnDateKey: options.returnDateKey || null,
      carbCalculatorOpen: options.carbCalculatorOpen === true,
      carbCalculatorRows,
      mealComponents: Array.isArray(options.mealComponents)
        ? options.mealComponents
        : (Array.isArray(record.mealComponents) ? record.mealComponents.map(normalizeMealComponent).filter(Boolean) : []),
      carbCalculatorTab: options.carbCalculatorTab || previousEditor?.carbCalculatorTab || 'favorites',
      carbCalculatorPicker: options.carbCalculatorPicker ?? previousEditor?.carbCalculatorPicker ?? '',
      carbCalculatorPickerFocus: options.carbCalculatorPickerFocus || previousEditor?.carbCalculatorPickerFocus || '',
      carbCalculatorSearch: options.carbCalculatorSearch ?? previousEditor?.carbCalculatorSearch ?? '',
      carbCalculatorFoodEditorOpen: options.carbCalculatorFoodEditorOpen === true,
      carbCalculatorMealEditorOpen: options.carbCalculatorMealEditorOpen === true,
      carbCalculatorScrollSnapshot: options.carbCalculatorOpen === true
        ? (options.carbCalculatorScrollSnapshot || previousEditor?.carbCalculatorScrollSnapshot || null)
        : null,
      userEditedInsulin: options.userEditedInsulin === true || (sameEditorSession && previousEditor.userEditedInsulin === true),
      autofilledInsulinUnits: sameEditorSession ? previousEditor.autofilledInsulinUnits : null,
    };
    trackerMenuOpen = false;
    const now = new Date();
    const recordTimestamp = record.recordTimestamp != null
      ? getRecordTimestamp(record)
      : now.getTime();
    const eventDate = record.date || getLocalDateKey(new Date(recordTimestamp));
    const eventTime = record.time || getLocalTimeKey(new Date(recordTimestamp));
    const eventConfig = getEventTypeConfig(currentEditor.eventType);
    const contextType = normalizeRecordContext(currentEditor.type, currentEditor.eventType);
    const showCarbEntry = eventConfig.fields.includes('carbs') || entryTypeUsesFoodCalculator(contextType, currentEditor.eventType);
    const showLegacyEventSelect = currentEditor.id && currentEditor.eventType !== 'check-insulin';
    root.innerHTML = `
      <form class="lee_lee_diabetes_editor${currentEditor.carbCalculatorOpen ? ' is-carb-calculator-open' : ''}" data-lee-lee-editor>
        <div class="lee_lee_diabetes_editor_main" data-editor-main ${currentEditor.carbCalculatorOpen ? 'inert aria-hidden="true"' : ''}>
          <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">${escapeHtml(currentEditor.id ? 'Edit Entry' : 'Log Entry')}</h1>
          ${showLegacyEventSelect ? renderEventTypeSelect(currentEditor.eventType) : `<input type="hidden" name="eventType" value="${escapeHtml(currentEditor.eventType)}">`}
          ${renderTypeSelect(contextType)}
          <p class="lee_lee_diabetes_help lee_lee_diabetes_editor_error" data-editor-error role="alert" hidden>${escapeHtml(options.error || '')}</p>
          ${eventConfig.fields.includes('bloodSugar') ? `
            <label class="lee_lee_diabetes_field">
              Blood Sugar
              <input class="lee_lee_diabetes_input" name="bloodSugar" type="number" inputmode="numeric" min="0" step="1" autocomplete="off" value="${escapeHtml(record.bloodSugar ?? '')}">
            </label>
          ` : ''}
          ${showCarbEntry ? renderMealCarbsSection(record) : ''}
          ${eventConfig.fields.includes('activityDescription') ? `
            <label class="lee_lee_diabetes_field">
              Activity
              <input class="lee_lee_diabetes_input" name="activityDescription" type="text" maxlength="120" autocomplete="off" placeholder="Bike ride" value="${escapeHtml(record.activityDescription || '')}">
            </label>
            <label class="lee_lee_diabetes_field">
              Duration
              <input class="lee_lee_diabetes_input" name="activityDurationMinutes" type="number" inputmode="numeric" min="0" step="1" autocomplete="off" value="${escapeHtml(record.activityDurationMinutes ?? '')}">
            </label>
            <label class="lee_lee_diabetes_field">
              Intensity
              <select class="lee_lee_diabetes_select" name="activityIntensity">
                <option value="">Choose intensity</option>
                ${ACTIVITY_INTENSITY_OPTIONS.map((intensity) => `<option value="${escapeHtml(intensity)}" ${record.activityIntensity === intensity ? 'selected' : ''}>${escapeHtml(intensity)}</option>`).join('')}
              </select>
            </label>
          ` : ''}
          <label class="lee_lee_diabetes_field">
            Date
            <input class="lee_lee_diabetes_input" name="date" type="date" required value="${escapeHtml(eventDate)}">
          </label>
          <label class="lee_lee_diabetes_field">
            Time
            <input class="lee_lee_diabetes_input" name="time" type="time" required value="${escapeHtml(eventTime)}">
          </label>
          <div data-dose-helper aria-live="polite"></div>
          ${eventConfig.fields.includes('insulinUnits') ? `
            <label class="lee_lee_diabetes_field">
              <span data-insulin-label>${entryTypeUsesDoseGuidance(contextType) ? 'Insulin Actually Given' : 'Insulin'}</span>
              <input class="lee_lee_diabetes_input" name="insulinUnits" type="number" inputmode="decimal" min="0" step="0.5" autocomplete="off" value="${escapeHtml(record.administeredInsulinUnits ?? record.insulinUnits ?? '')}">
            </label>
          ` : ''}
          ${eventConfig.fields.includes('notes') ? `
            <label class="lee_lee_diabetes_field">
              Notes
              <textarea class="lee_lee_diabetes_textarea" name="notes" rows="4">${escapeHtml(record.notes || '')}</textarea>
            </label>
          ` : ''}
          <div class="lee_lee_diabetes_actions">
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="cancel">Cancel</button>
            <button type="submit" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-save-record>Save</button>
          </div>
        </div>
        ${showCarbEntry && currentEditor.carbCalculatorOpen ? renderCarbCalculator(currentEditor.carbCalculatorRows) : ''}
      </form>
    `;
    updateEditorState(root.querySelector('[data-lee-lee-editor]'));
    if (options.error) {
      showEditorError(root.querySelector('[data-lee-lee-editor]'), options.error);
    }
    if (currentEditor.carbCalculatorOpen) {
      enableCarbCalculatorModalViewport(currentEditor.carbCalculatorScrollSnapshot || getScrollSnapshot());
    }
    const focusTarget = (selector) => {
      const applyFocus = () => {
        const target = root.querySelector(selector);
        if (!target) return;
        const activeElement = document.activeElement;
        if (currentEditor.carbCalculatorOpen && activeElement?.closest?.('[data-carb-calculator]') && activeElement !== target) {
          return;
        }
        target.focus({ preventScroll: options.preventFocusScroll === true });
        if (target.name === 'carbFoodSearch' && typeof target.setSelectionRange === 'function') {
          const end = String(target.value || '').length;
          target.setSelectionRange(end, end);
        }
        if (target.closest?.('[data-carb-calculator]')) {
          keepCarbCalculatorInputVisible(target);
        }
      };
      applyFocus();
      requestAnimationFrame(applyFocus);
      window.setTimeout(applyFocus, 0);
    };
    if (currentEditor.carbCalculatorOpen && currentEditor.carbCalculatorPickerFocus) {
      focusTarget(currentEditor.carbCalculatorPickerFocus);
      currentEditor.carbCalculatorPickerFocus = '';
    } else if (currentEditor.carbCalculatorOpen && currentEditor.carbCalculatorPicker) {
      focusTarget('[data-action="close-carb-calculator-picker"], [data-carb-picker] [data-action]');
    } else if (currentEditor.carbCalculatorOpen) {
      focusTarget('[data-carb-calculator-rows] [name="carbCalcCarbs"]');
    } else if (options.focusAction) {
      focusTarget(`[data-action="${options.focusAction}"]`);
    } else {
      root.querySelector('[name="bloodSugar"], [name="mealCarbs"], [name="activityDescription"], [name="notes"]')?.focus();
    }
    if (options.restoreScrollSnapshot) {
      restoreScrollSnapshot(options.restoreScrollSnapshot);
    }
  }

  function buildDraftFromEditor(form) {
    return {
      id: currentEditor?.id || '',
      eventType: normalizeEventType(form.elements.eventType?.value),
      type: form.elements.type?.value || '',
      bloodSugar: form.elements.bloodSugar?.value || '',
      foods: [],
      mealComponents: currentEditor?.mealComponents || [],
      mealCarbs: form.elements.mealCarbs?.value || '',
      mealDescription: '',
      activityDescription: form.elements.activityDescription?.value || '',
      activityDurationMinutes: form.elements.activityDurationMinutes?.value || '',
      activityIntensity: form.elements.activityIntensity?.value || '',
      administeredInsulinUnits: form.elements.insulinUnits?.value || '',
      insulinUnits: form.elements.insulinUnits?.value || '',
      notes: form.elements.notes?.value || '',
      date: form.elements.date?.value || '',
      time: form.elements.time?.value || '',
    };
  }

  function getEditorType(form) {
    const typeInput = form.elements.type;
    const eventType = getEditorEventType(form);
    return normalizeRecordContext(typeInput?.value || currentEditor?.type, eventType);
  }

  function getEditorEventType(form) {
    return normalizeEventType(form.elements.eventType?.value || currentEditor?.eventType);
  }

  function getEditorRecordTimestamp(form) {
    return createLocalTimestamp(form.elements.date?.value, form.elements.time?.value);
  }

  function getEditorDoseResult(form) {
    const type = getEditorType(form);
    const recordTimestamp = getEditorRecordTimestamp(form);
    const eventType = getEditorEventType(form);
    if (eventType !== 'check-insulin' || !entryTypeUsesDoseGuidance(type)) {
      return {
        status: 'manual',
        baseUnits: null,
        correctionUnits: null,
        suggestedTotalUnits: null,
        matchedRange: null,
        insulinPlanId: null,
        insulinPlanSnapshot: null,
        message: '',
      };
    }
    const insulinPlan = recordTimestamp ? getActiveInsulinPlan(recordTimestamp) : null;
    if (!insulinPlan) {
      return {
        status: 'unavailable',
        baseUnits: null,
        correctionUnits: null,
        suggestedTotalUnits: null,
        matchedRange: null,
        insulinPlanId: null,
        insulinPlanSnapshot: null,
        message: 'No insulin plan is configured for this date.',
      };
    }
    const result = calculateMealInsulinDose({
      bloodSugar: form.elements.bloodSugar?.value,
      entryType: type,
      insulinPlan,
      recordTimestamp,
      totalCarbs: form.elements.mealCarbs?.value || '',
    });
    return {
      ...result,
      insulinPlanSnapshot: result.insulinPlanId ? clonePlanSnapshot(insulinPlan) : null,
    };
  }

  function renderDoseHelperResult(result) {
    if (result.status === 'calculated') {
      const carbBreakdown = result.carbDoseUnits == null
        ? ''
        : `<div class="lee_lee_diabetes_dose_breakdown">Carb coverage: ${escapeHtml(formatCarbs(result.totalCarbs))} ÷ ${escapeHtml(result.insulinCarbRatioGrams)} = ${escapeHtml(formatDoseNumber(result.rawCarbDose))} → ${escapeHtml(formatInsulin(result.carbDoseUnits))}</div>`;
      const correctionBreakdown = result.correctionUnits == null
        ? ''
        : `<div class="lee_lee_diabetes_dose_breakdown">Correction: +${escapeHtml(formatInsulin(result.correctionUnits))}</div>`;
      const legacyBreakdown = result.baseUnits != null && result.correctionUnits != null
        ? `<div class="lee_lee_diabetes_dose_breakdown">${escapeHtml(formatInsulin(result.baseUnits))} base + ${escapeHtml(formatInsulin(result.correctionUnits))} correction</div>`
        : '';
      const range = result.matchedRange
        ? `<div class="lee_lee_diabetes_dose_range">${escapeHtml(formatRange(result.matchedRange))}</div>`
        : '';
      return `
        <section class="lee_lee_diabetes_dose_card" aria-label="Suggested insulin">
          <div>
            <div class="lee_lee_diabetes_dose_label">Suggested dose</div>
            <div class="lee_lee_diabetes_dose_total">${escapeHtml(formatInsulin(result.suggestedTotalUnits))}</div>
            ${carbBreakdown}
            ${correctionBreakdown}
            ${legacyBreakdown}
            ${range}
          </div>
          <p>${escapeHtml(result.message)}</p>
        </section>
      `;
    }
    if (result.status === 'outside-configured-range') {
      return `
        <section class="lee_lee_diabetes_dose_card lee_lee_diabetes_dose_card--notice" aria-label="Dose guidance unavailable">
          <div class="lee_lee_diabetes_dose_label">${escapeHtml(result.message)}</div>
          <p>Follow Lee-Lee’s clinician-provided high-glucose instructions or contact the diabetes care team.</p>
        </section>
      `;
    }
    if (result.status === 'unsupported-entry-type') {
      return `<p class="lee_lee_diabetes_help">${escapeHtml(result.message)}</p>`;
    }
    return result.message ? `<p class="lee_lee_diabetes_help">${escapeHtml(result.message)}</p>` : '';
  }

  function updateDoseHelper(form) {
    if (!form) return null;
    const type = getEditorType(form);
    const label = form.querySelector('[data-insulin-label]');
    if (label) {
      label.textContent = entryTypeUsesDoseGuidance(type) ? 'Insulin Actually Given' : 'Insulin';
    }
    const helper = form.querySelector('[data-dose-helper]');
    const result = getEditorDoseResult(form);
    if (helper) {
      helper.innerHTML = renderDoseHelperResult(result);
    }
    const insulinInput = form.elements.insulinUnits;
    const userEditedInsulin = form.dataset.userEditedInsulin === 'true' || currentEditor?.userEditedInsulin === true;
    const currentInsulinValue = normalizeNumber(insulinInput?.value);
    const lastAutofilledInsulin = normalizeNumber(form.dataset.autofilledInsulinUnits ?? currentEditor?.autofilledInsulinUnits);
    const canAutofillInsulin = insulinInput
      && !currentEditor?.id
      && !userEditedInsulin
      && (
        insulinInput.value === ''
        || form.dataset.autofilledInsulin === 'true'
        || (lastAutofilledInsulin != null && currentInsulinValue === lastAutofilledInsulin)
      );
    if (
      result.status === 'calculated'
      && canAutofillInsulin
    ) {
      insulinInput.value = String(result.suggestedTotalUnits);
      form.dataset.autofilledInsulin = 'true';
      form.dataset.autofilledInsulinUnits = String(result.suggestedTotalUnits);
      if (currentEditor) currentEditor.autofilledInsulinUnits = result.suggestedTotalUnits;
    }
    if (
      result.status !== 'calculated'
      && insulinInput
      && form.dataset.autofilledInsulin === 'true'
      && !userEditedInsulin
    ) {
      insulinInput.value = '';
      delete form.dataset.autofilledInsulin;
      delete form.dataset.autofilledInsulinUnits;
      if (currentEditor) currentEditor.autofilledInsulinUnits = null;
    }
    return result;
  }

  function refreshCarbCalculator(form, preserveRowId = '') {
    const calculator = form?.querySelector('[data-carb-calculator]');
    if (!calculator) return;
    const activeElement = document.activeElement;
    const activeFieldName = activeElement?.name || pendingCarbCalculatorFocusFieldName || '';
    const activeRowId = activeElement?.dataset?.carbRowId || pendingCarbCalculatorFocusRowId || preserveRowId || '';
    const rows = collectEditableCarbCalculatorRowsFromForm(form, activeRowId);
    currentEditor.carbCalculatorRows = rows;
    const rowsContainer = calculator.querySelector('[data-carb-calculator-rows]');
    if (rowsContainer) {
      const rowIds = new Set(rows.map((row) => row.id));
      rowsContainer.querySelectorAll('[data-carb-calculator-row]').forEach((rowElement) => {
        if (!rowIds.has(rowElement.dataset.carbRowId)) rowElement.remove();
      });
      rows.forEach((row) => {
        let rowElement = rowsContainer.querySelector(`[data-carb-calculator-row]${getCarbRowSelector(row.id)}`);
        if (!rowElement) {
          rowsContainer.insertAdjacentHTML('beforeend', renderCarbCalculatorRow(row));
          rowElement = rowsContainer.querySelector(`[data-carb-calculator-row]${getCarbRowSelector(row.id)}`);
        }
        if (!rowElement) return;
        const rowTotal = calculateCarbCalculatorRowTotal(row);
        const totalElement = rowElement.querySelector('.lee_lee_diabetes_carb_calc_row_total');
        if (totalElement) totalElement.textContent = rowTotal == null ? '—' : `${formatCarbAmount(rowTotal)} g`;
        const removeSlot = rowElement.querySelector('.lee_lee_diabetes_carb_calc_remove_slot');
        if (removeSlot) {
          removeSlot.innerHTML = isCarbCalculatorRowStarted(row)
            ? `<button type="button" class="lee_lee_diabetes_icon_button lee_lee_diabetes_icon_button--danger" data-action="remove-carb-calculator-row" data-carb-row-id="${escapeHtml(row.id)}" aria-label="Remove row">×</button>`
            : '';
        }
      });
    }
    const mealTotal = calculateCarbCalculatorMealTotal(rows);
    const emptyElement = calculator.querySelector('[data-carb-calculator-empty]');
    if (emptyElement) {
      emptyElement.hidden = rows.some(isCarbCalculatorRowStarted);
    }
    calculator.querySelectorAll('.lee_lee_diabetes_carb_selected_row').forEach((rowElement) => {
      const row = rows.find((item) => item.id === rowElement.dataset.carbRowId);
      const totalElement = rowElement.querySelector('.lee_lee_diabetes_carb_calc_row_total');
      if (row && totalElement) totalElement.textContent = `${formatCarbAmount(calculateCarbCalculatorRowTotal(row) ?? 0)} g`;
    });
    const formattedTotal = formatCarbAmount(mealTotal);
    const totalElement = calculator.querySelector('[data-carb-calculator-total]');
    if (totalElement) totalElement.textContent = `${formattedTotal} g`;
    const useButton = calculator.querySelector('[data-action="use-carb-calculator-total"]');
    if (useButton) {
      useButton.textContent = `Use ${formattedTotal} g`;
      useButton.setAttribute('aria-label', `Use ${formattedTotal} grams`);
      useButton.disabled = !hasValidCarbCalculatorTotal(rows);
    }
    if (activeRowId && ['carbCalcQty', 'carbCalcCarbs'].includes(activeFieldName)) {
      const nextActiveInput = calculator.querySelector(`[name="${activeFieldName}"]${getCarbRowSelector(activeRowId)}`);
      if (nextActiveInput && document.activeElement !== nextActiveInput) {
        nextActiveInput.focus({ preventScroll: true });
      }
      if (document.activeElement === nextActiveInput) {
        pendingCarbCalculatorFocusRowId = '';
        pendingCarbCalculatorFocusFieldName = '';
      }
    }
  }

  function refreshCarbCalculatorLibrarySearch(form) {
    const calculator = form?.querySelector('[data-carb-calculator]');
    if (!calculator) return;
    const searchInput = calculator.querySelector('[name="carbFoodSearch"]');
    if (!searchInput) return;
    const search = searchInput.value || '';
    currentEditor.carbCalculatorSearch = search;
    currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
    currentEditor.carbCalculatorPicker = String(search || '').trim() ? 'search' : '';
    renderEditor({
      mode: currentEditor?.mode || 'log-entry',
      eventType: getEditorEventType(form),
      type: getEditorType(form),
      record: buildDraftFromEditor(form),
      returnTo: currentEditor?.returnTo || null,
      returnDateKey: currentEditor?.returnDateKey || null,
      carbCalculatorOpen: true,
      carbCalculatorRows: currentEditor.carbCalculatorRows,
      mealComponents: currentEditor?.mealComponents || [],
      carbCalculatorPicker: currentEditor.carbCalculatorPicker,
      carbCalculatorSearch: search,
      carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
      carbCalculatorPickerFocus: '[name="carbFoodSearch"]',
      preventFocusScroll: true,
    });
  }

  function updateEditorState(form, options = {}) {
    showEditorError(form, '');
    refreshCarbCalculator(form, options.preserveCarbRowId || '');
    updateContextSelectAvailability(form);
    updateDoseHelper(form);
    updateEditorSaveState(form);
  }

  function updateEditorSaveState(form) {
    if (!form) return;
    const saveButton = form.querySelector('[data-save-record]');
    if (!saveButton) return;
    const hasDate = Boolean(form.elements.date?.value);
    const hasTime = Boolean(form.elements.time?.value);
    const eventType = getEditorEventType(form);
    const type = getEditorType(form);
    const requiresCarbs = eventType === 'meal' || ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Snack'].includes(type);
    const hasMealCarbs = !requiresCarbs || normalizeNumber(form.elements.mealCarbs?.value) != null;
    saveButton.disabled = !(hasDate && hasTime && hasMealCarbs);
  }

  function removeCarbCalculatorRowFromTarget(target, root) {
    const form = target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]');
    const rowElement = target.closest('[data-carb-calculator-row]');
    const rowId = target.dataset.carbRowId || rowElement?.dataset.carbRowId || '';
    if (!form || !rowId) return false;
    if (rowElement) rowElement.remove();
    else form.querySelector(`[data-carb-calculator-row]${getCarbRowSelector(rowId)}`)?.remove();
    currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
    renderEditor({
      mode: currentEditor?.mode || 'log-entry',
      eventType: getEditorEventType(form),
      type: getEditorType(form),
      record: buildDraftFromEditor(form),
      returnTo: currentEditor?.returnTo || null,
      returnDateKey: currentEditor?.returnDateKey || null,
      carbCalculatorOpen: true,
      carbCalculatorRows: currentEditor.carbCalculatorRows,
      mealComponents: currentEditor?.mealComponents || [],
      carbCalculatorPicker: currentEditor?.carbCalculatorPicker || '',
      carbCalculatorSearch: currentEditor?.carbCalculatorSearch || '',
      carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
      carbCalculatorPickerFocus: '[data-carb-calculator-rows] [name="carbCalcCarbs"], [data-action="use-carb-calculator-total"]',
      preventFocusScroll: true,
    });
    return true;
  }

  function getScrollSnapshot() {
    return {
      x: window.scrollX || 0,
      y: window.scrollY || 0,
      viewportHeight: window.visualViewport?.height || window.innerHeight || 0,
    };
  }

  function restoreScrollSnapshot(snapshot) {
    if (!snapshot) return;
    const targetX = Number.isFinite(snapshot.x) ? snapshot.x : 0;
    const targetY = Number.isFinite(snapshot.y) ? snapshot.y : 0;
    const targetViewportHeight = Number.isFinite(snapshot.viewportHeight) ? snapshot.viewportHeight : 0;
    let attempts = 0;
    const apply = () => {
      window.scrollTo?.(targetX, targetY);
      attempts += 1;
      const currentViewportHeight = window.visualViewport?.height || window.innerHeight || 0;
      const viewportSettled = !targetViewportHeight || currentViewportHeight >= targetViewportHeight - 1;
      if (attempts < 2 || (!viewportSettled && attempts < 20)) {
        requestAnimationFrame(apply);
      }
    };
    apply();
  }

  function getCarbCalculatorViewportFrame() {
    const visualViewport = window.visualViewport;
    const viewportWidth = visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
    return {
      left: Math.max(0, visualViewport?.offsetLeft || 0),
      top: Math.max(0, visualViewport?.offsetTop || 0),
      width: Math.max(0, viewportWidth),
      height: Math.max(160, viewportHeight),
    };
  }

  function keepCarbCalculatorInputVisible(input) {
    const calculator = input?.closest?.('[data-carb-calculator]');
    if (!calculator) return;
    const inputRect = input.getBoundingClientRect();
    const calculatorRect = calculator.getBoundingClientRect();
    const breathingRoom = 14;
    if (inputRect.bottom > calculatorRect.bottom - breathingRoom) {
      calculator.scrollTop += inputRect.bottom - calculatorRect.bottom + breathingRoom;
    } else if (inputRect.top < calculatorRect.top + breathingRoom) {
      calculator.scrollTop -= calculatorRect.top - inputRect.top + breathingRoom;
    }
  }

  function applyCarbCalculatorViewportFrame() {
    const layer = document.querySelector('[data-carb-calculator-layer]');
    if (!layer) return;
    const frame = getCarbCalculatorViewportFrame();
    layer.style.setProperty('--lee-lee-carb-calc-viewport-left', `${frame.left}px`);
    layer.style.setProperty('--lee-lee-carb-calc-viewport-top', `${frame.top}px`);
    layer.style.setProperty('--lee-lee-carb-calc-viewport-width', `${frame.width}px`);
    layer.style.setProperty('--lee-lee-carb-calc-viewport-height', `${frame.height}px`);
    const activeElement = document.activeElement;
    if (activeElement?.closest?.('[data-carb-calculator]')) {
      keepCarbCalculatorInputVisible(activeElement);
    }
  }

  function scheduleCarbCalculatorViewportFrame() {
    requestAnimationFrame(() => {
      applyCarbCalculatorViewportFrame();
      restoreLockedCarbCalculatorScroll();
    });
  }

  function lockCarbCalculatorDocumentScroll(snapshot) {
    const lockedSnapshot = snapshot || getScrollSnapshot();
    if (!carbCalculatorScrollLock) {
      carbCalculatorScrollLock = {
        x: lockedSnapshot.x,
        y: lockedSnapshot.y,
        htmlOverflow: document.documentElement.style.overflow,
        htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
        bodyOverflow: document.body.style.overflow,
        bodyOverscrollBehavior: document.body.style.overscrollBehavior,
      };
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      window.addEventListener('scroll', restoreLockedCarbCalculatorScroll, { passive: true });
    }
    restoreLockedCarbCalculatorScroll();
  }

  function restoreLockedCarbCalculatorScroll() {
    if (!carbCalculatorScrollLock) return;
    const targetX = Number.isFinite(carbCalculatorScrollLock.x) ? carbCalculatorScrollLock.x : 0;
    const targetY = Number.isFinite(carbCalculatorScrollLock.y) ? carbCalculatorScrollLock.y : 0;
    if (window.scrollX !== targetX || window.scrollY !== targetY) {
      window.scrollTo?.(targetX, targetY);
    }
  }

  function unlockCarbCalculatorDocumentScroll() {
    const lock = carbCalculatorScrollLock;
    if (!lock) return null;
    window.removeEventListener('scroll', restoreLockedCarbCalculatorScroll);
    document.documentElement.style.overflow = lock.htmlOverflow;
    document.documentElement.style.overscrollBehavior = lock.htmlOverscrollBehavior;
    document.body.style.overflow = lock.bodyOverflow;
    document.body.style.overscrollBehavior = lock.bodyOverscrollBehavior;
    carbCalculatorScrollLock = null;
    const snapshot = { x: lock.x, y: lock.y, viewportHeight: window.visualViewport?.height || window.innerHeight || 0 };
    restoreScrollSnapshot(snapshot);
    return snapshot;
  }

  function attachCarbCalculatorViewportListeners() {
    if (carbCalculatorViewportListenerCleanup) return;
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener?.('resize', scheduleCarbCalculatorViewportFrame);
    visualViewport?.addEventListener?.('scroll', scheduleCarbCalculatorViewportFrame);
    window.addEventListener('resize', scheduleCarbCalculatorViewportFrame);
    carbCalculatorViewportListenerCleanup = () => {
      visualViewport?.removeEventListener?.('resize', scheduleCarbCalculatorViewportFrame);
      visualViewport?.removeEventListener?.('scroll', scheduleCarbCalculatorViewportFrame);
      window.removeEventListener('resize', scheduleCarbCalculatorViewportFrame);
      carbCalculatorViewportListenerCleanup = null;
    };
  }

  function enableCarbCalculatorModalViewport(snapshot) {
    lockCarbCalculatorDocumentScroll(snapshot);
    attachCarbCalculatorViewportListeners();
    applyCarbCalculatorViewportFrame();
  }

  function disableCarbCalculatorModalViewport() {
    carbCalculatorViewportListenerCleanup?.();
    return unlockCarbCalculatorDocumentScroll();
  }

  function focusCarbCalculatorInputOnPointer(event) {
    if (currentEditor?.carbCalculatorOpen !== true) return;
    const eventTarget = event.target instanceof Element ? event.target : event.target?.parentElement;
    const input = eventTarget?.closest?.('[data-carb-calculator] input, [data-carb-calculator] select, [data-carb-calculator] textarea');
    if (!input || document.activeElement === input) return;
    const focusInput = () => {
      input.focus({ preventScroll: true });
      if (document.activeElement === input) {
        pendingCarbCalculatorFocusRowId = '';
        pendingCarbCalculatorFocusFieldName = '';
      }
    };
    pendingCarbCalculatorFocusRowId = input.dataset?.carbRowId || '';
    pendingCarbCalculatorFocusFieldName = input.name || '';
    focusInput();
    requestAnimationFrame(focusInput);
    window.setTimeout(focusInput, 0);
  }

  function closeCarbCalculator(root, target, { applyTotal = false } = {}) {
    const form = target?.closest?.('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]');
    const rows = collectCarbCalculatorRowsFromForm(form);
    if (applyTotal && !hasValidCarbCalculatorTotal(rows)) return false;
    const snapshot = currentEditor?.carbCalculatorScrollSnapshot || carbCalculatorScrollLock || getScrollSnapshot();
    const draft = buildDraftFromEditor(form);
    if (applyTotal) {
      draft.mealCarbs = formatCarbAmount(calculateCarbCalculatorMealTotal(rows));
      draft.mealComponents = buildMealComponentsFromCarbCalculatorRows(rows);
    }
    currentEditor.carbCalculatorRows = rows;
    if (applyTotal) currentEditor.mealComponents = draft.mealComponents;
    const unlockedSnapshot = disableCarbCalculatorModalViewport();
    renderEditor({
      mode: currentEditor?.mode || 'log-entry',
      eventType: getEditorEventType(form),
      type: getEditorType(form),
      record: draft,
      returnTo: currentEditor?.returnTo || null,
      returnDateKey: currentEditor?.returnDateKey || null,
      carbCalculatorOpen: false,
      carbCalculatorRows: rows,
      mealComponents: draft.mealComponents,
      focusAction: 'open-carb-calculator',
      preventFocusScroll: true,
      restoreScrollSnapshot: unlockedSnapshot || snapshot,
    });
    return true;
  }

  function handleUseCarbCalculatorTotal(root, target) {
    return closeCarbCalculator(root, target, { applyTotal: true });
  }

  function setCarbRowQuantity(form, rowId, delta) {
    const input = form?.querySelector(`[name="carbCalcQty"]${getCarbRowSelector(rowId)}`);
    if (!input) return;
    const next = Math.max(0, normalizeQuantity(input.value, 0) + delta);
    input.value = formatCarbAmount(next);
    if (next === 0) {
      form.querySelector(`[data-carb-calculator-row]${getCarbRowSelector(rowId)}`)?.remove();
      currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
      renderEditor({
        mode: currentEditor?.mode || 'log-entry',
        eventType: getEditorEventType(form),
        type: getEditorType(form),
        record: buildDraftFromEditor(form),
        returnTo: currentEditor?.returnTo || null,
        returnDateKey: currentEditor?.returnDateKey || null,
        carbCalculatorOpen: true,
        carbCalculatorRows: currentEditor.carbCalculatorRows,
        mealComponents: currentEditor?.mealComponents || [],
        carbCalculatorPicker: currentEditor?.carbCalculatorPicker || '',
        carbCalculatorSearch: currentEditor?.carbCalculatorSearch || '',
        carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
        carbCalculatorPickerFocus: '[data-carb-calculator-rows] [name="carbCalcCarbs"], [data-action="use-carb-calculator-total"]',
        preventFocusScroll: true,
      });
      return;
    }
    currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
    refreshCarbCalculator(form, rowId);
  }

  function addFoodToCarbCalculator(form, foodId) {
    const now = Date.now();
    if (lastCarbCalculatorSelection.id === foodId && now - lastCarbCalculatorSelection.at < 350) return;
    lastCarbCalculatorSelection = { id: foodId, at: now };
    const previousPicker = currentEditor?.carbCalculatorPicker || '';
    const previousSearch = currentEditor?.carbCalculatorSearch || '';
    const isSearchPicker = previousPicker === 'search' || String(previousSearch || '').trim();
    const food = foodLibrary.find((item) => item.id === foodId && !isLibraryItemDeleted(item));
    const row = carbRowFromFood(food);
    if (!row) return;
    currentEditor.carbCalculatorRows = mergeCarbCalculatorRows(collectCarbCalculatorRowsFromForm(form), [row]);
    renderEditor({
      mode: currentEditor?.mode || 'log-entry',
      eventType: getEditorEventType(form),
      type: getEditorType(form),
      record: buildDraftFromEditor(form),
      returnTo: currentEditor?.returnTo || null,
      returnDateKey: currentEditor?.returnDateKey || null,
      carbCalculatorOpen: true,
      carbCalculatorRows: currentEditor.carbCalculatorRows,
      mealComponents: currentEditor?.mealComponents || [],
      carbCalculatorTab: currentEditor?.carbCalculatorTab || 'favorites',
      carbCalculatorPicker: isSearchPicker ? '' : previousPicker,
      carbCalculatorSearch: isSearchPicker ? '' : previousSearch,
      carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
      carbCalculatorPickerFocus: isSearchPicker ? '[data-action="use-carb-calculator-total"]' : '[data-carb-picker] [data-action="add-food-to-carb-calculator"]',
      preventFocusScroll: true,
    });
  }

  function addSavedMealToCarbCalculator(form, mealId) {
    const meal = activeSavedMeals(savedMeals).find((item) => item.id === mealId);
    if (!meal) return;
    currentEditor.carbCalculatorRows = mergeCarbCalculatorRows(
      collectCarbCalculatorRowsFromForm(form),
      carbRowsFromMealComponents(meal.components),
    );
    renderEditor({
      mode: currentEditor?.mode || 'log-entry',
      eventType: getEditorEventType(form),
      type: getEditorType(form),
      record: buildDraftFromEditor(form),
      returnTo: currentEditor?.returnTo || null,
      returnDateKey: currentEditor?.returnDateKey || null,
      carbCalculatorOpen: true,
      carbCalculatorRows: currentEditor.carbCalculatorRows,
      mealComponents: currentEditor?.mealComponents || [],
      carbCalculatorTab: 'meals',
      carbCalculatorPicker: currentEditor?.carbCalculatorPicker || 'meals',
      carbCalculatorSearch: currentEditor?.carbCalculatorSearch || '',
      carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
      carbCalculatorPickerFocus: '[data-carb-picker] [data-action="add-saved-meal-to-carb-calculator"]',
      preventFocusScroll: true,
    });
  }

  function saveFoodFromCarbCalculator(form) {
    const calculator = form?.querySelector('[data-carb-calculator]');
    const result = saveFoodLibraryItem({
      name: calculator?.querySelector('[name="foodName"]')?.value || '',
      emoji: calculator?.querySelector('[name="foodEmoji"]')?.value || '',
      carbs: calculator?.querySelector('[name="foodCarbs"]')?.value || '',
      servingLabel: calculator?.querySelector('[name="foodServingLabel"]')?.value || '',
      brand: calculator?.querySelector('[name="foodBrand"]')?.value || '',
      sourceType: 'user',
      favorite: calculator?.querySelector('[name="foodFavorite"]')?.checked === true,
    }, { addToCalculator: true });
    if (result.error) {
      foodLibraryError = result.error;
    } else {
      foodLibraryError = '';
      currentEditor.carbCalculatorFoodEditorOpen = false;
    }
    renderEditor({
      mode: currentEditor?.mode || 'log-entry',
      eventType: getEditorEventType(form),
      type: getEditorType(form),
      record: buildDraftFromEditor(form),
      returnTo: currentEditor?.returnTo || null,
      returnDateKey: currentEditor?.returnDateKey || null,
      carbCalculatorOpen: true,
      carbCalculatorRows: currentEditor.carbCalculatorRows,
      mealComponents: currentEditor?.mealComponents || [],
      carbCalculatorTab: currentEditor?.carbCalculatorTab || 'foods',
      carbCalculatorSearch: currentEditor?.carbCalculatorSearch || '',
      carbCalculatorPicker: currentEditor?.carbCalculatorPicker || 'foods',
      carbCalculatorFoodEditorOpen: currentEditor.carbCalculatorFoodEditorOpen,
      carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
      preventFocusScroll: true,
    });
  }

  function saveMealFromCarbCalculator(form) {
    const rows = collectCarbCalculatorRowsFromForm(form);
    const components = buildMealComponentsFromCarbCalculatorRows(rows);
    const calculator = form?.querySelector('[data-carb-calculator]');
    const result = saveSavedMeal({
      name: calculator?.querySelector('[name="savedMealName"]')?.value || '',
      components,
    });
    if (result.error) foodLibraryError = result.error;
    else {
      foodLibraryError = '';
      currentEditor.carbCalculatorMealEditorOpen = false;
      currentEditor.carbCalculatorTab = 'meals';
      currentEditor.carbCalculatorSearch = '';
    }
    renderEditor({
      mode: currentEditor?.mode || 'log-entry',
      eventType: getEditorEventType(form),
      type: getEditorType(form),
      record: buildDraftFromEditor(form),
      returnTo: currentEditor?.returnTo || null,
      returnDateKey: currentEditor?.returnDateKey || null,
      carbCalculatorOpen: true,
      carbCalculatorRows: rows,
      mealComponents: currentEditor?.mealComponents || [],
      carbCalculatorTab: currentEditor?.carbCalculatorTab || 'meals',
      carbCalculatorPicker: currentEditor?.carbCalculatorPicker || 'meals',
      carbCalculatorSearch: currentEditor?.carbCalculatorSearch || '',
      carbCalculatorMealEditorOpen: currentEditor.carbCalculatorMealEditorOpen,
      carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
      preventFocusScroll: true,
    });
  }

  function renderTypeSelect(selectedType) {
    const eventType = currentEditor?.eventType || DEFAULT_EVENT_TYPE;
    const optionStates = getContextOptionStates(eventType, selectedType);
    return `
      <label class="lee_lee_diabetes_field">
        ${eventType === 'meal' ? 'Meal Context' : 'Context'}
        <select class="lee_lee_diabetes_select" name="type">
          ${optionStates.map((option) => renderContextOption(option)).join('')}
        </select>
      </label>
    `;
  }

  function renderContextOption(option) {
    return `<option value="${escapeHtml(option.type)}" ${option.selected ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}>${escapeHtml(option.label)}</option>`;
  }

  function getContextOptionStates(eventType, selectedType, form = null) {
    const normalizedEventType = normalizeEventType(eventType);
    const baseOptions = getContextOptionsForEventType(normalizedEventType);
    const options = currentEditor?.id && CHECK_CONTEXT_TYPES.includes(selectedType) && !baseOptions.includes(selectedType)
      ? [selectedType, ...baseOptions]
      : baseOptions;
    const dateKey = form?.elements.date?.value || '';
    const editingId = currentEditor?.id || null;
    const selected = options.includes(selectedType) ? selectedType : getEventTypeConfig(normalizedEventType).defaultContext;
    const loggedContexts = getLoggedSingleUseCheckContextsForDate(dateKey, editingId);
    const firstAvailable = options.find((type) => !isContextUnavailableForCheckDate(type, normalizedEventType, loggedContexts)) || options[0] || selected;
    const effectiveSelected = isContextUnavailableForCheckDate(selected, normalizedEventType, loggedContexts) ? firstAvailable : selected;
    return options.map((type) => {
      const disabled = isContextUnavailableForCheckDate(type, normalizedEventType, loggedContexts);
      return {
        type,
        disabled,
        selected: type === effectiveSelected,
        label: disabled ? `${type} - ✓ Logged` : type,
      };
    });
  }

  function isContextUnavailableForCheckDate(type, eventType, loggedContexts) {
    return eventType === 'check-insulin'
      && SINGLE_USE_CHECK_CONTEXT_TYPES.includes(type)
      && loggedContexts.has(type);
  }

  function getLoggedSingleUseCheckContextsForDate(dateKey, excludeRecordId = null) {
    const logged = new Set();
    if (!dateKey) return logged;
    activeRecords().forEach((record) => {
      if (excludeRecordId && record.id === excludeRecordId) return;
      if (normalizeEventType(record.eventType, record) !== 'check-insulin') return;
      const context = normalizeRecordContext(record.type, 'check-insulin');
      if (!SINGLE_USE_CHECK_CONTEXT_TYPES.includes(context)) return;
      if (getRecordEventDateKey(record) === dateKey) {
        logged.add(context);
      }
    });
    return logged;
  }

  function getDuplicateScheduledContextMessage(record) {
    if (normalizeEventType(record.eventType, record) !== 'check-insulin') return '';
    const context = normalizeRecordContext(record.type, 'check-insulin');
    if (!SINGLE_USE_CHECK_CONTEXT_TYPES.includes(context)) return '';
    const dateKey = getRecordEventDateKey(record);
    return getLoggedSingleUseCheckContextsForDate(dateKey, record.id).has(context)
      ? `${context} has already been logged for this date.`
      : '';
  }

  function updateContextSelectAvailability(form) {
    const select = form?.elements.type;
    if (!select) return;
    const eventType = getEditorEventType(form);
    const currentType = getEditorType(form);
    const nextOptions = getContextOptionStates(eventType, currentType, form);
    const nextHtml = nextOptions.map((option) => renderContextOption(option)).join('');
    if (select.innerHTML !== nextHtml) {
      select.innerHTML = nextHtml;
    }
  }

  function showEditorError(form, message) {
    const error = form?.querySelector('[data-editor-error]');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

  function renderEventTypeSelect(selectedEventType) {
    return `
      <label class="lee_lee_diabetes_field">
        Event Type
        <select class="lee_lee_diabetes_select" name="eventType">
          ${EVENT_TYPE_DEFINITIONS.map(({ type, label }) => `<option value="${escapeHtml(type)}" ${type === selectedEventType ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
        </select>
      </label>
    `;
  }

  function renderEventTypePicker() {
    const root = getRoot();
    if (!root) return;
    currentEditor = { mode: 'event-picker' };
    trackerMenuOpen = false;
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Log Entry</h1>
        <div class="lee_lee_diabetes_event_grid">
          ${EVENT_TYPE_DEFINITIONS.map(({ type, label }) => `
            <button type="button" class="lee_lee_diabetes_event_option" data-action="choose-event-type" data-event-type="${escapeHtml(type)}">
              <span>${escapeHtml(label)}</span>
            </button>
          `).join('')}
        </div>
        <div class="lee_lee_diabetes_actions lee_lee_diabetes_actions--single">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="cancel">Cancel</button>
        </div>
      </section>
    `;
    root.querySelector('[data-action="choose-event-type"]')?.focus();
  }

  function openPrimaryEditor(type) {
    renderEditor({
      mode: 'primary',
      type,
      record: latestRecordForType(type) || { type },
    });
  }

  function openExtraEditor() {
    openEventEditor('check-insulin');
  }

  function openLogEntryEditor() {
    openEventEditor('check-insulin');
  }

  function openEventEditor(eventType, draft = {}) {
    const config = getEventTypeConfig(eventType);
    renderEditor({
      mode: 'log-entry',
      eventType,
      record: {
        eventType,
        type: normalizeRecordContext(draft.type || config.defaultContext, eventType),
        ...draft,
      },
    });
  }

  function upsertRecord(record) {
    setPersistenceStatus('saving');
    const existingRecord = records.find((item) => item.id === record.id) || null;
    updateTrackerData((current) => {
      const nextRecords = [...current.records];
      const index = nextRecords.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        nextRecords[index] = record;
      } else {
        nextRecords.push(record);
      }
      return {
        ...current,
        records: nextRecords,
      };
    });
    syncRepository?.queueUpsert(record, existingRecord);
    updateRecentFoodsFromComponents(record.mealComponents || []);
  }

  function buildRecordFromForm(form) {
    const now = new Date();
    const existing = currentEditor?.id
      ? records.find((record) => record.id === currentEditor.id)
      : null;
    const observedContext = getObservedEntryContext(form);
    const recordTimestamp = observedContext.recordTimestamp;
    if (!recordTimestamp) {
      updateEditorSaveState(form);
      return null;
    }
    const nowTimestamp = now.toISOString();
    const calculatedGuidance = getCalculatedGuidance(form);
    const actualAction = getActualRecordedAction(form, calculatedGuidance);
    return {
      id: existing?.id || createId(),
      date: getLocalDateKey(new Date(recordTimestamp)),
      time: getLocalTimeKey(new Date(recordTimestamp)),
      type: observedContext.type,
      eventType: observedContext.eventType,
      bloodSugar: observedContext.bloodSugar,
      insulinUnits: actualAction.administeredInsulinUnits,
      administeredInsulinUnits: actualAction.administeredInsulinUnits,
      mealCarbs: observedContext.mealCarbs,
      totalCarbs: observedContext.mealCarbs,
      foods: observedContext.foods,
      mealComponents: observedContext.mealComponents,
      carbComponents: observedContext.mealComponents,
      mealDescription: observedContext.mealDescription,
      activityDescription: observedContext.activityDescription,
      activityDurationMinutes: observedContext.activityDurationMinutes,
      activityIntensity: observedContext.activityIntensity,
      suggestedBaseUnits: calculatedGuidance.status === 'calculated' ? calculatedGuidance.baseUnits : null,
      suggestedCarbDoseUnits: calculatedGuidance.status === 'calculated' ? calculatedGuidance.carbDoseUnits : null,
      rawCarbDose: calculatedGuidance.status === 'calculated' ? calculatedGuidance.rawCarbDose : null,
      insulinCarbRatioGrams: calculatedGuidance.status === 'calculated' ? calculatedGuidance.insulinCarbRatioGrams : null,
      suggestedCorrectionUnits: calculatedGuidance.status === 'calculated' ? calculatedGuidance.correctionUnits : null,
      suggestedTotalUnits: calculatedGuidance.status === 'calculated' ? calculatedGuidance.suggestedTotalUnits : null,
      insulinPlanId: calculatedGuidance.insulinPlanId || null,
      insulinPlanSnapshot: calculatedGuidance.insulinPlanSnapshot || null,
      doseCalculationStatus: calculatedGuidance.status,
      notes: observedContext.notes,
      recordTimestamp: new Date(recordTimestamp).toISOString(),
      createdAt: existing?.createdAt ?? nowTimestamp,
      updatedAt: nowTimestamp,
      version: existing?.version || 1,
      enteredBy: existing?.enteredBy || syncRepository?.getDeviceIdentity?.() || 'Unknown',
      lastEditedBy: existing ? (syncRepository?.getDeviceIdentity?.() || 'Unknown') : null,
      deletedAt: existing?.deletedAt || null,
      deletedBy: existing?.deletedBy || null,
      source: existing?.source || 'app',
      clientCreatedAt: existing?.clientCreatedAt || existing?.createdAt || nowTimestamp,
    };
  }

  function getObservedEntryContext(form) {
    const eventType = getEditorEventType(form);
    const type = getEditorType(form);
    const recordsFood = eventType === 'meal' || entryTypeUsesFoodCalculator(type, eventType);
    const mealComponents = recordsFood ? (currentEditor?.mealComponents || []) : [];
    const foods = recordsFood ? collectFoodItemsFromForm(form) : [];
    const mealCarbs = recordsFood ? normalizeNumber(form.elements.mealCarbs?.value) : null;
    return {
      eventType,
      type,
      recordTimestamp: getEditorRecordTimestamp(form),
      bloodSugar: normalizeBloodSugar(form.elements.bloodSugar?.value),
      foods,
      mealComponents,
      mealCarbs,
      mealDescription: recordsFood ? sanitizeShortText(form.elements.mealDescription?.value, 180) : '',
      activityDescription: sanitizeShortText(form.elements.activityDescription?.value, 120),
      activityDurationMinutes: normalizeWholeNumber(form.elements.activityDurationMinutes?.value),
      activityIntensity: ACTIVITY_INTENSITY_OPTIONS.includes(form.elements.activityIntensity?.value) ? form.elements.activityIntensity.value : '',
      notes: sanitizeNotes(form.elements.notes?.value),
    };
  }

  function getCalculatedGuidance(form) {
    return getEditorDoseResult(form);
  }

  function getActualRecordedAction(form, calculatedGuidance = null) {
    let administeredInsulinUnits = normalizeNumber(form.elements.insulinUnits?.value);
    const userEditedInsulin = form.dataset.userEditedInsulin === 'true' || currentEditor?.userEditedInsulin === true;
    if (
      administeredInsulinUnits == null
      && calculatedGuidance?.status === 'calculated'
      && calculatedGuidance.suggestedTotalUnits != null
      && !userEditedInsulin
      && !currentEditor?.id
    ) {
      administeredInsulinUnits = calculatedGuidance.suggestedTotalUnits;
    }
    return {
      administeredInsulinUnits,
    };
  }

  function renderRecordConfirmation(record) {
    const root = getRoot();
    if (!root) return;
    currentEditor = {
      ...(currentEditor || {}),
      pendingRecord: record,
    };
    const suggested = record.suggestedTotalUnits == null
      ? 'No suggested dose'
      : formatInsulin(record.suggestedTotalUnits);
    const given = formatInsulin(record.administeredInsulinUnits) || 'No insulin entered';
    const differs = record.suggestedTotalUnits != null
      && record.administeredInsulinUnits != null
      && Number(record.suggestedTotalUnits) !== Number(record.administeredInsulinUnits);
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Confirm insulin given</h1>
        <dl class="lee_lee_diabetes_confirm_list">
          <div>
            <dt>Blood sugar</dt>
            <dd>${escapeHtml(formatBloodSugar(record.bloodSugar) || 'No blood sugar')}</dd>
          </div>
          <div>
            <dt>Suggested dose</dt>
            <dd>${escapeHtml(suggested)}</dd>
          </div>
          <div>
            <dt>${differs ? 'Recorded as given' : 'Insulin entered as given'}</dt>
            <dd>${escapeHtml(given)}</dd>
          </div>
          <div>
            <dt>Record time</dt>
            <dd>${escapeHtml(formatRecordDateTime(record.recordTimestamp))}</dd>
          </div>
        </dl>
        <p class="lee_lee_diabetes_help">Based on the current clinician-provided insulin plan. Confirm the dose before giving insulin.</p>
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="back-to-editor">Go Back</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="confirm-save">Confirm and Save</button>
        </div>
      </section>
    `;
  }

  function handleSave(form) {
    const record = buildRecordFromForm(form);
    if (!record) return;
    const duplicateMessage = getDuplicateScheduledContextMessage(record);
    if (duplicateMessage) {
      showEditorError(form, duplicateMessage);
      updateContextSelectAvailability(form);
      return;
    }
    if (record.eventType === 'check-insulin' && entryTypeUsesDoseGuidance(record.type) && record.administeredInsulinUnits != null) {
      renderRecordConfirmation(record);
      return;
    }
    upsertRecord(record);
    renderAfterRecordChange(record);
  }

  function renderAfterRecordChange(record) {
    if (currentEditor?.returnTo === 'history-day') {
      renderHistoryDay(getRecordEventDateKey(record));
      return;
    }
    renderHome();
  }

  function getCurrentPlan() {
    return getActiveInsulinPlan(Date.now()) || insulinPlans
      .slice()
      .sort((a, b) => (getPlanTimestampRange(b).start - getPlanTimestampRange(a).start))[0];
  }

  function getMigrationCandidateRecords() {
    return activeRecords();
  }

  function getLocalOnlyRecordCount() {
    return activeRecords().filter((record) => !['synced', 'waiting', 'offline'].includes(record.syncStatus)).length;
  }

  function shouldShowSharedSyncMigrationPrompt() {
    const metadata = getSharedSyncMigrationMetadata();
    return shouldShowProtectedApp()
      && !metadata.migrationCompleted
      && !metadata.promptDismissed
      && getMigrationCandidateRecords().length > 0;
  }

  function renderMigrationExplainer() {
    return `
      <ul class="lee_lee_diabetes_explainer_list">
        <li>Local records remain on this device.</li>
        <li>A safety backup can be downloaded before anything uploads.</li>
        <li>Duplicate detection prevents the same record from being added twice.</li>
        <li>Existing cloud data is preserved.</li>
        <li>Only missing records are uploaded.</li>
      </ul>
    `;
  }

  function focusPrimaryAction() {
    requestAnimationFrame(() => {
      const root = getRoot();
      root?.querySelector('[data-primary-focus]')?.focus();
    });
  }

  function renderSharedSyncMigrationPrompt() {
    const root = getRoot();
    if (!root) return;
    const count = getMigrationCandidateRecords().length;
    currentEditor = { mode: 'shared-sync-migration-prompt' };
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title" role="dialog" aria-modal="true">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">We found existing records on this device.</h1>
        <p class="lee_lee_diabetes_help">${escapeHtml(count)} ${count === 1 ? 'record is' : 'records are'} stored locally.</p>
        <p class="lee_lee_diabetes_help">Your shared account is ready. Upload your existing history so it becomes available on all signed-in devices.</p>
        <p class="lee_lee_diabetes_help">Nothing will be removed from this device.</p>
        ${renderMigrationExplainer()}
        <div class="lee_lee_diabetes_backup_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="export-backup" ${storageAvailability.available ? '' : 'disabled'}>Download Safety Backup</button>
        </div>
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="dismiss-migration-prompt">Not Now</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="begin-local-migration" data-started-from="prompt" data-primary-focus>Begin Migration</button>
        </div>
      </section>
    `;
    focusPrimaryAction();
    if (!isOffline && !isAuth && !isFailed && shouldAutomaticallyContinueMigration(session)) {
      scheduleMigrationContinuation(getRetryDelay(Number(session?.retryCount || 1)));
    }
  }

  function renderSharedSettingsMigrationPrompt() {
    const root = getRoot();
    if (!root) return;
    currentEditor = { mode: 'shared-settings-migration-prompt' };
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title" role="dialog" aria-modal="true">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Patient and clinic information was found on this device.</h1>
        <p class="lee_lee_diabetes_help">Upload it to the shared account so it appears the same on every signed-in device?</p>
        <p class="lee_lee_diabetes_help">Nothing will be removed from this device.</p>
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="dismiss-shared-settings-migration">Not Now</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="upload-shared-settings" data-primary-focus>Upload Shared Settings</button>
        </div>
      </section>
    `;
    focusPrimaryAction();
  }

  function renderMigrationProgress() {
    const root = getRoot();
    if (!root) return;
    const summary = getMigrationSessionSummary();
    const total = summary.total;
    const completed = summary.processed;
    const percent = summary.percent;
    currentEditor = { mode: 'shared-sync-migration-progress' };
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title" role="dialog" aria-modal="true" aria-busy="true">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Uploading existing history...</h1>
        <p class="lee_lee_diabetes_help" aria-live="polite">${escapeHtml(completed)} of ${escapeHtml(total)} complete</p>
        <p class="lee_lee_diabetes_help">${escapeHtml(summary.remaining)} ${summary.remaining === 1 ? 'record' : 'records'} remaining</p>
        <div class="lee_lee_diabetes_progress" role="progressbar" aria-label="Migration progress" aria-valuemin="0" aria-valuemax="${escapeHtml(total)}" aria-valuenow="${escapeHtml(completed)}">
          <span class="lee_lee_diabetes_progress_bar" style="width: ${escapeHtml(percent)}%"></span>
        </div>
        <p class="lee_lee_diabetes_help">Please keep Lee-Lee’s Tracker open. No local data will be removed.</p>
        <div class="lee_lee_diabetes_actions lee_lee_diabetes_actions--single">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" disabled>Migration Running</button>
        </div>
      </section>
    `;
  }

  function renderMigrationComplete() {
    const root = getRoot();
    if (!root) return;
    currentEditor = { mode: 'shared-sync-migration-complete' };
    const summary = getMigrationSessionSummary();
    const hasConflicts = summary.conflicts > 0;
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title" role="dialog" aria-modal="true">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">✓ Migration complete</h1>
        <dl class="lee_lee_diabetes_confirm_list">
          <div>
            <dt>Uploaded</dt>
            <dd>${escapeHtml(summary.uploaded)}</dd>
          </div>
          <div>
            <dt>Already existed</dt>
            <dd>${escapeHtml(summary.alreadyExisting)}</dd>
          </div>
          <div>
            <dt>Skipped duplicates</dt>
            <dd>${escapeHtml(summary.duplicates)}</dd>
          </div>
          <div>
            <dt>Needs review</dt>
            <dd>${escapeHtml(summary.conflicts)}</dd>
          </div>
          <div>
            <dt>Failed</dt>
            <dd>${escapeHtml(summary.failed)}</dd>
          </div>
        </dl>
        <p class="lee_lee_diabetes_help">${hasConflicts
          ? 'Some records require review before they can finish syncing.'
          : 'Your history is now available on every device signed into Lee-Lee’s Tracker.'}</p>
        <p class="lee_lee_diabetes_help">Realtime synchronization is active.</p>
        <div class="lee_lee_diabetes_actions ${hasConflicts ? '' : 'lee_lee_diabetes_actions--single'}">
          ${hasConflicts ? '<button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="review-conflicts">Review Conflicts</button>' : ''}
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="continue-migration-success" data-primary-focus>Continue</button>
        </div>
      </section>
    `;
    focusPrimaryAction();
  }

  function renderMigrationInterrupted() {
    const root = getRoot();
    if (!root) return;
    const session = getMigrationSession();
    const summary = getMigrationSessionSummary(session);
    const isOffline = session?.lastErrorCategory === 'offline';
    const isAuth = session?.lastErrorCategory === 'authentication';
    const isFailed = session?.status === 'needs-attention';
    const title = isAuth
      ? 'Please sign in again to continue migration.'
      : (isOffline ? 'Migration paused — you’re offline.' : (isFailed ? 'Migration needs attention.' : 'Connection is slow. Retrying automatically…'));
    const actionLabel = isAuth
      ? 'Sign In to Continue'
      : (isOffline ? 'Resume When Online' : (isFailed ? `Retry ${summary.failed || summary.remaining} Records` : 'Retry Now'));
    currentEditor = { mode: 'shared-sync-migration-interrupted' };
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title" role="dialog" aria-modal="true">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">${escapeHtml(title)}</h1>
        <p class="lee_lee_diabetes_help">${escapeHtml(summary.processed)} of ${escapeHtml(summary.total)} records are safely processed.</p>
        <p class="lee_lee_diabetes_help">${escapeHtml(summary.remaining + summary.failed)} ${summary.remaining + summary.failed === 1 ? 'record remains' : 'records remain'}.</p>
        <p class="lee_lee_diabetes_help">No data was lost. The upload will continue automatically when it can.</p>
        ${session?.lastErrorMessage ? `<p class="lee_lee_diabetes_error">${escapeHtml(session.lastErrorMessage)}</p>` : ''}
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="settings">Settings</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="resume-migration" data-primary-focus>${escapeHtml(actionLabel)}</button>
        </div>
      </section>
    `;
    focusPrimaryAction();
  }

  function renderSharedSyncWelcome() {
    const root = getRoot();
    if (!root) return;
    currentEditor = { mode: 'shared-sync-welcome' };
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title" role="dialog" aria-modal="true">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Shared Sync is Ready</h1>
        <p class="lee_lee_diabetes_help">Lee-Lee’s Tracker is now synchronized.</p>
        <p class="lee_lee_diabetes_help">Any new glucose readings or insulin records entered on family devices will automatically appear everywhere.</p>
        <p class="lee_lee_diabetes_help">You're all set.</p>
        <div class="lee_lee_diabetes_actions lee_lee_diabetes_actions--single">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="continue-shared-sync-welcome" data-primary-focus>Continue</button>
        </div>
      </section>
    `;
    focusPrimaryAction();
  }

  function renderSettings(errorMessage = '') {
    const root = getRoot();
    if (!root) return;
    currentEditor = { mode: 'settings' };
    const plan = getCurrentPlan() || clonePlanSnapshot(DEFAULT_INSULIN_PLAN);
    const friendlySyncStatus = getFriendlySyncStatus(syncStatus);
    const sharedSettingsStatus = getSharedSettingsStatus();
    root.innerHTML = `
      <form class="lee_lee_diabetes_editor" data-plan-editor>
        ${renderTrackerTop({ active: 'settings', kicker: 'Lee-Lee’s Tracker', title: 'Settings' })}
        ${renderTrackerNav('settings')}
        <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-patient-title">
          <h2 class="lee_lee_diabetes_section_title" id="lee-lee-patient-title">Patient & Clinic</h2>
          <p class="lee_lee_diabetes_help">Patient and clinic information syncs across signed-in devices.</p>
          <p class="lee_lee_diabetes_save_status lee_lee_diabetes_save_status--${escapeHtml(sharedSettingsStatus.state)}" aria-live="polite">
            ${escapeHtml(patientSettingsError || patientSettingsMessage || sharedSettingsStatus.message)}
          </p>
          <label class="lee_lee_diabetes_field">
            Patient Name
            <input class="lee_lee_diabetes_input" name="patientName" type="text" maxlength="80" value="${escapeHtml(trackerData.settings?.patientName || '')}">
          </label>
          <label class="lee_lee_diabetes_field">
            Date of Birth
            <input class="lee_lee_diabetes_input" name="patientBirthDate" type="date" value="${escapeHtml(trackerData.settings?.patientBirthDate || '')}">
          </label>
          <label class="lee_lee_diabetes_field">
            Clinic Name
            <input class="lee_lee_diabetes_input" name="clinicName" type="text" maxlength="120" value="${escapeHtml(trackerData.settings?.clinicName || '')}">
          </label>
          <label class="lee_lee_diabetes_field">
            Clinic Phone
            <input class="lee_lee_diabetes_input" name="clinicPhone" type="tel" maxlength="40" value="${escapeHtml(trackerData.settings?.clinicPhone || '')}">
          </label>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="save-patient-settings">Save Patient Info</button>
        </section>
        <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-history-preferences-title">
          <h2 class="lee_lee_diabetes_section_title" id="lee-lee-history-preferences-title">History Preferences</h2>
          <label class="lee_lee_diabetes_field">
            History Initial Window
            <select class="lee_lee_diabetes_select" name="historyInitialWindow">
              ${HISTORY_WINDOW_OPTIONS.map((option) => {
                const currentValue = trackerData.settings?.historyInitialWindowDays || String(DEFAULT_HISTORY_WINDOW_DAYS);
                return `<option value="${escapeHtml(option.value)}" ${String(currentValue) === String(option.value) ? 'selected' : ''}>${escapeHtml(option.label)}</option>`;
              }).join('')}
            </select>
          </label>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="save-history-preference">Save History Preference</button>
        </section>
        <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-sync-title">
          <h2 class="lee_lee_diabetes_section_title" id="lee-lee-sync-title">Shared Sync</h2>
          <label class="lee_lee_diabetes_field">
            This device is used by
            <select class="lee_lee_diabetes_select" name="deviceIdentity">
              ${renderDeviceIdentityOptions(syncStatus.deviceIdentity)}
            </select>
          </label>
          <div class="lee_lee_diabetes_plan_meta">
            <span>Status: ${escapeHtml(friendlySyncStatus.message)}</span>
            <span>Pending: ${escapeHtml(syncStatus.pendingCount)}</span>
            <span>Conflicts: ${escapeHtml(syncStatus.conflictCount)}</span>
            <span>Realtime: ${escapeHtml(syncStatus.realtimeStatus)}</span>
            <span>Last successful sync: ${escapeHtml(formatRelativeSyncTime(syncStatus.lastSuccessfulSyncAt))}</span>
          </div>
          <div class="lee_lee_diabetes_backup_actions">
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="save-device-identity">Save Device</button>
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="sync-now">Sync Now</button>
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="review-conflicts" ${syncStatus.conflictCount ? '' : 'disabled'}>Review Conflicts</button>
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="sign-out">Sign Out This Device</button>
          </div>
        </section>
        ${renderMigrationSettings()}
        ${renderMigrationDiagnostics()}
        <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-insulin-plan-title">
          <h2 class="lee_lee_diabetes_section_title" id="lee-lee-insulin-plan-title">Insulin Dose Guidance</h2>
          ${errorMessage ? `<p class="lee_lee_diabetes_error">${escapeHtml(errorMessage)}</p>` : ''}
          <label class="lee_lee_diabetes_field">
            Plan Name
            <input class="lee_lee_diabetes_input" name="planName" type="text" maxlength="80" value="${escapeHtml(plan.name)}">
          </label>
          <label class="lee_lee_diabetes_field">
            Effective Date
            <input class="lee_lee_diabetes_input" name="effectiveFrom" type="date" required value="${escapeHtml(plan.effectiveFrom)}">
          </label>
          <p class="lee_lee_diabetes_help">Meals use carb counting plus the correction table. Legacy fixed meal base doses are preserved for older records but no longer used for new meal calculations.</p>
          <label class="lee_lee_diabetes_field">
            Insulin-to-Carb Ratio
            <span class="lee_lee_diabetes_inline_control">1 unit per <input class="lee_lee_diabetes_input" name="insulinCarbRatioGrams" type="number" inputmode="decimal" min="0.1" step="0.1" required value="${escapeHtml(getInsulinCarbRatioGrams(plan))}"> g carbs</span>
          </label>
          <label class="lee_lee_diabetes_field">
            Bedtime Long-Acting Dose
            <input class="lee_lee_diabetes_input" name="bedtimeBaseUnits" type="number" inputmode="decimal" min="0" step="0.5" required value="${escapeHtml(getBedtimeBaseUnits(plan))}">
          </label>
          <div class="lee_lee_diabetes_plan_meta">
            <span>Active contexts: Breakfast, Lunch, Dinner, Snacks, Bedtime, Correction</span>
            <span>Last updated: ${escapeHtml(formatDate(new Date(plan.updatedAt)))}</span>
          </div>
          <fieldset class="lee_lee_diabetes_ranges">
            <legend>Correction Table</legend>
            ${plan.correctionRanges.map(renderRangeEditorRow).join('')}
          </fieldset>
          <label class="lee_lee_diabetes_field">
            Plan Notes
            <textarea class="lee_lee_diabetes_textarea" name="notes" rows="4">${escapeHtml(plan.notes || '')}</textarea>
          </label>
        </section>
        <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-backup-title">
          <h2 class="lee_lee_diabetes_section_title" id="lee-lee-backup-title">Local Backup</h2>
          <p class="lee_lee_diabetes_help">JSON backups are for restore. CSV files are for human-readable review and cannot restore the tracker.</p>
          <div class="lee_lee_diabetes_backup_actions">
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="export-backup">Export Data Backup</button>
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="export-csv">Export CSV</button>
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="import-backup">Import Data Backup</button>
          </div>
          <input class="lee_lee_diabetes_backup_input" type="file" accept="application/json,.json" data-backup-import aria-label="Import Lee-Lee’s Tracker data backup">
        </section>
        ${renderRecentlyDeletedSettings()}
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="cancel">Cancel</button>
          <button type="submit" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary">Review Plan Change</button>
        </div>
      </form>
    `;
  }

  function renderRecentlyDeletedSettings() {
    const deleted = deletedRecords();
    return `
      <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-deleted-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-deleted-title">Recently Deleted</h2>
        ${deleted.length
          ? `<div class="lee_lee_diabetes_timeline">${deleted.map((record) => `
            <article class="lee_lee_diabetes_timeline_item lee_lee_diabetes_history_record">
              <div>
                <div class="lee_lee_diabetes_timeline_type">${escapeHtml(record.type)}</div>
                <div class="lee_lee_diabetes_record_details">
                  <p>${escapeHtml(formatRecordDateTime(record.recordTimestamp))}</p>
                  <p>${escapeHtml(getRecordDisplayTitle(record))} · ${escapeHtml(getRecordPrimaryValue(record) || record.type)}</p>
                  <p>Deleted by ${escapeHtml(record.deletedBy || 'Unknown')}</p>
                </div>
              </div>
              <div class="lee_lee_diabetes_record_actions">
                <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="restore-record" data-id="${escapeHtml(record.id)}">Restore</button>
              </div>
            </article>
          `).join('')}</div>`
          : '<p class="lee_lee_diabetes_empty">No deleted records.</p>'}
      </section>
    `;
  }

  function renderMigrationDiagnostics() {
    const session = getMigrationSession();
    if (!session) return '';
    const summary = getMigrationSessionSummary(session);
    const lastProgress = session.lastProgressAt ? formatRelativeSyncTime(session.lastProgressAt) : 'Not yet';
    const retryState = session.status === 'retrying'
      ? `Retry ${Number(session.retryCount || 0)}`
      : (session.status || 'idle');
    return `
      <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-migration-diagnostics-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-migration-diagnostics-title">Migration Diagnostics</h2>
        <dl class="lee_lee_diabetes_status_grid">
          <div>
            <dt>Status</dt>
            <dd>${escapeHtml(session.status || 'idle')}</dd>
          </div>
          <div>
            <dt>Migration ID</dt>
            <dd>${escapeHtml(session.migrationId || 'Not available')}</dd>
          </div>
          <div>
            <dt>Original total</dt>
            <dd>${escapeHtml(summary.total)}</dd>
          </div>
          <div>
            <dt>Processed</dt>
            <dd>${escapeHtml(summary.processed)}</dd>
          </div>
          <div>
            <dt>Uploaded</dt>
            <dd>${escapeHtml(summary.uploaded)}</dd>
          </div>
          <div>
            <dt>Already existing</dt>
            <dd>${escapeHtml(summary.alreadyExisting)}</dd>
          </div>
          <div>
            <dt>Skipped duplicates</dt>
            <dd>${escapeHtml(summary.duplicates)}</dd>
          </div>
          <div>
            <dt>Needs review</dt>
            <dd>${escapeHtml(summary.conflicts)}</dd>
          </div>
          <div>
            <dt>Failed</dt>
            <dd>${escapeHtml(summary.failed)}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>${escapeHtml(summary.remaining)}</dd>
          </div>
          <div>
            <dt>Last progress</dt>
            <dd>${escapeHtml(lastProgress)}</dd>
          </div>
          <div>
            <dt>Last error</dt>
            <dd>${escapeHtml(session.lastErrorCategory || 'None')}</dd>
          </div>
          <div>
            <dt>Retry state</dt>
            <dd>${escapeHtml(retryState)}</dd>
          </div>
        </dl>
        ${session.lastErrorMessage ? `<p class="lee_lee_diabetes_help">${escapeHtml(session.lastErrorMessage)}</p>` : ''}
      </section>
    `;
  }

  function renderMigrationSettings() {
    const activeCount = activeRecords().length;
    const backupAvailable = storageAvailability.available;
    const metadata = getSharedSyncMigrationMetadata();
    const localOnlyCount = getLocalOnlyRecordCount();
    if (metadata.migrationCompleted && localOnlyCount === 0) {
      const friendlySyncStatus = getFriendlySyncStatus(syncStatus);
      const cloudCount = Math.max(metadata.recordsMigrated, activeCount);
      return `
        <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-cloud-status-title">
          <h2 class="lee_lee_diabetes_section_title" id="lee-lee-cloud-status-title">Cloud Status</h2>
          <p class="lee_lee_diabetes_save_status lee_lee_diabetes_save_status--${escapeHtml(friendlySyncStatus.state)}">${escapeHtml(friendlySyncStatus.message)}</p>
          <dl class="lee_lee_diabetes_status_grid">
            <div>
              <dt>Records in cloud</dt>
              <dd>${escapeHtml(cloudCount)}</dd>
            </div>
            <div>
              <dt>Realtime</dt>
              <dd>${escapeHtml(syncStatus.realtimeStatus === 'connected' ? 'Connected' : syncStatus.realtimeStatus)}</dd>
            </div>
            <div>
              <dt>Last successful sync</dt>
              <dd>${escapeHtml(formatRelativeSyncTime(syncStatus.lastSuccessfulSyncAt))}</dd>
            </div>
            <div>
              <dt>Device</dt>
              <dd>${escapeHtml(syncStatus.deviceIdentity || 'Unknown')}</dd>
            </div>
          </dl>
          <div class="lee_lee_diabetes_backup_actions">
            <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="sync-now">Sync Now</button>
          </div>
        </section>
      `;
    }
    return `
      <section class="lee_lee_diabetes_settings_section" aria-labelledby="lee-lee-migration-title">
        <h2 class="lee_lee_diabetes_section_title" id="lee-lee-migration-title">Existing Records</h2>
        ${!metadata.migrationCompleted && metadata.promptDismissed
          ? '<div class="lee_lee_diabetes_banner"><span>Existing local records have not yet been uploaded.</span><button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="begin-local-migration" data-started-from="settings">Begin Migration</button></div>'
          : ''}
        <p class="lee_lee_diabetes_help">${escapeHtml(activeCount)} active ${activeCount === 1 ? 'record' : 'records'} are available on this device. Create a safety backup before uploading existing local records to the shared account.</p>
        ${renderMigrationExplainer()}
        <div class="lee_lee_diabetes_backup_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="export-backup" ${backupAvailable ? '' : 'disabled'}>Download Safety Backup</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="begin-local-migration" data-started-from="settings" ${activeCount ? '' : 'disabled'}>Begin Migration</button>
        </div>
      </section>
    `;
  }

  function exportCsvData() {
    const csv = syncRepository?.exportCsv
      ? syncRepository.exportCsv(activeRecords())
      : '';
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    const now = new Date();
    const stamp = `${getLocalDateKey(now)}-${getLocalTimeKey(now).replace(':', '')}`;
    link.href = URL.createObjectURL(blob);
    link.download = `lee-lee-tracker-records-${stamp}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function wait(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  async function waitForMigrationQueueProgress(previousPending, previousConflicts) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      syncStatus = syncRepository?.getSyncStatus?.() || syncStatus;
      const nextConflicts = syncRepository?.getConflicts?.().length || 0;
      if (nextConflicts > previousConflicts) return syncStatus;
      if ((syncStatus.pendingCount || 0) <= previousPending) return syncStatus;
      if (syncStatus.state !== 'syncing' && syncStatus.state !== 'waiting') return syncStatus;
      await wait(100);
    }
    return syncStatus;
  }

  async function waitForMigrationOperation(operationId, previousConflicts) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      syncStatus = syncRepository?.getSyncStatus?.() || syncStatus;
      const queuedOperation = syncRepository?.getRecordQueueSnapshot?.().find((operation) => operation.id === operationId);
      const nextConflicts = syncRepository?.getConflicts?.().length || 0;
      if (!queuedOperation || nextConflicts > previousConflicts || syncStatus.state === 'offline') return syncStatus;
      await wait(120);
    }
    return syncStatus;
  }

  function getRetryDelay(retryCount) {
    const jitter = Math.round(Math.random() * 250);
    return Math.min(8000, MIGRATION_RETRY_BASE_MS * (2 ** Math.max(0, retryCount - 1)) + jitter);
  }

  function shouldAutomaticallyContinueMigration(session = getMigrationSession()) {
    if (!session || session.status === 'completed' || session.status === 'needs-attention') return false;
    if (['authentication', 'authorization', 'validation'].includes(session.lastErrorCategory)) return false;
    return getMigrationSessionSummary(session).remaining > 0;
  }

  function scheduleMigrationContinuation(delayMs = 0) {
    if (migrationRetryTimer) clearTimeout(migrationRetryTimer);
    migrationRetryTimer = setTimeout(() => {
      migrationRetryTimer = null;
      if (!shouldShowProtectedApp() || navigator.onLine === false || !shouldAutomaticallyContinueMigration()) return;
      beginLocalMigration(migrationFlow.startedFrom || 'settings');
    }, delayMs);
  }

  function setMigrationPaused(session, classification, status = 'paused') {
    return saveMigrationSession({
      ...session,
      status,
      lastAttemptAt: new Date().toISOString(),
      retryCount: Number(session.retryCount || 0) + 1,
      lastErrorCategory: classification.category,
      lastErrorMessage: classification.userMessage,
    });
  }

  function syncMigrationFlowFromSession(session, startedFrom) {
    const summary = getMigrationSessionSummary(session);
    migrationFlow = {
      state: session?.status || 'idle',
      total: summary.total,
      uploaded: summary.uploaded,
      duplicates: summary.alreadyExisting,
      conflicts: summary.conflicts,
      failed: summary.failed,
      remaining: summary.remaining,
      startedFrom,
      error: session?.lastErrorMessage || '',
    };
  }

  function markAlreadySyncedMigrationItems(session, migrationRecords) {
    let nextSession = session;
    migrationRecords.forEach((record) => {
      const sessionKey = createMigrationSessionKey(record);
      if (!(nextSession.pendingFingerprints || []).includes(sessionKey)) return;
      if (record.syncStatus === 'synced') {
        nextSession = markMigrationOutcome(nextSession, sessionKey, 'already-existing', { status: 'running' });
      }
    });
    return nextSession;
  }

  function finishMigrationSession(session) {
    const completedAt = new Date().toISOString();
    const completedSession = saveMigrationSession({
      ...session,
      status: 'completed',
      completedAt,
      lastAttemptAt: completedAt,
      lastErrorCategory: '',
      lastErrorMessage: '',
    });
    const summary = getMigrationSessionSummary(completedSession);
    saveSharedSyncMigrationMetadata({
      migrationCompleted: true,
      migrationCompletedAt: completedAt,
      migrationVersion: SHARED_SYNC_MIGRATION_VERSION,
      recordsMigrated: summary.processed,
      promptDismissed: true,
    });
    syncMigrationFlowFromSession(completedSession, migrationFlow.startedFrom);
    renderMigrationComplete();
  }

  async function beginLocalMigration(startedFrom = 'settings') {
    if (!syncRepository) return;
    if (!preservePreImportBackup()) {
      migrationFlow = {
        ...migrationFlow,
        state: 'interrupted',
        startedFrom,
        error: 'Migration stopped because a safety backup could not be saved on this device.',
      };
      renderMigrationInterrupted();
      return;
    }
    const identity = syncRepository.getDeviceIdentity?.() || 'Unknown';
    const now = new Date().toISOString();
    const migrationRecords = getMigrationCandidateRecords().map((record) => normalizeRecord({
      ...record,
      enteredBy: record.enteredBy && record.enteredBy !== 'Unknown' ? record.enteredBy : identity,
      source: record.source === 'app' ? 'localStorage_migration' : record.source,
      migrationFingerprint: record.migrationFingerprint || [
        record.recordTimestamp,
        record.eventType || '',
        record.type,
        record.bloodSugar ?? '',
        record.insulinUnits ?? '',
        record.mealCarbs ?? '',
        record.mealDescription || '',
        record.activityDescription || '',
        record.activityDurationMinutes ?? '',
        record.activityIntensity || '',
        record.notes || '',
      ].join('|'),
      updatedAt: record.updatedAt || now,
    })).filter(Boolean);
    updateTrackerData((current) => ({
      ...current,
      records: current.records.map((record) => migrationRecords.find((item) => item.id === record.id) || record),
    }));

    let session = getMigrationSession();
    const existingSourceKeys = new Set(migrationRecords.map(createMigrationSessionKey));
    const canResume = session
      && session.status !== 'completed'
      && session.migrationVersion === SHARED_SYNC_MIGRATION_VERSION
      && (session.sourceFingerprints || []).some((fingerprint) => existingSourceKeys.has(fingerprint));
    if (!canResume) session = saveMigrationSession(createMigrationSession(migrationRecords));
    session = saveMigrationSession({
      ...session,
      status: 'running',
      lastAttemptAt: now,
      lastErrorCategory: '',
      lastErrorMessage: '',
    });
    session = markAlreadySyncedMigrationItems(session, migrationRecords);
    syncMigrationFlowFromSession(session, startedFrom);

    const startedAt = Date.now();
    renderMigrationProgress();
    const recordsToProcess = getMigrationRecordsForSession(session, migrationRecords);
    for (const record of recordsToProcess) {
      const sessionKey = createMigrationSessionKey(record);
      let processed = false;
      for (let attempt = 1; attempt <= MIGRATION_MAX_RETRIES && !processed; attempt += 1) {
        try {
          syncStatus = syncRepository.getSyncStatus?.() || syncStatus;
          if (navigator.onLine === false || syncStatus.state === 'offline') {
            session = setMigrationPaused(session, classifyMigrationError(new Error('offline')), 'paused');
            syncMigrationFlowFromSession(session, startedFrom);
            renderMigrationInterrupted();
            return;
          }
          const conflictsBefore = syncRepository.getConflicts?.().length || 0;
          const existingOperation = syncRepository?.getRecordQueueSnapshot?.().find((item) => item.recordId === record.id);
          const operation = existingOperation || syncRepository.queueUpsert(record, null);
          await syncRepository.processQueue?.();
          syncStatus = await waitForMigrationOperation(operation.id, conflictsBefore);
          const conflictsAfter = syncRepository.getConflicts?.().length || 0;
          const stillQueued = syncRepository?.getRecordQueueSnapshot?.().some((item) => item.id === operation.id);
          if (conflictsAfter > conflictsBefore || syncRepository?.getConflicts?.().some((conflict) => conflict.recordId === record.id)) {
            session = markMigrationOutcome(session, sessionKey, 'conflict', { status: 'running' });
            processed = true;
          } else if (!stillQueued) {
            session = markMigrationOutcome(session, sessionKey, record.syncStatus === 'synced' ? 'already-existing' : 'uploaded', { status: 'running' });
            processed = true;
          } else if (attempt < MIGRATION_MAX_RETRIES) {
            session = setMigrationPaused(session, classifyMigrationError(new Error(syncStatus.lastError || 'timeout')), 'retrying');
            syncMigrationFlowFromSession(session, startedFrom);
            renderMigrationInterrupted();
            await wait(getRetryDelay(attempt));
          }
        } catch (error) {
          const classification = classifyMigrationError(error);
          if (['authorization', 'validation'].includes(classification.category)) {
            session = markMigrationOutcome(session, sessionKey, 'failed', {
              status: 'needs-attention',
              lastAttemptAt: new Date().toISOString(),
              retryCount: Number(session.retryCount || 0) + 1,
              lastErrorCategory: classification.category,
              lastErrorMessage: classification.userMessage,
            });
            processed = true;
          } else if (attempt < MIGRATION_MAX_RETRIES) {
            session = setMigrationPaused(session, classification, 'retrying');
            syncMigrationFlowFromSession(session, startedFrom);
            renderMigrationInterrupted();
            await wait(getRetryDelay(attempt));
          } else {
            session = setMigrationPaused(session, classification, 'paused');
            syncMigrationFlowFromSession(session, startedFrom);
            renderMigrationInterrupted();
            return;
          }
        }
      }
      if (!processed) {
        const queued = syncRepository?.getRecordQueueSnapshot?.().find((item) => item.recordId === record.id);
        const classification = classifyMigrationError(new Error(queued?.lastErrorCategory || syncStatus.lastError || 'timeout'));
        session = setMigrationPaused(session, classification, 'paused');
        syncMigrationFlowFromSession(session, startedFrom);
        renderMigrationInterrupted();
        return;
      }
      syncMigrationFlowFromSession(session, startedFrom);
      renderMigrationProgress();
    }

    const unresolved = getMigrationSessionSummary(session);
    if (unresolved.failed > 0) {
      session = saveMigrationSession({ ...session, status: 'needs-attention' });
      syncMigrationFlowFromSession(session, startedFrom);
      renderMigrationInterrupted();
      return;
    }
    if (unresolved.remaining > 0) {
      session = setMigrationPaused(session, classifyMigrationError(new Error(syncStatus.lastError || 'timeout')), 'paused');
      syncMigrationFlowFromSession(session, startedFrom);
      renderMigrationInterrupted();
      return;
    }

    syncStatus = syncRepository.getSyncStatus?.() || syncStatus;
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_MIGRATION_PROGRESS_MS) await wait(MIN_MIGRATION_PROGRESS_MS - elapsed);
    finishMigrationSession(session);
  }

  function renderRangeEditorRow(range, index) {
    return `
      <div class="lee_lee_diabetes_range_row">
        <label>
          Minimum glucose
          <input class="lee_lee_diabetes_input" name="rangeMin${index}" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(range.minGlucose ?? '')}" placeholder="Below">
        </label>
        <label>
          Maximum glucose
          <input class="lee_lee_diabetes_input" name="rangeMax${index}" type="number" inputmode="numeric" min="0" step="1" value="${escapeHtml(range.maxGlucose ?? '')}">
        </label>
        <label>
          Correction units
          <input class="lee_lee_diabetes_input" name="rangeUnits${index}" type="number" inputmode="decimal" min="0" step="0.5" value="${escapeHtml(range.correctionUnits)}">
        </label>
      </div>
    `;
  }

  function validateCorrectionRanges(ranges) {
    if (!ranges.length) return 'Add at least one correction range.';
    for (let index = 0; index < ranges.length; index += 1) {
      const range = ranges[index];
      if (range.minGlucose != null && range.maxGlucose != null && range.minGlucose > range.maxGlucose) {
        return 'Correction ranges need a minimum that is less than or equal to the maximum.';
      }
      if (index === 0 && range.minGlucose != null) {
        return 'The first correction range should omit the minimum glucose to represent below-threshold readings.';
      }
      if (index > 0) {
        const previous = ranges[index - 1];
        if (previous.maxGlucose == null) {
          return 'Only the final correction range may omit a maximum glucose.';
        }
        if (range.minGlucose == null) {
          return 'Only the first correction range may omit a minimum glucose.';
        }
        if (range.minGlucose <= previous.maxGlucose) {
          return 'Correction ranges cannot overlap.';
        }
        if (range.minGlucose !== previous.maxGlucose + 1) {
          return 'Correction ranges should be ordered without unintended gaps.';
        }
      }
    }
    return '';
  }

  function buildPlanFromSettingsForm(form) {
    const ranges = DEFAULT_INSULIN_PLAN.correctionRanges.map((_, index) => normalizeCorrectionRange({
      minGlucose: form.elements[`rangeMin${index}`]?.value,
      maxGlucose: form.elements[`rangeMax${index}`]?.value,
      correctionUnits: form.elements[`rangeUnits${index}`]?.value,
    }));
    if (ranges.some((range) => !range)) {
      return { error: 'Correction ranges must use valid glucose numbers and nonnegative correction units.' };
    }
    const rangeError = validateCorrectionRanges(ranges);
    if (rangeError) return { error: rangeError };
    const currentPlan = getCurrentPlan() || DEFAULT_INSULIN_PLAN;
    const mealBaseUnitsByType = getMealBaseUnitsByType(currentPlan);
    const insulinCarbRatioGrams = normalizeNumber(form.elements.insulinCarbRatioGrams?.value);
    if (!insulinCarbRatioGrams || insulinCarbRatioGrams <= 0) {
      return { error: 'Insulin-to-carb ratio must be greater than zero.' };
    }
    const bedtimeBaseUnits = normalizeNumber(form.elements.bedtimeBaseUnits?.value);
    if (bedtimeBaseUnits == null) {
      return { error: 'Bedtime long-acting dose must be a nonnegative number.' };
    }
    const effectiveFrom = form.elements.effectiveFrom.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return { error: 'Effective date is required.' };
    const now = new Date().toISOString();
    return {
      plan: {
        id: createId(),
        name: String(form.elements.planName.value || DEFAULT_INSULIN_PLAN.name).trim().slice(0, 80),
        effectiveFrom,
        effectiveTo: null,
        mealBaseUnitsByType,
        mealBaseUnits: mealBaseUnitsByType.Breakfast,
        bedtimeBaseUnits,
        bedtimeBaseUnitsMigratedTo17: true,
        insulinCarbRatioGrams,
        supportedMealTypes: [...MEAL_TYPES],
        correctionRanges: ranges,
        notes: sanitizeNotes(form.elements.notes.value),
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  function renderPlanConfirmation(plan) {
    const root = getRoot();
    if (!root) return;
    currentEditor = {
      mode: 'plan-confirmation',
      pendingPlan: plan,
    };
    root.innerHTML = `
      <section class="lee_lee_diabetes_editor" aria-labelledby="lee-lee-diabetes-title">
        <h1 class="lee_lee_diabetes_editor_title" id="lee-lee-diabetes-title">Confirm insulin plan change</h1>
        <p class="lee_lee_diabetes_help">You are changing the insulin plan used to calculate suggested doses.</p>
        <dl class="lee_lee_diabetes_confirm_list">
          <div>
            <dt>Plan</dt>
            <dd>${escapeHtml(plan.name)}</dd>
          </div>
          <div>
            <dt>Effective date</dt>
            <dd>${escapeHtml(plan.effectiveFrom)}</dd>
          </div>
          <div>
            <dt>Insulin-to-carb ratio</dt>
            <dd>1 unit per ${escapeHtml(getInsulinCarbRatioGrams(plan))} g carbs</dd>
          </div>
          <div>
            <dt>Bedtime long-acting dose</dt>
            <dd>${escapeHtml(formatInsulin(getBedtimeBaseUnits(plan)))}</dd>
          </div>
        </dl>
        <label class="lee_lee_diabetes_checkline">
          <span>I have verified these instructions with Lee-Lee’s diabetes care team.</span>
          <input type="checkbox" data-plan-confirm-check>
        </label>
        <div class="lee_lee_diabetes_actions">
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--ghost" data-action="settings">Go Back</button>
          <button type="button" class="lee_lee_diabetes_button lee_lee_diabetes_button--primary" data-action="confirm-plan" disabled>Activate Plan</button>
        </div>
      </section>
    `;
  }

  function activatePendingPlan() {
    const pendingPlan = currentEditor?.pendingPlan;
    if (!pendingPlan) return;
    const pendingStart = createDateStartTimestamp(pendingPlan.effectiveFrom);
    setPersistenceStatus('saving');
    updateTrackerData((current) => {
      const nextPlans = current.insulinPlans.map((plan) => {
        const range = getPlanTimestampRange(plan);
        if (pendingStart != null && range.start <= pendingStart && range.end > pendingStart) {
          return {
            ...plan,
            effectiveTo: pendingPlan.effectiveFrom,
            updatedAt: new Date().toISOString(),
          };
        }
        return plan;
      });
      nextPlans.push(pendingPlan);
      return {
        ...current,
        insulinPlans: nextPlans,
        activeInsulinPlanId: pendingPlan.id,
      };
    });
    if (syncRepository?.saveSharedSettings) {
      syncRepository.saveSharedSettings(createSharedSettingsSnapshot({ plan: pendingPlan }));
    }
    renderSettings();
  }

  function savePatientSettings(form) {
    if (!form) return;
    patientSettingsMessage = 'Saving…';
    patientSettingsError = '';
    const sharedSettings = createSharedSettingsSnapshot({
      settings: {
        ...(trackerData.settings || {}),
        patientName: String(form.elements.patientName?.value || '').trim().slice(0, 80),
        patientBirthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(form.elements.patientBirthDate?.value || ''))
          ? form.elements.patientBirthDate.value
          : '',
        clinicName: String(form.elements.clinicName?.value || '').trim().slice(0, 120),
        clinicPhone: String(form.elements.clinicPhone?.value || '').trim().slice(0, 40),
      },
    });
    const localSettings = {
      patientName: sharedSettings.patientName,
      patientBirthDate: sharedSettings.patientBirthDate,
      clinicName: sharedSettings.clinicName,
      clinicPhone: sharedSettings.clinicPhone,
    };
    setPersistenceStatus('saving');
    updateTrackerData((current) => ({
      ...current,
      settings: {
        ...(current.settings || {}),
        ...localSettings,
      },
    }));
    if (syncRepository?.saveSharedSettings) {
      syncRepository.saveSharedSettings(sharedSettings);
      patientSettingsMessage = navigator.onLine
        ? 'Patient and clinic information updated on all devices.'
        : 'Offline — waiting to sync.';
    } else {
      patientSettingsMessage = 'Patient and clinic information saved on this device.';
    }
    renderSettings();
  }

  function saveHistoryPreference(form) {
    if (!form) return;
    setPersistenceStatus('saving');
    updateTrackerData((current) => ({
      ...current,
      settings: {
        ...(current.settings || {}),
        historyInitialWindowDays: form.elements.historyInitialWindow?.value || String(DEFAULT_HISTORY_WINDOW_DAYS),
      },
    }));
    resetHistoryVisibleWindow();
    renderSettings();
  }

  function handleCancel() {
    if (currentEditor?.returnTo === 'history-day' && currentEditor.returnDateKey) {
      renderHistoryDay(currentEditor.returnDateKey);
      return;
    }
    renderHome();
  }

  function openRecordEditor(recordId, returnTo = 'history-day') {
    const record = records.find((item) => item.id === recordId);
    if (!record) return;
    const returnDateKey = getRecordEventDateKey(record);
    renderEditor({
      mode: 'edit-entry',
      type: record.type,
      record,
      returnTo,
      returnDateKey,
    });
  }

  function deleteRecord(recordId) {
    const record = records.find((item) => item.id === recordId);
    if (!record) return;
    renderDeleteConfirmation(record);
  }

  function confirmDeleteRecord() {
    const recordId = currentEditor?.pendingDeleteId;
    const returnDateKey = currentEditor?.returnDateKey;
    if (!recordId) return;
    const existingRecord = records.find((record) => record.id === recordId);
    if (!existingRecord) return;
    const now = new Date().toISOString();
    const identity = syncRepository?.getDeviceIdentity?.() || 'Unknown';
    const deletedRecord = normalizeRecord({
      ...existingRecord,
      deletedAt: now,
      deletedBy: identity,
      lastEditedBy: identity,
      updatedAt: now,
    });
    setPersistenceStatus('saving');
    updateTrackerData((current) => ({
      ...current,
      records: current.records.map((record) => (record.id === recordId ? deletedRecord : record)),
    }));
    syncRepository?.queueSoftDelete(deletedRecord);
    if (returnDateKey) {
      renderHistoryDay(returnDateKey);
    } else {
      renderHistory();
    }
  }

  function restoreRecord(recordId) {
    const existingRecord = records.find((record) => record.id === recordId);
    if (!existingRecord) return;
    const now = new Date().toISOString();
    const identity = syncRepository?.getDeviceIdentity?.() || 'Unknown';
    const restoredRecord = normalizeRecord({
      ...existingRecord,
      deletedAt: null,
      deletedBy: null,
      lastEditedBy: identity,
      updatedAt: now,
    });
    setPersistenceStatus('saving');
    updateTrackerData((current) => ({
      ...current,
      records: current.records.map((record) => (record.id === recordId ? restoredRecord : record)),
    }));
    syncRepository?.queueRestore(restoredRecord);
    renderSettings();
  }

  function updateHistoryFilters(form) {
    if (!form) return;
    historyFilters = {
      range: form.elements.range?.value || 'last14',
      type: form.elements.type?.value || 'All',
      startDate: form.elements.startDate?.value || '',
      endDate: form.elements.endDate?.value || '',
    };
    renderHistory();
  }

  function openHistoryFilters() {
    lastFocusedElement = document.activeElement;
    historyDraftFilters = { ...historyFilters };
    historyFilterSheetOpen = true;
    renderHistory();
  }

  function closeHistoryFilters() {
    historyFilterSheetOpen = false;
    renderHistory();
    lastFocusedElement?.focus?.();
    lastFocusedElement = null;
  }

  function updateHistoryDraftFilters(form) {
    if (!form) return;
    historyDraftFilters = {
      range: form.elements.range?.value || 'all',
      type: form.elements.type?.value || 'All',
      startDate: form.elements.startDate?.value || '',
      endDate: form.elements.endDate?.value || '',
    };
    historyFilterSheetOpen = true;
    renderHistory();
  }

  function applyHistoryFilters() {
    historyFilters = { ...historyDraftFilters };
    historyFilterSheetOpen = false;
    resetHistoryVisibleWindow();
    renderHistory();
  }

  function clearHistoryFilters() {
    historyFilters = { range: 'all', type: 'All', startDate: '', endDate: '' };
    historyDraftFilters = { ...historyFilters };
    historyFilterSheetOpen = false;
    resetHistoryVisibleWindow();
    renderHistory();
  }

  function loadOlderHistory() {
    const previousScrollY = window.scrollY;
    const increment = getHistoryInitialWindowDays() || DEFAULT_HISTORY_WINDOW_DAYS;
    historyVisibleDayCount = historyVisibleDayCount == null
      ? null
      : historyVisibleDayCount + increment;
    renderHistory();
    window.scrollTo?.(0, previousScrollY);
  }

  function focusHistorySheet(root) {
    if (!historyFilterSheetOpen) return;
    const sheet = root.querySelector('[data-history-filter-sheet]');
    const firstControl = sheet?.querySelector('select, input, button');
    firstControl?.focus();
  }

  function trapHistorySheetFocus(event) {
    if (!historyFilterSheetOpen || event.key !== 'Tab') return;
    const root = getRoot();
    const sheet = root?.querySelector('[data-history-filter-sheet]');
    if (!sheet) return;
    const controls = [...sheet.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.disabled && element.offsetParent !== null);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function trapCarbCalculatorFocus(event) {
    if (currentEditor?.carbCalculatorOpen !== true || event.key !== 'Tab') return;
    const root = getRoot();
    const calculator = root?.querySelector('[data-carb-calculator]');
    if (!calculator) return;
    const controls = [...calculator.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.disabled && element.offsetParent !== null);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleCarbCalculatorCarbsTab(event) {
    if (event.key !== 'Tab') return false;
    const calculator = event.target?.closest?.('[data-carb-calculator]');
    const activeInput = event.target?.name === 'carbCalcCarbs' && calculator
      ? event.target
      : null;
    if (!activeInput) return false;

    const carbInputs = [...calculator.querySelectorAll('[data-carb-calculator-rows] [name="carbCalcCarbs"]')]
      .filter((input) => !input.disabled);
    const activeIndex = carbInputs.indexOf(activeInput);
    if (activeIndex === -1) return false;

    const nextIndex = event.shiftKey ? activeIndex - 1 : activeIndex + 1;
    const nextInput = carbInputs[nextIndex];
    if (!nextInput) return false;

    const nextRowId = nextInput.dataset.carbRowId || '';
    const focusNextInput = () => {
      const targetInput = nextRowId
        ? calculator.querySelector(`[name="carbCalcCarbs"]${getCarbRowSelector(nextRowId)}`)
        : nextInput;
      targetInput?.focus({ preventScroll: true });
      if (typeof targetInput?.select === 'function') targetInput.select();
      if (document.activeElement === targetInput) {
        pendingCarbCalculatorFocusRowId = '';
        pendingCarbCalculatorFocusFieldName = '';
      }
    };
    pendingCarbCalculatorFocusRowId = nextRowId;
    pendingCarbCalculatorFocusFieldName = nextInput.name || '';
    event.preventDefault();
    event.stopPropagation();
    focusNextInput();
    requestAnimationFrame(focusNextInput);
    window.setTimeout(focusNextInput, 0);
    return true;
  }

  function updateExportOptions(root) {
    const filtersForm = root.querySelector('[data-export-filters]');
    const layoutInput = root.querySelector('[name="layout"][data-filter-scope="export"]');
    exportOptions = {
      range: filtersForm?.elements.range?.value || 'last7',
      layout: layoutInput?.value || 'clinical',
      startDate: filtersForm?.elements.startDate?.value || '',
      endDate: filtersForm?.elements.endDate?.value || '',
    };
    renderExport();
  }

  function updateReportOptions(root) {
    const filtersForm = root.querySelector('[data-reports-filters]');
    const layoutInput = root.querySelector('[name="layout"][data-filter-scope="reports"]');
    reportOptions = {
      range: filtersForm?.elements.range?.value || 'last7',
      view: reportOptions.view || 'summary',
      layout: layoutInput?.value || reportOptions.layout || 'detailed',
      startDate: filtersForm?.elements.startDate?.value || '',
      endDate: filtersForm?.elements.endDate?.value || '',
    };
    renderReports();
  }

  function createSyncRepository() {
    if (!window.LeeLeeTrackerSync?.createRepository) return null;
    return window.LeeLeeTrackerSync.createRepository({
      getDocument: () => trackerData,
      saveDocument: (data, options = {}) => saveTrackerData(data, { keepStatus: true, ...options }),
      normalizeRecord,
      normalizeFood: normalizeFoodLibraryItem,
      normalizeSavedMeal,
      mergeDocuments: mergeTrackerDocuments,
      legacyRecordKeys: LEGACY_RECORD_STORAGE_KEYS,
      getLocalSharedSettings,
      onRemoteChange: (nextData) => {
        trackerData = nextData;
        records = trackerData.records;
        insulinPlans = trackerData.insulinPlans;
        foodLibrary = trackerData.foodLibrary;
        savedMeals = trackerData.savedMeals;
        if (!currentEditor || ['history', 'history-day', 'reports', 'export', 'foods', 'settings'].includes(currentEditor.mode)) {
          if (currentEditor?.mode === 'history') renderHistory();
          else if (currentEditor?.mode === 'history-day') renderHistoryDay(currentEditor.dateKey);
          else if (currentEditor?.mode === 'reports') renderReports();
          else if (currentEditor?.mode === 'export') renderExport();
          else if (currentEditor?.mode === 'foods') renderFoodLibrary();
          else if (currentEditor?.mode === 'settings') renderSettings();
          else renderHome();
        }
      },
      onSharedSettingsChange: (settings) => {
        applySharedSettingsToLocal(settings);
        patientSettingsMessage = '';
        patientSettingsError = '';
        if (!currentEditor || ['history', 'history-day', 'reports', 'export', 'settings'].includes(currentEditor.mode)) {
          if (currentEditor?.mode === 'history') renderHistory();
          else if (currentEditor?.mode === 'history-day') renderHistoryDay(currentEditor.dateKey);
          else if (currentEditor?.mode === 'reports') renderReports();
          else if (currentEditor?.mode === 'export') renderExport();
          else if (currentEditor?.mode === 'settings') renderSettings();
          else renderHome();
        }
      },
    });
  }

  function shouldShowProtectedApp() {
    return syncStatus.configured && syncStatus.signedIn && Boolean(syncStatus.deviceIdentity);
  }

  function renderInitialRoute() {
    if (!syncStatus.configured) {
      renderConfigurationNeeded();
      return;
    }
    if (!syncStatus.signedIn) {
      renderSignIn();
      return;
    }
    if (!syncStatus.deviceIdentity) {
      renderDeviceIdentitySetup();
      return;
    }
    if (shouldShowSharedSettingsMigrationPrompt()) {
      renderSharedSettingsMigrationPrompt();
      return;
    }
    const migrationSession = getMigrationSession();
    if (migrationSession?.status && migrationSession.status !== 'completed' && getMigrationSessionSummary(migrationSession).remaining > 0) {
      if (shouldAutomaticallyContinueMigration(migrationSession) && navigator.onLine !== false) {
        syncMigrationFlowFromSession(migrationSession, 'home');
        renderMigrationProgress();
        scheduleMigrationContinuation(250);
        return;
      }
      syncMigrationFlowFromSession(migrationSession, 'home');
      renderMigrationInterrupted();
      return;
    }
    if (shouldShowSharedSyncMigrationPrompt()) {
      renderSharedSyncMigrationPrompt();
      return;
    }
    renderHome();
  }

  function refreshCurrentViewForSync() {
    if (!shouldShowProtectedApp()) {
      renderInitialRoute();
      return;
    }
    if (!currentEditor) return;
    if (currentEditor.mode === 'settings') renderSettings();
    if (currentEditor.mode === 'foods') renderFoodLibrary();
    if (currentEditor.mode === 'history') renderHistory();
    if (currentEditor.mode === 'reports') renderReports();
    if (currentEditor.mode === 'export') renderExport();
    if (currentEditor.mode === 'foods') renderFoodLibrary();
  }

  async function init() {
    const root = getRoot();
    if (!root) return;
    syncRepository = createSyncRepository();
    if (syncRepository) {
      syncRepository.subscribe((nextStatus) => {
        syncStatus = nextStatus;
        refreshCurrentViewForSync();
      });
      await syncRepository.initialize();
      syncStatus = syncRepository.getSyncStatus();
      queueStarterFoodsForSync();
    }
    root.addEventListener('pointerdown', (event) => {
      const eventTarget = event.target instanceof Element ? event.target : event.target?.parentElement;
      focusCarbCalculatorInputOnPointer(event);
      const useTarget = eventTarget?.closest?.('[data-action="use-carb-calculator-total"]');
      if (useTarget && currentEditor?.carbCalculatorOpen === true && !useTarget.disabled) {
        event.preventDefault();
        pendingCarbCalculatorUsePointerId = event.pointerId;
        return;
      }
      const target = eventTarget?.closest?.('[data-action="remove-carb-calculator-row"]');
      if (!target) return;
      event.preventDefault();
      removeCarbCalculatorRowFromTarget(target, root);
    }, true);
    root.addEventListener('pointerup', (event) => {
      if (pendingCarbCalculatorUsePointerId !== event.pointerId) return;
      pendingCarbCalculatorUsePointerId = null;
      const eventTarget = event.target instanceof Element ? event.target : event.target?.parentElement;
      const useTarget = eventTarget?.closest?.('[data-action="use-carb-calculator-total"]');
      if (!useTarget || currentEditor?.carbCalculatorOpen !== true || useTarget.disabled) return;
      event.preventDefault();
      handleUseCarbCalculatorTotal(root, useTarget);
    }, true);
    root.addEventListener('pointercancel', () => {
      pendingCarbCalculatorUsePointerId = null;
    }, true);
    root.addEventListener('click', (event) => {
      focusCarbCalculatorInputOnPointer(event);
    }, true);
    document.addEventListener('keydown', (event) => {
      handleCarbCalculatorCarbsTab(event);
    }, true);
    root.addEventListener('click', (event) => {
      const eventTarget = event.target instanceof Element ? event.target : event.target?.parentElement;
      const target = eventTarget?.closest?.('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      if (action === 'reset-password') {
        const form = target.closest('[data-auth-form]');
        const email = form?.elements.email?.value || '';
        if (!email) {
          authError = 'Enter the account email first.';
          authMessage = '';
          renderSignIn();
          return;
        }
        authError = '';
        authMessage = 'Sending reset email…';
        renderSignIn();
        syncRepository?.sendPasswordReset?.(email).then((result) => {
          authError = result?.error || '';
          authMessage = result?.ok ? 'Password reset email sent.' : '';
          renderSignIn();
        });
        return;
      }
      if (!shouldShowProtectedApp() && !['reset-password'].includes(action)) return;
      if (action === 'toggle-tracker-nav') {
        trackerMenuOpen = !trackerMenuOpen;
        const active = currentEditor?.mode === 'history' || currentEditor?.mode === 'history-day'
          ? 'history'
          : (['reports', 'export', 'foods', 'settings'].includes(currentEditor?.mode) ? currentEditor.mode : 'today');
        if (active === 'history' && currentEditor?.mode === 'history-day') renderHistoryDay(currentEditor.dateKey);
        else if (active === 'history') renderHistory();
        else if (active === 'reports') renderReports();
        else if (active === 'export') renderExport();
        else if (active === 'foods') renderFoodLibrary();
        else if (active === 'settings') renderSettings();
        else renderHome();
        return;
      }
      if (action === 'edit-primary') {
        openPrimaryEditor(target.dataset.type);
      }
      if (action === 'extra' || action === 'log-entry') {
        openExtraEditor();
      }
      if (action === 'open-carb-calculator') {
        const form = target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]');
        const scrollSnapshot = getScrollSnapshot();
        currentEditor.carbCalculatorRows = currentEditor.carbCalculatorRows || normalizeCarbCalculatorRows([]);
        renderEditor({
          mode: currentEditor?.mode || 'log-entry',
          eventType: getEditorEventType(form),
          type: getEditorType(form),
          record: buildDraftFromEditor(form),
          returnTo: currentEditor?.returnTo || null,
          returnDateKey: currentEditor?.returnDateKey || null,
          carbCalculatorOpen: true,
          carbCalculatorRows: currentEditor.carbCalculatorRows,
          carbCalculatorPicker: '',
          carbCalculatorSearch: '',
          carbCalculatorScrollSnapshot: scrollSnapshot,
          preventFocusScroll: true,
          restoreScrollSnapshot: scrollSnapshot,
        });
        return;
      }
      if (action === 'close-carb-calculator') {
        closeCarbCalculator(root, target);
        return;
      }
      if (action === 'remove-carb-calculator-row') {
        removeCarbCalculatorRowFromTarget(target, root);
        return;
      }
      if (action === 'use-carb-calculator-total') {
        handleUseCarbCalculatorTotal(root, target);
        return;
      }
      if (action === 'open-carb-calculator-picker') {
        const form = target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]');
        const requestedPicker = FOOD_LIBRARY_TABS.some(([tab]) => tab === target.dataset.picker) ? target.dataset.picker : 'foods';
        const currentPicker = currentEditor?.carbCalculatorPicker || '';
        const nextPicker = currentPicker === requestedPicker ? '' : requestedPicker;
        currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
        currentEditor.carbCalculatorPicker = nextPicker;
        renderEditor({
          mode: currentEditor?.mode || 'log-entry',
          eventType: getEditorEventType(form),
          type: getEditorType(form),
          record: buildDraftFromEditor(form),
          returnTo: currentEditor?.returnTo || null,
          returnDateKey: currentEditor?.returnDateKey || null,
          carbCalculatorOpen: true,
          carbCalculatorRows: currentEditor.carbCalculatorRows,
          mealComponents: currentEditor?.mealComponents || [],
          carbCalculatorTab: requestedPicker,
          carbCalculatorPicker: nextPicker,
          carbCalculatorSearch: '',
          carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
          carbCalculatorPickerFocus: `[data-action="open-carb-calculator-picker"][data-picker="${requestedPicker}"]`,
          preventFocusScroll: true,
        });
        return;
      }
      if (action === 'close-carb-calculator-picker') {
        const form = target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]');
        const picker = currentEditor?.carbCalculatorPicker || '';
        currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
        currentEditor.carbCalculatorPicker = '';
        currentEditor.carbCalculatorSearch = '';
        renderEditor({
          mode: currentEditor?.mode || 'log-entry',
          eventType: getEditorEventType(form),
          type: getEditorType(form),
          record: buildDraftFromEditor(form),
          returnTo: currentEditor?.returnTo || null,
          returnDateKey: currentEditor?.returnDateKey || null,
          carbCalculatorOpen: true,
          carbCalculatorRows: currentEditor.carbCalculatorRows,
          mealComponents: currentEditor?.mealComponents || [],
          carbCalculatorPicker: '',
          carbCalculatorSearch: '',
          carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
          carbCalculatorPickerFocus: picker ? `[data-action="open-carb-calculator-picker"][data-picker="${picker}"]` : '[name="carbFoodSearch"]',
          preventFocusScroll: true,
        });
        return;
      }
      if (action === 'add-food-to-carb-calculator') {
        addFoodToCarbCalculator(target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]'), target.dataset.id);
        return;
      }
      if (action === 'add-saved-meal-to-carb-calculator') {
        addSavedMealToCarbCalculator(target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]'), target.dataset.id);
        return;
      }
      if (action === 'increment-carb-row' || action === 'decrement-carb-row') {
        const form = target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]');
        setCarbRowQuantity(form, target.dataset.carbRowId || '', action === 'increment-carb-row' ? 1 : -1);
        return;
      }
      if (action === 'open-carb-food-editor' || action === 'cancel-carb-food-editor') {
        const form = target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]');
        currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
        currentEditor.carbCalculatorFoodEditorOpen = action === 'open-carb-food-editor';
        renderEditor({
          mode: currentEditor?.mode || 'log-entry',
          eventType: getEditorEventType(form),
          type: getEditorType(form),
          record: buildDraftFromEditor(form),
          returnTo: currentEditor?.returnTo || null,
          returnDateKey: currentEditor?.returnDateKey || null,
          carbCalculatorOpen: true,
          carbCalculatorRows: currentEditor.carbCalculatorRows,
          mealComponents: currentEditor?.mealComponents || [],
          carbCalculatorTab: currentEditor?.carbCalculatorTab || 'foods',
          carbCalculatorSearch: currentEditor?.carbCalculatorSearch || '',
          carbCalculatorPicker: currentEditor?.carbCalculatorPicker || 'foods',
          carbCalculatorFoodEditorOpen: currentEditor.carbCalculatorFoodEditorOpen,
          carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
          preventFocusScroll: true,
        });
        return;
      }
      if (action === 'save-carb-food-editor') {
        saveFoodFromCarbCalculator(target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]'));
        return;
      }
      if (action === 'open-carb-meal-editor' || action === 'cancel-carb-meal-editor') {
        const form = target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]');
        currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
        currentEditor.carbCalculatorMealEditorOpen = action === 'open-carb-meal-editor';
        renderEditor({
          mode: currentEditor?.mode || 'log-entry',
          eventType: getEditorEventType(form),
          type: getEditorType(form),
          record: buildDraftFromEditor(form),
          returnTo: currentEditor?.returnTo || null,
          returnDateKey: currentEditor?.returnDateKey || null,
          carbCalculatorOpen: true,
          carbCalculatorRows: currentEditor.carbCalculatorRows,
          mealComponents: currentEditor?.mealComponents || [],
          carbCalculatorTab: currentEditor?.carbCalculatorTab || 'meals',
          carbCalculatorPicker: currentEditor?.carbCalculatorPicker || '',
          carbCalculatorSearch: currentEditor?.carbCalculatorSearch || '',
          carbCalculatorMealEditorOpen: currentEditor.carbCalculatorMealEditorOpen,
          carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
          preventFocusScroll: true,
        });
        return;
      }
      if (action === 'save-carb-meal-editor') {
        saveMealFromCarbCalculator(target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]'));
        return;
      }
      if (action === 'choose-event-type') {
        openEventEditor(target.dataset.eventType || DEFAULT_EVENT_TYPE);
      }
      if (action === 'today') {
        trackerMenuOpen = false;
        renderHome();
      }
      if (action === 'history') {
        trackerMenuOpen = false;
        resetHistoryVisibleWindow();
        renderHistory();
      }
      if (action === 'reports') {
        trackerMenuOpen = false;
        renderReports();
      }
      if (action === 'report-view') {
        reportOptions = {
          ...reportOptions,
          view: REPORT_VIEW_ITEMS.some(([view]) => view === target.dataset.view) ? target.dataset.view : 'summary',
        };
        renderReports();
      }
      if (action === 'export') {
        trackerMenuOpen = false;
        renderExport();
      }
      if (action === 'foods') {
        trackerMenuOpen = false;
        foodLibraryMessage = '';
        foodLibraryError = '';
        renderFoodLibrary();
      }
      if (action === 'settings') {
        trackerMenuOpen = false;
        if (currentEditor?.mode === 'settings') {
          handleCancel();
          return;
        }
        renderSettings();
      }
      if (action === 'cancel') {
        handleCancel();
      }
      if (action === 'back-to-editor') {
        renderEditor({
          mode: currentEditor?.mode || 'extra',
          eventType: currentEditor?.pendingRecord?.eventType || currentEditor?.eventType,
          type: currentEditor?.pendingRecord?.type || currentEditor?.type,
          record: currentEditor?.pendingRecord || currentEditor?.originalRecord || {},
          returnTo: currentEditor?.returnTo || null,
          returnDateKey: currentEditor?.returnDateKey || null,
          carbCalculatorOpen: false,
          carbCalculatorRows: currentEditor?.carbCalculatorRows || [],
        });
      }
      if (action === 'confirm-save' && currentEditor?.pendingRecord) {
        const duplicateMessage = getDuplicateScheduledContextMessage(currentEditor.pendingRecord);
        if (duplicateMessage) {
          renderEditor({
            mode: currentEditor?.mode || 'log-entry',
            eventType: currentEditor.pendingRecord.eventType,
            type: currentEditor.pendingRecord.type,
            record: currentEditor.pendingRecord,
            returnTo: currentEditor?.returnTo || null,
            returnDateKey: currentEditor?.returnDateKey || null,
            error: duplicateMessage,
            carbCalculatorOpen: false,
            carbCalculatorRows: currentEditor?.carbCalculatorRows || [],
          });
          return;
        }
        upsertRecord(currentEditor.pendingRecord);
        renderAfterRecordChange(currentEditor.pendingRecord);
      }
      if (action === 'confirm-plan') {
        activatePendingPlan();
      }
      if (action === 'retry-save') {
        retrySave();
        syncRepository?.processQueue?.({ includeNeedsAttention: true });
      }
      if (action === 'export-backup') {
        exportDataBackup();
      }
      if (action === 'export-csv') {
        exportCsvData();
      }
      if (action === 'import-backup') {
        root.querySelector('[data-backup-import]')?.click();
      }
      if (action === 'confirm-import') {
        confirmImportBackup();
      }
      if (action === 'history-date') {
        renderHistoryDay(target.dataset.date);
      }
      if (action === 'reset-history-filters') {
        clearHistoryFilters();
      }
      if (action === 'edit-record') {
        openRecordEditor(target.dataset.id);
      }
      if (action === 'edit-today-record') {
        openRecordEditor(target.dataset.id, 'today');
      }
      if (action === 'delete-record') {
        deleteRecord(target.dataset.id);
      }
      if (action === 'cancel-delete') {
        renderHistoryDay(currentEditor?.returnDateKey || getLocalDateKey());
      }
      if (action === 'confirm-delete-record') {
        confirmDeleteRecord();
      }
      if (action === 'save-patient-settings') {
        savePatientSettings(target.closest('[data-plan-editor]'));
      }
      if (action === 'save-history-preference') {
        saveHistoryPreference(target.closest('[data-plan-editor]'));
      }
      if (action === 'save-food-library-item') {
        const panel = target.closest('[data-food-library-editor]');
        const id = panel?.querySelector('[name="foodId"]')?.value || '';
        const result = saveFoodLibraryItem({
          id,
          name: panel?.querySelector('[name="foodName"]')?.value || '',
          emoji: panel?.querySelector('[name="foodEmoji"]')?.value || '',
          carbs: panel?.querySelector('[name="foodCarbs"]')?.value || '',
          servingLabel: panel?.querySelector('[name="foodServingLabel"]')?.value || '',
          brand: panel?.querySelector('[name="foodBrand"]')?.value || '',
          sourceType: id ? undefined : 'user',
          favorite: panel?.querySelector('[name="foodFavorite"]')?.checked === true,
        });
        foodLibraryError = result.error || '';
        foodLibraryMessage = result.food ? 'Food saved.' : '';
        renderFoodLibrary();
      }
      if (action === 'edit-food-library-item') {
        const food = foodLibrary.find((item) => item.id === target.dataset.id);
        if (food) {
          const panel = root.querySelector('[data-food-library-editor]');
          if (panel) {
            panel.querySelector('[name="foodId"]').value = food.id;
            panel.querySelector('[name="foodName"]').value = food.name;
            panel.querySelector('[name="foodEmoji"]').value = food.emoji || '';
            panel.querySelector('[name="foodCarbs"]').value = formatCarbAmount(food.carbs);
            panel.querySelector('[name="foodServingLabel"]').value = food.servingLabel || '';
            panel.querySelector('[name="foodBrand"]').value = food.brand || '';
            panel.querySelector('[name="foodFavorite"]').checked = food.favorite === true;
            panel.querySelector('[name="foodName"]')?.focus();
          }
        }
      }
      if (action === 'toggle-food-favorite') {
        const food = foodLibrary.find((item) => item.id === target.dataset.id);
        if (food) saveFoodLibraryItem({ ...food, favorite: !food.favorite });
        if (currentEditor?.carbCalculatorOpen) {
          const form = target.closest('[data-lee-lee-editor]') || root.querySelector('[data-lee-lee-editor]');
          currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
          renderEditor({
            mode: currentEditor?.mode || 'log-entry',
            eventType: getEditorEventType(form),
            type: getEditorType(form),
            record: buildDraftFromEditor(form),
            returnTo: currentEditor?.returnTo || null,
            returnDateKey: currentEditor?.returnDateKey || null,
            carbCalculatorOpen: true,
            carbCalculatorRows: currentEditor.carbCalculatorRows,
            carbCalculatorTab: currentEditor?.carbCalculatorTab || 'favorites',
            carbCalculatorSearch: currentEditor?.carbCalculatorSearch || '',
            carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
            preventFocusScroll: true,
          });
        } else {
          renderFoodLibrary();
        }
      }
      if (action === 'delete-food-library-item') {
        const food = foodLibrary.find((item) => item.id === target.dataset.id);
        if (food && window.confirm(`Delete ${food.name}? History entries will keep their saved food snapshot.`)) {
          softDeleteLibraryItem('food', food.id);
          foodLibraryMessage = 'Food deleted.';
          renderFoodLibrary();
        }
      }
      if (action === 'delete-saved-meal') {
        const meal = savedMeals.find((item) => item.id === target.dataset.id);
        if (meal && window.confirm(`Delete ${meal.name}?`)) {
          softDeleteLibraryItem('saved-meal', meal.id);
          foodLibraryMessage = 'Saved meal deleted.';
          renderFoodLibrary();
        }
      }
      if (action === 'save-device-identity') {
        const form = target.closest('[data-plan-editor]');
        const value = form?.elements.deviceIdentity?.value || '';
        syncRepository?.setDeviceIdentity?.(value);
        syncStatus = syncRepository?.getSyncStatus?.() || syncStatus;
        renderSettings();
      }
      if (action === 'sync-now') {
        syncRepository?.syncNow?.({ includeNeedsAttention: true });
      }
      if (action === 'begin-local-migration') {
        beginLocalMigration(target.dataset.startedFrom || currentEditor?.mode || 'settings');
      }
      if (action === 'resume-migration') {
        beginLocalMigration(migrationFlow.startedFrom || 'settings');
      }
      if (action === 'dismiss-migration-prompt') {
        saveSharedSyncMigrationMetadata({
          promptDismissed: true,
          promptDismissedAt: new Date().toISOString(),
        });
        renderHome();
      }
      if (action === 'dismiss-shared-settings-migration') {
        syncRepository?.setSharedSettingsMigration?.({
          prompted: true,
          dismissedAt: new Date().toISOString(),
        });
        renderInitialRoute();
      }
      if (action === 'upload-shared-settings') {
        syncRepository?.saveSharedSettings?.({
          ...getLocalSharedSettings(),
          version: syncRepository?.getSharedSettings?.()?.version || null,
        });
        syncRepository?.setSharedSettingsMigration?.({
          prompted: true,
          completed: true,
          completedAt: new Date().toISOString(),
        });
        patientSettingsMessage = navigator.onLine
          ? 'Patient and clinic information updated on all devices.'
          : 'Offline — waiting to sync.';
        renderInitialRoute();
      }
      if (action === 'continue-migration-success') {
        const metadata = getSharedSyncMigrationMetadata();
        if (!metadata.welcomeShown) {
          renderSharedSyncWelcome();
        } else if (migrationFlow.startedFrom === 'settings') {
          renderSettings();
        } else {
          renderHome();
        }
      }
      if (action === 'continue-shared-sync-welcome') {
        saveSharedSyncMigrationMetadata({
          welcomeShown: true,
          welcomeShownAt: new Date().toISOString(),
        });
        if (migrationFlow.startedFrom === 'settings') {
          renderSettings();
        } else {
          renderHome();
        }
      }
      if (action === 'review-conflicts') {
        renderConflicts();
      }
      if (action === 'select-all-conflicts') {
        conflictSelection = new Set(syncRepository?.getConflicts?.().map((conflict) => conflict.recordId) || []);
        renderConflicts();
      }
      if (action === 'select-no-conflicts') {
        conflictSelection = new Set();
        renderConflicts();
      }
      if (action === 'bulk-keep-shared') {
        resolveSelectedConflicts('keep-shared');
      }
      if (action === 'bulk-use-local') {
        resolveSelectedConflicts('use-local');
      }
      if (action === 'keep-shared-version') {
        syncRepository?.keepSharedVersion?.(target.dataset.id).then(() => {
          syncStatus = syncRepository.getSyncStatus();
          conflictSelection.delete(target.dataset.id);
          renderConflicts();
        });
      }
      if (action === 'use-local-version') {
        syncRepository?.useLocalVersion?.(target.dataset.id).then(() => {
          syncStatus = syncRepository.getSyncStatus();
          conflictSelection.delete(target.dataset.id);
          renderConflicts();
        });
      }
      if (action === 'restore-record') {
        restoreRecord(target.dataset.id);
      }
      if (action === 'sign-out') {
        syncRepository?.signOut?.().then(() => {
          syncStatus = syncRepository.getSyncStatus();
          renderSignIn();
        });
      }
      if (action === 'print-report') {
        window.print();
      }
      if (action === 'open-history-filters') {
        openHistoryFilters();
      }
      if (action === 'cancel-history-filters') {
        closeHistoryFilters();
      }
      if (action === 'apply-history-filters') {
        applyHistoryFilters();
      }
      if (action === 'clear-history-filters') {
        clearHistoryFilters();
      }
      if (action === 'load-older-history') {
        loadOlderHistory();
      }
    });
    root.addEventListener('submit', (event) => {
      if (!event.target.matches('[data-auth-form], [data-device-identity-form], [data-lee-lee-editor], [data-plan-editor]')) return;
      event.preventDefault();
      if (event.target.matches('[data-auth-form]')) {
        const email = event.target.elements.email.value;
        const password = event.target.elements.password.value;
        authError = '';
        authMessage = 'Signing in…';
        renderSignIn();
        syncRepository?.signIn?.(email, password).then((result) => {
          authMessage = '';
          authError = result?.error || '';
          syncStatus = syncRepository.getSyncStatus();
          renderInitialRoute();
        });
        return;
      }
      if (event.target.matches('[data-device-identity-form]')) {
        const value = event.target.elements.deviceIdentity.value;
        if (!value) {
          renderDeviceIdentitySetup('Choose who normally uses this device.');
          return;
        }
        syncRepository?.setDeviceIdentity?.(value);
        syncStatus = syncRepository?.getSyncStatus?.() || syncStatus;
        renderInitialRoute();
        return;
      }
      if (!shouldShowProtectedApp()) {
        renderInitialRoute();
        return;
      }
      if (event.target.matches('[data-plan-editor]')) {
        const result = buildPlanFromSettingsForm(event.target);
        if (result.error) {
          renderSettings(result.error);
          return;
        }
        renderPlanConfirmation(result.plan);
        return;
      }
      handleSave(event.target);
    });
    root.addEventListener('input', (event) => {
      if (event.target.name === 'foodLibrarySearch') {
        foodLibrarySearch = event.target.value;
        renderFoodLibrary();
        return;
      }
      if (event.target.name === 'savedMealsSearch') {
        savedMealsSearch = event.target.value;
        renderFoodLibrary();
        return;
      }
      const form = event.target.closest('[data-lee-lee-editor]');
      if (!form) return;
      if (event.target.name === 'carbFoodSearch') {
        refreshCarbCalculatorLibrarySearch(form);
        return;
      }
      if (event.target.name === 'mealCarbs') {
        currentEditor.mealComponents = [];
      }
      if (event.target.name === 'insulinUnits') {
        form.dataset.userEditedInsulin = 'true';
        delete form.dataset.autofilledInsulin;
        delete form.dataset.autofilledInsulinUnits;
        if (currentEditor) {
          currentEditor.userEditedInsulin = true;
          currentEditor.autofilledInsulinUnits = null;
        }
      }
      updateEditorState(form);
    });
    root.addEventListener('change', (event) => {
      if (!shouldShowProtectedApp()) return;
      const confirmCheck = event.target.closest('[data-plan-confirm-check]');
      if (confirmCheck) {
        const confirmButton = root.querySelector('[data-action="confirm-plan"]');
        if (confirmButton) confirmButton.disabled = !confirmCheck.checked;
        return;
      }
      const form = event.target.closest('[data-lee-lee-editor]');
      if (!form) return;
      if (event.target.name === 'eventType') {
        currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
        renderEditor({
          mode: currentEditor?.mode || 'log-entry',
          eventType: event.target.value,
          record: buildDraftFromEditor(form),
          returnTo: currentEditor?.returnTo || null,
          returnDateKey: currentEditor?.returnDateKey || null,
          carbCalculatorOpen: currentEditor?.carbCalculatorOpen === true,
          carbCalculatorRows: currentEditor.carbCalculatorRows,
          carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || null,
        });
        return;
      }
      if (event.target.name === 'type') {
        currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
        const draft = buildDraftFromEditor(form);
        draft.type = event.target.value;
        renderEditor({
          mode: currentEditor?.mode || 'log-entry',
          eventType: draft.eventType,
          record: draft,
          returnTo: currentEditor?.returnTo || null,
          returnDateKey: currentEditor?.returnDateKey || null,
          carbCalculatorOpen: currentEditor?.carbCalculatorOpen === true,
          carbCalculatorRows: currentEditor.carbCalculatorRows,
          carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || null,
        });
        return;
      }
      updateEditorState(form);
    });
    root.addEventListener('change', (event) => {
      if (!shouldShowProtectedApp()) return;
      if (event.target.matches('[data-backup-import]')) {
        handleBackupImport(event.target.files?.[0]);
        event.target.value = '';
      }
      const conflictCheckbox = event.target.closest('[data-conflict-select]');
      if (conflictCheckbox) {
        const id = conflictCheckbox.dataset.conflictSelect;
        if (conflictCheckbox.checked) conflictSelection.add(id);
        else conflictSelection.delete(id);
        renderConflicts();
        return;
      }
      const historyForm = event.target.closest('[data-history-filters]');
      if (historyForm) {
        updateHistoryFilters(historyForm);
      }
      const historyDraftForm = event.target.closest('[data-history-filter-draft]');
      if (historyDraftForm) {
        updateHistoryDraftFilters(historyDraftForm);
      }
      if (event.target.closest('[data-export-filters]') || event.target.matches('[name="layout"][data-filter-scope="export"]')) {
        updateExportOptions(root);
      }
      if (event.target.closest('[data-reports-filters]') || event.target.matches('[name="layout"][data-filter-scope="reports"]')) {
        updateReportOptions(root);
      }
    });
    root.addEventListener('keydown', (event) => {
      if (trackerMenuOpen && event.key === 'Escape') {
        event.preventDefault();
        trackerMenuOpen = false;
        const active = currentEditor?.mode === 'history' || currentEditor?.mode === 'history-day'
          ? 'history'
          : (['reports', 'export', 'foods', 'settings'].includes(currentEditor?.mode) ? currentEditor.mode : 'today');
        if (active === 'history' && currentEditor?.mode === 'history-day') renderHistoryDay(currentEditor.dateKey);
        else if (active === 'history') renderHistory();
        else if (active === 'reports') renderReports();
        else if (active === 'export') renderExport();
        else if (active === 'foods') renderFoodLibrary();
        else if (active === 'settings') renderSettings();
        else renderHome();
        return;
      }
      if (historyFilterSheetOpen && event.key === 'Escape') {
        event.preventDefault();
        closeHistoryFilters();
        return;
      }
      if (currentEditor?.carbCalculatorOpen === true && event.key === 'Escape' && currentEditor?.carbCalculatorPicker) {
        event.preventDefault();
        const form = root.querySelector('[data-lee-lee-editor]');
        const picker = currentEditor.carbCalculatorPicker;
        currentEditor.carbCalculatorRows = collectCarbCalculatorRowsFromForm(form);
        renderEditor({
          mode: currentEditor?.mode || 'log-entry',
          eventType: getEditorEventType(form),
          type: getEditorType(form),
          record: buildDraftFromEditor(form),
          returnTo: currentEditor?.returnTo || null,
          returnDateKey: currentEditor?.returnDateKey || null,
          carbCalculatorOpen: true,
          carbCalculatorRows: currentEditor.carbCalculatorRows,
          mealComponents: currentEditor?.mealComponents || [],
          carbCalculatorPicker: '',
          carbCalculatorSearch: '',
          carbCalculatorScrollSnapshot: currentEditor?.carbCalculatorScrollSnapshot || getScrollSnapshot(),
          carbCalculatorPickerFocus: picker && picker !== 'search' ? `[data-action="open-carb-calculator-picker"][data-picker="${picker}"]` : '[name="carbFoodSearch"]',
          preventFocusScroll: true,
        });
        return;
      }
      if (currentEditor?.carbCalculatorOpen === true && event.key === 'Escape') {
        event.preventDefault();
        closeCarbCalculator(root, root.querySelector('[data-carb-calculator]'));
        return;
      }
      if (currentEditor?.carbCalculatorOpen === true && event.key === 'Enter' && event.target?.name === 'carbFoodSearch') {
        event.preventDefault();
        return;
      }
      if (event.defaultPrevented || handleCarbCalculatorCarbsTab(event)) return;
      trapHistorySheetFocus(event);
      trapCarbCalculatorFocus(event);
    });
    window.addEventListener('storage', handleExternalStorageUpdate);
    window.addEventListener('online', () => {
      if (shouldAutomaticallyContinueMigration()) scheduleMigrationContinuation(250);
    });
    requestPersistentStorage();
    renderInitialRoute();
  }

  window.LeeLeeTrackerStorage = {
    storageKey: TRACKER_STORAGE_KEY,
    schemaVersion: TRACKER_SCHEMA_VERSION,
    loadTrackerData,
    saveTrackerData,
    updateTrackerData,
    mergeTrackerDocuments,
    validateBackupPayload,
    createBackupDocument,
    helpers: window.LeeLeeTrackerDoseHelper,
  };

  window.LeeLeeTrackerSharedSettings = {
    schemaVersion: SHARED_SETTINGS_SCHEMA_VERSION,
    settingsInventory: LLT_SETTINGS_INVENTORY.map((item) => ({ ...item })),
    createSharedSettingsSnapshot: ({ document, plan } = {}) => createSharedSettingsSnapshot({
      settings: document?.settings || trackerData.settings || {},
      plan: plan || (document ? ((document.insulinPlans || []).find((item) => item.id === document.activeInsulinPlanId) || document.insulinPlans?.[0]) : getCurrentPlan()),
      version: null,
    }),
    applySharedSettingsToDocument,
    createSharedInsulinPlanSnapshot,
  };

  window.LeeLeeTrackerReports = {
    getRecordEventDateKey,
    getRecordTimestamp,
    getRecordActualInsulin,
    sortRecordsChronologically,
    groupRecordsByLocalDate,
    filterRecordsByDateRange,
    filterRecordsByEntryType,
    calculateDailySummary,
    calculateReportSummary,
    calculateContextAverages,
    buildAveragesReport,
    buildTrendSeries,
    getRecordCarbs,
    getGlucoseTargetRange,
    buildClinicalLog,
    buildDetailedReport,
    formatTime,
    formatBloodSugar,
    formatInsulin,
    getEntryCardContent,
    renderEntryCardContent,
    renderTimelineItem,
    renderHistoryRecord,
    getTodaysActivityRecords,
    getVisibleHistoryGroups,
    getHistoryFilterCount,
    getHistoryVisibleSummary,
    getDailySummaryCacheSize,
    buildClinicalReport,
    buildDetailedReportData,
    renderReportDocument,
    formatRelativeSyncTime,
    getFriendlySyncStatus,
    getMigrationSessionSummary,
    reportRegistry: REPORT_REGISTRY.map(({ id, title, description, printLayout }) => ({ id, title, description, printLayout })),
  };

  document.addEventListener('DOMContentLoaded', init);
})();
