function BorderAnimatedContainer({ children }) {
  return (
    <div
      className="
        chatify-frame
        relative
        w-full
        h-full
        min-h-0
        flex
        overflow-hidden
        rounded-[28px]
        border
        border-white/10
        bg-slate-900/75 shadow-[0_30px_100px_rgba(0,0,0,.5)]
        animate-border
      "
    >
      {children}
    </div>
  );
}

export default BorderAnimatedContainer;
