import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ActionPanel from '../../src/components/ProductPage/ActionPanel';
import * as itemsAPI from '../../src/api/items';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock items API
vi.mock('../../src/api/items', () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getItems: vi.fn(),
  getItem: vi.fn(),
  uploadImage: vi.fn(),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ActionPanel', () => {
  const mockSetIsEditMode = vi.fn();
  const mockSetShowSuccess = vi.fn();
  const mockSetFieldErrors = vi.fn();

  const baseProps = {
    teamId: 'test-team-123',
    itemId: 'test-item-456',
    isCreateMode: false,
    isEditMode: false,
    setIsEditMode: mockSetIsEditMode,
    product: {
      productName: 'M4 Carbine',
      actualName: 'Rifle #1',
      serialNumber: 'W123',
      nsn: 'N123',
      authQuantity: 3,
      ohQuantity: 3,
      status: 'To Review',
      description: 'Test description',
      notes: 'Test notes',
      isKit: false,
    },
    editedProduct: {
      productName: 'M4 Carbine',
      actualName: 'Rifle #1',
      serialNumber: 'W123',
      nsn: 'N123',
      authQuantity: 3,
      ohQuantity: 3,
      status: 'To Review',
      description: 'Test description',
      notes: 'Test notes',
      parent: 'kit-123',
      children: [],
      isKit: false,
    },
    selectedImageFile: null,
    imagePreview: 'https://example.com/image.jpg',
    setShowSuccess: mockSetShowSuccess,
    damageReports: [],
    setFieldErrors: mockSetFieldErrors,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.alert = vi.fn();

    vi.mocked(itemsAPI.createItem).mockResolvedValue({ success: true, itemId: 'new-item-123' });
    vi.mocked(itemsAPI.updateItem).mockResolvedValue({ success: true });
    vi.mocked(itemsAPI.deleteItem).mockResolvedValue({ success: true });
  });

  describe('View Mode (not editing)', () => {
    it('renders Edit and Delete buttons in view mode', () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    });

    it('does not show DONE button when no changes made', () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      expect(screen.queryByRole('button', { name: /DONE/i })).not.toBeInTheDocument();
    });

    it('shows DONE button when status changes', () => {
      const changedStatusProps = {
        ...baseProps,
        product: { ...baseProps.product, status: 'To Review' },
        editedProduct: { ...baseProps.editedProduct, status: 'Completed' },
      };

      renderWithRouter(<ActionPanel {...changedStatusProps} />);

      expect(screen.getByRole('button', { name: /DONE/i })).toBeInTheDocument();
    });

    it('shows DONE button when notes change', () => {
      const changedNotesProps = {
        ...baseProps,
        product: { ...baseProps.product, notes: 'old notes' },
        editedProduct: { ...baseProps.editedProduct, notes: 'new notes' },
      };

      renderWithRouter(<ActionPanel {...changedNotesProps} />);

      expect(screen.getByRole('button', { name: /DONE/i })).toBeInTheDocument();
    });

    it('shows DONE button when damage reports change', () => {
      const changedDamageProps = {
        ...baseProps,
        product: { ...baseProps.product, status: 'Damaged', damageReports: ['Old damage'] },
        editedProduct: { ...baseProps.editedProduct, status: 'Damaged' },
        damageReports: ['Old damage', 'New damage'],
      };

      renderWithRouter(<ActionPanel {...changedDamageProps} />);

      expect(screen.getByRole('button', { name: /DONE/i })).toBeInTheDocument();
    });

    it('shows DONE button when OH Quantity changes for Shortages status', () => {
      const changedOHProps = {
        ...baseProps,
        product: { ...baseProps.product, status: 'Shortages', ohQuantity: 2 },
        editedProduct: { ...baseProps.editedProduct, status: 'Shortages', ohQuantity: 1, authQuantity: 3 },
      };

      renderWithRouter(<ActionPanel {...changedOHProps} />);

      expect(screen.getByRole('button', { name: /DONE/i })).toBeInTheDocument();
    });

    it('does not show DONE button for Shortages if OH >= Authorized', () => {
      const invalidOHProps = {
        ...baseProps,
        product: { ...baseProps.product, status: 'To Review' },
        editedProduct: { ...baseProps.editedProduct, status: 'Shortages', ohQuantity: 5, authQuantity: 3 },
      };

      renderWithRouter(<ActionPanel {...invalidOHProps} />);

      expect(screen.queryByRole('button', { name: /DONE/i })).not.toBeInTheDocument();
    });

    it('shows DONE button for kit with Shortages status', () => {
      const kitShortagesProps = {
        ...baseProps,
        product: { ...baseProps.product, status: 'To Review', isKit: true },
        editedProduct: { ...baseProps.editedProduct, status: 'Shortages', isKit: true },
      };

      renderWithRouter(<ActionPanel {...kitShortagesProps} />);

      expect(screen.getByRole('button', { name: /DONE/i })).toBeInTheDocument();
    });

    it('switches to edit mode when Edit button clicked', () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      const editButton = screen.getByRole('button', { name: /Edit/i });
      fireEvent.click(editButton);

      expect(mockSetIsEditMode).toHaveBeenCalledWith(true);
    });

    it('opens delete confirmation dialog when Delete clicked', () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      fireEvent.click(deleteButton);

      expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();
    });

    it('saves changes when DONE button clicked', async () => {
      const changedStatusProps = {
        ...baseProps,
        product: { ...baseProps.product, status: 'To Review' },
        editedProduct: { ...baseProps.editedProduct, status: 'Completed' },
      };

      renderWithRouter(<ActionPanel {...changedStatusProps} />);

      const doneButton = screen.getByRole('button', { name: /DONE/i });
      fireEvent.click(doneButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith(
          'test-team-123',
          'test-item-456',
          expect.any(Object),
        );
        expect(mockSetShowSuccess).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Edit Mode', () => {
    const editModeProps = { ...baseProps, isEditMode: true };

    it('renders Save and Cancel buttons in edit mode', () => {
      renderWithRouter(<ActionPanel {...editModeProps} />);

      expect(screen.getByRole('button', { name: /^Save$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Edit$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    });

    it('exits edit mode when Cancel clicked', () => {
      renderWithRouter(<ActionPanel {...editModeProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(mockSetIsEditMode).toHaveBeenCalledWith(false);
    });

    it('clears field errors when Cancel clicked', () => {
      renderWithRouter(<ActionPanel {...editModeProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(mockSetFieldErrors).toHaveBeenCalledWith({});
    });

    it('saves changes when Save clicked', async () => {
      renderWithRouter(<ActionPanel {...editModeProps} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalled();
        expect(mockSetShowSuccess).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Create Mode', () => {
    const createModeProps = { 
      ...baseProps, 
      isCreateMode: true, 
      isEditMode: true, 
      itemId: 'new',
      editedProduct: {
        ...baseProps.editedProduct,
        parent: 'kit-123',
      }
    };

    it('renders CREATE button in create mode', () => {
      renderWithRouter(<ActionPanel {...createModeProps} />);

      // There may be multiple CREATE buttons (desktop and mobile)
      const createButtons = screen.getAllByRole('button', { name: /^CREATE$/i });
      expect(createButtons.length).toBeGreaterThan(0);
    });

    it('does not show Cancel button in create mode', () => {
      renderWithRouter(<ActionPanel {...createModeProps} />);

      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    });

    it('shows error dialog when required fields missing', async () => {
      const propsNoFields = { 
        ...createModeProps, 
        editedProduct: {
          productName: '',
          actualName: '',
          nsn: '',
          serialNumber: '',
          description: '',
          authQuantity: 1,
          isKit: false,
          parent: 'kit-123',
        }
      };

      renderWithRouter(<ActionPanel {...propsNoFields} />);

      const createButtons = screen.getAllByRole('button', { name: /^CREATE$/i });
      fireEvent.click(createButtons[0]);

      expect(await screen.findByText('Please fill in all required fields correctly')).toBeInTheDocument();
      expect(mockSetFieldErrors).toHaveBeenCalled();
      expect(vi.mocked(itemsAPI.createItem)).not.toHaveBeenCalled();
    });

    it('shows error dialog when image required before creating', async () => {
      const propsNoImage = { ...createModeProps, imagePreview: '' };

      renderWithRouter(<ActionPanel {...propsNoImage} />);

      const createButtons = screen.getAllByRole('button', { name: /^CREATE$/i });
      fireEvent.click(createButtons[0]);

      expect(await screen.findByText('Please add an image before creating the item')).toBeInTheDocument();
      expect(vi.mocked(itemsAPI.createItem)).not.toHaveBeenCalled();
    });

    it('shows error dialog when Authorized < OH Quantity', async () => {
      const invalidQuantityProps = {
        ...createModeProps,
        editedProduct: {
          ...createModeProps.editedProduct,
          authQuantity: 2,
          ohQuantity: 5,
        },
      };

      renderWithRouter(<ActionPanel {...invalidQuantityProps} />);

      const createButtons = screen.getAllByRole('button', { name: /^CREATE$/i });
      fireEvent.click(createButtons[0]);

      expect(await screen.findByText('Authorized Quantity must be greater than or equal to OH Quantity')).toBeInTheDocument();
      expect(vi.mocked(itemsAPI.createItem)).not.toHaveBeenCalled();
    });

    it('creates item and navigates when all validations pass', async () => {
      renderWithRouter(<ActionPanel {...createModeProps} />);

      const createButtons = screen.getAllByRole('button', { name: /^CREATE$/i });
      fireEvent.click(createButtons[0]);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.createItem)).toHaveBeenCalled();
        expect(mockSetShowSuccess).toHaveBeenCalledWith(true);
        expect(mockNavigate).toHaveBeenCalledWith('/teams/to-review/test-team-123', {
          replace: true,
        });
      });
    });

    it('converts image file to base64 when creating', async () => {
      const mockFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
      const propsWithFile = {
        ...createModeProps,
        selectedImageFile: mockFile,
      };

      renderWithRouter(<ActionPanel {...propsWithFile} />);

      const createButtons = screen.getAllByRole('button', { name: /^CREATE$/i });
      fireEvent.click(createButtons[0]);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.createItem)).toHaveBeenCalled();

        const call = vi.mocked(itemsAPI.createItem).mock.calls[0];
        const imageArg = call[3];

        expect(typeof imageArg).toBe('string');
        expect(imageArg).toMatch(/^data:image\/jpeg;base64,/);
      });
    });
  });

  describe('Delete Functionality', () => {
    it('cancels deletion when Cancel clicked in dialog', async () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
      expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();

      const dialog = screen.getByRole('dialog');
      const cancelButton = within(dialog).getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/Confirm Deletion/i)).not.toBeInTheDocument();
      });
    });

    it('deletes item and navigates when confirmed', async () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /Delete/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.deleteItem)).toHaveBeenCalledWith(
          'test-team-123',
          'test-item-456',
        );
        expect(mockNavigate).toHaveBeenCalledWith('/teams/to-review/test-team-123');
      });
    });

    it('shows deleting state during deletion', async () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /Delete/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/Deleting.../i)).toBeInTheDocument();
      });
    });
  });

  describe('Status Cascade to Children', () => {
    it('updates all children when parent status changes', async () => {
      const propsWithChildren = {
        ...baseProps,
        isEditMode: true,
        product: { ...baseProps.product, status: 'To Review' },
        editedProduct: {
          ...baseProps.editedProduct,
          status: 'Completed',
          children: [
            { itemId: 'child-1', status: 'To Review', children: [] },
            { itemId: 'child-2', status: 'To Review', children: [] },
          ],
        },
      };

      renderWithRouter(<ActionPanel {...propsWithChildren} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith(
          'test-team-123',
          'test-item-456',
          expect.any(Object),
        );
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith('test-team-123', 'child-1', {
          status: 'Completed',
        });
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith('test-team-123', 'child-2', {
          status: 'Completed',
        });
      });
    });

    it('recursively updates grandchildren', async () => {
      const propsWithGrandchildren = {
        ...baseProps,
        isEditMode: true,
        product: { ...baseProps.product, status: 'To Review' },
        editedProduct: {
          ...baseProps.editedProduct,
          status: 'Damaged',
          children: [
            {
              itemId: 'child-1',
              status: 'To Review',
              children: [{ itemId: 'grandchild-1', status: 'To Review', children: [] }],
            },
          ],
        },
      };

      renderWithRouter(<ActionPanel {...propsWithGrandchildren} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith('test-team-123', 'child-1', {
          status: 'Damaged',
        });
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith(
          'test-team-123',
          'grandchild-1',
          { status: 'Damaged' },
        );
      });
    });

    it('does not update children if status unchanged', async () => {
      const propsUnchangedStatus = {
        ...baseProps,
        isEditMode: true,
        product: { ...baseProps.product, status: 'Completed' },
        editedProduct: {
          ...baseProps.editedProduct,
          status: 'Completed',
          children: [{ itemId: 'child-1', status: 'To Review' }],
        },
      };

      renderWithRouter(<ActionPanel {...propsUnchangedStatus} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith(
          'test-team-123',
          'test-item-456',
          expect.any(Object),
        );
      });
    });
  });

  describe('Damage Reports', () => {
    it('includes damage reports in payload when saving', async () => {
      const propsWithDamage = {
        ...baseProps,
        isEditMode: true,
        editedProduct: { ...baseProps.editedProduct, status: 'Damaged' },
        damageReports: ['Scratched barrel', 'Dented stock'],
      };

      renderWithRouter(<ActionPanel {...propsWithDamage} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith(
          'test-team-123',
          'test-item-456',
          expect.objectContaining({
            damageReports: ['Scratched barrel', 'Dented stock'],
          }),
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error dialog when save fails', async () => {
      vi.mocked(itemsAPI.updateItem).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(<ActionPanel {...baseProps} isEditMode={true} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

      expect(await screen.findByText('Network error')).toBeInTheDocument();
    });

    it('shows error dialog when delete fails', async () => {
      vi.mocked(itemsAPI.deleteItem).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(<ActionPanel {...baseProps} />);

      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /Delete/i });
      fireEvent.click(confirmButton);

      expect(await screen.findByText('Failed to delete item')).toBeInTheDocument();
    });
  });

  describe('Navigation After Actions', () => {
    it('navigates to to-review after successful create', async () => {
      const createProps = {
        ...baseProps,
        isCreateMode: true,
        isEditMode: true,
        editedProduct: {
          ...baseProps.editedProduct,
          parent: 'kit-123',
        }
      };

      renderWithRouter(<ActionPanel {...createProps} />);

      const createButtons = screen.getAllByRole('button', { name: /^CREATE$/i });
      fireEvent.click(createButtons[0]);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/teams/to-review/test-team-123', {
          replace: true,
        });
      });
    });

    it('navigates to to-review after successful update', async () => {
      renderWithRouter(<ActionPanel {...baseProps} isEditMode={true} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/teams/to-review/test-team-123', {
          replace: true,
        });
      });
    });

    it('navigates to to-review after successful delete', async () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      const deleteButton = screen.getByRole('button', { name: /Delete/i });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText(/Confirm Deletion/i)).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /Delete/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/teams/to-review/test-team-123');
      });
    });
  });

  describe('Field Validation', () => {
    it('sets field errors when validation fails', async () => {
      const invalidProps = {
        ...baseProps,
        isEditMode: true,
        editedProduct: {
          ...baseProps.editedProduct,
          productName: '',
          nsn: '',
        },
      };

      renderWithRouter(<ActionPanel {...invalidProps} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSetFieldErrors).toHaveBeenCalledWith(
          expect.objectContaining({
            productName: true,
            nsn: true,
          })
        );
      });
    });

    it('clears errors on successful save', async () => {
      renderWithRouter(<ActionPanel {...baseProps} isEditMode={true} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSetFieldErrors).toHaveBeenCalledWith({});
      });
    });
  });
});