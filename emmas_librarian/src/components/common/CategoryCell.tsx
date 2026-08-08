import React, { useState } from 'react';
import { ProjectCategory } from '../../types';
import { useProjectService } from '../../contexts/ServicesContext';

interface CategoryCellProps {
  articleId: number;
  category: ProjectCategory;
  initialValue: string;
  onCategorySaved?: () => void;
}

export const CategoryCell: React.FC<CategoryCellProps> = ({ articleId, category, initialValue, onCategorySaved }) => {
  const projectService = useProjectService();
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  const prevInitialValueRef = React.useRef(initialValue);

  React.useEffect(() => {
    if (prevInitialValueRef.current !== initialValue) {
      prevInitialValueRef.current = initialValue;
      if (!isEditing) {
        setValue(initialValue);
      }
    }
  }, [initialValue, isEditing]);

  const initialOptions =
    category.type === 'enum' || category.type === 'multiselect'
      ? category.parsedOptions
        ? category.parsedOptions.map((o) => o.name)
        : category.options
          ? category.options.split(',').map((o) => o.trim())
          : []
      : [];
  const [localOptions, setLocalOptions] = useState(initialOptions);
  const [isAddingNewOption, setIsAddingNewOption] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState('');

  const handleSave = async (newValue: string) => {
    setValue(newValue);
    setIsEditing(false);
    try {
      await projectService.setArticleCategory(articleId, category.id, newValue);
      if (onCategorySaved) onCategorySaved();
    } catch (err) {
      console.error(err);
    }
  };

  if (category.type === 'boolean') {
    return (
      <select
        value={value}
        onChange={(e) => handleSave(e.target.value)}
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.2rem 0.5rem',
          fontSize: '0.85rem',
        }}
      >
        <option value="">-</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  }

  if (category.type === 'enum') {
    const handleEnumChange = async (val: string) => {
      if (val === '__ADD_NEW__') {
        setIsAddingNewOption(true);
        setNewOptionValue('');
      } else {
        handleSave(val);
      }
    };

    const saveNewOption = async () => {
      if (newOptionValue && newOptionValue.trim()) {
        const trimmed = newOptionValue.trim();
        if (!localOptions.includes(trimmed)) {
          const updatedOptions = category.parsedOptions
            ? [...category.parsedOptions]
            : localOptions.map((n) => ({ name: n }));
          updatedOptions.push({ name: trimmed });
          try {
            await projectService.updateProjectCategory(
              category.id,
              category.name,
              category.type,
              updatedOptions as any,
            );
            setLocalOptions([...localOptions, trimmed]);
            handleSave(trimmed);
          } catch (err) {
            console.error(err);
            alert('Erro ao adicionar opção.');
          }
        } else {
          handleSave(trimmed);
        }
      }
      setIsAddingNewOption(false);
    };

    if (isAddingNewOption) {
      return (
        <input
          autoFocus
          value={newOptionValue}
          onChange={(e) => setNewOptionValue(e.target.value)}
          onBlur={saveNewOption}
          placeholder="Nova opção..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveNewOption();
            if (e.key === 'Escape') setIsAddingNewOption(false);
          }}
          style={{
            background: 'var(--bg-surface)',
            color: 'var(--text-main)',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.2rem 0.5rem',
            fontSize: '0.85rem',
            width: '120px',
          }}
        />
      );
    }

    // Make sure the selected value is in localOptions, just in case
    const optionsToRender = [...localOptions];
    if (value && !optionsToRender.includes(value)) {
      optionsToRender.push(value);
    }

    return (
      <select
        value={value}
        onChange={(e) => handleEnumChange(e.target.value)}
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.2rem 0.5rem',
          fontSize: '0.85rem',
          maxWidth: '120px',
        }}
      >
        <option value="">-</option>
        {optionsToRender.map((opt, idx) => (
          <option key={idx} value={opt}>
            {opt}
          </option>
        ))}
        <option value="__ADD_NEW__">+ Adicionar nova opção...</option>
      </select>
    );
  }

  if (category.type === 'multiselect') {
    const selectedValues = value
      ? value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

    const saveWithoutClosing = async (newValue: string) => {
      setValue(newValue);
      try {
        await projectService.setArticleCategory(articleId, category.id, newValue);
        if (onCategorySaved) onCategorySaved();
      } catch (err) {
        console.error(err);
      }
    };

    const handleToggleOption = (opt: string) => {
      let newSelected;
      if (selectedValues.includes(opt)) {
        newSelected = selectedValues.filter((v) => v !== opt);
      } else {
        newSelected = [...selectedValues, opt];
      }
      saveWithoutClosing(newSelected.join(', '));
    };

    const saveNewOptionMultiselect = async () => {
      if (newOptionValue && newOptionValue.trim()) {
        const trimmed = newOptionValue.trim();
        if (!localOptions.includes(trimmed)) {
          // If we have parsedOptions, we preserve their IDs
          const updatedOptions = category.parsedOptions
            ? [...category.parsedOptions]
            : localOptions.map((n) => ({ name: n }));
          updatedOptions.push({ name: trimmed });

          try {
            await projectService.updateProjectCategory(
              category.id,
              category.name,
              category.type,
              updatedOptions as any,
            );
            setLocalOptions([...localOptions, trimmed]);

            const newSelected = [...selectedValues, trimmed];
            saveWithoutClosing(newSelected.join(', '));
          } catch (err) {
            console.error(err);
            alert('Erro ao adicionar opção.');
          }
        } else {
          if (!selectedValues.includes(trimmed)) {
            saveWithoutClosing([...selectedValues, trimmed].join(', '));
          }
        }
      }
      setIsAddingNewOption(false);
      setNewOptionValue('');
    };

    if (isAddingNewOption) {
      return (
        <input
          autoFocus
          value={newOptionValue}
          onChange={(e) => setNewOptionValue(e.target.value)}
          onBlur={saveNewOptionMultiselect}
          placeholder="Nova opção..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveNewOptionMultiselect();
            if (e.key === 'Escape') setIsAddingNewOption(false);
          }}
          style={{
            background: 'var(--bg-surface)',
            color: 'var(--text-main)',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.2rem 0.5rem',
            fontSize: '0.85rem',
            width: '120px',
          }}
        />
      );
    }

    if (isEditing) {
      const optionsToRender = [...localOptions];
      selectedValues.forEach((val) => {
        if (!optionsToRender.includes(val)) {
          optionsToRender.push(val);
        }
      });

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
            background: 'var(--bg-surface)',
            padding: '0.5rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-primary)',
            minWidth: '140px',
          }}
        >
          {optionsToRender.map((opt, idx) => (
            <label
              key={idx}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={selectedValues.includes(opt)}
                onChange={() => handleToggleOption(opt)}
                style={{ margin: 0 }}
              />
              {opt}
            </label>
          ))}
          <div
            style={{ fontSize: '0.8rem', color: 'var(--color-primary)', cursor: 'pointer', marginTop: '0.2rem' }}
            onClick={() => {
              setIsAddingNewOption(true);
              setNewOptionValue('');
            }}
          >
            + Adicionar nova...
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              textAlign: 'center',
              marginTop: '0.4rem',
              paddingTop: '0.4rem',
              borderTop: '1px solid var(--border-color)',
            }}
            onClick={() => setIsEditing(false)}
          >
            Concluir
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={() => setIsEditing(true)}
        style={{
          cursor: 'pointer',
          minHeight: '20px',
          minWidth: '60px',
          display: 'inline-block',
          fontSize: '0.85rem',
          padding: '0.2rem 0.5rem',
          borderRadius: 'var(--radius-sm)',
          background: selectedValues.length > 0 ? 'var(--bg-surface)' : 'transparent',
          border: selectedValues.length > 0 ? '1px solid var(--border-color)' : '1px dashed var(--border-color)',
          color: selectedValues.length > 0 ? 'var(--text-main)' : 'var(--text-muted)',
          wordBreak: 'break-word',
        }}
      >
        {selectedValues.length > 0 ? selectedValues.join(', ') : 'Adicionar'}
      </div>
    );
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => handleSave(value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave(value);
          if (e.key === 'Escape') {
            setValue(initialValue);
            setIsEditing(false);
          }
        }}
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-main)',
          border: '1px solid var(--color-primary)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.2rem 0.5rem',
          fontSize: '0.85rem',
          width: '100px',
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      style={{
        cursor: 'pointer',
        minHeight: '20px',
        minWidth: '60px',
        display: 'inline-block',
        fontSize: '0.85rem',
        padding: '0.2rem 0.5rem',
        borderRadius: 'var(--radius-sm)',
        background: value ? 'var(--bg-surface)' : 'transparent',
        border: value ? '1px solid var(--border-color)' : '1px dashed var(--border-color)',
        color: value ? 'var(--text-main)' : 'var(--text-muted)',
      }}
    >
      {value || 'Adicionar'}
    </div>
  );
};
