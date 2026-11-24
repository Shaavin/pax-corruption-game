import { Rosarivo } from "next/font/google";

/**
 * The rulebooks set their story passages in Kokonor's calligraphic italic (a Mac font); this is
 * the nearest web font at its light weight. Defined once here: Next hosts one copy per call.
 */
export const calligraphy = Rosarivo({ weight: "400", style: "italic", subsets: ["latin"], preload: false, display: "swap" });
