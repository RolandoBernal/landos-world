# Violet Sprints

Violet Sprints is a local-first interval timer inside Lando's World. Workouts run through the shared Sprints timer engine, which supports timed sections, pause/resume, reset/restart, skip/back controls, completion messaging, screen wake lock where supported, and final-five-second warning pulses.

## Built-In Workouts

Built-in workouts are defined in application source and are merged into the local workout list by stable ID. They do not depend on a one-time localStorage seed, import, sync, or user-created workout data.

### Futbol Game Timer

`futbol-game-timer` is a source-defined built-in preset for regulation high-school soccer game timing:

- First Half - 40 min
- Half Time - 15 min
- Second Half - 40 min
- Total - 95 min

It appears on fresh devices and existing installations without deleting or overwriting custom workouts. If a user-created workout has the same display name, it is preserved separately because matching uses the stable built-in ID rather than the name.

The timer uses the existing Violet Sprints countdown engine. The current engine pauses via in-memory timer state and resumes from the remaining seconds. It reacquires wake lock and audio readiness when the page becomes visible, but it does not reconcile elapsed wall-clock time while the browser or PWA is backgrounded.
