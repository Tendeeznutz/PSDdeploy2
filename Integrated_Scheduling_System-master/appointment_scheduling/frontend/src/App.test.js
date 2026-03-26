import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('renders login page at /login route', () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>
  );
  const loginElement = screen.getByText(/login/i);
  expect(loginElement).toBeInTheDocument();
});

test('renders 404 page for unknown route', () => {
  render(
    <MemoryRouter initialEntries={['/nonexistent-route']}>
      <App />
    </MemoryRouter>
  );
  const notFoundElement = screen.getByText(/404|not found|does not exist/i);
  expect(notFoundElement).toBeInTheDocument();
});
