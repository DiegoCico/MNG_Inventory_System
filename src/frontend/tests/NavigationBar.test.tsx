import { render, screen } from "@testing-library/react";
import NavBar from "../src/components/NavBar";
import { describe, it, expect } from "vitest";


describe("NavBar", () => {
  it("renders all navigation buttons", () => {
    render(<NavBar />);
    expect(screen.getByRole("button", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /to review/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reviewed/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });
});