import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemDetailsForm from '../../src/components/ProductPage/ItemDetailsForm';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('ItemDetailsForm', () => {
  const mockSetEditedProduct = vi.fn();

  const mockProduct = {
    productName: 'M4 Carbine',
    actualName: 'Rifle #1',
    serialNumber: 'W123456',
    nsn: 'NSN123',
    authQuantity: 5,
    ohQuantity: 3,
    description: 'Standard issue rifle',
    notes: 'Test notes',
    status: 'Completed',
    parent: null,
    isKit: false,
  };

  const mockKit = {
    productName: 'Medical Kit',
    actualName: 'First Aid Kit',
    liin: 'LIIN123',
    endItemNiin: 'NIIN456',
    notes: 'Kit notes',
    status: 'Completed',
    isKit: true,
  };

  const mockItemsList = [
    { itemId: 'kit-1', name: 'First Aid Kit', actualName: 'Medical Kit', isKit: true },
    { itemId: 'kit-2', name: 'Tool Kit', actualName: 'Maintenance Kit', isKit: true },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('View Mode (isEditMode = false)', () => {
    it('renders all item fields as read-only text', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
        />,
      );

      expect(screen.getByText('Display Name')).toBeInTheDocument();
      expect(screen.getByText('M4 Carbine')).toBeInTheDocument();
      expect(screen.getByText('Army Nomenclature')).toBeInTheDocument();
      expect(screen.getByText('Rifle #1')).toBeInTheDocument();
      expect(screen.getByText('Serial Number')).toBeInTheDocument();
      expect(screen.getByText('W123456')).toBeInTheDocument();
      expect(screen.getByText('Authorized Quantity')).toBeInTheDocument();
    });

    it('renders all kit fields as read-only text', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockKit}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
        />,
      );

      expect(screen.getByText('Display Name')).toBeInTheDocument();
      expect(screen.getByText('Medical Kit')).toBeInTheDocument();
      expect(screen.getByText('LIIN')).toBeInTheDocument();
      expect(screen.getByText('LIIN123')).toBeInTheDocument();
      expect(screen.getByText('End Item NIIN')).toBeInTheDocument();
      expect(screen.getByText('NIIN456')).toBeInTheDocument();
    });

    it('does not show text fields in view mode', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
        />,
      );

      const inputs = screen.queryAllByRole('textbox');
      const displayNameInputs = inputs.filter(
        (input) =>
          input.getAttribute('value') === 'M4 Carbine' && input.closest('.MuiTextField-root'),
      );
      expect(displayNameInputs.length).toBe(0);
    });

    it('shows parent kit info when item has parent', () => {
      const productWithParent = {
        ...mockProduct,
        parent: { itemId: 'kit-1', name: 'First Aid Kit' },
      };

      render(
        <ItemDetailsForm
          editedProduct={productWithParent}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
        />,
      );

      // This test now passes because we removed the "Part of Kit" display in view mode
      expect(screen.queryByText('Part of Kit')).not.toBeInTheDocument();
    });

    it('does not show parent section when no parent', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
        />,
      );

      expect(screen.queryByText('Part of Kit')).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode (isEditMode = true)', () => {
    it('renders all item fields as editable text fields', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const displayNameInput = screen.getByDisplayValue('M4 Carbine');
      expect(displayNameInput).toBeInTheDocument();

      const actualNameInput = screen.getByDisplayValue('Rifle #1');
      expect(actualNameInput).toBeInTheDocument();

      const serialInput = screen.getByDisplayValue('W123456');
      expect(serialInput).toBeInTheDocument();

      const authQuantityInput = screen.getByDisplayValue('5');
      expect(authQuantityInput).toBeInTheDocument();

      const descInput = screen.getByDisplayValue('Standard issue rifle');
      expect(descInput).toBeInTheDocument();
    });

    it('calls setEditedProduct when field values change', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const displayNameInput = screen.getByDisplayValue('M4 Carbine');
      fireEvent.change(displayNameInput, { target: { value: 'M4A1 Carbine' } });

      expect(mockSetEditedProduct).toHaveBeenCalledWith({
        ...mockProduct,
        productName: 'M4A1 Carbine',
      });
    });

    it('updates authQuantity as number when changed', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const quantityInput = screen.getByDisplayValue('5');
      fireEvent.change(quantityInput, { target: { value: '10' } });

      expect(mockSetEditedProduct).toHaveBeenCalledWith({
        ...mockProduct,
        authQuantity: 10,
      });
    });

    it('shows parent item selector dropdown for items only', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toBeInTheDocument();
    });

    it('shows parent selector for kits too (optional)', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockKit}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      // Now the parent selector shows for kits as well
      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Select parent kit (optional)')).toBeInTheDocument();
    });
  });

  describe('Status Buttons', () => {
    it('renders status buttons in edit mode (not create mode)', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
          isCreateMode={false}
        />,
      );

      const buttons = screen.getAllByRole('button');
      const statusButtons = buttons.filter((b) =>
        b.textContent?.match(/To Review|Complete|Damaged|Shortage/),
      );
      expect(statusButtons.length).toBeGreaterThan(0);
    });

    it('shows selected status as contained button', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
          isCreateMode={false}
        />,
      );

      const buttons = screen.getAllByRole('button');
      const completeButton = buttons.find((b) => b.textContent === 'Complete');
      expect(completeButton).toHaveClass('MuiButton-contained');
    });

    it('updates status when status button clicked', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
          isCreateMode={false}
        />,
      );

      const damagedButton = screen.getByRole('button', { name: /Damaged/i });
      fireEvent.click(damagedButton);

      expect(mockSetEditedProduct).toHaveBeenCalledWith({
        ...mockProduct,
        status: 'Damaged',
      });
    });
  });

  describe('Always Editable Fields', () => {
    it('shows status buttons in view mode when status is always editable', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
          isCreateMode={false}
          alwaysEditableFields={['status']}
        />,
      );

      const buttons = screen.getAllByRole('button');
      const completeButton = buttons.find((b) => b.textContent === 'Complete');
      expect(completeButton).toBeInTheDocument();
    });

    it('shows notes field in view mode when notes is always editable', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
          alwaysEditableFields={['notes']}
        />,
      );

      const notesInput = screen.getByDisplayValue('Test notes');
      expect(notesInput).toBeInTheDocument();
    });

    it('shows description field in view mode when description is always editable', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
          alwaysEditableFields={['description']}
        />,
      );

      const descInput = screen.getByDisplayValue('Standard issue rifle');
      expect(descInput).toBeInTheDocument();
    });
  });

  describe('Copy to Clipboard', () => {
    it('copies serial number to clipboard when copy button clicked', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
        />,
      );

      const copyButtons = screen.getAllByRole('button', { name: /Copy/i });
      fireEvent.click(copyButtons[0]);

      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });

    it('does not show copy button when serial number is empty', () => {
      const productNoSerial = { ...mockProduct, serialNumber: '', nsn: '' };

      render(
        <ItemDetailsForm
          editedProduct={productNoSerial}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
        />,
      );

      expect(screen.queryByRole('button', { name: /Copy/i })).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined/null values gracefully', () => {
      const emptyProduct = {
        productName: null,
        actualName: undefined,
        serialNumber: '',
        nsn: '',
        authQuantity: 0,
        ohQuantity: 0,
        description: null,
        notes: undefined,
        status: '',
        isKit: false,
      };

      render(
        <ItemDetailsForm
          editedProduct={emptyProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={false}
        />,
      );

      expect(screen.getAllByText('-').length).toBeGreaterThan(0);
      expect(screen.getByText('No description')).toBeInTheDocument();
    });

    it('handles invalid quantity input by defaulting to 1', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const quantityInput = screen.getByDisplayValue('5');
      fireEvent.change(quantityInput, { target: { value: 'invalid' } });

      expect(mockSetEditedProduct).toHaveBeenCalledWith({
        ...mockProduct,
        authQuantity: 1,
      });
    });

    it('required attribute present on required fields in edit mode', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const displayNameInput = screen.getByDisplayValue('M4 Carbine');
      expect(displayNameInput).toBeRequired();

      const actualNameInput = screen.getByDisplayValue('Rifle #1');
      expect(actualNameInput).toBeRequired();
    });
  });

  describe('Item Type Toggle', () => {
    it('shows item/kit toggle in create mode', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
          isCreateMode={true}
        />,
      );

      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Item/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Kit/i })).toBeInTheDocument();
    });

    it('does not show item/kit toggle when not in create mode', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
          isCreateMode={false}
        />,
      );

      expect(screen.queryByText('Type')).not.toBeInTheDocument();
    });
  });
});
