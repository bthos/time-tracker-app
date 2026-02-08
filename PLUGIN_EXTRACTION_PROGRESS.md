# Plugin Extraction Progress

## Completed Phases

### ✅ Phase 1: Plugin SDK Crate
- Created `plugin-sdk/` workspace member crate
- Extracted `Plugin` trait, `PluginInfo`, extension types from backend
- Added `PluginAPIInterface` trait for abstraction
- Added `CreateTable` variant to `SchemaChange` enum
- Added FFI types for dynamic loading
- Updated all 4 plugins to use SDK `Plugin` trait
- Updated backend to use SDK via path dependency

### ✅ Phase 2: Dynamic Plugin Loading
- Added `libloading` dependency
- Implemented `load_dynamic_plugin()` in `loader.rs`
- Implemented `load_all_installed_plugins()` to scan and load plugins
- Updated `main.rs` to load dynamic plugins alongside built-in plugins
- Library handles are properly managed to prevent symbol invalidation

### ✅ Phase 3: Database Schema Extensions
- Extended `apply_plugin_extensions()` to handle `CreateTable` operations
- Removed plugin table creation from `initialize_schema()`
- Removed plugin table creation from migrations (v3, v4, v5)
- Plugins can now declare their own tables via schema extensions

### 🔄 Phase 4: Plugin Directory Structure
- Created `plugins/` directory structure
- Created `plugins/projects-tasks/` with Cargo.toml, plugin.toml, src/lib.rs
- Updated workspace Cargo.toml to include plugin directories
- **Known Issue**: Plugins currently depend on `Database` directly, which prevents true dynamic loading

## Remaining Work

### Phase 5: Frontend Dynamic Plugin Loading
- Create `PluginHost` component
- Implement plugin UI bundle loading
- Add plugin registration API (`registerRoute`, `registerSidebarItem`, `registerDashboardWidget`, `registerSettingsTab`)
- Update App.tsx, Sidebar.tsx, Dashboard, Settings to use dynamic plugin components

### Phase 6: Registry and Distribution
- Add plugin.json entries to registry repo for all 4 plugins
- Set up GitHub Actions workflows for each plugin repo
- Configure CI to build .dll/.so/.dylib + frontend bundles
- Test end-to-end: Marketplace discovery -> install -> dynamic load -> UI rendering

### Phase 7: Core Cleanup
- Remove `backend/src/plugins/` directory
- Remove plugin-specific commands from `commands.rs` (move to plugins)
- Remove plugin-specific frontend components from core
- **Critical**: Extend PluginAPI to provide database access methods (or create shared database types crate)
- Remove Database dependency from plugins

## Critical Issue: Database Dependency

**Problem**: Plugins currently use `Database` directly, but dynamic libraries can't link against the backend crate.

**Solutions**:
1. **Extend PluginAPI**: Add database access methods to `PluginAPIInterface` (e.g., `execute_query`, `create_project`, etc.)
2. **Shared Database Types**: Create a `time-tracker-database-types` crate with shared types/interfaces
3. **Command Pattern**: Move all database operations to core commands, plugins only handle business logic

**Recommendation**: Option 1 - Extend PluginAPI with database access methods. This maintains plugin autonomy while providing controlled access.

## Next Steps

1. **Immediate**: Resolve Database dependency issue (extend PluginAPI)
2. Complete plugin code migration to `plugins/` directories
3. Implement frontend dynamic loading
4. Set up CI/CD for plugin builds
5. Test full plugin lifecycle

## File Structure

```
time-tracker-app/
├── Cargo.toml                    # Workspace root
├── plugin-sdk/                   # ✅ SDK crate
│   ├── Cargo.toml
│   └── src/
├── backend/                      # Core app
│   ├── Cargo.toml
│   └── src/
│       ├── plugin_system/       # ✅ Plugin infrastructure
│       └── plugins/             # ⏳ To be removed in Phase 7
├── plugins/                      # 🔄 Plugin directories
│   ├── projects-tasks/          # 🔄 In progress
│   ├── billing/                 # ⏳ Pending
│   ├── pomodoro/                # ⏳ Pending
│   └── goals/                   # ⏳ Pending
└── frontend/                     # Core frontend
    └── components/
        ├── Projects/            # ⏳ To move to plugin
        ├── Tasks/               # ⏳ To move to plugin
        ├── Pomodoro/            # ⏳ To move to plugin
        └── Goals/               # ⏳ To move to plugin
```
