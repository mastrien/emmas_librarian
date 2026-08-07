import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectHeader } from '../components/ProjectHeader';

describe('ProjectHeader', () => {
  const mockProject = {
    id: 1,
    name: 'Test Project',
    created_at: '2023-01-01T00:00:00.000Z',
    description: '',
    updated_at: '2023-01-01T00:00:00.000Z',
  };

  const defaultProps = {
    project: mockProject,
    articlesCount: 42,
    isEditingName: false,
    setIsEditingName: vi.fn(),
    newName: 'Test Project',
    setNewName: vi.fn(),
    handleUpdateName: vi.fn(),
    handleDeleteProject: vi.fn(),
  };

  it('renders project name and article count correctly', () => {
    render(<ProjectHeader {...defaultProps} />);
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText(/42 artigos no total/)).toBeInTheDocument();
  });

  it('calls setIsEditingName when edit button is clicked', () => {
    render(<ProjectHeader {...defaultProps} />);
    const editButton = screen.getAllByRole('button')[0]; // The first one is the edit button
    act(() => {
      fireEvent.click(editButton);
    });
    expect(defaultProps.setIsEditingName).toHaveBeenCalledWith(true);
  });

  it('calls handleDeleteProject when delete button is clicked', () => {
    render(<ProjectHeader {...defaultProps} />);
    const deleteButton = screen.getAllByRole('button')[1]; // The second one is delete
    act(() => {
      fireEvent.click(deleteButton);
    });
    expect(defaultProps.handleDeleteProject).toHaveBeenCalled();
  });

  it('renders edit input when isEditingName is true', () => {
    render(<ProjectHeader {...defaultProps} isEditingName={true} newName="Updated Name" />);
    const input = screen.getByDisplayValue('Updated Name');
    expect(input).toBeInTheDocument();
  });

  it('calls setNewName when input value changes', () => {
    render(<ProjectHeader {...defaultProps} isEditingName={true} />);
    const input = screen.getByDisplayValue('Test Project');
    act(() => {
      fireEvent.change(input, { target: { value: 'New Test Name' } });
    });
    expect(defaultProps.setNewName).toHaveBeenCalledWith('New Test Name');
  });

  it('calls handleUpdateName when save button is clicked', () => {
    render(<ProjectHeader {...defaultProps} isEditingName={true} />);
    const saveButton = screen.getAllByRole('button')[0]; // Check icon
    act(() => {
      fireEvent.click(saveButton);
    });
    expect(defaultProps.handleUpdateName).toHaveBeenCalled();
  });

  it('cancels edit and resets name when cancel button is clicked', () => {
    render(<ProjectHeader {...defaultProps} isEditingName={true} />);
    const cancelButton = screen.getAllByRole('button')[1]; // X icon
    act(() => {
      fireEvent.click(cancelButton);
    });
    expect(defaultProps.setIsEditingName).toHaveBeenCalledWith(false);
    expect(defaultProps.setNewName).toHaveBeenCalledWith(mockProject.name);
  });
});
