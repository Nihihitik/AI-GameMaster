import React from 'react';
import { render, screen } from '@testing-library/react';
import NarratorScreen from './NarratorScreen';
import { useGameStore } from '../../stores/gameStore';

describe('NarratorScreen', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('renders the server-provided announcement text and shared step counter', () => {
    useGameStore.setState({
      currentAnnouncement: {
        key: 'night_result',
        text: 'Серверная фраза ведущего',
        duration_ms: 3200,
        step_index: 2,
        steps_total: 3,
        blocking: true,
      },
    });

    render(<NarratorScreen />);

    expect(screen.getByText('Ведущий продолжает сценарий...')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText(/С/)).toBeInTheDocument();
  });
});
