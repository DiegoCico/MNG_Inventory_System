import { render, screen, fireEvent } from "@testing-library/react";
import ExportPage from "../src/pages/ExportPage";
import { BrowserRouter } from "react-router-dom";

const setup = () =>
  render(
    <BrowserRouter>
      <ExportPage />
    </BrowserRouter>
  );

describe("ExportPage", () => {
  it("renders initial state with Create Documents button and progress bar", () => {
    setup();

    // TopBar exists
    expect(screen.getByRole("banner")).toBeInTheDocument();

    // Progress bar exists
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    // Create Documents button exists
    expect(
      screen.getByRole("button", { name: /create documents/i })
    ).toBeInTheDocument();

    // Bottom navigation buttons exist
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /to review/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reviewed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("clicking Create Documents shows loading state", () => {
    setup();
    const createButton = screen.getByRole("button", { name: /create documents/i });
    fireEvent.click(createButton);

    // Loading indicator is displayed
    expect(screen.getByText(/generating your documents/i)).toBeInTheDocument();

    // Original button disappears
    expect(screen.queryByRole("button", { name: /create documents/i })).not.toBeInTheDocument();
  });

  it("TopBar and bottom nav remain visible during loading", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /create documents/i }));

    // TopBar
    expect(screen.getByRole("banner")).toBeInTheDocument();

    // Bottom nav buttons
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("does not crash during interaction", () => {
    setup();

    const createButton = screen.getByRole("button", { name: /create documents/i });
    fireEvent.click(createButton);

    // The page still renders TopBar and progress bar
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
