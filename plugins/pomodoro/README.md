# Time Tracker Pomodoro Plugin

Pomodoro timer plugin for Time Tracker application.

## Features

- Start/stop Pomodoro sessions (work, short break, long break)
- Track focus sessions
- View focus session history
- Integration with projects and tasks

## Installation

This plugin is installed via the Time Tracker Marketplace or can be installed manually by downloading the release assets.

## Development

### Prerequisites

- Rust toolchain (latest stable)
- Time Tracker Plugin SDK

### Building

```bash
cargo build --release
```

This will create a dynamic library (`.dll` on Windows, `.so` on Linux, `.dylib` on macOS) in `target/release/`.

### Plugin Manifest

The plugin manifest (`plugin.toml`) defines:
- Plugin metadata (id, name, version)
- Backend configuration (crate name, library name, entry point)
- Frontend configuration (entry point, components)
- Build targets

## License

MIT

## Repository

https://github.com/bthos/time-tracker-pomodoro-plugin
