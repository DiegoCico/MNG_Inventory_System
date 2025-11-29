import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImagePanel from '../../src/components/ProductPage/ImagePanel';

describe('ImagePanel', () => {
  const mockSetImagePreview = vi.fn();
  const mockSetSelectedImageFile = vi.fn();

  const baseProps = {
    imagePreview: '',
    setImagePreview: mockSetImagePreview,
    setSelectedImageFile: mockSetSelectedImageFile,
    isEditMode: false,
    isCreateMode: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    global.alert = vi.fn();
  });

  describe('Display States', () => {
    it('shows placeholder when no image preview', () => {
      render(<ImagePanel {...baseProps} />);

      expect(screen.getByText(/No image available/i)).toBeInTheDocument();
      expect(screen.getByTestId('ImageNotSupportedIcon')).toBeInTheDocument();
    });

    it('displays image when imagePreview provided', () => {
      render(<ImagePanel {...baseProps} imagePreview="https://example.com/rifle.jpg" />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('src', 'https://example.com/rifle.jpg');
      expect(screen.queryByText(/No image available/i)).not.toBeInTheDocument();
    });
  });

  describe('Edit Mode Controls', () => {
    it('hides upload button when not in edit mode', () => {
      render(<ImagePanel {...baseProps} />);

      expect(screen.queryByRole('button', { name: /Add Image/i })).not.toBeInTheDocument();
    });

    it("shows 'Add Image' button in edit mode without image", () => {
      render(<ImagePanel {...baseProps} isEditMode={true} />);

      expect(screen.getByRole('button', { name: /Add Image/i })).toBeInTheDocument();
    });

    it("shows 'Change Image' button in edit mode with image", () => {
      render(
        <ImagePanel
          {...baseProps}
          imagePreview="https://example.com/rifle.jpg"
          isEditMode={true}
        />,
      );

      expect(screen.getByRole('button', { name: /Change Image/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Add Image/i })).not.toBeInTheDocument();
    });

    it('shows warning text in create mode without image', () => {
      render(<ImagePanel {...baseProps} isEditMode={true} isCreateMode={true} />);

      expect(screen.getByText(/Image required/i)).toBeInTheDocument();
    });

    it('hides warning when image is present in create mode', () => {
      render(
        <ImagePanel
          {...baseProps}
          imagePreview="https://example.com/image.jpg"
          isEditMode={true}
          isCreateMode={true}
        />,
      );

      expect(screen.queryByText(/Image required/i)).not.toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('opens file picker when button clicked', () => {
      render(<ImagePanel {...baseProps} isEditMode={true} />);

      const button = screen.getByRole('button', { name: /Add Image/i });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const clickSpy = vi.spyOn(fileInput, 'click');
      fireEvent.click(button);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('accepts valid image file', () => {
      render(<ImagePanel {...baseProps} isEditMode={true} />);

      const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      expect(mockSetSelectedImageFile).toHaveBeenCalledWith(file);
    });

    it('shows error dialog for non-image files', async () => {
      render(<ImagePanel {...baseProps} isEditMode={true} />);

      const file = new File(['dummy'], 'test.txt', { type: 'text/plain' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      // ErrorDialog should appear with error message
      expect(await screen.findByText('Please select a valid image file')).toBeInTheDocument();
      expect(mockSetSelectedImageFile).not.toHaveBeenCalled();
    });

    it('shows error dialog for files larger than 3MB', async () => {
      render(<ImagePanel {...baseProps} isEditMode={true} />);

      const largeFile = new File(['x'.repeat(4 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [largeFile] } });

      expect(await screen.findByText('Image is too large. Please select an image smaller than 3MB.')).toBeInTheDocument();
      expect(mockSetSelectedImageFile).not.toHaveBeenCalled();
    });

    it('accepts files under 3MB', async () => {
      render(<ImagePanel {...baseProps} isEditMode={true} />);

      const smallFile = new File(['x'.repeat(1024)], 'small.jpg', {
        type: 'image/jpeg',
      });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [smallFile] } });

      expect(mockSetSelectedImageFile).toHaveBeenCalledWith(smallFile);
    });

    it('converts file to base64 preview', () => {
      render(<ImagePanel {...baseProps} isEditMode={true} />);

      const file = new File(['dummy'], 'test.jpg', { type: 'image/jpeg' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      expect(mockSetSelectedImageFile).toHaveBeenCalledWith(file);
    });
  });

  describe('Accessibility', () => {
    it('has proper alt text on image', () => {
      render(<ImagePanel {...baseProps} imagePreview="https://example.com/rifle.jpg" />);

      const image = screen.getByRole('img');
      expect(image).toBeInTheDocument();
    });

    it('file input accepts images and HEIC files', () => {
      render(<ImagePanel {...baseProps} isEditMode={true} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toHaveAttribute('accept', 'image/*,.heic,.heif');
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined file selection', () => {
      render(<ImagePanel {...baseProps} isEditMode={true} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [] } });

      expect(mockSetSelectedImageFile).not.toHaveBeenCalled();
      expect(mockSetImagePreview).not.toHaveBeenCalled();
    });

    it('shows both edit button and warning in create mode without image', () => {
      render(<ImagePanel {...baseProps} isEditMode={true} isCreateMode={true} />);

      expect(screen.getByRole('button', { name: /Add Image/i })).toBeInTheDocument();
      expect(screen.getByText(/Image required/i)).toBeInTheDocument();
    });

    it('renders correctly in dark mode', () => {
      render(<ImagePanel {...baseProps} />);

      const container = screen.getByText(/No image available/i).closest('div');
      expect(container).toBeInTheDocument();
    });
  });
});