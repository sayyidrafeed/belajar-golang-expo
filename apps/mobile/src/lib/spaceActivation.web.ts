type KeyEvent = { key: string; repeat: boolean; preventDefault: () => void };

// React Native Web handles Space for button roles, but not checkbox/radio/tab roles.
export function spaceActivation(activate: () => void, disabled = false) {
  return {
    onKeyDown: (event: KeyEvent) => {
      if (event.key === ' ' && !disabled) {
        event.preventDefault();
        if (!event.repeat) activate();
      }
    },
  };
}
