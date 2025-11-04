import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Profile from "../src/components/Profile";

// Mock props
const mockOnClose = vi.fn();
const mockOnProfileImageChange = vi.fn();

const baseProps = {
  open: true,
  onClose: mockOnClose,
  profileImage: null,
  onProfileImageChange: mockOnProfileImageChange,
  name: "Ben Tran",
  email: "tran.b@northeastern.edu",
  team: "GreenFuel Dev Team",
  permissions: "Admin",
};

describe("Profile Component", () => {
  it("renders profile dialog when open", () => {
    render(<Profile {...baseProps} />);
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Ben Tran")).toBeInTheDocument();
    expect(screen.getByText("tran.b@northeastern.edu")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(<Profile {...baseProps} />);
    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("calls onProfileImageChange when a new file is uploaded", async () => {
    render(<Profile {...baseProps} />);

    const fileInput = screen.getByTestId("file-input") as HTMLInputElement;
    const file = new File(["dummy-content"], "test.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnProfileImageChange).toHaveBeenCalledWith(file);
    });
  });

  it("displays uploaded profile image if provided", () => {
    render(<Profile {...baseProps} profileImage="https://example.com/test.png" />);
    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("src", "https://example.com/test.png");
  });

  it("renders team and permission info correctly", () => {
    render(<Profile {...baseProps} />);
    expect(screen.getByText("GreenFuel Dev Team")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });
});
