import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ActionPanel from '../src/components/ActionPanel';
import * as itemsAPI from '../src/api/items';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../src/api/items');
vi.mock('../src/api/auth', () => ({
  me: vi.fn(() => Promise.reject(new Error('Auth disabled'))),
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('ActionPanel', () => {
  const mockSetIsEditMode = vi.fn();
  const mockSetShowSuccess = vi.fn();

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
      quantity: 1,
      status: 'Incomplete',
    },
    editedProduct: {
      productName: 'M4 Carbine',
      actualName: 'Rifle #1',
      serialNumber: 'W123',
      quantity: 1,
      status: 'Incomplete',
      description: 'Test description',
      notes: 'Test notes',
      parent: null,
      children: [],
    },
    selectedImageFile: null,
    imagePreview: 'https://example.com/image.jpg',
    setShowSuccess: mockSetShowSuccess,
    damageReports: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.alert = vi.fn();

    vi.mocked(itemsAPI.createItem).mockResolvedValue({ success: true, itemId: 'new-item-123' });
    vi.mocked(itemsAPI.updateItem).mockResolvedValue({ success: true });
    vi.mocked(itemsAPI.deleteItem).mockResolvedValue({ success: true });
    vi.mocked(itemsAPI.uploadImage).mockResolvedValue({
      success: true,
      imageLink: 'https://example.com/uploaded.jpg',
    });
  });

  describe('View Mode (not editing)', () => {
    it('renders Save, Edit, and Delete buttons in view mode', () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      expect(screen.getByRole('button', { name: /^Save$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
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

    it('saves notes when Save button clicked in view mode', async () => {
      renderWithRouter(<ActionPanel {...baseProps} />);

      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      fireEvent.click(saveButton);

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

    it('renders Save Changes and Cancel buttons in edit mode', () => {
      renderWithRouter(<ActionPanel {...editModeProps} />);

      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
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

    it('saves changes when Save Changes clicked', async () => {
      renderWithRouter(<ActionPanel {...editModeProps} />);

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalled();
        expect(mockSetShowSuccess).toHaveBeenCalledWith(true);
      });
    });
  });

  describe('Create Mode', () => {
    const createModeProps = { ...baseProps, isCreateMode: true, isEditMode: true, itemId: 'new' };

    it('renders Create Item button in create mode', () => {
      renderWithRouter(<ActionPanel {...createModeProps} />);

      expect(screen.getByRole('button', { name: /Create Item/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Cancel/i })).not.toBeInTheDocument();
    });

    it('validates image required before creating', async () => {
      const propsNoImage = { ...createModeProps, imagePreview: '' };

      renderWithRouter(<ActionPanel {...propsNoImage} />);

      const createButton = screen.getByRole('button', { name: /Create Item/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Please add an image before creating the item');
      });

      expect(vi.mocked(itemsAPI.createItem)).not.toHaveBeenCalled();
    });

    it('creates item and navigates when Create clicked with image', async () => {
      renderWithRouter(<ActionPanel {...createModeProps} />);

      const createButton = screen.getByRole('button', { name: /Create Item/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.createItem)).toHaveBeenCalled();
        expect(mockSetShowSuccess).toHaveBeenCalledWith(true);
        expect(mockNavigate).toHaveBeenCalledWith('/teams/to-review/test-team-123', {
          replace: true,
        });
      });
    });

    it('uploads image if file selected', async () => {
      const mockFile = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
     const propsWithFile = {
        ...createModeProps,
        selectedImageFile: mockFile,
      };

      renderWithRouter(<ActionPanel {...propsWithFile} />);

      const createButton = screen.getByRole('button', { name: /Create Item/i });
      fireEvent.click(createButton);

        await waitFor(() => {
          expect(vi.mocked(itemsAPI.createItem)).toHaveBeenCalled();

          const call = vi.mocked(itemsAPI.createItem).mock.calls[0];

          // Argument 5 is: serialNumber
          // Argument 6 is: imageBase64 (your code)
          const imageArg = call[5];

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
        product: { ...baseProps.product, status: 'Incomplete' },
        editedProduct: {
          ...baseProps.editedProduct,
          status: 'Found',
          children: [
            { itemId: 'child-1', status: 'Incomplete', children: [] },
            { itemId: 'child-2', status: 'Incomplete', children: [] },
          ],
        },
      };

      renderWithRouter(<ActionPanel {...propsWithChildren} />);

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith(
          'test-team-123',
          'test-item-456',
          expect.any(Object),
        );
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith('test-team-123', 'child-1', {
          status: 'Found',
        });
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith('test-team-123', 'child-2', {
          status: 'Found',
        });
      });
    });

    it('recursively updates grandchildren', async () => {
      const propsWithGrandchildren = {
        ...baseProps,
        isEditMode: true,
        product: { ...baseProps.product, status: 'Incomplete' },
        editedProduct: {
          ...baseProps.editedProduct,
          status: 'Damaged',
          children: [
            {
              itemId: 'child-1',
              status: 'Incomplete',
              children: [{ itemId: 'grandchild-1', status: 'Incomplete', children: [] }],
            },
          ],
        },
      };

      renderWithRouter(<ActionPanel {...propsWithGrandchildren} />);

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
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
        product: { ...baseProps.product, status: 'Found' },
        editedProduct: {
          ...baseProps.editedProduct,
          status: 'Found',
          children: [{ itemId: 'child-1', status: 'Incomplete' }],
        },
      };

      renderWithRouter(<ActionPanel {...propsUnchangedStatus} />);

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
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

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
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

  describe('Image Handling', () => {
    it('requires image for create mode', async () => {
      const createProps = {
        ...baseProps,
        isCreateMode: true,
        isEditMode: true,
        imagePreview: '',
      };

      renderWithRouter(<ActionPanel {...createProps} />);

      const createButton = screen.getByRole('button', { name: /Create Item/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Please add an image before creating the item');
      });

      expect(vi.mocked(itemsAPI.createItem)).not.toHaveBeenCalled();
    });

it('embeds new base64 image when file selected', async () => {
  const mockFile = new File(['image-data'], 'test.jpg', { type: 'image/jpeg' });

  const propsWithFile = {
    ...baseProps,
    isEditMode: true,
    selectedImageFile: mockFile,
  };

  renderWithRouter(<ActionPanel {...propsWithFile} />);

  const saveButton = screen.getByRole('button', { name: /Save Changes/i });
  fireEvent.click(saveButton);

  await waitFor(() => {
    expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalled();

    const call = vi.mocked(itemsAPI.updateItem).mock.calls[0];

    const body = call[2];

    expect(body.imageBase64).toMatch(/^data:image\/jpeg;base64,/);
  });
});
  });

  describe('Error Handling', () => {
    it('shows alert when save fails', async () => {
      vi.mocked(itemsAPI.updateItem).mockRejectedValueOnce(new Error('Network error'));

      renderWithRouter(<ActionPanel {...baseProps} isEditMode={true} />);

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Failed to save item');
      });
    });

    it('shows alert when delete fails', async () => {
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

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Failed to delete item');
      });
    });
  });

  describe('Navigation After Actions', () => {
    it('navigates to to-review after successful create', async () => {
      const createProps = {
        ...baseProps,
        isCreateMode: true,
        isEditMode: true,
      };

      renderWithRouter(<ActionPanel {...createProps} />);

      const createButton = screen.getByRole('button', { name: /Create Item/i });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/teams/to-review/test-team-123', {
          replace: true,
        });
      });
    });

    it('navigates to to-review after successful update', async () => {
      renderWithRouter(<ActionPanel {...baseProps} isEditMode={true} />);

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
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

  describe('Payload Construction', () => {
    it('constructs correct payload with all fields', async () => {
      const fullProduct = {
        productName: 'M4A1',
        actualName: 'Rifle #2',
        serialNumber: 'W999',
        quantity: 3,
        description: 'Updated desc',
        notes: 'New notes',
        status: 'Found',
        parent: { itemId: 'kit-123' },
      };

      const propsFullProduct = {
        ...baseProps,
        isEditMode: true,
        editedProduct: fullProduct,
        damageReports: ['Test damage'],
      };

      renderWithRouter(<ActionPanel {...propsFullProduct} />);

      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(vi.mocked(itemsAPI.updateItem)).toHaveBeenCalledWith(
          'test-team-123',
          'test-item-456',
          expect.objectContaining({
            name: 'M4A1',
            actualName: 'Rifle #2',
            serialNumber: 'W999',
            quantity: 3,
            description: 'Updated desc',
            notes: 'New notes',
            status: 'Found',
            parent: 'kit-123',
            damageReports: ['Test damage'],
          }),
        );
      });
    });
  });
});
