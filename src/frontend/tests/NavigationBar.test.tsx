import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import NavBar from '../src/components/NavBar';

describe('NavBar', () => {
  it('renders all navigation buttons', () => {
    render(
      <MemoryRouter>
        <NavBar />
      </MemoryRouter>
    );

    // Adjust these to match your actual NavBar text
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('To Review')).toBeInTheDocument();
    expect(screen.getByText('Reviewed')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();

  });
});
