(() => {
  const CONFIG_GLOBAL = 'LEE_LEE_TRACKER_SUPABASE_CONFIG';
  const SUPABASE_CDN_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const DEVICE_IDENTITY_KEY = 'lando-world:lee-lees-tracker:device-identity:v1';
  const SYNC_METADATA_KEY = 'lando-world:lee-lees-tracker:sync-metadata:v1';
  const SYNC_QUEUE_KEY = 'lando-world:lee-lees-tracker:sync-queue:v1';
  const SYNC_CONFLICTS_KEY = 'lando-world:lee-lees-tracker:sync-conflicts:v1';
  const SHARED_SETTINGS_CACHE_KEY = 'lando-world:lee-lees-tracker:shared-settings-cache:v1';
  const SHARED_SETTINGS_QUEUE_KEY = 'lando-world:lee-lees-tracker:shared-settings-queue:v1';
  const SHARED_SETTINGS_MIGRATION_KEY = 'lando-world:lee-lees-tracker:shared-settings-migration:v1';
  const FOOD_LIBRARY_QUEUE_KEY = 'lando-world:lee-lees-tracker:food-library-queue:v1';
  const LEGACY_MIGRATION_KEY = 'lando-world:lee-lees-tracker:legacy-migration:v1';
  const LEGACY_SNAPSHOT_PREFIX = 'lando-world:lee-lees-tracker:legacy-snapshot:';
  const REMOTE_RECORDS_TABLE = 'lee_lee_records';
  const REMOTE_SHARED_SETTINGS_TABLE = 'lee_lee_shared_settings';
  const REMOTE_FOODS_TABLE = 'lee_lee_foods';
  const REMOTE_SAVED_MEALS_TABLE = 'lee_lee_saved_meals';
  const DEVICE_USERS = ['Rolando', 'Emily', 'Levi', 'Violet', 'Unknown'];
  const DETERMINISTIC_ERROR_CATEGORIES = new Set(['authentication', 'authorization', 'validation', 'conflict']);
  const SHARED_SETTINGS_SCHEMA_VERSION = 2;
  const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];
  const DEFAULT_PLAN_EFFECTIVE_FROM = '2026-07-31';
  const DEFAULT_MEAL_BASE_UNITS_BY_TYPE = Object.freeze({ Breakfast: 5, Lunch: 6, Dinner: 6 });
  const DEFAULT_BEDTIME_BASE_UNITS = 17;
  const LEGACY_BEDTIME_BASE_UNITS = 15;
  const DEFAULT_INSULIN_CARB_RATIO_GRAMS = 20;
  const DEFAULT_DOSE_ROUNDING_MODE = 'nearest';
  const DEFAULT_DOSE_INCREMENT_UNITS = 0.5;
  const DEFAULT_MINIMUM_ALLOWABLE_DOSE_UNITS = 0;
  const DOSE_ROUNDING_MODES = Object.freeze(['down', 'nearest', 'up']);
  const HIGH_GLUCOSE_CORRECTION_RANGE = Object.freeze({ minGlucose: 550, maxGlucose: null, correctionUnits: 6 });
  const DEFAULT_SHARED_INSULIN_PLAN = Object.freeze({
    id: 'meal_plan_2026_07_31',
    name: 'Current Meal Insulin Plan',
    effectiveFrom: DEFAULT_PLAN_EFFECTIVE_FROM,
    effectiveTo: null,
    mealBaseUnitsByType: { ...DEFAULT_MEAL_BASE_UNITS_BY_TYPE },
    mealBaseUnits: DEFAULT_MEAL_BASE_UNITS_BY_TYPE.Breakfast,
    bedtimeBaseUnits: DEFAULT_BEDTIME_BASE_UNITS,
    insulinCarbRatioGrams: DEFAULT_INSULIN_CARB_RATIO_GRAMS,
    doseRoundingMode: DEFAULT_DOSE_ROUNDING_MODE,
    doseIncrementUnits: DEFAULT_DOSE_INCREMENT_UNITS,
    minimumAllowableDoseUnits: DEFAULT_MINIMUM_ALLOWABLE_DOSE_UNITS,
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
    createdAt: `${DEFAULT_PLAN_EFFECTIVE_FROM}T00:00:00.000Z`,
    updatedAt: `${DEFAULT_PLAN_EFFECTIVE_FROM}T00:00:00.000Z`,
  });

  function nowIso() {
    return new Date().toISOString();
  }

  function createId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getConfig() {
    const config = globalThis[CONFIG_GLOBAL] || {};
    const url = String(config.url || config.supabaseUrl || '').trim();
    const publishableKey = String(config.publishableKey || config.anonKey || '').trim();
    return {
      url,
      publishableKey,
      configured: /^https:\/\/.+\.supabase\.co$/.test(url) && publishableKey.length > 20,
    };
  }

  async function loadSupabaseFactory() {
    if (globalThis.supabase?.createClient) return globalThis.supabase.createClient;
    if (globalThis.createClient) return globalThis.createClient;
    const module = await import(SUPABASE_CDN_URL);
    return module.createClient;
  }

  function getDeviceIdentity() {
    const value = String(localStorage.getItem(DEVICE_IDENTITY_KEY) || '').trim();
    return DEVICE_USERS.includes(value) ? value : '';
  }

  function setDeviceIdentity(value) {
    const nextValue = DEVICE_USERS.includes(value) ? value : 'Unknown';
    localStorage.setItem(DEVICE_IDENTITY_KEY, nextValue);
    return nextValue;
  }

  function getMetadata() {
    return {
      lastSuccessfulSyncAt: null,
      realtimeStatus: 'idle',
      lastError: '',
      lastSyncAttempt: null,
      ...readJson(SYNC_METADATA_KEY, {}),
    };
  }

  function setMetadata(patch) {
    const metadata = { ...getMetadata(), ...patch };
    writeJson(SYNC_METADATA_KEY, metadata);
    return metadata;
  }

  function getQueue() {
    return readJson(SYNC_QUEUE_KEY, []).filter((operation) => operation && operation.id);
  }

  function setQueue(queue) {
    writeJson(SYNC_QUEUE_KEY, queue);
  }

  function getConflicts() {
    return readJson(SYNC_CONFLICTS_KEY, []).filter((conflict) => conflict && conflict.recordId);
  }

  function setConflicts(conflicts) {
    writeJson(SYNC_CONFLICTS_KEY, conflicts);
  }

  function getSharedSettingsCache() {
    return normalizeSharedSettings(readJson(SHARED_SETTINGS_CACHE_KEY, null));
  }

  function setSharedSettingsCache(settings) {
    const normalized = normalizeSharedSettings(settings);
    writeJson(SHARED_SETTINGS_CACHE_KEY, normalized);
    return normalized;
  }

  function getSharedSettingsQueue() {
    return readJson(SHARED_SETTINGS_QUEUE_KEY, []).filter((operation) => operation && operation.id);
  }

  function setSharedSettingsQueue(queue) {
    writeJson(SHARED_SETTINGS_QUEUE_KEY, queue);
  }

  function getFoodLibraryQueue() {
    return readJson(FOOD_LIBRARY_QUEUE_KEY, []).filter((operation) => operation && operation.id);
  }

  function setFoodLibraryQueue(queue) {
    writeJson(FOOD_LIBRARY_QUEUE_KEY, queue);
  }

  function getSharedSettingsMigration() {
    return {
      prompted: false,
      completed: false,
      completedAt: null,
      dismissedAt: null,
      ...readJson(SHARED_SETTINGS_MIGRATION_KEY, {}),
    };
  }

  function setSharedSettingsMigration(patch) {
    const next = { ...getSharedSettingsMigration(), ...patch };
    writeJson(SHARED_SETTINGS_MIGRATION_KEY, next);
    return next;
  }

  function normalizeSharedNumber(value) {
    if (value == null || value === '') return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : null;
  }

  function normalizeSharedDoseRoundingMode(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return DOSE_ROUNDING_MODES.includes(normalized) ? normalized : DEFAULT_DOSE_ROUNDING_MODE;
  }

  function normalizeSharedDoseIncrement(value) {
    const number = normalizeSharedNumber(value);
    return number != null && number > 0 ? number : DEFAULT_DOSE_INCREMENT_UNITS;
  }

  function normalizeSharedMinimumAllowableDose(value) {
    const number = normalizeSharedNumber(value);
    return number == null ? DEFAULT_MINIMUM_ALLOWABLE_DOSE_UNITS : number;
  }

  function normalizeSharedCorrectionRange(range) {
    const source = range && typeof range === 'object' ? range : {};
    const minGlucose = source.minGlucose == null || source.minGlucose === '' ? null : Number(source.minGlucose);
    const maxGlucose = source.maxGlucose == null || source.maxGlucose === '' ? null : Number(source.maxGlucose);
    const correctionUnits = normalizeSharedNumber(source.correctionUnits);
    if (
      (minGlucose != null && (!Number.isInteger(minGlucose) || minGlucose < 0))
      || (maxGlucose != null && (!Number.isInteger(maxGlucose) || maxGlucose < 0))
      || correctionUnits == null
    ) {
      return null;
    }
    return { minGlucose, maxGlucose, correctionUnits };
  }

  function ensureSharedHighGlucoseCorrectionRange(correctionRanges) {
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

  function normalizeSharedMealBaseUnitsByType(plan = {}) {
    const source = plan.mealBaseUnitsByType && typeof plan.mealBaseUnitsByType === 'object'
      ? plan.mealBaseUnitsByType
      : {};
    return Object.fromEntries(MEAL_TYPES.map((type) => [
      type,
      normalizeSharedNumber(source[type]) ?? DEFAULT_MEAL_BASE_UNITS_BY_TYPE[type],
    ]));
  }

  function normalizeSharedInsulinPlan(plan) {
    const source = plan && typeof plan === 'object' ? plan : DEFAULT_SHARED_INSULIN_PLAN;
    const effectiveFrom = /^\d{4}-\d{2}-\d{2}$/.test(String(source.effectiveFrom || ''))
      ? source.effectiveFrom
      : DEFAULT_PLAN_EFFECTIVE_FROM;
    const effectiveTo = /^\d{4}-\d{2}-\d{2}$/.test(String(source.effectiveTo || ''))
      ? source.effectiveTo
      : null;
    const correctionRanges = Array.isArray(source.correctionRanges)
      ? source.correctionRanges.map(normalizeSharedCorrectionRange).filter(Boolean)
      : [];
    const normalizedCorrectionRanges = ensureSharedHighGlucoseCorrectionRange(correctionRanges);
    const supportedMealTypes = Array.isArray(source.supportedMealTypes)
      ? source.supportedMealTypes.filter((type) => MEAL_TYPES.includes(type))
      : [...MEAL_TYPES];
    const mealBaseUnitsByType = normalizeSharedMealBaseUnitsByType(source);
    const bedtimeValue = normalizeSharedNumber(source.bedtimeBaseUnits);
    return {
      id: typeof source.id === 'string' && source.id ? source.id : DEFAULT_SHARED_INSULIN_PLAN.id,
      name: String(source.name || DEFAULT_SHARED_INSULIN_PLAN.name).trim().slice(0, 80),
      effectiveFrom,
      effectiveTo,
      mealBaseUnitsByType,
      mealBaseUnits: mealBaseUnitsByType.Breakfast,
      bedtimeBaseUnits: bedtimeValue === LEGACY_BEDTIME_BASE_UNITS && source.bedtimeBaseUnitsMigratedTo17 !== true
        ? DEFAULT_BEDTIME_BASE_UNITS
        : (bedtimeValue ?? DEFAULT_BEDTIME_BASE_UNITS),
      bedtimeBaseUnitsMigratedTo17: source.bedtimeBaseUnitsMigratedTo17 === true || bedtimeValue === LEGACY_BEDTIME_BASE_UNITS,
      insulinCarbRatioGrams: normalizeSharedNumber(source.insulinCarbRatioGrams) ?? DEFAULT_INSULIN_CARB_RATIO_GRAMS,
      doseRoundingMode: normalizeSharedDoseRoundingMode(source.doseRoundingMode),
      doseIncrementUnits: normalizeSharedDoseIncrement(source.doseIncrementUnits),
      minimumAllowableDoseUnits: normalizeSharedMinimumAllowableDose(source.minimumAllowableDoseUnits),
      supportedMealTypes: supportedMealTypes.length ? supportedMealTypes : [...MEAL_TYPES],
      correctionRanges: normalizedCorrectionRanges.length
        ? normalizedCorrectionRanges
        : DEFAULT_SHARED_INSULIN_PLAN.correctionRanges.map((range) => ({ ...range })),
      notes: String(source.notes || '').trim().slice(0, 500),
      createdAt: source.createdAt || DEFAULT_SHARED_INSULIN_PLAN.createdAt,
      updatedAt: source.updatedAt || DEFAULT_SHARED_INSULIN_PLAN.updatedAt,
    };
  }

  function sharedInsulinPlanMeaning(plan) {
    const normalized = normalizeSharedInsulinPlan(plan);
    return {
      name: normalized.name,
      effectiveFrom: normalized.effectiveFrom,
      effectiveTo: normalized.effectiveTo,
      mealBaseUnitsByType: normalized.mealBaseUnitsByType,
      mealBaseUnits: normalized.mealBaseUnits,
      bedtimeBaseUnits: normalized.bedtimeBaseUnits,
      bedtimeBaseUnitsMigratedTo17: normalized.bedtimeBaseUnitsMigratedTo17,
      insulinCarbRatioGrams: normalized.insulinCarbRatioGrams,
      doseRoundingMode: normalized.doseRoundingMode,
      doseIncrementUnits: normalized.doseIncrementUnits,
      minimumAllowableDoseUnits: normalized.minimumAllowableDoseUnits,
      supportedMealTypes: normalized.supportedMealTypes,
      correctionRanges: normalized.correctionRanges,
      notes: normalized.notes,
    };
  }

  function getSharedSettingsPayloadSource(source) {
    return source.payload && typeof source.payload === 'object' ? source.payload : {};
  }

  function getSharedPatientClinicSource(source) {
    const payload = getSharedSettingsPayloadSource(source);
    if (payload.patientClinic && typeof payload.patientClinic === 'object') return payload.patientClinic;
    if (payload.patientName || payload.patientBirthDate || payload.clinicName || payload.clinicPhone) return payload;
    return source;
  }

  function getSharedInsulinPlanSource(source) {
    const payload = getSharedSettingsPayloadSource(source);
    const insulinConfiguration = payload.insulinConfiguration && typeof payload.insulinConfiguration === 'object'
      ? payload.insulinConfiguration
      : {};
    return source.insulinPlan
      || source.activeInsulinPlan
      || insulinConfiguration.activeInsulinPlan
      || payload.insulinPlan
      || DEFAULT_SHARED_INSULIN_PLAN;
  }

  function normalizeSharedSettings(settings = {}) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const patientClinic = getSharedPatientClinicSource(source);
    return {
      schemaVersion: SHARED_SETTINGS_SCHEMA_VERSION,
      patientName: String(patientClinic.patientName || patientClinic.patient_name || source.patient_name || '').trim().slice(0, 80),
      patientBirthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(patientClinic.patientBirthDate || patientClinic.patient_date_of_birth || source.patient_date_of_birth || ''))
        ? String(patientClinic.patientBirthDate || patientClinic.patient_date_of_birth || source.patient_date_of_birth)
        : '',
      clinicName: String(patientClinic.clinicName || patientClinic.clinic_name || source.clinic_name || '').trim().slice(0, 120),
      clinicPhone: String(patientClinic.clinicPhone || patientClinic.clinic_phone || source.clinic_phone || '').trim().slice(0, 40),
      insulinPlan: normalizeSharedInsulinPlan(getSharedInsulinPlanSource(source)),
      version: Number(source.version || 0) || null,
      lastEditedBy: DEVICE_USERS.includes(source.lastEditedBy || source.last_edited_by) ? (source.lastEditedBy || source.last_edited_by) : null,
      updatedAt: source.updatedAt || source.updated_at || null,
      syncStatus: source.syncStatus || 'local',
      syncError: source.syncError || '',
    };
  }

  function sharedSettingsHaveValues(settings) {
    const normalized = normalizeSharedSettings(settings);
    return Boolean(
      normalized.patientName
      || normalized.patientBirthDate
      || normalized.clinicName
      || normalized.clinicPhone
      || stableJson(sharedInsulinPlanMeaning(normalized.insulinPlan)) !== stableJson(sharedInsulinPlanMeaning(DEFAULT_SHARED_INSULIN_PLAN))
    );
  }

  function sharedSettingsFingerprint(settings) {
    const normalized = normalizeSharedSettings(settings);
    return [
      normalized.patientName,
      normalized.patientBirthDate,
      normalized.clinicName,
      normalized.clinicPhone,
      stableJson(sharedInsulinPlanMeaning(normalized.insulinPlan)),
    ].join('|');
  }

  function sharedSettingsAreSame(left, right) {
    return sharedSettingsFingerprint(left) === sharedSettingsFingerprint(right);
  }

  function sharedSettingsFromRemote(row) {
    if (!row) return null;
    return normalizeSharedSettings({
      patientName: row.patient_name,
      patientBirthDate: row.patient_date_of_birth,
      clinicName: row.clinic_name,
      clinicPhone: row.clinic_phone,
      payload: row.payload,
      version: row.version,
      lastEditedBy: row.last_edited_by,
      updatedAt: row.updated_at,
      syncStatus: 'synced',
    });
  }

  function sharedSettingsToRemote(settings, userId) {
    const normalized = normalizeSharedSettings(settings);
    return {
      user_id: userId,
      patient_name: normalized.patientName || null,
      patient_date_of_birth: normalized.patientBirthDate || null,
      clinic_name: normalized.clinicName || null,
      clinic_phone: normalized.clinicPhone || null,
      last_edited_by: normalized.lastEditedBy || getDeviceIdentity() || null,
      payload: {
        schemaVersion: SHARED_SETTINGS_SCHEMA_VERSION,
        patientClinic: {
          patientName: normalized.patientName,
          patientBirthDate: normalized.patientBirthDate,
          clinicName: normalized.clinicName,
          clinicPhone: normalized.clinicPhone,
        },
        insulinConfiguration: {
          activeInsulinPlan: normalized.insulinPlan,
        },
      },
      app_schema_version: SHARED_SETTINGS_SCHEMA_VERSION,
    };
  }

  function publicRecord(record) {
    const {
      syncStatus,
      syncError,
      pendingOperationId,
      ...rest
    } = record || {};
    return rest;
  }

  function publicLibraryItem(item) {
    const {
      syncStatus,
      syncError,
      pendingOperationId,
      ...rest
    } = item || {};
    return rest;
  }

  function sanitizeLibraryItemForRemote(item, userId, entityType) {
    return {
      id: item.id,
      user_id: userId,
      name: item.name,
      is_favorite: item.favorite === true,
      last_used_at: item.lastUsedAt || null,
      deleted_at: item.deletedAt || null,
      deleted_by: item.deletedBy || null,
      entered_by: item.enteredBy || 'Unknown',
      last_edited_by: item.lastEditedBy || null,
      version: Number(item.version || 1),
      payload: publicLibraryItem(item),
      total_carbs: entityType === 'saved-meal' ? item.totalCarbs : null,
      carb_grams: entityType === 'food' ? item.carbs : null,
    };
  }

  function libraryItemFromRemote(row, entityType) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return {
      ...payload,
      id: row.id,
      name: row.name || payload.name || '',
      favorite: row.is_favorite === true || payload.favorite === true,
      carbs: entityType === 'food' ? (row.carb_grams ?? payload.carbs) : payload.carbs,
      totalCarbs: entityType === 'saved-meal' ? (row.total_carbs ?? payload.totalCarbs) : payload.totalCarbs,
      lastUsedAt: row.last_used_at || payload.lastUsedAt || null,
      version: Number(row.version || payload.version || 1),
      enteredBy: row.entered_by || payload.enteredBy || 'Unknown',
      lastEditedBy: row.last_edited_by || payload.lastEditedBy || null,
      deletedAt: row.deleted_at || payload.deletedAt || null,
      deletedBy: row.deleted_by || payload.deletedBy || null,
      createdAt: row.created_at || payload.createdAt || null,
      updatedAt: row.updated_at || payload.updatedAt || null,
      syncStatus: 'synced',
      syncError: '',
    };
  }

  function sanitizeRecordForRemote(record, userId) {
    return {
      id: record.id,
      user_id: userId,
      record_type: record.type || 'Other',
      blood_sugar: record.bloodSugar,
      insulin_units: record.insulinUnits,
      administered_insulin_units: record.administeredInsulinUnits,
      suggested_base_units: record.suggestedBaseUnits,
      suggested_correction_units: record.suggestedCorrectionUnits,
      suggested_total_units: record.suggestedTotalUnits,
      insulin_plan_id: record.insulinPlanId,
      insulin_plan_snapshot: record.insulinPlanSnapshot || null,
      dose_calculation_status: record.doseCalculationStatus || 'manual',
      notes: record.notes || '',
      recorded_at: record.recordTimestamp,
      client_created_at: record.clientCreatedAt || record.createdAt,
      entered_by: record.enteredBy || record.entered_by || 'Unknown',
      last_edited_by: record.lastEditedBy || record.last_edited_by || null,
      deleted_at: record.deletedAt || record.deleted_at || null,
      deleted_by: record.deletedBy || record.deleted_by || null,
      source: record.source || 'app',
      migration_fingerprint: record.migrationFingerprint || record.migration_fingerprint || null,
      import_fingerprint: record.importFingerprint || record.import_fingerprint || null,
      app_schema_version: record.appSchemaVersion || 1,
      version: Number(record.version || 1),
      payload: publicRecord(record),
    };
  }

  function getOperationTarget(operation) {
    if (operation?.type === 'insert') return `${REMOTE_RECORDS_TABLE}.insert`;
    if (['update', 'soft-delete', 'restore'].includes(operation?.type)) return 'rpc.update_lee_lee_record_with_version';
    return REMOTE_RECORDS_TABLE;
  }

  function sanitizeOperationMetadata(operation) {
    const payload = operation?.payload && typeof operation.payload === 'object' ? operation.payload : {};
    return {
      id: operation?.id || '',
      recordId: operation?.recordId || payload.id || '',
      recordType: payload.type || 'Other',
      eventType: payload.eventType || '',
      operationType: operation?.type || '',
      operationCreatedAt: operation?.createdAt || '',
      recordCreatedAt: payload.createdAt || payload.clientCreatedAt || '',
      recordUpdatedAt: payload.updatedAt || '',
      recordTimestamp: payload.recordTimestamp || '',
      version: Number(payload.version || 1),
      baseVersion: operation?.baseVersion ?? null,
      syncState: operation?.state || 'pending',
      state: operation?.state || 'pending',
      retryCount: Number(operation?.retryCount || 0),
      remoteId: operation?.recordId || payload.id || '',
      deleted: Boolean(payload.deletedAt || payload.deleted_at),
      expectedTarget: getOperationTarget(operation),
      schemaVersion: Number(payload.appSchemaVersion || payload.app_schema_version || 1),
      lastErrorCategory: operation?.lastErrorCategory || '',
      lastErrorCode: operation?.lastErrorCode || '',
      lastErrorMessage: operation?.lastErrorMessage || '',
    };
  }

  function sanitizeSupabaseError(error) {
    return {
      code: String(error?.code || error?.status || '').slice(0, 80),
      status: error?.status || error?.statusCode || null,
      message: String(error?.message || error || '').slice(0, 300),
      details: String(error?.details || '').slice(0, 300),
      hint: String(error?.hint || '').slice(0, 300),
    };
  }

  function categorizeError(error) {
    const code = String(error?.code || '').toUpperCase();
    const message = String(error?.message || error || '').toLowerCase();
    if (code === '28000' || code === 'PGRST301' || message.includes('jwt') || message.includes('auth')) return 'authentication';
    if (code === '42501' || message.includes('permission') || message.includes('rls') || message.includes('row-level security')) return 'authorization';
    if (code === '23505' || message.includes('duplicate')) return 'duplicate';
    if (code === '23514' || code === '22P02' || message.includes('invalid') || message.includes('constraint')) return 'validation';
    return navigator.onLine ? 'remote' : 'network';
  }

  function createSyncAttempt(total) {
    return {
      createdAt: nowIso(),
      attempted: total,
      succeeded: 0,
      failed: 0,
      failuresByReason: {},
      auth: {
        checked: false,
        valid: false,
        userIdAvailable: false,
        expiresAt: null,
        error: '',
      },
      items: [],
    };
  }

  function recordAttemptItem(attempt, operation, result, extras = {}) {
    const item = {
      operationId: operation?.id || '',
      recordId: operation?.recordId || operation?.payload?.id || '',
      operationType: operation?.type || '',
      recordType: operation?.payload?.type || 'Other',
      eventType: operation?.payload?.eventType || '',
      expectedTarget: getOperationTarget(operation),
      result,
      ...extras,
    };
    attempt.items.push(item);
    if (result === 'succeeded') attempt.succeeded += 1;
    if (result === 'failed') {
      attempt.failed += 1;
      const reason = extras.category || 'unknown';
      attempt.failuresByReason[reason] = (attempt.failuresByReason[reason] || 0) + 1;
    }
  }

  function logSyncAttempt(attempt) {
    setMetadata({ lastSyncAttempt: attempt });
    if (attempt.failed && globalThis.console?.warn) {
      console.warn('Lee-Lee sync attempt', {
        attempted: attempt.attempted,
        succeeded: attempt.succeeded,
        failed: attempt.failed,
        failuresByReason: attempt.failuresByReason,
        auth: attempt.auth,
        items: attempt.items,
      });
    }
  }

  function createVersionedMutationArgs(remoteRecord, expectedVersion) {
    return {
      p_id: remoteRecord.id,
      p_expected_version: Number(expectedVersion),
      p_record_type: remoteRecord.record_type,
      p_blood_sugar: remoteRecord.blood_sugar,
      p_insulin_units: remoteRecord.insulin_units,
      p_administered_insulin_units: remoteRecord.administered_insulin_units,
      p_suggested_base_units: remoteRecord.suggested_base_units,
      p_suggested_correction_units: remoteRecord.suggested_correction_units,
      p_suggested_total_units: remoteRecord.suggested_total_units,
      p_insulin_plan_id: remoteRecord.insulin_plan_id,
      p_insulin_plan_snapshot: remoteRecord.insulin_plan_snapshot,
      p_dose_calculation_status: remoteRecord.dose_calculation_status,
      p_notes: remoteRecord.notes,
      p_recorded_at: remoteRecord.recorded_at,
      p_entered_by: remoteRecord.entered_by,
      p_last_edited_by: remoteRecord.last_edited_by,
      p_deleted_at: remoteRecord.deleted_at,
      p_deleted_by: remoteRecord.deleted_by,
      p_source: remoteRecord.source,
      p_client_created_at: remoteRecord.client_created_at,
      p_migration_fingerprint: remoteRecord.migration_fingerprint,
      p_import_fingerprint: remoteRecord.import_fingerprint,
      p_app_schema_version: remoteRecord.app_schema_version,
      p_payload: remoteRecord.payload,
    };
  }

  function recordFromRemote(row) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    return {
      ...payload,
      id: row.id,
      type: row.record_type || payload.type || 'Other',
      bloodSugar: row.blood_sugar,
      insulinUnits: row.insulin_units,
      administeredInsulinUnits: row.administered_insulin_units,
      suggestedBaseUnits: row.suggested_base_units,
      suggestedCorrectionUnits: row.suggested_correction_units,
      suggestedTotalUnits: row.suggested_total_units,
      insulinPlanId: row.insulin_plan_id,
      insulinPlanSnapshot: row.insulin_plan_snapshot || null,
      doseCalculationStatus: row.dose_calculation_status || payload.doseCalculationStatus || 'manual',
      notes: row.notes || '',
      recordTimestamp: row.recorded_at,
      createdAt: row.created_at || payload.createdAt || row.client_created_at,
      updatedAt: row.updated_at || payload.updatedAt || row.client_created_at,
      clientCreatedAt: row.client_created_at || payload.clientCreatedAt,
      version: Number(row.version || payload.version || 1),
      enteredBy: row.entered_by || payload.enteredBy || 'Unknown',
      lastEditedBy: row.last_edited_by || payload.lastEditedBy || null,
      deletedAt: row.deleted_at || payload.deletedAt || null,
      deletedBy: row.deleted_by || payload.deletedBy || null,
      source: row.source || payload.source || 'app',
      migrationFingerprint: row.migration_fingerprint || payload.migrationFingerprint || null,
      importFingerprint: row.import_fingerprint || payload.importFingerprint || null,
      appSchemaVersion: row.app_schema_version || payload.appSchemaVersion || 1,
      syncStatus: 'synced',
    };
  }

  function createOperation(type, record, baseVersion = null) {
    return {
      id: createId(),
      recordId: record.id,
      type,
      payload: publicRecord(record),
      baseVersion,
      createdAt: nowIso(),
      retryCount: 0,
      lastErrorCategory: '',
      state: 'pending',
    };
  }

  function fingerprintRecord(record) {
    return [
      record.id,
      record.recordTimestamp,
      record.eventType || '',
      record.type,
      record.bloodSugar ?? '',
      record.insulinUnits ?? '',
      record.administeredInsulinUnits ?? '',
      record.mealCarbs ?? '',
      record.totalCarbs ?? '',
      stableJson(record.foods || []),
      record.mealDescription || '',
      record.activityDescription || '',
      record.activityDurationMinutes ?? '',
      record.activityIntensity || '',
      record.notes || '',
    ].join('|');
  }

  function stableJson(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${key}:${stableJson(value[key])}`).join(',')}}`;
    }
    return String(value);
  }

  function recordMeaningFingerprint(record = {}) {
    const source = record && typeof record === 'object' ? record : {};
    return [
      source.type || 'Other',
      source.eventType || '',
      source.bloodSugar ?? '',
      source.insulinUnits ?? '',
      source.administeredInsulinUnits ?? '',
      source.mealCarbs ?? '',
      source.totalCarbs ?? '',
      stableJson(source.foods || []),
      source.mealDescription || '',
      source.activityDescription || '',
      source.activityDurationMinutes ?? '',
      source.activityIntensity || '',
      source.suggestedBaseUnits ?? '',
      source.suggestedCarbDoseUnits ?? '',
      source.rawCarbDose ?? '',
      source.insulinCarbRatioGrams ?? '',
      source.suggestedCorrectionUnits ?? '',
      source.suggestedTotalUnits ?? '',
      source.insulinPlanId || '',
      stableJson(source.insulinPlanSnapshot || null),
      source.doseCalculationStatus || 'manual',
      source.notes || '',
      source.recordTimestamp || '',
      source.deletedAt || '',
      source.deletedBy || '',
    ].join('|');
  }

  function recordsHaveSameContent(left, right) {
    return recordMeaningFingerprint(left) === recordMeaningFingerprint(right);
  }

  function createRepository(options) {
    const {
      getDocument,
      saveDocument,
      normalizeRecord,
      normalizeFood,
      normalizeSavedMeal,
      mergeDocuments,
      onRemoteChange,
      onSharedSettingsChange,
      getLocalSharedSettings,
      legacyRecordKeys = [],
    } = options;
    const listeners = new Set();
    let supabaseClient = null;
    let session = null;
    let initialized = false;
    let processing = false;
    let processingSharedSettings = false;
    let processingFoodLibrary = false;
    let realtimeChannel = null;
    let sharedSettingsChannel = null;

    function emit() {
      listeners.forEach((listener) => listener(getSyncStatus()));
    }

    function getSharedSettingsStatus() {
      const cache = getSharedSettingsCache();
      const queue = getSharedSettingsQueue();
      const conflicts = getConflicts().filter((conflict) => conflict.entityType === 'shared-settings');
      const migration = getSharedSettingsMigration();
      let state = cache.syncStatus || 'local';
      let message = 'Patient and clinic information is saved on this device.';
      if (conflicts.length) {
        state = 'conflict';
        message = 'Conflict needs review';
      } else if (queue.length && !navigator.onLine) {
        state = 'offline';
        message = 'Offline — waiting to sync';
      } else if (queue.length) {
        state = processingSharedSettings ? 'syncing' : 'waiting';
        message = processingSharedSettings ? 'Saving…' : 'Waiting to sync';
      } else if (cache.version) {
        state = 'synced';
        message = 'Shared settings synced';
      }
      return {
        state,
        message,
        hasRemote: Boolean(cache.version),
        version: cache.version,
        updatedAt: cache.updatedAt,
        conflictCount: conflicts.length,
        pendingCount: queue.length,
        migration,
      };
    }

    function getSyncStatus() {
      const config = getConfig();
      const queue = getQueue();
      const sharedSettingsQueue = getSharedSettingsQueue();
      const foodLibraryQueue = getFoodLibraryQueue();
      const conflicts = getConflicts();
      const metadata = getMetadata();
      const pendingCount = queue.filter((operation) => operation.state !== 'conflicted').length;
      const sharedPendingCount = sharedSettingsQueue.filter((operation) => operation.state !== 'conflicted').length;
      const foodLibraryPendingCount = foodLibraryQueue.filter((operation) => operation.state !== 'conflicted').length;
      const totalPendingCount = pendingCount + sharedPendingCount + foodLibraryPendingCount;
      let state = 'saved';
      let message = 'Saved on this device';
      if (!config.configured) {
        state = 'config-needed';
        message = 'Supabase setup needed';
      } else if (!session) {
        state = 'signed-out';
        message = 'Sign in to sync';
      } else if (conflicts.length) {
        state = 'conflict';
        message = 'Conflict needs review';
      } else if (totalPendingCount && !navigator.onLine) {
        state = 'offline';
        message = `Offline — ${totalPendingCount} waiting to sync`;
      } else if (totalPendingCount) {
        state = processing || processingSharedSettings || processingFoodLibrary ? 'syncing' : 'waiting';
        message = processing || processingSharedSettings || processingFoodLibrary ? 'Syncing…' : `${totalPendingCount} waiting to sync`;
      } else if (metadata.lastSuccessfulSyncAt) {
        state = 'synced';
        message = 'Synced';
      }
      return {
        configured: config.configured,
        signedIn: Boolean(session),
        deviceIdentity: getDeviceIdentity(),
        pendingCount: totalPendingCount,
        recordPendingCount: pendingCount,
        sharedSettingsPendingCount: sharedPendingCount,
        foodLibraryPendingCount,
        conflictCount: conflicts.length,
        sharedSettingsStatus: getSharedSettingsStatus(),
        lastSuccessfulSyncAt: metadata.lastSuccessfulSyncAt,
        realtimeStatus: metadata.realtimeStatus || 'idle',
        lastError: metadata.lastError || '',
        lastSyncAttempt: metadata.lastSyncAttempt || null,
        state,
        message,
      };
    }

    function getRecordQueueSnapshot() {
      return getQueue().map(sanitizeOperationMetadata);
    }

    function getSyncDiagnostics() {
      const metadata = getMetadata();
      return {
        queue: getRecordQueueSnapshot(),
        sharedSettingsQueue: getSharedSettingsQueue().map(sanitizeOperationMetadata),
        foodLibraryQueue: getFoodLibraryQueue().map((operation) => ({
          id: operation.id,
          recordId: operation.recordId,
          entityType: operation.entityType,
          operationType: operation.type,
          state: operation.state || 'pending',
          retryCount: Number(operation.retryCount || 0),
          updatedAt: operation.payload?.updatedAt || '',
          deleted: Boolean(operation.payload?.deletedAt),
        })),
        conflicts: getConflicts().map((conflict) => ({
          id: conflict.id,
          recordId: conflict.recordId,
          entityType: conflict.entityType || 'record',
          operationType: conflict.operation?.type || '',
          createdAt: conflict.createdAt || '',
          localVersion: Number(conflict.localRecord?.version || 1),
          sharedVersion: conflict.sharedRecord?.version ?? null,
        })),
        lastSyncAttempt: metadata.lastSyncAttempt || null,
        lastError: metadata.lastError || '',
      };
    }

    function subscribe(listener) {
      listeners.add(listener);
      listener(getSyncStatus());
      return () => listeners.delete(listener);
    }

    async function ensureClient() {
      const config = getConfig();
      if (!config.configured) return null;
      if (!supabaseClient) {
        const createClient = await loadSupabaseFactory();
        supabaseClient = createClient(config.url, config.publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
      }
      return supabaseClient;
    }

    async function refreshSession(client) {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      session = data?.session || null;
      return session;
    }

    async function initialize() {
      if (initialized) return getSyncStatus();
      initialized = true;
      try {
        const client = await ensureClient();
        if (client) {
          const { data } = await client.auth.getSession();
          session = data?.session || null;
          client.auth.onAuthStateChange((_event, nextSession) => {
            session = nextSession || null;
            if (session) {
              reconcile().catch(() => {});
              reconcileSharedSettings().catch(() => {});
              reconcileFoodLibrary().catch(() => {});
              subscribeRealtime();
              subscribeSharedSettingsRealtime();
            } else {
              unsubscribeRealtime();
              unsubscribeSharedSettingsRealtime();
            }
            emit();
          });
          if (session) {
            subscribeRealtime();
            subscribeSharedSettingsRealtime();
            await reconcile();
            await reconcileSharedSettings();
            await reconcileFoodLibrary();
          }
        }
      } catch (error) {
        setMetadata({ lastError: 'Supabase could not be reached.' });
      }
      emit();
      return getSyncStatus();
    }

    async function signIn(email, password) {
      const client = await ensureClient();
      if (!client) return { error: 'Supabase setup is missing.' };
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setMetadata({ lastError: error.message || 'Sign-in failed.' });
        emit();
        return { error: 'Sign-in failed. Check the email and password.' };
      }
      session = data?.session || null;
      await reconcile();
      await reconcileSharedSettings();
      await reconcileFoodLibrary();
      subscribeRealtime();
      subscribeSharedSettingsRealtime();
      emit();
      return { ok: true };
    }

    async function signOut() {
      const client = await ensureClient();
      if (client) await client.auth.signOut({ scope: 'local' });
      session = null;
      unsubscribeRealtime();
      unsubscribeSharedSettingsRealtime();
      emit();
    }

    async function sendPasswordReset(email) {
      const client = await ensureClient();
      if (!client) return { error: 'Supabase setup is missing.' };
      const redirectTo = `${location.origin}${location.pathname}`;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return { error: 'Password reset could not be started.' };
      return { ok: true };
    }

    function markLocalRecord(record, status, error = '') {
      const current = getDocument();
      const nextRecords = current.records.map((item) => item.id === record.id
        ? { ...item, syncStatus: status, syncError: error }
        : item);
      saveDocument({ ...current, records: nextRecords }, { keepStatus: true });
    }

    function queueOperation(type, record, baseVersion = null) {
      const operation = createOperation(type, record, baseVersion);
      setQueue([...getQueue(), operation]);
      markLocalRecord(record, navigator.onLine ? 'waiting' : 'offline');
      emit();
      processQueue().catch(() => {});
      return operation;
    }

    function queueUpsert(record, existingRecord = null) {
      const identity = getDeviceIdentity() || 'Unknown';
      const now = nowIso();
      const nextRecord = normalizeRecord({
        ...record,
        version: existingRecord ? Number(existingRecord.version || 1) : 1,
        enteredBy: existingRecord?.enteredBy || record.enteredBy || identity,
        lastEditedBy: existingRecord ? identity : record.lastEditedBy || null,
        source: record.source || 'app',
        clientCreatedAt: record.clientCreatedAt || record.createdAt || now,
      });
      return queueOperation(existingRecord ? 'update' : 'insert', nextRecord, existingRecord?.version || null);
    }

    function queueSoftDelete(record) {
      const identity = getDeviceIdentity() || 'Unknown';
      const now = nowIso();
      const nextRecord = normalizeRecord({
        ...record,
        deletedAt: now,
        deletedBy: identity,
        lastEditedBy: identity,
        updatedAt: now,
        version: Number(record.version || 1),
      });
      return queueOperation('soft-delete', nextRecord, record.version || null);
    }

    function queueRestore(record) {
      const identity = getDeviceIdentity() || 'Unknown';
      const now = nowIso();
      const nextRecord = normalizeRecord({
        ...record,
        deletedAt: null,
        deletedBy: null,
        lastEditedBy: identity,
        updatedAt: now,
        version: Number(record.version || 1),
      });
      return queueOperation('restore', nextRecord, record.version || null);
    }

    async function processQueue(options = {}) {
      if (processing || !navigator.onLine) return getSyncStatus();
      const client = await ensureClient();
      if (!client) return getSyncStatus();
      const queueSnapshot = getQueue();
      const skipped = queueSnapshot.filter((operation) => operation.state === 'needs-attention' && !options.includeNeedsAttention);
      const currentQueue = queueSnapshot.filter((operation) => operation.state !== 'needs-attention' || options.includeNeedsAttention);
      const attempt = createSyncAttempt(currentQueue.length);
      if (!currentQueue.length) {
        logSyncAttempt(attempt);
        return getSyncStatus();
      }
      try {
        const currentSession = await refreshSession(client);
        attempt.auth = {
          checked: true,
          valid: Boolean(currentSession?.user?.id),
          userIdAvailable: Boolean(currentSession?.user?.id),
          expiresAt: currentSession?.expires_at || currentSession?.expiresAt || null,
          error: '',
        };
      } catch (error) {
        const details = sanitizeSupabaseError(error);
        attempt.auth = {
          checked: true,
          valid: false,
          userIdAvailable: false,
          expiresAt: null,
          error: details.message || 'Session could not be refreshed.',
        };
        currentQueue.forEach((operation) => recordAttemptItem(attempt, operation, 'failed', {
          category: 'authentication',
          error: details,
        }));
        setQueue([
          ...skipped,
          ...currentQueue.map((operation) => ({
            ...operation,
            retryCount: Number(operation.retryCount || 0) + 1,
            lastErrorCategory: 'authentication',
            lastErrorCode: details.code,
            lastErrorMessage: details.message,
            state: 'needs-attention',
          })),
        ]);
        setMetadata({ lastError: 'Sign in again to sync pending records.' });
        logSyncAttempt(attempt);
        emit();
        return getSyncStatus();
      }
      if (!session?.user?.id) {
        currentQueue.forEach((operation) => recordAttemptItem(attempt, operation, 'failed', {
          category: 'authentication',
          error: { code: '', status: null, message: 'No authenticated Supabase session.', details: '', hint: '' },
        }));
        setMetadata({ lastError: 'Sign in to sync pending records.' });
        logSyncAttempt(attempt);
        emit();
        return getSyncStatus();
      }
      processing = true;
      emit();
      const remaining = [];
      for (const operation of currentQueue) {
        try {
          const remoteRecord = sanitizeRecordForRemote(operation.payload, session.user.id);
          if (operation.type === 'insert') {
            const { data, error } = await client
              .from(REMOTE_RECORDS_TABLE)
              .insert(remoteRecord)
              .select()
              .single();
            if (error) {
              if (isDuplicateKeyError(error)) {
                const existing = await fetchRemoteRecord(operation.recordId);
                if (existing && recordsHaveSameContent(existing, operation.payload)) {
                  mergeRemoteRecords([existing]);
                  recordAttemptItem(attempt, operation, 'succeeded', { reconciledDuplicate: true });
                  continue;
                }
                await registerConflict(operation, existing);
                recordAttemptItem(attempt, operation, 'succeeded', { conflictCreated: true, category: 'conflict' });
                continue;
              }
              throw error;
            }
            mergeRemoteRecords([recordFromRemote(data)]);
            recordAttemptItem(attempt, operation, 'succeeded');
            continue;
          }
          const expectedVersion = Number(operation.baseVersion || operation.payload.version || 1);
          const { data, error } = await client
            .rpc('update_lee_lee_record_with_version', createVersionedMutationArgs(remoteRecord, expectedVersion));
          if (error) throw error;
          const updatedRow = Array.isArray(data) ? data[0] : data;
          if (!updatedRow) {
            await registerConflict(operation);
            recordAttemptItem(attempt, operation, 'succeeded', { conflictCreated: true, category: 'conflict' });
            continue;
          }
          mergeRemoteRecords([recordFromRemote(updatedRow)]);
          recordAttemptItem(attempt, operation, 'succeeded');
        } catch (error) {
          const category = categorizeError(error);
          const details = sanitizeSupabaseError(error);
          const failed = {
            ...operation,
            retryCount: Number(operation.retryCount || 0) + 1,
            lastErrorCategory: category,
            lastErrorCode: details.code,
            lastErrorMessage: details.message,
            lastErrorDetails: details.details,
            lastErrorHint: details.hint,
            state: DETERMINISTIC_ERROR_CATEGORIES.has(category) ? 'needs-attention' : 'pending',
          };
          remaining.push(failed);
          recordAttemptItem(attempt, operation, 'failed', {
            category,
            error: details,
          });
          if (['authentication', 'authorization', 'validation'].includes(failed.lastErrorCategory)) {
            setMetadata({ lastError: 'A sync item needs review before it can be uploaded.' });
          } else {
            setMetadata({ lastError: 'Sync will retry when the connection is available.' });
          }
        }
      }
      setQueue([...skipped, ...remaining]);
      processing = false;
      if (!remaining.length) setMetadata({ lastSuccessfulSyncAt: nowIso(), lastError: '' });
      logSyncAttempt(attempt);
      emit();
      return getSyncStatus();
    }

    function isDuplicateKeyError(error) {
      return error?.code === '23505' || String(error?.message || '').toLowerCase().includes('duplicate');
    }

    async function fetchRemoteRecord(recordId) {
      const client = await ensureClient();
      if (client && session?.user?.id) {
        const { data } = await client
          .from(REMOTE_RECORDS_TABLE)
          .select('*')
            .eq('id', recordId)
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (data) return recordFromRemote(data);
      }
      return null;
    }

    async function registerConflict(operation, knownSharedRecord = null) {
      const sharedRecord = knownSharedRecord || await fetchRemoteRecord(operation.recordId);
      setConflicts([
        ...getConflicts().filter((conflict) => conflict.recordId !== operation.recordId),
        {
          id: createId(),
          recordId: operation.recordId,
          operation,
          localRecord: operation.payload,
          sharedRecord,
          createdAt: nowIso(),
        },
      ]);
      markLocalRecord(operation.payload, 'conflict', 'This record changed on another device.');
    }

    async function reconcile(options = {}) {
      const client = await ensureClient();
      if (!client || !session?.user?.id) return getSyncStatus();
      const { data, error } = await client
        .from(REMOTE_RECORDS_TABLE)
        .select('*')
        .eq('user_id', session.user.id)
        .order('recorded_at', { ascending: false });
      if (error) {
        setMetadata({ lastError: 'Shared records could not be refreshed.' });
        emit();
        return getSyncStatus();
      }
      mergeRemoteRecords((data || []).map(recordFromRemote));
      await processQueue(options);
      setMetadata({ lastSuccessfulSyncAt: nowIso(), lastError: '' });
      emit();
      return getSyncStatus();
    }

    async function fetchSharedSettings() {
      const client = await ensureClient();
      if (!client || !session?.user?.id) return null;
      const { data, error } = await client
        .from(REMOTE_SHARED_SETTINGS_TABLE)
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? sharedSettingsFromRemote(data) : null;
    }

    function mergeSharedSettings(settings) {
      if (!settings) return;
      const normalized = setSharedSettingsCache({ ...settings, syncStatus: 'synced', syncError: '' });
      onSharedSettingsChange?.(normalized);
    }

    async function reconcileSharedSettings() {
      const client = await ensureClient();
      if (!client || !session?.user?.id) return getSyncStatus();
      try {
        const remoteSettings = await fetchSharedSettings();
        if (remoteSettings) {
          const pendingSettings = getSharedSettingsQueue()[0]?.payload;
          const migration = getSharedSettingsMigration();
          const localSettings = normalizeSharedSettings(getLocalSharedSettings?.() || null);
          if (!migration.completed && sharedSettingsHaveValues(localSettings) && !sharedSettingsAreSame(localSettings, remoteSettings)) {
            await registerSharedSettingsConflict(createSharedSettingsOperation({
              ...localSettings,
              version: remoteSettings.version,
              lastEditedBy: getDeviceIdentity() || null,
            }, remoteSettings.version), remoteSettings);
            return getSyncStatus();
          }
          if (!migration.completed && sharedSettingsHaveValues(localSettings) && sharedSettingsAreSame(localSettings, remoteSettings)) {
            setSharedSettingsMigration({ completed: true, completedAt: nowIso() });
          }
          if (!pendingSettings || sharedSettingsAreSame(pendingSettings, remoteSettings)) {
            mergeSharedSettings(remoteSettings);
          }
        }
        await processSharedSettingsQueue();
      } catch (error) {
        setMetadata({ lastError: 'Patient and clinic information could not be refreshed.' });
      }
      emit();
      return getSyncStatus();
    }

    function createSharedSettingsOperation(settings, baseVersion = null) {
      return {
        id: createId(),
        recordId: 'shared-settings',
        entityType: 'shared-settings',
        type: baseVersion ? 'update-shared-settings' : 'insert-shared-settings',
        payload: normalizeSharedSettings(settings),
        baseVersion,
        createdAt: nowIso(),
        retryCount: 0,
        lastErrorCategory: '',
        state: 'pending',
      };
    }

    function saveSharedSettings(settings) {
      const normalized = normalizeSharedSettings({
        ...settings,
        lastEditedBy: getDeviceIdentity() || null,
        syncStatus: navigator.onLine ? 'waiting' : 'offline',
      });
      setSharedSettingsCache(normalized);
      const baseVersion = normalized.version || getSharedSettingsCache().version || null;
      const operation = createSharedSettingsOperation(normalized, baseVersion);
      setSharedSettingsQueue([...getSharedSettingsQueue(), operation]);
      emit();
      processSharedSettingsQueue().catch(() => {});
      return operation;
    }

    async function registerSharedSettingsConflict(operation, knownSharedSettings = null) {
      const sharedSettings = knownSharedSettings || await fetchSharedSettings();
      if (sharedSettings && sharedSettingsAreSame(sharedSettings, operation.payload)) {
        mergeSharedSettings(sharedSettings);
        setSharedSettingsQueue(getSharedSettingsQueue().filter((item) => item.id !== operation.id));
        return;
      }
      setConflicts([
        ...getConflicts().filter((conflict) => conflict.recordId !== 'shared-settings'),
        {
          id: createId(),
          recordId: 'shared-settings',
          entityType: 'shared-settings',
          operation,
          localRecord: operation.payload,
          sharedRecord: sharedSettings,
          createdAt: nowIso(),
        },
      ]);
      setSharedSettingsCache({ ...operation.payload, syncStatus: 'conflict', syncError: 'Patient and clinic information changed on another device.' });
    }

    async function processSharedSettingsQueue() {
      if (processingSharedSettings || !navigator.onLine) return getSyncStatus();
      const client = await ensureClient();
      if (!client || !session?.user?.id) return getSyncStatus();
      processingSharedSettings = true;
      emit();
      const remaining = [];
      for (const operation of getSharedSettingsQueue()) {
        try {
          const remotePayload = sharedSettingsToRemote(operation.payload, session.user.id);
          if (!operation.baseVersion) {
            const { data, error } = await client
              .from(REMOTE_SHARED_SETTINGS_TABLE)
              .insert(remotePayload)
              .select()
              .single();
            if (error) {
              if (isDuplicateKeyError(error)) {
                await registerSharedSettingsConflict(operation);
                continue;
              }
              throw error;
            }
            mergeSharedSettings(sharedSettingsFromRemote(data));
            continue;
          }
          const { data, error } = await client
            .rpc('update_lee_lee_shared_settings_with_version', {
              p_expected_version: Number(operation.baseVersion),
              p_patient_name: remotePayload.patient_name,
              p_patient_date_of_birth: remotePayload.patient_date_of_birth,
              p_clinic_name: remotePayload.clinic_name,
              p_clinic_phone: remotePayload.clinic_phone,
              p_last_edited_by: remotePayload.last_edited_by,
              p_payload: remotePayload.payload,
              p_app_schema_version: remotePayload.app_schema_version,
            });
          if (error) throw error;
          const updatedRow = Array.isArray(data) ? data[0] : data;
          if (!updatedRow) {
            await registerSharedSettingsConflict(operation);
            continue;
          }
          mergeSharedSettings(sharedSettingsFromRemote(updatedRow));
        } catch (error) {
          remaining.push({
            ...operation,
            retryCount: Number(operation.retryCount || 0) + 1,
            lastErrorCategory: categorizeError(error),
            state: 'pending',
          });
          setSharedSettingsCache({ ...operation.payload, syncStatus: navigator.onLine ? 'waiting' : 'offline', syncError: 'Patient and clinic information will retry syncing.' });
        }
      }
      setSharedSettingsQueue(remaining);
      processingSharedSettings = false;
      emit();
      return getSyncStatus();
    }

    function mergeRemoteRecords(remoteRecords) {
      if (!remoteRecords.length) return;
      const current = getDocument();
      const pendingIds = new Set(getQueue().map((operation) => operation.recordId));
      const safeRemote = remoteRecords.filter((record) => !pendingIds.has(record.id));
      const merged = mergeDocuments(current, { ...current, records: safeRemote });
      saveDocument(merged, { keepStatus: true });
      onRemoteChange?.(merged);
    }

    function normalizeLibraryItem(entityType, item) {
      const normalizer = entityType === 'saved-meal' ? normalizeSavedMeal : normalizeFood;
      return normalizer ? normalizer(item) : item;
    }

    function tableForLibraryEntity(entityType) {
      return entityType === 'saved-meal' ? REMOTE_SAVED_MEALS_TABLE : REMOTE_FOODS_TABLE;
    }

    function mergeRemoteLibraryItems(entityType, remoteItems) {
      if (!remoteItems.length) return;
      const current = getDocument();
      const key = entityType === 'saved-meal' ? 'savedMeals' : 'foodLibrary';
      const pendingIds = new Set(getFoodLibraryQueue().filter((operation) => operation.entityType === entityType).map((operation) => operation.recordId));
      const safeRemote = remoteItems.filter((item) => !pendingIds.has(item.id));
      const merged = mergeDocuments(current, { ...current, [key]: safeRemote });
      saveDocument(merged, { keepStatus: true });
      onRemoteChange?.(merged);
    }

    function createLibraryOperation(entityType, item, baseVersion = null) {
      const normalized = normalizeLibraryItem(entityType, item);
      return {
        id: createId(),
        recordId: normalized.id,
        entityType,
        type: 'upsert-library-item',
        payload: publicLibraryItem(normalized),
        baseVersion,
        createdAt: nowIso(),
        retryCount: 0,
        lastErrorCategory: '',
        state: 'pending',
      };
    }

    function queueLibraryUpsert(entityType, item, existingItem = null) {
      const operation = createLibraryOperation(entityType, item, existingItem?.version || null);
      setFoodLibraryQueue([...getFoodLibraryQueue().filter((queued) => queued.recordId !== operation.recordId || queued.entityType !== entityType), operation]);
      emit();
      processFoodLibraryQueue().catch(() => {});
      return operation;
    }

    function queueFoodUpsert(item, existingItem = null) {
      return queueLibraryUpsert('food', item, existingItem);
    }

    function queueSavedMealUpsert(item, existingItem = null) {
      return queueLibraryUpsert('saved-meal', item, existingItem);
    }

    async function reconcileFoodLibrary() {
      const client = await ensureClient();
      if (!client || !session?.user?.id) return getSyncStatus();
      try {
        const [{ data: foodRows, error: foodError }, { data: mealRows, error: mealError }] = await Promise.all([
          client.from(REMOTE_FOODS_TABLE).select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false }),
          client.from(REMOTE_SAVED_MEALS_TABLE).select('*').eq('user_id', session.user.id).order('updated_at', { ascending: false }),
        ]);
        if (foodError) throw foodError;
        if (mealError) throw mealError;
        mergeRemoteLibraryItems('food', (foodRows || []).map((row) => normalizeLibraryItem('food', libraryItemFromRemote(row, 'food'))).filter(Boolean));
        mergeRemoteLibraryItems('saved-meal', (mealRows || []).map((row) => normalizeLibraryItem('saved-meal', libraryItemFromRemote(row, 'saved-meal'))).filter(Boolean));
        await processFoodLibraryQueue();
      } catch (error) {
        setMetadata({ lastError: 'Food Library could not be refreshed.' });
      }
      emit();
      return getSyncStatus();
    }

    async function processFoodLibraryQueue() {
      if (processingFoodLibrary || !navigator.onLine) return getSyncStatus();
      const client = await ensureClient();
      if (!client || !session?.user?.id) return getSyncStatus();
      processingFoodLibrary = true;
      emit();
      const remaining = [];
      for (const operation of getFoodLibraryQueue()) {
        try {
          const normalized = normalizeLibraryItem(operation.entityType, operation.payload);
          const remote = sanitizeLibraryItemForRemote(normalized, session.user.id, operation.entityType);
          const { data, error } = await client
            .from(tableForLibraryEntity(operation.entityType))
            .upsert(remote, { onConflict: 'id' })
            .select()
            .single();
          if (error) throw error;
          const mergedItem = normalizeLibraryItem(operation.entityType, libraryItemFromRemote(data, operation.entityType));
          if (mergedItem) mergeRemoteLibraryItems(operation.entityType, [mergedItem]);
        } catch (error) {
          remaining.push({
            ...operation,
            retryCount: Number(operation.retryCount || 0) + 1,
            lastErrorCategory: categorizeError(error),
            state: 'pending',
          });
          setMetadata({ lastError: 'Food Library sync will retry when the connection is available.' });
        }
      }
      setFoodLibraryQueue(remaining);
      processingFoodLibrary = false;
      emit();
      return getSyncStatus();
    }

    function subscribeRealtime() {
      if (!supabaseClient || !session?.user?.id || realtimeChannel) return;
      setMetadata({ realtimeStatus: 'connecting' });
      realtimeChannel = supabaseClient
        .channel('lee-lee-records')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: REMOTE_RECORDS_TABLE,
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            const row = payload.new || payload.old;
            if (row?.id) mergeRemoteRecords([recordFromRemote(row)]);
          },
        )
        .subscribe((status) => {
          setMetadata({ realtimeStatus: status === 'SUBSCRIBED' ? 'connected' : 'connecting' });
          emit();
        });
    }

    function subscribeSharedSettingsRealtime() {
      if (!supabaseClient || !session?.user?.id || sharedSettingsChannel) return;
      sharedSettingsChannel = supabaseClient
        .channel('lee-lee-shared-settings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: REMOTE_SHARED_SETTINGS_TABLE,
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => {
            const row = payload.new || payload.old;
            if (row?.user_id) {
              const pending = getSharedSettingsQueue()[0]?.payload;
              const remoteSettings = sharedSettingsFromRemote(row);
              if (!pending || sharedSettingsAreSame(pending, remoteSettings)) mergeSharedSettings(remoteSettings);
            }
          },
        )
        .subscribe(() => {});
    }

    function unsubscribeRealtime() {
      if (realtimeChannel && supabaseClient) supabaseClient.removeChannel(realtimeChannel);
      realtimeChannel = null;
      setMetadata({ realtimeStatus: 'idle' });
    }

    function unsubscribeSharedSettingsRealtime() {
      if (sharedSettingsChannel && supabaseClient) supabaseClient.removeChannel(sharedSettingsChannel);
      sharedSettingsChannel = null;
    }

    async function keepSharedVersion(recordId) {
      const conflicts = getConflicts();
      const conflict = conflicts.find((item) => item.recordId === recordId);
      if (!conflict) return;
      if (conflict.entityType === 'shared-settings') {
        setSharedSettingsQueue(getSharedSettingsQueue().filter((operation) => operation.recordId !== recordId));
        if (conflict.sharedRecord) mergeSharedSettings(conflict.sharedRecord);
        setConflicts(conflicts.filter((item) => item.recordId !== recordId));
        emit();
        return;
      }
      setQueue(getQueue().filter((operation) => operation.recordId !== recordId));
      if (conflict.sharedRecord) mergeRemoteRecords([conflict.sharedRecord]);
      setConflicts(conflicts.filter((item) => item.recordId !== recordId));
      emit();
    }

    async function useLocalVersion(recordId) {
      const conflicts = getConflicts();
      const conflict = conflicts.find((item) => item.recordId === recordId);
      if (!conflict) return;
      if (conflict.entityType === 'shared-settings') {
        const sharedVersion = Number(conflict.sharedRecord?.version || conflict.operation.baseVersion || 1);
        setConflicts(conflicts.filter((item) => item.recordId !== recordId));
        setSharedSettingsQueue([
          ...getSharedSettingsQueue().filter((operation) => operation.recordId !== recordId),
          createSharedSettingsOperation({
            ...conflict.localRecord,
            version: sharedVersion,
            lastEditedBy: getDeviceIdentity() || null,
          }, sharedVersion),
        ]);
        await processSharedSettingsQueue();
        return;
      }
      const sharedVersion = Number(conflict.sharedRecord?.version || conflict.operation.baseVersion || 1);
      setConflicts(conflicts.filter((item) => item.recordId !== recordId));
      setQueue([
        ...getQueue().filter((operation) => operation.recordId !== recordId),
        {
          ...createOperation('update', {
            ...conflict.localRecord,
            version: sharedVersion,
            lastEditedBy: getDeviceIdentity() || 'Unknown',
          }, sharedVersion),
        },
      ]);
      await processQueue();
    }

    function cleanupIdenticalConflicts() {
      const conflicts = getConflicts();
      const remaining = [];
      const resolvedIds = new Set();
      let resolvedCount = 0;
      conflicts.forEach((conflict) => {
        const identical = conflict.entityType === 'shared-settings'
          ? sharedSettingsAreSame(conflict.localRecord, conflict.sharedRecord)
          : recordsHaveSameContent(conflict.localRecord, conflict.sharedRecord);
        if (identical && conflict.sharedRecord) {
          resolvedCount += 1;
          resolvedIds.add(conflict.recordId);
          if (conflict.entityType === 'shared-settings') {
            mergeSharedSettings(conflict.sharedRecord);
          } else {
            mergeRemoteRecords([conflict.sharedRecord]);
          }
          return;
        }
        remaining.push(conflict);
      });
      if (resolvedCount) {
        setConflicts(remaining);
        setQueue(getQueue().filter((operation) => !resolvedIds.has(operation.recordId)));
        setSharedSettingsQueue(getSharedSettingsQueue().filter((operation) => !resolvedIds.has(operation.recordId)));
        emit();
      }
      return resolvedCount;
    }

    async function keepSharedVersions(recordIds) {
      const summary = { resolved: 0, failed: 0 };
      for (const recordId of recordIds) {
        const before = getConflicts().length;
        await keepSharedVersion(recordId);
        if (getConflicts().length < before) summary.resolved += 1;
        else summary.failed += 1;
      }
      return summary;
    }

    async function useLocalVersions(recordIds) {
      const summary = { resolved: 0, failed: 0 };
      for (const recordId of recordIds) {
        const before = getConflicts().length;
        await useLocalVersion(recordId);
        if (getConflicts().length < before) summary.resolved += 1;
        else summary.failed += 1;
      }
      return summary;
    }

    async function syncAll(options = {}) {
      await reconcile(options);
      await reconcileSharedSettings();
      await reconcileFoodLibrary();
      return getSyncStatus();
    }

    function inspectLegacyMigration(keys = legacyRecordKeys) {
      const sourceRecords = [];
      const invalidRecords = [];
      keys.forEach((key) => {
        const payload = readJson(key, null);
        if (Array.isArray(payload)) {
          payload.forEach((record, index) => {
            const normalized = normalizeRecord(record);
            if (normalized) {
              sourceRecords.push({ key, index, record: normalized });
            } else {
              invalidRecords.push({ key, index });
            }
          });
        }
      });
      const timestamps = sourceRecords
        .map(({ record }) => Date.parse(record.recordTimestamp))
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
      return {
        complete: readJson(LEGACY_MIGRATION_KEY, {}).complete === true,
        totalRecords: sourceRecords.length + invalidRecords.length,
        validRecords: sourceRecords.length,
        invalidRecords: invalidRecords.length,
        earliestRecordAt: timestamps.length ? new Date(timestamps[0]).toISOString() : null,
        latestRecordAt: timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
      };
    }

    function createLegacySafetySnapshot(keys = legacyRecordKeys) {
      const snapshot = {
        backupFormat: 'lee-lee-tracker-legacy-snapshot',
        version: 1,
        createdAt: nowIso(),
        sources: Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
      };
      writeJson(`${LEGACY_SNAPSHOT_PREFIX}${Date.now()}`, snapshot);
      return snapshot;
    }

    function previewJsonImport(payload, currentRecords) {
      if (!payload || typeof payload !== 'object') return { error: 'Choose a valid Lee-Lee’s Tracker backup file.' };
      if (!['lando-world:lee-lees-tracker', 'lee-lee-tracker-full-backup'].includes(payload.appIdentifier || payload.backupFormat)) {
        return { error: 'Choose a valid Lee-Lee’s Tracker backup file.' };
      }
      const importedRecords = Array.isArray(payload.records) ? payload.records.map(normalizeRecord).filter(Boolean) : [];
      const currentById = new Map(currentRecords.map((record) => [record.id, record]));
      const summary = {
        backupCreatedAt: payload.exportedAt || payload.createdAt || '',
        totalRecords: importedRecords.length,
        newRecords: [],
        identicalRecords: [],
        conflictingRecords: [],
        invalidRecords: Array.isArray(payload.records) ? payload.records.length - importedRecords.length : 0,
        softDeletedRecords: importedRecords.filter((record) => record.deletedAt).length,
      };
      importedRecords.forEach((record) => {
        const existing = currentById.get(record.id);
        if (!existing) {
          summary.newRecords.push(record);
        } else if (fingerprintRecord(existing) === fingerprintRecord(record)) {
          summary.identicalRecords.push(record);
        } else {
          summary.conflictingRecords.push({ current: existing, imported: record });
        }
      });
      return { summary };
    }

    function exportCsv(sourceRecords) {
      const headers = [
        'Date',
        'Time',
        'Event Type',
        'Record Type',
        'Glucose',
        'Insulin Units',
        'Carbs',
        'Meal Description',
        'Activity Description',
        'Activity Duration Minutes',
        'Activity Intensity',
        'Notes',
        'Entered By',
        'Last Edited By',
        'Created At',
        'Updated At',
      ];
      const rows = sourceRecords
        .filter((record) => !record.deletedAt)
        .map((record) => {
          const timestamp = new Date(record.recordTimestamp);
          return [
            timestamp.toLocaleDateString(),
            timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
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
            record.enteredBy || '',
            record.lastEditedBy || '',
            record.createdAt || '',
            record.updatedAt || '',
          ];
        });
      return [headers, ...rows]
        .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
        .join('\n');
    }

    globalThis.addEventListener?.('online', () => {
      processQueue().catch(() => {});
      processSharedSettingsQueue().catch(() => {});
      processFoodLibraryQueue().catch(() => {});
    });
    globalThis.addEventListener?.('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        reconcile().catch(() => {});
        reconcileSharedSettings().catch(() => {});
        reconcileFoodLibrary().catch(() => {});
      }
    });
    globalThis.setInterval?.(() => {
      if (session) {
        reconcile().catch(() => {});
        reconcileSharedSettings().catch(() => {});
        reconcileFoodLibrary().catch(() => {});
      }
    }, 5 * 60 * 1000);

    return {
      initialize,
      signIn,
      signOut,
      sendPasswordReset,
      subscribe,
      getSyncStatus,
      getRecordQueueSnapshot,
      getSyncDiagnostics,
      getDeviceIdentity,
      setDeviceIdentity,
      queueUpsert,
      queueSoftDelete,
      queueRestore,
      processQueue,
      processSharedSettingsQueue,
      processFoodLibraryQueue,
      syncNow: syncAll,
      syncSharedSettings: reconcileSharedSettings,
      syncFoodLibrary: reconcileFoodLibrary,
      getConflicts,
      keepSharedVersion,
      useLocalVersion,
      keepSharedVersions,
      useLocalVersions,
      cleanupIdenticalConflicts,
      getSharedSettings: getSharedSettingsCache,
      saveSharedSettings,
      queueFoodUpsert,
      queueSavedMealUpsert,
      normalizeSharedSettings,
      getSharedSettingsStatus,
      getSharedSettingsMigration,
      setSharedSettingsMigration,
      sharedSettingsHaveValues,
      inspectLegacyMigration,
      createLegacySafetySnapshot,
      previewJsonImport,
      exportCsv,
      keys: {
        deviceIdentity: DEVICE_IDENTITY_KEY,
        queue: SYNC_QUEUE_KEY,
        conflicts: SYNC_CONFLICTS_KEY,
        sharedSettingsCache: SHARED_SETTINGS_CACHE_KEY,
        sharedSettingsQueue: SHARED_SETTINGS_QUEUE_KEY,
        foodLibraryQueue: FOOD_LIBRARY_QUEUE_KEY,
        sharedSettingsMigration: SHARED_SETTINGS_MIGRATION_KEY,
        migration: LEGACY_MIGRATION_KEY,
      },
    };
  }

  globalThis.LeeLeeTrackerSync = {
    createRepository,
    getConfig,
    getDeviceIdentity,
    setDeviceIdentity,
    DEVICE_USERS,
    REMOTE_RECORDS_TABLE,
    REMOTE_SHARED_SETTINGS_TABLE,
    REMOTE_FOODS_TABLE,
    REMOTE_SAVED_MEALS_TABLE,
    sanitizeRecordForRemote,
    recordFromRemote,
    sanitizeLibraryItemForRemote,
    libraryItemFromRemote,
    normalizeSharedSettings,
    normalizeSharedInsulinPlan,
    sharedSettingsToRemote,
    sharedSettingsFromRemote,
    sharedSettingsAreSame,
    recordMeaningFingerprint,
  };
})();
