(function () {
  'use strict';

  function createEngine({ isValidQuantity, normalizeNumber, isStarted }) {
    function rowTotal(row = {}) {
      const qty = isValidQuantity(row.qty) ? Number(String(row.qty).trim()) : null;
      const carbs = normalizeNumber(row.carbs);
      if (qty == null || carbs == null || String(row.qty ?? '').trim() === '' || String(row.carbs ?? '').trim() === '') return null;
      const total = qty * carbs;
      return Number.isFinite(total) ? total : null;
    }
    return Object.freeze({
      rowTotal,
      mealTotal: (rows = []) => (rows || []).reduce((sum, row) => sum + (rowTotal(row) ?? 0), 0),
      canComplete: (rows = []) => {
        const started = (rows || []).filter(isStarted);
        return started.length > 0 && started.every((row) => rowTotal(row) != null)
          && Number.isFinite(started.reduce((sum, row) => sum + rowTotal(row), 0));
      },
    });
  }

  function createSession(context, state = {}, id) {
    if (!['standalone', 'entry'].includes(context)) throw new Error('Invalid calculator context');
    return { id, context, state: JSON.parse(JSON.stringify(state)) };
  }

  // Compatibility accessors keep the existing handlers on one shared interface
  // while calculator data belongs to the explicit session, never a saved entry.
  function bindSession(editor, session) {
    editor.calculatorSession = session;
    Object.keys(editor).filter((key) => key.startsWith('carbCalculator')).forEach((key) => {
      session.state[key] = editor[key];
      Object.defineProperty(editor, key, {
        enumerable: true,
        configurable: true,
        get: () => session.state[key],
        set: (value) => { session.state[key] = value; },
      });
    });
  }

  function entryPatch(engine, session, rows, { formatAmount, buildComponents }) {
    if (session?.context !== 'entry' || !engine.canComplete(rows)) return null;
    return {
      mealCarbs: formatAmount(engine.mealTotal(rows)),
      mealComponents: buildComponents(rows),
    };
  }

  window.LeeLeeCarbCalculator = Object.freeze({ createEngine, createSession, bindSession, entryPatch });
})();
