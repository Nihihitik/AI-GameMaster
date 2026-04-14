import { useGameStore } from './gameStore';

describe('gameStore role reveal sync', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('updates both acknowledged count and total players from websocket payload', () => {
    useGameStore.getState().applyRoleAcknowledged({
      players_acknowledged: 2,
      players_total: 5,
    });

    const state = useGameStore.getState();
    expect(state.acknowledgedCount).toBe(2);
    expect(state.totalPlayers).toBe(5);
  });

  it('forces N/N after all players acknowledged', () => {
    useGameStore.setState({ totalPlayers: 5, acknowledgedCount: 3 });

    useGameStore.getState().applyAllAcknowledged();

    expect(useGameStore.getState().acknowledgedCount).toBe(5);
  });
});
