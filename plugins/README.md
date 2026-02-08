# Plugins Directory

This directory contains built-in plugins that will eventually be moved to separate repositories.

## Current Status

Plugins are currently being restructured from `backend/src/plugins/` into self-contained directories here. Each plugin has:

- `Cargo.toml` - Plugin crate configuration (cdylib for dynamic loading)
- `plugin.toml` - Plugin manifest
- `src/lib.rs` - Plugin implementation with FFI exports
- `frontend/` - Frontend components and hooks (to be moved)

## Known Issues

**Database Dependency**: Plugins currently depend on `Database` directly from the backend crate. For true dynamic loading, this needs to be refactored:

1. Option A: Extend `PluginAPI` to provide database access methods
2. Option B: Create a shared database types crate that both core and plugins can use
3. Option C: Plugins use PluginAPI methods only (requires extending PluginAPI significantly)

For now, plugins work as workspace members but need refactoring before they can be true dynamic libraries.

## Migration Path

1. ✅ Phase 1-3: SDK created, dynamic loading infrastructure ready
2. 🔄 Phase 4: Moving plugins to separate directories (in progress)
3. ⏳ Phase 5: Frontend dynamic loading
4. ⏳ Phase 6: Registry setup
5. ⏳ Phase 7: Core cleanup + PluginAPI database access refactor
