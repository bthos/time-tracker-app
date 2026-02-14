import React, { useState, useEffect } from 'react';
import { Rule, Category } from '../../types';
import Button from '../Common/Button';
import { Check, X, Trash2, Edit2, RotateCcw } from 'lucide-react';
import { useRules } from '../../hooks/useRules';
import { useStore } from '../../store';
import { activitiesApi } from '../../services/api/activities';
import { useQueryClient } from '@tanstack/react-query';

export const RulesSettings: React.FC = () => {
  const { rules, isLoading: rulesLoading, createRule, updateRule, deleteRule } = useRules();
  const categories = useStore((state) => state.categories);
  const { pendingRuleData, setPendingRuleData, setSettingsActiveTab } = useStore();
  const queryClient = useQueryClient();
  
  const [showNewRuleForm, setShowNewRuleForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [isReapplyingRules, setIsReapplyingRules] = useState(false);
  const [newRule, setNewRule] = useState<Partial<Rule>>({
    rule_type: 'app_name',
    pattern: '',
    category_id: categories[0]?.id || undefined,
    priority: 0,
  });

  // Handle pendingRuleData - prefill form for creating new rule
  useEffect(() => {
    if (pendingRuleData) {
      setNewRule({
        rule_type: pendingRuleData.rule_type,
        pattern: pendingRuleData.pattern,
        category_id: pendingRuleData.category_id || categories[0]?.id || undefined,
        priority: 0,
      });
      setShowNewRuleForm(true);
      setEditingRuleId(null);
      setPendingRuleData(null);
      setSettingsActiveTab(null);
    }
  }, [pendingRuleData, categories, setPendingRuleData, setSettingsActiveTab]);

  const handleCreateRule = async () => {
    if (isCreatingRule) return;
    
    try {
      setIsCreatingRule(true);
      
      if (!newRule.pattern || !newRule.pattern.trim()) {
        const { showError } = await import('../../utils/toast');
        showError('Please enter a pattern');
        return;
      }
      
      if (!newRule.category_id) {
        const { showError } = await import('../../utils/toast');
        showError('Please select a category');
        return;
      }

      const priority = newRule.priority !== undefined && !isNaN(newRule.priority) 
        ? newRule.priority 
        : 0;

      const ruleToCreate: Omit<Rule, 'id'> = {
        rule_type: newRule.rule_type || 'app_name',
        pattern: newRule.pattern.trim(),
        category_id: newRule.category_id,
        priority: priority,
      };

      await createRule(ruleToCreate);
      
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Rule created successfully');
      
      setNewRule({
        rule_type: 'app_name',
        pattern: '',
        category_id: categories[0]?.id || undefined,
        priority: 0,
      });
      setShowNewRuleForm(false);
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to create rule');
    } finally {
      setIsCreatingRule(false);
    }
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setNewRule({
      rule_type: rule.rule_type,
      pattern: rule.pattern,
      category_id: rule.category_id,
      priority: rule.priority,
    });
    setShowNewRuleForm(true);
  };

  const handleUpdateRule = async () => {
    if (isCreatingRule || !editingRuleId) return;
    
    try {
      setIsCreatingRule(true);
      
      if (!newRule.pattern || !newRule.pattern.trim()) {
        const { showError } = await import('../../utils/toast');
        showError('Please enter a pattern');
        return;
      }
      
      if (!newRule.category_id) {
        const { showError } = await import('../../utils/toast');
        showError('Please select a category');
        return;
      }

      const priority = newRule.priority !== undefined && !isNaN(newRule.priority) 
        ? newRule.priority 
        : 0;

      const ruleToUpdate: Rule = {
        id: editingRuleId,
        rule_type: newRule.rule_type || 'app_name',
        pattern: newRule.pattern.trim(),
        category_id: newRule.category_id,
        priority: priority,
      };

      await updateRule(ruleToUpdate);
      
      const { showSuccess } = await import('../../utils/toast');
      showSuccess('Rule updated successfully');
      
      setNewRule({
        rule_type: 'app_name',
        pattern: '',
        category_id: categories[0]?.id || undefined,
        priority: 0,
      });
      setShowNewRuleForm(false);
      setEditingRuleId(null);
    } catch (error) {
      const { handleApiError } = await import('../../utils/toast');
      handleApiError(error, 'Failed to update rule');
    } finally {
      setIsCreatingRule(false);
    }
  };

  const handleCancelEdit = () => {
    setShowNewRuleForm(false);
    setEditingRuleId(null);
    setNewRule({
      rule_type: 'app_name',
      pattern: '',
      category_id: categories[0]?.id || undefined,
      priority: 0,
    });
  };

  const handleDeleteRule = async (id: number) => {
    await deleteRule(id);
    setEditingRuleId(null);
    setShowNewRuleForm(false);
    setNewRule({
      rule_type: 'app_name',
      pattern: '',
      category_id: categories[0]?.id || undefined,
      priority: 0,
    });
  };

  const handleReapplyRules = async () => {
    if (confirm('Reapply rules to all existing records? This will update categories for all activities.')) {
      try {
        setIsReapplyingRules(true);
        await activitiesApi.reapplyCategorizationRules();
        const { showSuccess } = await import('../../utils/toast');
        showSuccess('Rules successfully applied to all records');
        queryClient.invalidateQueries({ queryKey: ['activities'] });
        queryClient.invalidateQueries({ queryKey: ['dailyStats'] });
        queryClient.invalidateQueries({ queryKey: ['timeline'] });
        queryClient.invalidateQueries({ queryKey: ['todayTotal'] });
      } catch (error) {
        const { handleApiError } = await import('../../utils/toast');
        handleApiError(error, 'Failed to reapply rules');
      } finally {
        setIsReapplyingRules(false);
      }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rules</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure automatic categorization rules for your activities
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleReapplyRules}
            disabled={isReapplyingRules}
          >
            {isReapplyingRules ? (
              'Applying...'
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-1" />
                Apply to Existing
              </>
            )}
          </Button>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => {
              setShowNewRuleForm(true);
              setEditingRuleId(null);
            }}
          >
            + New Rule
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 shadow-sm">
        {showNewRuleForm && !editingRuleId && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
              New Rule
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                  value={newRule.category_id || categories[0]?.id || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10);
                    if (!isNaN(value)) {
                      setNewRule({ ...newRule, category_id: value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {categories.length === 0 ? (
                    <option value="">Loading categories...</option>
                  ) : (
                    categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="sm:col-span-2">
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
                  value={newRule.priority ?? 0}
                  onChange={(e) => {
                    const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                    setNewRule({ ...newRule, priority: isNaN(value) ? 0 : value });
                  }}
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button 
                variant="success"
                onClick={handleCreateRule} 
                size="sm"
                disabled={isCreatingRule}
              >
                {isCreatingRule ? (
                  'Creating...'
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Create
                  </>
                )}
              </Button>
              <Button 
                variant="secondary" 
                onClick={handleCancelEdit} 
                size="sm"
                disabled={isCreatingRule}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        )}
        
        {rulesLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-gray-600 dark:text-gray-400">
              No rules. Add rules for automatic categorization.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule: Rule) => {
              const category = categories.find((c: Category) => c.id === rule.category_id);
              return (
                <div key={rule.id}>
                  {editingRuleId === rule.id ? (
                    <div className="p-3 sm:p-4 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                      <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                        Edit Rule
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                            value={newRule.category_id || ''}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              if (!isNaN(value)) {
                                setNewRule({ ...newRule, category_id: value });
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-2">
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
                            value={newRule.priority ?? 0}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              setNewRule({ ...newRule, priority: isNaN(value) ? 0 : value });
                            }}
                            className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-4">
                        <div className="flex gap-2">
                          <Button 
                            variant="success"
                            onClick={handleUpdateRule} 
                            size="sm"
                            disabled={isCreatingRule}
                          >
                            {isCreatingRule ? (
                              'Saving...'
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Save
                              </>
                            )}
                          </Button>
                          <Button 
                            variant="secondary" 
                            onClick={handleCancelEdit} 
                            size="sm"
                            disabled={isCreatingRule}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                        <Button 
                          variant="danger" 
                          size="sm"
                          onClick={() => {
                            if (confirm('Delete rule?')) {
                              handleDeleteRule(editingRuleId!);
                            }
                          }}
                          disabled={isCreatingRule}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex-1 w-full sm:w-auto">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {getRuleTypeLabel(rule.rule_type)}
                          </span>
                          <code className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 break-all">
                            {rule.pattern}
                          </code>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                          → {category?.icon} {category?.name || 'Unknown category'}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between w-full sm:w-auto sm:justify-start gap-2 sm:gap-4">
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          Priority: {rule.priority}
                        </span>
                        
                        <div className="flex gap-2">
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => handleEditRule(rule)}
                            title="Edit rule"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
