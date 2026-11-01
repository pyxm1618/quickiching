"use client";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";

/** A visible draggable rail, including on systems that hide native scrollbars. */
export function AccountScrollRegion({ children, className, scrollClassName, ariaLabel }: {
  children: React.ReactNode; className: string; scrollClassName: string; ariaLabel: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef(0);
  const id = useId();
  const [geometry, setGeometry] = useState({ height: 32, top: 0, maximum: 0, position: 0 });
  const measure = useCallback(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const maximum = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    const height = Math.max(32, scroll.clientHeight * scroll.clientHeight / Math.max(1, scroll.scrollHeight));
    setGeometry({ height, top: maximum ? scroll.scrollTop / maximum * (scroll.clientHeight - height) : 0, maximum, position: scroll.scrollTop });
  }, []);
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    if (scroll.firstElementChild) observer.observe(scroll.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [children, measure]);
  function setPosition(clientY: number) {
    const rail = railRef.current;
    const scroll = scrollRef.current;
    if (!rail || !scroll) return;
    const travel = rail.clientHeight - geometry.height;
    if (travel <= 0) return;
    scroll.scrollTop = Math.max(0, Math.min(1, (clientY - rail.getBoundingClientRect().top - dragOffset.current) / travel)) * geometry.maximum;
  }
  return <div className={`qic-account-scroll-region ${className}`}>
    <div id={id} ref={scrollRef} className={scrollClassName} tabIndex={0} aria-label={ariaLabel} onScroll={measure}>{children}</div>
    <div ref={railRef} className="qic-account-scroll-rail" onPointerDown={event => {
      if (!geometry.maximum) return;
      event.preventDefault();
      const thumb = event.currentTarget.firstElementChild?.getBoundingClientRect();
      dragOffset.current = thumb && event.clientY >= thumb.top && event.clientY <= thumb.bottom ? event.clientY - thumb.top : geometry.height / 2;
      event.currentTarget.setPointerCapture(event.pointerId);
      setPosition(event.clientY);
    }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setPosition(event.clientY); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
      <div className="qic-account-scroll-thumb" role="scrollbar" tabIndex={geometry.maximum ? 0 : -1} aria-label={ariaLabel} aria-controls={id} aria-orientation="vertical" aria-valuemin={0} aria-valuemax={Math.round(geometry.maximum)} aria-valuenow={Math.round(geometry.position)} style={{ height: `${geometry.height}px`, transform: `translateY(${geometry.top}px)` }} onKeyDown={event => {
        const scroll = scrollRef.current;
        if (!scroll) return;
        const delta = event.key === "ArrowDown" ? 40 : event.key === "ArrowUp" ? -40 : event.key === "PageDown" ? scroll.clientHeight : event.key === "PageUp" ? -scroll.clientHeight : null;
        if (delta !== null) { event.preventDefault(); scroll.scrollTop += delta; }
        if (event.key === "Home" || event.key === "End") { event.preventDefault(); scroll.scrollTop = event.key === "Home" ? 0 : geometry.maximum; }
      }} />
    </div>
  </div>;
}
