import React, { useState } from 'react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from '../../hooks/useCategories';
// Projects and Tasks are now provided by plugins
import Card from '../Common/Card';
import Button from '../Common/Button';
import { Category } from '../../types';
import { Plus, Check, X, Edit2, Trash2, Tag } from 'lucide-react';

export const Categories: React.FC = () => {
  const { data: categories = [], isLoading } = useCategories();
  // Projects and Tasks are now provided by plugins
  const projects: any[] = [];
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingCategoryProjectId, setEditingCategoryProjectId] = useState<number | null>(null);
  const tasks: any[] = [];
  // For editing, use editingProjectId if set, otherwise use the category's project_id
  const effectiveEditingProjectId = editingProjectId !== null ? editingProjectId : editingCategoryProjectId;
  const editingTasks: any[] = [];
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  
  const createCategory = async (category: Omit<Category, 'id'>) => {
    await createCategoryMutation.mutateAsync(category);
  };
  
  const updateCategory = async (category: Category) => {
    await updateCategoryMutation.mutateAsync(category);
  };
  
  const deleteCategory = async (id: number) => {
    await deleteCategoryMutation.mutateAsync(id);
  };
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState<Partial<Category> | null>(null);

  const handleSave = async (category: Partial<Category>) => {
    if (category.id) {
      await updateCategory({
        ...category,
        is_productive: category.is_productive !== undefined ? category.is_productive : null,
        is_billable: category.is_billable !== undefined ? category.is_billable : null,
      } as Category);
    } else if (newCategory) {
      await createCategory({
        name: newCategory.name || 'New Category',
        color: newCategory.color || '#888888',
        icon: newCategory.icon || '📁',
        is_productive: newCategory.is_productive !== undefined ? newCategory.is_productive : true,
        is_billable: newCategory.is_billable !== undefined ? newCategory.is_billable : false,
        hourly_rate: newCategory.hourly_rate ?? null,
        sort_order: categories.length,
        project_id: newCategory.project_id ?? null,
        task_id: newCategory.task_id ?? null,
      });
    }
    setEditingId(null);
    setNewCategory(null);
  };

  const handleDelete = async (id: number) => {
    const category = categories.find(c => c.id === id);
    if (category?.is_system) {
      alert('Cannot delete system category. System categories are required for app functionality.');
      return;
    }
    if (confirm('Delete category? Records will be marked as "Uncategorized"')) {
      try {
        await deleteCategory(id);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete category';
        if (errorMessage.includes('system')) {
          alert('Cannot delete system category.');
        } else {
          alert(errorMessage);
        }
      }
    }
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
        <div className="flex items-center gap-2">
          <Tag className="w-6 h-6 text-gray-900 dark:text-white" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Categories
          </h2>
        </div>
        <Button onClick={() => setNewCategory({ name: '', color: '#888888', icon: '📁', is_productive: true, is_billable: false, hourly_rate: null, is_system: false, is_pinned: false, project_id: null, task_id: null })}>
          <Plus className="w-4 h-4 mr-1" />
          Add Category
        </Button>
      </div>

      <Card>
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400">
            <div className="col-span-1">Icon</div>
            <div className="col-span-2">Name</div>
            <div className="col-span-1">Color</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Project</div>
            <div className="col-span-1">Task</div>
            <div className="col-span-1">Billable</div>
            <div className="col-span-1">Rate/hr</div>
            <div className="col-span-1">Order</div>
            <div className="col-span-1">Pinned</div>
            <div className="col-span-1">Actions</div>
          </div>

          {/* New Category Form */}
          {newCategory && (
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg items-center">
              <div className="col-span-1">
                <input
                  type="text"
                  value={newCategory.icon || ''}
                  onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                  className="w-12 px-2 py-1 border rounded text-center"
                  maxLength={2}
                />
              </div>
              <div className="col-span-2">
                <input
                  type="text"
                  value={newCategory.name || ''}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Name"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="color"
                  value={newCategory.color || '#888888'}
                  onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                  className="w-12 h-8 rounded cursor-pointer"
                />
              </div>
              <div className="col-span-1">
                <select
                  value={newCategory.is_productive === true ? 'productive' : newCategory.is_productive === false ? 'unproductive' : 'neutral'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewCategory({
                      ...newCategory,
                      is_productive: value === 'productive' ? true : value === 'unproductive' ? false : null
                    });
                  }}
                  className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                >
                  <option value="productive">✓ Productive</option>
                  <option value="unproductive">✗ Unproductive</option>
                  <option value="neutral">— Neutral</option>
                </select>
              </div>
              <div className="col-span-1">
                <select
                  value={newCategory.project_id || ''}
                  onChange={(e) => {
                    const projectId = e.target.value ? parseInt(e.target.value) : null;
                    setSelectedProjectId(projectId);
                    setNewCategory({ ...newCategory, project_id: projectId, task_id: null });
                  }}
                  className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  title="Default Project"
                >
                  <option value="">None</option>
                  {projects.filter(p => !p.is_archived).map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <select
                  value={newCategory.task_id || ''}
                  onChange={(e) => setNewCategory({ ...newCategory, task_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  disabled={!newCategory.project_id}
                  title="Default Task"
                >
                  <option value="">None</option>
                  {newCategory.project_id && tasks?.filter(t => !t.is_archived).map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCategory.is_billable ?? false}
                    onChange={(e) => setNewCategory({ ...newCategory, is_billable: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  value={newCategory.hourly_rate || ''}
                  onChange={(e) => setNewCategory({ ...newCategory, hourly_rate: e.target.value ? parseFloat(e.target.value) : null })}
                  className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="col-span-1">
                <input
                  type="number"
                  value={categories.length}
                  className="w-16 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                  disabled
                />
              </div>
              <div className="col-span-1">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCategory.is_pinned ?? false}
                    onChange={(e) => setNewCategory({ ...newCategory, is_pinned: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="col-span-1 flex gap-2">
                <Button size="sm" onClick={() => handleSave(newCategory)}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setNewCategory(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Categories List */}
          {categories.map((category) => (
            <div
              key={category.id}
              className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg items-center transition-colors"
            >
              {editingId === category.id ? (
                <>
                  <div className="col-span-1">
                    <input
                      type="text"
                      defaultValue={category.icon || ''}
                      className="w-12 px-2 py-1 border rounded text-center"
                      maxLength={2}
                      id={`icon-${category.id}`}
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      defaultValue={category.name}
                      className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                      id={`name-${category.id}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="color"
                      defaultValue={category.color || '#888888'}
                      className="w-12 h-8 rounded cursor-pointer"
                      id={`color-${category.id}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <select
                      id={`productive-${category.id}`}
                      defaultValue={category.is_productive === true ? 'productive' : category.is_productive === false ? 'unproductive' : 'neutral'}
                      className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                    >
                      <option value="productive">✓ Productive</option>
                      <option value="unproductive">✗ Unproductive</option>
                      <option value="neutral">— Neutral</option>
                    </select>
                  </div>
                  <div className="col-span-1">
                    <select
                      id={`project-${category.id}`}
                      defaultValue={category.project_id || ''}
                      onChange={(e) => {
                        const projectId = e.target.value ? parseInt(e.target.value) : null;
                        setEditingProjectId(projectId);
                        setEditingCategoryProjectId(null); // Clear category project_id when user changes it
                        const taskSelect = document.getElementById(`task-${category.id}`) as HTMLSelectElement;
                        if (taskSelect) taskSelect.value = '';
                      }}
                      className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      title="Default Project"
                    >
                      <option value="">None</option>
                      {projects.filter(p => !p.is_archived).map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <select
                      id={`task-${category.id}`}
                      defaultValue={category.task_id || ''}
                      className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      disabled={!effectiveEditingProjectId}
                      title="Default Task"
                    >
                      <option value="">None</option>
                      {effectiveEditingProjectId && editingTasks?.filter(t => !t.is_archived).map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      defaultChecked={category.is_billable ?? false}
                      id={`billable-${category.id}`}
                      className="w-4 h-4"
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      defaultValue={category.hourly_rate || ''}
                      className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                      id={`rate-${category.id}`}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      defaultValue={category.sort_order}
                      className="w-16 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                      id={`order-${category.id}`}
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      defaultChecked={category.is_pinned ?? false}
                      id={`pinned-${category.id}`}
                      className="w-4 h-4"
                    />
                  </div>
                  <div className="col-span-1 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        const icon = (document.getElementById(`icon-${category.id}`) as HTMLInputElement).value;
                        const name = (document.getElementById(`name-${category.id}`) as HTMLInputElement).value;
                        const color = (document.getElementById(`color-${category.id}`) as HTMLInputElement).value;
                        const productiveValue = (document.getElementById(`productive-${category.id}`) as HTMLSelectElement).value;
                        const is_productive = productiveValue === 'productive' ? true : productiveValue === 'unproductive' ? false : null;
                        const is_billable = (document.getElementById(`billable-${category.id}`) as HTMLInputElement).checked;
                        const is_pinned = (document.getElementById(`pinned-${category.id}`) as HTMLInputElement).checked;
                        const hourly_rate = (document.getElementById(`rate-${category.id}`) as HTMLInputElement).value;
                        const sort_order = parseInt((document.getElementById(`order-${category.id}`) as HTMLInputElement).value);
                        const project_id = (document.getElementById(`project-${category.id}`) as HTMLSelectElement)?.value ? parseInt((document.getElementById(`project-${category.id}`) as HTMLSelectElement).value) : null;
                        const task_id = (document.getElementById(`task-${category.id}`) as HTMLSelectElement)?.value ? parseInt((document.getElementById(`task-${category.id}`) as HTMLSelectElement).value) : null;
                        handleSave({ 
                          ...category, 
                          icon, 
                          name, 
                          color, 
                          is_productive, 
                          is_billable,
                          is_pinned,
                          hourly_rate: hourly_rate ? parseFloat(hourly_rate) : null,
                          sort_order,
                          project_id,
                          task_id
                        });
                      }}
                    >
                      ✓
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => {
                      setEditingId(null);
                      setEditingProjectId(null);
                      setEditingCategoryProjectId(null);
                    }}>
                      ✕
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-1 text-2xl">{category.icon || '📁'}</div>
                  <div className="col-span-2 font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </div>
                  <div className="col-span-1">
                    <div
                      className="w-8 h-8 rounded-full border-2 border-white shadow"
                      style={{ backgroundColor: category.color || '#888888' }}
                    />
                  </div>
                  <div className="col-span-1">
                    {category.is_productive === true && (
                      <span className="text-green-500">✓</span>
                    )}
                    {category.is_productive === false && (
                      <span className="text-red-500">✕</span>
                    )}
                    {category.is_productive === null && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                  <div className="col-span-1 text-sm text-gray-500 dark:text-gray-400">
                    {category.project_id ? projects.find(p => p.id === category.project_id)?.name || '—' : '—'}
                  </div>
                  <div className="col-span-1 text-sm text-gray-500 dark:text-gray-400">
                    {category.task_id ? (() => {
                      // Try to find task name from tasks if project matches selectedProjectId
                      if (category.project_id === selectedProjectId && tasks) {
                        const task = tasks.find(t => t.id === category.task_id);
                        if (task) return task.name;
                      }
                      // Otherwise show task ID or placeholder
                      return `Task #${category.task_id}`;
                    })() : '—'}
                  </div>
                  <div className="col-span-1">
                    {category.is_billable === true && (
                      <span className="text-green-500">💰</span>
                    )}
                    {category.is_billable === false && (
                      <span className="text-gray-400">—</span>
                    )}
                    {category.is_billable === null && (
                      <span className="text-gray-400">—</span>
                    )}
                  </div>
                  <div className="col-span-1 text-sm text-gray-500 dark:text-gray-400">
                    {category.hourly_rate ? `$${category.hourly_rate.toFixed(2)}` : '—'}
                  </div>
                  <div className="col-span-1 text-gray-500 dark:text-gray-400">
                    {category.sort_order}
                  </div>
                  <div className="col-span-1">
                    {category.is_pinned && (
                      <span className="text-blue-500" title="Pinned - shown in quick forms">📌</span>
                    )}
                    {category.is_system && (
                      <span className="text-gray-400 ml-1" title="System category - cannot be deleted">🔒</span>
                    )}
                  </div>
                  <div className="col-span-1 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => {
                      setEditingId(category.id);
                      setEditingProjectId(null);
                      setEditingCategoryProjectId(category.project_id || null);
                    }} title="Edit category">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="danger" 
                      onClick={() => handleDelete(category.id)} 
                      title={category.is_system ? "System category - cannot be deleted" : "Delete category"}
                      disabled={category.is_system}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
