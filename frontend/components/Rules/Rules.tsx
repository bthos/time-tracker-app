import React, { useState } from 'react';
import { useRules } from '../../hooks/useRules';
import { useCategories } from '../../hooks/useCategories';
import Card from '../Common/Card';
import Button from '../Common/Button';
import { Rule, Category } from '../../types';

export const Rules: React.FC = () => {
  const { rules, isLoading, createRule, deleteRule } = useRules();
  const { data: categories = [] } = useCategories();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newRule, setNewRule] = useState<Partial<Rule>>({
    rule_type: 'app_name',
    pattern: '',
    category_id: categories[0]?.id || 1,
    priority: 0,
  });

  const handleCreate = async () => {
    if (newRule.pattern && newRule.category_id) {
      await createRule(newRule as Omit<Rule, 'id'>);
      setNewRule({
        rule_type: 'app_name',
        pattern: '',
        category_id: categories[0]?.id || 1,
        priority: 0,
      });
      setShowNewForm(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('Delete rule?')) {
      await deleteRule(id);
    }
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'app_name': return '📱 Application';
      case 'window_title': return '🪟 Window Title';
      case 'domain': return '🌐 Domain';
      default: return type;
    }
  };

  const getCategoryById = (id: number) => {
    return categories.find((c: Category) => c.id === id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            📋 Auto-categorization Rules
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Automatically assign categories based on patterns
          </p>
        </div>
        <Button onClick={() => setShowNewForm(true)}>
          + Add Rule
        </Button>
      </div>

      {/* New Rule Form */}
      {showNewForm && (
        <Card className="border-2 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            New Rule
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rule Type
              </label>
              <select
                value={newRule.rule_type}
                onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value as Rule['rule_type'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="app_name">By Application Name</option>
                <option value="window_title">By Window Title</option>
                <option value="domain">By Domain</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={newRule.category_id}
                onChange={(e) => setNewRule({ ...newRule, category_id: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {categories.map((cat: Category) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pattern (supports * for any characters)
              </label>
              <input
                type="text"
                value={newRule.pattern}
                onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                placeholder={
                  newRule.rule_type === 'app_name' ? 'Example: *Code*, Slack, Chrome' :
                  newRule.rule_type === 'window_title' ? 'Example: *jira*, *github*' :
                  'Example: youtube.com, *.google.com'
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority (higher = more important)
              </label>
              <input
                type="number"
                value={newRule.priority}
                onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreate}>Create</Button>
            <Button variant="secondary" onClick={() => setShowNewForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Rules List */}
      <Card>
        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-4xl mb-2">📋</p>
            <p>No rules yet</p>
            <p className="text-sm">Create your first rule for automatic categorization</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400">
              <div className="col-span-2">Type</div>
              <div className="col-span-4">Pattern</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-1">Priority</div>
              <div className="col-span-2">Actions</div>
            </div>

            {/* Rules */}
            {rules.map((rule: Rule) => {
              const category = getCategoryById(rule.category_id);
              return (
                <div
                  key={rule.id}
                  className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg items-center transition-colors"
                >
                  <div className="col-span-2 text-sm">
                    {getRuleTypeLabel(rule.rule_type)}
                  </div>
                  <div className="col-span-4">
                    <code className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded text-sm">
                      {rule.pattern}
                    </code>
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    {category && (
                      <>
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color || '#888' }}
                        />
                        <span>{category.icon} {category.name}</span>
                      </>
                    )}
                  </div>
                  <div className="col-span-1 text-gray-500 dark:text-gray-400">
                    {rule.priority}
                  </div>
                  <div className="col-span-2">
                    <Button size="sm" variant="danger" onClick={() => handleDelete(rule.id)}>
                      🗑️ Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Predefined Rules Info */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          💡 Rule Examples
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="font-medium mb-1">IDEs & Editors → Work</p>
            <code className="text-xs text-gray-600 dark:text-gray-400">
              app_name: *Code*, *IntelliJ*, *WebStorm*
            </code>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="font-medium mb-1">Messengers → Communication</p>
            <code className="text-xs text-gray-600 dark:text-gray-400">
              app_name: Slack, Telegram, Discord
            </code>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="font-medium mb-1">Video Calls → Meetings</p>
            <code className="text-xs text-gray-600 dark:text-gray-400">
              app_name: Zoom, *Meet*, Teams
            </code>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="font-medium mb-1">YouTube → Entertainment</p>
            <code className="text-xs text-gray-600 dark:text-gray-400">
              domain: youtube.com, twitch.tv
            </code>
          </div>
        </div>
      </Card>
    </div>
  );
};
