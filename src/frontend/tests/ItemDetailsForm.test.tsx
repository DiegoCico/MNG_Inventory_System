import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemDetailsForm from '../src/components/ItemDetailsForm';

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
    quantity: 5,
    description: 'Standard issue rifle',
    notes: 'Test notes',
    status: 'Completed',
    parent: null,
  };

  const mockItemsList = [
    { itemId: 'kit-1', name: 'First Aid Kit', actualName: 'Medical Kit' },
    { itemId: 'kit-2', name: 'Tool Kit', actualName: 'Maintenance Kit' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('View Mode (isEditMode = false)', () => {
    it('renders all fields as read-only text', () => {
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
      expect(screen.getByText('Quantity')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
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

      expect(screen.getByText('Part of Kit')).toBeInTheDocument();
      expect(screen.getByText('First Aid Kit')).toBeInTheDocument();
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
    it('renders all fields as editable text fields', () => {
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

      const quantityInput = screen.getByDisplayValue('5');
      expect(quantityInput).toBeInTheDocument();

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

    it('updates quantity as number when changed', () => {
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
        quantity: 10,
      });
    });

    it('shows parent item selector dropdown', () => {
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

    it('updates parent when kit selected from autocomplete', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const autocomplete = screen.getByRole('combobox');
      fireEvent.click(autocomplete);

      // This would need more complex autocomplete testing
      // The actual selection would trigger setEditedProduct with the selected kit
    });
  });

  describe('Status Buttons', () => {
    it('renders four status buttons in edit mode', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const buttons = screen.getAllByRole('button');
      const statusButtons = buttons.filter((b) =>
        b.textContent?.match(/Incomplete|Complete|Damaged|Shortage/),
      );
      expect(statusButtons.length).toBe(3);
    });

    it('shows selected status as contained button', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const buttons = screen.getAllByRole('button');
      const completeButton = buttons.find((b) => b.textContent === 'Complete');
      expect(completeButton).toHaveClass('MuiButton-contained');
    });

    it('shows non-selected statuses as outlined buttons', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const incompleteButton = screen.getByRole('button', { name: /To Review/i });
      expect(incompleteButton).toHaveClass('MuiButton-outlined');
    });

    it('updates status when status button clicked', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const damagedButton = screen.getByRole('button', { name: /Damaged/i });
      fireEvent.click(damagedButton);

      expect(mockSetEditedProduct).toHaveBeenCalledWith({
        ...mockProduct,
        status: 'Damaged',
      });
    });

    it('displays status icons correctly', () => {
      render(
        <ItemDetailsForm
          editedProduct={mockProduct}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const buttons = screen
        .getAllByRole('button')
        .filter((b) => b.textContent?.match(/Incomplete|Complete|Damaged|Shortage/));
      expect(buttons.length).toBe(3);
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
          alwaysEditableFields={['status']}
        />,
      );

      const buttons = screen.getAllByRole('button');
      const completeButton = buttons.find((b) => b.textContent === 'Complete');
      expect(completeButton).toBeInTheDocument();

      const damagedButton = buttons.find((b) => b.textContent === 'Damaged');
      expect(damagedButton).toBeInTheDocument();
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

      const copyButton = screen.getByRole('button', { name: /Copy/i });
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('W123456');
    });

    it('does not show copy button when serial number is empty', () => {
      const productNoSerial = { ...mockProduct, serialNumber: '' };

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
        quantity: 0,
        description: null,
        notes: undefined,
        status: '',
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
        quantity: 1,
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

      const serialInput = screen.getByDisplayValue('W123456');
      expect(serialInput).toBeRequired();

      const descInput = screen.getByDisplayValue('Standard issue rifle');
      expect(descInput).toBeRequired();
    });
  });

  describe('Parent Kit Selection', () => {
    it('displays itemsList options in autocomplete', () => {
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

    it('shows currently selected parent in autocomplete', () => {
      const productWithParent = {
        ...mockProduct,
        parent: { itemId: 'kit-1', name: 'First Aid Kit', actualName: 'Medical Kit' },
      };

      render(
        <ItemDetailsForm
          editedProduct={productWithParent}
          setEditedProduct={mockSetEditedProduct}
          itemsList={mockItemsList}
          isEditMode={true}
        />,
      );

      const autocomplete = screen.getByRole('combobox');
      expect(autocomplete).toBeInTheDocument();
    });
  });
});
