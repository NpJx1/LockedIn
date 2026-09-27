# Locked In
## Productivity Focused LockDown Browser
### Main .exe is in Lockedin/dist/win-unpacked

LockedIn is a high-stakes productivity desktop browser built with Electron and React. Instead of relying purely on willpower, LockedIn replaces your standard browser with a heavily restricted, custom web environment powered by a real-time points economy.

When a session starts, the application locks you into a dedicated workspace, intercepts network requests to block distracting domains, and forces you to earn your break time.
Core Features

    The Dual-Room Architecture: The application operates in two distinct phases. The 'Idle' phase functions as a control room to set focus timers. The 'Locked' phase strips away the OS window frame and traps the user in a custom full-screen `` browser tabbed interface.

    Focus Economy & Debt: Users earn 1 point per minute of active focus. Points serve as currency: a standard break costs 10 points, while an "Emergency Exit" from a session costs 15 points. Users can go into negative point debt, gamifying the friction of breaking focus.

    System-Level Network Blocking: Distracting URLs (social media, doom-scrolling sites) are intercepted and blocked at the Electron main-process level. Essential background focus tools like Spotify and YouTube are explicitly whitelisted.

    Strict Minimalist UI: The interface relies entirely on vanilla CSS, featuring a dark-mode theme, rigid Flexbox layouts, and Space Mono typography with slashed zeros for high-visibility timer tracking.

Tech Stack

    Framework: Electron-Vite

    Frontend: React, TypeScript, Vanilla CSS

    Backend: Node.js, Electron ipcMain / ipcRenderer

    Browser Engine: Embedded Chromium `` tags with custom partition routing (persist:lockedin).
