import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

describe('useClickOutside', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls handler when clicking outside the ref element', () => {
    const handler = vi.fn();
    const outside = document.createElement('div');
    document.body.appendChild(outside);

    const inside = document.createElement('div');
    document.body.appendChild(inside);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(inside);
      useClickOutside(ref, handler);
      return ref;
    });

    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(outside);
    document.body.removeChild(inside);
    void result;
  });

  it('does NOT call handler when clicking inside the ref element', () => {
    const handler = vi.fn();
    const inside = document.createElement('div');
    document.body.appendChild(inside);

    const child = document.createElement('span');
    inside.appendChild(child);

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(inside);
      useClickOutside(ref, handler);
    });

    child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(inside);
  });

  it('does NOT call handler when enabled=false', () => {
    const handler = vi.fn();
    const outside = document.createElement('div');
    const inside = document.createElement('div');
    document.body.appendChild(outside);
    document.body.appendChild(inside);

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(inside);
      useClickOutside(ref, handler, false);
    });

    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(outside);
    document.body.removeChild(inside);
  });

  it('responds to touch events', () => {
    const handler = vi.fn();
    const outside = document.createElement('div');
    const inside = document.createElement('div');
    document.body.appendChild(outside);
    document.body.appendChild(inside);

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(inside);
      useClickOutside(ref, handler);
    });

    outside.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(outside);
    document.body.removeChild(inside);
  });
});
