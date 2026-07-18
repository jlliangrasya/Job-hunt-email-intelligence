"use client";
import { motion } from "framer-motion";

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" } },
};

/** Wrap a `<tbody>`-equivalent list; children should be `<StaggerItem>`. */
export function StaggerList({ as = "div", children, className }) {
  const Component = motion[as];
  return (
    <Component variants={listVariants} initial="hidden" animate="show" className={className}>
      {children}
    </Component>
  );
}

/** A single animated row/item inside a `<StaggerList>`. */
export function StaggerItem({ as = "div", children, className, layout = true, ...props }) {
  const Component = motion[as];
  return (
    <Component variants={itemVariants} layout={layout} className={className} {...props}>
      {children}
    </Component>
  );
}
