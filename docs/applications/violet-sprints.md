# Violet Sprints

Violet Sprints is a local-first interval timer inside Lando's World. Workouts run through the shared Sprints timer engine, which supports timed sections, pause/resume, reset/restart, skip/back controls, completion messaging, screen wake lock where supported, and final-five-second warning pulses.

## Built-In Workouts

Built-in workouts are defined in application source and are merged into the local workout list by stable ID. They do not depend on a one-time localStorage seed, import, sync, or user-created workout data.

Built-in workouts can be viewed, started, and duplicated, but they cannot be deleted. Duplicating a built-in creates a normal user-owned workout copy that can be edited and deleted like any other custom workout.

The current built-ins are:

- Treadmill Sprints
- Soccer Match Simulation
- Tabata
- Futbol Game Timer

### Futbol Game Timer

`futbol-game-timer` is a source-defined built-in preset for regulation high-school soccer game timing:

- First Half - 40 min
- Half Time - 10 min
- Second Half - 40 min
- Total - 90 min

It appears on fresh devices and existing installations without deleting or overwriting custom workouts. If a user-created workout has the same display name, it is preserved separately because matching uses the stable built-in ID rather than the name.

The timer uses Violet Sprints' shared timestamp-based countdown engine. Running workouts persist their active timer state locally and reconcile from wall-clock time when the page initializes, regains focus, becomes visible, or returns to the Violet Sprints route, so browser/PWA/native suspension does not implicitly pause elapsed workout time. Explicit Pause freezes the remaining time until Resume creates a fresh end timestamp.
