//! Built-in plugins module

pub mod projects_tasks;
pub mod billing;
pub mod pomodoro;
pub mod goals;

pub use projects_tasks::ProjectsTasksPlugin;
pub use billing::BillingPlugin;
pub use pomodoro::PomodoroPlugin;
pub use goals::GoalsPlugin;
