import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMissions } from '../../src/hooks/useMissions';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('useMissions hook', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('returns initial loading state', () => {
    const { result } = renderHook(() => useMissions('all'), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.missions).toEqual([]);
  });

  it('returns missions after loading', async () => {
    const { result } = renderHook(() => useMissions('all'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.missions.length).toBeGreaterThan(0);
  });

  it('returns missions with correct structure', async () => {
    const { result } = renderHook(() => useMissions('all'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const mission = result.current.missions[0];
    expect(mission).toHaveProperty('id');
    expect(mission).toHaveProperty('type');
    expect(mission).toHaveProperty('title');
    expect(mission).toHaveProperty('createdAt');
    expect(mission).toHaveProperty('priority');
  });

  it('filters missions by savings filter', async () => {
    const { result } = renderHook(() => useMissions('savings'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.missions.forEach(mission => {
      expect(['savings', 'shopping']).toContain(mission.type);
    });
  });

  it('filters missions by ikigai filter', async () => {
    const { result } = renderHook(() => useMissions('ikigai'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.missions.forEach(mission => {
      expect(['content', 'travel', 'entertainment', 'food', 'people']).toContain(mission.type);
    });
  });

  it('filters missions by health filter', async () => {
    const { result } = renderHook(() => useMissions('health'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    result.current.missions.forEach(mission => {
      expect(mission.type).toBe('health');
    });
  });

  it('returns refetch function', async () => {
    const { result } = renderHook(() => useMissions('all'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
  });

  it('returns null error when no error', async () => {
    const { result } = renderHook(() => useMissions('all'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });
});

describe('useMissions mission types', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('includes shopping type missions', async () => {
    const { result } = renderHook(() => useMissions('all'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const shoppingMissions = result.current.missions.filter(m => m.type === 'shopping');
    expect(shoppingMissions.length).toBeGreaterThan(0);
  });

  it('includes travel type missions', async () => {
    const { result } = renderHook(() => useMissions('all'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const travelMissions = result.current.missions.filter(m => m.type === 'travel');
    expect(travelMissions.length).toBeGreaterThan(0);
  });

  it('includes health type missions', async () => {
    const { result } = renderHook(() => useMissions('all'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const healthMissions = result.current.missions.filter(m => m.type === 'health');
    expect(healthMissions.length).toBeGreaterThan(0);
  });
});
