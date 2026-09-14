declare module 'async-exit-hook' {
  const exitHook: {
    unhookEvent(event: string): void;
  };
  export default exitHook;
}
