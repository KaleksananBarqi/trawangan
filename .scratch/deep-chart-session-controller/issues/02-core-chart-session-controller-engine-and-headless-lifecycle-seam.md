# 02: Core ChartSessionController Engine & Headless Lifecycle Seam

**What to build:** A headless, deep charting session controller that manages the WebGL2 workspace attachment, Pine engine registration, symbol and timeframe transitions, and clean memory teardown behind a single architectural seam.

**Blocked by:** 01: Prefactoring & Dead Facade Elimination (#50)

**Status:** closed

- [x] Implement `ChartSessionController` with public interface: `attach(container, options)`, `setSymbol(symbol, timeframe, providerId)`, `setTimezone(timezone)`, `destroy()`, and `subscribe(listener)`.
- [x] Encapsulate Vela `VelaWorkspace` instantiation, canvas resize observation, and Pine worker engine registration inside the controller.
- [x] Implement a headless test suite (`tests/chartSessionController.test.ts`) validating initialization, symbol updating, subscriber reactivity, and leak-free destruction without browser DOM requirements.
- [x] All tests pass.
